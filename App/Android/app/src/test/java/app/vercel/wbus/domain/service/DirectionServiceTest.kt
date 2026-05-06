package app.vercel.wbus.domain.service

import app.vercel.wbus.data.model.Direction
import app.vercel.wbus.data.model.SequenceItem
import org.junit.Assert.assertEquals
import org.junit.Test

class DirectionServiceTest {

    @Test
    fun resolveDirection_mapsUpDownCodeCorrectly() {
        val lookup = DirectionService.buildLookup(
            sequences = listOf(
                RouteSequenceData(
                    routeid = "route-a",
                    sequence = listOf(
                        SequenceItem(nodeord = 1, nodeid = "node-down", updowncd = 0),
                        SequenceItem(nodeord = 2, nodeid = "node-up", updowncd = 1)
                    )
                )
            ),
            routeIdOrder = listOf("route-a")
        )

        val downDirection = DirectionService.resolveDirection(
            lookup = lookup,
            nodeid = "node-down",
            nodeord = 1,
            routeid = "route-a"
        )
        val upDirection = DirectionService.resolveDirection(
            lookup = lookup,
            nodeid = "node-up",
            nodeord = 2,
            routeid = "route-a"
        )

        assertEquals(Direction.DOWN, downDirection)
        assertEquals(Direction.UP, upDirection)
    }
}
