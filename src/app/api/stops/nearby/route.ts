import {type NextRequest, NextResponse} from "next/server";
import {fetchNearbyStops, type RawNearbyStop} from "@entities/bus";
import {getCachedOrFetch} from "@shared/cache";
import {getHaversineDistanceMeters} from "@shared/utils/geo";

export const dynamic = "force-dynamic";

export interface NearbyStopWithDistance extends RawNearbyStop {
    distanceMeters: number;
}

const CACHE_CONTROL_HEADER = "public, max-age=30, s-maxage=60, stale-while-revalidate=120";

/**
 * GET /api/stops/nearby?lat=...&lng=...&limit=...
 * Returns neighboring bus stops near given GPS coordinates, sorted by distance.
 */
export async function GET(request: NextRequest) {
    const {searchParams} = request.nextUrl;
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const limitStr = searchParams.get("limit");

    if (!latStr || !lngStr) {
        return NextResponse.json(
            {error: "Missing required query parameters: 'lat' and 'lng'"},
            {status: 400}
        );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < 32.5 || lat > 39.5 || lng < 124.0 || lng > 132.5) {
        return NextResponse.json(
            {error: "Invalid coordinates. Must be within the South Korea bounding box."},
            {status: 400}
        );
    }

    const limit = Math.min(Math.max(parseInt(limitStr || "20", 10) || 20, 1), 50);

    // Approximate spatial cache key (~100m resolution)
    const cacheKey = `stops:nearby:${lat.toFixed(3)}:${lng.toFixed(3)}`;

    try {
        const result = await getCachedOrFetch<RawNearbyStop[]>(
            cacheKey,
            () => fetchNearbyStops({gpsLati: lat, gpsLong: lng}),
            {
                ttlSeconds: 60,
                staleWhileRevalidateSeconds: 300,
                staleIfErrorSeconds: 600,
            }
        );

        const stops = (result.data || []).map((stop) => {
            const distanceMeters = Math.round(
                getHaversineDistanceMeters([lat, lng], [stop.gpslati, stop.gpslong])
            );
            return {
                ...stop,
                distanceMeters,
            };
        });

        // Sort by distance ascending
        stops.sort((a, b) => a.distanceMeters - b.distanceMeters);

        const sliced = stops.slice(0, limit);

        return NextResponse.json(
            {
                data: sliced,
                meta: {
                    total: stops.length,
                    returned: sliced.length,
                    center: {lat, lng},
                    layer: result.meta?.layer ?? "origin",
                },
            },
            {
                headers: {
                    "Cache-Control": CACHE_CONTROL_HEADER,
                },
            }
        );
    } catch (err) {
        console.error("[API /api/stops/nearby]", err);
        return NextResponse.json(
            {error: "Failed to fetch nearby bus stops"},
            {status: 500}
        );
    }
}
