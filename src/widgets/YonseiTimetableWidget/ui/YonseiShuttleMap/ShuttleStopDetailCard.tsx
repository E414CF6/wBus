"use client";

import React from "react";
import {getKakaoMapUrl, getKakaoRoadviewUrl, YonseiShuttleStop,} from "@/data/yonseiShuttleStops";
import {Camera, ExternalLink, Info, MapPin, Navigation} from "lucide-react";

interface ShuttleStopDetailCardProps {
    stop: YonseiShuttleStop;
    onViewRoadviewClick?: () => void;
    currentViewMode?: "map" | "roadview" | "split";
}

export const ShuttleStopDetailCard: React.FC<ShuttleStopDetailCardProps> = ({
                                                                                stop,
                                                                            }) => {
    const kakaoMapUrl = getKakaoMapUrl(stop.name, stop.lat, stop.lng);
    const kakaoRoadviewUrl = getKakaoRoadviewUrl(stop.lat, stop.lng);

    return (
        <div
            className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            {/* Stop Info */}
            <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span
                        className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {stop.number}
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                        {stop.name}
                    </h3>
                    <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            stop.directionTag === "학교방면"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                                : stop.directionTag === "시내방면"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                    : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30"
                        }`}
                    >
                        {stop.directionTag}
                    </span>
                </div>

                <div
                    className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"/>
                    <span>{stop.locationDescription}</span>
                </div>

                {stop.tips && (<div
                    className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300/90 font-medium">
                    <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"/>
                    <span>{stop.tips}</span>
                </div>)}
            </div>

            {/* Actions: Open Roadview or Map Link in New Tab */}
            <div
                className="flex flex-wrap items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
                <a
                    href={kakaoRoadviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer"
                    title="카카오 로드뷰 보기 (새 창)"
                >
                    <Camera className="w-3.5 h-3.5"/>
                    <span>로드뷰 보기</span>
                    <ExternalLink className="w-3 h-3 opacity-80"/>
                </a>

                <a
                    href={kakaoMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs active:scale-95"
                    title="카카오맵 길찾기"
                >
                    <Navigation className="w-3 h-3"/>
                    <span>길찾기</span>
                </a>
            </div>
        </div>
    );
};
