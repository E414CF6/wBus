"use client";

import React from "react";
import {MapPin, X} from "lucide-react";

export interface WikiPinLocationFieldsProps {
    lat: string;
    lng: string;
    onChangeLat: (next: string) => void;
    onChangeLng: (next: string) => void;
    onClear: () => void;
    onPickOnMap?: () => void;
}

export const WikiPinLocationFields: React.FC<WikiPinLocationFieldsProps> = ({
                                                                                lat,
                                                                                lng,
                                                                                onChangeLat,
                                                                                onChangeLng,
                                                                                onClear,
                                                                                onPickOnMap,
                                                                            }) => {
    const hasCoords = Boolean(lat.trim() || lng.trim());

    return (
        <div
            className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                    className="flex items-center gap-1.5 text-[11px] font-black text-emerald-800 dark:text-emerald-300">
                    <MapPin className="w-3.5 h-3.5 shrink-0"/>
                    <span>지도 핀 위치 좌표 (선택 · 입력 시 지도에 위키 핀으로 표시)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {onPickOnMap && (
                        <button
                            type="button"
                            onClick={onPickOnMap}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition cursor-pointer"
                        >
                            <MapPin className="w-3 h-3"/>
                            지도에서 위치 다시 고르기
                        </button>
                    )}
                    {hasCoords && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 transition cursor-pointer"
                        >
                            <X className="w-3 h-3"/>
                            좌표 비우기
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                        위도 (lat · 32~39.5)
                    </label>
                    <input
                        type="number"
                        step="0.000001"
                        value={lat}
                        onChange={(e) => onChangeLat(e.target.value)}
                        placeholder="예: 37.343832"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                        경도 (lng · 124~132.5)
                    </label>
                    <input
                        type="number"
                        step="0.000001"
                        value={lng}
                        onChange={(e) => onChangeLng(e.target.value)}
                        placeholder="예: 127.932123"
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                    />
                </div>
            </div>
        </div>
    );
};
