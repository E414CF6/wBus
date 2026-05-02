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
    val direction: Int? = null, // 1: Up, 0: Down
    val segmentIndex: Int? = null,
    val progress: Double = 0.0 // (segmentIndex + t) to ensure monotonic movement
) {
    /**
     * Get the coordinate pair [latitude, longitude]
     */
    fun coordinate(): Coordinate = Coordinate(gpslati, gpslong)
}

/**
 * Error types that can occur when fetching bus data
 */
enum class BusDataError {
    NONE_RUNNING,    // No buses currently running on this route
    NETWORK,         // Network connection error
    INVALID_ROUTE    // Invalid route ID provided
}

/**
 * Coordinate pair representing [latitude, longitude]
 */
data class Coordinate(
    val latitude: Double, val longitude: Double
) {
    operator fun get(index: Int): Double = when (index) {
        0 -> latitude
        1 -> longitude
        else -> throw IndexOutOfBoundsException("Coordinate index must be 0 or 1")
    }
}

/**
 * API response wrapper containing bus data and timestamp
 */
@JsonClass(generateAdapter = true)
data class BusLocationResponse(
    val data: List<BusItem>, val timestamp: Long
)
