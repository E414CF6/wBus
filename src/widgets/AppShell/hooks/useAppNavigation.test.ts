import {describe, expect, it} from "vitest";
import {getBookmarkStorageKey, getRecentRoutesStorageKey} from "@shared/config/env";
import {buildMapUrl} from "./useAppNavigation";

describe("buildMapUrl", () => {
    it("preserves route=0 with cityCode parameter correctly", () => {
        expect(buildMapUrl("0", "32010")).toBe("/?cityCode=32010&route=0");
    });

    it("builds map URL with standard route and cityCode", () => {
        expect(buildMapUrl("30", "32020")).toBe("/?cityCode=32020&route=30");
    });

    it("includes optional wiki slug parameter when provided", () => {
        expect(buildMapUrl("30", "32020", "연세대학교 미래캠퍼스")).toBe(
            "/?cityCode=32020&route=30&wiki=%EC%97%B0%EC%84%B8%EB%8C%80%ED%95%99%EA%B5%90+%EB%AF%B8%EB%9E%98%EC%BA%A0%ED%8D%BC%EC%8A%A4"
        );
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

describe("storage key helpers", () => {
    it("uses legacy Wonju keys for cityCode 32020 and scoped keys for other cities", () => {
        expect(getBookmarkStorageKey("32020")).toBe("wonju_bus_bookmarks");
        expect(getBookmarkStorageKey("11")).toBe("wbus_bookmarks_11");
        expect(getRecentRoutesStorageKey("32020")).toBe("wbus_recent_map_routes");
        expect(getRecentRoutesStorageKey("11")).toBe("wbus_recent_routes_11");
    });
});
