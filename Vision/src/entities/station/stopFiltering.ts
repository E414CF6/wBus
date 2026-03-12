import type { BusStop } from "@entities/station/types";
import type { LngLatBounds } from "maplibre-gl";

export function filterStopsByViewport(
    stops: BusStop[],
    bounds: LngLatBounds,
    zoom: number
): BusStop[] {
    const shouldFilterByDistance = zoom <= 12;
    const filterInterval = zoom <= 10 ? 5 : zoom <= 11 ? 3 : 2;

    let filtered = stops.filter((stop) => {
        const lat = stop.gpslati;
        const lng = stop.gpslong;
        return bounds.contains([lng, lat]);
    });

    if (shouldFilterByDistance && filtered.length > 0) {
        filtered = filtered
            .sort((a, b) => {
                const aNum = Number(a.nodeord);
                const aOrd = Number.isFinite(aNum) ? aNum : Number(a.nodeno);
                const bNum = Number(b.nodeord);
                const bOrd = Number.isFinite(bNum) ? bNum : Number(b.nodeno);

                if (!Number.isFinite(aOrd) && !Number.isFinite(bOrd)) return 0;
                if (!Number.isFinite(aOrd)) return 1;
                if (!Number.isFinite(bOrd)) return -1;
                return aOrd - bOrd;
            })
            .filter((_, index) => index % filterInterval === 0);
    }

    return filtered;
}
