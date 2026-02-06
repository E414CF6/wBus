import type { BusStop } from "@core/domain";

import type { LatLngBounds } from "leaflet";

// Re-export from geo utils for backward compatibility
export { getHaversineDistanceMeters as getApproximateDistance } from "@core/utils/geo";

/**
 * Filter bus stops by viewport bounds and zoom level for performance optimization.
 * At lower zoom levels, shows fewer stops to reduce rendering overhead.
 *
 * @param stops - All available bus stops
 * @param bounds - Current map viewport bounds
 * @param zoom - Current map zoom level
 * @returns Filtered array of bus stops visible in the current viewport
 */
export function filterStopsByViewport(
    stops: BusStop[],
    bounds: LatLngBounds,
    zoom: number
): BusStop[] {
    // At zoom level 12 and below, show every 2nd stop for performance
    const shouldFilterByDistance = zoom <= 12;
    const filterInterval = zoom <= 10 ? 5 : zoom <= 11 ? 3 : 2;

    let filtered = stops.filter((stop) => {
        // Check if stop is within viewport bounds
        const lat = stop.gpslati;
        const lng = stop.gpslong;
        return bounds.contains([lat, lng]);
    });

    if (shouldFilterByDistance && filtered.length > 0) {
        // Sort by nodeord (fallback to nodeno) to ensure consistent filtering
        filtered = filtered
            .sort((a, b) => {
                const aOrd = Number.isFinite(Number(a.nodeord))
                    ? Number(a.nodeord)
                    : Number(a.nodeno);
                const bOrd = Number.isFinite(Number(b.nodeord))
                    ? Number(b.nodeord)
                    : Number(b.nodeno);

                if (!Number.isFinite(aOrd) && !Number.isFinite(bOrd)) return 0;
                if (!Number.isFinite(aOrd)) return 1;
                if (!Number.isFinite(bOrd)) return -1;
                return aOrd - bOrd;
            })
            .filter((_, index) => index % filterInterval === 0);
    }

    return filtered;
}
