import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {lockBodyScroll} from "./useBodyScrollLock";

describe("lockBodyScroll", () => {
    let mockBodyStyle: { overflow: string };

    beforeEach(() => {
        mockBodyStyle = {overflow: "auto"};
        vi.stubGlobal("document", {
            body: {
                style: mockBodyStyle,
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("locks body overflow to hidden and restores original value on cleanup", () => {
        mockBodyStyle.overflow = "scroll";
        const restore = lockBodyScroll();
        expect(mockBodyStyle.overflow).toBe("hidden");

        restore();
        expect(mockBodyStyle.overflow).toBe("scroll");
    });

    it("does not throw in SSR environments where document is undefined", () => {
        vi.stubGlobal("document", undefined);
        expect(() => {
            const restore = lockBodyScroll();
            restore();
        }).not.toThrow();
    });
});
