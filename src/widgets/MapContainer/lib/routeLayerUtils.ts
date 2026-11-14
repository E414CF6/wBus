import type {Map as MapLibreMap} from "maplibre-gl";

export const ROUTE_CHEVRON_IMAGE_ID = "wbus-route-chevron";

export interface StyleLayerLike {
    id: string;
    type?: string;
}

const NON_LABEL_SYMBOL_LAYERS = new Set([
    "road_one_way_arrow",
    "road_one_way_arrow_opposite",
    "polyline-active-arrows",
]);

const NON_LABEL_LAYER_PREFIXES = ["polyline-", "wbus-"];

/**
 * Finds the first map typography/symbol layer ID in a MapLibre style so route polylines
 * can be inserted right beneath street names, shields, and place labels.
 */
export function findFirstLabelLayerId(
    layers?: ReadonlyArray<StyleLayerLike> | null
): string | undefined {
    if (!layers || layers.length === 0) return undefined;

    for (const layer of layers) {
        if (
            layer.type === "symbol" &&
            !NON_LABEL_SYMBOL_LAYERS.has(layer.id) &&
            !NON_LABEL_LAYER_PREFIXES.some((prefix) => layer.id.startsWith(prefix))
        ) {
            return layer.id;
        }
    }

    return undefined;
}

/**
 * Generates and registers a crisp directional chevron image on the MapLibre instance
 * for rendering smooth route-direction arrows along polylines.
 */
export function ensureRouteChevronImage(map: MapLibreMap | null | undefined): boolean {
    if (!map || typeof document === "undefined") return false;

    try {
        if (map.hasImage(ROUTE_CHEVRON_IMAGE_ID)) {
            return true;
        }

        const size = 28;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;

        ctx.clearRect(0, 0, size, size);

        // Subtle dark outline halo so white chevrons stay crisp on brighter segments
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Chevron points right (+X) so MapLibre `symbol-placement: "line"` aligns it forward along the path
        const drawChevronPath = () => {
            ctx.beginPath();
            ctx.moveTo(9.5, 6.5);
            ctx.lineTo(18.5, 14);
            ctx.lineTo(9.5, 21.5);
        };

        ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
        ctx.lineWidth = 6.2;
        drawChevronPath();
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3.6;
        drawChevronPath();
        ctx.stroke();

        const imageData = ctx.getImageData(0, 0, size, size);
        map.addImage(ROUTE_CHEVRON_IMAGE_ID, imageData, {pixelRatio: 2});
        return true;
    } catch {
        return false;
    }
}
