"use client";

import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {useYonseiShuttleSchedule} from "./hooks/useYonseiShuttleSchedule";
import type {DayFilter, ShuttleTab, YonseiShuttleModalProps} from "./types";
import {ShuttleGuidelinesTab} from "./ui/YonseiShuttleModal/ShuttleGuidelinesTab";
import {ShuttleHeader} from "./ui/YonseiShuttleModal/ShuttleHeader";
import {ShuttleScheduleList} from "./ui/YonseiShuttleModal/ShuttleScheduleList";
import {ShuttleStopsTab} from "./ui/YonseiShuttleModal/ShuttleStopsTab";

export const YonseiShuttleModal: React.FC<YonseiShuttleModalProps> = ({
                                                                          isOpen,
                                                                          onClose,
                                                                          currentTime,
                                                                      }) => {
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<ShuttleTab>("inbound");
    const [dayFilter, setDayFilter] = useState<DayFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [now, setNow] = useState<Date>(() => currentTime || new Date());

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (currentTime) setNow(currentTime);
    }, [currentTime]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    const {filteredInbound, filteredOutbound, nextInboundIdx, nextOutboundIdx} =
        useYonseiShuttleSchedule({
            dayFilter,
            searchQuery,
            now,
        });

    if (!isOpen || !mounted) return null;

    const filteredCount =
        activeTab === "inbound" ? filteredInbound.length : filteredOutbound.length;

    const modalContent = (
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl h-[90dvh] sm:h-auto sm:max-h-[88vh] rounded-3xl border border-teal-500/30 dark:border-teal-500/20 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#111622] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with tabs, filter pills, search bar */}
                <ShuttleHeader
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    dayFilter={dayFilter}
                    onDayFilterChange={setDayFilter}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    filteredCount={filteredCount}
                    onClose={onClose}
                />

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-3">
                    {/* TAB 1: Inbound (등교 / 캠퍼스행) */}
                    {activeTab === "inbound" && (
                        <ShuttleScheduleList
                            items={filteredInbound}
                            nextIdx={nextInboundIdx}
                            isInbound={true}
                            emptyMessage="검색 조건에 일치하는 등교 셔틀버스가 없습니다."
                        />
                    )}

                    {/* TAB 2: Outbound (하교 / 캠퍼스발) */}
                    {activeTab === "outbound" && (
                        <ShuttleScheduleList
                            items={filteredOutbound}
                            nextIdx={nextOutboundIdx}
                            isInbound={false}
                            emptyMessage="검색 조건에 일치하는 하교 셔틀버스가 없습니다."
                        />
                    )}

                    {/* TAB 3: Stop Locations (탑승 장소 안내) */}
                    {activeTab === "stops" && <ShuttleStopsTab/>}

                    {/* TAB 4: Guidelines (이용 안내) */}
                    {activeTab === "guidelines" && <ShuttleGuidelinesTab/>}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
