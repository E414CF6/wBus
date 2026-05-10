import {getCachedOrFetch} from "@shared/redis/client";
import {NextResponse} from "next/server";

export interface ApiHandlerConfig<T> {
    paramKey: string;
    cacheKey: (id: string) => string;
    fetcher: (id: string) => Promise<T>;
    ttl: number;
    errorMessage: string;
    cacheControl?: string;
    loggerPrefix: string;
}

export interface StaticApiHandlerConfig<T> {
    paramKey: string;
    fetcher: (id: string) => Promise<T>;
    errorMessage: string;
    cacheControl?: string;
    loggerPrefix: string;
}

/**
 * Creates a Next.js GET route handler with layered caching (memory + Redis + CDN headers).
 * Use for APIs that benefit from shared cache across instances.
 */
export function createApiHandler<T>(config: ApiHandlerConfig<T>) {
    return async function GET(_request: Request, {params}: { params: Promise<Record<string, string>> }) {
        const resolvedParams = await params;
        const id = resolvedParams[config.paramKey];

        if (!id) {
            return NextResponse.json({error: `Missing parameter: ${config.paramKey}`}, {status: 400});
        }

        try {
            const result = await getCachedOrFetch<T>(config.cacheKey(id), () => config.fetcher(id), config.ttl);

            const headers: Record<string, string> = {};
            if (config.cacheControl) {
                headers["Cache-Control"] = config.cacheControl;
            }
            if (result.meta) {
                headers["X-Cache-Status"] = result.meta.status;
                headers["X-Cache-Layer"] = result.meta.layer;
                headers["X-Cache-Age-Ms"] = String(result.meta.ageMs);
                if (result.meta.degraded) {
                    headers["X-Cache-Degraded"] = "true";
                }
            }

            return NextResponse.json(result, {headers});
        } catch (err) {
            console.error(`[API ${config.loggerPrefix}/${id}]`, err);
            return NextResponse.json({error: config.errorMessage}, {status: 500});
        }
    };
}

/**
 * Creates a Next.js GET route handler for static data without Redis.
 * Relies purely on CDN edge caching via Cache-Control headers.
 * Use for rarely-changing data like route stops and polylines.
 */
export function createStaticApiHandler<T>(config: StaticApiHandlerConfig<T>) {
    return async function GET(_request: Request, {params}: { params: Promise<Record<string, string>> }) {
        const resolvedParams = await params;
        const id = resolvedParams[config.paramKey];

        if (!id) {
            return NextResponse.json({error: `Missing parameter: ${config.paramKey}`}, {status: 400});
        }

        try {
            const data = await config.fetcher(id);
            const result = {
                data, timestamp: Date.now(),
            };

            const headers: Record<string, string> = {};
            if (config.cacheControl) {
                headers["Cache-Control"] = config.cacheControl;
            }

            return NextResponse.json(result, {headers});
        } catch (err) {
            console.error(`[API ${config.loggerPrefix}/${id}]`, err);
            return NextResponse.json({error: config.errorMessage}, {status: 500});
        }
    };
}
