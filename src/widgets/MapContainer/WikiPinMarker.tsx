"use client";

import React, {memo, useCallback} from "react";
import {Marker} from "react-map-gl/maplibre";
import {useWikiPins, type WikiPageSummary} from "@entities/wiki";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {triggerHaptic} from "@shared/utils/haptics";
import {WIKI_CATEGORY_PIN_STYLES} from "./lib/wikiPinTheme";

export interface WikiPinMarkerProps {
    enabled?: boolean;
    selectedSlug?: string | null;
    isPinPlacementMode?: boolean;
    onSelectWikiPin: (slug: string) => void;
}

export const WikiPinMarker = memo(function WikiPinMarker({
                                                             enabled = true,
                                                             selectedSlug = null,
                                                             isPinPlacementMode = false,
                                                             onSelectWikiPin,
                                                         }: WikiPinMarkerProps) {
    const {map} = useAppMapContext();
    const {data} = useWikiPins({enabled});
    const pins = data?.pages ?? [];

    const handlePinClick = useCallback(
        (page: WikiPageSummary) => {
            if (isPinPlacementMode) return;
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
        [isPinPlacementMode, map, onSelectWikiPin]
    );

    if (!enabled || pins.length === 0) {
        return null;
    }

    return (
        <>
            {pins.map((page) => {
                if (typeof page.lat !== "number" || typeof page.lng !== "number") {
                    return null;
                }
                const style = WIKI_CATEGORY_PIN_STYLES[page.category] ?? WIKI_CATEGORY_PIN_STYLES.guide;
                const Icon = style.icon;
                const isSelected = selectedSlug === page.slug;

                return (
                    <Marker
                        key={`wiki-pin-${page.slug}`}
                        longitude={page.lng}
                        latitude={page.lat}
                        anchor="bottom"
                        style={{
                            zIndex: isSelected ? 35 : 24,
                            pointerEvents: isPinPlacementMode ? "none" : "auto",
                            cursor: isPinPlacementMode ? "crosshair" : "pointer",
                        }}
                        onClick={(e) => {
                            if (isPinPlacementMode) return;
                            e.originalEvent?.stopPropagation();
                            handlePinClick(page);
                        }}
                    >
                        <div
                            className={`relative flex flex-col items-center select-none group transition-all duration-200 ${
                                isPinPlacementMode
                                    ? "opacity-55 scale-95"
                                    : "hover:scale-105 active:scale-95"
                            }`}
                            title={`위키: ${page.title}`}
                            aria-label={`위키 핀: ${page.title}`}
                        >
                            {/* Pin Pill Label */}
                            <div
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg border backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-50 shadow-slate-900/12 dark:shadow-black/50 ring-1 transition-all ${
                                    style.borderClass
                                } ${
                                    isSelected
                                        ? "ring-2 ring-sky-500 dark:ring-sky-400 scale-105"
                                        : "ring-black/5 dark:ring-white/10"
                                }`}
                            >
                                <div
                                    className={`flex items-center justify-center w-5 h-5 rounded-full text-white shrink-0 shadow-2xs ${style.badgeBg}`}
                                >
                                    <Icon className="w-2.5 h-2.5 stroke-[2.5]"/>
                                </div>
                                <div className="flex flex-col text-left leading-tight">
                                    <span
                                        className={`text-[9px] uppercase font-black tracking-wider ${style.pillTextClass}`}
                                    >
                                        위키 · {style.shortLabel}
                                    </span>
                                    <span
                                        className="font-extrabold text-[11px] max-w-[120px] truncate text-slate-900 dark:text-white">
                                        {page.title}
                                    </span>
                                </div>
                            </div>

                            {/* Downward Pointer Triangle */}
                            <div
                                className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/95 dark:border-t-slate-900/95 -mt-px"/>

                            {/* Ground Beacon Dot */}
                            <div className="relative flex items-center justify-center w-2.5 h-2.5 -mt-0.5">
                                <span
                                    className={`relative inline-flex rounded-full h-2 w-2 border-[1.5px] border-white dark:border-slate-950 shadow-xs ${style.dotBg}`}
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
