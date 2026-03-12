import type { NextConfig } from "next";

/**
 * Derive Vercel Blob store URL from BLOB_READ_WRITE_TOKEN.
 * Token format: vercel_blob_rw_{storeId}_{secret}
 */
function getBlobBaseUrl(): string | undefined {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!token) return undefined;
    const match = token.match(/^vercel_blob_rw_([^_]+)_/);

    if (!match) return undefined;
    return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`;
}

const isProduction = process.env.NODE_ENV === "production";
const hasExplicitUrl = process.env.NEXT_PUBLIC_STATIC_API_URL?.startsWith("http");
const blobUrl = getBlobBaseUrl();

const nextConfig: NextConfig = {
    // In production, auto-derive Blob URL from token (no manual config needed)
    env: {
        ...(isProduction && blobUrl && !hasExplicitUrl ? {
            NEXT_PUBLIC_STATIC_API_URL: blobUrl,
            NEXT_PUBLIC_USE_REMOTE_STATIC_DATA: "true",
        } : {}),
    },
};

export default nextConfig;
