"use client";

import {MapPin, Sparkles} from "lucide-react";
import React from "react";
import type {ShuttleViaStop, YonseiShuttleItem} from "../../types";

interface ShuttleScheduleListProps {
    items: YonseiShuttleItem[];
    nextIdx: number;
    isInbound: boolean;
    emptyMessage: string;
}

export const ShuttleScheduleList: React.FC<ShuttleScheduleListProps> = ({
                                                                            items,
                                                                            nextIdx,
                                                                            isInbound,
                                                                            emptyMessage,
                                                                        }) => {
    if (items.length === 0) {
        return (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
                {emptyMessage}
            </div>
        );
    }

    const theme = isInbound
        ? {
            nextBg:
                "bg-teal-500/[0.08] dark:bg-teal-500/[0.14] border-teal-500 ring-2 ring-teal-500/40 shadow-md",
            hoverBorder: "hover:border-teal-500/30",
            destText: "text-teal-700 dark:text-teal-300",
            badgeBg: "bg-teal-600 text-white",
            viaActiveBadge:
                "bg-teal-50/90 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 border-teal-300 dark:border-teal-500/40 font-bold",
            viaTimeText: "text-teal-600 dark:text-teal-400",
            operationBadge:
                "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/30",
        }
        : {
            nextBg:
                "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] border-emerald-500 ring-2 ring-emerald-500/40 shadow-md",
            hoverBorder: "hover:border-emerald-500/30",
            destText: "text-emerald-700 dark:text-emerald-300",
            badgeBg: "bg-emerald-600 text-white",
            viaActiveBadge:
                "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/40 font-bold",
            viaTimeText: "text-emerald-600 dark:text-emerald-400",
            operationBadge:
                "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30",
        };

    return (
        <div className="space-y-3">
            {items.map((item, idx) => {
                const isNext = idx === nextIdx;
                const isSundayItem = item.operation_type.includes("일요일");

                return (
                    <div
                        key={idx}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                            isNext
                                ? theme.nextBg
                                : `bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 ${theme.hoverBorder}`
                        }`}
                    >
                        {/* Top Row: Operation type, Departure time & point, Destination */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span
                                    className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
                                    {item.departure_time}
                                </span>
                                <span
                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                        isSundayItem
                                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30"
                                            : theme.operationBadge
                                    }`}
                                >
                                    {item.operation_type}
                                </span>
                                {item.note && (
                                    <span
                                        className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold border border-blue-200 dark:border-blue-500/30">
                                        {item.note}
                                    </span>
                                )}
                                {!isInbound && (
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        출발: <strong>{item.departure_point}</strong>
                                    </span>
                                )}
                                {isNext && (
                                    <span
                                        className={`px-2 py-0.5 rounded-lg ${theme.badgeBg} text-[10px] font-black shadow-xs animate-pulse`}
                                    >
                                        다음 버스
                                    </span>
                                )}
                            </div>

                            <div
                                className={`text-xs font-black ${theme.destText} shrink-0 flex items-center gap-1`}
                            >
                                <span>{isInbound ? item.destination : `→ ${item.destination} 행`}</span>
                                {isInbound && (
                                    <span className="text-[10px] font-medium text-slate-400">
                                        도착
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Inbound Departure Point */}
                        {isInbound && (
                            <div
                                className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2.5">
                                <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0"/>
                                <span>
                                    출발지:{" "}
                                    <strong className="text-teal-700 dark:text-teal-300">
                                        {item.departure_point}
                                    </strong>
                                </span>
                            </div>
                        )}

                        {/* Outbound Note alert if present */}
                        {!isInbound && item.note && (
                            <div
                                className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-bold mb-2.5 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0"/>
                                <span>{item.note}</span>
                            </div>
                        )}

                        {/* Via Stops Strip */}
                        {item.via.length > 0 ? (
                            <div
                                className="p-2.5 rounded-xl bg-white/80 dark:bg-[#161c2b] border border-slate-200/60 dark:border-white/5">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    {isInbound
                                        ? "경유 정류장 및 통과 시각"
                                        : "하차 경유 정류장"}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {item.via.map((v: ShuttleViaStop, vIdx: number) => (
                                        <div
                                            key={vIdx}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${
                                                v.time
                                                    ? theme.viaActiveBadge
                                                    : "bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/5"
                                            }`}
                                        >
                                            <span>{v.name}</span>
                                            {v.time && (
                                                <span
                                                    className={`font-mono font-black ${theme.viaTimeText} text-[11px]`}
                                                >
                                                    ({v.time})
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
                                중간 경유지 없음 (직행 노선)
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
