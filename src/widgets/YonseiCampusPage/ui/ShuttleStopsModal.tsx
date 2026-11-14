"use client";

import React, {useId, useMemo, useRef, useState} from "react";
import {Camera, ExternalLink, Info, MapPin, Navigation, X} from "lucide-react";

import {
    getKakaoMapUrl,
    getKakaoRoadviewUrl,
    YONSEI_SHUTTLE_STOPS,
    type YonseiShuttleStop,
} from "@entities/station";
import {UI_TEXT} from "@shared/config/locale";
import {useDialogModal} from "@shared/lib/useDialogModal";
import type {CampusDirectionMode} from "../lib/yonseiShuttleUtils";

export interface ShuttleStopsModalProps {
    isOpen: boolean;
    initialDirectionMode: CampusDirectionMode;
    onClose: () => void;
}

type StopDirectionFilter = "ALL" | "시내방면" | "학교방면";

function mapDirectionModeToFilter(mode: CampusDirectionMode): StopDirectionFilter {
    return mode === "OUTBOUND" ? "시내방면" : "학교방면";
}

export const ShuttleStopsModal: React.FC<ShuttleStopsModalProps> = ({
    isOpen,
    initialDirectionMode,
    onClose,
}) => {
    const [dirFilter, setDirFilter] = useState<StopDirectionFilter>(() =>
        mapDirectionModeToFilter(initialDirectionMode)
    );
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useDialogModal(dialogRef, isOpen);

    const filteredStops = useMemo<YonseiShuttleStop[]>(() => {
        if (dirFilter === "ALL") return YONSEI_SHUTTLE_STOPS;
        return YONSEI_SHUTTLE_STOPS.filter((s) => s.directionTag === dirFilter);
    }, [dirFilter]);

    return (
        <dialog
            ref={dialogRef}
            {...({closedby: "any"} as Record<string, unknown>)}
            onClose={onClose}
            aria-labelledby={titleId}
            className="m-auto w-full sm:max-w-2xl max-h-[90dvh] open:flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#111623] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden p-0 mb-0 sm:mb-auto"
        >
            {/* Header */}
            <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] space-y-3 shrink-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-2xl bg-[#003876]/10 dark:bg-blue-500/15 text-[#003876] dark:text-blue-400 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4"/>
                        </span>
                        <div className="min-w-0">
                            <h3
                                id={titleId}
                                className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate"
                            >
                                셔틀버스 {UI_TEXT.YONSEI_SHUTTLE.STOPS_LOCATION_TAB}
                            </h3>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                {UI_TEXT.YONSEI_SHUTTLE.STOPS_NOTICE}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={UI_TEXT.ACCESSIBILITY.CLOSE_MODAL}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-white/20 transition-colors shrink-0 cursor-pointer"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>

                {/* Direction Filter Tabs */}
                <div
                    role="tablist"
                    aria-label="탑승 장소 방향 필터"
                    className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-white/[0.06] overflow-x-auto no-scrollbar max-w-full"
                >
                    {(["시내방면", "학교방면", "ALL"] as const).map((tab) => {
                        const label = tab === "ALL" ? UI_TEXT.YONSEI_SHUTTLE.FILTER_ALL : tab;
                        const isActive = dirFilter === tab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setDirFilter(tab)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap flex-none ${
                                    isActive
                                        ? "bg-white dark:bg-[#1b2234] text-[#003876] dark:text-blue-300 shadow-xs border-b-2 border-[#003876] dark:border-blue-400"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredStops.map((stop) => {
                        const kakaoMapUrl = getKakaoMapUrl(stop.name, stop.lat, stop.lng);
                        const kakaoRoadviewUrl = getKakaoRoadviewUrl(stop.lat, stop.lng);

                        return (
                            <div
                                key={stop.id}
                                className="flex flex-col justify-between rounded-2xl p-4 bg-slate-50/85 dark:bg-white/[0.03] border border-slate-200/75 dark:border-white/[0.08] space-y-3"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-black text-slate-900 dark:text-white">
                                            {stop.name}
                                        </span>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                                stop.directionTag === "시내방면"
                                                    ? "bg-blue-500/12 text-blue-700 dark:text-blue-300"
                                                    : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                            }`}
                                        >
                                            {stop.directionTag}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {stop.locationDescription}
                                    </p>
                                    {stop.tips && (
                                        <p className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.06] rounded-xl px-2.5 py-2">
                                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#003876] dark:text-blue-400"/>
                                            <span>{stop.tips}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <a
                                        href={kakaoMapUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/15 border border-slate-200/80 dark:border-white/10 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition-colors"
                                    >
                                        <Navigation className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                                        <span>카카오맵</span>
                                        <ExternalLink className="w-3 h-3 opacity-60"/>
                                    </a>
                                    <a
                                        href={kakaoRoadviewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/15 border border-slate-200/80 dark:border-white/10 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition-colors"
                                    >
                                        <Camera className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"/>
                                        <span>로드뷰</span>
                                        <ExternalLink className="w-3 h-3 opacity-60"/>
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </dialog>
    );
};
