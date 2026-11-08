# GMS Application-Based Benchmarking on Redis and MongoDB for Trip Planning Using GTFS Data

## 1. Introduction to GTFS Data

### What is GTFS?

The General Transit Feed Specification (GTFS) is a standardized format used by public transportation agencies to publish transit information. It allows applications and developers to access transportation schedules, routes, stops, and geographic information in a consistent format.

GTFS Static data is generally distributed as a ZIP archive containing multiple CSV files. Each file describes a particular part of the transportation network.

Some of the most important GTFS files include:

| File                 | Description                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| `agency.txt`         | Contains information about transportation agencies.                                |
| `stops.txt`          | Contains the names, identifiers, and geographic coordinates of stops and stations. |
| `routes.txt`         | Describes available transportation routes, such as buses, trains, and metro lines. |
| `trips.txt`          | Describes individual trips operated on specific routes.                            |
| `stop_times.txt`     | Contains the arrival and departure times of trips at each stop.                    |
| `calendar.txt`       | Defines the days on which services operate.                                        |
| `calendar_dates.txt` | Defines exceptions to regular service calendars.                                   |
| `shapes.txt`         | Contains geographic coordinates describing the paths followed by vehicles.         |
| `transfers.txt`      | Describes transfer rules between stops.                                            |

### How GTFS is used for trip planning

GTFS provides the information required to calculate possible journeys between two locations.

For example, when a passenger wants to travel from Stop A to Stop D, a trip-planning application can:

1. Identify the departure and destination stops using `stops.txt`.
2. Find the routes serving those stops using `routes.txt`.
3. Identify the trips operating on those routes using `trips.txt`.
4. Retrieve arrival and departure times from `stop_times.txt`.
5. Check service availability for the selected date using `calendar.txt` and `calendar_dates.txt`.
6. Identify possible transfers using `transfers.txt`.

The application can then present possible journeys, including departure times, arrival times, routes, and transfers.

GTFS therefore provides a structured foundation for applications such as public transportation search engines, journey planners, and real-time transit information systems.

_Note: This project focuses on GTFS Static data. Real-time vehicle positions and service updates are outside the initial implementation scope._

---

## 2. Overview of Redis and MongoDB

### MongoDB

MongoDB is a document-oriented NoSQL database. Instead of organizing information into relational tables and rows, it stores records as BSON documents in collections.

For example, a transportation stop can be represented as:

```json
{
  "stop_id": "STOP_001",
  "stop_name": "Central Station",
  "stop_lat": 36.7538,
  "stop_lon": 3.0588
}
```

MongoDB provides several features that make it suitable for applications involving GTFS data:

- **Flexible document model:** Documents can represent different types of transportation information.
- **Indexing:** Indexes improve the performance of frequently executed queries.
- **Geospatial queries:** Geospatial indexes allow applications to find stops near a passenger's location.
- **Aggregation pipelines:** Complex data processing and transformations can be performed within the database.
- **Replication:** Replica sets provide redundancy and improve availability.
- **Sharding:** Large datasets can be distributed across multiple servers.

MongoDB is useful for storing the complete GTFS dataset and performing queries involving routes, trips, stops, and schedules.

### Redis

Redis is an in-memory data store commonly used as a database, cache, and message broker.

It stores information using different data structures rather than traditional relational tables or document collections.

Its supported data structures include:

| Data structure     | Application in trip planning                    |
| ------------------ | ----------------------------------------------- |
| Strings            | Caching frequently requested journey results.   |
| Hashes             | Storing individual stop or route information.   |
| Lists              | Maintaining ordered sequences of stops.         |
| Sets               | Storing unique route identifiers.               |
| Sorted Sets        | Organizing departures by their scheduled times. |
| Geospatial indexes | Finding nearby transportation stops.            |

For example, a Redis Hash can store information about a stop:

```redis
HSET stop:STOP_001 name "Central Station" latitude 36.7538 longitude 3.0588
```

A Sorted Set can organize scheduled departures:

```redis
ZADD departures:STOP_001 28800 "BUS_10"
ZADD departures:STOP_001 29400 "BUS_15"
```

The scores represent departure times in seconds after midnight.

Important Redis features include:

- **In-memory storage:** Allows very fast data access.
- **Multiple data structures:** Supports different application requirements.
- **Expiration policies:** Data can automatically expire using time-to-live (TTL).
- **Persistence:** RDB snapshots and Append Only File (AOF) provide persistence options.
- **Replication:** Data can be replicated across servers.
- **Redis Cluster:** Supports data partitioning and horizontal scaling.
- **Geospatial operations:** Supports searches based on geographic coordinates.

