package app.vercel.wbus.ui.main

import android.graphics.*
import android.graphics.Bitmap.Config
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.livedata.observeAsState
import androidx.core.content.ContextCompat
import androidx.core.graphics.createBitmap
import androidx.core.graphics.toColorInt
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import app.vercel.wbus.R
import app.vercel.wbus.data.api.ApiClient
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.local.PreferencesManager
import app.vercel.wbus.data.model.BusStop
import app.vercel.wbus.data.model.Coordinate
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.data.repository.StaticDataRepository
import app.vercel.wbus.databinding.ActivityMainBinding
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.*
import kotlinx.coroutines.*
import timber.log.Timber

/**
 * Main activity showing the map with real-time bus locations
 */
class MainActivity : AppCompatActivity(), OnMapReadyCallback {

    companion object {
        // Map configuration constants
        private const val DEFAULT_ZOOM = 13f
        private const val BUS_FOCUS_ZOOM = 15f
        private const val CAMERA_PADDING = 100

        // Polyline configuration
        private const val POLYLINE_WIDTH = 12f
        private const val COLOR_UP = "#FF5252"   // Red for Up direction
        private const val COLOR_DOWN = "#448AFF" // Blue for Down direction

        // Animation configuration
        private const val MARKER_ANIMATION_DURATION = 2800L
        private const val MIN_ANIMATION_DISTANCE_METERS = 10.0

        // Marker configuration
        private const val STOP_MARKER_ALPHA = 0.7f
        private const val MARQUEE_INTERVAL_MS = 250L
    }

    private lateinit var binding: ActivityMainBinding
    private lateinit var viewModel: MapViewModel
    private lateinit var prefsManager: PreferencesManager
    private var googleMap: GoogleMap? = null
    private var upRoutePolyline: Polyline? = null
    private var downRoutePolyline: Polyline? = null
    private val busMarkers = mutableMapOf<String, Marker>()
    private val stopMarkers = mutableListOf<Marker>()
    private val activeAnimators = mutableMapOf<String, android.animation.ValueAnimator>()
    private val stopLookup = mutableMapOf<String, BusStop>()
    private val busRouteNames = mutableMapOf<String, String>()
    private val marqueeOffsets = mutableMapOf<String, Int>()
    private val busMarkerIconCache = mutableMapOf<String, BitmapDescriptor>()
    private var stopMarkerIcon: BitmapDescriptor? = null
    private var marqueeJob: Job? = null

    // Suwon city center coordinates
    private val defaultLocation = LatLng(37.2636, 127.0286)

    private data class BusMarkerInfo(
        val routeName: String, val plateNumber: String, val direction: Int?
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, 0)

