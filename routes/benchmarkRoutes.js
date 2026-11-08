const express = require("express");

const {
  runBenchmarksController,
} = require("../controllers/benchmarkController");

const router = express.Router();

router.get("/", runBenchmarksController);

module.exports = router;
