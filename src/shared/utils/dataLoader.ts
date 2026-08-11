import {fetchAPI, HttpError} from "@shared/api/fetchAPI";
import {API_CONFIG} from "@shared/config/env";

/**
 * Loads static JSON/GeoJSON data.
 * @param fileName The name or relative path inside the `public/data/` directory.
 *                 For example, "routeMap.json" or "polylines/route1.geojson"
 */
export async function loadStaticData<T>(fileName: string): Promise<T> {
    const isServer = typeof window === "undefined";
    const useRemote = API_CONFIG.STATIC.USE_REMOTE;

    // Remove leading slash if present
    const cleanFileName = fileName.startsWith("/") ? fileName.slice(1) : fileName;

    // Server-side Local Filesystem Access
    if (isServer && !useRemote) {
        try {
            // Dynamic import 'fs' to ensure this code path is dead-code eliminated 
            // or ignored by bundlers for client-side builds.
            const {readFile} = await import("fs/promises");
            const {join} = await import("path");

            const filePath = join(process.cwd(), "public", "data", cleanFileName);
            const content = await readFile(filePath, "utf-8");

            return JSON.parse(content) as T;
        } catch (error) {
            // Re-throw as HttpError 404 if file not found to match fetch behavior
            if (error instanceof Error && 'code' in error && (error as Error & { code?: string }).code === 'ENOENT') {
                throw new HttpError(`File not found: data/${cleanFileName}`, 404);
            }
            console.error(`[loadStaticData] FS Read Error: data/${cleanFileName}`, error);
            throw error;
        }
    }

    // Client-side or Server-side Remote
    let url: string;
    if (useRemote && API_CONFIG.STATIC.BASE_URL) {
        url = `${API_CONFIG.STATIC.BASE_URL}/${cleanFileName}`;
    } else {
        url = `/data/${cleanFileName}`;
    }

    return fetchAPI<T>(url);
}
