package app.vercel.wbus.data.cache

import java.util.concurrent.ConcurrentHashMap

/**
 * Simple in-memory cache with TTL (Time To Live) support
 */
class CacheManager {

    private data class CacheEntry<T>(
        val data: T, val timestamp: Long, val ttlMillis: Long
    ) {
        fun isExpired(): Boolean = System.currentTimeMillis() - timestamp > ttlMillis
    }

    private val cache = ConcurrentHashMap<String, CacheEntry<*>>()

    /**
     * Store data in a cache with TTL
     * @param key Cache key
     * @param data Data to cache
     * @param ttlMillis Time to live in milliseconds
     */
    fun <T> put(key: String, data: T, ttlMillis: Long) {
        cache[key] = CacheEntry(data, System.currentTimeMillis(), ttlMillis)
        // Clean expired entries periodically to prevent memory leak
        if (cache.size % 10 == 0) {
            cleanExpired()
        }
    }

    /**
     * Get data from a cache
     * @param key Cache key
     * @return Cached data or null if not found or expired
     */
    @Suppress("UNCHECKED_CAST")
    fun <T> get(key: String): T? {
        val entry = cache[key] as? CacheEntry<T> ?: return null

        return if (entry.isExpired()) {
            cache.remove(key)
            null
        } else {
            entry.data
        }
    }

    /**
     * Check if a cache contains valid (non-expired) data for a key
     */
    fun contains(key: String): Boolean {
        val entry = cache[key] ?: return false
        return !entry.isExpired()
    }

    /**
     * Remove data from the cache
     */
    fun remove(key: String) {
        cache.remove(key)
    }

    /**
     * Clear all cached data
     */
    fun clear() {
        cache.clear()
    }

    /**
     * Remove expired entries from the cache
     */
    fun cleanExpired() {
        val expiredKeys = cache.entries.filter { it.value.isExpired() }.map { it.key }

        expiredKeys.forEach { cache.remove(it) }
    }

    companion object {
        // TTL constants
        const val TTL_5_MINUTES = 5 * 60 * 1000L
        const val TTL_1_HOUR = 60 * 60 * 1000L
        const val TTL_24_HOURS = 24 * 60 * 60 * 1000L
        const val TTL_1_WEEK = 7 * 24 * 60 * 60 * 1000L
    }
}
