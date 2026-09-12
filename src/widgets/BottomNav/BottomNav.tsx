"use client";

import React, {memo} from "react";
import {MapIcon} from "lucide-react";
import {APP_CONFIG} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";

import {NavTabButtons} from "./ui/NavTabButtons";
import {ScheduleNavControls} from "./ui/ScheduleNavControls";
import {MapNavControls} from "./ui/MapNavControls";
import {NavThemeToggle} from "./ui/NavThemeToggle";

import type {BusItem, LiveConnectionStatus} from "@entities/bus/types";
import type {DirectionCode} from "@entities/route/types";
import type {DayMode, NavTab, TimetableSubTab} from "@shared/types/navigation";

export type {DayMode, NavTab, TimetableSubTab};

export interface BottomNavProps {
    activeTab: NavTab;
    onTabChange: (tab: NavTab) => void;

    // Dynamic Timetable options (Active when activeTab === "schedule")
    scheduleSubTab?: TimetableSubTab;
    onScheduleSubTabChange?: (subTab: TimetableSubTab) => void;
    dayMode?: DayMode;
    onDayModeChange?: (mode: DayMode) => void;
    isTodayWeekendOrHoliday?: boolean;

    // Dynamic Map options (Active when activeTab === "map")
    allRoutes?: string[];
    selectedRoute?: string;
    onSelectRoute?: (route: string) => void;
    runningBuses?: BusItem[];
    getDirection?: (nodeId: string | null | undefined, nodeOrd: number, routeId?: string | null) => DirectionCode;
    onBusClick?: (lat: number, lng: number) => void;
    connectionStatus?: LiveConnectionStatus;
    hasFetched?: boolean;

    className?: string;
}

/**
 * Unified Floating Pill Navigation Bar.
 * Composes Brand Logo, Main Tabs, Dynamic Schedule/Map Controls, and Theme Switcher.
 */
function BottomNavComponent({
                                activeTab,
                                onTabChange,
                                scheduleSubTab = "yonsei",
                                onScheduleSubTabChange,
                                dayMode = "AUTO",
                                onDayModeChange,
                                isTodayWeekendOrHoliday = false,
                                allRoutes = [],
                                selectedRoute = "",
                                onSelectRoute,
                                runningBuses = [],
                                getDirection,
                                onBusClick,
                                connectionStatus = "connected",
                                hasFetched = true,
                                className = "",
                            }: BottomNavProps) {
    return (
        <div
            className={`fixed bottom-[calc(env(safe-area-inset-bottom,0)+1rem)] left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-3 max-w-[95vw] ${className}`}
        >
            {/* Unified Bottom Floating Pill Navigation Bar */}
            <nav
                aria-label={UI_TEXT.ACCESSIBILITY.MAIN_NAV}
                className="flex items-center gap-1 sm:gap-1.5 p-1.5 px-2.5 sm:px-3 bg-white/85 dark:bg-[#111111]/85 backdrop-blur-3xl border border-black/8 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] rounded-full transition-all duration-300 max-w-full overflow-x-auto custom-scrollbar-hidden"
            >
                {/* Brand Logo & Title */}
                <div className="flex items-center gap-2 pl-1 pr-1 select-none shrink-0">
                    <div
                        className="flex items-center justify-center w-7.5 h-7.5 rounded-full bg-black dark:bg-white text-white dark:text-black shrink-0">
                        <MapIcon className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true"/>
                    </div>
                    <span
                        className="hidden xs:inline-block text-sm sm:text-base font-black text-black dark:text-white tracking-tight shrink-0">
                        {APP_CONFIG.NAME}
                    </span>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>

                {/* Main Navigation Tabs */}
                <NavTabButtons
                    activeTab={activeTab}
                    onTabChange={onTabChange}
                />

                {/* Dynamic Options for Timetable (Schedule Tab) */}
                {activeTab === "schedule" && (
                    <ScheduleNavControls
                        scheduleSubTab={scheduleSubTab}
                        onScheduleSubTabChange={onScheduleSubTabChange}
                        dayMode={dayMode}
                        onDayModeChange={onDayModeChange}
                        isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    />
                )}

                {/* Dynamic Options for Real-time Map (Map Tab) */}
                {activeTab === "map" && (
                    <MapNavControls
                        allRoutes={allRoutes}
                        selectedRoute={selectedRoute}
                        onSelectRoute={onSelectRoute}
                        runningBuses={runningBuses}
                        getDirection={getDirection}
                        onBusClick={onBusClick}
                        connectionStatus={connectionStatus}
                        hasFetched={hasFetched}
                    />
                )}

                {/* Divider before Theme Switcher */}
                <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>

                {/* Theme Toggle Button */}
                <NavThemeToggle/>
            </nav>
        </div>
    );
}

export const BottomNav = memo(BottomNavComponent);
export default BottomNav;
