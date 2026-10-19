"use client";

import React, {useMemo, useState} from "react";
import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    Clock,
    CornerDownRight,
    FileText,
    Hash,
    Search,
    X,
} from "lucide-react";
import {
    buildFootnoteMap,
    type BusRoute,
    computeDualHourlyTimetable,
    getFootnoteSymbol,
    type MinuteItem,
    resolveWeekdayAndVacationRoutes,
} from "@entities/schedule";

// ----------------------------------------------------------------------
// 1. WikiLink (Internal Document Hyperlink)
// ----------------------------------------------------------------------

interface WikiLinkProps {
    docId: string;
    onNavigate: (docId: string) => void;
    children: React.ReactNode;
    variant?: "inline" | "badge" | "route-pill";
    colorClass?: string;
    title?: string;
    className?: string;
}

export const WikiLink: React.FC<WikiLinkProps> = ({
    docId,
    onNavigate,
    children,
    variant = "inline",
    colorClass,
    title,
    className = "",
}) => {
    if (variant === "route-pill") {
        return (
            <button
                type="button"
                onClick={() => onNavigate(docId)}
                title={title || `${docId} 문서로 이동`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-extrabold border transition-all cursor-pointer active:scale-95 ${
                    colorClass ||
                    "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70 hover:bg-blue-100 dark:hover:bg-blue-900/60"
                } ${className}`}
            >
                {children}
            </button>
        );
    }

    if (variant === "badge") {
        return (
            <button
                type="button"
                onClick={() => onNavigate(docId)}
                title={title || `${docId} 문서로 이동`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-bold border border-slate-200 dark:border-white/10 transition-colors cursor-pointer ${className}`}
            >
                <FileText className="w-3 h-3 shrink-0 opacity-75" />
                <span>{children}</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onNavigate(docId)}
            title={title || `문서 이동`}
            className={`inline items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold hover:underline decoration-blue-500/60 underline-offset-2 cursor-pointer transition-colors ${className}`}
        >
            {children}
        </button>
    );
};

// ----------------------------------------------------------------------
// 2. WikiCategoryBox (Top Category Classification Bar)
// ----------------------------------------------------------------------

interface WikiCategoryBoxProps {
    categories: Array<{ label: string; targetDocId: string }>;
    onNavigate: (docId: string) => void;
}

export const WikiCategoryBox: React.FC<WikiCategoryBoxProps> = ({
    categories,
    onNavigate,
}) => {
    if (!categories || categories.length === 0) return null;

    return (
        <div className="px-3.5 py-2 rounded-lg border border-slate-300/90 dark:border-slate-700/90 bg-slate-50/90 dark:bg-[#161922] text-xs flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold text-slate-600 dark:text-slate-300 pr-1 border-r border-slate-300 dark:border-slate-700">
                분류
            </span>
            {categories.map((cat, idx) => (
                <React.Fragment key={`${cat.label}-${idx}`}>
                    {idx > 0 && (
                        <span className="text-slate-300 dark:text-slate-600 select-none">|</span>
                    )}
                    <WikiLink docId={cat.targetDocId} onNavigate={onNavigate}>
                        {cat.label}
                    </WikiLink>
                </React.Fragment>
            ))}
        </div>
    );
};

// ----------------------------------------------------------------------
// 3. WikiParentBanner (Upper Document Pointer)
// ----------------------------------------------------------------------

interface WikiParentBannerProps {
    parentDocId: string | null;
    parentTitle: string | null;
    secondaryParentDocId?: string | null;
    secondaryParentTitle?: string | null;
    onNavigate: (docId: string) => void;
}

