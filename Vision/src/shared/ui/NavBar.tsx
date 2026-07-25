"use client";

import {useNoticeList} from "@entities/notice/hooks";
import {APP_CONFIG} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {NoticeModal} from "@widgets/NoticeWidget";
import {MapIcon, Megaphone, Moon, Sun} from "lucide-react";
import {useTheme} from "next-themes";
import React, {useEffect, useMemo, useState} from "react";

interface NavBarProps {
    className?: string;
}

/**
 * Floating Navigation Bar / Header.
 * Displays the App Logo, Name, integrated Notice (알림마당) Trigger, and Theme Toggle.
 */
export default function NavBar({className = ""}: NavBarProps) {
    const {setTheme, resolvedTheme} = useTheme();
    const [mounted, setMounted] = useState(false);
    const [localIsDark, setLocalIsDark] = useState(false);
    const [isNoticeOpen, setIsNoticeOpen] = useState(false);

    const {data: noticeData} = useNoticeList(1);

    const latestNotice = useMemo(() => {
        if (!noticeData?.notices || noticeData.notices.length === 0) return null;
        return noticeData.notices.find((n) => n.isNotice) ?? noticeData.notices[0];
    }, [noticeData]);

    const hasUnread = Boolean(latestNotice);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync localIsDark with resolvedTheme and initial DOM class list
    useEffect(() => {
        if (mounted) {
            setLocalIsDark(resolvedTheme === "dark" || document.documentElement.classList.contains("dark"));
        }
    }, [mounted, resolvedTheme]);

    const toggleTheme = () => {
        const nextTheme = localIsDark ? "light" : "dark";
        setLocalIsDark(!localIsDark);

        // 1. Update next-themes to persist selection in localStorage
        setTheme(nextTheme);

        // 2. Direct DOM manipulation fallback
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

    return (
        <>
            <nav
                aria-label={UI_TEXT.ACCESSIBILITY.MAIN_NAV}
                className={`absolute top-[env(safe-area-inset-top,1rem)] left-4 z-50 mt-4 ${className}`}
            >
                <div
                    className="
            flex items-center gap-2 sm:gap-3 p-2.5 pr-3.5 
            bg-white/85 dark:bg-[#111111]/85 backdrop-blur-3xl 
            border border-black/4 dark:border-white/6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-[28px]
            transition-transform hover:scale-102 active:scale-98 cursor-default
          "
                >
                    {/* Logo Icon Container */}
                    <div
                        className="flex items-center justify-center w-8.5 h-8.5 rounded-full bg-black dark:bg-white text-white dark:text-black shrink-0">
                        <MapIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true"/>
                    </div>

                    {/* App Title */}
                    <h1 className="text-[16px] font-extrabold text-black dark:text-white tracking-tight select-none shrink-0">
                        {APP_CONFIG.NAME}
                    </h1>

                    {/* Divider */}
                    <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 sm:mx-1 shrink-0"/>

                    {/* Notice Widget Button (Integrated) */}
                    <button
                        type="button"
                        onClick={() => setIsNoticeOpen(true)}
                        className="
              group flex items-center gap-1.5 px-2.5 py-1 rounded-full 
              bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400 dark:hover:bg-amber-400/25
              transition-all duration-200 active:scale-95 cursor-pointer select-none
            "
                        aria-label="알림마당 열기"
                    >
                        <div className="relative flex items-center justify-center shrink-0">
                            <Megaphone className="w-3.5 h-3.5 stroke-[2.2]"/>
                            {hasUnread && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"/>
                </span>
                            )}
                        </div>
                        <span className="text-[13px] font-bold tracking-tight shrink-0">알림마당</span>
                        {latestNotice && (
                            <span
                                className="hidden md:inline-block max-w-[160px] text-[12px] font-normal text-gray-600 dark:text-gray-300 truncate">
                · {latestNotice.title}
              </span>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5 sm:mx-1 shrink-0"/>

                    {/* Theme Toggle Button */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="flex items-center justify-center w-8.5 h-8.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all duration-200 active:scale-90 shrink-0"
                        aria-label="Toggle theme"
                    >
                        {!mounted ? (
                            <div className="w-4.5 h-4.5 rounded-full border border-gray-300 animate-pulse"/>
                        ) : localIsDark ? (
                            <Sun className="w-4.5 h-4.5" strokeWidth={2.5}/>
                        ) : (
                            <Moon className="w-4.5 h-4.5" strokeWidth={2.5}/>
                        )}
                    </button>
                </div>
            </nav>

            {/* Notice Modal */}
            <NoticeModal
                isOpen={isNoticeOpen}
                onClose={() => setIsNoticeOpen(false)}
            />
        </>
    );
}
