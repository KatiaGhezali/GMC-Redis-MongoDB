const { getMongoDB } = require("../config/mongodb");
const { getRedis } = require("../config/redis");

const {
  getActiveServiceIdsMongoDB,
  getActiveServiceIdsRedis,
} = require("./calendarService");

async function searchStops(searchTerm) {
  const database = getMongoDB();

  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }

  return database
    .collection("stops")
    .find({
      stop_name: {
        $regex: searchTerm.trim(),
        $options: "i",
      },
    })
    .limit(20)
    .toArray();
}

async function getStopById(stopId, databaseType = "mongodb") {
  if (databaseType === "redis") {
    const redis = getRedis();

    const stop = await redis.hGetAll(`gtfs:stop:${stopId}`);

    if (Object.keys(stop).length === 0) {
      return null;
    }

    return {
      ...stop,
      stop_lat: Number(stop.stop_lat),
      stop_lon: Number(stop.stop_lon),
    };
  }

  const database = getMongoDB();

  return database.collection("stops").findOne({
    stop_id: stopId,
  });
}

async function getUpcomingDepartures(
  stopId,
  date = new Date(),
  databaseType = "mongodb",
) {
  if (!["mongodb", "redis"].includes(databaseType)) {
    throw new Error("Database must be either 'mongodb' or 'redis'.");
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required.");
  }

  // Redis implementation:
  if (databaseType === "redis") {
    const redis = getRedis();

    const activeServiceIds = await getActiveServiceIdsRedis(date);

    if (activeServiceIds.length === 0) {
      return [];
    }

    const departures = await redis.zRangeWithScores(
      `gtfs:departures:v2:${stopId}`,
      0,
      -1,
    );

    return departures
      .map((item) => JSON.parse(item.value))
      .filter((departure) => activeServiceIds.includes(departure.service_id))
      .sort((a, b) => a.departure_seconds - b.departure_seconds);
  }

  // MongoDB implementation.
  const database = getMongoDB();

  const activeServiceIds = await getActiveServiceIdsMongoDB(date);

  if (activeServiceIds.length === 0) {
    return [];
  }

  const stopTimes = await database
    .collection("stop_times")
    .find({
      stop_id: stopId,
    })
    .sort({
      departure_seconds: 1,
    })
    .toArray();

  if (stopTimes.length === 0) {
    return [];
  }

  const tripIds = [...new Set(stopTimes.map((item) => item.trip_id))];

  const trips = await database
    .collection("trips")
    .find({
      trip_id: { $in: tripIds },
      service_id: { $in: activeServiceIds },
    })
    .toArray();

  const tripMap = new Map(trips.map((trip) => [trip.trip_id, trip]));

  return stopTimes
    .filter((stopTime) => tripMap.has(stopTime.trip_id))
    .map((stopTime) => ({
      ...stopTime,
      trip: tripMap.get(stopTime.trip_id),
    }));
}
module.exports = {
  searchStops,
  getStopById,
  getUpcomingDepartures,
};
