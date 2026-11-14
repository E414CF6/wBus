"use client";

import React from "react";
import {MapPin, Navigation, Star} from "lucide-react";
import type {BusStop} from "@entities/station/types";

interface MatchedStopsSectionProps {
    matchedStops: BusStop[];
    isFavStopsCategoryOnly: boolean;
    isFavoriteStop: (nodeid: string) => boolean;
    onSelectStop: (stop: BusStop) => void;
    onToggleFavoriteStop: (stop: BusStop) => void;
}

export const MatchedStopsSection: React.FC<MatchedStopsSectionProps> = ({
    matchedStops,
    isFavStopsCategoryOnly,
    isFavoriteStop,
    onSelectStop,
    onToggleFavoriteStop,
}) => (
    <div>
        <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500"/>
                <span>
                    {isFavStopsCategoryOnly
                        ? `즐겨찾는 정류장 (${matchedStops.length})`
                        : `정류장 검색 결과 (${matchedStops.length})`}
                </span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
                선택 시 해당 정류장 도착정보 팝업 열림
            </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {matchedStops.map((stop) => {
                const isFav = isFavoriteStop(stop.nodeid);
                return (
                    <div
                        key={`modal-stop-${stop.nodeid}`}
                        onClick={() => onSelectStop(stop)}
                        className="group flex items-center justify-between p-3 rounded-2xl bg-amber-500/[0.04] hover:bg-amber-500/[0.1] dark:bg-amber-400/[0.05] dark:hover:bg-amber-400/[0.12] border border-amber-500/20 transition-all cursor-pointer select-none active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                                <Navigation className="w-4 h-4"/>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                    {stop.nodenm}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                    {stop.nodeno ? `정류장 번호 ${stop.nodeno}` : "실시간 도착정보 보기"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavoriteStop(stop);
                            }}
                            className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                                isFav
                                    ? "text-amber-500 hover:text-amber-600"
                                    : "text-slate-300 dark:text-slate-600 hover:text-amber-500"
                            }`}
                            title={isFav ? "정류장 즐겨찾기 해제" : "정류장 즐겨찾기 추가"}
                        >
                            <Star className={`w-4 h-4 ${isFav ? "fill-amber-500" : ""}`}/>
                        </button>
                    </div>
                );
            })}
        </div>
    </div>
);
