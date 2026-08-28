"use client";

import React, {useEffect, useState} from "react";
import {Bus, Calendar, GraduationCap, MessageSquare, Moon, Sparkles, Sun} from "lucide-react";
import {useTheme} from "next-themes";
import {DayMode} from "@/types/bus";

export type NavTab = "schedule" | "chat";

interface BottomNavProps {
    activeTab: NavTab;
    onTabChange: (tab: NavTab) => void;
    // Schedule Sub-options
    dayMode?: DayMode;
    onDayModeChange?: (mode: DayMode) => void;
    isTodayWeekendOrHoliday?: boolean;
    // Chat Sub-options
    chatFilterRoute?: string;
    onChatFilterRouteChange?: (route: string) => void;
    commentCount?: number;
    className?: string;
}

/**
 * Unified Floating Pill Navigation Bar.
 * Switches between 'Schedule' and 'Chat' tabs with dynamic sub-pills and theme switcher.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
                                                        activeTab,
                                                        onTabChange,
                                                        dayMode = "AUTO",
                                                        onDayModeChange,
                                                        isTodayWeekendOrHoliday = false,
                                                        chatFilterRoute = "ALL",
                                                        onChatFilterRouteChange,
                                                        commentCount = 0,
                                                        className = "",
                                                    }) => {
    const {setTheme, resolvedTheme} = useTheme();
    const [mounted, setMounted] = useState(false);
    const [localIsDark, setLocalIsDark] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            setLocalIsDark(resolvedTheme === "dark" || document.documentElement.classList.contains("dark"));
        }
    }, [mounted, resolvedTheme]);

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

    const tabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        {id: "schedule", label: "시간표", icon: Calendar},
        {id: "chat", label: "실시간 톡", icon: MessageSquare},
    ];

    return (
        <div
            className={`fixed bottom-[calc(env(safe-area-inset-bottom,0)+1rem)] left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex flex-col items-center gap-2 max-w-[96vw] ${className}`}
        >
            {/* Unified Bottom Floating Pill Navigation Bar */}
            <nav
                aria-label="메인 네비게이션"
                className="
          flex items-center gap-1 sm:gap-1.5 p-1.5 px-2.5 sm:px-3
          bg-white/90 dark:bg-[#111622]/90 backdrop-blur-2xl
          border border-slate-200/90 dark:border-white/15
          shadow-[0_12px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_16px_45px_rgba(0,0,0,0.6)]
          rounded-full transition-all duration-300 max-w-full overflow-x-auto custom-scrollbar
        "
            >
                {/* Brand Logo & Title */}
                <div className="flex items-center gap-2 pl-1 pr-1 select-none shrink-0">
                    <div
                        className="flex items-center justify-center w-7 h-7 rounded-full bg-[#003876] text-white shrink-0 shadow-sm">
                        <Bus className="w-3.5 h-3.5" strokeWidth={2.4}/>
                    </div>
                    <span
                        className="hidden xs:inline-block text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight shrink-0">
                        wBus
                    </span>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5 shrink-0"/>

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
                  flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-extrabold tracking-tight
                  transition-all duration-200 cursor-pointer select-none active:scale-95
                  ${
                                    isActive
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-slate-900/10 dark:shadow-white/10 scale-[1.02]"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                                }
                `}
                                aria-current={isActive ? "page" : undefined}
                            >
                                <div className="relative">
                                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]"/>
                                    {tab.id === "chat" && commentCount > 0 && !isActive && (
                                        <span
                                            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>
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

                {/* Dynamic Options for Schedule Tab */}
                {activeTab === "schedule" && onDayModeChange && (
                    <>
                        {/* Divider */}
                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>

                        {/* DayMode Toggle Pills (Auto / Weekday / Vacation) */}
                        <div className="flex items-center gap-1 shrink-0 animate-fadeIn">
                            <button
                                type="button"
                                onClick={() => onDayModeChange("AUTO")}
                                className={`flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                    dayMode === "AUTO"
                                        ? "bg-blue-600 text-white shadow-xs scale-[1.02]"
                                        : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5"
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
                                        : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5"
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
                                        : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5"
                                }`}
                                title="방학·휴일 시간표"
                            >
                                <Bus className="w-3 h-3"/>
                                <span className="whitespace-nowrap">방학·휴일</span>
                            </button>
                        </div>
                    </>
                )}

                {/* Dynamic Options for Chat Tab (Route Filter Quick Switch) */}
                {activeTab === "chat" && onChatFilterRouteChange && (
                    <>
                        {/* Divider */}
                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5 shrink-0 animate-fadeIn"/>

                        <div className="flex items-center gap-1 shrink-0 animate-fadeIn">
                            {["ALL", "30", "34", "34-1"].map((route) => (
                                <button
                                    key={route}
                                    type="button"
                                    onClick={() => onChatFilterRouteChange(route)}
                                    className={`px-2.5 py-1 sm:py-1.5 rounded-full text-[11px] font-black transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                        chatFilterRoute === route
                                            ? "bg-blue-600 text-white shadow-xs scale-[1.02]"
                                            : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5"
                                    }`}
                                >
                                    {route === "ALL" ? "전체" : `${route}번`}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Divider */}
                <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5 shrink-0"/>

                {/* Theme Switcher Button */}
                <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex items-center justify-center w-7.5 h-7.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200 active:scale-90 shrink-0 cursor-pointer"
                    title={localIsDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
                    aria-label="테마 전환"
                >
                    {!mounted ? (
                        <div
                            className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 animate-pulse"/>
                    ) : localIsDark ? (
                        <Sun className="w-4 h-4 text-amber-400 stroke-[2.4]"/>
                    ) : (
                        <Moon className="w-4 h-4 text-slate-700 stroke-[2.4]"/>
                    )}
                </button>
            </nav>
        </div>
    );
};
