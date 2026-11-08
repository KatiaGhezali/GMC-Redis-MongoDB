require("dotenv").config();

const {
  connectMongoDB,
  getMongoDB,
  closeMongoDB,
} = require("../config/mongodb");

async function createIndexes() {
  try {
    await connectMongoDB();

    const database = getMongoDB();

    console.log("\nCreating MongoDB indexes...\n");

    await database
      .collection("stops")
      .createIndex({ stop_id: 1 }, { unique: true });

    await database.collection("stops").createIndex({
      stop_name: "text",
    });

    await database.collection("stops").createIndex({
      location: "2dsphere",
    });

    await database
      .collection("routes")
      .createIndex({ route_id: 1 }, { unique: true });

    await database
      .collection("trips")
      .createIndex({ trip_id: 1 }, { unique: true });

    await database.collection("trips").createIndex({
      route_id: 1,
      service_id: 1,
    });

    await database.collection("stop_times").createIndex({
      stop_id: 1,
      departure_seconds: 1,
    });

    await database.collection("stop_times").createIndex({
      trip_id: 1,
      stop_sequence: 1,
    });

    await database
      .collection("calendar")
      .createIndex({ service_id: 1 }, { unique: true });

    console.log("All MongoDB indexes created successfully.");
  } catch (error) {
    console.error("Index creation failed:", error);
    process.exitCode = 1;
  } finally {
    await closeMongoDB();
  }
}

createIndexes();
