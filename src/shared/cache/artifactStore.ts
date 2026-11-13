import "server-only";

import {get as blobGet, put as blobPut} from "@vercel/blob";
import fs from "fs";
import path from "path";

/**
 * Durable Artifact Store Adapter
 *
 * Persists semi-static JSON artifacts (`schedule.json`, `routes/{routeId}.json`)
 * across Vercel serverless cold starts via `@vercel/blob` when configured,
 * with automatic fallback to `/tmp` and `public/` on the local filesystem.
 */

function isBlobConfigured(): boolean {
    return Boolean(
        process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
        (process.env.BLOB_STORE_ID?.trim() && process.env.VERCEL_OIDC_TOKEN?.trim())
    );
}

function getBlobAccessMode(): "public" | "private" {
    return process.env.BLOB_ACCESS === "public" ? "public" : "private";
}

function resolveFsCandidates(relativeKey: string): string[] {
    const clean = relativeKey.replace(/^\/+/, "");
    return [
        path.join("/tmp", clean),
        path.join(process.cwd(), "public", clean),
    ];
}

export interface ArtifactStoreStatus {
    configured: boolean;
    backend: "vercel-blob" | "filesystem";
    access: "public" | "private";
}

export const artifactStore = {
    getStatus(): ArtifactStoreStatus {
        const configured = isBlobConfigured();
        return {
            configured,
            backend: configured ? "vercel-blob" : "filesystem",
            access: getBlobAccessMode(),
        };
    },

    async getJson<T>(relativeKey: string): Promise<{ data: T; source: "tmp" | "public" | "blob" } | null> {
        const cleanKey = relativeKey.replace(/^\/+/, "");

        // 1. Check ephemeral /tmp container cache first (sub-ms)
        const tmpPath = path.join("/tmp", cleanKey);
        try {
            if (fs.existsSync(/*turbopackIgnore: true*/ tmpPath)) {
                const content = fs.readFileSync(/*turbopackIgnore: true*/ tmpPath, "utf-8");
                return {data: JSON.parse(content) as T, source: "tmp"};
            }
        } catch {
            // Corrupted /tmp entry: continue to durable store / bundled public asset
        }

        // 2. Check Vercel Blob if configured
        if (isBlobConfigured()) {
            const access = getBlobAccessMode();
            try {
                const res = await blobGet(cleanKey, {access});
                if (res && res.statusCode === 200 && res.stream) {
                    const text = await new Response(res.stream).text();
                    const parsed = JSON.parse(text) as T;
                    // Warm /tmp for subsequent requests on the same container
                    try {
                        fs.mkdirSync(path.dirname(tmpPath), {recursive: true});
                        fs.writeFileSync(tmpPath, text, "utf-8");
                    } catch {
                        // Ignore /tmp write error
                    }
                    return {data: parsed, source: "blob"};
                }
            } catch {
                // Blob missing or transient failure: fall through to bundled public/ asset
            }
        }

        // 3. Check bundled public/ filesystem asset
        const publicPath = path.join(process.cwd(), "public", cleanKey);
        try {
            if (fs.existsSync(/*turbopackIgnore: true*/ publicPath)) {
                const content = fs.readFileSync(/*turbopackIgnore: true*/ publicPath, "utf-8");
                return {data: JSON.parse(content) as T, source: "public"};
            }
        } catch {
            // Ignore
        }

        return null;
    },

    async putJson<T>(relativeKey: string, value: T, options?: { pretty?: boolean }): Promise<void> {
        const cleanKey = relativeKey.replace(/^\/+/, "");
        const serialized = options?.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
        const [tmpPath, publicPath] = resolveFsCandidates(cleanKey);

        // 1. Write /tmp container cache
        try {
            fs.mkdirSync(path.dirname(tmpPath), {recursive: true});
            fs.writeFileSync(/*turbopackIgnore: true*/ tmpPath, serialized, "utf-8");
        } catch {
            // Ignore
        }

        // 2. Persist to Vercel Blob if configured
        if (isBlobConfigured()) {
            const access = getBlobAccessMode();
            try {
                await blobPut(cleanKey, serialized, {
                    access,
                    allowOverwrite: true,
                    addRandomSuffix: false,
                    contentType: "application/json; charset=utf-8",
                });
            } catch (err) {
                console.warn(`[ArtifactStore] Blob PUT failed for '${cleanKey}':`, err instanceof Error ? err.message : err);
            }
        }

        // 3. Persist to local public/ directory only when running locally (non-serverless)
        if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
            try {
                fs.mkdirSync(path.dirname(publicPath), {recursive: true});
                fs.writeFileSync(/*turbopackIgnore: true*/ publicPath, serialized, "utf-8");
            } catch {
                // Ignore read-only FS
            }
        }
    },
};
