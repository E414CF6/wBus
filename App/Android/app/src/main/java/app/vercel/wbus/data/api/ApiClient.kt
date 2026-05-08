package app.vercel.wbus.data.api

import app.vercel.wbus.BuildConfig
import app.vercel.wbus.data.api.adapter.RouteNoJsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Factory object for creating API service instances
 */
object ApiClient {

    private const val VERCEL_STORAGE_BASE_URL = "https://gh6egrivvvefdyon.public.blob.vercel-storage.com/"
    private const val TIMEOUT_SECONDS = 30L

    /**
     * Create Moshi JSON converter
     */
    private val moshi: Moshi by lazy {
        Moshi.Builder().add(RouteNoJsonAdapter()).add(KotlinJsonAdapterFactory()).build()
    }

    /**
     * Create OkHttp client with logging and timeout configuration
     */
    private val okHttpClient: OkHttpClient by lazy {
        val builder = OkHttpClient.Builder().connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS).writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)

        // Add logging in debug builds
        if (BuildConfig.DEBUG) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
            builder.addInterceptor(logging)
        }

        builder.build()
    }

    /**
     * Create Retrofit instance for WBus API
     */
    private val wbusRetrofit: Retrofit by lazy {
        Retrofit.Builder().baseUrl(BuildConfig.API_BASE_URL).client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi)).build()
    }

    /**
     * Create Retrofit instance for Vercel Storage (static data)
     */
    private val storageRetrofit: Retrofit by lazy {
        Retrofit.Builder().baseUrl(VERCEL_STORAGE_BASE_URL).client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi)).build()
    }

    /**
     * Get the WBus API service instance (for real-time data)
     */
    val wbusApiService: WBusApiService by lazy {
        wbusRetrofit.create(WBusApiService::class.java)
    }

    /**
     * Get the Vercel Storage service instance (for static data)
     */
    val storageService: VercelStorageService by lazy {
        storageRetrofit.create(VercelStorageService::class.java)
    }
}
