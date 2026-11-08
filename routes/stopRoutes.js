const express = require("express");

const {
  searchStopsController,
  getStopController,
  getDeparturesController,
  getNearbyStopsController,
} = require("../controllers/stopController");

const router = express.Router();

router.get("/search", searchStopsController);
router.get("/nearby", getNearbyStopsController);
router.get("/:stopId/departures", getDeparturesController);
router.get("/:stopId", getStopController);

module.exports = router;
