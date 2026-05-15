package app.vercel.wbus.ui.main

/**
 * UI model for route selection
 */
data class RouteItem(
    val routeNumber: String, val routeIds: List<String>, val displayName: String
) {
    // Primary route ID (first one in the list)
    val primaryRouteId: String
        get() = routeIds.firstOrNull() ?: ""

    companion object {
        fun fromRouteMap(routeNumber: String, routeIds: List<String>): RouteItem {
            return RouteItem(
                routeNumber = routeNumber, routeIds = routeIds, displayName = "${routeNumber}번 버스"
            )
        }

        // Sort routes: numbers first (numerically), then text
        fun sortRoutes(routes: List<RouteItem>): List<RouteItem> {
            return routes.sortedWith(compareBy { route ->
                // Try to parse as number
                route.routeNumber.toIntOrNull() ?: Int.MAX_VALUE
            })
        }
    }
}
