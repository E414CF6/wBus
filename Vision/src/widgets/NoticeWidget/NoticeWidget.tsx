"use client";

import NoticeModal from "./NoticeModal";
import {useNoticeList} from "@entities/notice/hooks";
import {Megaphone, Sparkles} from "lucide-react";
import React, {useMemo, useState} from "react";

interface NoticeWidgetProps {
    className?: string;
}

/**
 * NoticeWidget component displays a floating trigger badge on the top right
 * of the screen and manages the state of the NoticeModal popup.
 */
export default function NoticeWidget({className = ""}: NoticeWidgetProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const {data: listData} = useNoticeList(1);

    const latestNotice = useMemo(() => {
        if (!listData?.notices || listData.notices.length === 0) return null;
        // Prefer latest pinned notice or latest overall notice
        return listData.notices.find((n) => n.isNotice) ?? listData.notices[0];
    }, [listData]);

    const hasUnread = Boolean(latestNotice);

    return (
        <>
            <div className={`fixed top-[env(safe-area-inset-top,1rem)] right-4 z-40 mt-4 ${className}`}>
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="
            group flex items-center gap-2.5 p-2 pr-3.5 sm:pr-4
            bg-white/85 dark:bg-[#111111]/85 backdrop-blur-3xl 
            border border-black/5 dark:border-white/10 
            shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] 
            rounded-[28px] cursor-pointer
            transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]
          "
                    aria-label="알림마당 열기"
                >
                    {/* Megaphone Icon with glowing badge */}
                    <div
                        className="relative flex items-center justify-center w-8.5 h-8.5 rounded-full bg-amber-500 text-white shadow-xs group-hover:bg-amber-600 transition-colors">
                        <Megaphone className="w-4 h-4 stroke-[2.2]"/>
                        {hasUnread && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"/>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"/>
              </span>
                        )}
                    </div>

                    {/* Widget Content Label & Ticker */}
                    <div className="flex flex-col text-left max-w-[140px] sm:max-w-[220px] overflow-hidden">
            <span
                className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              알림마당
                {latestNotice?.isNotice && <Sparkles className="w-2.5 h-2.5 inline"/>}
            </span>
                        <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200 truncate leading-tight">
                            {latestNotice ? latestNotice.title : "원주시 공지사항"}
                        </p>
                    </div>
                </button>
            </div>

            <NoticeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}
