"use client";

import React from "react";
import {Marker} from "react-map-gl/maplibre";
import {Check, Crosshair, MapPinPlus, X} from "lucide-react";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {triggerHaptic} from "@shared/utils/haptics";

export interface WikiPinPlacementOverlayProps {
    coords: { lat: number; lng: number };
    onChangeCoords: (next: { lat: number; lng: number }) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export const WikiPinPlacementOverlay: React.FC<WikiPinPlacementOverlayProps> = ({
                                                                                    coords,
                                                                                    onChangeCoords,
                                                                                    onConfirm,
                                                                                    onCancel,
                                                                                }) => {
    const {map} = useAppMapContext();

    const handleMoveToMapCenter = () => {
        if (!map) return;
        triggerHaptic("light");
        const center = map.getCenter();
        onChangeCoords({lat: center.lat, lng: center.lng});
    };

    return (
        <>
            {/* Draggable Target Pin Marker on Map */}
            <Marker
                longitude={coords.lng}
                latitude={coords.lat}
                anchor="bottom"
                draggable
                style={{zIndex: 45, cursor: "grab"}}
                onDragEnd={(e) => {
                    triggerHaptic("selection");
                    onChangeCoords({lat: e.lngLat.lat, lng: e.lngLat.lng});
                }}
            >
                <div className="relative flex flex-col items-center select-none pointer-events-auto">
                    <div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-xl border border-emerald-300 dark:border-emerald-400/60 bg-emerald-600 text-white ring-4 ring-emerald-500/25">
                        <MapPinPlus className="w-3.5 h-3.5 shrink-0"/>
                        <span className="text-[11px] font-black whitespace-nowrap">
                            새 위키 핀 위치
                        </span>
                    </div>
                    <div
                        className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-emerald-600 -mt-px"/>
                    <div className="relative flex items-center justify-center w-4 h-4 -mt-0.5">
                        <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                        <span
                            className="relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-white shadow-sm bg-emerald-600"/>
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
                    <MapPinPlus className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0"/>
                    <span className="truncate">
                        지도를 탭하거나 핀을 드래그해 새 위키 위치를 정하세요
                    </span>
                    <button
                        type="button"
                        onClick={handleMoveToMapCenter}
                        title="현재 화면 중심으로 핀 이동"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 dark:bg-black/10 hover:bg-white/25 dark:hover:bg-black/15 text-[11px] font-black shrink-0 cursor-pointer"
                    >
                        <Crosshair className="w-3 h-3"/>
                        <span className="hidden sm:inline">화면 중심</span>
                    </button>
                </div>
            </div>

            {/* Bottom Confirmation Action Bar */}
            <div
                className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-1/2 lg:left-[calc(50%+198px)] xl:left-[calc(50%+218px)] -translate-x-1/2 z-[70] pointer-events-auto max-w-[calc(100vw-1.5rem)]"
            >
                <div
                    className="flex flex-wrap items-center justify-center gap-2 p-2 pl-3.5 rounded-full bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-2xl border border-emerald-500/35 shadow-[0_14px_40px_rgba(0,0,0,0.25)]">
                    <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </span>

                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("selection");
                            onConfirm();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
                    >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]"/>
                        <span>이 위치에 새 문서 만들기</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("light");
                            onCancel();
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-extrabold transition cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5"/>
                        <span>취소</span>
                    </button>
                </div>
            </div>
        </>
    );
};
