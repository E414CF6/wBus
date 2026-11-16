"use client";

import React from "react";
import {MapPin, X} from "lucide-react";

export interface WikiPinLocationFieldsProps {
    lat?: number;
    lng?: number;
    onClear: () => void;
    onPickOnMap?: () => void;
}

export const WikiPinLocationFields: React.FC<WikiPinLocationFieldsProps> = ({
                                                                                lat,
                                                                                lng,
                                                                                onClear,
                                                                                onPickOnMap,
                                                                            }) => {
    const hasCoords =
        typeof lat === "number" &&
        Number.isFinite(lat) &&
        typeof lng === "number" &&
        Number.isFinite(lng);

    return (
        <div
            className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 shrink-0">
                    <MapPin className="w-3.5 h-3.5"/>
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-black text-emerald-900 dark:text-emerald-200">
                        {hasCoords ? "지도 핀 위치 지정됨" : "지도 핀 위치 미지정 (선택)"}
                    </p>
                    <p className="text-[10.5px] font-mono text-emerald-700/80 dark:text-emerald-300/80 truncate tabular-nums">
                        {hasCoords
                            ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                            : "지도에서 직접 마커를 이동해 핀 위치를 지정할 수 있습니다."}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                {onPickOnMap && (
                    <button
                        type="button"
                        onClick={onPickOnMap}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition cursor-pointer"
                    >
                        <MapPin className="w-3 h-3"/>
                        <span>{hasCoords ? "지도에서 핀 이동" : "지도에서 위치 지정"}</span>
                    </button>
                )}
                {hasCoords && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-slate-900/70 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 transition cursor-pointer"
                    >
                        <X className="w-3 h-3"/>
                        <span>핀 제거</span>
                    </button>
                )}
            </div>
        </div>
    );
};
