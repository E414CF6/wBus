import type {Coordinate} from "@shared/utils/geo";
import type {Marker} from "maplibre-gl";
import type React from "react";

export interface AnimatedPositionState {
    position: Coordinate;
    angle: number;
}

export interface UseAnimatedPositionOptions {
    duration?: number;
    polyline?: Coordinate[];
    snapToPolyline?: boolean;
    snapIndexHint?: number | null;
    snapIndexRange?: number;
    resetKey?: string | number;
    markerRef?: React.RefObject<Marker | null>;
    /** Optional 60fps frame callback for rotating a separate directional element while keeping badge upright. */
    onDirectAngle?: (angle: number) => void;
    pollingIntervalMs?: number;
    dataDelayMs?: number;
    /** Polyline coordinate indices where bus stops are located. */
    stopCoordIndices?: number[];
}
