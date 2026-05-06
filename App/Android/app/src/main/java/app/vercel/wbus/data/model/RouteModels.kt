package app.vercel.wbus.data.model

import com.squareup.moshi.JsonClass

/**
 * A stop/station in the route sequence
 */
@JsonClass(generateAdapter = true)
data class SequenceItem(
    val nodeord: Int, val nodeid: String, val updowncd: Int
)

/**
 * Detailed route information with ordered stops
 */
@JsonClass(generateAdapter = true)
data class RouteDetail(
    val routeno: String? = null, val sequence: List<SequenceItem>
)

/**
 * Direction constants for bus routes
 */
object Direction {
    const val DOWN = 0 // 하행
    const val UP = 1   // 상행
}

/**
 * Map data for routes
 */
@JsonClass(generateAdapter = true)
data class RouteMapData(
    val lastUpdated: String, val route_numbers: Map<String, List<String>>
)
