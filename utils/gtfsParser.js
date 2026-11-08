const AdmZip = require("adm-zip");
const { parse } = require("csv-parse/sync");

const REQUIRED_FILES = [
  "agency.txt",
  "routes.txt",
  "stops.txt",
  "trips.txt",
  "stop_times.txt",
  "calendar.txt",
];

const OPTIONAL_FILES = ["calendar_dates.txt", "shapes.txt", "transfers.txt"];

function findGTFSFile(zip, filename) {
  const matches = zip.getEntries().filter((entry) => {
    const entryName = entry.entryName.split("/").pop();
    return entryName.toLowerCase() === filename.toLowerCase();
  });

  if (matches.length > 1) {
    throw new Error(`Multiple copies of ${filename} found in the ZIP.`);
  }

  return matches[0] || null;
}

function readGTFSFile(zip, filename, required = false) {
  const entry = findGTFSFile(zip, filename);

  if (!entry) {
    if (required) {
      throw new Error(`Required GTFS file is missing: ${filename}`);
    }

    console.log(`${filename}: not included (optional)`);
    return [];
  }

  const content = entry.getData().toString("utf8");

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  console.log(`${filename}: ${records.length} records`);

  return records;
}

function loadGTFSData(zipPath) {
  const zip = new AdmZip(zipPath);
  const data = {};

  for (const filename of REQUIRED_FILES) {
    const key = filename.replace(".txt", "");
    data[key] = readGTFSFile(zip, filename, true);
  }

  for (const filename of OPTIONAL_FILES) {
    const key = filename.replace(".txt", "");
    data[key] = readGTFSFile(zip, filename);
  }

  return data;
}

function parseGTFSDate(date) {
  if (!/^\d{8}$/.test(String(date))) {
    throw new Error(`Invalid GTFS date: ${date}`);
  }

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6));
  const day = Number(date.slice(6, 8));

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  return parsed;
}

function parseGTFSTime(time) {
  const match = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(String(time));

  if (!match) {
    throw new Error(`Invalid GTFS time: ${time}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  // GTFS allows hours greater than 23.
  return hours * 3600 + minutes * 60 + seconds;
}

module.exports = {
  loadGTFSData,
  parseGTFSTime,
  parseGTFSDate,
};
