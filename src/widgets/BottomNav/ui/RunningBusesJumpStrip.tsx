"use client";

import React from "react";
import {Bus} from "lucide-react";
import type {RouteVariationStop} from "@entities/route";
import type {MatchedBusStopEntry} from "../hooks/useBusStopMatcher";

interface RunningBusesJumpStripProps {
    jumpStripRef: React.RefObject<HTMLDivElement | null>;
    matchedBusesForJump: MatchedBusStopEntry[];
    nearestBusVehicleNo: string | null;
    metaThemeBg?: string;
    metaThemeBadgeBg?: string;
    metaThemeText?: string;
    metaThemeBorder?: string;
    onJumpToBusStop: (stopKey: string, stop: RouteVariationStop, vehicleno?: string) => void;
}

export const RunningBusesJumpStrip: React.FC<RunningBusesJumpStripProps> = ({
    jumpStripRef,
    matchedBusesForJump,
    nearestBusVehicleNo,
    metaThemeBg,
    metaThemeBadgeBg,
    metaThemeText,
    metaThemeBorder,
    onJumpToBusStop,
}) => {
    if (matchedBusesForJump.length === 0) return null;

    return (
        <div
            ref={jumpStripRef}
            className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto custom-scrollbar-hidden shrink-0"
        >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0 mr-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"/>
                운행중
            </span>
            {matchedBusesForJump.map(({stopKey, stop, plateDigits, bus}) => {
                const isNearestBus = nearestBusVehicleNo === bus.vehicleno;
                return (
                    <button
                        key={`${bus.vehicleno}-${stopKey}`}
                        type="button"
                        data-bus-jump={bus.vehicleno}
                        onClick={() => onJumpToBusStop(stopKey, stop, bus.vehicleno)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer whitespace-nowrap active:scale-95 shrink-0 ${
                            isNearestBus
                                ? `${metaThemeBg || "bg-blue-600"} text-white border-transparent shadow-xs`
                                : `${metaThemeBadgeBg || "bg-blue-500/10 dark:bg-blue-500/20"} ${metaThemeText || "text-blue-700 dark:text-blue-300"} ${metaThemeBorder || "border-blue-500/25"}`
                        }`}
                        title={`${bus.vehicleno} (${stop.nodenm}) 위치로 스크롤`}
                    >
                        <Bus className="w-3 h-3 shrink-0"/>
                        <span className="font-mono font-black">{plateDigits}</span>
                        <span className="opacity-75 max-w-[90px] truncate">· {stop.nodenm}</span>
                    </button>
                );
            })}
        </div>
    );
};
