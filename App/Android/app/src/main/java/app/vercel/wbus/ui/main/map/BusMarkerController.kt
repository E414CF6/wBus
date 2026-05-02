package app.vercel.wbus.ui.main.map

import android.animation.ValueAnimator
import android.view.animation.LinearInterpolator
import app.vercel.wbus.data.model.BusItem
import app.vercel.wbus.data.model.Coordinate
import app.vercel.wbus.util.geo.GeoUtils
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions
import kotlinx.coroutines.*

class BusMarkerController(
    private val scope: CoroutineScope, private val iconFactory: MapMarkerIconFactory
) {
    companion object {
        private const val MARKER_ANIMATION_DURATION = 2800L
        private const val MIN_ANIMATION_DISTANCE_METERS = 10.0
        private const val MARQUEE_INTERVAL_MS = 250L
    }

    private val busMarkers = mutableMapOf<String, Marker>()
    private val busRouteNames = mutableMapOf<String, String>()
    private val marqueeOffsets = mutableMapOf<String, Int>()
    private val activeAnimators = mutableMapOf<String, ValueAnimator>()
    private var marqueeJob: Job? = null

    fun render(map: GoogleMap, buses: List<BusItem>) {
        val currentBusIds = buses.associateBy { it.vehicleno }

        val iterator = busMarkers.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (entry.key !in currentBusIds) {
                entry.value.remove()
                busRouteNames.remove(entry.key)
                marqueeOffsets.remove(entry.key)
                iterator.remove()
            }
        }

        buses.forEach { bus ->
            val busId = bus.vehicleno
            val newPosition = LatLng(bus.gpslati, bus.gpslong)
            val marker = busMarkers[busId]
            val previousRoute = busRouteNames[busId]
            if (previousRoute != bus.routenm) {
                marqueeOffsets[busId] = 0
            }
            busRouteNames[busId] = bus.routenm

            val routeText = getMarqueeText(bus.routenm, busId, advance = false)
            val icon = iconFactory.getBusMarkerIcon(routeText)
            val markerInfo = BusMarkerInfo(
                busId = busId, routeName = bus.routenm, plateNumber = bus.vehicleno, direction = bus.direction
            )

            if (marker != null) {
                animateMarker(busId, marker, newPosition, bus.bearing)
                marker.title = "${bus.routenm}번"
                marker.snippet = bus.vehicleno
                marker.tag = markerInfo
                marker.setIcon(icon)
                marker.isFlat = true
            } else {
                val newMarker = map.addMarker(
                    MarkerOptions().position(newPosition).title("${bus.routenm}번").snippet(bus.vehicleno).icon(icon)
                        .flat(true).anchor(0.5f, 0.5f).rotation(bus.bearing.toFloat())
                )
                newMarker?.let {
                    it.tag = markerInfo
                    busMarkers[busId] = it
                }
            }
        }
    }

    fun infoForMarker(marker: Marker): BusMarkerInfo? = marker.tag as? BusMarkerInfo

    fun pause() {
        activeAnimators.values.forEach { it.cancel() }
        activeAnimators.clear()
        marqueeJob?.cancel()
        marqueeJob = null
    }

    fun resume() {
        startMarqueeTicker()
    }

    fun clear() {
        busMarkers.forEach { it.value.remove() }
        busMarkers.clear()
        busRouteNames.clear()
        marqueeOffsets.clear()
        activeAnimators.values.forEach { it.cancel() }
        activeAnimators.clear()
    }

    fun release() {
        pause()
        clear()
        iconFactory.clear()
    }

    private fun animateMarker(busId: String, marker: Marker, finalPosition: LatLng, finalBearing: Double) {
        val startPosition = marker.position
        val distance = GeoUtils.getHaversineDistanceMeters(
            Coordinate(startPosition.latitude, startPosition.longitude),
            Coordinate(finalPosition.latitude, finalPosition.longitude)
        )

        if (distance < MIN_ANIMATION_DISTANCE_METERS) {
            marker.position = finalPosition
            marker.rotation = finalBearing.toFloat()
            return
        }

        activeAnimators[busId]?.cancel()

        val startRotation = marker.rotation.toDouble()
        val valueAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = MARKER_ANIMATION_DURATION
            interpolator = LinearInterpolator()
            addUpdateListener { animation ->
                val progress = animation.animatedFraction.toDouble()
                val interpolated = GeoUtils.interpolateLatLng(
                    Coordinate(startPosition.latitude, startPosition.longitude),
                    Coordinate(finalPosition.latitude, finalPosition.longitude),
                    progress
                )

                marker.takeIf { busMarkers.containsKey(busId) }?.let { safeMarker ->
                    safeMarker.position = LatLng(interpolated.latitude, interpolated.longitude)
                    safeMarker.rotation = GeoUtils.interpolateAngle(
                        startRotation, finalBearing, progress
                    ).toFloat()
                }
            }
        }
        activeAnimators[busId] = valueAnimator
        valueAnimator.start()
    }

    private fun startMarqueeTicker() {
        marqueeJob?.cancel()
        marqueeJob = scope.launch {
            while (isActive) {
                busMarkers.forEach { (busId, marker) ->
                    val routeName = busRouteNames[busId] ?: return@forEach
                    if (routeName.length > 3) {
                        val marqueeText = getMarqueeText(routeName, busId, advance = true)
                        marker.setIcon(iconFactory.getBusMarkerIcon(marqueeText))
                    }
                }
                delay(MARQUEE_INTERVAL_MS)
            }
        }
    }

    private fun getMarqueeText(routeName: String, busId: String, advance: Boolean): String {
        if (routeName.length <= 3) return routeName

        val source = "$routeName   "
        var offset = marqueeOffsets[busId] ?: 0
        if (advance) {
            offset = (offset + 1) % source.length
            marqueeOffsets[busId] = offset
        } else {
            marqueeOffsets.putIfAbsent(busId, 0)
        }

        return buildString(3) {
            repeat(3) { i ->
                append(source[(offset + i) % source.length])
            }
        }
    }
}
