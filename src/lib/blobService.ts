import {RouteDataset} from "@/types/bus";

export const VERCEL_BLOB_PATH = "cache.json";
export const FALLBACK_BLOB_PATHS = ["cache.json"];

function getBlobBaseUrl(): string | undefined {
    if (process.env.NEXT_PUBLIC_STATIC_API_URL?.startsWith("http")) {
        return process.env.NEXT_PUBLIC_STATIC_API_URL.replace(/\/+$/, "");
    }
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return undefined;
    const match = token.match(/^vercel_blob_rw_([^_]+)_/);
    if (match) {
        return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`;
    }
    return undefined;
}

/**
 * Loads timetable dataset from Vercel Blob via OIDC / @vercel/blob SDK or public Blob URL.
 */
export async function loadFromVercelBlob(): Promise<RouteDataset | null> {
    const cacheBuster = `?t=${Date.now()}`;

    // 1. Try reading via @vercel/blob SDK head() (Supports Vercel OIDC or BLOB_READ_WRITE_TOKEN)
    try {
        const {head} = await import("@vercel/blob");
        for (const blobPath of FALLBACK_BLOB_PATHS) {
            try {
                const blobResult = await head(blobPath);
                if (blobResult && blobResult.url) {
                    const fetchUrl = `${blobResult.url}${cacheBuster}`;
                    console.log(`[Blob] Fetching timetable from Vercel Blob: ${fetchUrl}`);
                    const res = await fetch(fetchUrl, {cache: "no-store"});
                    if (res.ok) {
                        const data = await res.json();
                        if (data && Array.isArray(data.routes) && data.routes.length > 0) {
                            console.log(`[Blob] Loaded ${data.routes.length} routes from Vercel Blob (${blobPath}).`);
                            return data;
                        }
                    }
                }
            } catch {
                // Try next fallback path
            }
        }
    } catch (err) {
        console.warn("[Blob] SDK head() failed or not available in this environment:", err instanceof Error ? err.message : err);
    }

    // 2. Try fetching from direct Blob Base URL
    const baseUrl = getBlobBaseUrl();
    if (baseUrl) {
        for (const blobPath of FALLBACK_BLOB_PATHS) {
            try {
                const fetchUrl = `${baseUrl}/${blobPath}${cacheBuster}`;
                console.log(`[Blob] Fetching direct Blob URL: ${fetchUrl}`);
                const res = await fetch(fetchUrl, {cache: "no-store"});
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.routes) && data.routes.length > 0) {
                        console.log(`[Blob] Loaded ${data.routes.length} routes from direct Blob URL (${blobPath}).`);
                        return data;
                    }
                }
            } catch (err) {
                console.warn("[Blob] Direct Blob fetch failed:", err instanceof Error ? err.message : err);
            }
        }
    }

    return null;
}

/**
 * Saves timetable dataset to Vercel Blob via @vercel/blob SDK as cache.json.
 */
export async function saveToVercelBlob(data: RouteDataset): Promise<boolean> {
    const jsonStr = JSON.stringify(data, null, 2);
    try {
        const {put} = await import("@vercel/blob");
        const result = await put(VERCEL_BLOB_PATH, jsonStr, {
            access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
        });
        console.log(`[Blob] Successfully saved to Vercel Blob: ${result.url}`);
        return true;
    } catch (err) {
        console.warn("[Blob] Could not save to Vercel Blob (OIDC or BLOB_READ_WRITE_TOKEN required):", err instanceof Error ? err.message : err);
        return false;
    }
}
