package app.vercel.wbus.data.model

import com.squareup.moshi.JsonClass

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

/**
 * Node ordering metadata used to resolve vehicle direction on a route sequence.
 */
data class SequenceItem(
    val nodeord: Int, val nodeid: String, val updowncd: Int
)
