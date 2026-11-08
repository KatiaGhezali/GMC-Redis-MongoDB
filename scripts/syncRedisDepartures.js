require("dotenv").config();

const {
  connectMongoDB,
  getMongoDB,
  closeMongoDB,
} = require("../config/mongodb");

const { connectRedis, getRedis, closeRedis } = require("../config/redis");

async function syncRedisDepartures() {
  try {
    await connectMongoDB();
    await connectRedis();

    const database = getMongoDB();
    const redis = getRedis();

    console.log("\nStarting Redis departures synchronization...\n");

    // Remove only the previous v2 departure and calendar keys.
    const oldKeys = await redis.keys("gtfs:departures:v2:*");

    if (oldKeys.length > 0) {
      await redis.del(oldKeys);
    }

    const oldCalendarKeys = await redis.keys("gtfs:calendar:v2:*");

    if (oldCalendarKeys.length > 0) {
      await redis.del(oldCalendarKeys);
    }

    // Load GTFS data from MongoDB.
    const [stopTimes, trips, calendars] = await Promise.all([
      database.collection("stop_times").find({}).toArray(),
      database.collection("trips").find({}).toArray(),
      database.collection("calendar").find({}).toArray(),
    ]);

    const tripMap = new Map(trips.map((trip) => [trip.trip_id, trip]));

    // Store calendar information in Redis.
    for (const calendar of calendars) {
      await redis.hSet(`gtfs:calendar:v2:${calendar.service_id}`, {
        service_id: calendar.service_id,
        monday: String(calendar.monday),
        tuesday: String(calendar.tuesday),
        wednesday: String(calendar.wednesday),
        thursday: String(calendar.thursday),
        friday: String(calendar.friday),
        saturday: String(calendar.saturday),
        sunday: String(calendar.sunday),
        start_date: String(calendar.start_date),
        end_date: String(calendar.end_date),
      });
    }

    // Group departures by stop.
    const departuresByStop = new Map();

    for (const stopTime of stopTimes) {
      const trip = tripMap.get(stopTime.trip_id);

      if (!trip) {
        continue;
      }

      const departure = {
        trip_id: stopTime.trip_id,
        stop_id: stopTime.stop_id,
        stop_sequence: Number(stopTime.stop_sequence),
        arrival_time: stopTime.arrival_time,
        departure_time: stopTime.departure_time,
        arrival_seconds: Number(stopTime.arrival_seconds),
        departure_seconds: Number(stopTime.departure_seconds),
        pickup_type: Number(stopTime.pickup_type || 0),
        drop_off_type: Number(stopTime.drop_off_type || 0),
        service_id: trip.service_id,
        route_id: trip.route_id,
        trip_headsign: trip.trip_headsign,
        trip_short_name: trip.trip_short_name,
        direction_id: trip.direction_id,
        shape_id: trip.shape_id,
        wheelchair_accessible: trip.wheelchair_accessible,
        bikes_allowed: trip.bikes_allowed,
      };

      if (!departuresByStop.has(stopTime.stop_id)) {
        departuresByStop.set(stopTime.stop_id, []);
      }

      departuresByStop.get(stopTime.stop_id).push(departure);
    }

    // Store each stop's departures in a Redis sorted set.
    for (const [stopId, departures] of departuresByStop) {
      const key = `gtfs:departures:v2:${stopId}`;

      const members = departures.map((departure) => ({
        score: departure.departure_seconds,
        value: JSON.stringify(departure),
      }));

      if (members.length > 0) {
        await redis.zAdd(key, members);
      }
    }

    console.log(`Stop times processed: ${stopTimes.length}`);
    console.log(`Trips loaded: ${trips.length}`);
    console.log(`Calendars loaded: ${calendars.length}`);
    console.log(`Stops with departures: ${departuresByStop.size}`);

    console.log("\nRedis departures synchronization completed!");
  } catch (error) {
    console.error("Redis synchronization failed:", error);
    process.exitCode = 1;
  } finally {
    await closeRedis();
    await closeMongoDB();
  }
}

syncRedisDepartures();
