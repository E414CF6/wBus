import {MAP_SETTINGS} from "@shared/config/env";

let cachedMaxCanvasSize: [number, number] | null = null;

/**
 * Resets the cached maxCanvasSize (useful for testing or dynamic environment changes).
 */
export function resetCachedMaxCanvasSize(): void {
    cachedMaxCanvasSize = null;
}

/**
 * Safely determines the maximum canvas size within the device's WebGL MAX_TEXTURE_SIZE.
 *
 * MapLibre GL JS defaults to [4096, 4096]. On modern high-DPI (Retina / 4K / 5K) displays,
 * canvas dimensions (CSS pixels * devicePixelRatio) easily exceed 4096, triggering:
 * "The canvas is larger than maxCanvasSize and is rendered at a lower pixel ratio to fit.
 * Increase maxCanvasSize, within MAX_TEXTURE_SIZE, to render at full resolution."
 *
 * By querying the WebGL context's MAX_TEXTURE_SIZE (commonly 16384 on modern GPUs / Apple Silicon,
 * and 8192 on older hardware), this function ensures the map renders at full native resolution
 * while strictly staying within the GPU's hardware texture limits.
 */
export function getMaxCanvasSize(): [number, number] {
    if (cachedMaxCanvasSize) {
        return cachedMaxCanvasSize;
    }

    const defaultFallback = MAP_SETTINGS.CANVAS.DEFAULT_MAX_SIZE;

    if (typeof window === "undefined" || typeof document === "undefined") {
        return defaultFallback;
    }

    try {
        const canvas = document.createElement("canvas");
        const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;

        if (gl) {
            const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            const ext = gl.getExtension("WEBGL_lose_context");
            ext?.loseContext();

            if (typeof maxTextureSize === "number" && maxTextureSize >= 4096) {
                const configuredWidth = process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_WIDTH ? Number(process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_WIDTH) : undefined;
                const configuredHeight = process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_HEIGHT ? Number(process.env.NEXT_PUBLIC_MAP_MAX_CANVAS_HEIGHT) : undefined;

                const width = configuredWidth && !Number.isNaN(configuredWidth) ? Math.min(configuredWidth, maxTextureSize) : maxTextureSize;
                const height = configuredHeight && !Number.isNaN(configuredHeight) ? Math.min(configuredHeight, maxTextureSize) : maxTextureSize;

                cachedMaxCanvasSize = [width, height];
                return cachedMaxCanvasSize;
            }
        }
    } catch {
        // Fall back gracefully in headless, restricted, or failing WebGL environments
    }

    cachedMaxCanvasSize = defaultFallback;
    return cachedMaxCanvasSize;
}
