require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
  connectMongoDB,
  getMongoDB,
  closeMongoDB,
} = require("./config/mongodb");

const { connectRedis, getRedis, closeRedis } = require("./config/redis");

// Import API routes
const stopRoutes = require("./routes/stopRoutes");
const benchmarkRoutes = require("./routes/benchmarkRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    await getMongoDB().command({ ping: 1 });
    await getRedis().ping();

    res.status(200).json({
      status: "success",
      message: "Application and databases are working",
      databases: {
        mongodb: "connected",
        redis: "connected",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database health check failed",
      error: error.message,
    });
  }
});

// API routes
app.use("/api/stops", stopRoutes);
app.use("/api/benchmarks", benchmarkRoutes);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("API error:", error);

  res.status(500).json({
    success: false,
    message: error.message || "Internal server error.",
  });
});

// Start app
async function startServer() {
  try {
    await connectMongoDB();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start application:", error.message);

    await closeRedis();
    await closeMongoDB();

    process.exit(1);
  }
}

async function shutdown() {
  console.log("\nShutting down server...");

  await closeRedis();
  await closeMongoDB();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
