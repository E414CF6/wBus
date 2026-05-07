package app.vercel.wbus.util

import app.vercel.wbus.data.model.DayType
import app.vercel.wbus.data.model.HourlyMap
import java.util.*

object ScheduleUtils {

    data class ClosestHourRow(
        val hour: Int,
        val minutes: List<String>
    )

    fun findClosestHourRow(
        hourlyMap: HourlyMap,
        direction: String,
        now: Calendar = Calendar.getInstance()
    ): ClosestHourRow? {
        val currentHour = now.get(Calendar.HOUR_OF_DAY)
        val currentMinute = now.get(Calendar.MINUTE)
        val sortedHours = hourlyMap.keys.mapNotNull { it.toIntOrNull() }.sorted()
        if (sortedHours.isEmpty()) return null

        var firstRow: ClosestHourRow? = null
        for (hour in sortedHours) {
            val hourKey = hour.toString().padStart(2, '0')
            val departures = hourlyMap[hourKey]?.get(direction).orEmpty()
                .mapNotNull { item ->
                    val minute = item.minute.toIntOrNull() ?: return@mapNotNull null
                    minute to item.minute
                }
                .sortedBy { it.first }

            if (departures.isEmpty()) continue

            val row = ClosestHourRow(
                hour = hour,
                minutes = departures.map { it.second }
            )
            if (firstRow == null) firstRow = row

            if (hour > currentHour || (hour == currentHour && departures.any { it.first > currentMinute })) {
                return row
            }
        }

        return firstRow
    }

    fun findNextBus(hourlyMap: HourlyMap, direction: String): Pair<Int, String>? {
        val now = Calendar.getInstance()
        val row = findClosestHourRow(hourlyMap, direction, now) ?: return null
        val currentHour = now.get(Calendar.HOUR_OF_DAY)
        val currentMinute = now.get(Calendar.MINUTE)

        if (row.hour == currentHour) {
            val nextCurrentHourMinute = row.minutes
                .mapNotNull { minuteText ->
                    val minuteValue = minuteText.toIntOrNull() ?: return@mapNotNull null
                    minuteValue to minuteText
                }
                .firstOrNull { it.first > currentMinute }
                ?.second
            if (nextCurrentHourMinute != null) {
                return row.hour to nextCurrentHourMinute
            }
        }

        return row.minutes.firstOrNull()?.let { row.hour to it }
    }

    fun getCurrentDayType(): DayType {
        val dayOfWeek = Calendar.getInstance().get(Calendar.DAY_OF_WEEK)
        return if (dayOfWeek == Calendar.SATURDAY || dayOfWeek == Calendar.SUNDAY) {
            DayType.WEEKEND
        } else {
            DayType.WEEKDAY
        }
    }
}
