package app.vercel.wbus.domain.service

import app.vercel.wbus.data.model.Coordinate
import app.vercel.wbus.data.model.GeoPolyline
import kotlin.math.max
import kotlin.math.min

/**
 * Split polyline data into Up and Down segments with bounding box
 */
data class PolylineData(
    val upPolyline: List<Coordinate>,
    val downPolyline: List<Coordinate>,
    val turnIndex: Int? = null,
    val isSwapped: Boolean = false,
    val bbox: List<Double>? = null // [minLng, minLat, maxLng, maxLat] from GeoJSON
)

/**
 * Service to process and manage route polylines
 */
object PolylineService {

    /**
     * Process a GeoPolyline into Up and Down segments using turn_idx
     */
    fun processPolyline(geoPolyline: GeoPolyline): PolylineData {
        val feature = geoPolyline.features.firstOrNull() ?: return PolylineData(emptyList(), emptyList())
        val coordinates = feature.geometry.toCoordinates()
        val turnIndex = feature.properties.turn_idx
        val bbox = feature.bbox

        val (firstSegment, secondSegment) = if (turnIndex > 0) {
            val idx = min(max(0, turnIndex), coordinates.size - 1)
            coordinates.subList(0, idx + 1) to coordinates.subList(idx, coordinates.size)
        } else {
            coordinates to emptyList()
        }

        if (turnIndex > 0) {
            return PolylineData(
                upPolyline = secondSegment,
                downPolyline = firstSegment,
                turnIndex = turnIndex,
                isSwapped = true,
                bbox = bbox
            )
        }

        return PolylineData(
            upPolyline = firstSegment,
            downPolyline = secondSegment,
            turnIndex = turnIndex,
            isSwapped = false,
            bbox = bbox
        )
    }

    /**
     * Calculate bearing between two coordinates
     */
    fun calculateBearing(from: Coordinate, to: Coordinate): Float {
        val lat1 = Math.toRadians(from.latitude)
        val lat2 = Math.toRadians(to.latitude)
        val dLon = Math.toRadians(to.longitude - from.longitude)

        val y = Math.sin(dLon) * Math.cos(lat2)
        val x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

        return ((Math.toDegrees(Math.atan2(y, x)) + 360) % 360).toFloat()
    }
}
