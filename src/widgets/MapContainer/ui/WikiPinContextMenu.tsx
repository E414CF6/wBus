"use client";

import React, {useEffect, useMemo, useRef} from "react";
import {BookOpen, Check, History, MapPin, Pencil} from "lucide-react";
import type {WikiPageSummary, WikiPinColor} from "@entities/wiki";
import {resolveWikiPinTheme, WIKI_PIN_COLOR_LIST} from "../lib/wikiPinTheme";

export interface WikiPinContextMenuProps {
    page: WikiPageSummary | null;
    position: {x: number; y: number} | null;
    isUpdating?: boolean;
    onClose: () => void;
    onRead: (slug: string) => void;
    onEdit: (slug: string) => void;
    onHistory: (slug: string) => void;
    onMovePin: (page: WikiPageSummary) => void;
    onChangeColor: (page: WikiPageSummary, color: WikiPinColor) => void;
}

const MENU_WIDTH = 236;
const MENU_ESTIMATED_HEIGHT = 290;
const VIEWPORT_PADDING = 12;

export function WikiPinContextMenu({
    page,
    position,
    isUpdating = false,
    onClose,
    onRead,
    onEdit,
    onHistory,
    onMovePin,
    onChangeColor,
}: WikiPinContextMenuProps) {
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!page || !position) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("pointerdown", handlePointerDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [page, position, onClose]);

    const clampedCoords = useMemo(() => {
        if (!position) return null;
        if (typeof window === "undefined") return position;
        const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING);
        const maxTop = Math.max(
            VIEWPORT_PADDING,
            window.innerHeight - MENU_ESTIMATED_HEIGHT - VIEWPORT_PADDING,
        );
        return {
            x: Math.min(Math.max(VIEWPORT_PADDING, position.x), maxLeft),
            y: Math.min(Math.max(VIEWPORT_PADDING, position.y), maxTop),
        };
    }, [position]);

    if (!page || !clampedCoords) return null;

    const theme = resolveWikiPinTheme(page.pinColor);
    const previewTags = page.tags.slice(0, 3);

    return (
        <div
            ref={menuRef}
            role="menu"
            aria-label={`${page.title} 핀 편집 메뉴`}
            style={{
                left: `${clampedCoords.x}px`,
                top: `${clampedCoords.y}px`,
                width: `${MENU_WIDTH}px`,
            }}
            className="fixed z-[130] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            onContextMenu={(event) => event.preventDefault()}
        >
            <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dotBg}`} />
                    <p className="text-[12.5px] font-bold text-slate-900 dark:text-white truncate">
                        {page.title}
                    </p>
                </div>
                {previewTags.length > 0 && (
                    <p className="mt-0.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        {previewTags.map((tag) => `#${tag}`).join(" ")}
                    </p>
                )}
            </div>

            <div className="p-1.5 space-y-0.5">
                <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                        onEdit(page.slug);
                        onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                    <Pencil className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>내용 편집</span>
                </button>

                <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                        onMovePin(page);
                        onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>핀 위치 이동</span>
                </button>

                <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                        onRead(page.slug);
                        onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                    <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>문서 보기</span>
                </button>

                <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                        onHistory(page.slug);
                        onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                    <History className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>편집 이력</span>
                </button>
            </div>

            <div className="px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                        핀 색상 변경
                    </span>
                    {isUpdating && (
                        <span className="text-[10px] font-semibold text-slate-400">저장 중...</span>
                    )}
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                    {WIKI_PIN_COLOR_LIST.map((option) => {
                        const isSelected = option.id === theme.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                disabled={isUpdating}
                                onClick={() => onChangeColor(page, option.id)}
                                title={option.label}
                                aria-label={`핀 색상을 ${option.label}(으)로 변경`}
                                aria-pressed={isSelected}
                                className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110 disabled:opacity-50 ${option.swatchClass} ${
                                    isSelected
                                        ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900"
                                        : ""
                                }`}
                            >
                                {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