### Differences between NoSQL and SQL databases

Traditional relational databases organize information into tables with predefined schemas and relationships. NoSQL databases provide alternative data models that can be more flexible for certain applications.

| Feature        | SQL databases                   | MongoDB                           | Redis                                      |
| -------------- | ------------------------------- | --------------------------------- | ------------------------------------------ |
| Data model     | Tables and rows                 | Documents                         | Key-value and specialized data structures  |
| Schema         | Usually predefined              | Flexible                          | Defined by application and data structures |
| Storage        | Commonly disk-based             | Primarily disk-based              | Primarily memory-based                     |
| Query language | SQL                             | MongoDB Query Language            | Redis commands                             |
| Relationships  | Foreign keys and joins          | References and embedded documents | Usually managed by the application         |
| Scaling        | Vertical and horizontal options | Replication and sharding          | Replication and clustering                 |
| Typical use    | Relational business data        | Flexible and persistent documents | Caching and fast data access               |

Redis and MongoDB are not interchangeable. Their architectures and data models make them suitable for different workloads.

---

## 3. Benchmarking Criteria

Database benchmarking measures how efficiently a database performs operations under defined workloads.

For a trip-planning application, the following criteria are particularly relevant:

| Criterion           | Description                                                          | Example                                    |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Read latency        | Time required to retrieve information                                | Retrieving departures from a stop          |
| Write latency       | Time required to insert or update information                        | Importing GTFS records                     |
| Throughput          | Number of operations completed per second                            | Processing repeated departure queries      |
| Memory consumption  | Amount of RAM used by the database                                   | Loading GTFS records into Redis            |
| Storage consumption | Disk space occupied by the dataset                                   | Storing GTFS documents in MongoDB          |
| Scalability         | Ability to handle increasing datasets and workloads                  | Increasing the number of stops and trips   |
| Concurrent requests | Performance when several users access the application simultaneously | Multiple passengers searching for journeys |

### Why benchmark databases?

The choice of database can significantly influence an application's performance and resource requirements.

For example, Redis may provide faster access to frequently requested information because it primarily operates in memory. MongoDB, however, provides persistent document storage and more flexible querying capabilities.

Benchmarking helps developers:

1. Identify which database performs better for specific operations.
2. Understand the resource requirements of each database.
3. Evaluate how performance changes as the dataset grows.
4. Identify potential bottlenecks.
5. Choose a database architecture based on actual application requirements.

A meaningful comparison must use the same dataset, equivalent operations, comparable hardware, and consistent test conditions.

The benchmark should also distinguish between database execution time and total application response time.

---

## 4. Data Ingestion and Storage

### GTFS data ingestion

GTFS data is usually provided as a ZIP archive containing CSV files.

The ingestion process involves:

1. Downloading the GTFS archive.
2. Extracting the CSV files.
3. Parsing the records.
4. Validating the data.
5. Converting records into the appropriate database structures.
6. Importing equivalent information into MongoDB and Redis.
7. Verifying that both databases contain the expected records.

### Storing GTFS data in MongoDB

MongoDB can organize the GTFS data into collections:

```text
gtfs
├── agencies
├── stops
├── routes
├── trips
├── stop_times
├── calendars
├── calendar_dates
├── shapes
└── transfers
```

For example, a stop document could look like:

```json
{
  "stop_id": "STOP_001",
  "stop_name": "Central Station",
  "stop_lat": 36.7538,
  "stop_lon": 3.0588,
  "location": {
    "type": "Point",
    "coordinates": [3.0588, 36.7538]
  }
}
```

Indexes can improve query performance:

```javascript
db.stops.createIndex({ stop_id: 1 });

db.stops.createIndex({ location: "2dsphere" });

db.stop_times.createIndex({
  stop_id: 1,
  departure_time: 1,
});

db.stop_times.createIndex({
  trip_id: 1,
  stop_sequence: 1,
});
```

These indexes support stop lookups, geospatial searches, and schedule queries.

### Storing GTFS data in Redis

Redis uses keys and data structures to organize information.

An example organization is:

```text
stop:STOP_001
    Hash containing stop information

route:BUS_10
    Hash containing route information

trip:TRIP_001
    Hash containing trip information

departures:STOP_001
    Sorted Set containing departure times

stops:geo
    Geospatial index containing stop coordinates
```

Sorted Sets are particularly useful for retrieving departures in chronological order.

Geospatial indexes can support searches for nearby stops.

### Comparison of storage mechanisms

