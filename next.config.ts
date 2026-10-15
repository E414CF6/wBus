import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    turbopack: {},
    reactStrictMode: true, async headers() {
        return [{
            source: "/:all*(json|geojson)", headers: [{
                key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
            },],
        },];
    }, async redirects() {
        return [{
            source: "/square", destination: "/", permanent: false,
        }, {
            source: "/chat", destination: "/", permanent: false,
        },];
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
            };
        }
        return config;
    },
};

export default nextConfig;
