/**
 * @fileoverview Bus feature hooks barrel export.
 * Import hooks from here for cleaner imports.
 */

// Core data hooks
export { useBusData } from "./useBusData";
export { useBusLocationData } from "./useBusLocation";
export { useBusRouteMap } from "./useBusRouteMap";
export { useBusSortedList } from "./useBusSortedList";
export { useBusStop, useClosestStopOrd } from "./useBusStop";
export { useBusDirection, Direction, type DirectionCode } from "./useBusDirection";
export { useBusArrivalInfo, getNextBusArrivalInfo } from "./useBusArrivalInfo";
export { useBusRoutePreference } from "./useBusRoutePreference";

// Polyline hooks (use these instead of legacy hooks)
export {
    useBusPolyline,
    useBusPolylineMap,
    useMultiPolyline,
    getFallbackPolylines,
    type BusPolylineSet,
    type PolylineData,
    type PolylineSegment,
    type MultiPolylineData,
} from "./usePolyline";

// Legacy hooks (deprecated - use usePolyline exports instead)
// These are kept for backward compatibility but should not be used in new code
