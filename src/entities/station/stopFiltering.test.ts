import {describe, expect, it} from "vitest";
import {filterStopsByViewport} from "./stopFiltering";
import type {BusStop} from "./types";
import type {LngLatBounds} from "maplibre-gl";

describe("filterStopsByViewport", () => {
    const mockStops: BusStop[] = Array.from({length: 10}, (_, i) => ({
        nodeid: `STOP_${i}`,
        nodenm: `정류장 ${i}`,
        nodeno: `${1000 + i}`,
        nodeord: i + 1,
        gpslati: 37.3 + i * 0.01,
        gpslong: 127.9 + i * 0.01,
    }));

    // Mock bounds that includes all stops within lat [37.0, 37.5] and lng [127.0, 128.5]
    const mockBounds = {
        contains: ([lng, lat]: [number, number]) =>
            lat >= 37.0 && lat <= 37.5 && lng >= 127.0 && lng <= 128.5,
    } as unknown as LngLatBounds;

    it("returns all in-bounds stops when zoom level is high (> 12)", () => {
        const result = filterStopsByViewport(mockStops, mockBounds, 14);
        expect(result).toHaveLength(10);
    });

    it("downsamples stops by interval 2 when zoom is 12", () => {
        const result = filterStopsByViewport(mockStops, mockBounds, 12);
        // index % 2 === 0 -> indices 0, 2, 4, 6, 8 (5 items)
        expect(result).toHaveLength(5);
        expect(result[0].nodeid).toBe("STOP_0");
        expect(result[1].nodeid).toBe("STOP_2");
    });

    it("downsamples stops by interval 3 when zoom is 11", () => {
        const result = filterStopsByViewport(mockStops, mockBounds, 11);
        // index % 3 === 0 -> indices 0, 3, 6, 9 (4 items)
        expect(result).toHaveLength(4);
    });

    it("downsamples stops by interval 5 when zoom is <= 10", () => {
        const result = filterStopsByViewport(mockStops, mockBounds, 10);
        // index % 5 === 0 -> indices 0, 5 (2 items)
        expect(result).toHaveLength(2);
    });

    it("filters out stops that are outside the viewport bounds", () => {
        const restrictiveBounds = {
            contains: ([_lng, lat]: [number, number]) => lat <= 37.32,
        } as unknown as LngLatBounds;

        const result = filterStopsByViewport(mockStops, restrictiveBounds, 15);
        // Only STOP_0, STOP_1, STOP_2 should match
        expect(result).toHaveLength(3);
    });
});
