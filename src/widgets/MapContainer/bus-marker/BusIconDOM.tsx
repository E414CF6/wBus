"use client";

import React, {memo} from "react";
import {UI_TEXT} from "@shared/config/locale";

export const BusHeadingConeSVG = memo(({color}: { color: string }) => (
    <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <path
            d="M22 22 L12.5 5.5 A19 19 0 0 1 31.5 5.5 Z"
            fill={color}
            fillOpacity="0.22"
        />
        <path
            d="M22 2.2 L27.2 10.6 L22 8.8 L16.8 10.6 Z"
            fill={color}
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <circle
            cx="22"
            cy="22"
            r="14.2"
            stroke={color}
            strokeOpacity="0.4"
            strokeWidth="1.25"
        />
    </svg>
));

BusHeadingConeSVG.displayName = "BusHeadingConeSVG";

interface BusIconDOMProps {
    routeNumber: string;
    color?: string;
    isSelected?: boolean;
    isFollowed?: boolean;
    plateNumber?: string;
}

export const BusIconDOM = memo(({routeNumber, color, isSelected, isFollowed, plateNumber}: BusIconDOMProps) => {
    const themeColor = color || "#2563eb";
    const cleanRoute = (routeNumber || "").trim();
    const isMarquee = cleanRoute.length >= 4;
    const shortPlate = plateNumber ? plateNumber.trim().slice(-4) : "";

    return (
        <>
            {isFollowed && (
                <span
                    className="motion-safe:animate-ping absolute inset-1 rounded-full opacity-40 pointer-events-none"
                    style={{backgroundColor: themeColor}}
                />
            )}

            <div
                role="img"
                aria-label={UI_TEXT.ACCESSIBILITY.BUS_ICON_ALT}
                className={`relative z-10 flex items-center h-6 min-w-7.5 max-w-9 px-1.5 rounded-full text-white text-[11px] font-extrabold border-2 border-white tracking-tight overflow-hidden ${
                    isMarquee ? "justify-start" : "justify-center"
                }`}
                style={{
                    backgroundColor: themeColor,
                    boxShadow:
                        isSelected || isFollowed
                            ? `0 0 0 2px ${themeColor}55, 0 4px 12px rgba(0,0,0,0.4)`
                            : "0 3px 10px rgba(0,0,0,0.3)",
                }}
            >
                {isMarquee ? (
                    <div className="marquee-scroll flex-nowrap items-center hover:[animation-play-state:paused]">
                        <span className="pr-2 whitespace-nowrap shrink-0">{cleanRoute}</span>
                        <span className="pr-2 whitespace-nowrap shrink-0" aria-hidden="true">{cleanRoute}</span>
                    </div>
                ) : (
                    <span
                        className={`text-center whitespace-nowrap select-none leading-none ${
                            cleanRoute.length === 3 ? "text-[10px] tracking-tight" : ""
                        }`}
                    >
                        {cleanRoute}
                    </span>
                )}
            </div>

            {shortPlate && (
                <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 text-[9px] font-mono font-bold leading-none whitespace-nowrap shadow-sm border border-black/15 dark:border-white/20 pointer-events-none select-none">
                    {shortPlate}
                </span>
            )}
        </>
    );
});

BusIconDOM.displayName = "BusIconDOM";
