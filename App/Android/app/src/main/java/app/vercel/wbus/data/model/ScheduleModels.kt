package app.vercel.wbus.data.model

import com.squareup.moshi.JsonClass

/**
 * Schedule item representing a bus departure time
 */
@JsonClass(generateAdapter = true)
data class ScheduleItem(
    val minute: String, val noteId: String? = null
)

/**
 * Mapping of direction name to departure times
 */
typealias DirectionMap = Map<String, List<ScheduleItem>>

/**
 * Hourly schedule mapping hours (e.g., "06") to a map of directions
 */
typealias HourlyMap = Map<String, DirectionMap>

/**
 * Schedule data container with day-type-specific schedules
 */
@JsonClass(generateAdapter = true)
data class ScheduleData(
    val general: HourlyMap? = null, val weekday: HourlyMap? = null, val weekend: HourlyMap? = null
)

/**
 * Complete bus schedule for a route
 */
@JsonClass(generateAdapter = true)
data class BusSchedule(
    val routeId: String,
    val routeName: String,
    val description: String,
    val lastUpdated: String,
    val directions: List<String>,
    val routeDetails: List<String>? = null,
    val featuredStops: Map<String, List<String>>? = null,
    val schedule: ScheduleData,
    val notes: Map<String, String>? = null
)

enum class DayType {
    WEEKDAY, WEEKEND
}
