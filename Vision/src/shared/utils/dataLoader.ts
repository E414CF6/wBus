import { fetchAPI } from "@shared/api/fetchAPI";
import { API_CONFIG } from "@shared/config/env";

/**
 * Loads static JSON/GeoJSON data.
 * - On Client: Fetches from relative URL (or remote if configured).
 * - On Server (Node): Reads from local filesystem (public/) or fetches remote if configured.
 */
export async function loadStaticData<T>(relativePath: string): Promise<T> {
    const isServer = typeof window === "undefined";
    const useRemote = API_CONFIG.STATIC.USE_REMOTE;

    // Server-side Local Filesystem Access
    if (isServer && !useRemote) {
        try {
            // Dynamic import 'fs' to ensure this code path is dead-code eliminated 
            // or ignored by bundlers for client-side builds.
            const {readFile} = await import("fs/promises");
            const {join} = await import("path");

            // relativePath should not start with / for join, but we handle both
            const cleanPath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
            const filePath = join(process.cwd(), "public", cleanPath);

            const content = await readFile(filePath, "utf-8");
            return JSON.parse(content) as T;
        } catch (error) {
            console.error(`[loadStaticData] FS Read Error: ${relativePath}`, error);
            throw error;
        }
    }

    // Client-side or Server-side Remote
    // We delegate to fetchAPI which handles BASE_URL and retries.
    // fetchAPI expects endpoint to start with / usually if base url is separate.
    const endpoint = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;

    // If on server and using remote, fetchAPI handles it using the configured BASE_URL.
    // If on client, it uses relative path (or BASE_URL if set).
    return fetchAPI<T>(endpoint, {isStatic: true});
}
