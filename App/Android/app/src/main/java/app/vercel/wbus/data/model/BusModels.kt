package app.vercel.wbus.data.model

import com.squareup.moshi.JsonClass

/**
 * Represents a bus vehicle with its real-time location and route information
 */
@JsonClass(generateAdapter = true)
data class BusItem(
    val routeid: String? = null,
    val routenm: String,
    val gpslati: Double,
    val gpslong: Double,
    val vehicleno: String,
    val nodenm: String? = null,
    val nodeid: String? = null,
    val nodeord: Int? = null,
    val bearing: Double = 0.0, // Client-side computed or API-provided bearing
    val direction: Int? = null, // Direction code (0: 하행, 1: 상행)
    val segmentIndex: Int? = null,
    val progress: Double = 0.0 // (segmentIndex + t) to ensure monotonic movement
) {
    /**
     * Get the coordinate pair [latitude, longitude]
     */
    fun coordinate(): Coordinate = Coordinate(gpslati, gpslong)
}

/**
 * Coordinate pair representing [latitude, longitude]
 */
data class Coordinate(
    val latitude: Double, val longitude: Double
)

/**
 * API response wrapper containing bus data and timestamp
 */
@JsonClass(generateAdapter = true)
data class BusLocationResponse(
    val data: List<BusItem>, val timestamp: Long
)

/**
 * SSE snapshot payload for /api/bus/stream.
 */
@JsonClass(generateAdapter = true)
data class BusStreamSnapshot(
    val routeIds: List<String>, val data: List<BusItem>, val timestamp: Long
)
