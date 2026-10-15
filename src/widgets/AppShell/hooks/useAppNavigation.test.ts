import {describe, expect, it} from "vitest";
import {resolveTabFromPathname} from "./useAppNavigation";

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
