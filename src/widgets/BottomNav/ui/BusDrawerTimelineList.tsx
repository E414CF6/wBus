"use client";

import React from "react";
import {Loader2} from "lucide-react";
import type {RouteVariationStop} from "@entities/route";
import type {BusItem} from "@entities/bus/types";
import type {BusStop} from "@entities/station/types";
import {BusDrawerStopItem} from "./BusDrawerStopItem";

interface BusDrawerTimelineListProps {
    listRef: React.RefObject<HTMLDivElement | null>;
    currentStopsCount: number;
    filteredStops: RouteVariationStop[];
    stopSearchQuery: string;
    busesByStopKey: Map<string, BusItem[]>;
    selectedStopId: string | null;
    turningStop: RouteVariationStop | null;
    nearestBusVehicleNo: string | null;
    isFavoriteStop: (nodeId: string) => boolean;
    toggleFavoriteStop: (stop: BusStop) => void;
    onStopClick: (stop: RouteVariationStop) => void;
    onBusBadgeClick: (e: React.MouseEvent, lat: number, lng: number) => void;
    metaThemeMainColor?: string;
    metaThemeBadgeBg?: string;
    metaThemeBg?: string;
    metaThemeText?: string;
    metaThemeShadow?: string;
}

export const BusDrawerTimelineList: React.FC<BusDrawerTimelineListProps> = ({
    listRef,
    currentStopsCount,
    filteredStops,
    stopSearchQuery,
    busesByStopKey,
    selectedStopId,
    turningStop,
    nearestBusVehicleNo,
    isFavoriteStop,
    toggleFavoriteStop,
    onStopClick,
    onBusBadgeClick,
    metaThemeMainColor,
    metaThemeBadgeBg,
    metaThemeBg,
    metaThemeText,
    metaThemeShadow,
}) => {
    return (
        <div
            ref={listRef}
            className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar relative min-h-0 border-t border-slate-100 dark:border-white/[0.07] pb-3"
        >
            {currentStopsCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-3">
                    <Loader2
                        className={`w-6 h-6 animate-spin ${metaThemeText || "text-blue-600 dark:text-blue-400"}`}
                    />
                    <span className="text-xs font-semibold">정류장 목록을 불러오고 있습니다...</span>
                </div>
            ) : filteredStops.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                    {stopSearchQuery
                        ? `"${stopSearchQuery}" 검색 결과가 없습니다.`
                        : "해당 방향의 정류장 정보가 없습니다."}
                </div>
            ) : (
                filteredStops.map((stop, index) => {
                    const stopKey = `${stop.nodeid}-${stop.nodeord ?? ""}`;
                    const busesHere = busesByStopKey.get(stopKey) || [];
                    const isFirst = index === 0;
                    const isLast = index === filteredStops.length - 1;
                    const isSelected = selectedStopId === stop.nodeid;
                    const isTurning = Boolean(
                        turningStop &&
                        turningStop.nodeid === stop.nodeid &&
                        turningStop.nodeord === stop.nodeord
                    );
                    const isFav = isFavoriteStop(stop.nodeid);

                    return (
                        <BusDrawerStopItem
                            key={stopKey}
                            stop={stop}
                            isFirst={isFirst}
                            isLast={isLast}
                            isSelected={isSelected}
                            isTurningStop={isTurning}
                            isFavStop={isFav}
                            busesHere={busesHere}
                            nearestBusVehicleNo={nearestBusVehicleNo}
                            metaThemeMainColor={metaThemeMainColor}
                            metaThemeBadgeBg={metaThemeBadgeBg}
                            metaThemeBg={metaThemeBg}
                            metaThemeText={metaThemeText}
                            metaThemeShadow={metaThemeShadow}
                            onStopClick={onStopClick}
                            onBusBadgeClick={onBusBadgeClick}
                            onToggleFavorite={toggleFavoriteStop}
                        />
                    );
                })
            )}
        </div>
    );
};
