package app.vercel.wbus.domain.service

import app.vercel.wbus.data.model.Direction
import app.vercel.wbus.data.model.SequenceItem
import kotlin.math.abs

/**
 * Data required to resolve bus directions
 */
data class RouteSequenceData(
    val routeid: String, val sequence: List<SequenceItem>
)

/**
 * State of the direction resolver, built from route sequence data
 */
class DirectionLookup(
    val sequenceMap: Map<String, List<SequenceCandidate>>,
    val routeMixedDirMap: Map<String, Boolean>,
    val fallbackDirMap: Map<String, Int>,
    val activeRouteIds: Set<String>
)

/**
 * Candidate sequence position for a given node
 */
data class SequenceCandidate(
    val routeid: String, val nodeord: Int, val updowncd: Int
)

/**
 * Service to resolve bus direction (Up/Down) based on current position and route data
 */
object DirectionService {

    /**
     * Node IDs that should always be treated as UP direction
     * These are typically terminal or turnaround points
     */
    private val ALWAYS_UPWARD_NODE_IDS = setOf<String>(
        // Add specific node IDs here if needed for your routes
        // Example: "215000001", "215000002"
    )

    /**
     * Build lookup tables from route sequences to allow fast direction resolution
     */
    fun buildLookup(sequences: List<RouteSequenceData>, routeIdOrder: List<String>): DirectionLookup {
        val sequenceMap = mutableMapOf<String, MutableList<SequenceCandidate>>()
        for (rsd in sequences) {
            for (item in rsd.sequence) {
                val list = sequenceMap.getOrPut(item.nodeid) { mutableListOf() }
                list.add(SequenceCandidate(rsd.routeid, item.nodeord, item.updowncd))
            }
        }

        val routeMixedDirMap = mutableMapOf<String, Boolean>()
        for (rsd in sequences) {
            val directions = rsd.sequence.map { it.updowncd }.toSet()
            routeMixedDirMap[rsd.routeid] = directions.size > 1
        }

        val fallbackDirMap = mutableMapOf<String, Int>()
        if (routeIdOrder.size == 2) {
            fallbackDirMap[routeIdOrder[0]] = Direction.UP
            fallbackDirMap[routeIdOrder[1]] = Direction.DOWN
        }

        val activeRouteIds = sequences.map { it.routeid }.toSet()

        return DirectionLookup(sequenceMap, routeMixedDirMap, fallbackDirMap, activeRouteIds)
    }

    /**
     * Resolve the direction (UP/DOWN) for a bus at a specific node
     */
    fun resolveDirection(
        lookup: DirectionLookup, nodeid: String?, nodeord: Int, routeid: String? = null
    ): Int? {
        if (nodeid == null || nodeid.trim().isEmpty()) return null

        val normalizedNodeId = nodeid.trim()

        // Check if this node should always be treated as upward
        if (ALWAYS_UPWARD_NODE_IDS.contains(normalizedNodeId)) {
            return Direction.UP
        }

        val candidates = lookup.sequenceMap[normalizedNodeId] ?: return null
        if (candidates.isEmpty()) return null

        val scopedCandidates = if (routeid != null) {
            candidates.filter { it.routeid == routeid }
        } else {
            candidates.filter { lookup.activeRouteIds.contains(it.routeid) }
        }

        val pool = if (scopedCandidates.isNotEmpty()) scopedCandidates else candidates

        val exactMatch = pool.find { it.nodeord == nodeord }

        val bestMatch = exactMatch ?: pool.minWithOrNull { a, b ->
            val aDiff = abs(a.nodeord - nodeord)
            val bDiff = abs(b.nodeord - nodeord)
            when {
                aDiff != bDiff -> aDiff.compareTo(bDiff)
                else -> a.nodeord.compareTo(b.nodeord)
            }
        } ?: return null

        val isMixed = lookup.routeMixedDirMap[bestMatch.routeid] ?: false
        val fallback = lookup.fallbackDirMap[bestMatch.routeid]

        if (!isMixed && fallback != null) return fallback

        // TODO: Add direction for circulation
        return if (bestMatch.updowncd == 0) Direction.UP else if (bestMatch.updowncd == 1) Direction.DOWN else Direction.UP
    }
}
