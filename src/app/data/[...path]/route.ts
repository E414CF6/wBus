import {NextResponse} from "next/server";

import {API_CONFIG} from "@shared/config/env";

// Edge CDN ISR Cache: Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400;

export async function GET(_request: Request, {params}: { params: Promise<{ path: string[] }> }) {
    const {path} = await params;
    if (!path || path.length === 0) {
        return NextResponse.json({error: "Path is required"}, {status: 400});
    }

    const relativePath = path.join("/");

    // Security check: prevent path traversal
    if (relativePath.includes("..") || relativePath.startsWith("/")) {
        return NextResponse.json({error: "Invalid path"}, {status: 400});
    }

    const headers: Record<string, string> = {
        "Content-Type": relativePath.endsWith(".geojson") ? "application/geo+json; charset=utf-8" : "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000, stale-if-error=2592000",
    };

    // 1. Try local filesystem (from public directory and /tmp/routes)
    try {
        const {readFile} = await import("fs/promises");
        const {existsSync} = await import("fs");
        const {join} = await import("path");

        const routeFileName = relativePath.startsWith("routes/")
            ? relativePath.slice(7)
            : relativePath.startsWith("route/")
            ? relativePath.slice(6)
            : null;

        const localPaths = [
            join(process.cwd(), "public", relativePath),
            join(process.cwd(), "public", "data", relativePath),
            // Map style alias fallbacks
            ...(relativePath.endsWith("style.json") || relativePath.endsWith("liberty.json") ? [join(process.cwd(), "public", "styles", "liberty.json")] : []),
            ...(relativePath.endsWith("style-dark.json") || relativePath.endsWith("darker.json") ? [join(process.cwd(), "public", "styles", "darker.json")] : []),
            // Route dir alias fallbacks (data/route/* -> public/routes/* or /tmp/routes/*)
            ...(routeFileName ? [
                join(process.cwd(), "public", "routes", routeFileName),
                join("/tmp", "routes", routeFileName),
            ] : []),
        ];

        for (const localPath of localPaths) {
            if (existsSync(/*turbopackIgnore: true*/ localPath)) {
                const content = await readFile(/*turbopackIgnore: true*/ localPath, "utf-8");
                return new NextResponse(content, {status: 200, headers});
            }
        }

        // On-demand route polyline generation for non-Wonju cities
        if (routeFileName && routeFileName.endsWith(".json")) {
            const routeId = routeFileName.replace(/\.json$/, "");
            const url = new URL(_request.url);
            const cityCode = url.searchParams.get("cityCode") || "32020";

            const {generateSingleRoutePolyline} = await import("@entities/route/routeSyncService");
            const polyline = await generateSingleRoutePolyline(routeId, cityCode);
            if (polyline) {
                return new NextResponse(JSON.stringify(polyline), {status: 200, headers});
            }
        }
    } catch {
        // Continue to fallbacks
    }

    // 2. Fallback for map style files if not found in local filesystem
    if (relativePath === "style-dark.json" || relativePath.endsWith("/style-dark.json") || relativePath.endsWith("darker.json")) {
        try {
            const fallbackRes = await fetch(API_CONFIG.MAP_STYLE_DARK_FALLBACK, {next: {revalidate: 86400}});
            if (fallbackRes.ok) {
                const data = await fallbackRes.text();
                return new NextResponse(data, {status: 200, headers});
            }
        } catch {
            // Ignore
        }
    } else if (relativePath === "style.json" || relativePath.endsWith("/style.json") || relativePath.endsWith("liberty.json")) {
        try {
            const fallbackRes = await fetch(API_CONFIG.MAP_STYLE_FALLBACK, {next: {revalidate: 86400}});
            if (fallbackRes.ok) {
                const data = await fallbackRes.text();
                return new NextResponse(data, {status: 200, headers});
            }
        } catch {
            // Ignore
        }
    }

    return NextResponse.json({error: `Not found: ${relativePath}`}, {status: 404});
}