| MongoDB                                                                | Redis                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Stores BSON documents in collections.                                  | Stores values using specialized data structures.               |
| Primarily persists data on disk.                                       | Primarily stores data in memory.                               |
| Supports rich document queries and aggregation.                        | Supports fast key-based and data-structure operations.         |
| Uses indexes to optimize queries.                                      | Uses keys and data structures for efficient access.            |
| Suitable for storing the complete GTFS dataset.                        | Suitable for frequently accessed data and precomputed results. |
| Can manage large datasets without requiring all records to fit in RAM. | Memory capacity is an important consideration.                 |

The project will import the same GTFS feed into both databases to allow comparable application-level operations.

---

## 5. Query Performance

Trip-planning applications perform different types of queries, including stop lookups, departure searches, and geographic searches.

### Example 1: Find a stop by ID

MongoDB:

```javascript
db.stops.findOne({
  stop_id: "STOP_001",
});
```

Redis:

```redis
HGETALL stop:STOP_001
```

MongoDB retrieves a document using its indexed field, while Redis retrieves the value associated with a known key.

### Example 2: Find departures from a stop

MongoDB:

```javascript
db.stop_times
  .find({
    stop_id: "STOP_001",
  })
  .sort({
    departure_time: 1,
  });
```

Redis:

```redis
ZRANGE departures:STOP_001 0 9 WITHSCORES
```

The Redis query retrieves the first ten departures in chronological order, assuming departure times are represented by sorted-set scores.

### Example 3: Find nearby stops

MongoDB:

```javascript
db.stops.find({
  location: {
    $near: {
      $geometry: {
        type: "Point",
        coordinates: [3.0588, 36.7538],
      },
      $maxDistance: 1000,
    },
  },
});
```

This query requires a geospatial `2dsphere` index.

Redis:

```redis
GEOSEARCH stops:geo
  FROMLONLAT 3.0588 36.7538
  BYRADIUS 1000 m
  WITHDIST
```

Both databases support geographic searches, although their implementations and query capabilities differ.

### Query performance considerations

Redis and MongoDB may perform differently depending on the operation.

Redis can be particularly efficient for direct lookups and precomputed departure lists. MongoDB offers more flexible querying, indexing, and aggregation capabilities.

A fair comparison must consider how the data is prepared. For example, a Redis Sorted Set containing precomputed departures should not be compared with a MongoDB operation that performs additional filtering and joins without acknowledging the difference.

The application benchmark will therefore document the data structures, indexes, and preprocessing required by each database.

---

## 6. Scalability and Efficiency

### MongoDB scalability

MongoDB provides several mechanisms for handling increasing workloads:

- **Replication:** Replica sets maintain copies of data and improve availability.
- **Sharding:** Distributes data across multiple servers.
- **Indexing:** Reduces the amount of data examined during queries.
- **Aggregation:** Supports complex data processing.
- **Geospatial indexing:** Supports geographic queries over large collections.

MongoDB is suitable for storing and querying large transportation datasets.

### Redis scalability

Redis provides:

- **Replication:** Allows data to be copied to replica servers.
- **Redis Cluster:** Distributes data across multiple nodes.
- **Persistence:** RDB and AOF options support data recovery.
- **Memory management:** Eviction policies help manage memory usage.
- **Specialized data structures:** Support efficient operations for common application workloads.

However, Redis primarily relies on RAM, so memory capacity and cost must be considered when storing large datasets.

### Which database is more suitable for a large-scale trip planner?

For a large-scale trip-planning application, MongoDB is a strong choice as the primary database because it provides persistent storage, flexible querying, geospatial indexes, and support for large datasets.

Redis can complement MongoDB by caching frequently requested information, such as upcoming departures and popular journey results.

A combined architecture offers several advantages:

1. MongoDB stores the complete GTFS dataset.
2. Redis stores frequently accessed or precomputed information.
3. The application retrieves cached results from Redis when available.
4. When a cache entry is missing, the application queries MongoDB and may store the result in Redis.

This approach combines MongoDB's querying and persistence capabilities with Redis's fast data access.

---

## 7. Practical Application: GTFS Trip Planner

### Application overview

The practical component of this project is a trip-planning application that uses GTFS Static data to help passengers explore public transportation information.

The application is developed using Node.js and Express, with MongoDB as the primary database and Redis as an in-memory data store. It also includes a benchmarking module to compare the performance of both databases using the same GTFS dataset and equivalent operations.

The current implementation focuses on the backend API and database operations.

**Technologies used:**

- **Backend:** Node.js and Express
- **Primary database:** MongoDB
- **Fast data store:** Redis
- **Dataset:** Mont'bus GTFS Static feed
- **Data processing:** GTFS CSV parsing and ZIP extraction

