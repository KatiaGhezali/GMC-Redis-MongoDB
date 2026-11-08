require("dotenv").config();

const { connectMongoDB, closeMongoDB } = require("../config/mongodb");

const { connectRedis, closeRedis } = require("../config/redis");

const {
  searchStops,
  getStopById,
  getUpcomingDepartures,
} = require("../services/stopService");

const {
  findNearbyStopsMongoDB,
  findNearbyStopsRedis,
} = require("../services/nearbyStopService");

async function main() {
  let mongoConnected = false;
  let redisConnected = false;

  try {
    await connectMongoDB();
    mongoConnected = true;

    await connectRedis();
    redisConnected = true;

    // 1. Search for stops.
    console.log("\n1. Searching for stops containing 'Centre':");

    const stops = await searchStops("Centre");
    console.log(stops);

    // 2. Retrieve a stop from MongoDB.
    console.log("\n2. Retrieve MTB10 from MongoDB:");

    const mongoStop = await getStopById("MTB10", "mongodb");
    console.log(mongoStop);

    // 3. Retrieve the same stop from Redis.
    console.log("\n3. Retrieve MTB10 from Redis:");

    const redisStop = await getStopById("MTB10", "redis");
    console.log(redisStop);

    // 4. Get departures from a stop.
    // The feed's service operates on Tuesday, Wednesday and Friday.
    // Use a known operating date within the calendar period.
    console.log("\n4. Departures from MTB15:");

    const serviceDate = new Date(2026, 10, 6);

    const mongoDepartures = await getUpcomingDepartures(
      "MTB15",
      serviceDate,
      "mongodb",
    );

    console.log("MongoDB departures:", mongoDepartures);

    const redisDepartures = await getUpcomingDepartures(
      "MTB15",
      serviceDate,
      "redis",
    );

    console.log("Redis departures:", redisDepartures);

    // 5. Nearby stops.
    // Coordinates are taken from the first stop in the feed.
    console.log("\n5. Nearby stops:");

    const latitude = 45.502415;
    const longitude = 6.054071;

    const mongoNearby = await findNearbyStopsMongoDB(latitude, longitude);

    const redisNearby = await findNearbyStopsRedis(latitude, longitude);

    console.log("MongoDB nearby stops:", mongoNearby);
    console.log("Redis nearby stops:", redisNearby);
  } catch (error) {
    console.error("\nService test failed:", error);
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
