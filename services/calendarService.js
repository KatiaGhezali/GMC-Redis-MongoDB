const { getMongoDB } = require("../config/mongodb");
const { getRedis } = require("../config/redis");

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function formatGTFSDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

async function getActiveServiceIdsMongoDB(date) {
  const database = getMongoDB();

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required.");
  }

  const selectedDate = Number(formatGTFSDate(date));
  const weekday = WEEKDAYS[date.getDay()];

  const services = await database
    .collection("calendar")
    .find({
      start_date: { $lte: selectedDate },
      end_date: { $gte: selectedDate },
      [weekday]: 1,
    })
    .toArray();

  return services.map((service) => service.service_id);
}

async function getActiveServiceIdsRedis(date) {
  const redis = getRedis();

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("A valid date is required.");
  }

  const selectedDate = Number(formatGTFSDate(date));
  const weekday = WEEKDAYS[date.getDay()];

  const calendarKeys = await redis.keys("gtfs:calendar:v2:*");

  const calendars = await Promise.all(
    calendarKeys.map((key) => redis.hGetAll(key)),
  );

  return calendars
    .filter((calendar) => {
      return (
        Number(calendar.start_date) <= selectedDate &&
        Number(calendar.end_date) >= selectedDate &&
        Number(calendar[weekday]) === 1
      );
    })
    .map((calendar) => calendar.service_id);
}

async function getActiveServiceIds(date) {
  return getActiveServiceIdsMongoDB(date);
}

async function isServiceActive(serviceId, date) {
  const activeServices = await getActiveServiceIdsMongoDB(date);

  return activeServices.includes(serviceId);
}

module.exports = {
  getActiveServiceIds,
  getActiveServiceIdsMongoDB,
  getActiveServiceIdsRedis,
  isServiceActive,
};
