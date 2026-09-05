"use client";

import React from "react";

import {YonseiShuttleStop} from "@data/yonseiShuttleStops";

interface ShuttleStopSelectorProps {
    stops: YonseiShuttleStop[];
    selectedStopId: string;
    onSelectStop: (stop: YonseiShuttleStop) => void;
}

export const ShuttleStopSelector: React.FC<ShuttleStopSelectorProps> = ({
                                                                            stops,
                                                                            selectedStopId,
                                                                            onSelectStop,
                                                                        }) => {
    return (
        <div className="w-full flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 px-1">
            {stops.map((stop) => {
                const isSelected = stop.id === selectedStopId;
                return (
                    <button
                        key={stop.id}
                        onClick={() => onSelectStop(stop)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                            isSelected
                                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25 scale-[1.02]"
                                : "bg-slate-100/90 hover:bg-slate-200/90 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/5"
                        }`}
                    >
                        <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isSelected
                                    ? "bg-white text-blue-600"
                                    : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                            }`}
                        >
                            {stop.number}
                        </span>
                        <span className="truncate">{stop.shortName}</span>
                        <span
                            className={`text-[10px] px-1 rounded ${
                                isSelected
                                    ? "bg-blue-500/50 text-white"
                                    : "bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400"
                            }`}
                        >
                            {stop.directionTag}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
