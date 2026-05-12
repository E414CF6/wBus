package app.vercel.wbus.ui.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DirectionsBus
import androidx.compose.material.icons.rounded.Map
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.vercel.wbus.data.model.BusItem
import app.vercel.wbus.data.model.BusSchedule
import app.vercel.wbus.data.model.DayType
import app.vercel.wbus.util.ScheduleUtils

@Composable
fun BusBottomSheet(
    modifier: Modifier = Modifier,
    routeName: String,
    buses: List<BusItem>,
    schedule: BusSchedule? = null,
    onBusClick: (BusItem) -> Unit,
    onRouteClick: () -> Unit = {},
    onRefresh: () -> Unit = {}
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val isDark = isSystemInDarkTheme()
    val nextBusSummary = schedule?.let { sched ->
        val directions = sched.directions
        val selectedDirection = directions.firstOrNull() ?: ""
        val dayType = if (sched.schedule.weekday != null) ScheduleUtils.getCurrentDayType() else DayType.WEEKDAY
        val hourlyMap = when (dayType) {
            DayType.WEEKDAY -> sched.schedule.weekday ?: sched.schedule.general
            DayType.WEEKEND -> sched.schedule.weekend ?: sched.schedule.general
        } ?: emptyMap()
        ScheduleUtils.findNextBus(hourlyMap, selectedDirection)?.let { nextBus ->
            "${selectedDirection.ifBlank { "다음" }} ${nextBus.first}시 ${nextBus.second}분"
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.BottomCenter
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 600.dp)
                .heightIn(min = 128.dp),
            shape = RoundedCornerShape(32.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 8.dp,
            shadowElevation = 16.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 14.dp)
                    .animateContentSize()
            ) {
                Box(
                    modifier = Modifier
                        .width(52.dp)
                        .height(6.dp)
                        .background(
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.22f),
                            shape = RoundedCornerShape(999.dp)
                        )
                        .align(Alignment.CenterHorizontally)
                )

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(18.dp))
                            .clickable { onRouteClick() },
                        shape = RoundedCornerShape(18.dp),
                        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = if (isDark) 0.32f else 0.62f)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "선택 노선",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f)
                            )
                            Text(
                                text = routeName,
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.ExtraBold,
                                color = if (isDark) Color.White else Color.Black,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Surface(
                                    color = MaterialTheme.colorScheme.surface.copy(alpha = if (isDark) 0.2f else 0.72f),
                                    shape = RoundedCornerShape(999.dp)
                                ) {
                                    Text(
                                        text = "운행 ${buses.size}대",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                                    )
                                }
                                nextBusSummary?.let {
                                    Surface(
                                        color = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.9f),
                                        shape = RoundedCornerShape(999.dp)
                                    ) {
                                        Text(
                                            text = it,
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.onTertiaryContainer,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }

                    IconButton(
                        onClick = { onRefresh() },
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f))
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Refresh,
                            contentDescription = "새로고침",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                schedule?.let {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = it.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    divider = {},
                    indicator = { tabPositions ->
                        if (selectedTab < tabPositions.size) {
                            TabRowDefaults.SecondaryIndicator(
                                Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }) {
                    TabItem(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        icon = Icons.Rounded.Map,
                        label = "실시간 위치"
                    )
                    TabItem(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        icon = Icons.Rounded.Schedule,
                        label = "운행 시간표"
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                when (selectedTab) {
                    0 -> RealTimeBusList(buses, onBusClick)
                    1 -> {
                        if (schedule != null) {
                            ScheduleView(schedule)
                        } else {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(40.dp), contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(modifier = Modifier.size(32.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TabItem(
    selected: Boolean, onClick: () -> Unit, icon: ImageVector, label: String
) {
    Tab(
        selected = selected,
        onClick = onClick,
        unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
        selectedContentColor = MaterialTheme.colorScheme.primary
    ) {
        Row(
            modifier = Modifier.padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
            )
        }
    }
}

@Composable
private fun RealTimeBusList(
    buses: List<BusItem>, onBusClick: (BusItem) -> Unit
) {
    if (buses.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 48.dp), contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.DirectionsBus,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(28.dp)
                )
                Text(
                    text = "현재 운행 중인 버스가 없습니다",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    } else {
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.heightIn(max = 400.dp),
            contentPadding = PaddingValues(top = 2.dp, bottom = 16.dp)
        ) {
            items(buses) { bus ->
                BusListItem(
                    plateNumber = bus.vehicleno,
                    currentStation = bus.nodenm,
                    direction = bus.direction,
                    onClick = { onBusClick(bus) })
            }
        }
    }
}
