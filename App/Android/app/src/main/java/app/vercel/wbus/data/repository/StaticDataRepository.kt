package app.vercel.wbus.data.repository

import app.vercel.wbus.data.api.VercelStorageService
import app.vercel.wbus.data.cache.CacheManager
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.model.BusSchedule
import app.vercel.wbus.data.model.GeoPolyline
import app.vercel.wbus.data.model.RouteMapData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.Response
import timber.log.Timber

/**
 * Repository for static data (routes, stations, polylines, schedules)
 * Data is fetched from Vercel Storage and cached locally
 */
class StaticDataRepository(
    private val storageService: VercelStorageService, private val cache: CacheManager = CacheManager()
) {

    private suspend fun <T : Any> getOrFetch(
        cacheKey: String, ttlMillis: Long, logLabel: String, fetch: suspend () -> Response<T>
    ): Result<T> = withContext(Dispatchers.IO) {
        cache.get<T>(cacheKey)?.let {
            Timber.d("$logLabel loaded from cache")
            return@withContext Result.success(it)
        }

        try {
            val response = fetch()
            if (response.isSuccessful) {
                val data = response.body()
                if (data != null) {
                    cache.put(cacheKey, data, ttlMillis)
                    Timber.d("$logLabel fetched from network")
                    Result.success(data)
                } else {
                    Timber.e("Successful response but null body for $logLabel")
                    Result.error(Exception("Empty response body"))
                }
            } else {
                Timber.e("Failed to fetch $logLabel: ${response.code()} ${response.message()}")
                Result.error(Exception("HTTP ${response.code()}: ${response.message()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error fetching $logLabel")
            Result.error(e)
        }
    }

    /**
     * Get route map data (route names to IDs mapping)
     * Cached for 24 hours
     */
    suspend fun getRouteMap(): Result<RouteMapData> = getOrFetch(
        cacheKey = "route_map",
        ttlMillis = CacheManager.TTL_24_HOURS,
        logLabel = "route map",
        fetch = storageService::getRouteMap
    )

    /**
     * Get GeoJSON polyline for a route
     * Cached for 1 week (polylines rarely change)
     */
    suspend fun getPolyline(routeId: String): Result<GeoPolyline> = getOrFetch(
        cacheKey = "polyline_$routeId",
        ttlMillis = CacheManager.TTL_1_WEEK,
        logLabel = "polyline for route $routeId",
        fetch = { storageService.getPolyline(routeId) })

    /**
     * Get schedule for a route by name
     * Cached for 24 hours
     */
    suspend fun getSchedule(routeName: String): Result<BusSchedule> = getOrFetch(
        cacheKey = "schedule_$routeName",
        ttlMillis = CacheManager.TTL_24_HOURS,
        logLabel = "schedule for route $routeName",
        fetch = { storageService.getSchedule(routeName) })

    /**
     * Get available route IDs for a route name
     */
    suspend fun getRouteIds(routeName: String): Result<List<String>> {
        return when (val result = getRouteMap()) {
            is Result.Success -> {
                val ids = result.data.route_numbers[routeName] ?: emptyList()
                Result.success(ids)
            }

            is Result.Error -> result
            is Result.Loading -> Result.loading()
        }
    }

    /**
     * Clear all cached static data
     */
    fun clearCache() {
        cache.clear()
        Timber.d("Static data cache cleared")
    }
}
