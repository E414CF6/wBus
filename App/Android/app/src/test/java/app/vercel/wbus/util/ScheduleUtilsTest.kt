package app.vercel.wbus.util

import app.vercel.wbus.data.model.ScheduleItem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.util.*

class ScheduleUtilsTest {

    @Test
    fun findClosestHourRow_returnsCurrentHourRowWhenFutureMinuteExists() {
        val hourlyMap = mapOf(
            "10" to mapOf("종점A" to listOf(ScheduleItem("05"), ScheduleItem("25"), ScheduleItem("55"))),
            "11" to mapOf("종점A" to listOf(ScheduleItem("10")))
        )
        val now = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 10)
            set(Calendar.MINUTE, 20)
        }

        val row = ScheduleUtils.findClosestHourRow(hourlyMap, "종점A", now)

        assertNotNull(row)
        assertEquals(10, row?.hour)
        assertEquals(listOf("05", "25", "55"), row?.minutes)
    }

    @Test
    fun findClosestHourRow_returnsNextHourWhenCurrentHourHasNoFutureMinute() {
        val hourlyMap = mapOf(
            "10" to mapOf("종점A" to listOf(ScheduleItem("05"), ScheduleItem("25"))),
            "11" to mapOf("종점A" to listOf(ScheduleItem("10"), ScheduleItem("40")))
        )
        val now = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 10)
            set(Calendar.MINUTE, 30)
        }

        val row = ScheduleUtils.findClosestHourRow(hourlyMap, "종점A", now)

        assertNotNull(row)
        assertEquals(11, row?.hour)
        assertEquals(listOf("10", "40"), row?.minutes)
    }

    @Test
    fun findClosestHourRow_wrapsToFirstDepartureRowWhenNoLaterDeparture() {
        val hourlyMap = mapOf(
            "06" to mapOf("종점A" to listOf(ScheduleItem("15"), ScheduleItem("45"))),
            "07" to mapOf("종점A" to listOf(ScheduleItem("10")))
        )
        val now = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 23)
            set(Calendar.MINUTE, 59)
        }

        val row = ScheduleUtils.findClosestHourRow(hourlyMap, "종점A", now)

        assertNotNull(row)
        assertEquals(6, row?.hour)
        assertEquals(listOf("15", "45"), row?.minutes)
    }
}
