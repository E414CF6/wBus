package app.vercel.wbus.util.geo

import app.vercel.wbus.data.model.Coordinate
import kotlin.math.*

/**
 * Geospatial utility functions for distance calculations, bearing, and polyline operations
 */
object GeoUtils {

    private const val EARTH_RADIUS_KM = 6371.0
    private const val METERS_PER_DEGREE = 111_000.0

    /**
     * Calculate the Haversine distance between two points in kilometers
     * Most accurate for all distances but slightly slower than approximate methods
     */
    fun getHaversineDistance(
        lat1: Double, lon1: Double, lat2: Double, lon2: Double
    ): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)

        val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)

        return EARTH_RADIUS_KM * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    /**
     * Calculate the Haversine distance between two coordinates in meters
     */
    fun getHaversineDistanceMeters(p1: Coordinate, p2: Coordinate): Double {
        return getHaversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude) * 1000
    }

    /**
     * Calculate approximate distance between two points in meters
     * Fast approximation suitable for short distances (< 10km)
     */
    fun getApproxDistanceMeters(p1: Coordinate, p2: Coordinate): Double {
        val latRad = Math.toRadians((p1.latitude + p2.latitude) * 0.5)
        val lngScale = cos(latRad)

        val dLat = p2.latitude - p1.latitude
        val dLng = (p2.longitude - p1.longitude) * lngScale

        return sqrt(dLat * dLat + dLng * dLng) * METERS_PER_DEGREE
    }

    /**
     * Calculate Euclidean distance (simple straight-line distance)
     * Useful for comparing relative distances without worrying about accuracy
     */
    fun getEuclideanDistance(p1: Coordinate, p2: Coordinate): Double {
        val dx = p1.latitude - p2.latitude
        val dy = p1.longitude - p2.longitude
        return sqrt(dx * dx + dy * dy)
    }

    /**
     * Calculate the bearing (compass direction) from point A to point B in degrees
     * Returns value between 0-360 where 0/360 is North, 90 is East, etc.
     */
    fun calculateBearing(from: Coordinate, to: Coordinate): Double {
        val lat1 = Math.toRadians(from.latitude)
        val lat2 = Math.toRadians(to.latitude)
        val dLon = Math.toRadians(to.longitude - from.longitude)

        val y = sin(dLon) * cos(lat2)
        val x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)

        return (Math.toDegrees(atan2(y, x)) + 360) % 360
    }

    /**
     * Normalize an angle to be between 0 and 360 degrees
     */
    fun normalizeAngle(angle: Double): Double {
        return ((angle % 360) + 360) % 360
    }

    /**
     * Linear interpolation between two values
     */
    fun lerp(start: Double, end: Double, fraction: Double): Double {
        return start + (end - start) * fraction
    }

    /**
     * Interpolate between two coordinates
     */
    fun interpolateLatLng(from: Coordinate, to: Coordinate, fraction: Double): Coordinate {
        return Coordinate(
            lerp(from.latitude, to.latitude, fraction), lerp(from.longitude, to.longitude, fraction)
        )
    }

    /**
     * Interpolate between two angles taking the shortest path
     * @param from Starting angle in degrees
     * @param to Target angle in degrees
     * @param progress Interpolation progress from 0.0 to 1.0
     * @return Interpolated angle in degrees
     */
    fun interpolateAngle(from: Double, to: Double, progress: Double): Double {
        val normFrom = normalizeAngle(from)
        val normTo = normalizeAngle(to)

        var diff = normTo - normFrom
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360

        return normalizeAngle(normFrom + diff * progress)
    }
}
