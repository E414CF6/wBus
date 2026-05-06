package app.vercel.wbus.ui.main

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.livedata.observeAsState
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import app.vercel.wbus.R
import app.vercel.wbus.data.api.ApiClient
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.local.PreferencesManager
import app.vercel.wbus.data.model.Direction
import app.vercel.wbus.data.model.RouteMapData
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.data.repository.StaticDataRepository
import app.vercel.wbus.databinding.ActivityMainBinding
import app.vercel.wbus.ui.main.map.*
import app.vercel.wbus.ui.widget.WBusHomeWidgetProvider
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.CancellationException
import timber.log.Timber
import java.net.UnknownHostException

class MainActivity : AppCompatActivity(), OnMapReadyCallback {
    companion object {
        private const val DEFAULT_ZOOM = 13f
        private const val BUS_FOCUS_ZOOM = 15f
        private const val MAP_BOTTOM_PADDING = 400

        private const val COLOR_UP = "#FF5252"
        private const val COLOR_DOWN = "#448AFF"
    }

    private lateinit var binding: ActivityMainBinding
    private lateinit var viewModel: MapViewModel
    private lateinit var prefsManager: PreferencesManager
    private lateinit var markerIconFactory: MapMarkerIconFactory
    private lateinit var busMarkerController: BusMarkerController
    private lateinit var stopMarkerController: StopMarkerController
    private lateinit var routePolylineController: RoutePolylineController

    private var googleMap: GoogleMap? = null
    private var systemBarsBottomInset: Int = 0
    private val defaultLocation = LatLng(37.2636, 127.0286)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.root.setOnApplyWindowInsetsListener { _, insets ->
            systemBarsBottomInset = insets.getInsets(android.view.WindowInsets.Type.systemBars()).bottom
            googleMap?.setPadding(0, 0, 0, systemBarsBottomInset + MAP_BOTTOM_PADDING)
            insets
        }

        prefsManager = PreferencesManager(this)
        markerIconFactory = MapMarkerIconFactory(this)
        busMarkerController = BusMarkerController(lifecycleScope, markerIconFactory)
        stopMarkerController = StopMarkerController { markerIconFactory.getStopMarkerIcon() }
        routePolylineController = RoutePolylineController()

        val busRepository = BusRepository(ApiClient.wbusApiService)
        val staticDataRepository = StaticDataRepository(ApiClient.storageService)
        viewModel = ViewModelProvider(
            this, MapViewModelFactory(busRepository, staticDataRepository)
        )[MapViewModel::class.java]

        setupComposeUI()
        setupMap()
        setupObservers()

