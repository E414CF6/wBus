import {describe, expect, it} from "vitest";
import {getBookmarkStorageKey, getRecentRoutesStorageKey} from "@shared/config/env";
import {buildMapUrl, buildScheduleUrl, resolveTabFromPathname} from "./useAppNavigation";

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

describe("buildScheduleUrl", () => {
    it("builds clean /schedule URL for Wonju", () => {
        expect(buildScheduleUrl("32020")).toBe("/schedule");
        expect(buildScheduleUrl()).toBe("/schedule");
    });

    it("preserves non-Wonju cityCode when building schedule URL", () => {
        expect(buildScheduleUrl("32010")).toBe("/schedule?cityCode=32010");
    });

    it("appends subTab=all parameter when subTab is all", () => {
        expect(buildScheduleUrl("32020", "all")).toBe("/schedule?subTab=all");
        expect(buildScheduleUrl("32010", "all")).toBe("/schedule?cityCode=32010&subTab=all");
    });
});

describe("storage key helpers", () => {
    it("uses legacy Wonju keys for cityCode 32020 and scoped keys for other cities", () => {
        expect(getBookmarkStorageKey("32020")).toBe("wonju_bus_bookmarks");
        expect(getBookmarkStorageKey("11")).toBe("wbus_bookmarks_11");
        expect(getRecentRoutesStorageKey("32020")).toBe("wbus_recent_map_routes");
        expect(getRecentRoutesStorageKey("11")).toBe("wbus_recent_routes_11");
    });
});

