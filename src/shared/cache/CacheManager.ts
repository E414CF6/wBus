export interface CacheManagerOptions {
    maxSize?: number;
    /** Optional default Time-To-Live in milliseconds */
    ttlMs?: number;
    /** Optional localStorage prefix for persistent client-side L2 caching */
    storagePrefix?: string;
    /** Maximum number of persistent localStorage entries under storagePrefix (default: 30) */
    maxStorageEntries?: number;
}

interface CacheEntry<T> {
    value: T;
    expiresAt: number | null;
}

interface PersistedEnvelope<T> {
    v: T;
    e: number | null;
    t: number;
}

/**
 * Generic cache manager for storing and retrieving data with memory management,
 * optional TTL expiration, request coalescing, and optional L2 localStorage persistence.
 */
export class CacheManager<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private pendingRequests: Map<string, Promise<T>> = new Map();
    private readonly maxSize: number;
    private readonly defaultTtlMs: number | null;
    private readonly storagePrefix: string | null;
    private readonly maxStorageEntries: number;

    /**
     * Create a new cache manager
     * @param maxSizeOrOptions - Maximum number of items to store (default: 100) or configuration object
     */
    constructor(maxSizeOrOptions: number | CacheManagerOptions = 100) {
        if (typeof maxSizeOrOptions === "number") {
            this.maxSize = maxSizeOrOptions;
            this.defaultTtlMs = null;
            this.storagePrefix = null;
            this.maxStorageEntries = 30;
        } else {
            this.maxSize = maxSizeOrOptions.maxSize ?? 100;
            this.defaultTtlMs = maxSizeOrOptions.ttlMs ?? null;
            this.storagePrefix = maxSizeOrOptions.storagePrefix ?? null;
            this.maxStorageEntries = maxSizeOrOptions.maxStorageEntries ?? 30;
        }
    }

    /**
     * Get cached data or return null if not found or expired
     */
    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (entry !== undefined) {
            if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
                this.cache.delete(key);
                this.removeFromStorage(key);
                return null;
            }
            // Refresh key position to end of Map for LRU order
            this.cache.delete(key);
            this.cache.set(key, entry);
            return entry.value;
        }

        // L2 Persistent Storage fallback (Browser only)
        if (this.storagePrefix) {
            const persisted = this.readFromStorage(key);
            if (persisted !== null) {
                if (this.cache.size >= this.maxSize) {
                    this.evictLRU();
                }
                this.cache.set(key, persisted);
                return persisted.value;
            }
        }

        return null;
    }

    /**
     * Set data in cache with automatic LRU eviction and optional L2 persistence
     */
    set(key: string, value: T, customTtlMs?: number): void {
        const ttl = customTtlMs ?? this.defaultTtlMs;
        const expiresAt = ttl && ttl > 0 ? Date.now() + ttl : null;

        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        this.cache.set(key, {value, expiresAt});

        if (this.storagePrefix && value !== null && value !== undefined) {
            this.writeToStorage(key, value, expiresAt);
        }
    }

    /**
     * Check if a non-expired key exists in the cache
     */
    // noinspection JSUnusedGlobalSymbols
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (entry !== undefined) {
            if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
                this.cache.delete(key);
                this.removeFromStorage(key);
                return false;
            }
            return true;
        }
        if (this.storagePrefix) {
            return this.readFromStorage(key) !== null;
        }
        return false;
    }

    /**
     * Delete a specific key from the cache
     */
    // noinspection JSUnusedGlobalSymbols
    delete(key: string): void {
        this.cache.delete(key);
        this.pendingRequests.delete(key);
        this.removeFromStorage(key);
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
        this.pendingRequests.clear();
        this.clearStorage();
    }

    /**
     * Clear all cache except for specified keys
     * @internal Used for selective cache management
     */
    // noinspection JSUnusedGlobalSymbols
    clearExcept(keysToKeep: string[]): void {
        const keepSet = new Set(keysToKeep);
        for (const key of this.cache.keys()) {
            if (!keepSet.has(key)) {
                this.cache.delete(key);
            }
        }
        for (const key of this.pendingRequests.keys()) {
            if (!keepSet.has(key)) {
                this.pendingRequests.delete(key);
            }
        }
        if (this.storagePrefix && typeof window !== "undefined") {
            try {
                const toRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const storageKey = localStorage.key(i);
                    if (storageKey && storageKey.startsWith(this.storagePrefix)) {
                        const rawKey = storageKey.slice(this.storagePrefix.length);
                        if (!keepSet.has(rawKey)) {
                            toRemove.push(storageKey);
                        }
                    }
                }
                for (const k of toRemove) localStorage.removeItem(k);
            } catch {
                // Ignore storage errors
            }
        }
    }

    /**
     * Get or fetch data with automatic deduplication of concurrent requests
     * If data is cached, return it immediately
     * If a request is pending, return the pending promise
     * Otherwise, execute the fetch function and cache the result
     */
    async getOrFetch(key: string, fetchFn: () => Promise<T>, customTtlMs?: number): Promise<T> {
        // Return cached data if available and valid
        if (this.has(key)) {
            return this.get(key) as T;
        }

        // Return a pending request if one exists
        const pending = this.pendingRequests.get(key);
        if (pending) {
            return pending;
        }

        // Create a new request
        const promise = fetchFn()
            .then((data) => {
                this.set(key, data, customTtlMs);
                return data;
            })
            .finally(() => {
                this.pendingRequests.delete(key);
            });

        this.pendingRequests.set(key, promise);
        return promise;
    }

    /**
     * Get all keys in cache
     * @internal Used for debugging and testing
     */
    // noinspection JSUnusedGlobalSymbols
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache size
     * @internal Used for monitoring and testing
     */
    // noinspection JSUnusedGlobalSymbols
    size(): number {
        return this.cache.size;
    }

    /**
     * Get cache statistics for monitoring
     * @internal Used for debugging and performance monitoring
     */
    // noinspection JSUnusedGlobalSymbols
    getStats(): {
        size: number; maxSize: number; pendingRequests: number; utilizationPercent: number;
    } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            pendingRequests: this.pendingRequests.size,
            utilizationPercent: Math.round((this.cache.size / this.maxSize) * 100),
        };
    }

    /**
     * Evict the least recently used item from the cache
     */
    private evictLRU(): void {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) {
            this.cache.delete(oldestKey);
            this.pendingRequests.delete(oldestKey);
        }
    }

    private readFromStorage(key: string): CacheEntry<T> | null {
        if (!this.storagePrefix || typeof window === "undefined") return null;
        try {
            const storageKey = `${this.storagePrefix}${key}`;
            const raw = localStorage.getItem(storageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as PersistedEnvelope<T>;
            if (!parsed || typeof parsed !== "object" || !("v" in parsed)) {
                localStorage.removeItem(storageKey);
                return null;
            }
            if (parsed.e !== null && Date.now() > parsed.e) {
                localStorage.removeItem(storageKey);
                return null;
            }
            return {value: parsed.v, expiresAt: parsed.e ?? null};
        } catch {
            return null;
        }
    }

    private writeToStorage(key: string, value: T, expiresAt: number | null): void {
        if (!this.storagePrefix || typeof window === "undefined") return;
        const storageKey = `${this.storagePrefix}${key}`;
        const envelope: PersistedEnvelope<T> = {
            v: value,
            e: expiresAt,
            t: Date.now(),
        };
        const serialized = JSON.stringify(envelope);

        try {
            this.pruneStorageIfNeeded(storageKey);
            localStorage.setItem(storageKey, serialized);
        } catch {
            // QuotaExceededError: evict oldest entries with our prefix and retry once
            try {
                this.evictOldestStorageEntries(Math.max(1, Math.floor(this.maxStorageEntries / 2)));
                localStorage.setItem(storageKey, serialized);
            } catch {
                // Ignore if still full
            }
        }
    }

    private pruneStorageIfNeeded(incomingStorageKey: string): void {
        if (!this.storagePrefix || typeof window === "undefined") return;
        try {
            const matchingKeys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(this.storagePrefix) && k !== incomingStorageKey) {
                    matchingKeys.push(k);
                }
            }
            if (matchingKeys.length >= this.maxStorageEntries) {
                this.evictOldestStorageEntries(matchingKeys.length - this.maxStorageEntries + 1);
            }
        } catch {
            // Ignore
        }
    }

    private evictOldestStorageEntries(countToEvict: number): void {
        if (!this.storagePrefix || typeof window === "undefined") return;
        try {
            const entries: Array<{ storageKey: string; timestamp: number }> = [];
            const now = Date.now();
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.startsWith(this.storagePrefix)) continue;
                try {
                    const raw = localStorage.getItem(k);
                    if (!raw) continue;
                    const parsed = JSON.parse(raw) as PersistedEnvelope<unknown>;
                    if (parsed.e !== null && now > parsed.e) {
                        // Immediately remove expired entries
                        localStorage.removeItem(k);
                        countToEvict--;
                        continue;
                    }
                    entries.push({storageKey: k, timestamp: parsed.t || 0});
                } catch {
                    localStorage.removeItem(k);
                    countToEvict--;
                }
            }
            if (countToEvict <= 0) return;
            entries.sort((a, b) => a.timestamp - b.timestamp);
            for (let i = 0; i < Math.min(countToEvict, entries.length); i++) {
                localStorage.removeItem(entries[i].storageKey);
            }
        } catch {
            // Ignore
        }
    }

    private removeFromStorage(key: string): void {
        if (!this.storagePrefix || typeof window === "undefined") return;
        try {
            localStorage.removeItem(`${this.storagePrefix}${key}`);
        } catch {
            // Ignore
        }
    }

    private clearStorage(): void {
        if (!this.storagePrefix || typeof window === "undefined") return;
        try {
            const toRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(this.storagePrefix)) {
                    toRemove.push(k);
                }
            }
            for (const k of toRemove) localStorage.removeItem(k);
        } catch {
            // Ignore
        }
    }
}
