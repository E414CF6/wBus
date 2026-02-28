import type { BusStop } from "@entities/station/types";
import type { LatLngBounds } from "leaflet";

export function filterStopsByViewport(
    stops: BusStop[],
    bounds: LatLngBounds,
    zoom: number
): BusStop[] {
    const shouldFilterByDistance = zoom <= 12;
    const filterInterval = zoom <= 10 ? 5 : zoom <= 11 ? 3 : 2;

    let filtered = stops.filter((stop) => {
        const lat = stop.gpslati;
        const lng = stop.gpslong;
        return bounds.contains([lat, lng]);
    });

    if (shouldFilterByDistance && filtered.length > 0) {
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
