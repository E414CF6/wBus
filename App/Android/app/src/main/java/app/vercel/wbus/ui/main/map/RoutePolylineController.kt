package app.vercel.wbus.ui.main.map

import android.graphics.Color
import app.vercel.wbus.domain.service.PolylineData
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.*
import timber.log.Timber

class RoutePolylineController {
    companion object {
        private const val POLYLINE_WIDTH = 12f
        private const val COLOR_UP = "#FF5252"
        private const val COLOR_DOWN = "#448AFF"
        private const val CAMERA_PADDING = 100
    }

    private var upRoutePolyline: Polyline? = null
    private var downRoutePolyline: Polyline? = null

    fun render(map: GoogleMap, data: PolylineData) {
        clear()

        val upLatLngs = data.upPolyline.map { LatLng(it.latitude, it.longitude) }
        val downLatLngs = data.downPolyline.map { LatLng(it.latitude, it.longitude) }

        if (upLatLngs.isNotEmpty()) {
            upRoutePolyline = map.addPolyline(
                PolylineOptions().addAll(upLatLngs).width(POLYLINE_WIDTH).color(Color.parseColor(COLOR_UP))
                    .jointType(JointType.ROUND).startCap(RoundCap()).endCap(RoundCap())
            )
        }

        if (downLatLngs.isNotEmpty()) {
            downRoutePolyline = map.addPolyline(
                PolylineOptions().addAll(downLatLngs).width(POLYLINE_WIDTH).color(Color.parseColor(COLOR_DOWN))
                    .jointType(JointType.ROUND).startCap(RoundCap()).endCap(RoundCap())
            )
        }

        fitCameraBounds(map, upLatLngs, downLatLngs, data.bbox)
    }

    fun clear() {
        upRoutePolyline?.remove()
        upRoutePolyline = null
        downRoutePolyline?.remove()
        downRoutePolyline = null
    }

    private fun fitCameraBounds(
        map: GoogleMap, upLatLngs: List<LatLng>, downLatLngs: List<LatLng>, bbox: List<Double>?
    ) {
        if (bbox != null) {
            val bounds = LatLngBounds(
                LatLng(bbox[1], bbox[0]), LatLng(bbox[3], bbox[2])
            )
            map.setLatLngBoundsForCameraTarget(bounds)
            try {
                map.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, CAMERA_PADDING))
            } catch (e: Exception) {
                Timber.e(e, "Error fitting bounds")
            }
            return
        }

        val allLatLngs = upLatLngs + downLatLngs
        if (allLatLngs.isEmpty()) return

        try {
            val boundsBuilder = LatLngBounds.Builder()
            allLatLngs.forEach { boundsBuilder.include(it) }
            val bounds = boundsBuilder.build()
            map.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, CAMERA_PADDING))
            map.setLatLngBoundsForCameraTarget(bounds)
        } catch (e: Exception) {
            Timber.e(e, "Error fitting bounds fallback")
        }
    }
}
