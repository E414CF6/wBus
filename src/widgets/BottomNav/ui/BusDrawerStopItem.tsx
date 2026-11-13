import React, {memo} from "react";
import {Bus, RotateCw, Star} from "lucide-react";
import type {BusItem} from "@entities/bus/types";
import type {RouteVariationStop} from "@entities/route/types";
import type {BusStop} from "@entities/station/types";

export interface BusDrawerStopItemProps {
    stop: RouteVariationStop;
    isFirst: boolean;
    isLast: boolean;
    isSelected: boolean;
    isTurningStop: boolean;
    isFavStop: boolean;
    busesHere: BusItem[];
    metaThemeMainColor?: string;
    metaThemeBadgeBg?: string;
    metaThemeBg?: string;
    metaThemeText?: string;
    metaThemeShadow?: string;
    onStopClick: (stop: RouteVariationStop) => void;
    onBusBadgeClick: (e: React.MouseEvent, lat: number, lng: number) => void;
    onToggleFavorite: (stop: BusStop) => void;
}

export const BusDrawerStopItem = memo<BusDrawerStopItemProps>(({
                                                                   stop,
                                                                   isFirst,
                                                                   isLast,
                                                                   isSelected,
                                                                   isTurningStop,
                                                                   isFavStop,
                                                                   busesHere,
                                                                   metaThemeMainColor = "#2563eb",
                                                                   metaThemeBadgeBg = "bg-blue-50/80 dark:bg-blue-950/40",
                                                                   metaThemeBg = "bg-blue-600 dark:bg-blue-500",
                                                                   metaThemeText = "text-blue-700 dark:text-blue-300",
                                                                   metaThemeShadow = "shadow-blue-600/25",
                                                                   onStopClick,
                                                                   onBusBadgeClick,
                                                                   onToggleFavorite,
                                                               }) => {
    const hasBuses = busesHere.length > 0;

    return (
        <div
            data-stop-key={`${stop.nodeid}-${stop.nodeord ?? ""}`}
            data-has-bus={hasBuses ? "true" : undefined}
            data-selected-stop={isSelected ? "true" : undefined}
            className={`cv-auto-stop relative flex items-center min-h-[54px] py-2.5 transition-colors cursor-pointer group border-b border-slate-100/80 dark:border-white/[0.05] ${
                isSelected
                    ? isTurningStop
                        ? "bg-amber-100/70 dark:bg-amber-950/30"
                        : metaThemeBadgeBg
                    : isTurningStop
                        ? "bg-amber-50/70 hover:bg-amber-100/60 dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.12]"
                        : hasBuses
                            ? "bg-slate-50/90 hover:bg-slate-100/80 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]"
                            : "hover:bg-slate-50/80 dark:hover:bg-white/[0.04]"
            }`}
            onClick={() => onStopClick(stop)}
        >
            {/* Left Selection/Turning Indicator Bar */}
            {isSelected ? (
                <div
                    className={`absolute left-0 top-0 bottom-0 w-1 rounded-r z-20 pointer-events-none ${
                        isTurningStop ? "bg-amber-500" : metaThemeBg
                    }`}
                />
            ) : isTurningStop ? (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/70 rounded-r z-20 pointer-events-none"/>
            ) : null}

            {/* Vertical Timeline Connecting Track */}
            <div
                className={`absolute left-[26px] sm:left-[30px] -translate-x-1/2 w-[2px] z-[5] pointer-events-none ${
                    isFirst ? "top-1/2 bottom-0" : isLast ? "top-0 bottom-1/2" : "top-0 bottom-0"
                }`}
                style={{
                    backgroundColor: isTurningStop ? undefined : metaThemeMainColor,
                    backgroundImage: isTurningStop
                        ? `linear-gradient(to bottom, ${metaThemeMainColor}b3, #f59e0b, ${metaThemeMainColor}b3)`
                        : undefined,
                    opacity: 0.7,
                }}
            />

            {/* Station Timeline Node (Active Bus / Turning / Regular Stop) */}
            {hasBuses ? (
                <div
                    className="absolute left-[26px] sm:left-[30px] -translate-x-1/2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-white z-20 ring-[3px] ring-white dark:ring-[#11131a] shadow-sm flex items-center justify-center pointer-events-none"
                    style={{backgroundColor: metaThemeMainColor}}
                    aria-hidden="true"
                >
                    <Bus className="w-3.5 h-3.5"/>
                </div>
            ) : isTurningStop ? (
                <div
                    className="absolute left-[26px] sm:left-[30px] -translate-x-1/2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-[#11131a] z-10 shadow-[0_0_10px_rgba(245,158,11,0.3)] flex items-center justify-center pointer-events-none"
                    title="회차지 정류장"
                >
                    <RotateCw className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 stroke-[2.5]"/>
                </div>
            ) : (
                <div
                    className={`absolute left-[26px] sm:left-[30px] -translate-x-1/2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-[2.5px] z-10 pointer-events-none transition-transform ${
                        isSelected ? "scale-115" : "bg-white dark:bg-[#11131a]"
                    }`}
                    style={{
                        borderColor: metaThemeMainColor,
                        backgroundColor: isSelected ? metaThemeMainColor : undefined,
                    }}
                />
            )}

            {/* Station Name & Metadata */}
            <div className="ml-12 sm:ml-14 flex-1 flex flex-col justify-center min-w-0 pr-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span
                        className={`text-[14px] sm:text-[15px] truncate transition-colors ${
                            isSelected
                                ? isTurningStop
                                    ? "text-amber-800 dark:text-amber-300 font-black"
                                    : `${metaThemeText} font-black`
                                : isTurningStop
                                    ? "text-amber-900 dark:text-amber-200 font-extrabold group-hover:text-amber-950 dark:group-hover:text-amber-100"
                                    : hasBuses
                                        ? "text-slate-950 dark:text-white font-extrabold"
                                        : "text-slate-800 dark:text-slate-100 font-bold group-hover:text-slate-950 dark:group-hover:text-white"
                        }`}
                    >
                        {stop.nodenm}
                    </span>
                    {isTurningStop && (
                        <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs shrink-0 select-none">
                            <RotateCw className="w-2.5 h-2.5 stroke-[2.5]"/>
                            회차지
                        </span>
                    )}
                </div>
                {stop.nodeno && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono leading-tight mt-0.5">
                        {stop.nodeno}
                    </span>
                )}
            </div>

            {/* Live Bus Vehicle Badges (Right-aligned before Star Button) */}
            {hasBuses && (
                <div className="flex items-center gap-1 flex-wrap justify-end shrink-0 mr-1 max-w-[132px]">
                    {busesHere.map((bus) => {
                        const plateDigits =
                            bus.vehicleno.replace(/[^0-9]/g, "").slice(-4) || bus.vehicleno.slice(-4);

                        return (
                            <button
                                key={`${bus.vehicleno}-${bus.nodeord}`}
                                type="button"
                                onClick={(e) => onBusBadgeClick(e, bus.gpslati, bus.gpslong)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-black text-white shadow-xs ${metaThemeShadow} cursor-pointer active:scale-95 transition-transform whitespace-nowrap`}
                                style={{backgroundColor: metaThemeMainColor}}
                                title={`${bus.vehicleno} 실시간 위치로 이동`}
                            >
                                <Bus className="w-3 h-3 shrink-0"/>
                                <span className="font-mono tracking-tight leading-none">{plateDigits}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Stop Favorite Star Button */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite({
                        nodeid: stop.nodeid,
                        nodenm: stop.nodenm,
                        nodeno: stop.nodeno,
                        gpslati: stop.gpslati,
                        gpslong: stop.gpslong,
                    });
                }}
                className={`mr-3 sm:mr-3.5 p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    isFavStop
                        ? "text-amber-500 hover:text-amber-600"
                        : "text-slate-300 dark:text-slate-600 opacity-60 group-hover:opacity-100 hover:text-amber-500 dark:hover:text-amber-400"
                }`}
                title={isFavStop ? "정류장 즐겨찾기 해제" : "정류장 즐겨찾기 추가"}
                aria-label={isFavStop ? "정류장 즐겨찾기 해제" : "정류장 즐겨찾기 추가"}
            >
                <Star className={`w-4 h-4 ${isFavStop ? "fill-amber-500" : ""}`}/>
            </button>
        </div>
    );
});

BusDrawerStopItem.displayName = "BusDrawerStopItem";
