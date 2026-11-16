"use client";

import React, {useMemo, useState} from "react";
import {Eye, EyeOff, Lock, MapPin, MapPinPlus, PenLine, Search, X} from "lucide-react";

import {useCityContext} from "@entities/city";
import {useWikiPins, type WikiPageSummary} from "@entities/wiki";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {markModalReplacing, Modal} from "@shared/ui";
import {matchesHangul} from "@shared/utils/hangul";
import {triggerHaptic} from "@shared/utils/haptics";
import {resolveWikiPinTheme} from "../lib/wikiPinTheme";

export interface WikiPinListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartAddPin: () => void;
    onSelectWikiPin: (slug: string, mode?: "read" | "edit") => void;
}

export const WikiPinListModal: React.FC<WikiPinListModalProps> = ({
                                                                      isOpen,
                                                                      onClose,
                                                                      onStartAddPin,
                                                                      onSelectWikiPin,
                                                                  }) => {
    const {map} = useAppMapContext();
    const {currentCity} = useCityContext();
    const {settings, updateSettings} = useAppSettings();
    const [query, setQuery] = useState("");

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setQuery("");
        }
    }

    const {data, isLoading} = useWikiPins({enabled: isOpen});

    const pins = useMemo(() => {
        const raw = (data?.pages ?? []).filter(
            (page) => typeof page.lat === "number" && typeof page.lng === "number",
        );
        const trimmed = query.trim().replace(/^#/, "");
        const filtered = trimmed
            ? raw.filter((page) => {
                return (
                    matchesHangul(page.title, trimmed) ||
                    matchesHangul(page.subtitle, trimmed) ||
                    page.tags.some((t) => matchesHangul(t, trimmed))
                );
            })
            : raw;

        return filtered.slice().sort((a, b) => {
            const aCity = a.cityCode === currentCity.code ? 0 : 1;
            const bCity = b.cityCode === currentCity.code ? 0 : 1;
            if (aCity !== bCity) return aCity - bCity;
            const aPinned = a.pinned ? 0 : 1;
            const bPinned = b.pinned ? 0 : 1;
            if (aPinned !== bPinned) return aPinned - bPinned;
            return b.updatedAt.localeCompare(a.updatedAt);
        });
    }, [data?.pages, query, currentCity.code]);

    const handleOpenPin = (page: WikiPageSummary, mode: "read" | "edit") => {
        triggerHaptic("selection");
        if (map && typeof page.lat === "number" && typeof page.lng === "number") {
            map.flyTo({
                center: [page.lng, page.lat],
                zoom: Math.max(map.getZoom(), 15.2),
                duration: 650,
            });
        }
        markModalReplacing("wiki-pin-list");
        onClose();
        onSelectWikiPin(page.slug, mode);
    };

    const handleStartAdd = () => {
        triggerHaptic("selection");
        onClose();
        onStartAddPin();
    };

    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#003876] text-white shadow-sm shrink-0">
            <MapPin className="w-5 h-5"/>
        </div>
    );

    const headerActions = (
        <button
            type="button"
            onClick={handleStartAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer shrink-0"
        >
            <MapPinPlus className="w-3.5 h-3.5"/>
            <span>핀 추가</span>
        </button>
    );

    const modalFooter = (
        <>
            <button
                type="button"
                onClick={() => {
                    triggerHaptic("selection");
                    updateSettings({showWikiPins: !settings.showWikiPins});
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
                {settings.showWikiPins ? (
                    <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"/>
                        <span>지도에 핀 표시 중</span>
                    </>
                ) : (
                    <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400"/>
                        <span>지도 핀 숨김 (켜기)</span>
                    </>
                )}
            </button>

            <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    총 {pins.length}개 핀
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black cursor-pointer hover:opacity-90 transition active:scale-95"
                >
                    닫기
                </button>
            </div>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="지도 위키 핀 목록"
            subtitle="등록된 위키 핀을 탐색하고 바로 편집하거나 새 핀을 추가할 수 있습니다"
            icon={modalIcon}
            headerActions={headerActions}
            footer={modalFooter}
            maxWidth="lg"
            height="default"
            zIndex="z-[120]"
            modalId="wiki-pin-list"
            ariaLabel="지도 위키 핀 목록 모달"
        >
            <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 gap-3.5">
                {/* Search input */}
                <div className="relative flex items-center shrink-0">
                    <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none"/>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="제목 또는 #해시태그로 검색"
                        aria-label="위키 핀 검색"
                        className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/8 dark:border-white/10 text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003876]/40 dark:focus:ring-sky-500/40"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            aria-label="검색어 지우기"
                            className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5"/>
                        </button>
                    )}
                </div>

                {/* Pin List */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-0.5 custom-scrollbar">
                    {isLoading && pins.length === 0 ? (
                        <div className="py-12 text-center space-y-2">
                            <div
                                className="w-7 h-7 mx-auto rounded-full border-2 border-[#003876] border-t-transparent animate-spin"/>
                            <p className="text-xs font-bold text-slate-400">
                                위키 핀 목록을 불러오는 중...
                            </p>
                        </div>
                    ) : pins.length === 0 ? (
                        <div className="py-12 text-center space-y-3">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {query.trim()
                                    ? "검색 조건과 일치하는 위키 핀이 없습니다."
                                    : "등록된 지도 위키 핀이 아직 없습니다."}
                            </p>
                            <button
                                type="button"
                                onClick={handleStartAdd}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer"
                            >
                                <MapPinPlus className="w-3.5 h-3.5"/>
                                <span>지도에 첫 핀 추가하기</span>
                            </button>
                        </div>
                    ) : (
                        pins.map((page) => {
                            const theme = resolveWikiPinTheme(page.pinColor);

                            return (
                                <div
                                    key={page.slug}
                                    className="flex items-stretch gap-2 p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-[#003876]/35 dark:hover:border-sky-500/35 transition group"
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleOpenPin(page, "read")}
                                        className="flex-1 min-w-0 flex items-start gap-3 text-left cursor-pointer"
                                    >
                                        <div
                                            className={`flex items-center justify-center w-9 h-9 rounded-xl text-white shrink-0 mt-0.5 shadow-2xs ${theme.badgeBg}`}
                                        >
                                            <MapPin className="w-4 h-4"/>
                                        </div>

                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-[#003876] dark:group-hover:text-sky-300">
                                                    {page.title}
                                                </span>
                                                <span
                                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
                                                    v{page.version}
                                                </span>
                                            </div>

                                            {page.tags.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1">
                                                    {page.tags.slice(0, 3).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-white/10 ${theme.pillTextClass}`}
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {page.subtitle && (
                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
                                                    {page.subtitle}
                                                </p>
                                            )}

                                            <div
                                                className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                                {typeof page.lat === "number" && typeof page.lng === "number" && (
                                                    <span className="font-mono tabular-nums">
                                                        {page.lat.toFixed(4)}, {page.lng.toFixed(4)}
                                                    </span>
                                                )}
                                                {page.linkedRouteCount > 0 && (
                                                    <span>· 노선 {page.linkedRouteCount}</span>
                                                )}
                                                {page.boardingStopCount > 0 && (
                                                    <span>· 승강장 {page.boardingStopCount}</span>
                                                )}
                                                {page.hasShuttle && <span>· 셔틀</span>}
                                            </div>
                                        </div>
                                    </button>

                                    <div className="flex items-center shrink-0 pl-1">
                                        <button
                                            type="button"
                                            disabled={Boolean(page.isProtected)}
                                            onClick={() => handleOpenPin(page, "edit")}
                                            title={
                                                page.isProtected
                                                    ? "보호된 문서는 편집할 수 없습니다"
                                                    : `${page.title} 핀 편집`
                                            }
                                            aria-label={`${page.title} 핀 편집`}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition shrink-0 ${
                                                page.isProtected
                                                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 opacity-75 cursor-not-allowed"
                                                    : "bg-sky-50 hover:bg-[#003876] text-[#003876] hover:text-white dark:bg-sky-950/60 dark:hover:bg-sky-600 dark:text-sky-300 dark:hover:text-white cursor-pointer active:scale-95"
                                            }`}
                                        >
                                            {page.isProtected ? (
                                                <>
                                                    <Lock className="w-3 h-3"/>
                                                    <span>보호</span>
                                                </>
                                            ) : (
                                                <>
                                                    <PenLine className="w-3 h-3"/>
                                                    <span>편집</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
};
