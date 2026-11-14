"use client";

import React, {memo, useCallback, useMemo} from "react";
import type {BusItem} from "@entities/bus/types";
import type {Coordinate} from "@shared/utils/geo";
import BusAnimatedMarker from "../BusAnimatedMarker";
import {BusHeadingConeSVG, BusIconDOM} from "./BusIconDOM";

const SNAP_INDEX_RANGE = 80;

export interface MarkerItemComponentProps {
    markerKey: string;
    bus: BusItem;
    position: Coordinate;
    angle?: number;
    polyline: Coordinate[];
    snapIndexHint: number | null;
    stopCoordIndices: number[];
    refreshKey: string;
    markerColor: string;
    isSelected: boolean;
    isFollowed: boolean;
    showPlateNumber?: boolean;
    routeName: string;
    effectiveAnimationDuration: number;
    effectivePollingIntervalMs: number;
    effectiveDataDelayMs: number;
    onPositionChange?: (key: string, pos: Coordinate) => void;
    onClick: (key: string) => void;
}

export const MarkerItemComponent = memo(function MarkerItemComponent({
    markerKey,
    bus,
    position,
    angle,
    polyline,
    snapIndexHint,
    stopCoordIndices,
    refreshKey,
    markerColor,
    isSelected,
    isFollowed,
    showPlateNumber = false,
    routeName,
    effectiveAnimationDuration,
    effectivePollingIntervalMs,
    effectiveDataDelayMs,
    onPositionChange,
    onClick,
}: MarkerItemComponentProps) {
    const handlePosChange = useCallback(
        (pos: Coordinate) => {
            onPositionChange?.(markerKey, pos);
        },
        [markerKey, onPositionChange]
    );

    const handleClick = useCallback(() => {
        onClick(markerKey);
    }, [markerKey, onClick]);

    const themeColor = markerColor || "#2563eb";
    const headingOverlay = useMemo(() => <BusHeadingConeSVG color={themeColor}/>, [themeColor]);
    const wrapperClassName = `relative flex items-center justify-center w-11 h-11 transition-transform duration-150 select-none ${
        isSelected || isFollowed ? "scale-115 z-50" : "z-10 hover:scale-105"
    }`;

    return (
        <BusAnimatedMarker
            position={position}
            rotationAngle={(angle || 0) % 360}
            polyline={polyline}
            snapIndexHint={snapIndexHint}
            snapIndexRange={SNAP_INDEX_RANGE}
            animationDuration={effectiveAnimationDuration}
            pollingIntervalMs={effectivePollingIntervalMs}
            dataDelayMs={effectiveDataDelayMs}
            stopCoordIndices={stopCoordIndices}
            refreshKey={refreshKey}
            onPositionChange={isSelected || isFollowed ? handlePosChange : undefined}
            onClick={handleClick}
            headingOverlay={headingOverlay}
            wrapperClassName={wrapperClassName}
        >
            <BusIconDOM
                routeNumber={bus.routenm || routeName}
                color={themeColor}
                isSelected={isSelected}
                isFollowed={isFollowed}
                plateNumber={showPlateNumber || isSelected || isFollowed ? bus.vehicleno : undefined}
            />
        </BusAnimatedMarker>
    );
});

MarkerItemComponent.displayName = "MarkerItemComponent";
