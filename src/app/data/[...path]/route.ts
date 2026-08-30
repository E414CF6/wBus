import {head} from "@vercel/blob";
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

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

export async function GET(
    _request: Request,
    {params}: { params: Promise<{ path: string[] }> }
) {
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
        "Content-Type": relativePath.endsWith(".geojson")
            ? "application/geo+json; charset=utf-8"
            : "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    };

    // 1. Try local filesystem (for local dev or bundled assets)
    try {
        const {readFile} = await import("fs/promises");
        const {existsSync} = await import("fs");
        const {join} = await import("path");

        const localPath = join(process.cwd(), "public", "data", relativePath);
        if (existsSync(/*turbopackIgnore: true*/ localPath)) {
            const content = await readFile(/*turbopackIgnore: true*/ localPath, "utf-8");
            return new NextResponse(content, {status: 200, headers});
        }
    } catch {
        // Fallback to Vercel Blob
    }

    // 2. Fetch from Vercel Blob via SDK head() (Supports Vercel OIDC or Token)
    try {
        const blobInfo = await head(relativePath);
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
        // Continue to direct URL fallback
    }

    // 3. Fetch via Direct Blob Storage Base URL
    const baseUrl = getBlobBaseUrl();
    if (baseUrl) {
        try {
            const directUrl = `${baseUrl}/${relativePath}`;
            const res = await fetch(directUrl, {
                next: {revalidate: 3600},
            });
            if (res.ok) {
                const data = await res.text();
                return new NextResponse(data, {status: 200, headers});
            }
        } catch {
            // Failed
        }
    }

    return NextResponse.json({error: `Not found: ${relativePath}`}, {status: 404});
}
