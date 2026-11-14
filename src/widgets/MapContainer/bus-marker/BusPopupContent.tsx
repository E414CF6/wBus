"use client";

import React, {memo} from "react";
import {LocateFixed, Navigation} from "lucide-react";
import type {BusItem} from "@entities/bus/types";
import {UI_TEXT} from "@shared/config/locale";

interface BusPopupContentProps {
    bus: BusItem;
    routeName?: string;
    stopName: string;
    DirectionIcon: React.ElementType;
    themeColor?: string;
    direction?: number | null;
    isFollowed?: boolean;
    onToggleFollow?: () => void;
}

export const BusPopupContent = memo(
    ({
        bus,
        routeName,
        stopName,
        DirectionIcon,
        themeColor,
        direction,
        isFollowed,
        onToggleFollow,
    }: BusPopupContentProps) => {
        const directionLabel =
            direction === 1
                ? "상행"
                : direction === 0
                    ? "하행"
                    : "운행 중";

        return (
            <div className="min-w-64 sm:min-w-72 flex flex-col bg-white/95 dark:bg-[#111116]/95 backdrop-blur-3xl rounded-3xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-black/10 dark:border-white/10">
                <div className="bg-transparent px-4 py-3.5 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between gap-2 text-black dark:text-white">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div
                                className="p-1.5 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                                style={{backgroundColor: themeColor || "#2563eb"}}
                            >
                                <DirectionIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true"/>
                            </div>
                            <span className="font-black text-lg tracking-tight leading-none truncate">
                                {UI_TEXT.BUS_LIST.TITLE_ROUTE(bus.routenm || routeName || "")}
                            </span>
                        </div>
                        <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0"
                            style={{
                                backgroundColor: `${themeColor || "#2563eb"}18`,
                                color: themeColor || "#2563eb",
                                border: `1px solid ${themeColor || "#2563eb"}35`,
                            }}
                        >
                            {directionLabel}
                        </span>
                    </div>
                </div>

                <div className="px-4 py-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                            {UI_TEXT.BUS_ITEM.VEHICLE_NUM}
                        </span>
                        <div className="font-mono font-black text-xs text-slate-800 dark:text-slate-100 bg-black/5 dark:bg-white/10 px-2.5 py-1 rounded-xl border border-black/5 dark:border-white/10 tracking-tight">
                            {bus.vehicleno}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                            {UI_TEXT.BUS_ITEM.CURRENT_LOC}
                        </span>
                        <div className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-100 min-w-0">
                            <p className="truncate max-w-[155px] font-bold" title={stopName}>{stopName}</p>
                        </div>
                    </div>

                    {onToggleFollow && (
                        <button
                            type="button"
                            onClick={onToggleFollow}
                            className={`w-full mt-1.5 py-2 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                                isFollowed
                                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-500/30"
                                    : "bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                            }`}
                        >
                            {isFollowed ? (
                                <>
                                    <Navigation className="w-3.5 h-3.5 animate-pulse"/>
                                    <span>버스 따라가는 중</span>
                                </>
                            ) : (
                                <>
                                    <LocateFixed className="w-3.5 h-3.5"/>
                                    <span>버스 따라가기</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        );
    }
);

BusPopupContent.displayName = "BusPopupContent";
