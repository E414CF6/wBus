package app.vercel.wbus.data.local

import android.content.Context
import android.content.SharedPreferences

/**
 * Manager for local preferences storage
 */
class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME, Context.MODE_PRIVATE
    )

    /**
     * Get the currently selected route ID
     */
    fun getSelectedRouteId(): String? {
        return prefs.getString(KEY_SELECTED_ROUTE_ID, null)
    }

    /**
     * Save the selected route ID
     */
    fun setSelectedRouteId(routeId: String?) {
        prefs.edit().putString(KEY_SELECTED_ROUTE_ID, routeId).apply()
    }

    /**
     * Get the currently selected route name
     */
    fun getSelectedRouteName(): String? {
        return prefs.getString(KEY_SELECTED_ROUTE_NAME, DEFAULT_ROUTE_NAME)
    }

    /**
     * Save the selected route name
     */
    fun setSelectedRouteName(routeName: String?) {
        prefs.edit().putString(KEY_SELECTED_ROUTE_NAME, routeName).apply()
    }

    /**
     * Check if this is the first launch
     */
    fun isFirstLaunch(): Boolean {
        return prefs.getBoolean(KEY_FIRST_LAUNCH, true)
    }

    /**
     * Mark that the app has been launched
     */
    fun setFirstLaunchComplete() {
        prefs.edit().putBoolean(KEY_FIRST_LAUNCH, false).apply()
    }

    companion object {
        private const val PREFS_NAME = "wbus_prefs"
        private const val KEY_SELECTED_ROUTE_ID = "selected_route_id"
        private const val KEY_SELECTED_ROUTE_NAME = "selected_route_name"
        private const val KEY_FIRST_LAUNCH = "first_launch"
        private const val DEFAULT_ROUTE_NAME = "30"  // Default to route 30
        private const val DEFAULT_ROUTE_ID = "WJB232000061"  // Default with WJB prefix
    }

    /**
     * Get default route ID with prefix
     */
    fun getDefaultRouteId(): String = DEFAULT_ROUTE_ID
}
