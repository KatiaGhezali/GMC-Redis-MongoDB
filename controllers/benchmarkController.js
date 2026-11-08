const { performance } = require("perf_hooks");

const {
  getStopById,
  getUpcomingDepartures,
} = require("../services/stopService");

const {
  findNearbyStopsMongoDB,
  findNearbyStopsRedis,
} = require("../services/nearbyStopService");

function getPercentile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(percentile * sorted.length) - 1;

  return sorted[Math.max(0, index)];
}

function getStatistics(values) {
  return {
    iterations: values.length,
    averageMs: Number(
      (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
        3,
      ),
    ),
    medianMs: Number(getPercentile(values, 0.5).toFixed(3)),
    p95Ms: Number(getPercentile(values, 0.95).toFixed(3)),
    minMs: Number(Math.min(...values).toFixed(3)),
    maxMs: Number(Math.max(...values).toFixed(3)),
    measurementsMs: values,
  };
}

async function runBenchmark(queryFunction, iterations) {
  await queryFunction();

  const durations = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    await queryFunction();

    const end = performance.now();

    durations.push(Number((end - start).toFixed(3)));
  }

  return getStatistics(durations);
}

function normalizeStop(stop) {
  return {
    stop_id: stop.stop_id,
    stop_name: stop.stop_name,
    stop_lat: Number(stop.stop_lat),
    stop_lon: Number(stop.stop_lon),
  };
}

function normalizeDeparture(departure) {
  return {
    trip_id: departure.trip_id,
    stop_id: departure.stop_id,
    departure_time: departure.departure_time,
    arrival_time: departure.arrival_time,
    departure_seconds: Number(departure.departure_seconds),
    arrival_seconds: Number(departure.arrival_seconds),
    service_id: departure.trip?.service_id || departure.service_id,
    route_id: departure.trip?.route_id || departure.route_id,
    trip_headsign: departure.trip?.trip_headsign || departure.trip_headsign,
  };
}

function resultsMatch(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

async function runBenchmarksController(req, res, next) {
  try {
    const iterations = Math.min(
      Math.max(Number(req.query.iterations) || 30, 1),
      200,
    );

    const stopId = req.query.stopId || "MTB10";
    const departureStopId = req.query.departureStopId || "MTB15";

    const dateString = req.query.date || "2026-11-06";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return res.status(400).json({
        success: false,
        message: "Date must use YYYY-MM-DD format.",
      });
    }

    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date.",
      });
    }

    const latitude = Number(req.query.lat || 45.502415);
    const longitude = Number(req.query.lon || 6.054071);
    const radiusKm = Number(req.query.radiusKm || 2);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(radiusKm) ||
      radiusKm <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinates or radius.",
      });
    }

    const mongoStopQuery = () => getStopById(stopId, "mongodb");
    const redisStopQuery = () => getStopById(stopId, "redis");

    const mongoNearbyQuery = () =>
      findNearbyStopsMongoDB(latitude, longitude, radiusKm);

    const redisNearbyQuery = () =>
      findNearbyStopsRedis(latitude, longitude, radiusKm);

    const mongoDeparturesQuery = () =>
      getUpcomingDepartures(departureStopId, date, "mongodb");

    const redisDeparturesQuery = () =>
      getUpcomingDepartures(departureStopId, date, "redis");

    const [
      mongoStopResult,
      redisStopResult,
      mongoNearbyResult,
      redisNearbyResult,
      mongoDeparturesResult,
      redisDeparturesResult,
    ] = await Promise.all([
      mongoStopQuery(),
      redisStopQuery(),
      mongoNearbyQuery(),
      redisNearbyQuery(),
      mongoDeparturesQuery(),
      redisDeparturesQuery(),
    ]);

    const correctness = {
      stopLookup: resultsMatch(
        normalizeStop(mongoStopResult),
        normalizeStop(redisStopResult),
      ),

      nearbyStops: resultsMatch(
        mongoNearbyResult.map(normalizeStop),
        redisNearbyResult.map(normalizeStop),
      ),

      departures: resultsMatch(
        mongoDeparturesResult.map(normalizeDeparture),
        redisDeparturesResult.map(normalizeDeparture),
      ),
    };

    // Measure each database operation.
    const comparisons = {
      stopLookup: {
        mongodb: await runBenchmark(mongoStopQuery, iterations),
        redis: await runBenchmark(redisStopQuery, iterations),
      },

      nearbyStops: {
        mongodb: await runBenchmark(mongoNearbyQuery, iterations),
        redis: await runBenchmark(redisNearbyQuery, iterations),
      },

      departures: {
        mongodb: await runBenchmark(mongoDeparturesQuery, iterations),
        redis: await runBenchmark(redisDeparturesQuery, iterations),
      },
    };

    res.json({
      success: true,
      note: "Application-level query latency measured in milliseconds. Each query is warmed up before measurement.",
      iterations,
      parameters: {
        stopId,
        departureStopId,
        date: dateString,
        latitude,
        longitude,
        radiusKm,
      },
      correctness,
      resultCounts: {
        nearbyStops: {
          mongodb: mongoNearbyResult.length,
          redis: redisNearbyResult.length,
        },
        departures: {
          mongodb: mongoDeparturesResult.length,
          redis: redisDeparturesResult.length,
        },
      },
      comparisons,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  runBenchmarksController,
};
