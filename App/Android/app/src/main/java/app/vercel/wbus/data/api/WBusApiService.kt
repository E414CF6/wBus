package app.vercel.wbus.data.api

import app.vercel.wbus.data.model.BusArrivalsResponse
import app.vercel.wbus.data.model.BusLocationResponse
import app.vercel.wbus.data.model.BusStopsResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * Retrofit service interface for WBus API
 * Base URL: https://wbus.vercel.app/api/
 */
interface WBusApiService {

    /**
     * Get real-time bus locations for a specific route
     * @param routeId The vehicle route ID
     * @return Response wrapper containing list of buses with GPS locations
     */
    @GET("bus/{routeId}")
    suspend fun getBusLocations(
        @Path("routeId") routeId: String
    ): Response<BusLocationResponse>

    /**
     * Get bus arrival predictions for a specific bus stop
     * @param busStopId The node ID of the bus stop
     * @return List of arrival predictions
     */
    @GET("bus-arrival/{busStopId}")
    suspend fun getBusArrivals(
        @Path("busStopId") busStopId: String
    ): Response<BusArrivalsResponse>

    /**
     * Get all bus stops on a specific route
     * @param routeId The vehicle route ID
     * @return List of bus stops on the route
     */
    @GET("bus-stops/{routeId}")
    suspend fun getBusStops(
        @Path("routeId") routeId: String
    ): Response<BusStopsResponse>
}
