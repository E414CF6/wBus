import {z} from "zod";

/**
 * Runtime validation & normalization schemas for external transit/routing/schedule APIs.
 * Uses permissive coercions and item-level filtering so partial/malformed upstream records
 * are dropped cleanly instead of poisoning downstream caches or crashing route handlers.
 */

const coerceFiniteNumber = (fallback: number): z.ZodType<number> =>
    z.preprocess((val) => {
        if (typeof val === "number") return Number.isFinite(val) ? val : fallback;
        if (typeof val === "string" && val.trim() !== "") {
            const num = Number(val);
            return Number.isFinite(num) ? num : fallback;
        }
        return fallback;
    }, z.number());

const coerceOptionalNumber = z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    const num = Number(val);
    return Number.isFinite(num) ? num : undefined;
}, z.number().optional());

const coerceString = (fallback = ""): z.ZodType<string> =>
    z.preprocess((val) => (val === undefined || val === null ? fallback : String(val)), z.string());

export const TagoBusLocationSchema = z.object({
    routeid: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
    routenm: coerceString(""),
    gpslati: coerceFiniteNumber(NaN).refine((n) => Number.isFinite(n) && n !== 0, "Invalid latitude"),
    gpslong: coerceFiniteNumber(NaN).refine((n) => Number.isFinite(n) && n !== 0, "Invalid longitude"),
    vehicleno: coerceString("").refine((s) => s.trim().length > 0, "Missing vehicleno"),
    nodenm: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
    nodeid: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
    nodeord: coerceOptionalNumber,
}).passthrough();

export const TagoBusArrivalSchema = z.object({
    arrprevstationcnt: coerceFiniteNumber(0),
    arrtime: coerceFiniteNumber(0),
    routeid: coerceString("").refine((s) => s.length > 0, "Missing routeid"),
    routeno: coerceString(""),
    vehicletp: coerceString(""),
    nodenm: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
    nodeid: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
}).passthrough();

export const TagoBusStopSchema = z.object({
    nodeid: coerceString("").refine((s) => s.length > 0, "Missing nodeid"),
    nodenm: coerceString(""),
    nodeno: z.union([z.string(), z.number()]).optional().default(""),
    gpslati: coerceFiniteNumber(NaN).refine((n) => Number.isFinite(n) && n !== 0, "Invalid stop lat"),
    gpslong: coerceFiniteNumber(NaN).refine((n) => Number.isFinite(n) && n !== 0, "Invalid stop lon"),
    nodeord: coerceFiniteNumber(0),
    updowncd: coerceFiniteNumber(0),
}).passthrough();

export const TagoCityRouteSchema = z.object({
    routeid: coerceString("").refine((s) => s.length > 0, "Missing routeid"),
    routeno: coerceString("").refine((s) => s.length > 0, "Missing routeno"),
    routetp: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
    startnodenm: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
    endnodenm: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
    startvehicletime: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
    endvehicletime: z.preprocess((v) => (v == null ? undefined : String(v)), z.string().optional()),
}).passthrough();

export const OsrmRouteResponseSchema = z.object({
    code: z.string().optional(),
    routes: z.array(
        z.object({
            geometry: z.object({
                coordinates: z.array(z.tuple([z.number(), z.number()])),
            }),
        }).passthrough()
    ).optional(),
}).passthrough();

export const TimetableEntrySchema = z.object({
    seq: coerceFiniteNumber(0),
    originDepTime: coerceString(""),
    destDepTime: coerceString(""),
    type: coerceString(""),
    notes: coerceString(""),
});

export const ScheduleBusRouteSchema = z.object({
    id: coerceString(""),
    rawNo: coerceString(""),
    routeNo: coerceString("").refine((s) => s.length > 0, "Missing routeNo"),
    dayType: coerceString("매일"),
    origin: coerceString(""),
    destination: coerceString(""),
    firstBus: coerceString(""),
    lastBus: coerceString(""),
    runCount: coerceString(""),
    interval: coerceString(""),
    timetable: z.array(TimetableEntrySchema).default([]),
}).passthrough();

export const RouteDatasetSchema = z.object({
    updatedAt: coerceString(""),
    sourceUrl: coerceString(""),
    totalRoutes: coerceFiniteNumber(0),
    routes: z.array(ScheduleBusRouteSchema),
});

export const GeoPolylineSchema = z.object({
    route_id: z.string().min(1),
    route_no: z.string().min(1),
    stops_count: z.number().nonnegative(),
    total_dist: z.number().nonnegative(),
    up_polyline: z.array(z.tuple([z.number(), z.number()])),
    down_polyline: z.array(z.tuple([z.number(), z.number()])),
    stops: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            ord: z.number(),
            ud: z.number(),
            lat: z.number().optional(),
            lon: z.number().optional(),
            nodeno: z.union([z.string(), z.number()]).optional(),
        }).passthrough()
    ).min(1),
}).passthrough();

/**
 * Validates and normalizes an array of raw items against a Zod schema,
 * silently dropping invalid entries while preserving valid records.
 */
export function filterValidItems<T>(
    items: unknown[],
    schema: z.ZodType<T>,
    contextLabel?: string
): T[] {
    if (!Array.isArray(items) || items.length === 0) return [];

    const valid: T[] = [];
    let droppedCount = 0;

    for (const raw of items) {
        const parsed = schema.safeParse(raw);
        if (parsed.success) {
            valid.push(parsed.data);
        } else {
            droppedCount++;
        }
    }

    if (droppedCount > 0 && contextLabel) {
        console.warn(`[SchemaValidator] Dropped ${droppedCount}/${items.length} malformed item(s) in ${contextLabel}`);
    }

    return valid;
}
