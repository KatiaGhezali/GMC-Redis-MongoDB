const BASE_URL = "http://localhost:5000";

async function testEndpoint(name, path) {
  console.log(`\nTesting: ${name}`);

  try {
    const response = await fetch(`${BASE_URL}${path}`);
    const result = await response.json();

    console.log("Status:", response.status);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Request failed:", error.message);
  }
}

async function runTests() {
  await testEndpoint("Health check", "/api/health");

  await testEndpoint("Search stops", "/api/stops/search?search=Centre");

  await testEndpoint(
    "Get stop from MongoDB",
    "/api/stops/MTB10?database=mongodb",
  );

  await testEndpoint("Get stop from Redis", "/api/stops/MTB10?database=redis");

  await testEndpoint(
    "MongoDB departures",
    "/api/stops/MTB15/departures?date=2026-11-06&database=mongodb",
  );

  await testEndpoint(
    "Redis departures",
    "/api/stops/MTB15/departures?date=2026-11-06&database=redis",
  );

  await testEndpoint(
    "Nearby stops from MongoDB",
    "/api/stops/nearby?lat=45.502415&lon=6.054071&radiusKm=2&database=mongodb",
  );

  await testEndpoint(
    "Nearby stops from Redis",
    "/api/stops/nearby?lat=45.502415&lon=6.054071&radiusKm=2&database=redis",
  );

  await testEndpoint(
    "Benchmark MongoDB and Redis",
    "/api/benchmarks?iterations=30",
  );
}

runTests();
