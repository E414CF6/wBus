"use client";

import React, {memo, useCallback, useEffect, useState} from "react";
import {Marker} from "react-map-gl/maplibre";
import {Calendar, Clock, GraduationCap} from "lucide-react";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {MAP_SETTINGS} from "@shared/config/env";
import type {TimetableSubTab} from "@shared/types/navigation";

export interface TimetableHub {
    id: string;
    name: string;
    shortLabel: string;
    badgeText: string;
    lat: number;
    lng: number;
    subTab: TimetableSubTab;
    theme: "yonsei" | "cityhall";
    icon: React.ComponentType<{ className?: string }>;
}

export const WONJU_TIMETABLE_HUBS: TimetableHub[] = [
    {
        id: "hub-cityhall",
        name: "원주시청 버스 시간표",
        shortLabel: "원주시청 시간표",
        badgeText: "원주시 전체 노선 시간표",
        lat: 37.3421,
        lng: 127.9198,
        subTab: "all",
        theme: "cityhall",
        icon: Calendar,
    },
    {
        id: "hub-yonsei",
        name: "연세대 미래캠퍼스 시간표",
        shortLabel: "연세대 시간표",
        badgeText: "셔틀 · 30 · 34 · 34-1",
        lat: 37.2795,
        lng: 127.9035,
        subTab: "yonsei",
        theme: "yonsei",
        icon: GraduationCap,
    },
];

interface TimetableMapPinProps {
    isWonju: boolean;
    onOpenScheduleModal: (subTab?: TimetableSubTab) => void;
}

export const TimetableMapPins = memo(function TimetableMapPins({
    isWonju,
    onOpenScheduleModal,
}: TimetableMapPinProps) {
    const {map} = useAppMapContext();
    const [zoom, setZoom] = useState(map?.getZoom() ?? MAP_SETTINGS.ZOOM.DEFAULT);

    useEffect(() => {
        if (!map) return;
        const handleZoom = () => {
            setZoom(map.getZoom());
        };
        handleZoom();
        map.on("zoom", handleZoom);
        map.on("zoomend", handleZoom);
        return () => {
            map.off("zoom", handleZoom);
            map.off("zoomend", handleZoom);
        };
    }, [map]);

    const handlePinClick = useCallback(
        (e: { originalEvent?: Event }, subTab: TimetableSubTab) => {
            if (e.originalEvent) {
                e.originalEvent.stopPropagation();
            }
            onOpenScheduleModal(subTab);
        },
        [onOpenScheduleModal]
    );

    if (!isWonju || zoom < 9.5) return null;

    const isDetailed = zoom >= 12.2;

    return (
        <>
            {WONJU_TIMETABLE_HUBS.map((hub) => {
                const Icon = hub.icon;
                const isYonsei = hub.theme === "yonsei";

                return (
                    <Marker
                        key={hub.id}
                        longitude={hub.lng}
                        latitude={hub.lat}
                        anchor="bottom"
                        onClick={(e) => handlePinClick(e, hub.subTab)}
                        style={{pointerEvents: "auto", cursor: "pointer", zIndex: 35}}
                    >
                        <div
                            title={`${hub.name} 모달 열기 (클릭)`}
                            className="group relative flex flex-col items-center select-none transition-transform duration-200 hover:scale-105 active:scale-95"
                        >
                            {/* Floating Glass Pill Pin Card */}
                            <div
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-2xl shadow-[0_8px_28px_rgba(0,0,0,0.22)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.65)] border transition-all ${
                                    isYonsei
                                        ? "bg-[#003876]/95 dark:bg-[#003876]/95 border-blue-300/40 text-white"
                                        : "bg-white/95 dark:bg-[#14161f]/95 border-blue-500/40 dark:border-blue-400/40 text-slate-900 dark:text-white"
                                }`}
                            >
                                {/* Icon Badge with Pulse */}
                                <div
                                    className={`relative flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                                        isYonsei
                                            ? "bg-white text-[#003876]"
                                            : "bg-blue-600 text-white"
                                    }`}
                                >
                                    <span
                                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-35 ${
                                            isYonsei ? "bg-white" : "bg-blue-400"
                                        }`}
                                    />
                                    <Icon className="relative w-3.5 h-3.5 stroke-[2.4]"/>
                                </div>

                                {/* Label & Sub-badge */}
                                <div className="flex flex-col text-left pr-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-black tracking-tight whitespace-nowrap leading-tight">
                                            {hub.shortLabel}
                                        </span>
                                        <Clock
                                            className={`w-3 h-3 shrink-0 ${
                                                isYonsei ? "text-blue-200" : "text-blue-600 dark:text-blue-400"
                                            }`}
                                        />
                                    </div>
                                    {isDetailed && (
                                        <span
                                            className={`text-[9px] font-extrabold whitespace-nowrap leading-tight ${
                                                isYonsei
                                                    ? "text-blue-200/90"
                                                    : "text-slate-500 dark:text-slate-400"
                                            }`}
                                        >
                                            {hub.badgeText}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Pin Pointer Triangle / Stem */}
                            <div className="flex flex-col items-center -mt-0.5">
                                <div
                                    className={`w-2.5 h-2.5 rotate-45 rounded-[2px] border-r border-b ${
                                        isYonsei
                                            ? "bg-[#003876] border-blue-300/40"
                                            : "bg-white dark:bg-[#14161f] border-blue-500/40 dark:border-blue-400/40"
                                    }`}
                                />
                                <div
                                    className={`w-2 h-2 rounded-full mt-0.5 shadow-sm border border-white ${
                                        isYonsei ? "bg-[#003876]" : "bg-blue-600"
                                    }`}
                                />
                            </div>
                        </div>
                    </Marker>
                );
            })}
        </>
    );
});
