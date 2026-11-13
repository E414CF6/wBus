"use client";

import dynamic from "next/dynamic";
import React, {memo, useMemo, useState} from "react";
import {Camera, ExternalLink, Info, MapPin, Navigation} from "lucide-react";

import {getKakaoMapUrl, getKakaoRoadviewUrl, YONSEI_SHUTTLE_STOPS, type YonseiShuttleStop,} from "@entities/station";
import {UI_TEXT} from "@shared/config/locale";
import type {CampusDirectionMode} from "../lib/yonseiShuttleUtils";

const ShuttleMiniMap = dynamic(() => import("./ShuttleMiniMap"), {
    ssr: false,
    loading: () => (
        <div
            className="w-full h-[300px] sm:h-[360px] rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse flex items-center justify-center text-xs font-bold text-slate-400">
            셔틀 승강장 지도를 불러오는 중...
        </div>
    ),
});

export interface YonseiShuttleStopsSectionProps {
    directionMode: CampusDirectionMode;
}

type StopDirectionFilter = "ALL" | "시내방면" | "학교방면";

function mapDirectionModeToFilter(mode: CampusDirectionMode): StopDirectionFilter {
    return mode === "OUTBOUND" ? "시내방면" : "학교방면";
}

export const YonseiShuttleStopsSection: React.FC<YonseiShuttleStopsSectionProps> = memo(
    function YonseiShuttleStopsSection({directionMode}) {
        const [dirFilter, setDirFilter] = useState<StopDirectionFilter>(() =>
            mapDirectionModeToFilter(directionMode)
        );
        const [prevDirectionMode, setPrevDirectionMode] = useState<CampusDirectionMode>(directionMode);
        const [selectedStopId, setSelectedStopId] = useState<string>(() => {
            const targetTag = mapDirectionModeToFilter(directionMode);
            return (
                YONSEI_SHUTTLE_STOPS.find((s) => s.directionTag === targetTag)?.id ??
                YONSEI_SHUTTLE_STOPS[0].id
            );
        });

        // Sync stop filter when parent directionMode changes (render-phase state sync)
        if (directionMode !== prevDirectionMode) {
            setPrevDirectionMode(directionMode);
            const nextFilter = mapDirectionModeToFilter(directionMode);
            setDirFilter(nextFilter);
            const preferredStop =
                directionMode === "OUTBOUND"
                    ? YONSEI_SHUTTLE_STOPS.find((s) => s.id === "mirae-hall") ??
                    YONSEI_SHUTTLE_STOPS.find((s) => s.directionTag === "시내방면")
                    : YONSEI_SHUTTLE_STOPS.find((s) => s.directionTag === "학교방면");
            if (preferredStop) {
                setSelectedStopId(preferredStop.id);
            }
        }

        const filteredStops = useMemo<YonseiShuttleStop[]>(() => {
            if (dirFilter === "ALL") return YONSEI_SHUTTLE_STOPS;
            return YONSEI_SHUTTLE_STOPS.filter((s) => s.directionTag === dirFilter);
        }, [dirFilter]);

        const selectedStop = useMemo<YonseiShuttleStop>(() => {
            return (
                filteredStops.find((s) => s.id === selectedStopId) ??
                filteredStops[0] ??
                YONSEI_SHUTTLE_STOPS[0]
            );
        }, [filteredStops, selectedStopId]);

        const kakaoMapUrl = getKakaoMapUrl(selectedStop.name, selectedStop.lat, selectedStop.lng);
        const kakaoRoadviewUrl = getKakaoRoadviewUrl(selectedStop.lat, selectedStop.lng);

        return (
            <section
                className="rounded-3xl p-4 sm:p-6 bg-white/90 dark:bg-[#111520]/90 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 shadow-sm space-y-4">
                {/* Header & Direction Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="flex items-center justify-center w-9 h-9 rounded-2xl bg-teal-600 text-white shadow-xs shrink-0">
                            <MapPin className="w-4 h-4"/>
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                셔틀버스 탑승 장소 안내
                            </h2>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {UI_TEXT.YONSEI_SHUTTLE.STOPS_NOTICE}
                            </p>
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-white/5 p-1 self-start sm:self-auto shrink-0">
                        {(
                            [
                                {id: "ALL", label: "전체 승강장"},
                                {id: "시내방면", label: "하교·시내방면"},
                                {id: "학교방면", label: "등교·학교방면"},
                            ] as const
                        ).map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setDirFilter(opt.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer whitespace-nowrap ${
                                    dirFilter === opt.id
                                        ? "bg-white dark:bg-[#1f2433] text-slate-900 dark:text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stop Selection Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden pb-1">
                    {filteredStops.map((stop) => {
                        const isSelected = stop.id === selectedStop.id;
                        return (
                            <button
                                key={stop.id}
                                type="button"
                                onClick={() => setSelectedStopId(stop.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                                    isSelected
                                        ? "bg-[#003876] text-white border-[#003876] shadow-xs"
                                        : "bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-200 border-black/5 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                }`}
                            >
                                <span>{stop.shortName}</span>
                                <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                        isSelected
                                            ? "bg-white/20 text-white"
                                            : stop.directionTag === "학교방면"
                                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    }`}
                                >
                                    {stop.directionTag}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Interactive MiniMap */}
                <ShuttleMiniMap
                    stops={filteredStops}
                    selectedStop={selectedStop}
                    onSelectStop={(stop) => setSelectedStopId(stop.id)}
                />

                {/* Selected Stop Detail Card */}
                <div
                    className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className="w-5 h-5 rounded-full bg-[#003876] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                                {selectedStop.number}
                            </span>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                                {selectedStop.name}
                            </h3>
                            <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    selectedStop.directionTag === "학교방면"
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                }`}
                            >
                                {selectedStop.directionTag}
                            </span>
                        </div>

                        <div
                            className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"/>
                            <span>{selectedStop.locationDescription}</span>
                        </div>

                        {selectedStop.tips && (
                            <div
                                className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                                <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"/>
                                <span>{selectedStop.tips}</span>
                            </div>
                        )}
                    </div>

                    <div
                        className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
                        <a
                            href={kakaoRoadviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black transition-all shadow-sm active:scale-95"
                        >
                            <Camera className="w-3.5 h-3.5"/>
                            <span>로드뷰 보기</span>
                            <ExternalLink className="w-3 h-3 opacity-80"/>
                        </a>
                        <a
                            href={kakaoMapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
                        >
                            <Navigation className="w-3.5 h-3.5"/>
                            <span>카카오맵 길찾기</span>
                        </a>
                    </div>
                </div>
            </section>
        );
    }
);

YonseiShuttleStopsSection.displayName = "YonseiShuttleStopsSection";
