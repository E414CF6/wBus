package app.vercel.wbus.data.api

import app.vercel.wbus.data.model.BusSchedule
import app.vercel.wbus.data.model.GeoPolyline
import app.vercel.wbus.data.model.RouteMapData
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * Retrofit service interface for Vercel Storage static data
 * Base URL: https://gh6egrivvvefdyon.public.blob.vercel-storage.com/
 */
interface VercelStorageService {

    /**
     * Get route map data (route names to IDs mapping)
     */
    @GET("routeMap.json")
    suspend fun getRouteMap(): Response<RouteMapData>

    /**
     * Get GeoJSON polyline for a specific route
     * @param routeId The route ID (e.g., "WJB232000061")
     */
    @GET("polylines/{routeId}.geojson")
    suspend fun getPolyline(
        @Path("routeId") routeId: String
    ): Response<GeoPolyline>

    /**
     * Get schedule data for a route
     * @param routeName The route name (e.g., "30")
     */
    @GET("schedules/{routeName}.json")
    suspend fun getSchedule(
        @Path("routeName") routeName: String
    ): Response<BusSchedule>
}
