package app.vercel.wbus.data.model

import app.vercel.wbus.data.api.adapter.RouteNo
import com.squareup.moshi.JsonClass

/**
 * Bus stop with additional route-specific information
 */
@JsonClass(generateAdapter = true)
data class BusStop(
    val gpslati: Double,
    val gpslong: Double,
    val nodenm: String,
    val nodeno: String,
    val nodeid: String,
    val nodeord: Int? = null,
    val updowncd: Int? = null
) {
    /**
     * Get the coordinate pair [latitude, longitude]
     */
    fun coordinate(): Coordinate = Coordinate(gpslati, gpslong)
}

/**
 * API response wrapper containing route bus stops and timestamp
 */
@JsonClass(generateAdapter = true)
data class BusStopsResponse(
    val data: List<BusStop>, val timestamp: Long
)

/**
 * Bus arrival prediction for a stop
 */
@JsonClass(generateAdapter = true)
data class BusStopArrival(
    val arrprevstationcnt: Int,  // Number of stops before arrival
    val arrtime: Int,             // Estimated arrival time in seconds
    val routeid: String,
    @field:RouteNo val routeno: String,
    val vehicletp: String         // Vehicle type (e.g., "저상버스")
)

/**
 * API response wrapper containing bus arrival predictions and timestamp
 */
@JsonClass(generateAdapter = true)
data class BusArrivalsResponse(
    val data: List<BusStopArrival>, val timestamp: Long
)
