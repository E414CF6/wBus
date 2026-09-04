"use client";

import {UI_TEXT} from "@shared/config/locale";

import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";

import type {YonseiRouteDetailModalProps} from "./types";

import {useYonseiRouteDetail} from "./hooks/useYonseiRouteDetail";
import {RouteDetailFootnoteStrip} from "./ui/YonseiRouteDetail/RouteDetailFootnoteStrip";
import {RouteDetailHeader} from "./ui/YonseiRouteDetail/RouteDetailHeader";
import {RouteDetailSearch} from "./ui/YonseiRouteDetail/RouteDetailSearch";
import {RouteDetailTable} from "./ui/YonseiRouteDetail/RouteDetailTable";

export const YonseiRouteDetailModal: React.FC<YonseiRouteDetailModalProps> = ({
                                                                                  route,
                                                                                  allYonseiRoutes,
                                                                                  onClose,
                                                                                  isBookmarked: _isBookmarked,
                                                                                  onToggleBookmark: _onToggleBookmark,
                                                                                  onSelectMapRoute,
                                                                                  currentTime,
                                                                              }) => {
    const [mounted, setMounted] = useState(false);
    const [tableSearch, setTableSearch] = useState("");
    const [selectedFootnote, setSelectedFootnote] = useState<number | null>(null);
    const [now, setNow] = useState<Date>(() => currentTime || new Date());

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (currentTime) {
            setNow(currentTime);
        }
    }, [currentTime]);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    const {
        currentHourStr,
        footnoteMap,
        dualHourlyTimetable,
        isSingleSchedule,
        footnoteCounts,
    } = useYonseiRouteDetail({
        route,
        allYonseiRoutes,
        tableSearch,
        now,
        selectedFootnote,
    });

    if (!route || !mounted) return null;

    const targetRouteNo = route.routeNo;
    const isHoechon = targetRouteNo === "34-1";
    const locationLabel = isHoechon
        ? UI_TEXT.YONSEI.LOCATION_HOECHON
        : UI_TEXT.YONSEI.LOCATION_YONSEI;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl h-[90dvh] sm:h-auto sm:max-h-[90vh] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121620] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <RouteDetailHeader
                    targetRouteNo={targetRouteNo}
                    locationLabel={locationLabel}
                    isSingleSchedule={isSingleSchedule}
                    onClose={onClose}
                    onSelectMapRoute={onSelectMapRoute}
                    currentHourStr={currentHourStr}
                    totalHoursCount={dualHourlyTimetable.length}
                />

                {/* Search Bar */}
                <RouteDetailSearch
                    tableSearch={tableSearch}
                    onSearchChange={setTableSearch}
                />

                {/* Timetable Table */}
                <RouteDetailTable
                    dualHourlyTimetable={dualHourlyTimetable}
                    isSingleSchedule={isSingleSchedule}
                    selectedFootnote={selectedFootnote}
                    onSelectFootnote={setSelectedFootnote}
                />

                {/* Footnote Strip Box */}
                <RouteDetailFootnoteStrip
                    footnoteMap={footnoteMap}
                    selectedFootnote={selectedFootnote}
                    onSelectFootnote={setSelectedFootnote}
                    footnoteCounts={footnoteCounts}
                />
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
