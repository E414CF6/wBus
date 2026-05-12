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
import app.vercel.wbus.data.model.BusSchedule
import app.vercel.wbus.data.model.DayType
import app.vercel.wbus.data.repository.StaticDataRepository
import app.vercel.wbus.ui.main.MainActivity
import app.vercel.wbus.util.ScheduleUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.*

class WBusHomeWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray
    ) {
        val pendingResult = goAsync()
        widgetScope.launch {
            try {
                updateWidgets(context, appWidgetManager, appWidgetIds)
            } catch (_: Exception) {
                val empty = context.getString(R.string.widget_next_departure_none)
                val launchPendingIntent = createLaunchPendingIntent(context.applicationContext)
                appWidgetIds.forEach { widgetId ->
                    appWidgetManager.updateAppWidget(
                        widgetId, buildRemoteViews(
                            context = context.applicationContext,
                            routeLabel = null,
                            firstRowText = empty,
                            secondRowText = empty,
                            launchPendingIntent = launchPendingIntent
                        )
                    )
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_WIDGET_REFRESH) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, WBusHomeWidgetProvider::class.java)
            )
            val pendingResult = goAsync()
            widgetScope.launch {
                try {
                    updateWidgets(context, manager, ids)
                } catch (_: Exception) {
                    // Ignore refresh failures; widget keeps previous state.
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }

    private suspend fun updateWidgets(
        context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray
    ) {
        if (appWidgetIds.isEmpty()) return
        val appContext = context.applicationContext

        val prefsManager = PreferencesManager(appContext)
        val routeName = prefsManager.getSelectedRouteName()
        val routeLabel = routeName?.takeIf { it.isNotBlank() }
        val scheduleRows = loadClosestRows(appContext, routeLabel)
        val launchPendingIntent = createLaunchPendingIntent(appContext)

        appWidgetIds.forEach { widgetId ->
            val remoteViews = buildRemoteViews(
                context = appContext,
                routeLabel = routeLabel,
                firstRowText = scheduleRows.first,
                secondRowText = scheduleRows.second,
                launchPendingIntent = launchPendingIntent
            )
            appWidgetManager.updateAppWidget(widgetId, remoteViews)
        }
    }

    private suspend fun loadClosestRows(
        context: Context, routeName: String?
    ): Pair<String, String> {
        if (routeName == null) {
            val empty = context.getString(R.string.widget_next_departure_none)
            return empty to empty
        }

        val scheduleRouteName = routeName.filter { it.isDigit() || it == '-' }
        if (scheduleRouteName.isEmpty()) {
            val empty = context.getString(R.string.widget_next_departure_none)
            return empty to empty
        }

        val repository = StaticDataRepository(ApiClient.storageService)
        val scheduleResult = repository.getSchedule(scheduleRouteName)
        if (scheduleResult !is Result.Success) {
            val empty = context.getString(R.string.widget_next_departure_none)
            return empty to empty
        }

        val schedule = scheduleResult.data
        val hourlyMap = resolveHourlyMap(schedule)
        val directions = schedule.directions.take(2)
        if (directions.isEmpty()) {
            val empty = context.getString(R.string.widget_next_departure_none)
            return empty to empty
        }

        val firstDirection = directions.first()
        val firstRow = ScheduleUtils.findClosestHourRow(hourlyMap, firstDirection, Calendar.getInstance())
        val firstText = formatScheduleRow(context, firstDirection, firstRow)

        val secondDirection = directions.getOrNull(1)
        val secondText = if (secondDirection == null) {
            context.getString(R.string.widget_next_departure_none)
        } else {
            val secondRow = ScheduleUtils.findClosestHourRow(hourlyMap, secondDirection, Calendar.getInstance())
            formatScheduleRow(context, secondDirection, secondRow)
        }

        return firstText to secondText
    }

    private fun resolveHourlyMap(schedule: BusSchedule) =
        when (if (schedule.schedule.weekday != null || schedule.schedule.weekend != null) {
            ScheduleUtils.getCurrentDayType()
        } else {
            DayType.WEEKDAY
        }) {
            DayType.WEEKDAY -> schedule.schedule.weekday ?: schedule.schedule.general
            DayType.WEEKEND -> schedule.schedule.weekend ?: schedule.schedule.general
        } ?: emptyMap()

    private fun formatScheduleRow(
        context: Context, direction: String, row: ScheduleUtils.ClosestHourRow?
    ): String {
        if (row == null || row.minutes.isEmpty()) {
            return context.getString(R.string.widget_direction_no_departure_format, direction)
        }
        val minutesText = row.minutes.joinToString(" ")
        return context.getString(
            R.string.widget_schedule_row_format, direction, row.hour.toString(), minutesText
        )
    }

    private fun buildRemoteViews(
        context: Context,
        routeLabel: String?,
        firstRowText: String,
        secondRowText: String,
        launchPendingIntent: PendingIntent
    ): RemoteViews {
        return RemoteViews(context.packageName, R.layout.widget_home).apply {
            setTextViewText(
                R.id.widget_route_name,
                routeLabel?.let { context.getString(R.string.widget_route_format, it) }
                    ?: context.getString(R.string.widget_no_route))
            setTextViewText(R.id.widget_departure_times, firstRowText)
            setTextViewText(R.id.widget_location, secondRowText)
            setTextViewText(R.id.widget_route_id, routeLabel ?: "")
            setOnClickPendingIntent(R.id.widget_root, launchPendingIntent)
            setOnClickPendingIntent(R.id.widget_open_button, launchPendingIntent)
        }
    }

    private fun createLaunchPendingIntent(context: Context): PendingIntent {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        private const val ACTION_WIDGET_REFRESH = "app.vercel.wbus.action.WIDGET_REFRESH"
        private val widgetScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        fun requestUpdate(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, WBusHomeWidgetProvider::class.java)
            )
            if (appWidgetIds.isEmpty()) return

            context.sendBroadcast(
                Intent(context, WBusHomeWidgetProvider::class.java).apply {
                    action = ACTION_WIDGET_REFRESH
                })
        }
    }
}
