import {API_CONFIG, getBlobBaseUrl} from "@shared/config/env";
import {head} from "@vercel/blob";
import {NextResponse} from "next/server";

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

    // 1. Try local filesystem (for local dev or bundled assets)
    try {
        const {readFile} = await import("fs/promises");
        const {existsSync} = await import("fs");
        const {join} = await import("path");

        const localPaths = [join(process.cwd(), "public", "data", relativePath), join(process.cwd(), "public", relativePath),];

        for (const localPath of localPaths) {
            if (existsSync(/*turbopackIgnore: true*/ localPath)) {
                const content = await readFile(/*turbopackIgnore: true*/ localPath, "utf-8");
                return new NextResponse(content, {status: 200, headers});
            }
        }
    } catch {
        // Fallback to Vercel Blob
    }

    // 2. Fetch from Vercel Blob via SDK head() (Supports Vercel OIDC or Token)
    try {
        const blobPathsToTry = [relativePath, `data/${relativePath}`];
        for (const candidatePath of blobPathsToTry) {
            try {
                const blobInfo = await head(candidatePath);
                if (blobInfo?.url) {
                    const blobRes = await fetch(blobInfo.url, {
                        next: {revalidate: 3600},
                    });
                    if (blobRes.ok) {
                        const data = await blobRes.text();
                        return new NextResponse(data, {status: 200, headers});
                    }
                }
            } catch {
                // Continue to next candidate path
            }
        }
    } catch {
        // Continue to direct URL fallback
    }

    // 3. Fetch via Direct Blob Storage Base URL
    const baseUrl = getBlobBaseUrl();
    if (baseUrl) {
        const candidateUrls = [`${baseUrl}/${relativePath}`, `${baseUrl}/data/${relativePath}`,];
        for (const directUrl of candidateUrls) {
            try {
                const res = await fetch(directUrl, {
                    next: {revalidate: 3600},
                });
                if (res.ok) {
                    const data = await res.text();
                    return new NextResponse(data, {status: 200, headers});
                }
            } catch {
                // Continue
            }
        }
    }

    // 4. Fallback for map style files if not found in Blob or local filesystem
    if (relativePath === "style-dark.json" || relativePath.endsWith("/style-dark.json")) {
        try {
            const fallbackRes = await fetch(API_CONFIG.MAP_STYLE_DARK_FALLBACK, {next: {revalidate: 86400}});
            if (fallbackRes.ok) {
                const data = await fallbackRes.text();
                return new NextResponse(data, {status: 200, headers});
            }
        } catch {
            // Ignore
        }
    } else if (relativePath === "style.json" || relativePath.endsWith("/style.json")) {
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
