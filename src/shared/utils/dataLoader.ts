import {fetchAPI, HttpError} from "@shared/api/fetchAPI";
import {API_CONFIG} from "@shared/config/env";

/**
 * Loads static JSON/GeoJSON data.
 * @param fileName The name or relative path inside the `public/data/` directory.
 *                 For example, "routeMap.json" or "polylines/route1.geojson"
 */
export async function loadStaticData<T>(fileName: string): Promise<T> {
    const isServer = typeof window === "undefined";
    const cleanFileName = fileName.startsWith("/") ? fileName.slice(1) : fileName;

    // Server-side: Try reading from local filesystem or Remote Blob URL if configured
    if (isServer) {
        // 1. If explicit remote static URL is configured, try fetching first
        if (
            API_CONFIG.STATIC.USE_REMOTE &&
            API_CONFIG.STATIC.BASE_URL &&
            API_CONFIG.STATIC.BASE_URL.startsWith("http")
        ) {
            try {
                const url = `${API_CONFIG.STATIC.BASE_URL}/${cleanFileName}`;
                return await fetchAPI<T>(url);
            } catch (err) {
                console.warn(
                    `[loadStaticData] Remote fetch failed for ${cleanFileName}, falling back to local filesystem:`,
                    err
                );
            }
        }

        // 2. Read from local project directory /tmp
        try {
            const {readFile} = await import("fs/promises");
            const {existsSync} = await import("fs");
            const {join} = await import("path");

            const pathsToTry = [
                join(process.cwd(), "public", "data", cleanFileName),
                join(process.cwd(), ".cache", cleanFileName),
                join("/tmp", cleanFileName),
            ];

            for (const filePath of pathsToTry) {
                if (existsSync(/*turbopackIgnore: true*/ filePath)) {
                    const content = await readFile(/*turbopackIgnore: true*/ filePath, "utf-8");
                    return JSON.parse(content) as T;
                }
            }
        } catch (error) {
            console.error(`[loadStaticData] FS Read Error: data/${cleanFileName}`, error);
        }
    }

    // Client-side (Browser)
    let url: string;
    if (
        API_CONFIG.STATIC.USE_REMOTE &&
        API_CONFIG.STATIC.BASE_URL &&
        API_CONFIG.STATIC.BASE_URL.startsWith("http")
    ) {
        url = `${API_CONFIG.STATIC.BASE_URL}/${cleanFileName}`;
    } else {
        url = `/data/${cleanFileName}`;
    }

    return fetchAPI<T>(url);
}