export const WikiParentBanner: React.FC<WikiParentBannerProps> = ({
    parentDocId,
    parentTitle,
    secondaryParentDocId,
    secondaryParentTitle,
    onNavigate,
}) => {
    if (!parentDocId || !parentTitle) return null;

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/25 border border-blue-200/70 dark:border-blue-800/40 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
                <CornerDownRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-semibold text-slate-500 dark:text-slate-400">상위 문서:</span>
                <WikiLink docId={parentDocId} onNavigate={onNavigate}>
                    {parentTitle}
                </WikiLink>
            </div>
            {secondaryParentDocId && secondaryParentTitle && (
                <div className="flex items-center gap-1.5">
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">연계 문서:</span>
                    <WikiLink docId={secondaryParentDocId} onNavigate={onNavigate}>
                        {secondaryParentTitle}
                    </WikiLink>
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------------------------
// 4. WikiToc (Table of Contents Box)
// ----------------------------------------------------------------------

export interface WikiTocItem {
    id: string;
    number: string;
    title: string;
    indent?: number;
}

interface WikiTocProps {
    items: WikiTocItem[];
}

export const WikiToc: React.FC<WikiTocProps> = ({items}) => {
    if (items.length === 0) return null;

    const handleJump = (id: string) => {
        const el = document.getElementById(`wiki-sec-${id}`);
        if (el) {
            el.scrollIntoView({behavior: "smooth", block: "start"});
        }
    };

    return (
        <div className="inline-block min-w-[240px] max-w-full sm:max-w-md p-3.5 sm:p-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#151821] shadow-2xs">
            <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>목차</span>
            </div>
            <ul className="space-y-1 text-xs sm:text-[13px]">
                {items.map((item) => (
                    <li
                        key={item.id}
                        style={{paddingLeft: item.indent ? `${item.indent * 14}px` : undefined}}
                    >
                        <button
                            type="button"
                            onClick={() => handleJump(item.id)}
                            className="text-left hover:underline text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-baseline gap-1.5"
                        >
                            <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">
                                {item.number}.
                            </span>
                            <span className="font-medium">{item.title}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// ----------------------------------------------------------------------
// 5. WikiSection (Collapsible Namuwiki-style Section Heading & Body)
// ----------------------------------------------------------------------

interface WikiSectionProps {
    id: string;
    number: string;
    title: React.ReactNode;
    rightBadge?: React.ReactNode;
    defaultOpen?: boolean;
    level?: 2 | 3;
    children: React.ReactNode;
}

export const WikiSection: React.FC<WikiSectionProps> = ({
    id,
    number,
    title,
    rightBadge,
    defaultOpen = true,
    level = 2,
    children,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <section id={`wiki-sec-${id}`} className="scroll-mt-16">
            <div
                onClick={() => setIsOpen((prev) => !prev)}
                className={`group flex items-center justify-between gap-2 cursor-pointer select-none border-b-2 transition-colors ${
                    level === 2
                        ? "pb-2 pt-3 border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500"
                        : "pb-1.5 pt-2 border-slate-200 dark:border-slate-800 hover:border-blue-400"
                }`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {isOpen ? (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                        ) : (
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                        )}
                    </span>
                    <h2
                        className={`font-black tracking-tight text-slate-900 dark:text-white flex items-baseline gap-1.5 flex-wrap ${
                            level === 2 ? "text-base sm:text-xl" : "text-sm sm:text-base"
                        }`}
                    >
                        <span className="text-blue-600 dark:text-blue-400 font-mono">
                            {number}.
                        </span>
                        <span>{title}</span>
                    </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {rightBadge}
                    <button
                        type="button"
                        onClick={() => setIsOpen((prev) => !prev)}
                        className="text-[11px] font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                    >
                        [{isOpen ? "접기" : "펼치기"}]
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="pt-3.5 pb-2 space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {children}
                </div>
            )}
        </section>
    );
};

// ----------------------------------------------------------------------
// 6. WikiFoldBox (Namuwiki [ 펼치기 · 접기 ] Template Box)
// ----------------------------------------------------------------------

interface WikiFoldBoxProps {
    title: React.ReactNode;
    subtitle?: string;
    headerColorClass?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

export const WikiFoldBox: React.FC<WikiFoldBoxProps> = ({
    title,
    subtitle,
    headerColorClass = "bg-slate-100 dark:bg-[#1c202c] text-slate-800 dark:text-slate-100",
    defaultOpen = false,
    children,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-[#12151e] shadow-2xs my-2">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`w-full px-3.5 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm font-extrabold transition-opacity hover:opacity-95 cursor-pointer ${headerColorClass}`}
            >
                <div className="flex items-center gap-2 min-w-0 text-left">
                    <span>{title}</span>
                    {subtitle && (
                        <span className="text-[11px] font-normal opacity-80 truncate">
                            ({subtitle})
                        </span>
                    )}
                </div>
                <span className="text-[11px] font-bold shrink-0 opacity-90">
                    [ {isOpen ? "접기" : "펼치기"} ]
                </span>
            </button>
            {isOpen && (
                <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800">
                    {children}
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------------------------
// 7. WikiCallout (Quote / Notice Block)
// ----------------------------------------------------------------------

interface WikiCalloutProps {
    children: React.ReactNode;
    tone?: "blue" | "amber" | "teal";
}

export const WikiCallout: React.FC<WikiCalloutProps> = ({children, tone = "blue"}) => {
    const toneClass =
        tone === "amber"
            ? "border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20 text-amber-950 dark:text-amber-200"
            : tone === "teal"
                ? "border-l-teal-600 bg-teal-50/60 dark:bg-teal-950/20 text-teal-950 dark:text-teal-200"
                : "border-l-blue-600 bg-slate-50 dark:bg-[#171b26] text-slate-700 dark:text-slate-300";

    return (
        <blockquote
            className={`px-3.5 py-2.5 border-l-4 rounded-r-lg border border-slate-200/80 dark:border-slate-800 text-xs sm:text-[13px] leading-relaxed ${toneClass}`}
        >
            {children}
        </blockquote>
    );
};

// ----------------------------------------------------------------------
// 8. WikiInfobox (Right/Top Summary Table)
// ----------------------------------------------------------------------

export interface WikiInfoboxRow {
    label: string;
    value: React.ReactNode;
}

interface WikiInfoboxProps {
    title: string;
    subtitle?: string;
    badge?: string;
    headerStyle?: React.CSSProperties;
    headerClassName?: string;
    rows: WikiInfoboxRow[];
    footer?: React.ReactNode;
}

export const WikiInfobox: React.FC<WikiInfoboxProps> = ({
    title,
    subtitle,
    badge,
    headerStyle,
    headerClassName = "bg-[#003876] text-white",
    rows,
    footer,
}) => {
    return (
        <div className="w-full md:w-84 shrink-0 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-[#141720] shadow-xs text-xs">
            <div
                style={headerStyle}
                className={`px-4 py-3 text-center space-y-0.5 ${headerClassName}`}
            >
                {badge && (
                    <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-85">
                        {badge}
                    </div>
                )}
                <div className="text-base sm:text-lg font-black tracking-tight">{title}</div>
                {subtitle && <div className="text-[11px] font-medium opacity-90">{subtitle}</div>}
            </div>

            <table className="w-full border-collapse text-left">
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {rows.map((row, idx) => (
                        <tr key={idx}>
                            <th className="w-26 py-2 px-3 bg-slate-100/90 dark:bg-[#1b1f2b] font-extrabold text-slate-700 dark:text-slate-300 align-middle border-r border-slate-200 dark:border-slate-800">
                                {row.label}
                            </th>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-medium align-middle">
                                {row.value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {footer && (
                <div className="p-2.5 bg-slate-50 dark:bg-[#181c26] border-t border-slate-200 dark:border-slate-800">
                    {footer}
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------------------------
// 9. DualHourlyTimetableBlock (Inline Wiki Hourly Comparison Table)
// ----------------------------------------------------------------------

interface DualHourlyTimetableBlockProps {
    route: BusRoute;
    allRoutes: BusRoute[];
    now: Date;
    locationLabel?: string;
}

function WikiMinuteBadge({
    item,
    variant,
    selectedFootnote,
    onSelectFootnote,
}: {
    item: MinuteItem;
    variant: "weekday" | "vacation";
    selectedFootnote: number | null;
    onSelectFootnote: (fn: number | null) => void;
}) {
    const isSelectedFn =
        selectedFootnote !== null && item.footnoteNumber === selectedFootnote;
    const isDimmed =
        selectedFootnote !== null && item.footnoteNumber !== selectedFootnote;

    const baseBadge = item.isNextBus
        ? variant === "weekday"
            ? "bg-teal-600 text-white border-teal-500 ring-2 ring-teal-400/50 font-black"
            : "bg-amber-600 text-white border-amber-500 ring-2 ring-amber-400/50 font-black"
        : isSelectedFn
            ? "bg-blue-600 text-white border-blue-500 font-black"
            : "bg-slate-100 dark:bg-[#1d2230] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 font-bold";

    return (
        <button
            type="button"
            onClick={() => {
                if (item.footnoteNumber) {
                    onSelectFootnote(
                        selectedFootnote === item.footnoteNumber ? null : item.footnoteNumber
                    );
                }
            }}
            title={
                item.notes
                    ? `${item.destDepTime} 출발 · 비고: ${item.notes}`
                    : `${item.destDepTime} 출발`
            }
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded border text-xs font-mono transition-all ${baseBadge} ${
                isDimmed ? "opacity-35" : ""
            } ${item.footnoteNumber ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
        >
            <span>{item.minuteStr}분</span>
            {item.footnoteSymbol && (
                <span className="text-[10px] font-sans text-blue-600 dark:text-blue-300 font-extrabold ml-0.5">
                    {item.footnoteSymbol}
                </span>
            )}
            {item.isNextBus && (
                <span className="ml-1 px-1 py-0.2 rounded bg-black/20 text-[9px] font-sans font-black">
                    다음
                </span>
            )}
        </button>
    );
}

export const DualHourlyTimetableBlock: React.FC<DualHourlyTimetableBlockProps> = ({
    route,
    allRoutes,
    now,
    locationLabel = "종점(연세대/회촌)",
}) => {
    const [tableSearch, setTableSearch] = useState("");
    const [selectedFootnote, setSelectedFootnote] = useState<number | null>(null);

    const currentHourStr = useMemo(
        () => String(now.getHours()).padStart(2, "0"),
        [now]
    );

    const {weekdayRoute, vacationRoute} = useMemo(
        () => resolveWeekdayAndVacationRoutes(route, allRoutes),
        [route, allRoutes]
    );

    const footnoteMap = useMemo(
        () => buildFootnoteMap(weekdayRoute, vacationRoute),
        [weekdayRoute, vacationRoute]
    );

    const dualHourlyTimetable = useMemo(
        () =>
            computeDualHourlyTimetable({
                route,
                weekdayRoute,
                vacationRoute,
                tableSearch,
                now,
                footnoteMap,
                currentHourStr,
            }),
        [route, weekdayRoute, vacationRoute, tableSearch, now, footnoteMap, currentHourStr]
    );

    const isSingleSchedule =
        route.routeNo === "30" ||
        !weekdayRoute ||
        !vacationRoute ||
        weekdayRoute.id === vacationRoute.id;

    return (
        <div className="space-y-2.5">
            {/* Search & Legend Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-[#171b26] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>
                        기준: <strong>{locationLabel} 출발 시각</strong> (시각 뒤 원문자는 경유지·행선지 각주)
                    </span>
                </div>
                <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="시간·경유지 검색 (예: 08:, 원주역)"
                        className="w-full pl-8 pr-7 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    {tableSearch && (
                        <button
                            type="button"
                            onClick={() => setTableSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Footnote Interactive Legend */}
            {footnoteMap.size > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-800 dark:text-amber-300">
                        <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            각주 안내 (클릭하면 해당 경유 시간만 강조됩니다)
                        </span>
                        {selectedFootnote !== null && (
                            <button
                                type="button"
                                onClick={() => setSelectedFootnote(null)}
                                className="underline cursor-pointer text-blue-600 dark:text-blue-400"
                            >
                                필터 해제
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {Array.from(footnoteMap.entries()).map(([noteText, fnNum]) => {
                            const active = selectedFootnote === fnNum;
                            return (
                                <button
                                    key={fnNum}
                                    type="button"
                                    onClick={() =>
                                        setSelectedFootnote(active ? null : fnNum)
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                                        active
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white dark:bg-[#161a24] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-blue-400"
                                    }`}
                                >
                                    <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                        {getFootnoteSymbol(fnNum)}
                                    </span>
                                    <span>{noteText}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Wiki Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                            <th className="py-2 px-3 w-16 text-center border-r border-slate-300 dark:border-slate-700">
                                시각
                            </th>
                            <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                {isSingleSchedule
                                    ? "운행 시각 (연중·매일 동일)"
                                    : "평일 (학기중) 출발 분"}
                            </th>
                            {!isSingleSchedule && (
                                <th className="py-2 px-3">
                                    방학 · 토요일 · 공휴일 출발 분
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {dualHourlyTimetable.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isSingleSchedule ? 2 : 3}
                                    className="py-6 text-center text-slate-400"
                                >
                                    검색 조건에 일치하는 출발 시각이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            dualHourlyTimetable.map((row) => (
                                <tr
                                    key={row.hourStr}
                                    className={
                                        row.isCurrentHour
                                            ? "bg-blue-50/60 dark:bg-blue-950/25"
                                            : "bg-white dark:bg-[#12151e]"
                                    }
                                >
                                    <td className="py-2 px-2.5 text-center font-mono font-black text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 align-middle">
                                        <span>{row.displayHour}시</span>
                                        {row.isCurrentHour && (
                                            <span className="block text-[9px] font-sans font-extrabold text-blue-600 dark:text-blue-400">
                                                현재
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 align-middle">
                                        <div className="flex flex-wrap gap-1.5">
                                            {row.weekdayMinutes.length === 0 ? (
                                                <span className="text-slate-300 dark:text-slate-600">-</span>
                                            ) : (
                                                row.weekdayMinutes.map((m) => (
                                                    <WikiMinuteBadge
                                                        key={`w-${m.seq}`}
                                                        item={m}
                                                        variant="weekday"
                                                        selectedFootnote={selectedFootnote}
                                                        onSelectFootnote={setSelectedFootnote}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    {!isSingleSchedule && (
                                        <td className="py-2 px-3 align-middle">
                                            <div className="flex flex-wrap gap-1.5">
                                                {row.vacationMinutes.length === 0 ? (
                                                    <span className="text-slate-300 dark:text-slate-600">-</span>
                                                ) : (
                                                    row.vacationMinutes.map((m) => (
                                                        <WikiMinuteBadge
                                                            key={`v-${m.seq}`}
                                                            item={m}
                                                            variant="vacation"
                                                            selectedFootnote={selectedFootnote}
                                                            onSelectFootnote={setSelectedFootnote}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
