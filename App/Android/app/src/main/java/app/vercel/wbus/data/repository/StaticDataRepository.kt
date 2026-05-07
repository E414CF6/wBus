package app.vercel.wbus.data.repository

import app.vercel.wbus.data.api.VercelStorageService
import app.vercel.wbus.data.cache.CacheManager
import app.vercel.wbus.data.common.Result
import app.vercel.wbus.data.model.BusSchedule
import app.vercel.wbus.data.model.GeoPolyline
import app.vercel.wbus.data.model.RouteMapData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber

/**
 * Repository for static data (routes, stations, polylines, schedules)
 * Data is fetched from Vercel Storage and cached locally
 */
class StaticDataRepository(
    private val storageService: VercelStorageService
) {

    private val cache = CacheManager()

    /**
     * Get route map data (route names to IDs mapping)
     * Cached for 24 hours
     */
    suspend fun getRouteMap(): Result<RouteMapData> = withContext(Dispatchers.IO) {
        val cacheKey = "route_map"

        // Check cache first
        cache.get<RouteMapData>(cacheKey)?.let {
            Timber.d("RouteMap loaded from cache")
            return@withContext Result.success(it)
        }

        // Fetch from network
        try {
            val response = storageService.getRouteMap()
            if (response.isSuccessful) {
                val data = response.body()
                if (data != null) {
                    cache.put(cacheKey, data, CacheManager.TTL_24_HOURS)
                    Timber.d("RouteMap fetched from network")
                    Result.success(data)
                } else {
                    Timber.e("Successful response but null body for route map")
                    Result.error(Exception("Empty response body"))
                }
            } else {
                Timber.e("Failed to fetch route map: ${response.code()}")
                Result.error(Exception("HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error fetching route map")
            Result.error(e)
        }
    }

    /**
     * Get GeoJSON polyline for a route
     * Cached for 1 week (polylines rarely change)
     */
    suspend fun getPolyline(routeId: String): Result<GeoPolyline> = withContext(Dispatchers.IO) {
        val cacheKey = "polyline_$routeId"

        // Check cache first
        cache.get<GeoPolyline>(cacheKey)?.let {
            Timber.d("Polyline for route $routeId loaded from cache")
            return@withContext Result.success(it)
        }

        // Fetch from network
        try {
            val response = storageService.getPolyline(routeId)
            if (response.isSuccessful) {
                val data = response.body()
                if (data != null) {
                    cache.put(cacheKey, data, CacheManager.TTL_1_WEEK)
                    Timber.d("Polyline for route $routeId fetched from network")
                    Result.success(data)
                } else {
                    Timber.e("Successful response but null body for polyline $routeId")
                    Result.error(Exception("Empty response body"))
                }
            } else {
                Timber.e("Failed to fetch polyline for $routeId: ${response.code()}")
                Result.error(Exception("HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error fetching polyline for $routeId")
            Result.error(e)
        }
    }

    /**
     * Get schedule for a route by name
     * Cached for 24 hours
     */
    suspend fun getSchedule(routeName: String): Result<BusSchedule> = withContext(Dispatchers.IO) {
        val cacheKey = "schedule_$routeName"

        // Check cache first
        cache.get<BusSchedule>(cacheKey)?.let {
            Timber.d("Schedule for route $routeName loaded from cache")
            return@withContext Result.success(it)
        }

        // Fetch from network
        try {
            val response = storageService.getSchedule(routeName)
            if (response.isSuccessful) {
                val data = response.body()
                if (data != null) {
                    cache.put(cacheKey, data, CacheManager.TTL_24_HOURS)
                    Timber.d("Schedule for route $routeName fetched from network")
                    Result.success(data)
                } else {
                    Timber.e("Successful response but null body for schedule $routeName")
                    Result.error(Exception("Empty response body"))
                }
            } else {
                Timber.e("Failed to fetch schedule for $routeName: ${response.code()}")
                Result.error(Exception("HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Error fetching schedule for $routeName")
            Result.error(e)
        }
    }

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
