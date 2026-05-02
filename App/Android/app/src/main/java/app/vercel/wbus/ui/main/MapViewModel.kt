package app.vercel.wbus.ui.main

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.model.BusItem
import app.vercel.wbus.data.model.BusSchedule
import app.vercel.wbus.data.model.BusStop
import app.vercel.wbus.data.model.RouteMapData
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.data.repository.StaticDataRepository
import app.vercel.wbus.domain.service.PolylineData
import kotlinx.coroutines.*
import timber.log.Timber

/**
 * ViewModel for the main map screen
 */
class MapViewModel(
    private val busRepository: BusRepository, private val staticDataRepository: StaticDataRepository
) : ViewModel() {

    companion object {
        // Polling configuration
        private const val BUS_POLL_INTERVAL_MS = 3000L
        private const val ERROR_RETRY_DELAY_MS = 5000L
    }

    private val _buses = MutableLiveData<Result<List<BusItem>>>()
    val buses: LiveData<Result<List<BusItem>>> = _buses

    private val _busStops = MutableLiveData<Result<List<BusStop>>>()
    val busStops: LiveData<Result<List<BusStop>>> = _busStops

    private val _polyline = MutableLiveData<Result<PolylineData>>()
    val polyline: LiveData<Result<PolylineData>> = _polyline

    private val _routeMap = MutableLiveData<Result<RouteMapData>>()
    val routeMap: LiveData<Result<RouteMapData>> = _routeMap

    private val _selectedRouteId = MutableLiveData<String?>()
    val selectedRouteId: LiveData<String?> = _selectedRouteId

    private val _selectedRouteName = MutableLiveData<String?>()
    val selectedRouteName: LiveData<String?> = _selectedRouteName

    private val _busSchedule = MutableLiveData<Result<BusSchedule>>()
    val busSchedule: LiveData<Result<BusSchedule>> = _busSchedule

    private var directionLookup: app.vercel.wbus.domain.service.DirectionLookup? = null
    private var polylineData: PolylineData? = null
    private var activePollingRouteIds: List<String> = emptyList()

    private var pollingJob: Job? = null

    /**
     * Set the active route and start polling for bus data
     */
    fun setRoute(routeId: String, routeName: String? = null, routeIds: List<String>? = null) {
        val pollingRouteIds = normalizeRouteIds(routeIds, routeId)
        val isSameSelection =
            _selectedRouteId.value == routeId && _selectedRouteName.value == routeName && activePollingRouteIds == pollingRouteIds
        if (isSameSelection) return

        _selectedRouteId.value = routeId
        _selectedRouteName.value = routeName
        activePollingRouteIds = pollingRouteIds
        Timber.d("Route changed to: $routeId ($routeName)")

        // Cancel existing polling
        pollingJob?.cancel()
        directionLookup = null
        polylineData = null

        // Clear current data when route changes
        _buses.value = Result.success(emptyList())
        _busSchedule.value = Result.loading() // Reset schedule to loading state

        // Load bus stops (cached, only once)
        loadBusStops(routeId)

        // Load polyline (cached, only once)
        loadPolyline(routeId)

        // Load schedule if routeName is provided
        routeName?.let { loadSchedule(it) }

        // Start polling for bus locations
        startBusLocationPolling(pollingRouteIds)

        if (routeIds == null && routeName != null) {
            resolvePollingRouteIds(routeName, routeId)
        }
    }

    /**
     * Load bus stops for the route
     */
    private fun loadBusStops(routeId: String) {
        viewModelScope.launch {
            _busStops.value = Result.loading()
            val result = busRepository.getBusStops(routeId)
            _busStops.value = result

            if (result is Result.Success) {
                // Build direction lookup when stops and sequence are available
                val sequence = result.data.map {
                    app.vercel.wbus.data.model.SequenceItem(it.nodeord ?: 0, it.nodeid, it.updowncd ?: 0)
                }
                val routeSequence = app.vercel.wbus.domain.service.RouteSequenceData(routeId, sequence)
                directionLookup =
                    app.vercel.wbus.domain.service.DirectionService.buildLookup(listOf(routeSequence), listOf(routeId))
            }
        }
    }

    /**
     * Load polyline for the route
     */
    private fun loadPolyline(routeId: String) {
        viewModelScope.launch {
            _polyline.value = Result.loading()
            val result = staticDataRepository.getPolyline(routeId)
            if (result is Result.Success) {
                val processed = app.vercel.wbus.domain.service.PolylineService.processPolyline(result.data)
                polylineData = processed
                _polyline.value = Result.success(processed)
            } else if (result is Result.Error) {
                _polyline.value = Result.error(result.exception)
            }
        }
    }

    /**
     * Load schedule for the route
     */
    private fun loadSchedule(routeName: String) {
        viewModelScope.launch {
            // Filter routeName to keep only numbers and hyphens (e.g., "30-1번" -> "30-1")
            val cleanRouteName = routeName.filter { it.isDigit() || it == '-' }
            if (cleanRouteName.isEmpty()) {
                _busSchedule.value = Result.error(Exception("Invalid route name for schedule"))
                return@launch
            }

            _busSchedule.value = Result.loading()
            Timber.d("Loading schedule for: $cleanRouteName (original: $routeName)")
            _busSchedule.value = staticDataRepository.getSchedule(cleanRouteName)
        }
    }

    /**
     * Load route map (for route name to ID mapping)
     */
    fun loadRouteMap() {
        viewModelScope.launch {
            _routeMap.value = Result.loading()
            _routeMap.value = staticDataRepository.getRouteMap()
        }
    }

    /**
     * Start polling for real-time bus locations
     */
    private fun startBusLocationPolling(routeIds: List<String>) {
        pollingJob = viewModelScope.launch {
            while (isActive) {
                try {
                    val result = fetchBusLocations(routeIds)

                    if (result is Result.Success) {
                        val snappedBuses = snapBuses(result.data)
                        _buses.value = Result.success(snappedBuses)
                    } else {
                        _buses.value = result
                    }

                    // Poll every 3 seconds
                    delay(BUS_POLL_INTERVAL_MS)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Timber.e(e, "Error in polling loop")
                    _buses.value = Result.error(e)
                    delay(ERROR_RETRY_DELAY_MS)  // Wait longer on error
                }
            }
        }
    }

    /**
     * Snap bus GPS coordinates to the route polyline and sort by proximity
     */
    private fun snapBuses(buses: List<BusItem>): List<BusItem> {
        val poly = polylineData ?: return buses
        val previousBuses = (_buses.value as? Result.Success)?.data?.associateBy { it.vehicleno } ?: emptyMap()

        return buses.map { bus ->
            val prevBus = previousBuses[bus.vehicleno]
            val snapResult = app.vercel.wbus.domain.service.SnapService.getSnappedPosition(
                bus,
                directionLookup,
                poly.upPolyline,
                poly.downPolyline,
                poly.turnIndex,
                poly.isSwapped,
                previousSegmentIndex = prevBus?.segmentIndex
            )

            val currentProgress = (snapResult.segmentIndex?.toDouble() ?: 0.0) + snapResult.t
            val prevProgress = prevBus?.progress ?: 0.0

            // Ensure monotonic movement: if new progress is less than previous, stay at previous position
            // unless it's a large jump (e.g., > 10 segments) suggesting a route restart or major correction
            val isRestart = prevBus != null && (prevProgress - currentProgress) > 20.0
            val shouldApplyMonotonic = prevBus != null && currentProgress < prevProgress && !isRestart

            if (shouldApplyMonotonic && prevBus != null) {
                bus.copy(
                    gpslati = prevBus.gpslati,
                    gpslong = prevBus.gpslong,
                    bearing = prevBus.bearing,
                    direction = snapResult.direction,
                    segmentIndex = prevBus.segmentIndex,
                    progress = prevBus.progress
                )
            } else {
                bus.copy(
                    gpslati = snapResult.position.latitude,
                    gpslong = snapResult.position.longitude,
                    bearing = snapResult.angle,
                    direction = snapResult.direction,
                    segmentIndex = snapResult.segmentIndex,
                    progress = currentProgress
                )
            }
        }
    }

    /**
     * Stop polling when ViewModel is cleared
     */
    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
        Timber.d("MapViewModel cleared, polling stopped")
    }

    /**
     * Manually refresh bus data
     */
    fun refresh() {
        val routeIds = if (activePollingRouteIds.isNotEmpty()) {
            activePollingRouteIds
        } else {
            _selectedRouteId.value?.let { listOf(it) } ?: emptyList()
        }
        if (routeIds.isNotEmpty()) {
            viewModelScope.launch {
                _buses.value = Result.loading()
                val result = fetchBusLocations(routeIds)
                _buses.value = if (result is Result.Success) {
                    Result.success(snapBuses(result.data))
                } else {
                    result
                }
            }
        }
        _selectedRouteName.value?.let { loadSchedule(it) }
    }

    private fun normalizeRouteIds(routeIds: List<String>?, fallbackRouteId: String): List<String> {
        return (routeIds ?: listOf(fallbackRouteId)).filter { it.isNotBlank() }.distinct().ifEmpty {
            listOf(fallbackRouteId)
        }
    }

    private fun resolvePollingRouteIds(routeName: String, fallbackRouteId: String) {
        viewModelScope.launch {
            when (val result = staticDataRepository.getRouteIds(routeName)) {
                is Result.Success -> {
                    val resolvedIds = normalizeRouteIds(result.data, fallbackRouteId)
                    if (resolvedIds != activePollingRouteIds) {
                        activePollingRouteIds = resolvedIds
                        pollingJob?.cancel()
                        startBusLocationPolling(resolvedIds)
                        Timber.d("Updated polling route IDs for $routeName: ${resolvedIds.joinToString()}")
                    }
                }

                is Result.Error -> {
                    Timber.w(result.exception, "Failed to resolve route IDs for polling: $routeName")
                }

                is Result.Loading -> {}
            }
        }
    }

    private suspend fun fetchBusLocations(routeIds: List<String>): Result<List<BusItem>> = coroutineScope {
        val results = routeIds.map { routeId ->
            async { busRepository.getBusLocations(routeId) }
        }.awaitAll()

        val buses = mutableListOf<BusItem>()
        var firstError: Result.Error? = null

        results.forEach { result ->
            when (result) {
                is Result.Success -> buses.addAll(result.data)
                is Result.Error -> if (firstError == null) firstError = result
                is Result.Loading -> {}
            }
        }

        val errorResult = firstError
        when {
            buses.isNotEmpty() -> Result.success(buses.distinctBy { it.vehicleno })
            errorResult != null -> errorResult
            else -> Result.success(emptyList())
        }
    }
}
