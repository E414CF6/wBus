# wBus

Android port of the [wBus](https://wbus.vercel.app)

## Architecture

```shell
app.vercel.wbus/
├── data/
│   ├── api/          Retrofit + OkHttp + Moshi
│   ├── model/        14 data classes (Bus, Route, Station, etc.)
│   ├── repository/   BusRepository with Result wrapper
│   ├── local/        SharedPreferences manager
│   └── common/       Result<T> sealed class
├── ui/
│   ├── main/         MainActivity + MapViewModel + Factory
│   └── adapter/      BusListAdapter (RecyclerView)
└── util/
    ├── geo/          Distance, bearing, polyline snapping
    └── format/       Korean localized formatters
```

**Pattern**: MVVM + Repository Pattern + Clean Architecture

## Tech Stack

- **Language**: Kotlin
- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 36
- **Build System**: Gradle with Kotlin DSL
- **Maps**: Google Maps SDK
- **Networking**: Retrofit 2.9.0 + OkHttp 4.12.0
- **JSON**: Moshi 1.15.0
- **Async**: Coroutines 1.7.3
- **Architecture**: Lifecycle ViewModel + LiveData
- **UI**: ViewBinding + Material Design 3
- **Logging**: Timber 5.0.1

## Setup

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
2. Create a new project or select existing
3. Enable **Maps SDK for Android**
4. Create credentials → API Key
5. Restrict the key to Android apps (optional but recommended)

### 2. Configure API Key

Add your key to `gradle.properties`:

```properties
MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 3. Build & Run

```bash
# Clone the repository
git clone <repository-url>
cd wBus

# Build the APK
./gradlew assembleDebug

# Or open in Android Studio
# File → Open → Select wBus directory
```

### 4. Install APK

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## API Endpoints

The app uses the web API proxy at `https://wbus.vercel.app/api/`

| Endpoint                   | Method | Description             | Cache TTL |
|----------------------------|--------|-------------------------|-----------|
| `/bus/{routeId}`           | GET    | Real-time bus locations | 3s        |
| `/bus-arrival/{busStopId}` | GET    | Arrival predictions     | 3s        |
| `/bus-stops/{routeId}`     | GET    | All stops on route      | 24h       |
| `/route-stops/{routeName}` | GET    | Route detail by name    | 24h       |

**Backend**: Next.js API proxying Korea Public Data API with Redis caching

## Project Structure

```shell
app/src/main/java/app/vercel/wbus/
│
├── WBus.kt          # Application class with Timber init
│
├── data/
│   ├── api/
│   │   ├── WBusApiService.kt   # Retrofit interface
│   │   └── ApiClient.kt        # Retrofit + OkHttp setup
│   ├── model/
│   │   ├── BusModels.kt        # BusItem, Coordinate
│   │   ├── RouteModels.kt      # RouteInfo, BusSchedule
│   │   ├── StationModels.kt    # BusStop, BusStopArrival
│   │   └── GeoModels.kt        # GeoJSON polyline models
│   ├── repository/
│   │   └── BusRepository.kt    # Data access layer
│   ├── local/
│   │   └── PreferencesManager.kt # SharedPreferences wrapper
│   └── common/
│       └── Result.kt           # Success/Error/Loading wrapper
│
├── ui/
│   ├── main/
│   │   ├── MainActivity.kt     # Map activity
│   │   ├── MapViewModel.kt     # Bus state management
│   │   └── MapViewModelFactory.kt
│   └── adapter/
│       └── BusListAdapter.kt   # RecyclerView adapter
│
└── util/
    ├── geo/
    │   ├── GeoUtils.kt         # Haversine, bearing, etc.
    │   └── PolylineUtils.kt    # Snap to polyline
    └── format/
        └── Formatters.kt       # Display formatters
```

## Data Models

### BusItem

```kotlin
data class BusItem(
    val routeid: String?,
    val routenm: String,         // Route number (e.g., "30")
    val gpslati: Double,         // GPS latitude
    val gpslong: Double,         // GPS longitude
    val vehicleno: String,       // Vehicle registration
    val nodenm: String?,         // Current stop name
    val nodeid: String?,         // Current stop ID
    val nodeord: Int?            // Stop order
)
```

### BusStop

```kotlin
data class BusStop(
    val gpslati: Double,
    val gpslong: Double,
    val nodenm: String,          // Stop name (Korean)
    val nodeno: String,          // Stop number
    val nodeid: String,          // Stop ID
    val nodeord: Int?,           // Order in route
    val updowncd: Int?           // Direction (0=down, 1=up)
)
```

## Utilities

### Geospatial Functions

```kotlin
// Haversine distance in meters
val distance = GeoUtils.getHaversineDistanceMeters(coord1, coord2)

// Bearing angle (0-360°)
val bearing = GeoUtils.calculateBearing(from, to)

// Snap GPS point to polyline
val result = snapPointToPolyline(busLocation, routePolyline)
// Returns: SnapResult(position, angle, segmentIndex, t)
```

### Formatters

```kotlin
// Time: "3분" or "곧 도착"
val time = Formatters.secondsToMinutes(180)

// Vehicle type: "저상버스" → "저상"
val type = Formatters.formatVehicleType(vehicleType)

// Distance: "150m" or "1.5km"
val dist = Formatters.formatDistance(1500.0)
```

## Configuration

### API Base URL

Defined in `build.gradle.kts`:

```kotlin
buildConfigField("String", "API_BASE_URL", "\"https://wbus.vercel.app/api/\"")
```

### Default Route

Configured in `PreferencesManager.kt`:

```kotlin
private const val DEFAULT_ROUTE_NAME = "30"  // Route 30
```

Default Route ID in `MainActivity.kt`:

```kotlin
val routeId = prefsManager.getSelectedRouteId() ?: "232000061"
```

## Performance

- **Polling Interval**: 3 seconds (configurable in `MapViewModel.kt`)
- **Network Timeout**: 30 seconds
- **APK Size**: ~8.5 MB (debug)
- **Min RAM**: Standard Android requirements

## Static Data Integration

The app now fetches static data from Vercel Storage for better performance and caching:

### Vercel Storage Endpoints

| Data Type   | URL                           | Cache TTL | Description              |
|-------------|-------------------------------|-----------|--------------------------|
| Route Map   | `routeMap.json`               | 24h       | Route name to ID mapping |
| Station Map | `stationMap.json`             | 24h       | All station locations    |
| Polylines   | `polylines/{routeId}.geojson` | 1 week    | GeoJSON route paths      |
| Schedules   | `schedules/{routeName}.json`  | 24h       | Bus schedules            |

### Benefits

**Better Performance** - Static data cached locally  
**Reduced API Calls** - Polylines rarely change (1 week cache)  
**Faster Load Times** - In-memory cache with TTL  
**Cost Effective** - Less API bandwidth usage

### Implementation

```kotlin
// Fetch route map (cached 24h)
val routeMap = staticDataRepository.getRouteMap()

// Fetch polyline (cached 1 week)
val polyline = staticDataRepository.getPolyline(routeId)

// Fetch schedule (cached 24h)
val schedule = staticDataRepository.getSchedule(routeName)
```

### Cache Manager

Built-in cache with automatic expiration:

```kotlin
cache.put(key, data, CacheManager.TTL_24_HOURS)
val data = cache.get<T>(key)  // Returns null if expired
```
