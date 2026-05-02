package app.vercel.wbus.util.geo

import app.vercel.wbus.data.model.Coordinate
import kotlin.math.max
import kotlin.math.pow

/**
 * Result of snapping a point to a polyline
 */
data class SnapResult(
    val position: Coordinate,
    val angle: Double,
    val segmentIndex: Int,
    val t: Double  // Position along segment (0.0 to 1.0)
)

/**
 * Options for polyline snapping
 */
data class SnapOptions(
    val segmentHint: Int? = null,      // Hint for which segment to check first
    val searchRadius: Int = 0,          // Number of segments to check around hint
    val minSegmentIndex: Int? = null    // Minimum segment index to consider
)

/**
 * Snap a point to the nearest position on a polyline
 * 
 * This is used to keep bus markers on the route path even when GPS coordinates
 * are slightly off the actual road.
 * 
 * @param point The point to snap
 * @param polyline The list of coordinates forming the route
 * @param options Optional hints to optimize the search
 * @return SnapResult containing the snapped position, bearing, and segment info
 */
fun snapPointToPolyline(
    point: Coordinate, polyline: List<Coordinate>, options: SnapOptions = SnapOptions()
): SnapResult {
    // Default result if polyline is invalid
    val defaultResult = SnapResult(
        position = point, angle = 0.0, segmentIndex = 0, t = 0.0
    )

    if (polyline.size < 2) return defaultResult

    val lastSegment = polyline.size - 2
    val hint = options.segmentHint
    val hasHint = hint != null && hint.isFinite()
    val radius = max(0, options.searchRadius)
    val minIdx = options.minSegmentIndex
    val hasMinIdx = minIdx != null && minIdx.isFinite()

    // Determine search range
    val clampedHint = if (hasHint) hint.coerceIn(0, lastSegment) else 0
    val baseStartIdx = if (hasHint) (clampedHint - radius).coerceIn(0, lastSegment) else 0
    val startIdx = if (hasMinIdx) max(baseStartIdx, minIdx.coerceIn(0, lastSegment)) else baseStartIdx
    val endIdx = if (hasHint) (clampedHint + radius).coerceIn(0, lastSegment) else lastSegment

    // Find the closest point on any segment
    var bestDistSq = Double.POSITIVE_INFINITY
    var bestPos = polyline[0]
    var bestIdx = 0
    var bestT = 0.0
    var bestSegmentStart = polyline[0]
    var bestSegmentEnd = polyline[0]

    for (i in startIdx..endIdx) {
        val a = polyline[i]
        val b = polyline[i + 1]

        // Vector from A to point
        val apX = point.latitude - a.latitude
        val apY = point.longitude - a.longitude

        // Vector from A to B
        val abX = b.latitude - a.latitude
        val abY = b.longitude - a.longitude

        // Calculate projection parameter t
        val ab2 = abX * abX + abY * abY
        val t = if (ab2 > 0) {
            ((apX * abX + apY * abY) / ab2).coerceIn(0.0, 1.0)
        } else {
            0.0
        }

        // Calculate the projected point
        val projLat = a.latitude + abX * t
        val projLng = a.longitude + abY * t

        // Calculate squared distance (faster than actual distance)
        val dSq = (point.latitude - projLat).pow(2) + (point.longitude - projLng).pow(2)

        if (dSq < bestDistSq) {
            bestDistSq = dSq
            bestPos = Coordinate(projLat, projLng)
            bestIdx = i
            bestT = t
            bestSegmentStart = a
            bestSegmentEnd = b
        }
    }

    // Calculate bearing for the best segment
    val angle = GeoUtils.calculateBearing(bestSegmentStart, bestSegmentEnd)

    return SnapResult(
        position = bestPos, angle = angle, segmentIndex = bestIdx, t = bestT
    )
}

private fun Int.isFinite(): Boolean = true  // Ints are always finite
