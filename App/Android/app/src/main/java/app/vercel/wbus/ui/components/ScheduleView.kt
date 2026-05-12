package app.vercel.wbus.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.vercel.wbus.data.model.BusSchedule
import app.vercel.wbus.data.model.DayType
import app.vercel.wbus.data.model.HourlyMap
import app.vercel.wbus.util.ScheduleUtils
import java.util.*

@Composable
fun ScheduleView(
    schedule: BusSchedule, modifier: Modifier = Modifier
) {
    val hasSpecificSchedules = schedule.schedule.weekday != null || schedule.schedule.weekend != null
    val initialDayType = if (hasSpecificSchedules) ScheduleUtils.getCurrentDayType() else DayType.WEEKDAY

    var selectedDayType by remember { mutableStateOf(initialDayType) }
    val directions = schedule.directions
    var selectedDirection by remember { mutableStateOf(directions.firstOrNull() ?: "") }

    Column(modifier = modifier.fillMaxWidth()) {
        // Dynamic Day Type Selector
        if (hasSpecificSchedules) {
            SingleChoiceSegmentedButtonRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
            ) {
                SegmentedButton(
                    selected = selectedDayType == DayType.WEEKDAY,
                    onClick = { selectedDayType = DayType.WEEKDAY },
                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
                ) {
                    Text("평일")
                }
                SegmentedButton(
                    selected = selectedDayType == DayType.WEEKEND,
                    onClick = { selectedDayType = DayType.WEEKEND },
                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
                ) {
                    Text("주말/공휴일")
                }
            }
        } else {
            Surface(
                color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.3f),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.padding(bottom = 16.dp)
            ) {
                Text(
                    text = "매일 동일 운행",
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
        }

        if (directions.size > 1) {
            ScrollableTabRow(
                selectedTabIndex = directions.indexOf(selectedDirection).coerceAtLeast(0),
                edgePadding = 0.dp,
                containerColor = Color.Transparent,
                divider = {},
                indicator = {}) {
                directions.forEach { direction ->
                    val isSelected = selectedDirection == direction
                    Tab(selected = isSelected, onClick = { selectedDirection = direction }, text = {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (isSelected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent,
                            border = if (isSelected) null else androidx.compose.foundation.BorderStroke(
                                1.dp, MaterialTheme.colorScheme.outlineVariant
                            )
                        ) {
                            Text(
                                text = direction,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                style = MaterialTheme.typography.labelLarge,
                                color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    })
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        val hourlyMap = when (selectedDayType) {
            DayType.WEEKDAY -> schedule.schedule.weekday ?: schedule.schedule.general
            DayType.WEEKEND -> schedule.schedule.weekend ?: schedule.schedule.general
        } ?: emptyMap()

        if (hourlyMap.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp), contentAlignment = Alignment.Center
            ) {
                Text("시간표 정보가 없습니다", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            val nextBus = ScheduleUtils.findNextBus(hourlyMap, selectedDirection)

            Column {
                if (nextBus != null) {
                    NextBusHighlight(nextBus)
                    Spacer(modifier = Modifier.height(16.dp))
                }

                ScheduleList(hourlyMap, selectedDirection)
            }
        }
    }
}

@Composable
fun NextBusHighlight(nextBus: Pair<Int, String>) {
    Surface(
        color = MaterialTheme.colorScheme.primary, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Rounded.Schedule,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "가장 빠른 다음 버스",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
                )
                Text(
                    text = "${nextBus.first}시 ${nextBus.second}분 출발 예정",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    }
}

@Composable
fun ScheduleList(hourlyMap: HourlyMap, selectedDirection: String) {
    val currentCalendar = Calendar.getInstance()
    val currentHour = currentCalendar.get(Calendar.HOUR_OF_DAY)
    val currentMinute = currentCalendar.get(Calendar.MINUTE)

    val sortedHours = hourlyMap.keys.mapNotNull { it.toIntOrNull() }.sorted()

    LazyColumn(
        modifier = Modifier.heightIn(max = 350.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(bottom = 16.dp)
    ) {
        items(sortedHours) { hour ->
            val hourKey = "%02d".format(hour)
            val directionMap = hourlyMap[hourKey] ?: emptyMap()
            val minutes = directionMap[selectedDirection] ?: emptyList()

            if (minutes.isNotEmpty()) {
                val isCurrentHour = hour == currentHour

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (isCurrentHour) MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)
                            else Color.Transparent, RoundedCornerShape(12.dp)
                        )
                        .padding(8.dp), verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        modifier = Modifier.size(40.dp),
                        shape = RoundedCornerShape(8.dp),
                        color = if (isCurrentHour) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = hour.toString(),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (isCurrentHour) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Row(
                        modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        minutes.forEach { item ->
                            val minuteVal = item.minute.toIntOrNull() ?: 0
                            val isUpcoming = isCurrentHour && minuteVal > currentMinute

                            Text(
                                text = item.minute,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = if (isUpcoming) FontWeight.ExtraBold else FontWeight.Normal,
                                color = if (isUpcoming) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                modifier = if (isUpcoming) Modifier
                                    .background(
                                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                                        RoundedCornerShape(4.dp)
                                    )
                                    .padding(horizontal = 4.dp)
                                else Modifier
                            )
                        }
                    }
                }
            }
        }
    }
}
