"use client";

import React, {memo} from "react";
import {Calendar, MapPin, MessageSquare} from "lucide-react";
import {UI_TEXT} from "@shared/config/locale";
import type {NavTab} from "@shared/types/navigation";

interface NavTabButtonsProps {
    activeTab: NavTab;
    onTabChange: (tab: NavTab) => void;
    commentCount?: number;
}

const TABS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {id: "schedule", label: UI_TEXT.BOTTOM_NAV.TAB_SCHEDULE, icon: Calendar},
    {id: "map", label: UI_TEXT.BOTTOM_NAV.TAB_MAP, icon: MapPin},
    {id: "chat", label: UI_TEXT.BOTTOM_NAV.TAB_CHAT, icon: MessageSquare},
];

export const NavTabButtons = memo(function NavTabButtons({
    activeTab,
    onTabChange,
    commentCount = 0,
}: NavTabButtonsProps) {
    return (
        <div className="flex items-center gap-1 shrink-0">
            {TABS.map((tab) => {
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
                                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4] ${
                                    isActive ? "animate-pulse" : ""
                                }`}
                            />
                            {tab.id === "chat" && commentCount > 0 && !isActive && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>
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
    );
});
