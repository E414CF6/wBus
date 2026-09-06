import {fetchAPI} from "@shared/api/fetchAPI";
import {API_CONFIG} from "@shared/config/env";

/**
 * Loads static JSON/GeoJSON data.
 * @param fileName The name or relative path inside the `public/` directory.
 *                 For example, "routeMap.json" or "routes/WJB251000004.json"
 */
export async function loadStaticData<T>(fileName: string): Promise<T> {
    const isServer = typeof window === "undefined";
    const cleanFileName = fileName.startsWith("/") ? fileName.slice(1) : fileName;

    // Server-side: Read from public directory (bundled at build time) or /tmp
    if (isServer) {
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

        try {
            const {readFile} = await import("fs/promises");
            const {existsSync} = await import("fs");
            const {join} = await import("path");

            const pathsToTry = [join(process.cwd(), "public", cleanFileName),
                join(process.cwd(), "public", "data", cleanFileName),
                join("/tmp", cleanFileName),
            ];

            for (const filePath of pathsToTry) {
                if (existsSync(/*turbopackIgnore: true*/ filePath)) {
                    const content = await readFile(/*turbopackIgnore: true*/ filePath, "utf-8");
                    return JSON.parse(content) as T;
                }
            }
        } catch (error) {
            console.error(`[loadStaticData] FS Read Error: ${cleanFileName}`, error);
        }
    }

    // Client-side (Browser): Fetch directly from public asset URL
    const url =
        API_CONFIG.STATIC.USE_REMOTE &&
        API_CONFIG.STATIC.BASE_URL && API_CONFIG.STATIC.BASE_URL.startsWith("http") ? `${API_CONFIG.STATIC.BASE_URL}/${cleanFileName}` : `/${cleanFileName}`;

    return fetchAPI<T>(url);
}
