"use client";

import React from "react";
import {Marker} from "react-map-gl/maplibre";
import {Check, Crosshair, Loader2, MapPin, MapPinPlus, X} from "lucide-react";
import type {WikiPinColor} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {triggerHaptic} from "@shared/utils/haptics";
import {resolveWikiPinTheme} from "./lib/wikiPinTheme";

export interface WikiPinPlacementOverlayProps {
    mode?: "create" | "move";
    targetTitle?: string;
    pinColor?: WikiPinColor;
    isSubmitting?: boolean;
    coords: { lat: number; lng: number };
    onChangeCoords: (next: { lat: number; lng: number }) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export const WikiPinPlacementOverlay: React.FC<WikiPinPlacementOverlayProps> = ({
                                                                                    mode = "create",
                                                                                    targetTitle,
                                                                                    pinColor,
                                                                                    isSubmitting = false,
                                                                                    coords,
                                                                                    onChangeCoords,
                                                                                    onConfirm,
                                                                                    onCancel,
                                                                                }) => {
    const {map} = useAppMapContext();
    const isMove = mode === "move";
    const theme = resolveWikiPinTheme(pinColor);

    const handleMoveToMapCenter = () => {
        if (!map || isSubmitting) return;
        triggerHaptic("light");
        const center = map.getCenter();
        onChangeCoords({lat: center.lat, lng: center.lng});
    };

    const markerBgClass = isMove ? theme.badgeBg : "bg-emerald-600";
    const markerDotClass = isMove ? theme.dotBg : "bg-emerald-600";
    const markerLabel = isMove
        ? targetTitle
            ? UI_TEXT.WIKI.PLACEMENT.MOVE_TITLE(targetTitle)
            : UI_TEXT.WIKI.PLACEMENT.MOVE_DEFAULT
        : UI_TEXT.WIKI.PLACEMENT.CREATE_DEFAULT;
    const BannerIcon = isMove ? MapPin : MapPinPlus;

    return (
        <>
            {/* Draggable Target Pin Marker on Map */}
            <Marker
                longitude={coords.lng}
                latitude={coords.lat}
                anchor="bottom"
                draggable={!isSubmitting}
                style={{zIndex: 45, cursor: isSubmitting ? "wait" : "grab"}}
                onDragEnd={(e) => {
                    triggerHaptic("selection");
                    onChangeCoords({lat: e.lngLat.lat, lng: e.lngLat.lng});
                }}
            >
                <div className="relative flex flex-col items-center select-none pointer-events-auto">
                    <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-xl border border-white/40 text-white ring-4 ring-black/15 ${markerBgClass}`}
                    >
                        <BannerIcon className="w-3.5 h-3.5 shrink-0"/>
                        <span className="text-[11px] font-black whitespace-nowrap max-w-[160px] truncate">
                            {markerLabel}
                        </span>
                    </div>
                    <div
                        className={`w-0 h-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent -mt-px ${
                            isMove ? "border-t-slate-700 dark:border-t-slate-300" : "border-t-emerald-600"
                        }`}
                    />
                    <div className="relative flex items-center justify-center w-4 h-4 -mt-0.5">
                        <span
                            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${markerDotClass}`}
                        />
                        <span
                            className={`relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-white shadow-sm ${markerDotClass}`}
                        />
                    </div>
                </div>
            </Marker>

            {/* Top Guidance Banner */}
            <div
                style={{top: "var(--wbus-header-bottom, 5.5rem)"}}
                className="fixed left-1/2 lg:left-[calc(50%+198px)] xl:left-[calc(50%+218px)] -translate-x-1/2 z-[70] pointer-events-auto max-w-[calc(100vw-1.5rem)]"
            >
                <div
                    className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/92 dark:bg-white/95 text-white dark:text-slate-900 shadow-xl border border-white/15 dark:border-black/10 backdrop-blur-xl text-xs font-extrabold">
                    <BannerIcon className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0"/>
                    <span className="truncate">
                        {isMove
                            ? UI_TEXT.WIKI.PLACEMENT.BANNER_MOVE
                            : UI_TEXT.WIKI.PLACEMENT.BANNER_CREATE}
                    </span>
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleMoveToMapCenter}
                        title={UI_TEXT.WIKI.PLACEMENT.CENTER_TITLE}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 dark:bg-black/10 hover:bg-white/25 dark:hover:bg-black/15 text-[11px] font-black shrink-0 cursor-pointer disabled:opacity-50"
                    >
                        <Crosshair className="w-3 h-3"/>
                        <span className="hidden sm:inline">{UI_TEXT.WIKI.PLACEMENT.CENTER_LABEL}</span>
                    </button>
                </div>
            </div>

            {/* Bottom Confirmation Action Bar */}
            <div
                className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-1/2 lg:left-[calc(50%+198px)] xl:left-[calc(50%+218px)] -translate-x-1/2 z-[70] pointer-events-auto max-w-[calc(100vw-1.5rem)]">
                <div
                    className="flex flex-wrap items-center justify-center gap-2 p-2 pl-3.5 rounded-full bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-2xl border border-emerald-500/35 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                    <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </span>

                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                            triggerHaptic("selection");
                            onConfirm();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-60"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                        ) : (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]"/>
                        )}
                        <span>
                            {isMove
                                ? isSubmitting
                                    ? UI_TEXT.WIKI.PLACEMENT.SAVING_LOCATION
                                    : UI_TEXT.WIKI.PLACEMENT.CONFIRM_MOVE
                                : UI_TEXT.WIKI.PLACEMENT.CONFIRM_CREATE}
                        </span>
                    </button>

                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                            triggerHaptic("light");
                            onCancel();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.COMMON.CANCEL}</span>
                    </button>
                </div>
            </div>
        </>
    );
};
