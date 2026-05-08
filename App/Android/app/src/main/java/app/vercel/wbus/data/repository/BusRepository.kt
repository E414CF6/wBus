package app.vercel.wbus.data.repository

import app.vercel.wbus.data.api.WBusApiService
import app.vercel.wbus.data.cache.CacheManager
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.Response
import timber.log.Timber

/**
 * Repository for bus-related data operations
 */
class BusRepository(
    private val apiService: WBusApiService, private val cache: CacheManager = CacheManager()
) {

    companion object {
        private const val BUS_STOPS_CACHE_KEY_PREFIX = "bus_stops_"
    }

    /**
     * Helper function to reduce boilerplate error handling
     */
    private suspend fun <T> safeApiCall(
        apiCall: suspend () -> Response<T>, errorMessage: String
    ): Result<T> = withContext(Dispatchers.IO) {
        try {
            val response = apiCall()
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) {
                    Result.success(body)
                } else {
                    Timber.e("Successful response but null body: $errorMessage")
                    Result.error(Exception("Empty response body"))
                }
            } else {
                Timber.e("API error: ${response.code()} ${response.message()} - $errorMessage")
                Result.error(Exception("HTTP ${response.code()}: ${response.message()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, errorMessage)
            Result.error(e)
        }
    }

    /**
     * Fetch real-time bus locations for a route
     */
    suspend fun getBusLocations(routeId: String): Result<List<BusItem>> {
        return safeApiCall(
            apiCall = { apiService.getBusLocations(routeId) },
            errorMessage = "Error fetching bus locations for route $routeId"
        ).let { result ->
            when (result) {
                is Result.Success -> {
                    val buses = result.data.data
                    Timber.d("Fetched ${buses.size} buses for route $routeId")
                    Result.success(buses)
                }

                is Result.Error -> result
                is Result.Loading -> result
            }
        }
    }

    /**
     * Fetch bus stops on a route
     */
    suspend fun getBusStops(routeId: String): Result<List<BusStop>> {
        val cacheKey = "$BUS_STOPS_CACHE_KEY_PREFIX$routeId"
        cache.get<List<BusStop>>(cacheKey)?.let {
            Timber.d("Bus stops for route $routeId loaded from cache")
            return Result.success(it)
        }

        return safeApiCall(
            apiCall = { apiService.getBusStops(routeId) }, errorMessage = "Error fetching bus stops for route $routeId"
        ).let { result: Result<BusStopsResponse> ->
            when (result) {
                is Result.Success -> {
                    val stops = result.data.data
                    cache.put(cacheKey, stops, CacheManager.TTL_24_HOURS)
                    Timber.d("Fetched ${stops.size} stops for route $routeId")
                    Result.success(stops)
                }

                is Result.Error -> result
                is Result.Loading -> result
            }
        }
    }

    /**
     * Fetch bus arrival predictions for a stop
     */
    suspend fun getBusArrivals(busStopId: String): Result<List<BusStopArrival>> {
        return safeApiCall(
            apiCall = { apiService.getBusArrivals(busStopId) },
            errorMessage = "Error fetching arrivals for stop $busStopId"
        ).let { result: Result<BusArrivalsResponse> ->
            when (result) {
                is Result.Success -> Result.success(result.data.data)
                is Result.Error -> result
                is Result.Loading -> result
            }
        }
    }
}
