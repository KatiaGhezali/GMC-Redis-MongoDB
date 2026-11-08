const {
  searchStops,
  getStopById,
  getUpcomingDepartures,
} = require("../services/stopService");

const {
  findNearbyStopsMongoDB,
  findNearbyStopsRedis,
} = require("../services/nearbyStopService");

function getDatabaseType(value) {
  const database = value || "mongodb";

  if (!["mongodb", "redis"].includes(database)) {
    throw new Error("Database must be either 'mongodb' or 'redis'.");
  }

  return database;
}

function parseDate(value) {
  if (!value) {
    return new Date();
  }

  // Accept YYYY-MM-DD and construct a local date.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Invalid date.");
  }

  return date;
}

async function searchStopsController(req, res, next) {
  try {
    const { search } = req.query;

    if (!search || !search.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a search term.",
      });
    }

    const stops = await searchStops(search);

    res.json({
      success: true,
      count: stops.length,
      data: stops,
    });
  } catch (error) {
    next(error);
  }
}

async function getStopController(req, res, next) {
  try {
    const database = getDatabaseType(req.query.database);
    const stop = await getStopById(req.params.stopId, database);

    if (!stop) {
      return res.status(404).json({
        success: false,
        message: "Stop not found.",
      });
    }

    res.json({
      success: true,
      database,
      data: stop,
    });
  } catch (error) {
    next(error);
  }
}

async function getDeparturesController(req, res, next) {
  try {
    const database = getDatabaseType(req.query.database);
    const date = parseDate(req.query.date);

    const departures = await getUpcomingDepartures(
      req.params.stopId,
      date,
      database,
    );

    res.json({
      success: true,
      database,
      date: date.toLocaleDateString("en-CA"),
      count: departures.length,
      data: departures,
    });
  } catch (error) {
    next(error);
  }
}

async function getNearbyStopsController(req, res, next) {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);
    const radiusKm = Number(req.query.radiusKm || 2);
    const database = getDatabaseType(req.query.database);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid lat and lon coordinates.",
      });
    }

    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      return res.status(400).json({
        success: false,
        message: "radiusKm must be a positive number.",
      });
    }

    const stops =
      database === "redis"
        ? await findNearbyStopsRedis(latitude, longitude, radiusKm)
        : await findNearbyStopsMongoDB(latitude, longitude, radiusKm);

    res.json({
      success: true,
      database,
      count: stops.length,
      data: stops,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  searchStopsController,
  getStopController,
  getDeparturesController,
  getNearbyStopsController,
};
