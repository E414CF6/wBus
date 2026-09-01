"use client";

import React, {useEffect, useState} from "react";
import {
    Bus,
    Calendar,
    ChevronDown,
    GraduationCap,
    Loader2,
    MapIcon,
    MapPin,
    MessageSquare,
    Moon,
    Sparkles,
    Sun,
    X,
} from "lucide-react";
import {useTheme} from "next-themes";

import {APP_CONFIG, MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";

import {BusListItem} from "@widgets/BusListSheet/BusListItem";
import {RouteSelectModal} from "@features/map-view/RouteSelectModal";
import {YONSEI_ROUTE_SET} from "@entities/route/routeMetadata";

import type {BusItem} from "@entities/bus/types";
import type {DirectionCode} from "@entities/route/types";
import type {SSEConnectionStatus} from "@features/live-tracking/useBusLocation";

export type NavTab = "schedule" | "map" | "chat";
export type TimetableSubTab = "yonsei" | "all";
export type DayMode = "AUTO" | "WEEKDAY" | "VACATION";

interface BottomNavProps {
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
    connectionStatus?: SSEConnectionStatus;
    hasFetched?: boolean;

    // Dynamic Chat options (Active when activeTab === "chat")
    chatFilterRoute?: string;
    onChatFilterRouteChange?: (route: string) => void;
    commentCount?: number;

    className?: string;
}

const CHAT_ROUTES = ["ALL", "30", "34", "34-1"];

/**
 * Unified Floating Pill Navigation Bar.
 * Combines Logo, Timetable/Map/Chat Tabs, Day Mode Switcher, Route Selector, Running Bus List Toggle, and Theme Switcher.
 */
export default function BottomNav({
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
                                      chatFilterRoute = "ALL",
                                      onChatFilterRouteChange,
                                      commentCount = 0,
                                      className = "",
                                  }: BottomNavProps) {
    const {map} = useAppMapContext();
    const {setTheme, resolvedTheme} = useTheme();
    const [mounted, setMounted] = useState(false);
    const [localIsDark, setLocalIsDark] = useState(false);
    const [isBusListOpen, setIsBusListOpen] = useState(false);
    const [isRoutePickerOpen, setIsRoutePickerOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            setLocalIsDark(resolvedTheme === "dark" || document.documentElement.classList.contains("dark"));
        }
    }, [mounted, resolvedTheme]);

    // Close bus list sheet and route picker when switching away from map tab
    useEffect(() => {
        if (activeTab !== "map") {
            setIsBusListOpen(false);
            setIsRoutePickerOpen(false);
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
        {id: "chat", label: UI_TEXT.BOTTOM_NAV.TAB_CHAT, icon: MessageSquare},
    ];

    const isYonseiSelected = YONSEI_ROUTE_SET.has(selectedRoute);
    const isConnecting = !hasFetched || connectionStatus === "connecting";

    return (
        <>
            {/* Route Selection Modal Sheet (Search, Categories, Grid) */}
            <RouteSelectModal
                isOpen={isRoutePickerOpen}
                onClose={() => setIsRoutePickerOpen(false)}
                allRoutes={allRoutes}
                selectedRoute={selectedRoute}
                onSelectRoute={(route) => {
                    onSelectRoute?.(route);
                    setIsRoutePickerOpen(false);
                }}
            />

            <div
                className={`fixed bottom-[calc(env(safe-area-inset-bottom,0)+1rem)] left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-3 max-w-[95vw] ${className}`}
            >
                {/* Expandable Floating Running Bus List Sheet (Map Tab) */}
                {activeTab === "map" && isBusListOpen && (
                    <div
                        className="w-full max-w-sm backdrop-blur-2xl bg-white/90 dark:bg-[#121212]/90 border border-black/10 dark:border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.7)] rounded-[28px] overflow-hidden transition-all duration-300 animate-fadeIn"
                    >
                        <div
                            className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]"
                        >
                            <div className="flex items-center space-x-2">
                                <div
                                    className="flex items-center justify-center w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                >
                                    <Bus className="w-4 h-4"/>
                                </div>
                                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                                    {isConnecting
                                        ? `${selectedRoute}번 실시간 연결 중`
                                        : runningBuses.length > 0
                                            ? UI_TEXT.BOTTOM_NAV.RUNNING_LIST_TITLE(selectedRoute, runningBuses.length)
                                            : `${selectedRoute}번 운행 종료 (0대)`}
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
                            {isConnecting ? (
                                <li className="flex flex-col items-center justify-center py-8 text-amber-600 dark:text-amber-400 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin"/>
                                    <span className="text-xs font-semibold">실시간 위치 정보를 확인하고 있습니다...</span>
                                </li>
                            ) : runningBuses.length === 0 ? (
                                <li className="text-center py-7 text-slate-500 dark:text-slate-400 text-xs font-medium space-y-1">
                                    <p className="font-bold text-slate-700 dark:text-slate-300">현재 운행 중인 버스가 없습니다.</p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">운행 종료 시간대이거나 차고지 배차 대기
                                        중입니다.</p>
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
                    className="flex items-center gap-1 sm:gap-1.5 p-1.5 px-2.5 sm:px-3 bg-white/85 dark:bg-[#111111]/85 backdrop-blur-3xl border border-black/8 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] rounded-full transition-all duration-300 max-w-full overflow-x-auto custom-scrollbar-hidden"
                >
                    {/* Brand Logo & Title */}
                    <div className="flex items-center gap-2 pl-1 pr-1 select-none shrink-0">
                        <div
                            className="flex items-center justify-center w-7.5 h-7.5 rounded-full bg-black dark:bg-white text-white dark:text-black shrink-0"
                        >
                            <MapIcon className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true"/>
                        </div>
                        <span
                            className="hidden xs:inline-block text-sm sm:text-base font-black text-black dark:text-white tracking-tight shrink-0"
                        >
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
                                    className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-full text-xs sm:text-sm font-extrabold tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                        isActive
                                            ? "bg-black dark:bg-white text-white dark:text-black shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]"
                                            : "text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                                    }`}
                                    aria-current={isActive ? "page" : undefined}
                                >
                                    <div className="relative">
                                        <Icon
                                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4] ${isActive ? "animate-pulse" : ""}`}
                                        />
                                        {tab.id === "chat" && commentCount > 0 && !isActive && (
                                            <span
                                                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse"
                                            />
                                        )}
                                    </div>
                                    <span className="whitespace-nowrap">{tab.label}</span>
                                    {tab.id === "chat" && commentCount > 0 && (
                                        <span
                                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                                isActive
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-blue-600/10 text-blue-600 dark:text-blue-400"
                                            }`}
                                        >
                                            {commentCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Dynamic Options for Timetable (Schedule Tab) */}
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

                            {/* Yonsei-specific Day Mode Toggle (Auto / Weekday / Vacation) */}
                            {scheduleSubTab === "yonsei" && onDayModeChange && (
                                <>
                                    {/* Divider */}
                                    <div
                                        className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>

                                    <div className="flex items-center gap-1 shrink-0 animate-fadeIn">
                                        <button
                                            type="button"
                                            onClick={() => onDayModeChange("AUTO")}
                                            className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                                dayMode === "AUTO"
                                                    ? "bg-blue-600 text-white shadow-xs scale-[1.02]"
                                                    : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10"
                                            }`}
                                            title={`자동 감지 (${isTodayWeekendOrHoliday ? "휴일" : "평일"})`}
                                        >
                                            <Sparkles className="w-3 h-3"/>
                                            <span className="whitespace-nowrap">자동</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => onDayModeChange("WEEKDAY")}
                                            className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                                dayMode === "WEEKDAY"
                                                    ? "bg-amber-600 text-white shadow-xs scale-[1.02]"
                                                    : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10"
                                            }`}
                                            title="평일 시간표"
                                        >
                                            <GraduationCap className="w-3 h-3"/>
                                            <span className="whitespace-nowrap">평일</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => onDayModeChange("VACATION")}
                                            className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                                dayMode === "VACATION"
                                                    ? "bg-indigo-600 text-white shadow-xs scale-[1.02]"
                                                    : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10"
                                            }`}
                                            title="방학·휴일 시간표"
                                        >
                                            <Bus className="w-3.5 h-3.5"/>
                                            <span className="whitespace-nowrap">방학·휴일</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Dynamic Options for Real-time Map (Map Tab) */}
                    {activeTab === "map" && (
                        <>
                            {/* Divider */}
                            <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>

                            {/* Enhanced Route Selector Button (Opens RouteSelectModal) */}
                            <button
                                type="button"
                                onClick={() => setIsRoutePickerOpen(true)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-95 shrink-0 animate-fadeIn shadow-xs ${
                                    isYonseiSelected
                                        ? "bg-[#003876]/15 dark:bg-[#003876]/35 hover:bg-[#003876]/25 border border-[#003876]/40 text-[#003876] dark:text-blue-300"
                                        : "bg-blue-600/10 dark:bg-blue-500/15 hover:bg-blue-600/20 dark:hover:bg-blue-500/25 border border-blue-500/30 text-blue-700 dark:text-blue-300"
                                }`}
                                title="노선 선택 (검색/목록)"
                            >
                                <Bus className="w-3.5 h-3.5"/>
                                <span className="whitespace-nowrap font-black">{selectedRoute || "노선"}번</span>
                                <ChevronDown className="w-3.5 h-3.5 opacity-70"/>
                            </button>

                            {/* Running Bus List Toggle Button */}
                            <button
                                type="button"
                                onClick={() => setIsBusListOpen(!isBusListOpen)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 shrink-0 animate-fadeIn ${
                                    isBusListOpen
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                        : isConnecting
                                            ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                            : runningBuses.length > 0
                                                ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                                : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-black/5 dark:border-white/10"
                                }`}
                                title={UI_TEXT.NAV.BUS_LIST_LABEL}
                            >
                                <Bus className="w-3.5 h-3.5"/>
                                <span className="whitespace-nowrap">
                                    {isConnecting
                                        ? "연결 중..."
                                        : runningBuses.length > 0
                                            ? UI_TEXT.BOTTOM_NAV.RUNNING_LIST_BTN(runningBuses.length)
                                            : "운행 종료 (0)"}
                                </span>
                            </button>
                        </>
                    )}

                    {/* Dynamic Options for Chat Tab (Route Filter Quick Switch) */}
                    {activeTab === "chat" && onChatFilterRouteChange && (
                        <>
                            {/* Divider */}
                            <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>

                            <div className="flex items-center gap-1 shrink-0 animate-fadeIn">
                                {CHAT_ROUTES.map((route) => (
                                    <button
                                        key={route}
                                        type="button"
                                        onClick={() => onChatFilterRouteChange(route)}
                                        className={`px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                            chatFilterRoute === route
                                                ? "bg-blue-600 text-white shadow-xs scale-[1.02]"
                                                : "bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10"
                                        }`}
                                    >
                                        <span className="whitespace-nowrap">
                                            {route === "ALL" ? UI_TEXT.BOTTOM_NAV.CHAT_ALL_FILTER : `${route}번`}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Divider before Theme Switcher */}
                    <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0"/>

                    {/* Theme Toggle Button */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={UI_TEXT.NAV.THEME_TOGGLE_LABEL}
                        className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all duration-200 cursor-pointer select-none active:scale-90 shrink-0"
                    >
                        {localIsDark ? (
                            <Moon className="w-4 h-4 text-blue-400 stroke-[2.2] animate-fadeIn"/>
                        ) : (
                            <Sun className="w-4 h-4 text-amber-500 stroke-[2.2] animate-fadeIn"/>
                        )}
                    </button>
                </nav>
            </div>
        </>
    );
}
