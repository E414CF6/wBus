import {describe, expect, it} from "vitest";
import {estimateWikiPinDimensions, filterPinsByViewportAndZoom, solvePinOverlapLayout,} from "./pinOverlapLayout";

describe("pinOverlapLayout", () => {
    it("culls pins outside viewport bounds and respects zoom thresholds", () => {
        const pins = [
            {slug: "wonju-a", lat: 37.2834, lng: 127.9006, pinned: true},
            {slug: "seoul-far", lat: 37.5665, lng: 126.978, pinned: false},
        ];
        const wonjuBounds = {west: 127.85, east: 127.95, south: 37.24, north: 37.33};

        // Nationwide zoom (< 10.5) hides pins unless selected
        expect(filterPinsByViewportAndZoom(pins, 8.0, wonjuBounds).displayMode).toBe("hidden");
        expect(filterPinsByViewportAndZoom(pins, 8.0, wonjuBounds).visiblePins).toEqual([]);

        // City overview zoom (10.5 <= zoom < 12.2) uses compact mode and culls Seoul
        const mid = filterPinsByViewportAndZoom(pins, 11.4, wonjuBounds);
        expect(mid.displayMode).toBe("compact");
        expect(mid.visiblePins.map((p) => p.slug)).toEqual(["wonju-a"]);

        // Neighborhood zoom (>= 12.2) uses full mode
        const close = filterPinsByViewportAndZoom(pins, 14.5, wonjuBounds);
        expect(close.displayMode).toBe("full");
        expect(close.visiblePins.map((p) => p.slug)).toEqual(["wonju-a"]);
    });

    it("shifts colliding wiki pin away from fixed timetable pin obstacle", () => {
        const result = solvePinOverlapLayout(
            [{id: "연세대학교 미래캠퍼스", x: 400, y: 300, width: 196, height: 46, priority: 1}],
            [{x: 406, y: 304, width: 185, height: 48}],
        );

        const offset = result.get("연세대학교 미래캠퍼스");
        expect(offset).toBeDefined();
        expect(offset!.dx !== 0 || offset!.dy !== 0).toBe(true);
    });

    it("separates multiple overlapping wiki pins dynamically", () => {
        const result = solvePinOverlapLayout([
            {id: "pin-a", x: 500, y: 400, width: 160, height: 46, priority: 2},
            {id: "pin-b", x: 512, y: 404, width: 160, height: 46, priority: 1},
        ]);

        expect(result.get("pin-a")).toEqual({dx: 0, dy: 0});
        const bOffset = result.get("pin-b")!;
        expect(bOffset.dx !== 0 || bOffset.dy !== 0).toBe(true);
    });

    it("estimates larger height when hashtag line is shown in full mode", () => {
        const compact = estimateWikiPinDimensions("연세대", "#원주 #셔틀", "compact");
        const full = estimateWikiPinDimensions("연세대", "#원주 #셔틀", "full");
        expect(full.height).toBeGreaterThan(compact.height);
    });
});
