package app.vercel.wbus.data.model

import com.squareup.moshi.JsonClass

/**
 * GeoJSON Feature Collection for bus routes
 */
@JsonClass(generateAdapter = true)
data class GeoPolyline(
    val type: String = "FeatureCollection", val features: List<BusRouteFeature>
)

/**
 * Individual GeoJSON Feature for a bus route
 */
@JsonClass(generateAdapter = true)
data class BusRouteFeature(
    val type: String = "Feature",
    val id: String,
    val bbox: List<Double>,
    val geometry: BusRouteGeometry,
    val properties: BusRouteProperties
)

/**
 * LineString geometry containing the route coordinates
 */
@JsonClass(generateAdapter = true)
data class BusRouteGeometry(
    val type: String = "LineString", val coordinates: List<List<Double>>
) {
    /**
     * Convert coordinates to Coordinate objects
     */
    fun toCoordinates(): List<Coordinate> = coordinates.map {
        Coordinate(it[1], it[0]) // GeoJSON is [lng, lat], we use [lat, lng]
    }
}

/**
 * Properties associated with a bus route feature
 */
@JsonClass(generateAdapter = true)
data class BusRouteProperties(
    val route_id: String,
    val route_no: String,
    val stops: List<RouteStop>,
    val turn_idx: Int,
    val stop_to_coord: List<Int>,
    val total_dist: Double,
    val source_ver: String
)

/**
 * Stop information embedded in route properties
 */
@JsonClass(generateAdapter = true)
data class RouteStop(
    val id: String, val name: String, val ord: Int, val ud: Int  // up/down direction
)
