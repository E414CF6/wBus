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
    val routePriorityMap: Map<String, Int>,
    val activeRouteIds: Set<String>
)

/**
 * Candidate sequence position for a given node
 */
data class SequenceCandidate(
    val routeid: String, val nodeord: Int, val updowncd: Int
)

/**
 * Service to resolve a bus direction (Up/Down) based on current position and route data
 */
object DirectionService {
    private const val API_DOWN_CODE = 0
    private const val API_UP_CODE = 1

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
        val resolvedRouteDirMap = mutableMapOf<String, Int>()
        for (rsd in sequences) {
            val directions = rsd.sequence.mapNotNull { mapUpDownCode(it.updowncd) }.toSet()
            routeMixedDirMap[rsd.routeid] = directions.size > 1
            if (directions.size == 1) {
                resolvedRouteDirMap[rsd.routeid] = directions.first()
            }
        }

        val fallbackDirMap = mutableMapOf<String, Int>()
        if (routeIdOrder.size == 2) {
            val firstRouteId = routeIdOrder[0]
            val secondRouteId = routeIdOrder[1]
            val firstResolved = resolvedRouteDirMap[firstRouteId]
            val secondResolved = resolvedRouteDirMap[secondRouteId]

            if (firstResolved == null && secondResolved != null) {
                resolvedRouteDirMap[firstRouteId] = opposite(secondResolved)
            }
            if (secondResolved == null && firstResolved != null) {
                resolvedRouteDirMap[secondRouteId] = opposite(firstResolved)
            }
        }
        fallbackDirMap.putAll(resolvedRouteDirMap)

        val routePriorityMap = routeIdOrder.withIndex().associate { it.value to it.index }
        val activeRouteIds = sequences.map { it.routeid }.toSet()

        return DirectionLookup(sequenceMap, routeMixedDirMap, fallbackDirMap, routePriorityMap, activeRouteIds)
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

        val activeCandidates = candidates.filter { lookup.activeRouteIds.contains(it.routeid) }
        val scopedCandidates = routeid?.let { currentRouteId ->
            activeCandidates.filter { it.routeid == currentRouteId }
        } ?: activeCandidates
        val pool = scopedCandidates.ifEmpty { activeCandidates.ifEmpty { candidates } }

        val exactMatch = pool.find { it.nodeord == nodeord }

        val bestMatch = exactMatch ?: pool.minWithOrNull { a, b ->
            val aDiff = abs(a.nodeord - nodeord)
            val bDiff = abs(b.nodeord - nodeord)
            when {
                aDiff != bDiff -> aDiff.compareTo(bDiff)
                a.routeid != b.routeid -> {
                    val aPriority = lookup.routePriorityMap[a.routeid] ?: Int.MAX_VALUE
                    val bPriority = lookup.routePriorityMap[b.routeid] ?: Int.MAX_VALUE
                    aPriority.compareTo(bPriority)
                }

                else -> a.nodeord.compareTo(b.nodeord)
            }
        } ?: return null

        val isMixed = lookup.routeMixedDirMap[bestMatch.routeid] ?: false
        val fallback = lookup.fallbackDirMap[bestMatch.routeid]

        if (!isMixed && fallback != null) return fallback

        return mapUpDownCode(bestMatch.updowncd) ?: fallback
    }

    private fun mapUpDownCode(code: Int): Int? {
        return when (code) {
            API_DOWN_CODE -> Direction.DOWN
            API_UP_CODE -> Direction.UP
            else -> null
        }
    }

    private fun opposite(direction: Int): Int {
        return if (direction == Direction.UP) Direction.DOWN else Direction.UP
    }
}
