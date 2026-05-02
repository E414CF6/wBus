package app.vercel.wbus.domain.service

import app.vercel.wbus.data.model.BusSchedule
import app.vercel.wbus.data.model.DayType
import app.vercel.wbus.data.model.NextBusInfo
import app.vercel.wbus.data.model.TimeUntil
import java.util.*

/**
 * Service to handle bus schedules and departure time calculations
 */
object TimeService {

    /**
     * Get the current day type (weekday/weekend)
     */
    fun getCurrentDayType(date: Calendar = Calendar.getInstance()): DayType {
        val dayOfWeek = date.get(Calendar.DAY_OF_WEEK)
        return if (dayOfWeek == Calendar.SATURDAY || dayOfWeek == Calendar.SUNDAY) {
            DayType.WEEKEND
        } else {
            DayType.WEEKDAY
        }
    }

    /**
     * Find the nearest bus departure from a complete schedule
     * Returns simplified info for preview display
     */
    fun getNearestBusTime(busData: BusSchedule, now: Calendar = Calendar.getInstance()): NextBusInfo? {
        val dayType = getCurrentDayType(now)
        val schedule = busData.schedule.general
            ?: (if (dayType == DayType.WEEKEND) busData.schedule.weekend else busData.schedule.weekday) ?: return null

        val currentHour = now.get(Calendar.HOUR_OF_DAY)
        val currentMinute = now.get(Calendar.MINUTE)
        val currentTotalMinutes = currentHour * 60 + currentMinute

        var minDifference = Int.MAX_VALUE
        var nearestBus: NextBusInfo? = null

        for ((hourStr, hourlySchedule) in schedule) {
            val hourNum = hourStr.toIntOrNull() ?: continue
            val baseHourMinutes = hourNum * 60

            for ((_, busTimes) in hourlySchedule) {
                for (busTime in busTimes) {
                    val minuteNum = busTime.minute.toIntOrNull() ?: continue
                    val busTotalMinutes = baseHourMinutes + minuteNum

                    var difference = busTotalMinutes - currentTotalMinutes
                    if (difference < 0) {
                        difference += 1440 // Minutes in a day
                    }

                    if (difference < minDifference) {
                        minDifference = difference

                        val totalSeconds = difference * 60
                        nearestBus = NextBusInfo(
                            hour = hourStr.padStart(2, '0'), minute = busTime.minute, timeUntil = TimeUntil(
                                minutes = difference, seconds = 0
                            )
                        )
                    }
                }
            }
        }

        return nearestBus
    }

}
