const { MongoClient } = require("mongodb");

const mongoUri = process.env.MONGO_URI;
const databaseName = process.env.MONGO_DB_NAME;

let client;
let database;

async function connectMongoDB() {
  if (!mongoUri || !databaseName) {
    throw new Error("MongoDB environment variables are missing.");
  }

  client = new MongoClient(mongoUri);

  await client.connect();

  database = client.db(databaseName);

  await database.command({ ping: 1 });

  console.log("MongoDB connected successfully.");

  return database;
}

function getMongoDB() {
  if (!database) {
    throw new Error("MongoDB is not connected.");
  }

  return database;
}

async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    database = null;
    console.log("MongoDB connection closed.");
  }
}

module.exports = {
  connectMongoDB,
  getMongoDB,
  closeMongoDB,
};
