"use client";

import React from "react";
import {Clock, RotateCw} from "lucide-react";
import type {getNextDeparture} from "@entities/schedule";

type NextDepartureInfo = ReturnType<typeof getNextDeparture>;

interface NextDepartureCardsProps {
    nextDepInfo: NextDepartureInfo;
    dayType: string;
    originName: string;
    destName: string;
    hourlyLocation: "origin" | "dest";
    onSelectLocation: (loc: "origin" | "dest") => void;
    embedded?: boolean;
}

export const NextDepartureCards: React.FC<NextDepartureCardsProps> = ({
    nextDepInfo,
    dayType,
    originName,
    destName,
    hourlyLocation,
    onSelectLocation,
    embedded = false,
}) => (
    <div className={`grid ${embedded ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-2.5`}>
        <div
            onClick={() => onSelectLocation("origin")}
            className={`p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border transition-all duration-200 cursor-pointer ${
                hourlyLocation === "origin"
                    ? "border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/50 shadow-md"
                    : "border-blue-200 dark:border-blue-900/60 opacity-80 hover:opacity-100"
            } flex items-center justify-between gap-2`}
            title={`기점(${originName}) 기준으로 시간표 보기`}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                    <Clock className="w-3 h-3 shrink-0"/>
                    <span className="truncate">기점 ({originName}) 출발</span>
                    {hourlyLocation === "origin" && (
                        <span className="px-1.5 py-0.2 rounded-md bg-blue-600 text-[9px] font-black text-white shrink-0">
                            기준 정류장
                        </span>
                    )}
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                    {nextDepInfo.nextOrigin ? (
                        <>
                            <span className="font-mono text-xl font-black text-blue-900 dark:text-blue-100">
                                {nextDepInfo.nextOrigin.originDepTime}
                            </span>
                            <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                (
                                {nextDepInfo.originWaitMins !== null &&
                                    (nextDepInfo.originWaitMins <= 0
                                        ? "곧 출발"
                                        : `${nextDepInfo.originWaitMins}분 후`)}
                                )
                            </span>
                        </>
                    ) : (
                        <span className="text-xs font-bold text-slate-400">금일 운행 종료</span>
                    )}
                </div>
                {nextDepInfo.nextOrigin?.notes && (
                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-1">
                        ※ {nextDepInfo.nextOrigin.notes}
                    </div>
                )}
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-700 dark:text-blue-300 shrink-0 self-start">
                {dayType}
            </span>
        </div>

        <div
            onClick={() => onSelectLocation("dest")}
            className={`p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border transition-all duration-200 cursor-pointer ${
                hourlyLocation === "dest"
                    ? "border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/50 shadow-md"
                    : "border-amber-200 dark:border-amber-900/60 opacity-80 hover:opacity-100"
            } flex items-center justify-between gap-2`}
            title={`회차지(${destName}) 기준으로 시간표 보기`}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    <RotateCw className="w-3 h-3 shrink-0"/>
                    <span className="truncate">회차지 ({destName}) 출발</span>
                    {hourlyLocation === "dest" && (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-600 text-[9px] font-black text-white shrink-0">
                            기준 정류장
                        </span>
                    )}
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                    {nextDepInfo.nextDest ? (
                        <>
                            <span className="font-mono text-xl font-black text-amber-900 dark:text-amber-100">
                                {nextDepInfo.nextDest.destDepTime}
                            </span>
                            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                (
                                {nextDepInfo.destWaitMins !== null &&
                                    (nextDepInfo.destWaitMins <= 0
                                        ? "곧 출발"
                                        : `${nextDepInfo.destWaitMins}분 후`)}
                                )
                            </span>
                        </>
                    ) : (
                        <span className="text-xs font-bold text-slate-400">금일 운행 종료</span>
                    )}
                </div>
                {nextDepInfo.nextDest?.notes && (
                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                        ※ {nextDepInfo.nextDest.notes}
                    </div>
                )}
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-[10px] font-black text-amber-700 dark:text-amber-300 shrink-0 self-start">
                {dayType}
            </span>
        </div>
    </div>
);
