import {type NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

const WONJU_ITS_ORIGIN = "http://its.wonju.go.kr";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB safety cap

function sanitizeAssetPath(rawPath: string | null): string | null {
    if (!rawPath) return null;
    const trimmed = rawPath.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
        return null;
    }
    if (trimmed.includes("..") || /[\r\n\0]/.test(trimmed)) {
        return null;
    }
    try {
        const parsed = new URL(trimmed, WONJU_ITS_ORIGIN);
        if (parsed.origin !== WONJU_ITS_ORIGIN) {
            return null;
        }
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    const safePath = sanitizeAssetPath(request.nextUrl.searchParams.get("path"));
    if (!safePath) {
        return NextResponse.json({error: "Invalid notice asset path"}, {status: 400});
    }

    try {
        const upstreamRes = await fetch(`${WONJU_ITS_ORIGIN}${safePath}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; wBus/2.0)",
                Accept: "image/*,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(10_000),
            redirect: "error",
        });

        if (!upstreamRes.ok) {
            return NextResponse.json(
                {error: `Upstream returned ${upstreamRes.status}`},
                {status: upstreamRes.status === 404 ? 404 : 502}
            );
        }

        const contentType = (upstreamRes.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!contentType.startsWith("image/")) {
            return NextResponse.json({error: "Unsupported asset media type"}, {status: 415});
        }

        const buffer = await upstreamRes.arrayBuffer();
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
            return NextResponse.json({error: "Asset too large"}, {status: 413});
        }

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return NextResponse.json({error: "Failed to fetch notice asset"}, {status: 502});
    }
}
