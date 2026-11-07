import {describe, expect, it} from "vitest";
import {getCityFeatures} from "./cityFeatures";

describe("getCityFeatures", () => {
    it("returns enabled timetable and university shuttle for Wonju (32020)", () => {
        const features = getCityFeatures("32020");
        expect(features.hasDetailedTimetable).toBe(true);
        expect(features.hasUniversityShuttle).toBe(true);
        expect(features.hasRouteVariations).toBe(true);
        expect(features.defaultQuickRoutes).toEqual(["30", "34", "34-1"]);
        expect(features.defaultRoute).toBe("30");
    });

    it("returns disabled timetable and empty quick routes for nationwide cities", () => {
        const features = getCityFeatures("11"); // Seoul
        expect(features.hasDetailedTimetable).toBe(false);
        expect(features.hasUniversityShuttle).toBe(false);
        expect(features.hasRouteVariations).toBe(false);
        expect(features.defaultQuickRoutes).toEqual([]);
        expect(features.defaultRoute).toBeNull();
    });

    it("handles null/undefined city code safely", () => {
        const features = getCityFeatures(null);
        expect(features.hasDetailedTimetable).toBe(false);
        expect(features.defaultQuickRoutes).toEqual([]);
    });
});
