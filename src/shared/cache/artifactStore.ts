import "server-only";

import {get as blobGet, head as blobHead, put as blobPut} from "@vercel/blob";
import fs from "fs";
import path from "path";

/**
 * Durable Artifact Store Adapter
 *
 * Persists semi-static JSON artifacts (`schedule.json`, `routes/{cityCode}/{routeId}.json`)
 * across Vercel serverless cold starts via `@vercel/blob` when configured,
 * with TTL-bounded `/tmp` container cache and `public/` fallback on the local filesystem.
 */

const DEFAULT_TMP_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes before re-validating against Vercel Blob

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

export interface ArtifactGetOptions {
    /** Max age for ephemeral /tmp cache before checking Vercel Blob (default: 5 min when Blob is configured) */
    tmpMaxAgeMs?: number;
    /** Skip /tmp read and fetch directly from Blob/public */
    bypassTmp?: boolean;
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

    async checkHealth(): Promise<{ ok: boolean; latencyMs: number; backend: "vercel-blob" | "filesystem" }> {
        const start = Date.now();
        if (!isBlobConfigured()) {
            return {ok: true, latencyMs: Date.now() - start, backend: "filesystem"};
        }

        try {
            await blobHead("schedule.json");
            return {ok: true, latencyMs: Date.now() - start, backend: "vercel-blob"};
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // BlobNotFoundError still confirms Blob API connectivity & auth succeeded
            const isNotFound = /not\s*found|404/i.test(msg);
            return {ok: isNotFound, latencyMs: Date.now() - start, backend: "vercel-blob"};
        }
    },

    async getJson<T>(
        relativeKey: string,
        options?: ArtifactGetOptions
    ): Promise<{ data: T; source: "tmp" | "public" | "blob" } | null> {
        const cleanKey = relativeKey.replace(/^\/+/, "");
        const blobConfigured = isBlobConfigured();
        const tmpMaxAgeMs = options?.tmpMaxAgeMs ?? DEFAULT_TMP_MAX_AGE_MS;

        // 1. Check ephemeral /tmp container cache first (bounded by tmpMaxAgeMs when Blob is active)
        const tmpPath = path.join("/tmp", cleanKey);
        let staleTmpData: T | null = null;
        if (!options?.bypassTmp) {
            try {
                if (fs.existsSync(/*turbopackIgnore: true*/ tmpPath)) {
                    const stats = fs.statSync(/*turbopackIgnore: true*/ tmpPath);
                    const ageMs = Date.now() - stats.mtimeMs;
                    const content = fs.readFileSync(/*turbopackIgnore: true*/ tmpPath, "utf-8");
                    const parsed = JSON.parse(content) as T;
                    if (!blobConfigured || ageMs <= tmpMaxAgeMs) {
                        return {data: parsed, source: "tmp"};
                    }
                    staleTmpData = parsed;
                }
            } catch {
                // Corrupted /tmp entry: continue to durable store / bundled public asset
            }
        }

        // 2. Check Vercel Blob if configured
        if (blobConfigured) {
            const access = getBlobAccessMode();
            try {
                const res = await blobGet(cleanKey, {access});
                if (res && res.statusCode === 200 && res.stream) {
                    const text = await new Response(res.stream).text();
                    const parsed = JSON.parse(text) as T;
                    // Warm /tmp and refresh mtime for subsequent requests on the same container
                    try {
                        fs.mkdirSync(path.dirname(tmpPath), {recursive: true});
                        fs.writeFileSync(/*turbopackIgnore: true*/ tmpPath, text, "utf-8");
                    } catch {
                        // Ignore /tmp write error
                    }
                    return {data: parsed, source: "blob"};
                }
            } catch {
                // Blob missing or transient failure: fall back to expired /tmp if present, then bundled public/ asset
                if (staleTmpData !== null) {
                    return {data: staleTmpData, source: "tmp"};
                }
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

        if (staleTmpData !== null) {
            return {data: staleTmpData, source: "tmp"};
        }

        return null;
    },

    async putJson<T>(relativeKey: string, value: T, options?: { pretty?: boolean }): Promise<void> {
        const cleanKey = relativeKey.replace(/^\/+/, "");
        const usePretty = options?.pretty ?? false;
        const serialized = usePretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
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
