const path = require("path");
const { loadGTFSData, parseGTFSTime } = require("../utils/gtfsParser");

const zipPath = path.join(__dirname, "../data/gtfs/feed.zip");

try {
  const data = loadGTFSData(zipPath);

  console.log("\nGTFS data loaded successfully.");

  console.log("\nFirst stop:");
  console.log(data.stops[0]);

  console.log("\nFirst route:");
  console.log(data.routes[0]);

  console.log("\nFirst trip:");
  console.log(data.trips[0]);

  console.log("\nFirst stop time:");
  console.log(data.stop_times[0]);

  console.log("\nFirst calendar entry:");
  console.log(data.calendar[0]);

  console.log("\n09:00:00 in seconds:", parseGTFSTime("09:00:00"));
} catch (error) {
  console.error("GTFS parser error:", error.message);
  process.exit(1);
}