            // Pad the map controls to be above the bottom sheet and below top bars
            googleMap?.setPadding(0, 0, 0, systemBars.bottom + 400) // Rough height of bottom sheet peek + FABs
            insets
        }

        // Initialize components
        prefsManager = PreferencesManager(this)
        val busRepository = BusRepository(ApiClient.wbusApiService)
        val staticDataRepository = StaticDataRepository(ApiClient.storageService)
        viewModel = ViewModelProvider(
            this, MapViewModelFactory(busRepository, staticDataRepository)
        )[MapViewModel::class.java]

        // Setup UI
        setupComposeUI()

        // Setup map
        val mapFragment = supportFragmentManager.findFragmentById(R.id.map) as? SupportMapFragment
        if (mapFragment == null) {
            Timber.e("Map fragment is missing or has an unexpected type")
            Toast.makeText(this, R.string.error_loading_buses, Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        mapFragment.getMapAsync(this)

        // Setup observers
        setupObservers()

        // Load saved route or default
        val routeId = prefsManager.getSelectedRouteId() ?: prefsManager.getDefaultRouteId()
        val routeName = prefsManager.getSelectedRouteName()
        viewModel.setRoute(routeId, routeName)
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map
        if (stopMarkerIcon == null) {
            stopMarkerIcon = getBitmapDescriptorFromVector(R.drawable.ic_bus_stop, 42, 42)
        }

        // Move camera to default location
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(defaultLocation, DEFAULT_ZOOM))

        // Apply map style based on system theme
        applyMapStyle(map)

        // Initial data check
        viewModel.busStops.value?.let {
            if (it is Result.Success) updateStopMarkers(it.data)
        }
        viewModel.polyline.value?.let {
            if (it is Result.Success) drawRoutePolyline(it.data)
        }
        viewModel.buses.value?.let {
            if (it is Result.Success) updateBusMarkers(it.data)
        }

        // Configure map
        map.uiSettings.apply {
            isZoomControlsEnabled = false
            isCompassEnabled = false
            isMyLocationButtonEnabled = false
            isMapToolbarEnabled = false
        }
        map.isBuildingsEnabled = false
        map.isIndoorEnabled = false

        map.setInfoWindowAdapter(object : GoogleMap.InfoWindowAdapter {
            override fun getInfoWindow(marker: Marker): View? = null

            override fun getInfoContents(marker: Marker): View? {
                val busInfo = marker.tag as? BusMarkerInfo ?: return null

                val container = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dpToPx(10f), dpToPx(8f), dpToPx(10f), dpToPx(8f))
                }

                val title = TextView(this@MainActivity).apply {
                    text = "${busInfo.routeName}번 버스"
                    setTextColor(Color.BLACK)
                    textSize = 15f
                    setTypeface(typeface, Typeface.BOLD)
                }

                val direction = TextView(this@MainActivity).apply {
                    text = "방향: ${directionLabel(busInfo.direction)}"
                    setTextColor(
                        when (busInfo.direction) {
                            1 -> Color.parseColor(COLOR_UP)
                            0 -> Color.parseColor(COLOR_DOWN)
                            else -> Color.DKGRAY
                        }
                    )
                    textSize = 13f
                }

                val plate = TextView(this@MainActivity).apply {
                    text = "번호판: ${busInfo.plateNumber}"
                    setTextColor(Color.DKGRAY)
                    textSize = 13f
                }

                container.addView(title)
                container.addView(direction)
                container.addView(plate)
                return container
            }
        })

        // Set marker click listener
        map.setOnMarkerClickListener { marker ->
            val bus = busMarkers.entries.find { it.value == marker }?.key
            if (bus != null) {
                marker.showInfoWindow()
                return@setOnMarkerClickListener false
            }

            // Check if it's a stop marker using O(1) HashMap lookup
            val stopNodeId = marker.tag as? String
            val stop = stopNodeId?.let { stopLookup[it] }

            if (stop != null) {
                val dialog = StopArrivalDialog(stop.nodeid, stop.nodenm) { arrival ->
                    prefsManager.setSelectedRouteId(arrival.routeid)
                    prefsManager.setSelectedRouteName(arrival.routeno)
                    viewModel.setRoute(arrival.routeid, arrival.routeno)
                }
                dialog.show(supportFragmentManager, "StopArrivalDialog")
                return@setOnMarkerClickListener true
            }

            false
        }
    }

    private fun applyMapStyle(map: GoogleMap) {
        val isDarkMode =
            (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES

        if (isDarkMode) {
            try {
                val success = map.setMapStyle(MapStyleOptions.loadRawResourceStyle(this, R.raw.map_style))
                if (!success) Timber.e("Style parsing failed.")
            } catch (e: Exception) {
                Timber.e(e, "Can't find style. Error: ")
            }
        } else {
            map.setMapStyle(null)
        }
    }

    private fun setupComposeUI() {
        binding.composeView.setContent {
            app.vercel.wbus.ui.theme.WBusTheme {
                val routeNameState = viewModel.selectedRouteName.observeAsState()
                val routeName = routeNameState.value ?: "노선 선택"

                val busesResultState = viewModel.buses.observeAsState()
                val busesResult = busesResultState.value
                val buses = if (busesResult is Result.Success<*>) {
                    @Suppress("UNCHECKED_CAST") busesResult.data as List<app.vercel.wbus.data.model.BusItem>
                } else {
                    emptyList()
                }

                val scheduleResultState = viewModel.busSchedule.observeAsState()
                val schedule = if (scheduleResultState.value is Result.Success) {
                    (scheduleResultState.value as Result.Success).data
                } else null

                app.vercel.wbus.ui.components.BusBottomSheet(
                    routeName = if (routeName != "노선 선택") "${routeName}번 버스" else routeName,
                    buses = buses,
                    schedule = schedule,
                    onBusClick = { bus ->
                        googleMap?.animateCamera(
                            CameraUpdateFactory.newLatLngZoom(
                                LatLng(bus.gpslati, bus.gpslong), BUS_FOCUS_ZOOM
                            )
                        )
                    },
                    onRouteClick = {
                        viewModel.loadRouteMap()
                    },
                    onRefresh = {
                        viewModel.refresh()
                    })
            }
        }
    }

    private fun setupObservers() {
        // Observe route selection changes to clear markers immediately
        viewModel.selectedRouteId.observe(this) {
            clearMapMarkers()
        }

        // Observe bus locations for markers
        viewModel.buses.observe(this) { result ->
            binding.progressBar.visibility = if (result is Result.Loading) View.VISIBLE else View.GONE
            when (result) {
                is Result.Success -> {
                    val buses = result.data
                    updateBusMarkers(buses)
                }

                is Result.Error -> {
                    if (result.exception is CancellationException) {
                        Timber.d("Bus loading cancelled")
                    } else {
                        Timber.e(result.exception, "Error loading buses")
                        Toast.makeText(this, R.string.error_loading_buses, Toast.LENGTH_SHORT).show()
                    }
                }

                else -> {}
            }
        }

        // Observe bus stops
        viewModel.busStops.observe(this) { result ->
            when (result) {
                is Result.Success -> {
                    stopLookup.clear()
                    result.data.forEach { stop ->
                        stopLookup[stop.nodeid] = stop
                    }
                    updateStopMarkers(result.data)
                }

                is Result.Error -> {
                    Timber.e(result.exception, "Error loading stops")
                }

                else -> {}
            }
        }

        // Observe polyline
        viewModel.polyline.observe(this) { result ->
            when (result) {
                is Result.Success -> {
                    drawRoutePolyline(result.data)
                }

                is Result.Error -> {
                    Timber.e(result.exception, "Error loading polyline")
                }

                else -> {}
            }
        }

        // Observe route map for selection dialog
        viewModel.routeMap.observe(this) { result ->
            binding.progressBar.visibility = if (result is Result.Loading) View.VISIBLE else View.GONE
            when (result) {
                is Result.Success -> {
                    showRouteSelectionDialog(result.data)
                }

                is Result.Error -> {
                    Toast.makeText(this, "노선 정보를 불러올 수 없습니다", Toast.LENGTH_SHORT).show()
                }

                else -> {}
            }
        }
    }

    private fun clearMapMarkers() {
        busMarkers.forEach { it.value.remove() }
        busMarkers.clear()
        busRouteNames.clear()
        marqueeOffsets.clear()
        stopMarkers.forEach { it.remove() }
        stopMarkers.clear()
        upRoutePolyline?.remove()
        upRoutePolyline = null
        downRoutePolyline?.remove()
        downRoutePolyline = null
        activeAnimators.values.forEach { it.cancel() }
        activeAnimators.clear()
    }

    private fun showRouteSelectionDialog(routeMapData: app.vercel.wbus.data.model.RouteMapData) {
        val routeItems = routeMapData.route_numbers.map { (name, ids) ->
            RouteItem.fromRouteMap(name, ids)
        }
        val sortedRoutes = RouteItem.sortRoutes(routeItems)

        val currentRouteName = viewModel.selectedRouteName.value ?: ""

        val dialog = RouteSelectionDialog(sortedRoutes, currentRouteName) { selectedRoute ->
            val routeId = selectedRoute.primaryRouteId
            val routeName = selectedRoute.routeNumber
            if (routeId.isNotEmpty()) {
                prefsManager.setSelectedRouteId(routeId)
                prefsManager.setSelectedRouteName(routeName)
                viewModel.setRoute(routeId, routeName, selectedRoute.routeIds)
            }
        }
        dialog.show(supportFragmentManager, "RouteSelectionDialog")
    }

    private fun drawRoutePolyline(data: app.vercel.wbus.domain.service.PolylineData) {
        googleMap?.let { map ->
            upRoutePolyline?.remove()
            downRoutePolyline?.remove()

            val upLatLngs = data.upPolyline.map { LatLng(it.latitude, it.longitude) }
            val downLatLngs = data.downPolyline.map { LatLng(it.latitude, it.longitude) }

            if (upLatLngs.isNotEmpty()) {
                val upOptions =
                    PolylineOptions().addAll(upLatLngs).width(POLYLINE_WIDTH).color(Color.parseColor(COLOR_UP))
                        .jointType(JointType.ROUND).startCap(RoundCap()).endCap(RoundCap())
                upRoutePolyline = map.addPolyline(upOptions)
            }

            if (downLatLngs.isNotEmpty()) {
                val downOptions =
                    PolylineOptions().addAll(downLatLngs).width(POLYLINE_WIDTH).color(Color.parseColor(COLOR_DOWN))
                        .jointType(JointType.ROUND).startCap(RoundCap()).endCap(RoundCap())
                downRoutePolyline = map.addPolyline(downOptions)
            }

            data.bbox?.let { bbox ->
                val minLng = bbox[0]
                val minLat = bbox[1]
                val maxLng = bbox[2]
                val maxLat = bbox[3]

                val bounds = LatLngBounds(
                    LatLng(minLat, minLng), LatLng(maxLat, maxLng)
                )

                map.setLatLngBoundsForCameraTarget(bounds)

                try {
                    map.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, CAMERA_PADDING))
                } catch (e: Exception) {
                    Timber.e(e, "Error fitting bounds")
                }
            } ?: run {
                val allLatLngs = upLatLngs + downLatLngs
                if (allLatLngs.isNotEmpty()) {
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
        }
    }

    private fun updateStopMarkers(stops: List<BusStop>) {
        googleMap?.let { map ->
            stopMarkers.forEach { it.remove() }
            stopMarkers.clear()

            stops.forEach { stop ->
                val position = LatLng(stop.gpslati, stop.gpslong)
                val marker = map.addMarker(
                    MarkerOptions().position(position).title(stop.nodenm).snippet(stop.nodeno).alpha(STOP_MARKER_ALPHA)
                        .icon(stopMarkerIcon ?: getBitmapDescriptorFromVector(R.drawable.ic_bus_stop, 42, 42))
                )
                marker?.let {
                    it.tag = stop.nodeid
                    stopMarkers.add(it)
                }
            }
        }
    }

    private fun updateBusMarkers(buses: List<app.vercel.wbus.data.model.BusItem>) {
        googleMap?.let { map ->
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
                val newPosition = LatLng(bus.gpslati, bus.gpslong)
                val marker = busMarkers[bus.vehicleno]
                val previousRoute = busRouteNames[bus.vehicleno]
                if (previousRoute != bus.routenm) {
                    marqueeOffsets[bus.vehicleno] = 0
                }
                busRouteNames[bus.vehicleno] = bus.routenm
                val routeText = getMarqueeText(bus.routenm, bus.vehicleno, advance = false)
                val icon = getBusMarkerIcon(routeText)

                if (marker != null) {
                    animateMarker(bus.vehicleno, marker, newPosition, bus.bearing)
                    marker.title = "${bus.routenm}번"
                    marker.snippet = bus.vehicleno
                    marker.tag = BusMarkerInfo(
                        routeName = bus.routenm, plateNumber = bus.vehicleno, direction = bus.direction
                    )
                    marker.setIcon(icon)
                    marker.isFlat = true
                } else {
                    val newMarker = map.addMarker(
                        MarkerOptions().position(newPosition).title("${bus.routenm}번").snippet(bus.vehicleno).icon(icon)
                            .flat(true).anchor(0.5f, 0.5f).rotation(bus.bearing.toFloat())
                    )
                    newMarker?.let {
                        it.tag = BusMarkerInfo(
                            routeName = bus.routenm, plateNumber = bus.vehicleno, direction = bus.direction
                        )
                        busMarkers[bus.vehicleno] = it
                    }
                }
            }
        }
    }

    private fun directionLabel(direction: Int?): String {
        return when (direction) {
            1 -> "상행"
            0 -> "하행"
            else -> "순환"
        }
    }

    private fun getBitmapDescriptorFromVector(id: Int, width: Int, height: Int): BitmapDescriptor? {
        val vectorDrawable = ContextCompat.getDrawable(this, id) ?: return null
        vectorDrawable.setBounds(0, 0, width, height)
        val bitmap = Bitmap.createBitmap(width, height, Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        vectorDrawable.draw(canvas)
        return BitmapDescriptorFactory.fromBitmap(bitmap)
    }

    private fun animateMarker(busId: String, marker: Marker, finalPosition: LatLng, finalBearing: Double) {
        val startPosition = marker.position
        val distance = app.vercel.wbus.util.geo.GeoUtils.getHaversineDistanceMeters(
            Coordinate(startPosition.latitude, startPosition.longitude),
            Coordinate(finalPosition.latitude, finalPosition.longitude)
        )

        if (distance < MIN_ANIMATION_DISTANCE_METERS) {
            marker.position = finalPosition
            marker.rotation = finalBearing.toFloat()
            return
        }

        // Cancel existing animation for this bus
        activeAnimators[busId]?.cancel()

        val startRotation = marker.rotation.toDouble()
        val valueAnimator = android.animation.ValueAnimator.ofFloat(0f, 1f)
        valueAnimator.duration = MARKER_ANIMATION_DURATION
        valueAnimator.interpolator = android.view.animation.LinearInterpolator()
        valueAnimator.addUpdateListener { animation ->
            val v = animation.animatedFraction.toDouble()
            val interpolated = app.vercel.wbus.util.geo.GeoUtils.interpolateLatLng(
                Coordinate(startPosition.latitude, startPosition.longitude),
                Coordinate(finalPosition.latitude, finalPosition.longitude),
                v
            )

            marker.takeIf { busMarkers.containsKey(busId) }?.let { safeMarker ->
                safeMarker.position = LatLng(interpolated.latitude, interpolated.longitude)
                val interpolatedRotation = app.vercel.wbus.util.geo.GeoUtils.interpolateAngle(
                    startRotation, finalBearing, v
                ).toFloat()
                safeMarker.rotation = interpolatedRotation
            }
        }
        activeAnimators[busId] = valueAnimator
        valueAnimator.start()
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

        val builder = StringBuilder(3)
        repeat(3) { i ->
            builder.append(source[(offset + i) % source.length])
        }
        return builder.toString()
    }

    private fun getBusMarkerIcon(routeText: String): BitmapDescriptor {
        return busMarkerIconCache.getOrPut(routeText) {
            // 캔버스 사이즈 (그림자가 잘리지 않도록 여백 포함)
            val width = dpToPx(44f)
            val height = dpToPx(56f)
            val bitmap = createBitmap(width, height)
            val canvas = Canvas(bitmap)

            // 사진과 유사한 메인 색상 (퍼플/블루 계열)
            val markerColor = "#5C4EE5".toColorInt()

            // 공통 그림자 설정
            val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.argb(60, 0, 0, 0)
                setShadowLayer(dpToPx(3f).toFloat(), 0f, dpToPx(2f).toFloat(), Color.argb(60, 0, 0, 0))
            }

            val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = markerColor
                style = Paint.Style.FILL
            }

            // Tail Shape
            val tailSize = dpToPx(24f).toFloat()
            val tailLeft = (width - tailSize) / 2f
            val tailTop = dpToPx(26f).toFloat() // 머리 부분과 자연스럽게 겹치도록 위치 조정
            val tailRect = RectF(tailLeft, tailTop, tailLeft + tailSize, tailTop + tailSize)
            val tailRadius = dpToPx(10f).toFloat()

            canvas.drawRoundRect(tailRect, tailRadius, tailRadius, shadowPaint)
            canvas.drawRoundRect(tailRect, tailRadius, tailRadius, fillPaint)

            // Head Shape
            val headSize = dpToPx(32f).toFloat()
            val headLeft = (width - headSize) / 2f
            val headTop = dpToPx(4f).toFloat() // Margin for shadow
            val headRect = RectF(headLeft, headTop, headLeft + headSize, headTop + headSize)
            val headRadius = dpToPx(12f).toFloat()

            canvas.drawRoundRect(headRect, headRadius, headRadius, shadowPaint)
            canvas.drawRoundRect(headRect, headRadius, headRadius, fillPaint)

            // Border paint for head
            val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                style = Paint.Style.STROKE
                strokeWidth = dpToPx(2.5f).toFloat()
            }
            canvas.drawRoundRect(headRect, headRadius, headRadius, borderPaint)

            // Text for bus route name
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                textAlign = Paint.Align.CENTER
                textSize = dpToPx(14f).toFloat()
                typeface = Typeface.DEFAULT_BOLD
            }

            val textY = headRect.centerY() - (textPaint.descent() + textPaint.ascent()) / 2
            canvas.drawText(routeText, headRect.centerX(), textY, textPaint)

            BitmapDescriptorFactory.fromBitmap(bitmap)
        }
    }

    private fun startMarqueeTicker() {
        marqueeJob?.cancel()
        marqueeJob = lifecycleScope.launch {
            while (isActive) {
                busMarkers.forEach { (busId, marker) ->
                    val routeName = busRouteNames[busId] ?: return@forEach
                    if (routeName.length > 3) {
                        val marqueeText = getMarqueeText(routeName, busId, advance = true)
                        marker.setIcon(getBusMarkerIcon(marqueeText))
                    }
                }
                delay(MARQUEE_INTERVAL_MS)
            }
        }
    }

    private fun dpToPx(dp: Float): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }

    override fun onPause() {
        super.onPause()
        activeAnimators.values.forEach { it.cancel() }
        activeAnimators.clear()
        marqueeJob?.cancel()
    }

    override fun onResume() {
        super.onResume()
        startMarqueeTicker()
    }

    override fun onDestroy() {
        super.onDestroy()
        marqueeJob?.cancel()
        activeAnimators.values.forEach { it.cancel() }
        activeAnimators.clear()
        busMarkers.clear()
        busRouteNames.clear()
        marqueeOffsets.clear()
        stopMarkers.clear()
        upRoutePolyline = null
        downRoutePolyline = null
        googleMap = null
    }
}
