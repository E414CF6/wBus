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
    return (
        <div
            data-has-bus={busesHere.length > 0 ? "true" : undefined}
            data-selected-stop={isSelected ? "true" : undefined}
            className={`relative flex items-center min-h-[58px] py-3 transition-colors cursor-pointer group border-b border-slate-100 dark:border-white/5 ${
                isSelected
                    ? isTurningStop
                        ? "bg-amber-100/70 dark:bg-amber-950/30"
                        : metaThemeBadgeBg
                    : isTurningStop
                    ? "bg-amber-50/70 hover:bg-amber-100/60 dark:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.12]"
                    : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"
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
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/70 rounded-r z-20 pointer-events-none" />
            ) : null}

            {/* Vertical Timeline Connecting Track */}
            <div
                className={`absolute left-[74px] w-[2px] pointer-events-none ${
                    isFirst ? "top-1/2 bottom-0" : isLast ? "top-0 bottom-1/2" : "top-0 bottom-0"
                }`}
                style={{
                    backgroundColor: isTurningStop ? undefined : metaThemeMainColor,
                    backgroundImage: isTurningStop
                        ? `linear-gradient(to bottom, ${metaThemeMainColor}b3, #f59e0b, ${metaThemeMainColor}b3)`
                        : undefined,
                    opacity: 0.75,
                }}
            />

            {/* Station Timeline Node (Donut Circle) */}
            {isTurningStop ? (
                <div
                    className="absolute left-[65px] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[2.5px] border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-[#0c100f] z-10 shadow-[0_0_12px_rgba(245,158,11,0.35)] flex items-center justify-center pointer-events-none"
                    title="회차지 정류장"
                >
                    <RotateCw className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
                </div>
            ) : (
                <div
                    className="absolute left-[68px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-[2.5px] bg-white dark:bg-[#0c100f] z-10 shadow-xs pointer-events-none"
                    style={{borderColor: metaThemeMainColor}}
                />
            )}

            {/* Live Bus Markers if arriving/located at this station */}
            {busesHere.length > 0 && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-start gap-1">
                    {busesHere.map((bus) => {
                        const plateDigits =
                            bus.vehicleno.replace(/[^0-9]/g, "").slice(-4) || bus.vehicleno.slice(-4);

                        return (
                            <button
                                key={`${bus.vehicleno}-${bus.nodeord}`}
                                type="button"
                                onClick={(e) => onBusBadgeClick(e, bus.gpslati, bus.gpslong)}
                                className="flex items-center gap-1 group/bus cursor-pointer active:scale-95 transition-transform"
                                title={`${bus.vehicleno} 실시간 위치로 이동`}
                            >
                                <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold border text-white tracking-tight whitespace-nowrap select-none shadow-xs"
                                    style={{
                                        backgroundColor: metaThemeMainColor,
                                        borderColor: metaThemeMainColor,
                                    }}
                                >
                                    {plateDigits}
                                </span>
                                <div
                                    className={`w-6 h-6 rounded-md ${metaThemeBg} text-white flex items-center justify-center shadow-md ${metaThemeShadow} shrink-0`}
                                >
                                    <Bus className="w-3.5 h-3.5 fill-current" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Station Name & Metadata */}
            <div className="ml-[92px] flex-1 flex flex-col justify-center min-w-0 pr-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                        className={`text-[14px] sm:text-[15px] font-bold truncate transition-colors ${
                            isSelected
                                ? isTurningStop
                                    ? "text-amber-800 dark:text-amber-300 font-black"
                                    : `${metaThemeText} font-black`
                                : isTurningStop
                                ? "text-amber-900 dark:text-amber-200 font-extrabold group-hover:text-amber-950 dark:group-hover:text-amber-100"
                                : "text-slate-800 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white"
                        }`}
                    >
                        {stop.nodenm}
                    </span>
                    {isTurningStop && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs shrink-0 select-none">
                            <RotateCw className="w-2.5 h-2.5 stroke-[2.5]" />
                            회차지
                        </span>
                    )}
                </div>
                {stop.nodeno && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{stop.nodeno}</span>
                )}
            </div>

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
                className={`mr-3 p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    isFavStop
                        ? "text-amber-500 hover:text-amber-600"
                        : "text-slate-300 dark:text-slate-600 opacity-60 group-hover:opacity-100 hover:text-amber-500 dark:hover:text-amber-400"
                }`}
                title={isFavStop ? "정류장 즐겨찾기 해제" : "정류장 즐겨찾기 추가"}
                aria-label={isFavStop ? "정류장 즐겨찾기 해제" : "정류장 즐겨찾기 추가"}
            >
                <Star className={`w-4 h-4 ${isFavStop ? "fill-amber-500" : ""}`} />
            </button>
        </div>
    );
});

BusDrawerStopItem.displayName = "BusDrawerStopItem";
