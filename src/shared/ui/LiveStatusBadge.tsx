"use client";

import type {SSEConnectionStatus} from "@features/live-tracking/useBusLocation";
import {UI_TEXT} from "@shared/config/locale";
import React, {memo, useEffect, useState} from "react";

interface LiveStatusBadgeProps {
    countText?: string;
    connectionStatus: SSEConnectionStatus;
    lastUpdated?: number | null;
    isDegraded?: boolean;
    onReconnect?: () => void;
    className?: string;
}

export const LiveStatusBadge = memo(({
                                         countText,
                                         connectionStatus,
                                         lastUpdated,
                                         isDegraded = false,
                                         onReconnect,
                                         className = "",
                                     }: LiveStatusBadgeProps) => {
    const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

    useEffect(() => {
        if (!lastUpdated) {
            setSecondsAgo(null);
            return;
        }

        const updateSec = () => {
            const diff = Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000));
            setSecondsAgo(diff);
        };

        updateSec();
        const timer = setInterval(updateSec, 1000);
        return () => clearInterval(timer);
    }, [lastUpdated]);

    let dotColorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
    let statusLabel: string = UI_TEXT.CONNECTION.CONNECTED;
    let isPulsing = false;

    if (connectionStatus === "connecting") {
        dotColorClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
        statusLabel = UI_TEXT.CONNECTION.CONNECTING;
        isPulsing = true;
    } else if (connectionStatus === "fallback") {
        dotColorClass = "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]";
        statusLabel = UI_TEXT.CONNECTION.FALLBACK;
    } else if (connectionStatus === "suspended") {
        dotColorClass = "bg-gray-400 dark:bg-gray-500";
        statusLabel = UI_TEXT.CONNECTION.SUSPENDED;
    }

    if (isDegraded && connectionStatus !== "suspended") {
        dotColorClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
    }

    return (
        <button
            type="button"
            onClick={onReconnect}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight transition-all duration-200 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs hover:border-black/15 dark:hover:border-white/20 active:scale-95 cursor-pointer max-w-full overflow-hidden ${className}`}
            title={UI_TEXT.CONNECTION.STATUS_TOOLTIP}
        >
            <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                {isPulsing && (
                    <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColorClass}`}
                    />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColorClass}`}/>
            </span>

            {countText && (
                <span className="text-gray-900 dark:text-gray-100 font-extrabold whitespace-nowrap">
                    {countText}
                </span>
            )}

            <span className="text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap flex items-center gap-1">
                {countText && <span className="opacity-30 font-normal">•</span>}
                <span>{statusLabel}</span>
                {isDegraded &&
                    <span className="text-amber-500 dark:text-amber-400 font-bold">{UI_TEXT.CONNECTION.DEGRADED}</span>}
            </span>

            {secondsAgo !== null && (
                <span
                    className="text-[10px] text-gray-400 dark:text-gray-500 font-mono pl-1 border-l border-black/10 dark:border-white/10 whitespace-nowrap">
                    {secondsAgo === 0 ? UI_TEXT.TIME.JUST_NOW : UI_TEXT.TIME.SECONDS_AGO(secondsAgo)}
                </span>
            )}
        </button>
    );
});

LiveStatusBadge.displayName = "LiveStatusBadge";

export default LiveStatusBadge;