        val routeId = prefsManager.getSelectedRouteId() ?: prefsManager.getDefaultRouteId()
        val routeName = prefsManager.getSelectedRouteName()
        viewModel.setRoute(routeId, routeName)
        WBusHomeWidgetProvider.updateAllWidgets(this)
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(defaultLocation, DEFAULT_ZOOM))
        MapStyleApplier.apply(this, map)
        map.setPadding(0, 0, 0, systemBarsBottomInset + MAP_BOTTOM_PADDING)
        configureMapUi(map)
        renderExistingData(map)
        setupMapInteractions(map)
        stopMarkerController.onZoomChanged(map.cameraPosition.zoom)
    }

    private fun setupMap() {
        val mapFragment = supportFragmentManager.findFragmentById(R.id.map) as? SupportMapFragment
        if (mapFragment == null) {
            Timber.e("Map fragment is missing or has an unexpected type")
            Toast.makeText(this, R.string.error_loading_buses, Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        mapFragment.getMapAsync(this)
    }

    private fun setupComposeUI() {
        binding.composeView.setContent {
            app.vercel.wbus.ui.theme.WBusTheme {
                val routeName = viewModel.selectedRouteName.observeAsState().value ?: "노선 선택"
                val buses = when (val result = viewModel.buses.observeAsState().value) {
                    is Result.Success -> result.data
                    else -> emptyList()
                }
                val schedule = when (val result = viewModel.busSchedule.observeAsState().value) {
                    is Result.Success -> result.data
                    else -> null
                }

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
                    onRouteClick = { viewModel.loadRouteMap() },
                    onRefresh = { viewModel.refresh() })
            }
        }
    }

    private fun setupObservers() {
        viewModel.selectedRouteId.observe(this) {
            clearMapOverlays()
        }

        viewModel.buses.observe(this) { result ->
            binding.progressBar.visibility = if (result is Result.Loading) View.VISIBLE else View.GONE
            when (result) {
                is Result.Success -> googleMap?.let { busMarkerController.render(it, result.data) }
                is Result.Error -> {
                    if (result.exception is CancellationException) {
                        Timber.d("Bus loading cancelled")
                    } else {
                        Timber.e(result.exception, "Error loading buses")
                        Toast.makeText(
                            this, getErrorMessageRes(result.exception, R.string.error_loading_buses), Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                is Result.Loading -> Unit
            }
        }

        viewModel.busStops.observe(this) { result ->
            when (result) {
                is Result.Success -> googleMap?.let {
                    stopMarkerController.render(it, result.data, it.cameraPosition.zoom)
                }

                is Result.Error -> Timber.e(result.exception, "Error loading stops")
                is Result.Loading -> Unit
            }
        }

        viewModel.polyline.observe(this) { result ->
            when (result) {
                is Result.Success -> googleMap?.let { routePolylineController.render(it, result.data) }
                is Result.Error -> Timber.e(result.exception, "Error loading polyline")
                is Result.Loading -> Unit
            }
        }

        viewModel.routeMap.observe(this) { result ->
            binding.progressBar.visibility = if (result is Result.Loading) View.VISIBLE else View.GONE
            when (result) {
                is Result.Success -> showRouteSelectionDialog(result.data)
                is Result.Error -> Toast.makeText(
                    this, getErrorMessageRes(result.exception, R.string.error_loading_routes), Toast.LENGTH_SHORT
                ).show()

                is Result.Loading -> Unit
            }
        }
    }

    private fun getErrorMessageRes(exception: Throwable, defaultRes: Int): Int {
        var current: Throwable? = exception
        while (current != null) {
            if (current is UnknownHostException) return R.string.error_network_unavailable
            current = current.cause
        }
        return defaultRes
    }

    private fun configureMapUi(map: GoogleMap) {
        map.uiSettings.apply {
            isZoomControlsEnabled = false
            isCompassEnabled = false
            isMyLocationButtonEnabled = false
            isMapToolbarEnabled = false
        }
        map.isBuildingsEnabled = false
        map.isIndoorEnabled = false
    }

    private fun renderExistingData(map: GoogleMap) {
        viewModel.busStops.value?.let {
            if (it is Result.Success) {
                stopMarkerController.render(map, it.data, map.cameraPosition.zoom)
            }
        }
        viewModel.polyline.value?.let { if (it is Result.Success) routePolylineController.render(map, it.data) }
        viewModel.buses.value?.let { if (it is Result.Success) busMarkerController.render(map, it.data) }
    }

    private fun setupMapInteractions(map: GoogleMap) {
        map.setInfoWindowAdapter(object : GoogleMap.InfoWindowAdapter {
            override fun getInfoWindow(marker: com.google.android.gms.maps.model.Marker): View? = null

            override fun getInfoContents(marker: com.google.android.gms.maps.model.Marker): View? {
                val busInfo = busMarkerController.infoForMarker(marker) ?: return null
                return createBusInfoWindow(busInfo.routeName, busInfo.plateNumber, busInfo.direction)
            }
        })

        map.setOnMarkerClickListener { marker ->
            if (busMarkerController.infoForMarker(marker) != null) {
                marker.showInfoWindow()
                return@setOnMarkerClickListener false
            }

            val stop = stopMarkerController.findStopByMarker(marker)
            if (stop != null) {
                val dialog = StopArrivalDialog(stop.nodeid, stop.nodenm) { arrival ->
                    prefsManager.setSelectedRouteId(arrival.routeid)
                    prefsManager.setSelectedRouteName(arrival.routeno)
                    viewModel.setRoute(arrival.routeid, arrival.routeno)
                    WBusHomeWidgetProvider.updateAllWidgets(this)
                }
                dialog.show(supportFragmentManager, "StopArrivalDialog")
                return@setOnMarkerClickListener true
            }
            false
        }

        map.setOnCameraIdleListener {
            stopMarkerController.onZoomChanged(map.cameraPosition.zoom)
        }
    }

    private fun createBusInfoWindow(routeName: String, plateNumber: String, direction: Int?): View {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpToPx(10f), dpToPx(8f), dpToPx(10f), dpToPx(8f))
        }

        val title = TextView(this).apply {
            text = "${routeName}번 버스"
            setTextColor(Color.BLACK)
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
        }

        val directionView = TextView(this).apply {
            text = "방향: ${directionLabel(direction)}"
            setTextColor(
                when (direction) {
                    Direction.UP -> Color.parseColor(COLOR_UP)
                    Direction.DOWN -> Color.parseColor(COLOR_DOWN)
                    else -> Color.DKGRAY
                }
            )
            textSize = 13f
        }

        val plate = TextView(this).apply {
            text = "번호판: $plateNumber"
            setTextColor(Color.DKGRAY)
            textSize = 13f
        }

        container.addView(title)
        container.addView(directionView)
        container.addView(plate)
        return container
    }

    private fun clearMapOverlays() {
        busMarkerController.clear()
        stopMarkerController.clear()
        routePolylineController.clear()
    }

    private fun showRouteSelectionDialog(routeMapData: RouteMapData) {
        val routeItems = routeMapData.route_numbers.map { (name, ids) -> RouteItem.fromRouteMap(name, ids) }
        val sortedRoutes = RouteItem.sortRoutes(routeItems)
        val currentRouteName = viewModel.selectedRouteName.value ?: ""

        val dialog = RouteSelectionDialog(sortedRoutes, currentRouteName) { selectedRoute ->
            val routeId = selectedRoute.primaryRouteId
            val routeName = selectedRoute.routeNumber
            if (routeId.isNotEmpty()) {
                prefsManager.setSelectedRouteId(routeId)
                prefsManager.setSelectedRouteName(routeName)
                viewModel.setRoute(routeId, routeName, selectedRoute.routeIds)
                WBusHomeWidgetProvider.updateAllWidgets(this)
            }
        }
        dialog.show(supportFragmentManager, "RouteSelectionDialog")
    }

    private fun directionLabel(direction: Int?): String {
        return when (direction) {
            Direction.UP -> "상행"
            Direction.DOWN -> "하행"
            else -> "순환"
        }
    }

    private fun dpToPx(dp: Float): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }

    override fun onPause() {
        super.onPause()
        busMarkerController.pause()
    }

    override fun onResume() {
        super.onResume()
        busMarkerController.resume()
    }

    override fun onDestroy() {
        super.onDestroy()
        busMarkerController.release()
        stopMarkerController.clear()
        routePolylineController.clear()
        googleMap = null
    }
}
