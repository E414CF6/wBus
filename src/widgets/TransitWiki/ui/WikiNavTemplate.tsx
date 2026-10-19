"use client";

import React, {useMemo, useState} from "react";
import {Bus, ChevronDown, ChevronUp, Star} from "lucide-react";
import type {BusRoute} from "@entities/schedule";
import {WikiLink} from "./WikiPrimitives";

interface WikiNavTemplateProps {
    cityCode: string;
    cityName: string;
    activeDocId: string;
    routes: BusRoute[];
    allRouteNames: string[];
    bookmarks: string[];
    onNavigate: (docId: string) => void;
    defaultExpanded?: boolean;
}

export const WikiNavTemplate: React.FC<WikiNavTemplateProps> = ({
    cityCode,
    cityName,
    activeDocId,
    routes,
    allRouteNames,
    bookmarks,
    onNavigate,
    defaultExpanded = false,
}) => {
    const [isRoutesExpanded, setIsRoutesExpanded] = useState(defaultExpanded);
    const isWonju = cityCode === "32020";
    const shortCity = cityName.split("/")[0];

    // Unique sorted route numbers
    const uniqueRouteNos = useMemo(() => {
        const set = new Set<string>();
        routes.forEach((r) => set.add(r.routeNo));
        allRouteNames.forEach((r) => set.add(r));
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, {numeric: true})
        );
    }, [routes, allRouteNames]);

    // Group routes by series for Namuwiki-style navigation box
    const groupedRoutes = useMemo(() => {
        const groups: Array<{ label: string; list: string[] }> = [
            {label: "연세대·문막 (30번대)", list: []},
            {label: "간선·시내 (1~20번대)", list: []},
            {label: "간선·외곽 (40~50번대)", list: []},
            {label: "지선·순환·기타 (60~90번대·공영)", list: []},
        ];

        for (const no of uniqueRouteNos) {
            if (["30", "31", "32", "34"].some((p) => no.startsWith(p))) {
                groups[0].list.push(no);
            } else if (/^([1-9]|1\d|2\d)(-|$)/.test(no)) {
                groups[1].list.push(no);
            } else if (/^([45]\d)(-|$)/.test(no)) {
                groups[2].list.push(no);
            } else {
                groups[3].list.push(no);
            }
        }

        return groups.filter((g) => g.list.length > 0);
    }, [uniqueRouteNos]);

    return (
        <div className="rounded-lg border-2 border-[#003876]/80 dark:border-blue-500/50 overflow-hidden bg-white dark:bg-[#131722] shadow-xs text-xs">
            {/* Top Banner (Namuwiki Navigation Box Header) */}
            <div className="bg-gradient-to-r from-[#003876] via-blue-800 to-indigo-900 text-white px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                        <Bus className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="truncate">
                        <span className="font-black text-xs sm:text-sm tracking-tight">
                            {shortCity} 대중교통 위키 둘러보기 틀
                        </span>
                        <span className="hidden sm:inline text-[11px] text-blue-200 ml-2">
                            (문서 클릭 시 즉시 이동)
                        </span>
                    </div>
                </div>
                {uniqueRouteNos.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setIsRoutesExpanded((prev) => !prev)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[11px] font-extrabold text-white transition cursor-pointer shrink-0"
                    >
                        <span>전체 노선 ({uniqueRouteNos.length})</span>
                        {isRoutesExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        )}
                    </button>
                )}
            </div>

            {/* Navigation Rows Table */}
            <table className="w-full border-collapse text-left">
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {/* Row 1: Core Documents */}
                    <tr>
                        <th className="w-24 sm:w-28 py-2 px-3 bg-slate-100 dark:bg-[#1a1f2e] font-extrabold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 text-center">
                            핵심 문서
                        </th>
                        <td className="py-2 px-3">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <WikiLink
                                    docId={`city:${cityCode}`}
                                    onNavigate={onNavigate}
                                    className={
                                        activeDocId === `city:${cityCode}`
                                            ? "underline font-black text-slate-900 dark:text-white"
                                            : ""
                                    }
                                >
                                    {shortCity} 시내버스 (대문)
                                </WikiLink>
                                {isWonju && (
                                    <>
                                        <span className="text-slate-300 dark:text-slate-700">·</span>
                                        <WikiLink
                                            docId="yonsei"
                                            onNavigate={onNavigate}
                                            className={
                                                activeDocId === "yonsei"
                                                    ? "underline font-black text-slate-900 dark:text-white"
                                                    : ""
                                            }
                                        >
                                            연세대학교 미래캠퍼스/교통
                                        </WikiLink>
                                        <span className="text-slate-300 dark:text-slate-700">·</span>
                                        <WikiLink
                                            docId="yonsei-shuttle"
                                            onNavigate={onNavigate}
                                            className={
                                                activeDocId === "yonsei-shuttle"
                                                    ? "underline font-black text-slate-900 dark:text-white"
                                                    : ""
                                            }
                                        >
                                            연세대학교 미래캠퍼스/셔틀버스
                                        </WikiLink>
                                        <span className="text-slate-300 dark:text-slate-700">·</span>
                                        <WikiLink
                                            docId="notices"
                                            onNavigate={onNavigate}
                                            className={
                                                activeDocId === "notices" || activeDocId.startsWith("notice:")
                                                    ? "underline font-black text-slate-900 dark:text-white"
                                                    : ""
                                            }
                                        >
                                            원주시 교통정보센터/공지사항
                                        </WikiLink>
                                    </>
                                )}
                            </div>
                        </td>
                    </tr>

                    {/* Row 2: Bookmarked Routes */}
                    {bookmarks.length > 0 && (
                        <tr>
                            <th className="py-2 px-3 bg-amber-50/70 dark:bg-amber-950/25 font-extrabold text-amber-800 dark:text-amber-300 border-r border-slate-200 dark:border-slate-800 text-center">
                                <span className="inline-flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                    즐겨찾기
                                </span>
                            </th>
                            <td className="py-2 px-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {Array.from(
                                        new Set(
                                            bookmarks.map((b) => b.replace(/\(.*\)$/, ""))
                                        )
                                    ).map((routeNo) => {
                                        const docId = `route:${routeNo}`;
                                        const isCurrent = activeDocId === docId;
                                        return (
                                            <WikiLink
                                                key={routeNo}
                                                docId={docId}
                                                onNavigate={onNavigate}
                                                variant="route-pill"
                                                colorClass={
                                                    isCurrent
                                                        ? "bg-amber-500 text-white border-amber-600"
                                                        : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60"
                                                }
                                            >
                                                {routeNo}번
                                            </WikiLink>
                                        );
                                    })}
                                </div>
                            </td>
                        </tr>
                    )}

                    {/* Row 3+: Expandable Route Directory by Series */}
                    {isRoutesExpanded &&
                        groupedRoutes.map((group) => (
                            <tr key={group.label}>
                                <th className="py-2 px-3 bg-slate-50 dark:bg-[#171b26] font-bold text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 text-center">
                                    {group.label}
                                </th>
                                <td className="py-2 px-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {group.list.map((routeNo) => {
                                            const docId = `route:${routeNo}`;
                                            const isCurrent = activeDocId === docId;
                                            return (
                                                <WikiLink
                                                    key={routeNo}
                                                    docId={docId}
                                                    onNavigate={onNavigate}
                                                    variant="route-pill"
                                                    colorClass={
                                                        isCurrent
                                                            ? "bg-blue-600 text-white border-blue-600"
                                                            : undefined
                                                    }
                                                >
                                                    {routeNo}번
                                                </WikiLink>
                                            );
                                        })}
                                    </div>
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
};
