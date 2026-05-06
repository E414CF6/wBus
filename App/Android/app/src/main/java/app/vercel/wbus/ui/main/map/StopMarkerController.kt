package app.vercel.wbus.ui.main.map

import app.vercel.wbus.data.model.BusStop
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions

class StopMarkerController(private val iconProvider: () -> BitmapDescriptor?) {
    companion object {
        private const val STOP_MARKER_ALPHA = 0.7f
        private const val MIN_STOP_VISIBLE_ZOOM = 14f
    }

    private val stopMarkers = mutableListOf<Marker>()
    private val stopLookup = mutableMapOf<String, BusStop>()
    private var currentZoom = 0f

    fun render(map: GoogleMap, stops: List<BusStop>, zoom: Float = map.cameraPosition.zoom) {
        clear()
        stopLookup.putAll(stops.associateBy { it.nodeid })
        val icon = iconProvider()

        stops.forEach { stop ->
            val marker = map.addMarker(
                MarkerOptions().position(LatLng(stop.gpslati, stop.gpslong)).title(stop.nodenm).snippet(stop.nodeno)
                    .alpha(STOP_MARKER_ALPHA).icon(icon)
            )
            marker?.let {
                it.tag = stop.nodeid
                stopMarkers.add(it)
            }
        }

        onZoomChanged(zoom)
    }

    fun onZoomChanged(zoom: Float) {
        currentZoom = zoom
        val isVisible = currentZoom >= MIN_STOP_VISIBLE_ZOOM
        stopMarkers.forEach { marker ->
            marker.isVisible = isVisible
        }
    }

    fun findStopByMarker(marker: Marker): BusStop? {
        val stopNodeId = marker.tag as? String ?: return null
        return stopLookup[stopNodeId]
    }

    fun clear() {
        stopMarkers.forEach { it.remove() }
        stopMarkers.clear()
        stopLookup.clear()
    }
}
