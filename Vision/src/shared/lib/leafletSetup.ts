/**
 * Leaflet + legacy plugin initializer.
 *
 * `leaflet-rotatedmarker` is a legacy IIFE plugin that references the
 * global `L` variable directly (it has no CJS/ESM module support).
 * Turbopack does NOT expose ES-module imports as globals, so we must
 * bridge the gap manually:
 *
 *   1. Import Leaflet (ES module → local binding)
 *   2. Assign it to `window.L` so legacy plugins can find it
 *   3. Import the side-effect plugin (now it sees `window.L`)
 *   4. Re-export `L` for normal typed usage
 *
 * Any file that needs `L` together with `leaflet-rotatedmarker` should
 * import from this module instead of importing both separately.
 */
import L from "leaflet";

if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).L = L;

    // Load legacy plugins manually after L is set globally
    // These must be 'require' inside the window check because they 
    // are browser-only and rely on 'L' existing globally.
    // @ts-ignore
    require("leaflet-rotatedmarker");
    // @ts-ignore
    require("leaflet.marker.slideto");
}

export default L;
