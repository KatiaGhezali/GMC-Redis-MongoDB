const { getMongoDB } = require("../config/mongodb");
const { getRedis } = require("../config/redis");

function normalizeStop(stop) {
  return {
    stop_id: stop.stop_id,
    stop_name: stop.stop_name,
    stop_lat: Number(stop.stop_lat),
    stop_lon: Number(stop.stop_lon),
  };
}

async function findNearbyStopsMongoDB(latitude, longitude, radiusKm = 2) {
  const database = getMongoDB();

  const stops = await database
    .collection("stops")
    .find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusKm * 1000,
        },
      },
    })
    .limit(20)
    .toArray();

  return stops.map(normalizeStop);
}

async function findNearbyStopsRedis(latitude, longitude, radiusKm = 2) {
  const redis = getRedis();

  const stopIds = await redis.sendCommand([
    "GEORADIUS",
    "gtfs:stops:geo",
    String(longitude),
    String(latitude),
    String(radiusKm),
    "km",
    "ASC",
    "COUNT",
    "20",
  ]);

  if (stopIds.length === 0) {
    return [];
  }

  const stops = await Promise.all(
    stopIds.map(async (stopId) => {
      const stop = await redis.hGetAll(`gtfs:stop:${stopId}`);

      return normalizeStop(stop);
    }),
  );

  return stops;
}

module.exports = {
  findNearbyStopsMongoDB,
  findNearbyStopsRedis,
};
