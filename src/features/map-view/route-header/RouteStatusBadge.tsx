"use client";

import React, {useMemo} from "react";
import {CalendarClock, RefreshCw} from "lucide-react";
import type {LiveConnectionStatus} from "@entities/bus/types";

export interface NextScheduleInfo {
    time: string;
    waitMins: number;
    label: string;
}

interface RouteStatusBadgeProps {
    selectedRoute: string;
    hasFetched: boolean;
    connectionStatus: LiveConnectionStatus;
    runningCount: number;
    isDegraded: boolean;
    nextScheduleInfo: NextScheduleInfo | null;
    onOpenScheduleModal?: (docOrSubTab?: string, initialLocation?: "origin" | "dest") => void;
    onReconnect?: () => void;
}

export const RouteStatusBadge: React.FC<RouteStatusBadgeProps> = ({
    selectedRoute,
    hasFetched,
    connectionStatus,
    runningCount,
    isDegraded,
    nextScheduleInfo,
    onOpenScheduleModal,
    onReconnect,
}) => {
    const statusConfig = useMemo(() => {
        if (!hasFetched || connectionStatus === "connecting") {
            return {
                label: "연결 중...",
                badgeClass: "bg-amber-500/10 dark:bg-amber-400/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
                dotClass: "bg-amber-500",
                pingClass: "bg-amber-400",
                isPulsing: true,
                tooltip: "실시간 위치 API 연결 대기 중",
            };
        }

        if (connectionStatus === "suspended") {
            return {
                label: "대기 상태",
                badgeClass: "bg-slate-500/10 dark:bg-slate-400/15 border-slate-500/20 text-slate-600 dark:text-slate-400",
                dotClass: "bg-slate-400 dark:bg-slate-500",
                pingClass: "",
                isPulsing: false,
                tooltip: "화면 비활성화로 일시 대기 중",
            };
        }

        if (runningCount > 0) {
            if (isDegraded) {
                return {
                    label: `${runningCount}대 운행 (지연)`,
                    badgeClass: "bg-amber-500/10 dark:bg-amber-400/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
                    dotClass: "bg-amber-500",
                    pingClass: "bg-amber-400",
                    isPulsing: true,
                    tooltip: "실시간 버스 운행 중 (일부 데이터 지연)",
                };
            }
            return {
                label: `${runningCount}대 운행 중`,
                badgeClass: "bg-emerald-500/10 dark:bg-emerald-400/15 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                dotClass: "bg-emerald-500",
                pingClass: "bg-emerald-400",
                isPulsing: true,
                tooltip: `현재 ${runningCount}대 실시간 운행 중`,
            };
        }

        if (nextScheduleInfo) {
            const waitText = nextScheduleInfo.waitMins <= 0 ? "곧 출발" : `${nextScheduleInfo.waitMins}분 후`;
            return {
                label: `다음 ${nextScheduleInfo.time} (${waitText})`,
                badgeClass: "bg-blue-500/10 dark:bg-blue-400/15 border-blue-500/30 text-blue-700 dark:text-blue-300",
                dotClass: "bg-blue-500",
                pingClass: "",
                isPulsing: false,
                tooltip: `현재 운행 대기 중 · 다음 ${nextScheduleInfo.label}: ${nextScheduleInfo.time} (${waitText})`,
            };
        }

        return {
            label: "운행 종료",
            badgeClass: "bg-slate-500/10 dark:bg-slate-400/10 border-slate-400/20 text-slate-600 dark:text-slate-400",
            dotClass: "bg-slate-400 dark:bg-slate-500",
            pingClass: "",
            isPulsing: false,
            tooltip: "현재 운행 중인 버스가 없습니다 (운행 종료 또는 배차 대기)",
        };
    }, [hasFetched, connectionStatus, runningCount, isDegraded, nextScheduleInfo]);

    return (
        <div className="flex items-center gap-1 pl-1.5 border-l border-black/10 dark:border-white/10 shrink-0">
            <button
                type="button"
                onClick={() => {
                    if (runningCount === 0 && onOpenScheduleModal) {
                        onOpenScheduleModal(`route:${selectedRoute}`);
                    } else {
                        onReconnect?.();
                    }
                }}
                className={`flex max-w-[44vw] shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 sm:max-w-none ${statusConfig.badgeClass}`}
                title={statusConfig.tooltip}
            >
                <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                    {statusConfig.isPulsing && (
                        <span
                            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusConfig.pingClass}`}
                        />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${statusConfig.dotClass}`}/>
                </span>
                <span>{statusConfig.label}</span>
                {runningCount === 0 && onOpenScheduleModal && (
                    <CalendarClock className="w-3 h-3 opacity-80 ml-0.5"/>
                )}
                {onReconnect && (!hasFetched || connectionStatus === "connecting") && (
                    <RefreshCw className="w-2.5 h-2.5 animate-spin opacity-70 ml-0.5"/>
                )}
            </button>
        </div>
    );
};
