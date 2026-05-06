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
import app.vercel.wbus.data.model.BusItem
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.data.repository.StaticDataRepository
import app.vercel.wbus.ui.main.MainActivity
import kotlinx.coroutines.*

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
                        routeId = routeId,
                        locationText = context.getString(R.string.widget_loading_location),
                        launchPendingIntent = launchPendingIntent
                    )
                )
            }

            val busRepository = BusRepository(ApiClient.wbusApiService)
            val staticDataRepository = StaticDataRepository(ApiClient.storageService)
            val locationText = resolveLocationText(
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
                        routeId = routeId,
                        locationText = locationText,
                        launchPendingIntent = launchPendingIntent
                    )
                )
            }
        }

        private fun createRemoteViews(
            context: Context,
            routeDisplay: String,
            routeId: String,
            locationText: String,
            launchPendingIntent: PendingIntent
        ): RemoteViews {
            return RemoteViews(context.packageName, R.layout.widget_home).apply {
                setTextViewText(R.id.widget_route_name, routeDisplay)
                setTextViewText(R.id.widget_route_id, routeId)
                setTextViewText(R.id.widget_location, locationText)
                setOnClickPendingIntent(R.id.widget_root, launchPendingIntent)
                setOnClickPendingIntent(R.id.widget_open_button, launchPendingIntent)
            }
        }

        private suspend fun resolveLocationText(
            context: Context,
            routeName: String?,
            fallbackRouteId: String,
            busRepository: BusRepository,
            staticDataRepository: StaticDataRepository
        ): String = coroutineScope {
            val routeIds = resolveRouteIds(routeName, fallbackRouteId, staticDataRepository)
            val results = routeIds.map { routeId ->
                async { busRepository.getBusLocations(routeId) }
            }.awaitAll()

            val buses = mutableListOf<BusItem>()
            var hasError = false
            results.forEach { result ->
                when (result) {
                    is Result.Success -> buses.addAll(result.data)
                    is Result.Error -> hasError = true
                    is Result.Loading -> Unit
                }
            }

            if (buses.isNotEmpty()) {
                return@coroutineScope formatLocationSummary(context, buses.distinctBy { it.vehicleno })
            }
            if (hasError) {
                return@coroutineScope context.getString(R.string.widget_location_error)
            }
            context.getString(R.string.widget_location_none)
        }

        private suspend fun resolveRouteIds(
            routeName: String?,
            fallbackRouteId: String,
            staticDataRepository: StaticDataRepository
        ): List<String> {
            if (routeName.isNullOrBlank()) return listOf(fallbackRouteId)
            return when (val routeIdsResult = staticDataRepository.getRouteIds(routeName)) {
                is Result.Success -> routeIdsResult.data.filter { it.isNotBlank() }.distinct().ifEmpty {
                    listOf(fallbackRouteId)
                }

                is Result.Error -> listOf(fallbackRouteId)
                is Result.Loading -> listOf(fallbackRouteId)
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
    }
}
