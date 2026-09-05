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
    reactStrictMode: true,
    env: {
        ...(blobUrl && !hasExplicitUrl ? {NEXT_PUBLIC_STATIC_API_URL: blobUrl} : {}),
    },
    async headers() {
        return [
            {
                source: "/data/:path*",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