### Main features

| Feature             | Description                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Stop search         | Search for transportation stops by name.                                                          |
| Stop details        | Retrieve stop names and geographic coordinates using a stop identifier.                           |
| Upcoming departures | Retrieve scheduled departures from a selected stop for a specific date.                           |
| Nearby stops        | Find transportation stops within a specified geographic distance.                                 |
| Database selection  | Execute supported queries using either MongoDB or Redis.                                          |
| Benchmarking        | Compare application-level query latency and verify that both databases return equivalent results. |

A complete journey-search feature and a graphical frontend are possible extensions of the application but are not part of the current implementation.

### Application architecture

```text
                   GTFS ZIP Dataset
                          |
                     GTFS Parser
                          |
                  Data Ingestion Scripts
                          |
                 ---------------------
                 |                   |
              MongoDB               Redis
           Persistent Data      In-Memory Data
                 |                   |
                 ---------------------
                          |
                     Express API
                          |
                  -----------------
                  |               |
              Stop Services   Benchmark Module
                  |               |
                  -----------------
                          |
                    API Responses
                          |
                   Performance Results
```

MongoDB stores the imported GTFS records and supports document and geospatial queries.

Redis stores stop, route, and trip information using hashes, geographic information using a geospatial index, and departure schedules using Sorted Sets.

The Express API exposes endpoints for accessing the transportation data and selecting the database implementation. The benchmarking module executes comparable operations against both databases and records their performance.

### Implementation steps

**Step 1: Obtain GTFS data**

Download a public GTFS Static feed and extract the CSV files. This project uses the Mont'bus urban transportation network dataset.

**Step 2: Prepare MongoDB**

Create collections for stops, routes, trips, stop times, calendars, and other available GTFS records. Add indexes to support common queries, including stop lookups, departure searches, and geospatial operations.

**Step 3: Prepare Redis**

Choose suitable Redis data structures for storing stop information, routes, trips, departures, service calendars, and geographic information. Hashes, Sorted Sets, and geospatial indexes are used according to the requirements of each operation.

**Step 4: Implement data ingestion**

Create ingestion scripts that parse the GTFS CSV files and import the corresponding records into both databases. Transform the data into appropriate formats and verify that the imported information can be retrieved.

**Step 5: Develop the backend**

Build an Express API with endpoints for searching stops, retrieving stop details, finding upcoming departures, and locating nearby stops. Allow supported operations to be executed using either MongoDB or Redis.

**Step 6: Develop the frontend**

A React-based graphical interface can be developed as an extension of the backend API. It could allow passengers to search for stops, select departure and destination locations, and view available transportation information. The current implementation focuses on the backend and does not include this frontend.

**Step 7: Implement benchmarking**

Execute equivalent database operations using the same GTFS dataset and test conditions. Measure query latency over multiple iterations, including average, median, and 95th-percentile response times. Verify that both databases return equivalent results before comparing their performance.

The benchmark implemented in this project evaluates three operations: stop lookup, nearby-stop search, and departure lookup. It measures application-level query latency rather than isolated database execution time.

**Step 8: Analyze the results**

Present the results in tables and charts, discuss the performance differences, and identify which database is better suited to each operation.

---

## 8. Conclusion

Redis and MongoDB provide different advantages for applications involving GTFS data.

MongoDB offers persistent document storage, flexible queries, indexing, aggregation, and geospatial capabilities. These features make it suitable for managing the complete transportation dataset.

Redis provides fast in-memory access and specialized data structures. It is particularly useful for frequently requested information, departure schedules, and cached journey results.

Neither database is universally better. Their suitability depends on the application's workload, data model, resource requirements, and performance objectives.

For this project, the proposed architecture uses MongoDB as the primary database and Redis as a complementary data store for fast access to frequently requested information.

The final database recommendation will be supported by the practical benchmarking results collected from the application. The measurements will be used to evaluate query latency, throughput, ingestion time, and resource consumption.

### References

- [GTFS Static Reference – MobilityData](https://gtfs.org/documentation/schedule/reference/)
- [MongoDB Documentation](https://www.mongodb.com/docs/)
- [MongoDB Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Redis Documentation](https://redis.io/docs/latest/)
- [Redis Data Types](https://redis.io/docs/latest/develop/data-types/)
- [Redis Geospatial Commands](https://redis.io/docs/latest/commands/?group=geo)
- [Node.js Documentation](https://nodejs.org/docs/latest/api/)
- [Express Documentation](https://expressjs.com/)
