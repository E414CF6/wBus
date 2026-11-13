/**
 * Lightweight IndexedDB Key-Value Adapter for Client Caching (Phase 3)
 *
 * Moves large semi-static transit payloads (route catalogs, OSRM polylines) off quota-limited
 * synchronous `localStorage` (~5MB cap) into asynchronous IndexedDB, while preserving a clean
 * no-op fallback during SSR, unit tests, or restricted private-browsing contexts.
 */

const DB_NAME = "wbus-cache-v1";
const STORE_NAME = "kv";
const DB_VERSION = 1;

interface IdbRecord<T> {
    value: T;
    expiresAt: number | null;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise<IDBDatabase | null>((resolve) => {
        try {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });

    return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
    const db = await openDb();
    if (!db) return null;

    return new Promise<T | null>((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => {
                const record = req.result as IdbRecord<T> | undefined;
                if (!record) {
                    resolve(null);
                    return;
                }
                if (record.expiresAt !== null && Date.now() > record.expiresAt) {
                    void idbDelete(key);
                    resolve(null);
                    return;
                }
                resolve(record.value);
            };
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

export async function idbSet<T>(key: string, value: T, ttlMs?: number | null): Promise<boolean> {
    const db = await openDb();
    if (!db) return false;

    const record: IdbRecord<T> = {
        value,
        expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null,
    };

    return new Promise<boolean>((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(record, key);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
        } catch {
            resolve(false);
        }
    });
}

export async function idbDelete(key: string): Promise<void> {
    const db = await openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
}
