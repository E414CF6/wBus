import {describe, expect, it} from "vitest";
import {resolveTabFromPathname} from "./useAppNavigation";

describe("resolveTabFromPathname", () => {
    it("maps /live and /map to map tab", () => {
        expect(resolveTabFromPathname("/live")).toBe("map");
        expect(resolveTabFromPathname("/map")).toBe("map");
        expect(resolveTabFromPathname("/live/30")).toBe("map");
    });

    it("maps root and /schedule to schedule tab", () => {
        expect(resolveTabFromPathname("/")).toBe("schedule");
        expect(resolveTabFromPathname("/schedule")).toBe("schedule");
    });

    it("defaults unknown paths to schedule tab", () => {
        expect(resolveTabFromPathname("/unknown")).toBe("schedule");
        expect(resolveTabFromPathname("/bus")).toBe("schedule");
        expect(resolveTabFromPathname("/chat")).toBe("schedule");
        expect(resolveTabFromPathname("/square")).toBe("schedule");
    });
});
