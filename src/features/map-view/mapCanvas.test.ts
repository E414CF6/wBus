import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {MAP_SETTINGS} from "@shared/config/env";
import {getMaxCanvasSize, resetCachedMaxCanvasSize} from "./mapCanvas";

describe("mapCanvas - getMaxCanvasSize", () => {
    const originalWindow = global.window;
    const originalDocument = global.document;
    const originalEnv = {...process.env};

    beforeEach(() => {
        resetCachedMaxCanvasSize();
        vi.restoreAllMocks();
        process.env = {...originalEnv};
    });

    afterEach(() => {
        resetCachedMaxCanvasSize();
        global.window = originalWindow;
        global.document = originalDocument;
        process.env = originalEnv;
    });

    it("returns default fallback in SSR environment (window is undefined)", () => {
        // @ts-expect-error - simulating SSR
        delete global.window;

        const size = getMaxCanvasSize();
        expect(size).toEqual(MAP_SETTINGS.CANVAS.DEFAULT_MAX_SIZE);
    });

    it("queries WebGL MAX_TEXTURE_SIZE in browser and releases context", () => {
        const mockLoseContext = vi.fn();
        const mockGl = {
            MAX_TEXTURE_SIZE: 0x0d33,
            getParameter: vi.fn().mockReturnValue(16384),
            getExtension: vi.fn().mockReturnValue({loseContext: mockLoseContext}),
        };

        const mockCanvas = {
            getContext: vi.fn().mockImplementation((type: string) => {
                if (type === "webgl2") return mockGl;
                return null;
            }),
        };

        global.window = {} as unknown as Window & typeof globalThis;
        global.document = {
            createElement: vi.fn().mockReturnValue(mockCanvas),
        } as unknown as Document;

        const size = getMaxCanvasSize();

        expect(size).toEqual([16384, 16384]);
        expect(mockCanvas.getContext).toHaveBeenCalledWith("webgl2");
        expect(mockGl.getParameter).toHaveBeenCalledWith(mockGl.MAX_TEXTURE_SIZE);
        expect(mockGl.getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
        expect(mockLoseContext).toHaveBeenCalled();
    });

    it("caches the result across consecutive calls without recreating canvas", () => {
        const mockGl = {
            MAX_TEXTURE_SIZE: 0x0d33,
            getParameter: vi.fn().mockReturnValue(8192),
            getExtension: vi.fn().mockReturnValue(null),
        };

        const mockCanvas = {
            getContext: vi.fn().mockReturnValue(mockGl),
        };

        const createElementMock = vi.fn().mockReturnValue(mockCanvas);

        global.window = {} as unknown as Window & typeof globalThis;
        global.document = {
            createElement: createElementMock,
        } as unknown as Document;

        const first = getMaxCanvasSize();
        const second = getMaxCanvasSize();

        expect(first).toEqual([8192, 8192]);
        expect(second).toEqual([8192, 8192]);
        expect(createElementMock).toHaveBeenCalledTimes(1);
    });

    it("falls back gracefully when WebGL context creation throws", () => {
        global.window = {} as unknown as Window & typeof globalThis;
        global.document = {
            createElement: vi.fn().mockImplementation(() => {
                throw new Error("WebGL not supported");
            }),
        } as unknown as Document;

        const size = getMaxCanvasSize();
        expect(size).toEqual(MAP_SETTINGS.CANVAS.DEFAULT_MAX_SIZE);
    });

    it("falls back gracefully when getContext returns null", () => {
        global.window = {} as unknown as Window & typeof globalThis;
        global.document = {
            createElement: vi.fn().mockReturnValue({
                getContext: vi.fn().mockReturnValue(null),
            }),
        } as unknown as Document;

        const size = getMaxCanvasSize();
        expect(size).toEqual(MAP_SETTINGS.CANVAS.DEFAULT_MAX_SIZE);
    });

    it("respects environment variable overrides clamped within hardware MAX_TEXTURE_SIZE", () => {
        process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_WIDTH = "4096";
        process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_HEIGHT = "4096";

        const mockGl = {
            MAX_TEXTURE_SIZE: 0x0d33,
            getParameter: vi.fn().mockReturnValue(16384),
            getExtension: vi.fn().mockReturnValue(null),
        };

        global.window = {} as unknown as Window & typeof globalThis;
        global.document = {
            createElement: vi.fn().mockReturnValue({
                getContext: vi.fn().mockReturnValue(mockGl),
            }),
        } as unknown as Document;

        const size = getMaxCanvasSize();
        expect(size).toEqual([4096, 4096]);
    });
});
