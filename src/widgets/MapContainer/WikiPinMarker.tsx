"use client";

import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Marker} from "react-map-gl/maplibre";
import {MapPin} from "lucide-react";
import {useWikiPins, type WikiPageSummary} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {triggerHaptic} from "@shared/utils/haptics";
import {
    estimateWikiPinDimensions,
    filterPinsByViewportAndZoom,
    type FixedObstacleBox,
    solvePinOverlapLayout,
    useMapPinObstacles,
    type ViewportBoundsBox,
} from "./lib/pinOverlapLayout";
import {resolveWikiPinTheme} from "./lib/wikiPinTheme";

export interface WikiPinMarkerProps {
    enabled?: boolean;
    selectedSlug?: string | null;
    isPinPlacementMode?: boolean;
    onSelectWikiPin: (slug: string) => void;
    onPinContextMenu?: (page: WikiPageSummary, position: { x: number; y: number }) => void;
}

const LONG_PRESS_MS = 500;
const TOUCH_MOVE_TOLERANCE_PX = 10;

interface ViewportSnapshot {
    zoom: number;
    bounds: ViewportBoundsBox | null;
    tick: number;
}

export const WikiPinMarker = memo(function WikiPinMarker({
                                                             enabled = true,
                                                             selectedSlug = null,
                                                             isPinPlacementMode = false,
                                                             onSelectWikiPin,
                                                             onPinContextMenu,
                                                         }: WikiPinMarkerProps) {
    const {map} = useAppMapContext();
    const {data} = useWikiPins({enabled});
    const pins = useMemo(() => data?.pages ?? [], [data?.pages]);
    const externalObstacles = useMapPinObstacles("wiki");

    const [viewport, setViewport] = useState<ViewportSnapshot>(() => ({
        zoom: 13,
        bounds: null,
        tick: 0,
    }));

    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const suppressNextClickRef = useRef(false);

    useEffect(() => {
        if (!map || !enabled) return;

        let rafId: number | null = null;
        const syncViewport = () => {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                const b = map.getBounds();
                setViewport((prev) => ({
                    zoom: map.getZoom(),
                    bounds: b
                        ? {
                            west: b.getWest(),
                            east: b.getEast(),
                            south: b.getSouth(),
                            north: b.getNorth(),
                        }
                        : null,
                    tick: prev.tick + 1,
                }));
            });
        };

        syncViewport();
        map.on("move", syncViewport);
        map.on("zoom", syncViewport);
        map.on("moveend", syncViewport);
        map.on("zoomend", syncViewport);

        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            map.off("move", syncViewport);
            map.off("zoom", syncViewport);
            map.off("moveend", syncViewport);
            map.off("zoomend", syncViewport);
        };
    }, [map, enabled]);

    const clearLongPress = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        touchStartRef.current = null;
    }, []);

    useEffect(() => {
        return () => clearLongPress();
    }, [clearLongPress]);

    const handlePinClick = useCallback(
        (page: WikiPageSummary) => {
            if (isPinPlacementMode) return;
            if (suppressNextClickRef.current) {
                suppressNextClickRef.current = false;
                return;
            }
            triggerHaptic("selection");
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
                window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
                window.dispatchEvent(new CustomEvent("wbus:close-bus-list"));
            }
            if (map && typeof page.lat === "number" && typeof page.lng === "number") {
                map.flyTo({
                    center: [page.lng, page.lat],
                    zoom: Math.max(map.getZoom(), 15),
                    duration: 600,
                });
            }
            onSelectWikiPin(page.slug);
        },
        [isPinPlacementMode, map, onSelectWikiPin],
    );

    const {visiblePins, displayMode} = useMemo(
        () => filterPinsByViewportAndZoom(pins, viewport.zoom, viewport.bounds, selectedSlug),
        [pins, viewport.zoom, viewport.bounds, selectedSlug],
    );

    const pillOffsets = useMemo(() => {
        if (!map || displayMode === "hidden" || visiblePins.length === 0) {
            return new Map<string, { dx: number; dy: number }>();
        }
        // Trigger recalculation when viewport ticks cleanly
        void viewport.tick;

        const projectedObstacles: FixedObstacleBox[] = [];
        for (const obs of externalObstacles) {
            const pt = map.project([obs.lng, obs.lat]);
            projectedObstacles.push({
                x: pt.x,
                y: pt.y,
                width: obs.width,
                height: obs.height,
            });
        }

        const layoutInputs = visiblePins
            .filter(
                (p): p is WikiPageSummary & { lat: number; lng: number } =>
                    typeof p.lat === "number" && typeof p.lng === "number",
            )
            .map((page) => {
                const pt = map.project([page.lng, page.lat]);
                const tagLine =
                    displayMode === "full"
                        ? page.tags
                            .slice(0, 3)
                            .map((tag) => `#${tag}`)
                            .join(" ")
                        : "";
                const {width, height} = estimateWikiPinDimensions(
                    page.title,
                    tagLine,
                    displayMode,
                );
                const priority =
                    (page.slug === selectedSlug ? 1000 : 0) +
                    (page.pinned ? 100 : 0) +
                    (page.lat ?? 0) * 0.001;
                return {
                    id: page.slug,
                    x: pt.x,
                    y: pt.y,
                    width,
                    height,
                    priority,
                };
            });

        return solvePinOverlapLayout(layoutInputs, projectedObstacles);
    }, [map, displayMode, visiblePins, viewport.tick, externalObstacles, selectedSlug]);

    if (!enabled || displayMode === "hidden" || visiblePins.length === 0) {
        return null;
    }

    return (
        <>
            {visiblePins.map((page) => {
                if (typeof page.lat !== "number" || typeof page.lng !== "number") {
                    return null;
                }
                const theme = resolveWikiPinTheme(page.pinColor);
                const isSelected = selectedSlug === page.slug;
                const tagLine =
                    displayMode === "full"
                        ? page.tags
                            .slice(0, 3)
                            .map((tag) => `#${tag}`)
                            .join(" ")
                        : "";
                const offset = pillOffsets.get(page.slug) ?? {dx: 0, dy: 0};
                const hasShift = offset.dx !== 0 || offset.dy !== 0;

                return (
                    <Marker
                        key={`wiki-pin-${page.slug}`}
                        longitude={page.lng}
                        latitude={page.lat}
                        anchor="bottom"
                        style={{
                            zIndex: isSelected ? 35 : hasShift ? 25 : 24,
                            pointerEvents: "none",
                        }}
                    >
                        <div
                            className={`relative flex flex-col items-center select-none transition-opacity duration-200 ${
                                isPinPlacementMode ? "opacity-55 scale-95" : ""
                            }`}
                        >
                            {/* Leader connector stem when pill is dynamically shifted */}
                            {hasShift && (
                                <svg
                                    aria-hidden="true"
                                    className="pointer-events-none overflow-visible absolute bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0"
                                >
                                    <line
                                        x1={0}
                                        y1={0}
                                        x2={offset.dx}
                                        y2={offset.dy - 14}
                                        stroke="currentColor"
                                        strokeWidth={1.75}
                                        strokeDasharray="3 2.5"
                                        className="text-slate-500/80 dark:text-slate-300/75"
                                    />
                                </svg>
                            )}

                            {/* Movable interactive Pill */}
                            <div
                                role="button"
                                tabIndex={isPinPlacementMode ? -1 : 0}
                                style={{
                                    transform: `translate3d(${offset.dx}px, ${offset.dy}px, 0)`,
                                    pointerEvents: isPinPlacementMode ? "none" : "auto",
                                    cursor: isPinPlacementMode ? "crosshair" : "pointer",
                                }}
                                className="flex flex-col items-center group transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-full"
                                title={page.title}
                                onKeyDown={(e) => {
                                    if (isPinPlacementMode) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handlePinClick(page);
                                    }
                                }}
                                onClick={(e) => {
                                    if (isPinPlacementMode) return;
                                    e.stopPropagation();
                                    handlePinClick(page);
                                }}
                                onContextMenu={(e) => {
                                    if (isPinPlacementMode || !onPinContextMenu) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    clearLongPress();
                                    triggerHaptic("selection");
                                    onPinContextMenu(page, {x: e.clientX, y: e.clientY});
                                }}
                                onTouchStart={(e) => {
                                    if (isPinPlacementMode || !onPinContextMenu) return;
                                    const touch = e.touches[0];
                                    if (!touch) return;
                                    clearLongPress();
                                    suppressNextClickRef.current = false;
                                    touchStartRef.current = {x: touch.clientX, y: touch.clientY};
                                    longPressTimerRef.current = setTimeout(() => {
                                        suppressNextClickRef.current = true;
                                        triggerHaptic("selection");
                                        onPinContextMenu(page, {
                                            x: touch.clientX,
                                            y: touch.clientY,
                                        });
                                    }, LONG_PRESS_MS);
                                }}
                                onTouchMove={(e) => {
                                    if (!touchStartRef.current || !longPressTimerRef.current) return;
                                    const touch = e.touches[0];
                                    if (!touch) return;
                                    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
                                    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
                                    if (
                                        dx > TOUCH_MOVE_TOLERANCE_PX ||
                                        dy > TOUCH_MOVE_TOLERANCE_PX
                                    ) {
                                        clearLongPress();
                                    }
                                }}
                                onTouchEnd={() => clearLongPress()}
                                onTouchCancel={() => clearLongPress()}
                            >
                                {/* Pin Pill Label */}
                                <div
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg border backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-50 shadow-slate-900/12 dark:shadow-black/50 ring-1 transition-all ${
                                        theme.borderClass
                                    } ${
                                        isSelected
                                            ? "ring-2 ring-sky-500 dark:ring-sky-400 scale-105"
                                            : "ring-black/5 dark:ring-white/10"
                                    }`}
                                >
                                    <div
                                        className={`flex items-center justify-center w-5 h-5 rounded-full text-white shrink-0 shadow-2xs ${theme.badgeBg}`}
                                    >
                                        <MapPin className="w-2.5 h-2.5 stroke-[2.5]"/>
                                    </div>
                                    <div className="flex flex-col text-left leading-tight">
                                        {tagLine && (
                                            <span
                                                className={`text-[9.5px] font-bold max-w-[144px] truncate ${theme.pillTextClass}`}
                                            >
                                                {tagLine}
                                            </span>
                                        )}
                                        <span
                                            className="font-extrabold text-[11px] max-w-[144px] truncate text-slate-900 dark:text-white">
                                            {page.title}
                                        </span>
                                        <span className="sr-only"> ({UI_TEXT.WIKI.PIN_MARKER.ARIA(page.title)})</span>
                                    </div>
                                </div>

                                {/* Downward Pointer Triangle (only when directly over beacon dot) */}
                                {!hasShift && (
                                    <div
                                        className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/95 dark:border-t-slate-900/95 -mt-px"/>
                                )}
                            </div>

                            {/* Ground Beacon Dot (always anchored to exact coordinates) */}
                            <div
                                className="relative flex items-center justify-center w-2.5 h-2.5 -mt-0.5 pointer-events-none">
                                <span
                                    className={`relative inline-flex rounded-full h-2 w-2 border-[1.5px] border-white dark:border-slate-950 shadow-xs ${theme.dotBg}`}
                                />
                            </div>
                        </div>
                    </Marker>
                );
            })}
        </>
    );
});

export default WikiPinMarker;
