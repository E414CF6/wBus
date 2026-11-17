import {describe, expect, it} from "vitest";
import fs from "fs";
import path from "path";
import {validateStyleMin} from "@maplibre/maplibre-gl-style-spec";
import {findFirstLabelLayerId} from "./routeLayerUtils";

interface StyleJson {
    layers: Array<{
        id: string;
        type: string; "source-layer"?: string; minzoom?: number; maxzoom?: number; paint?: Record<string, unknown>;
    }>;
}

describe("routeLayerUtils", () => {
    it("finds the first non-arrow symbol layer for inserting route polylines below labels", () => {
        const layers = [
            {id: "background", type: "background"},
            {id: "road_minor", type: "line"},
            {id: "road_one_way_arrow", type: "symbol"},
            {id: "road_one_way_arrow_opposite", type: "symbol"},
            {id: "building", type: "fill"},
            {id: "waterway_line_label", type: "symbol"},
            {id: "label_city", type: "symbol"},
        ];

        expect(findFirstLabelLayerId(layers)).toBe("waterway_line_label");
    });

    it("returns undefined when no label symbol layers exist", () => {
        expect(findFirstLabelLayerId([])).toBeUndefined();
        expect(findFirstLabelLayerId(null)).toBeUndefined();
        expect(findFirstLabelLayerId([{id: "road_one_way_arrow", type: "symbol"}])).toBeUndefined();
        expect(
            findFirstLabelLayerId([
                {id: "polyline-active-arrows", type: "symbol"},
                {id: "wbus-custom-symbol", type: "symbol"},
            ])
        ).toBeUndefined();
    });

    it("verifies liberty.json and darker.json share matching layer structure and darker.json is fully themed", () => {
        const stylesDir = path.resolve(process.cwd(), "public/styles");
        const light = JSON.parse(fs.readFileSync(path.join(stylesDir, "liberty.json"), "utf8")) as StyleJson;
        const dark = JSON.parse(fs.readFileSync(path.join(stylesDir, "darker.json"), "utf8")) as StyleJson;

        expect(light.layers.map((l) => l.id)).toEqual(dark.layers.map((l) => l.id));
        expect(findFirstLabelLayerId(light.layers)).toBe("waterway_line_label");
        expect(findFirstLabelLayerId(dark.layers)).toBe("waterway_line_label");

        // Ensure darker.json no longer carries leftover daytime Liberty colors
        const darkById = new Map(dark.layers.map((l) => [l.id, l]));
        expect(darkById.get("background")?.paint?.["background-color"]).toBe("#0b101b");
        expect(darkById.get("park")?.paint?.["fill-color"]).not.toBe("#d8e8c8");
        expect(darkById.get("water")?.paint?.["fill-color"]).not.toBe("rgb(158,189,255)");
        expect(darkById.get("label_city")?.paint?.["text-color"]).not.toBe("#000");
        expect(darkById.get("highway-shield-non-us")?.paint?.["text-color"]).toBe("#1e293b");
    });

    it("includes valid POI, landmark, park, peak, housenumber, and continuous building layers in both styles", () => {
        const stylesDir = path.resolve(process.cwd(), "public/styles");
        const expectedLabelLayers = ["park_label", "mountain_peak", "housenumber", "poi_r20", "poi_r7", "poi_r1", "poi_major", "poi_transit",];

        for (const fileName of ["liberty.json", "darker.json"]) {
            const raw = JSON.parse(fs.readFileSync(path.join(stylesDir, fileName), "utf8")) as StyleJson;
            expect(validateStyleMin(raw as Parameters<typeof validateStyleMin>[0])).toEqual([]);

            const byId = new Map(raw.layers.map((l) => [l.id, l]));
            for (const layerId of expectedLabelLayers) {
                expect(byId.get(layerId)?.type).toBe("symbol");
            }

            // Ensure flat building footprints do not disappear before 3D extrusions start
            const building = byId.get("building");
            const building3d = byId.get("building-3d");
            expect(building?.maxzoom).toBe(building3d?.minzoom);
        }
    });
});
