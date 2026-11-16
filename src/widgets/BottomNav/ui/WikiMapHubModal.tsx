"use client";

import React, {useDeferredValue, useMemo, useState} from "react";
import Link from "next/link";
import {BookOpen, ExternalLink, Eye, EyeOff, MapPin, MapPinPlus, Search, X} from "lucide-react";

import {useCityContext} from "@entities/city";
import {useWikiIndex, type WikiPageSummary} from "@entities/wiki";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {Modal} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";
import {WIKI_CATEGORY_PIN_STYLES} from "@widgets/MapContainer/lib/wikiPinTheme";

export interface WikiMapHubModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartAddPin: () => void;
    onSelectWikiPage: (page: WikiPageSummary) => void;
}

export const WikiMapHubModal: React.FC<WikiMapHubModalProps> = ({
                                                                    isOpen,
                                                                    onClose,
                                                                    onStartAddPin,
                                                                    onSelectWikiPage,
                                                                }) => {
    const {map} = useAppMapContext();
    const {currentCity} = useCityContext();
    const {settings, updateSettings} = useAppSettings();
    const [query, setQuery] = useState("");
    const [onlyPins, setOnlyPins] = useState(false);
    const deferredQuery = useDeferredValue(query);

    const {data, isLoading} = useWikiIndex({
        query: deferredQuery,
        pinsOnly: onlyPins,
        limit: 40,
        enabled: isOpen,
    });

    const pages = useMemo(() => {
        const raw = data?.pages ?? [];
        // Prioritize pages belonging to current city or having map coordinates
        return raw.slice().sort((a, b) => {
            const aCity = a.cityCode === currentCity.code ? 0 : 1;
            const bCity = b.cityCode === currentCity.code ? 0 : 1;
            if (aCity !== bCity) return aCity - bCity;
            const aHasPin = typeof a.lat === "number" && typeof a.lng === "number" ? 0 : 1;
            const bHasPin = typeof b.lat === "number" && typeof b.lng === "number" ? 0 : 1;
            return aHasPin - bHasPin;
        });
    }, [data?.pages, currentCity.code]);

    const handleSelectPage = (page: WikiPageSummary) => {
        triggerHaptic("selection");
        if (map && typeof page.lat === "number" && typeof page.lng === "number") {
            map.flyTo({
                center: [page.lng, page.lat],
                zoom: Math.max(map.getZoom(), 15.2),
                duration: 650,
            });
        }
        onClose();
        onSelectWikiPage(page);
    };

    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#003876] text-white shadow-sm shrink-0">
            <BookOpen className="w-5 h-5"/>
        </div>
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
                        <span>지도에 위키 핀 표시 중</span>
                    </>
                ) : (
                    <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400"/>
                        <span>지도 위키 핀 숨김 (켜기)</span>
                    </>
                )}
            </button>
            <Link
                href="/wiki"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-[11px] font-black text-[#003876] dark:text-sky-400 hover:underline"
            >
                <span>전체 위키 디렉토리</span>
                <ExternalLink className="w-3 h-3"/>
            </Link>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="지도 위키"
            subtitle="지도에 핀을 꽂아 새 문서를 만들고, 핀을 눌러 바로 위키를 확인하세요"
            icon={modalIcon}
            footer={modalFooter}
            maxWidth="lg"
            height="default"
            zIndex="z-[120]"
            modalId="wiki-hub"
            ariaLabel="지도 위키 허브"
        >
            <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 gap-3.5 overflow-hidden">
                {/* Primary CTA: Add Pin on Map */}
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("selection");
                        if (!settings.showWikiPins) {
                            updateSettings({showWikiPins: true});
                        }
                        onClose();
                        onStartAddPin();
                    }}
                    className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/20 transition active:scale-[0.99] cursor-pointer shrink-0"
                >
                    <div className="flex items-center gap-3 min-w-0 text-left">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 shrink-0">
                            <MapPinPlus className="w-5 h-5"/>
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-black tracking-tight">
                                지도에 위키 핀 추가하기
                            </div>
                            <div className="text-[11px] font-semibold text-emerald-50 truncate">
                                원하는 위치를 찍고 바로 새 위키 문서를 작성합니다
                            </div>
                        </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white/20 text-[11px] font-black shrink-0">
                        시작 →
                    </span>
                </button>

                {/* Search + Filter Bar */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="캠퍼스, 터미널, 정류장, 노선 위키 검색..."
                            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                aria-label="검색어 지우기"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5"/>
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setOnlyPins((prev) => !prev)}
                        className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-black border transition cursor-pointer shrink-0 ${
                            onlyPins
                                ? "bg-emerald-600 text-white border-transparent"
                                : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                        }`}
                    >
                        <MapPin className="w-3.5 h-3.5"/>
                        <span>핀만</span>
                    </button>
                </div>

                {/* Wiki Pins List */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-0.5 custom-scrollbar">
                    {isLoading && pages.length === 0 ? (
                        <p className="py-10 text-center text-xs font-bold text-slate-400">
                            위키 핀 목록을 불러오는 중...
                        </p>
                    ) : pages.length === 0 ? (
                        <div className="py-10 text-center space-y-2">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                일치하는 위키 문서가 없습니다.
                            </p>
                        </div>
                    ) : (
                        pages.map((page) => {
                            const style = WIKI_CATEGORY_PIN_STYLES[page.category] ?? WIKI_CATEGORY_PIN_STYLES.guide;
                            const Icon = style.icon;
                            const hasPin = typeof page.lat === "number" && typeof page.lng === "number";

                            return (
                                <button
                                    key={page.slug}
                                    type="button"
                                    onClick={() => handleSelectPage(page)}
                                    className="w-full text-left flex items-start gap-3 p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:border-[#003876]/40 dark:hover:border-sky-500/40 hover:bg-slate-50/70 dark:hover:bg-white/[0.06] transition cursor-pointer group"
                                >
                                    <div
                                        className={`flex items-center justify-center w-8 h-8 rounded-xl text-white shrink-0 mt-0.5 ${style.badgeBg}`}
                                    >
                                        <Icon className="w-4 h-4"/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-[#003876] dark:group-hover:text-sky-300">
                                                {page.title}
                                            </span>
                                            <span
                                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                                                    hasPin
                                                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                }`}
                                            >
                                                <MapPin className="w-2.5 h-2.5"/>
                                                {hasPin ? "지도 핀" : "문서"}
                                            </span>
                                        </div>
                                        {page.subtitle && (
                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                                {page.subtitle}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
};
