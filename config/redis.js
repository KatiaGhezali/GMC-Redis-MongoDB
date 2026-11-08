const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error.message);
});

async function connectRedis() {
  if (redisClient.isOpen) {
    return redisClient;
  }

  await redisClient.connect();
  await redisClient.ping();

  console.log("Redis connected successfully.");

  return redisClient;
}

function getRedis() {
  if (!redisClient.isOpen) {
    throw new Error("Redis is not connected.");
  }

  return redisClient;
}

async function closeRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit();
    console.log("Redis connection closed.");
  }
}

module.exports = {
  connectRedis,
  getRedis,
  closeRedis,
};
