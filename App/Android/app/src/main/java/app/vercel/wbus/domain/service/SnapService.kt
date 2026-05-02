package app.vercel.wbus.domain.service

import app.vercel.wbus.data.model.BusItem
import app.vercel.wbus.data.model.Coordinate
import app.vercel.wbus.util.geo.GeoUtils
import app.vercel.wbus.util.geo.SnapOptions
import app.vercel.wbus.util.geo.snapPointToPolyline

/**
 * Result of snapping a bus position to a polyline with direction awareness
 */
data class BusSnapResult(
    val position: Coordinate, val angle: Double, val direction: Int, val segmentIndex: Int? = null, val t: Double = 0.0
)

/**
 * Service to snap bus GPS positions to the route polyline with direction awareness
 */
object SnapService {
    private const val MAX_SNAP_DISTANCE_METERS = 50.0
    private const val DEFAULT_SNAP_INDEX_RANGE = 80

    /**
     * Snap a bus's reported GPS position to the route polyline
     */
    fun getSnappedPosition(
        bus: BusItem,
        directionLookup: DirectionLookup?,
        upPolyline: List<Coordinate>,
        downPolyline: List<Coordinate>,
        turnIndex: Int? = null,
        isSwapped: Boolean = false,
        snapIndexRange: Int = DEFAULT_SNAP_INDEX_RANGE,
        previousSegmentIndex: Int? = null
    ): BusSnapResult {
        val rawPosition = bus.coordinate()
        val nodeord = bus.nodeord ?: 0

        val apiDirection = directionLookup?.let {
            DirectionService.resolveDirection(it, bus.nodeid, nodeord, bus.routeid)
        }

        val defaultResult = BusSnapResult(
            position = rawPosition, angle = 0.0, direction = apiDirection ?: 0, segmentIndex = null, t = 0.0
        )

        fun createCandidate(line: List<Coordinate>, dir: Int): Candidate? {
            if (line.size < 2) return null

            // Use previous segment index as a hint/minimum if available and directions match
            val options = if (previousSegmentIndex != null && apiDirection == dir) {
                SnapOptions(
                    segmentHint = previousSegmentIndex,
                    searchRadius = snapIndexRange,
                    minSegmentIndex = previousSegmentIndex
                )
            } else {
                SnapOptions(searchRadius = snapIndexRange)
            }

            val snapped = snapPointToPolyline(rawPosition, line, options)
            val distance = GeoUtils.getHaversineDistanceMeters(rawPosition, snapped.position)

            return Candidate(
                position = snapped.position,
                angle = snapped.angle,
                direction = dir,
                segmentIndex = snapped.segmentIndex,
                t = snapped.t,
                distance = distance,
                isValid = distance <= MAX_SNAP_DISTANCE_METERS
            )
        }

        val candidateUp = createCandidate(upPolyline, 1)
        val candidateDown = createCandidate(downPolyline, 0)

        if (apiDirection == 1 && candidateUp?.isValid == true) {
            return BusSnapResult(
                candidateUp.position, candidateUp.angle, candidateUp.direction, candidateUp.segmentIndex, candidateUp.t
            )
        }
        if (apiDirection == 0 && candidateDown?.isValid == true) {
            return BusSnapResult(
                candidateDown.position,
                candidateDown.angle,
                candidateDown.direction,
                candidateDown.segmentIndex,
                candidateDown.t
            )
        }

        if (candidateUp?.isValid == true && candidateDown?.isValid == true) {
            val winner = if (candidateUp.distance < candidateDown.distance) candidateUp else candidateDown
            return BusSnapResult(winner.position, winner.angle, winner.direction, winner.segmentIndex, winner.t)
        }

        if (candidateUp?.isValid == true) {
            return BusSnapResult(
                candidateUp.position, candidateUp.angle, candidateUp.direction, candidateUp.segmentIndex, candidateUp.t
            )
        }
        if (candidateDown?.isValid == true) {
            return BusSnapResult(
                candidateDown.position,
                candidateDown.angle,
                candidateDown.direction,
                candidateDown.segmentIndex,
                candidateDown.t
            )
        }

        return defaultResult
    }

    private data class Candidate(
        val position: Coordinate,
        val angle: Double,
        val direction: Int,
        val segmentIndex: Int,
        val t: Double,
        val distance: Double,
        val isValid: Boolean
    )
}
