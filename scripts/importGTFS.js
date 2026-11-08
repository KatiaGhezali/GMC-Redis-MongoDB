require("dotenv").config();

const path = require("path");

const { loadGTFSData, parseGTFSTime } = require("../utils/gtfsParser");

const { connectMongoDB, closeMongoDB } = require("../config/mongodb");

const { connectRedis, closeRedis, getRedis } = require("../config/redis");

const ZIP_PATH = path.join(__dirname, "../data/gtfs/feed.zip");

const BATCH_SIZE = 500;

function transformStops(stops) {
  return stops.map((stop) => {
    const latitude = Number(stop.stop_lat);
    const longitude = Number(stop.stop_lon);

    const validCoordinates =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;

    return {
      ...stop,
      stop_lat: latitude,
      stop_lon: longitude,
      ...(validCoordinates
        ? {
            location: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
          }
        : {}),
    };
  });
}

function transformTrips(trips) {
  return trips.map((trip) => ({
    ...trip,
    direction_id: trip.direction_id ? Number(trip.direction_id) : null,
    wheelchair_accessible: Number(trip.wheelchair_accessible || 0),
    bikes_allowed: Number(trip.bikes_allowed || 0),
  }));
}

function transformStopTimes(stopTimes) {
  return stopTimes.map((stopTime) => ({
    ...stopTime,
    arrival_seconds: parseGTFSTime(stopTime.arrival_time),
    departure_seconds: parseGTFSTime(stopTime.departure_time),
    stop_sequence: Number(stopTime.stop_sequence),
    pickup_type: Number(stopTime.pickup_type || 0),
    drop_off_type: Number(stopTime.drop_off_type || 0),
  }));
}

function transformCalendar(calendar) {
  const weekdays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  return calendar.map((service) => {
    const transformed = {
      ...service,
      start_date: Number(service.start_date),
      end_date: Number(service.end_date),
    };

    for (const day of weekdays) {
      transformed[day] = Number(service[day]);
    }

    return transformed;
  });
}

async function insertMongoCollection(database, name, records) {
  const collection = database.collection(name);

  await collection.deleteMany({});

  if (records.length === 0) {
    console.log(`${name}: no records to import.`);
    return;
  }

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await collection.insertMany(batch);
  }

  console.log(`${name}: imported ${records.length} records into MongoDB.`);
}

async function importMongoDB(database, data) {
  console.log("\nImporting data into MongoDB...\n");

  const collections = {
    agency: data.agency,
    routes: data.routes,
    stops: transformStops(data.stops),
    trips: transformTrips(data.trips),
    stop_times: transformStopTimes(data.stop_times),
    calendar: transformCalendar(data.calendar),
    shapes: data.shapes,
  };

  for (const [name, records] of Object.entries(collections)) {
    await insertMongoCollection(database, name, records);
  }
}

async function importRedis(data) {
  console.log("\nImporting data into Redis...\n");

  const redis = getRedis();

  // Remove data from a previous import.
  const oldKeys = await redis.keys("gtfs:*");

  if (oldKeys.length > 0) {
    await redis.del(oldKeys);
  }

  const stops = transformStops(data.stops);
  const trips = transformTrips(data.trips);
  const stopTimes = transformStopTimes(data.stop_times);

  // Store stops and geographic coordinates.
  for (let i = 0; i < stops.length; i += BATCH_SIZE) {
    const batch = stops.slice(i, i + BATCH_SIZE);
    const multi = redis.multi();

    for (const stop of batch) {
      multi.hSet(`gtfs:stop:${stop.stop_id}`, {
        stop_id: stop.stop_id,
        stop_name: stop.stop_name,
        stop_lat: String(stop.stop_lat),
        stop_lon: String(stop.stop_lon),
      });

      if (stop.location) {
        multi.geoAdd("gtfs:stops:geo", {
          longitude: stop.stop_lon,
          latitude: stop.stop_lat,
          member: stop.stop_id,
        });
      }
    }

    await multi.exec();
  }

  // Store routes.
  for (const route of data.routes) {
    await redis.hSet(`gtfs:route:${route.route_id}`, {
      ...Object.fromEntries(
        Object.entries(route).map(([key, value]) => [key, String(value ?? "")]),
      ),
    });
  }

  // Store trips.
  for (const trip of trips) {
    await redis.hSet(`gtfs:trip:${trip.trip_id}`, {
      ...Object.fromEntries(
        Object.entries(trip).map(([key, value]) => [key, String(value ?? "")]),
      ),
    });
  }

  // Create a departure sorted set for each stop.
  const departuresByStop = new Map();

  for (const stopTime of stopTimes) {
    if (!departuresByStop.has(stopTime.stop_id)) {
      departuresByStop.set(stopTime.stop_id, []);
    }

    departuresByStop.get(stopTime.stop_id).push({
      score: stopTime.departure_seconds,
      value: `${stopTime.trip_id}:${stopTime.stop_sequence}`,
    });
  }

  for (const [stopId, departures] of departuresByStop) {
    for (let i = 0; i < departures.length; i += BATCH_SIZE) {
      await redis.zAdd(
        `gtfs:departures:${stopId}`,
        departures.slice(i, i + BATCH_SIZE),
      );
    }
  }

  console.log(`stops: imported ${stops.length} records into Redis.`);
  console.log(`routes: imported ${data.routes.length} records into Redis.`);
  console.log(`trips: imported ${trips.length} records into Redis.`);
  console.log(`stop_times: indexed ${stopTimes.length} departures in Redis.`);
}

async function main() {
  let mongoConnected = false;
  let redisConnected = false;

  try {
    console.log("Loading GTFS dataset...\n");

    const data = loadGTFSData(ZIP_PATH);

    await connectMongoDB();
    mongoConnected = true;

    const database = require("../config/mongodb").getMongoDB();

    await connectRedis();
    redisConnected = true;

    await importMongoDB(database, data);
    await importRedis(data);

    console.log("\nGTFS import completed successfully.");
  } catch (error) {
    console.error("\nImport failed:", error);
    process.exitCode = 1;
  } finally {
    if (redisConnected) {
      await closeRedis();
    }

    if (mongoConnected) {
      await closeMongoDB();
    }
  }
}

main();
