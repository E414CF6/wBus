import {describe, expect, it} from "vitest";
import {buildMapUrl, resolveTabFromPathname} from "./useAppNavigation";

describe("resolveTabFromPathname", () => {
    it("maps root, /live, and /map to map tab", () => {
        expect(resolveTabFromPathname("/")).toBe("map");
        expect(resolveTabFromPathname("/live")).toBe("map");
        expect(resolveTabFromPathname("/map")).toBe("map");
        expect(resolveTabFromPathname("/live/30")).toBe("map");
    });

    it("maps /schedule to schedule tab", () => {
        expect(resolveTabFromPathname("/schedule")).toBe("schedule");
        expect(resolveTabFromPathname("/schedule?subTab=all")).toBe("schedule");
    });

    it("defaults unknown paths to map tab (map-centric architecture)", () => {
        expect(resolveTabFromPathname("/unknown")).toBe("map");
        expect(resolveTabFromPathname("/bus")).toBe("map");
        expect(resolveTabFromPathname("/chat")).toBe("map");
        expect(resolveTabFromPathname("/square")).toBe("map");
    });
});

describe("buildMapUrl", () => {
    it("preserves route=0 with cityCode parameter correctly", () => {
        expect(buildMapUrl("0", "32010")).toBe("/?cityCode=32010&route=0");
    });

    it("builds map URL with standard route and cityCode", () => {
        expect(buildMapUrl("30", "32020")).toBe("/?cityCode=32020&route=30");
    });

    it("builds map URL with only route when cityCode is not supplied", () => {
        expect(buildMapUrl("0")).toBe("/?route=0");
    });

    it("builds map URL with only cityCode when route is empty or null", () => {
        expect(buildMapUrl(null, "32020")).toBe("/?cityCode=32020");
        expect(buildMapUrl("", "32020")).toBe("/?cityCode=32020");
    });

    it("returns root / when both route and cityCode are absent", () => {
        expect(buildMapUrl(undefined, undefined)).toBe("/");
    });
});

