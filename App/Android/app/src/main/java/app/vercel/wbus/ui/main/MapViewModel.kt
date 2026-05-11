package app.vercel.wbus.ui.main

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.vercel.wbus.BuildConfig
import app.vercel.wbus.data.api.ApiClient
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.model.*
import app.vercel.wbus.data.repository.BusRepository
import app.vercel.wbus.data.repository.StaticDataRepository
import app.vercel.wbus.domain.service.DirectionService
import app.vercel.wbus.domain.service.PolylineData
import app.vercel.wbus.domain.service.RouteSequenceData
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.*
import okhttp3.Call
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Request
import timber.log.Timber
import java.io.IOException

/**
 * ViewModel for the main map screen
 */
class MapViewModel(
    private val busRepository: BusRepository, private val staticDataRepository: StaticDataRepository
) : ViewModel() {

    companion object {
        private const val SSE_MAX_RUNTIME_MS = 60000L
        private const val SSE_RECONNECT_BUFFER_MS = 5000L
        private const val SSE_RECONNECT_DELAY_MS = 3000L
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
    private var routeSelectionVersion: Long = 0L

    private var pollingJob: Job? = null
    private var streamCall: Call? = null

    private val streamSnapshotAdapter by lazy {
        Moshi.Builder().add(KotlinJsonAdapterFactory()).build().adapter(BusStreamSnapshot::class.java)
    }

    private enum class StreamEndReason {
        PROACTIVE_RECONNECT, REMOTE_CLOSED
    }

    /**
     * Set the active route and start SSE stream for bus data
     */
    fun setRoute(routeId: String, routeName: String? = null, routeIds: List<String>? = null) {
        val pollingRouteIds = normalizeRouteIds(routeIds, routeId)
        val isSameSelection =
            _selectedRouteId.value == routeId && _selectedRouteName.value == routeName && activePollingRouteIds == pollingRouteIds
        if (isSameSelection) return

        val selectionVersion = ++routeSelectionVersion
        _selectedRouteId.value = routeId
        _selectedRouteName.value = routeName
        activePollingRouteIds = pollingRouteIds
        Timber.d("Route changed to: $routeId ($routeName)")

        // Cancel existing stream job
        pollingJob?.cancel()
        streamCall?.cancel()
        streamCall = null
        directionLookup = null
        polylineData = null

        // Clear current data when route changes
        _buses.value = Result.success(emptyList())
        _busSchedule.value = Result.loading() // Reset schedule to loading state

        // Load bus stops (cached, only once)
        loadBusStops(routeId, selectionVersion)

        // Build direction lookup for all route IDs to improve up/down resolution.
        loadDirectionLookup(pollingRouteIds, selectionVersion)

        // Load polyline (cached, only once)
        loadPolyline(routeId, selectionVersion)

        // Load schedule if routeName is provided
        routeName?.let { loadSchedule(it, selectionVersion) }

        // Start SSE stream for bus locations
        startBusLocationStreaming(pollingRouteIds, selectionVersion)

        if (routeIds == null && routeName != null) {
            resolvePollingRouteIds(routeName, routeId, selectionVersion)
        }
    }

    /**
     * Load bus stops for the route
     */
    private fun loadBusStops(routeId: String, expectedSelectionVersion: Long) {
        viewModelScope.launch {
            _busStops.value = Result.loading()
            val result = busRepository.getBusStops(routeId)
            if (expectedSelectionVersion != routeSelectionVersion) return@launch
            _busStops.value = result
        }
    }

    /**
     * Load polyline for the route
     */
    private fun loadPolyline(routeId: String, expectedSelectionVersion: Long) {
        viewModelScope.launch {
            _polyline.value = Result.loading()
            val result = staticDataRepository.getPolyline(routeId)
            if (expectedSelectionVersion != routeSelectionVersion) return@launch
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
    private fun loadSchedule(routeName: String, expectedSelectionVersion: Long = routeSelectionVersion) {
        viewModelScope.launch {
            // Filter routeName to keep only numbers and hyphens (e.g., "30-1번" -> "30-1")
            val cleanRouteName = routeName.filter { it.isDigit() || it == '-' }
            if (cleanRouteName.isEmpty()) {
                if (expectedSelectionVersion != routeSelectionVersion) return@launch
                _busSchedule.value = Result.error(Exception("Invalid route name for schedule"))
                return@launch
            }

            _busSchedule.value = Result.loading()
            Timber.d("Loading schedule for: $cleanRouteName (original: $routeName)")
            val result = staticDataRepository.getSchedule(cleanRouteName)
            if (expectedSelectionVersion != routeSelectionVersion) return@launch
            _busSchedule.value = result
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
     * Start SSE stream for real-time bus locations.
     * Falls back to one-shot polling when stream errors.
     */
    private fun startBusLocationStreaming(routeIds: List<String>, expectedSelectionVersion: Long) {
        pollingJob = viewModelScope.launch {
            while (isActive) {
                try {
                    if (expectedSelectionVersion != routeSelectionVersion) return@launch
                    when (val streamResult = consumeBusStream(routeIds, expectedSelectionVersion)) {
                        is Result.Success -> {
                            if (streamResult.data == StreamEndReason.REMOTE_CLOSED) {
                                delay(SSE_RECONNECT_DELAY_MS)
                            }
                        }

                        is Result.Error -> {
                            Timber.w(streamResult.exception, "SSE stream failed, switching to polling fallback")
                            val fallbackResult = fetchBusLocations(routeIds)
                            if (expectedSelectionVersion != routeSelectionVersion) return@launch
                            _buses.value = if (fallbackResult is Result.Success) {
                                Result.success(snapBuses(fallbackResult.data))
                            } else {
                                fallbackResult
                            }
                            delay(ERROR_RETRY_DELAY_MS)
                        }

                        is Result.Loading -> Unit
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Timber.e(e, "Error in bus stream loop")
                    _buses.value = Result.error(e)
                    delay(ERROR_RETRY_DELAY_MS)  // Wait longer on error
                }
            }
        }
    }

    private suspend fun consumeBusStream(
        routeIds: List<String>, expectedSelectionVersion: Long
    ): Result<StreamEndReason> = withContext(Dispatchers.IO) {
        val streamRequest = buildStreamRequest(routeIds)
            ?: return@withContext Result.error(IllegalStateException("Invalid API base URL"))
        val reconnectDeadline = System.currentTimeMillis() + (SSE_MAX_RUNTIME_MS - SSE_RECONNECT_BUFFER_MS)

        val stream = ApiClient.sseHttpClient.newCall(streamRequest)
        streamCall = stream

        try {
            stream.execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.error(
                        IOException("SSE HTTP ${response.code}: ${response.message}")
                    )
                }
                val body = response.body ?: return@withContext Result.error(IOException("SSE response body is empty"))
                val source = body.source()
                var eventName = "message"
                val dataBuffer = StringBuilder()

                while (currentCoroutineContext().isActive && expectedSelectionVersion == routeSelectionVersion) {
                    if (System.currentTimeMillis() >= reconnectDeadline) {
                        dispatchSseEvent(eventName, dataBuffer, expectedSelectionVersion)
                        return@withContext Result.success(StreamEndReason.PROACTIVE_RECONNECT)
                    }

                    val line = source.readUtf8Line() ?: break
                    if (line.isEmpty()) {
                        dispatchSseEvent(eventName, dataBuffer, expectedSelectionVersion)
                        eventName = "message"
                        dataBuffer.setLength(0)
                        continue
                    }

                    when {
                        line.startsWith("event:") -> {
                            eventName = line.substringAfter("event:").trim()
                        }

                        line.startsWith("data:") -> {
                            if (dataBuffer.isNotEmpty()) {
                                dataBuffer.append('\n')
                            }
                            dataBuffer.append(line.substringAfter("data:").trimStart())
                        }
                    }
                }

                dispatchSseEvent(eventName, dataBuffer, expectedSelectionVersion)
                Result.success(StreamEndReason.REMOTE_CLOSED)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Result.error(e)
        } finally {
            streamCall = null
        }
    }

    private fun buildStreamRequest(routeIds: List<String>): Request? {
        val baseUrl = BuildConfig.API_BASE_URL.toHttpUrlOrNull() ?: return null
        val streamUrl = baseUrl.newBuilder().addPathSegment("bus").addPathSegment("stream")
            .addQueryParameter("routeIds", routeIds.joinToString(",")).build()
        return Request.Builder().url(streamUrl).header("Accept", "text/event-stream").get().build()
    }

    private fun dispatchSseEvent(
        eventName: String, dataBuffer: StringBuilder, expectedSelectionVersion: Long
    ) {
        if (dataBuffer.isEmpty() || expectedSelectionVersion != routeSelectionVersion) {
            return
        }

        when (eventName) {
            "snapshot" -> {
                try {
                    val snapshot = streamSnapshotAdapter.fromJson(dataBuffer.toString())
                    if (snapshot == null) {
                        Timber.w("Received empty SSE snapshot payload")
                        return
                    }
                    val snappedBuses = snapBuses(snapshot.data)
                    _buses.postValue(Result.success(snappedBuses))
                } catch (e: Exception) {
                    Timber.e(e, "Failed to parse SSE snapshot")
                }
            }

            "error" -> {
                Timber.w("SSE stream reported error event: ${dataBuffer.toString()}")
            }

            else -> Unit // ready, ping, etc.
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
            val monotonicBase = prevBus?.takeIf { currentProgress < prevProgress && !isRestart }

            if (monotonicBase != null) {
                bus.copy(
                    gpslati = monotonicBase.gpslati,
                    gpslong = monotonicBase.gpslong,
                    bearing = monotonicBase.bearing,
                    direction = snapResult.direction,
                    segmentIndex = monotonicBase.segmentIndex,
                    progress = monotonicBase.progress
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
        streamCall?.cancel()
        streamCall = null
        Timber.d("MapViewModel cleared, bus stream stopped")
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

    private fun resolvePollingRouteIds(
        routeName: String, fallbackRouteId: String, expectedSelectionVersion: Long
    ) {
        viewModelScope.launch {
            when (val result = staticDataRepository.getRouteIds(routeName)) {
                is Result.Success -> {
                    if (expectedSelectionVersion != routeSelectionVersion) return@launch
                    val resolvedIds = normalizeRouteIds(result.data, fallbackRouteId)
                    if (resolvedIds != activePollingRouteIds) {
                        activePollingRouteIds = resolvedIds
                        pollingJob?.cancel()
                        streamCall?.cancel()
                        streamCall = null
                        startBusLocationStreaming(resolvedIds, expectedSelectionVersion)
                        loadDirectionLookup(resolvedIds, expectedSelectionVersion)
                        Timber.d("Updated streaming route IDs for $routeName: ${resolvedIds.joinToString()}")
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

    private fun loadDirectionLookup(routeIds: List<String>, expectedSelectionVersion: Long = routeSelectionVersion) {
        val orderedRouteIds = routeIds.filter { it.isNotBlank() }.distinct()
        if (orderedRouteIds.isEmpty()) {
            if (expectedSelectionVersion == routeSelectionVersion) {
                directionLookup = null
            }
            return
        }

        viewModelScope.launch {
            val routeSequences = coroutineScope {
                orderedRouteIds.map { routeId ->
                    async {
                        when (val result = busRepository.getBusStops(routeId)) {
                            is Result.Success -> {
                                val sequence = result.data.mapNotNull { stop ->
                                    val nodeOrder = stop.nodeord ?: return@mapNotNull null
                                    val upDownCode = stop.updowncd ?: return@mapNotNull null
                                    SequenceItem(
                                        nodeord = nodeOrder, nodeid = stop.nodeid, updowncd = upDownCode
                                    )
                                }
                                if (sequence.isNotEmpty()) RouteSequenceData(routeId, sequence) else null
                            }

                            is Result.Error -> {
                                Timber.w(result.exception, "Failed to load sequence for route: $routeId")
                                null
                            }

                            is Result.Loading -> null
                        }
                    }
                }.awaitAll().filterNotNull()
            }
            if (expectedSelectionVersion != routeSelectionVersion) return@launch

            if (routeSequences.isEmpty()) {
                directionLookup = null
                Timber.w("Direction lookup unavailable: no route sequence data loaded")
                return@launch
            }

            directionLookup = DirectionService.buildLookup(routeSequences, orderedRouteIds)
        }
    }
}
