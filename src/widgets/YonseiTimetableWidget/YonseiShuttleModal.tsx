"use client";

import React, {useState} from "react";

import {useYonseiShuttleSchedule} from "./hooks/useYonseiShuttleSchedule";

import type {DayFilter, ShuttleTab, YonseiShuttleModalProps} from "./types";

import {ShuttleGuidelinesTab} from "./ui/YonseiShuttleModal/ShuttleGuidelinesTab";
import {ShuttleHeader} from "./ui/YonseiShuttleModal/ShuttleHeader";
import {ShuttleScheduleList} from "./ui/YonseiShuttleModal/ShuttleScheduleList";
import {ShuttleStopsTab} from "./ui/YonseiShuttleModal/ShuttleStopsTab";
import {Modal} from "@shared/ui";

export const YonseiShuttleModal: React.FC<YonseiShuttleModalProps> = ({
                                                                          isOpen,
                                                                          onClose,
                                                                          initialTab,
                                                                          currentTime,
                                                                      }) => {
    const [selectedTab, setSelectedTab] = useState<ShuttleTab | null>(null);
    const activeTab = selectedTab ?? (initialTab || "inbound");
    const [dayFilter, setDayFilter] = useState<DayFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const now = currentTime || new Date();

    const {filteredInbound, filteredOutbound, nextInboundIdx, nextOutboundIdx} =
        useYonseiShuttleSchedule({
            dayFilter,
            searchQuery,
            now,
        });

    const filteredCount =
        activeTab === "inbound" ? filteredInbound.length : filteredOutbound.length;

    const modalContent = (
        <>
            <ShuttleHeader
                activeTab={activeTab}
                onTabChange={setSelectedTab}
                dayFilter={dayFilter}
                onDayFilterChange={setDayFilter}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onClose={onClose}
            />

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

                {/* TAB 3: Stop Locations (탑승 장소 안내 -> 지도 & 마커 로드뷰) */}
                {activeTab === "stops" && <ShuttleStopsTab/>}

                {/* TAB 4: Guidelines (이용 안내) */}
                {activeTab === "guidelines" && <ShuttleGuidelinesTab/>}
            </div>
            {(activeTab === "inbound" || activeTab === "outbound") && (
                <div
                    className="px-4 py-2.5 sm:px-6 sm:py-3 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-[#0c1018]/80 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <span className="font-medium">
                        총 <strong
                        className="text-teal-600 dark:text-teal-400 font-extrabold">{filteredCount}회</strong> 운행
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500">
                        ※ 교통 상황에 따라 5~10분 지연될 수 있습니다.
                    </span>
                </div>
            )}
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="3xl"
            height="tall"
            hideCloseButton
            className="border-teal-500/30 dark:border-teal-500/20 bg-white dark:bg-[#111622]"
            bodyClassName="overflow-hidden"
            modalId="yonsei-shuttle"
            ariaLabel="셔틀버스 시간표"
        >
            {modalContent}
        </Modal>
    );
};
