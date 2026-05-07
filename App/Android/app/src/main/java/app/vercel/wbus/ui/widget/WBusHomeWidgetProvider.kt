package app.vercel.wbus.ui.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import app.vercel.wbus.R
import app.vercel.wbus.data.api.ApiClient
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.local.PreferencesManager
import app.vercel.wbus.data.model.*
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.data.repository.StaticDataRepository
import app.vercel.wbus.ui.main.MainActivity
import kotlinx.coroutines.*
import java.util.*

class WBusHomeWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray
    ) {
        val pendingResult = goAsync()
        widgetScope.launch {
            try {
                updateWidgets(context.applicationContext, appWidgetManager, appWidgetIds.toList())
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        private val widgetScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        fun updateAllWidgets(context: Context) {
            val appContext = context.applicationContext
            val manager = AppWidgetManager.getInstance(appContext)
            val widgetIds = manager.getAppWidgetIds(
                ComponentName(appContext, WBusHomeWidgetProvider::class.java)
            )
            if (widgetIds.isEmpty()) return
            widgetScope.launch {
                updateWidgets(appContext, manager, widgetIds.toList())
            }
        }

        private suspend fun updateWidgets(
            context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: List<Int>
        ) {
            if (appWidgetIds.isEmpty()) return

            val prefsManager = PreferencesManager(context)
            val routeName = prefsManager.getSelectedRouteName()?.takeIf { it.isNotBlank() }
            val routeDisplay = routeName?.let {
                context.getString(R.string.widget_route_format, it)
            } ?: context.getString(R.string.widget_no_route)
            val routeId = prefsManager.getSelectedRouteId() ?: prefsManager.getDefaultRouteId()

            val launchIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val launchPendingIntent = PendingIntent.getActivity(
                context, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            appWidgetIds.forEach { appWidgetId ->
                appWidgetManager.updateAppWidget(
                    appWidgetId, createRemoteViews(
                        context = context,
                        routeDisplay = routeDisplay,
                        departureText = "",
                        locationText = context.getString(R.string.widget_loading_location),
                        launchPendingIntent = launchPendingIntent
                    )
                )
            }

            val busRepository = BusRepository(ApiClient.wbusApiService)
            val staticDataRepository = StaticDataRepository(ApiClient.storageService)

            val (locationText, departureText) = resolveDetailedInfo(
                context = context,
                routeName = routeName,
                fallbackRouteId = routeId,
                busRepository = busRepository,
                staticDataRepository = staticDataRepository
            )

            appWidgetIds.forEach { appWidgetId ->
                appWidgetManager.updateAppWidget(
                    appWidgetId, createRemoteViews(
                        context = context,
                        routeDisplay = routeDisplay,
                        departureText = departureText,
                        locationText = locationText,
                        launchPendingIntent = launchPendingIntent
                    )
                )
            }
        }

        private fun createRemoteViews(
            context: Context,
            routeDisplay: String,
            departureText: String,
            locationText: String,
            launchPendingIntent: PendingIntent
        ): RemoteViews {
            return RemoteViews(context.packageName, R.layout.widget_home).apply {
                setTextViewText(R.id.widget_route_name, routeDisplay)
                setTextViewText(R.id.widget_departure_times, departureText)
                setTextViewText(R.id.widget_location, locationText)
                setOnClickPendingIntent(R.id.widget_root, launchPendingIntent)
                setOnClickPendingIntent(R.id.widget_open_button, launchPendingIntent)
            }
        }

        private suspend fun resolveDetailedInfo(
            context: Context,
            routeName: String?,
            fallbackRouteId: String,
            busRepository: BusRepository,
            staticDataRepository: StaticDataRepository
        ): Pair<String, String> = coroutineScope {
            val routeIds = resolveRouteIds(routeName, fallbackRouteId, staticDataRepository)

            val locationsDeferred = routeIds.map { id -> async { busRepository.getBusLocations(id) } }
            val scheduleDeferred =
                async { if (fallbackRouteId.isNotEmpty()) busRepository.getBusSchedule(fallbackRouteId) else null }

            val locationResults = locationsDeferred.awaitAll()
            val scheduleResult = scheduleDeferred.await()

            val buses = mutableListOf<BusItem>()
            var locationError = false
            locationResults.forEach { result ->
                when (result) {
                    is Result.Success -> buses.addAll(result.data)
                    is Result.Error -> locationError = true
                    else -> Unit
                }
            }

            val locationText = if (buses.isNotEmpty()) {
                formatLocationSummary(context, buses.distinctBy { it.vehicleno })
            } else if (locationError) {
                context.getString(R.string.widget_location_error)
            } else {
                context.getString(R.string.widget_location_none)
            }

            val departureText = if (scheduleResult is Result.Success) {
                formatDepartureSummary(context, scheduleResult.data)
            } else {
                ""
            }

            locationText to departureText
        }

        private suspend fun resolveRouteIds(
            routeName: String?, fallbackRouteId: String, staticDataRepository: StaticDataRepository
        ): List<String> {
            if (routeName.isNullOrBlank()) return listOf(fallbackRouteId)
            return when (val routeIdsResult = staticDataRepository.getRouteIds(routeName)) {
                is Result.Success -> routeIdsResult.data.filter { it.isNotBlank() }.distinct().ifEmpty {
                    listOf(fallbackRouteId)
                }

                else -> listOf(fallbackRouteId)
            }
        }

        private fun formatLocationSummary(context: Context, buses: List<BusItem>): String {
            val stopNames = buses.mapNotNull { it.nodenm?.trim()?.takeIf(String::isNotEmpty) }.distinct()
            val busCount = buses.size
            if (stopNames.isEmpty()) {
                return context.getString(R.string.widget_location_unknown, busCount)
            }
            if (stopNames.size == 1) {
                return context.getString(R.string.widget_location_single, stopNames.first(), busCount)
            }
            return context.getString(
                R.string.widget_location_multi, stopNames.first(), stopNames.size - 1, busCount
            )
        }

        private fun formatDepartureSummary(context: Context, schedule: BusSchedule): String {
            val dayType = if (schedule.schedule.weekday != null) DayType.current() else DayType.WEEKDAY
            val hourlyMap = when (dayType) {
                DayType.WEEKDAY -> schedule.schedule.weekday ?: schedule.schedule.general
                DayType.WEEKEND -> schedule.schedule.weekend ?: schedule.schedule.general
            } ?: return ""

            val departureStrings = schedule.directions.map { direction ->
                val nextBus = findNextBus(hourlyMap, direction)
                val label = direction.take(2)
                if (nextBus != null) {
                    label + " " + nextBus.first + ":" + nextBus.second
                } else {
                    label + " " + context.getString(R.string.widget_next_departure_none)
                }
            }

            return departureStrings.joinToString("  |  ")
        }

        private fun findNextBus(hourlyMap: HourlyMap, direction: String): Pair<Int, String>? {
            val now = Calendar.getInstance()
            val currentHour = now.get(Calendar.HOUR_OF_DAY)
            val currentMinute = now.get(Calendar.MINUTE)

            val sortedHours = hourlyMap.keys.mapNotNull { it.toIntOrNull() }.sorted()

            for (hour in sortedHours) {
                if (hour < currentHour) continue

                val hourKey = String.format("%02d", hour)
                val minutes = hourlyMap[hourKey]?.get(direction) ?: emptyList()

                for (item in minutes) {
                    val minuteVal = item.minute.toIntOrNull() ?: 0
                    if (hour > currentHour || minuteVal > currentMinute) {
                        return Pair(hour, item.minute)
                    }
                }
            }

            if (sortedHours.isNotEmpty()) {
                val firstHour = sortedHours.first()
                val firstHourKey = String.format("%02d", firstHour)
                val firstMinute = hourlyMap[firstHourKey]?.get(direction)?.firstOrNull()?.minute
                if (firstMinute != null) {
                    return Pair(firstHour, firstMinute)
                }
            }

            return null
        }
    }
}
