import type {NextConfig} from "next";

function getBlobBaseUrl(): string | undefined {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return undefined;
    const match = token.match(/^vercel_blob_rw_([^_]+)_/);
    if (!match) return undefined;
    return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`;
}

const blobUrl = getBlobBaseUrl();
const hasExplicitUrl = process.env.NEXT_PUBLIC_STATIC_API_URL?.startsWith("http");

const nextConfig: NextConfig = {
    reactStrictMode: true, env: {
        ...(blobUrl && !hasExplicitUrl ? {NEXT_PUBLIC_STATIC_API_URL: blobUrl} : {}),
    },
};

export default nextConfig;
