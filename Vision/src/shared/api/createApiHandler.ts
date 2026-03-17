import { getCachedOrFetch } from "@shared/redis/client";
import { NextResponse } from "next/server";

export interface ApiHandlerConfig<T> {
    paramKey: string;
    cacheKey: (id: string) => string;
    fetcher: (id: string) => Promise<T>;
    ttl: number;
    errorMessage: string;
    cacheControl?: string;
    loggerPrefix: string;
}

/**
 * Creates a standard Next.js GET route handler for fetching and caching data.
 */
export function createApiHandler<T>(config: ApiHandlerConfig<T>) {
    return async function GET(
        _request: Request,
        {params}: { params: Promise<Record<string, string>> }
    ) {
        const resolvedParams = await params;
        const id = resolvedParams[config.paramKey];

        if (!id) {
            return NextResponse.json(
                {error: `Missing parameter: ${config.paramKey}`},
                {status: 400}
            );
        }

        try {
            const result = await getCachedOrFetch<T>(
                config.cacheKey(id),
                () => config.fetcher(id),
                config.ttl
            );

            const headers: Record<string, string> = {};
            if (config.cacheControl) {
                headers["Cache-Control"] = config.cacheControl;
            }

            return NextResponse.json(result, {headers});
        } catch (err) {
            console.error(`[API ${config.loggerPrefix}/${id}]`, err);
            return NextResponse.json(
                {error: config.errorMessage},
                {status: 500}
            );
        }
    };
}
