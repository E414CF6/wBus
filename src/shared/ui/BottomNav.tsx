"use client";

import React, {useEffect, useState} from "react";
import {APP_CONFIG, MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import type {BusItem} from "@entities/bus/types";
import type {DirectionCode} from "@entities/route/types";
import {BusListItem} from "@widgets/BusListSheet/BusListItem";
import {Bus, Calendar, ChevronDown, GraduationCap, MapIcon, MapPin, Moon, Sun, X} from "lucide-react";
import {useTheme} from "next-themes";

export type NavTab = "schedule" | "map";
export type TimetableSubTab = "yonsei" | "all";

interface BottomNavProps {
    activeTab: NavTab;
    onTabChange: (tab: NavTab) => void;
    // Dynamic Timetable options (Active when activeTab === "schedule")
    scheduleSubTab?: TimetableSubTab;
    onScheduleSubTabChange?: (subTab: TimetableSubTab) => void;
    // Dynamic Map options (Active when activeTab === "map")
    allRoutes?: string[];
    selectedRoute?: string;
    onSelectRoute?: (route: string) => void;
    runningBuses?: BusItem[];
    getDirection?: (nodeId: string | null | undefined, nodeOrd: number, routeId?: string | null) => DirectionCode;
    onBusClick?: (lat: number, lng: number) => void;
    className?: string;
}

/**
 * Unified Floating Pill Navigation Bar.
 * Combines Logo, Timetable/Map Tabs, Route Selector, Running Bus List Toggle, and Theme Switcher.
 */
export default function BottomNav({
                                      activeTab,
                                      onTabChange,
                                      scheduleSubTab = "yonsei",
                                      onScheduleSubTabChange,
                                      allRoutes = [],
                                      selectedRoute = "",
                                      onSelectRoute,
                                      runningBuses = [],
                                      getDirection,
                                      onBusClick,
                                      className = "",
                                  }: BottomNavProps) {
    const {map} = useAppMapContext();
    const {setTheme, resolvedTheme} = useTheme();
    const [mounted, setMounted] = useState(false);
    const [localIsDark, setLocalIsDark] = useState(false);
    const [isBusListOpen, setIsBusListOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            setLocalIsDark(resolvedTheme === "dark" || document.documentElement.classList.contains("dark"));
        }
    }, [mounted, resolvedTheme]);

    // Close bus list sheet when switching back to schedule tab
    useEffect(() => {
        if (activeTab === "schedule") {
            setIsBusListOpen(false);
        }
    }, [activeTab]);

    const toggleTheme = () => {
        const nextTheme = localIsDark ? "light" : "dark";
        setLocalIsDark(!localIsDark);
        setTheme(nextTheme);

        if (typeof document !== "undefined") {
            if (nextTheme === "dark") {
                document.documentElement.classList.add("dark");
                document.documentElement.style.colorScheme = "dark";
            } else {
                document.documentElement.classList.remove("dark");
                document.documentElement.style.colorScheme = "light";
            }
        }
    };

    const handleDefaultBusClick = (lat: number, lng: number) => {
        if (onBusClick) {
            onBusClick(lat, lng);
        } else if (map) {
            map.flyTo({
                center: [lng, lat],
                zoom: map.getZoom(),
                duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS,
            });
        }
    };

    const tabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        {id: "schedule", label: UI_TEXT.BOTTOM_NAV.TAB_SCHEDULE, icon: Calendar},
        {id: "map", label: UI_TEXT.BOTTOM_NAV.TAB_MAP, icon: MapPin},
    ];

    return (
        <div
            className={`fixed bottom-[calc(env(safe-area-inset-bottom,0)+1rem)] left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-3 max-w-[95vw] ${className}`}
        >
            {/* Expandable Floating Running Bus List Sheet */}
            {activeTab === "map" && isBusListOpen && (
                <div
                    className="w-full max-w-sm backdrop-blur-2xl bg-white/90 dark:bg-[#121212]/90 border border-black/10 dark:border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.7)] rounded-[28px] overflow-hidden transition-all duration-300 animate-fadeIn">
                    <div
                        className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                        <div className="flex items-center space-x-2">
                            <div
                                className="flex items-center justify-center w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <Bus className="w-4 h-4"/>
                            </div>
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                                {UI_TEXT.BOTTOM_NAV.RUNNING_LIST_TITLE(selectedRoute, runningBuses.length)}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsBusListOpen(false)}
                            className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4"/>
                        </button>
                    </div>

                    <ul className="text-xs sm:text-sm text-black dark:text-white max-h-[35svh] overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                        {runningBuses.length === 0 ? (
                            <li className="text-center py-6 text-gray-400 text-xs font-medium italic">
                                {UI_TEXT.BUS_LIST.NO_RUNNING_DESC}
                            </li>
                        ) : (
                            runningBuses.map((bus) => (
                                <BusListItem
                                    key={`${selectedRoute}-${bus.vehicleno}`}
                                    bus={bus}
                                    routeName={selectedRoute}
                                    getDirection={getDirection || (() => 0)}
                                    onClick={(lat, lng) => handleDefaultBusClick(lat, lng)}
                                />
                            ))
                        )}
                    </ul>
                </div>
            )}

            {/* Unified Bottom Floating Pill Navigation Bar */}
            <nav
                aria-label={UI_TEXT.ACCESSIBILITY.MAIN_NAV}
                className="
          flex items-center gap-1 sm:gap-1.5 p-1.5 px-2.5 sm:px-3
          bg-white/85 dark:bg-[#111111]/85 backdrop-blur-3xl
          border border-black/8 dark:border-white/10
          shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]
          rounded-full transition-all duration-300 max-w-full overflow-x-auto custom-scrollbar-hidden
        "
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

                {/* Main Nav Tabs */}
                <div className="flex items-center gap-1 shrink-0">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onTabChange(tab.id)}
                                className={`
                  flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-full text-xs sm:text-sm font-extrabold tracking-tight
                  transition-all duration-200 cursor-pointer select-none active:scale-95
                  ${
                                    isActive
                                        ? "bg-black dark:bg-white text-white dark:text-black shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                                        : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                                }
                `}
                                aria-current={isActive ? "page" : undefined}
                            >
                                <Icon
                                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4] ${isActive ? "animate-pulse" : ""}`}/>
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Dynamic Options for Timetable (Visible only when activeTab === "schedule") */}
                {activeTab === "schedule" && (
                    <>
                        {/* Divider */}
                        <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>

                        {/* Timetable Sub-tab Toggle Pills (Yonsei vs All) */}
                        <div className="flex items-center gap-1 shrink-0 animate-fadeIn">
                            <button
                                type="button"
                                onClick={() => onScheduleSubTabChange?.("yonsei")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                    scheduleSubTab === "yonsei"
                                        ? "bg-[#003876] text-white shadow-md shadow-[#003876]/25 scale-[1.02]"
                                        : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                                }`}
                            >
                                <GraduationCap className="w-3.5 h-3.5"/>
                                <span className="whitespace-nowrap">{UI_TEXT.BOTTOM_NAV.TAB_YONSEI}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => onScheduleSubTabChange?.("all")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                    scheduleSubTab === "all"
                                        ? "bg-black dark:bg-white text-white dark:text-black shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                                        : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                                }`}
                            >
                                <Bus className="w-3.5 h-3.5"/>
                                <span className="whitespace-nowrap">{UI_TEXT.BOTTOM_NAV.TAB_ALL}</span>
                            </button>
                        </div>
                    </>
                )}

                {/* Dynamic Options for Real-time Map (Visible only when activeTab === "map") */}
                {activeTab === "map" && (
                    <>
                        {/* Divider */}
                        <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>

                        {/* Route Selector Dropdown */}
                        <div
                            className="relative flex items-center bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] rounded-full px-3 py-1.5 border border-black/5 dark:border-white/10 transition-colors shrink-0 animate-fadeIn">
                            <select
                                value={selectedRoute}
                                onChange={(e) => onSelectRoute?.(e.target.value)}
                                className="appearance-none bg-transparent font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white pr-5 cursor-pointer focus:outline-none tracking-tight"
                            >
                                {allRoutes.filter(Boolean).map((route) => (
                                    <option key={route} value={route} className="text-black bg-white">
                                        {UI_TEXT.BOTTOM_NAV.ROUTE_OPTION(route)}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                className="w-3.5 h-3.5 absolute right-2.5 pointer-events-none text-slate-400"/>
                        </div>

                        {/* Running Bus List Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setIsBusListOpen(!isBusListOpen)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 shrink-0 animate-fadeIn ${
                                isBusListOpen
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                    : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                            }`}
                            title={UI_TEXT.NAV.BUS_LIST_LABEL}
                        >
                            <Bus className="w-3.5 h-3.5"/>
                            <span className="whitespace-nowrap">
                {UI_TEXT.BOTTOM_NAV.RUNNING_LIST_BTN(runningBuses.length)}
              </span>
                        </button>
                    </>
                )}

                {/* Divider */}
                <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>

                {/* Theme Switcher Button */}
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex items-center justify-center w-7.5 h-7.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all duration-200 active:scale-90 shrink-0 cursor-pointer"
                    aria-label={UI_TEXT.BOTTOM_NAV.TOGGLE_THEME}
                >
                    {!mounted ? (
                        <div className="w-4 h-4 rounded-full border border-gray-300 animate-pulse"/>
                    ) : localIsDark ? (
                        <Sun className="w-4 h-4" strokeWidth={2.5}/>
                    ) : (
                        <Moon className="w-4 h-4" strokeWidth={2.5}/>
                    )}
                </button>
            </nav>
        </div>
    );
}
