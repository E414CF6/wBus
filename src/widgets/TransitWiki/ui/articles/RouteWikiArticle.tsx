"use client";

import React, {useCallback, useMemo, useRef, useState} from "react";
import {
    LocateFixed,
    MapPin,
    Search,
    Star,
    X,
} from "lucide-react";
import {type BusRoute, getNextDeparture} from "@entities/schedule";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {useBusStop} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";
import type {CityInfo} from "@entities/city";
import {
    DualHourlyTimetableBlock,
    WikiCallout,
    WikiFoldBox,
    WikiInfobox,
    WikiLink,
    WikiSection,
    WikiToc,
    type WikiTocItem,
} from "../WikiPrimitives";

interface RouteWikiArticleProps {
    routeNo: string;
    city: CityInfo;
    routes: BusRoute[];
    isRouteBookmarked: (route: BusRoute) => boolean;
    onToggleBookmark: (routeId: string) => void;
    onNavigate: (docId: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
    onFocusStopOnMap?: (stop: BusStop, routeName: string) => void;
    now: Date;
}

export const RouteWikiArticle: React.FC<RouteWikiArticleProps> = ({
    routeNo,
    city,
    routes,
    isRouteBookmarked,
    onToggleBookmark,
    onNavigate,
    onSelectMapRoute,
    onFocusStopOnMap,
    now,
}) => {
    const shortCity = city.name.split("/")[0];
    const routeMeta = useMemo(
        () => getRouteMeta(routeNo, city.code),
        [routeNo, city.code]
    );

    // Matching schedule variants for this routeNo (e.g. 평일, 방학·휴일, 토요일 등)
    const variants = useMemo(
        () => routes.filter((r) => r.routeNo === routeNo),
        [routes, routeNo]
    );

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const activeVariant: BusRoute | null = useMemo(() => {
        if (variants.length === 0) return null;
        if (selectedVariantId) {
            const found = variants.find((v) => v.id === selectedVariantId);
            if (found) return found;
        }
        return variants[0];
    }, [variants, selectedVariantId]);

    const [tableSearch, setTableSearch] = useState("");
    const tableRef = useRef<HTMLDivElement>(null);

    // Fetch route stops
    const routeStops = useBusStop(routeNo, city.code);

    const nextDepInfo = useMemo(() => {
        if (!activeVariant) return null;
        return getNextDeparture(activeVariant.timetable, now);
    }, [activeVariant, now]);

    const filteredTimetable = useMemo(() => {
        if (!activeVariant) return [];
        if (!tableSearch.trim()) return activeVariant.timetable;
        const q = tableSearch.toLowerCase().trim();
        return activeVariant.timetable.filter(
            (item) =>
                item.originDepTime.toLowerCase().includes(q) ||
                item.destDepTime.toLowerCase().includes(q) ||
                item.type.toLowerCase().includes(q) ||
                item.notes.toLowerCase().includes(q)
        );
    }, [activeVariant, tableSearch]);

    const scrollToNextRow = useCallback(() => {
        if (!tableRef.current) return;
        const target = tableRef.current.querySelector<HTMLElement>(
            '[data-next-departure="true"]'
        );
        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({behavior: "smooth", block: "center"});
        }
    }, []);

    const isBookmarked = activeVariant ? isRouteBookmarked(activeVariant) : false;
    const originName = activeVariant?.origin || routeMeta.origin || shortCity;
    const destName = activeVariant?.destination || routeMeta.destination || "종점";
    const typeLabel =
        routeMeta.genericType === "EXPRESS"
            ? "급행버스"
            : routeMeta.genericType === "BRANCH"
                ? "지선·공영버스"
                : "간선버스";

    const tocItems: WikiTocItem[] = useMemo(() => {
        if (activeVariant) {
            return [
                {id: "overview", number: "1", title: "개요"},
                {id: "hourly", number: "2", title: "시간대별 요약 시간표"},
                {id: "full-timetable", number: "3", title: "회차별 전체 상세 시간표"},
                {id: "stops", number: "4", title: `경유 정류장 일람 (${routeStops.length})`},
            ];
        }
        return [
            {id: "overview", number: "1", title: "개요"},
            {id: "stops", number: "2", title: `경유 정류장 일람 (${routeStops.length})`},
        ];
    }, [activeVariant, routeStops.length]);

    return (
        <div className="space-y-6">
            {/* Top Layout: Callout + TOC on Left, Route Infobox on Right */}
            <div className="flex flex-col-reverse md:flex-row items-start justify-between gap-4">
                <div className="w-full md:w-auto space-y-3 flex-1">
                    <WikiCallout tone="blue">
                        이 문서는{" "}
                        <WikiLink docId={`city:${city.code}`} onNavigate={onNavigate}>
                            {shortCity} 시내버스
                        </WikiLink>{" "}
                        <strong>{routeNo}번</strong> 노선({originName} ↔ {destName})의 운행 정보, 시간표 및 경유 정류장을 다루는 노선 위키 문서입니다.
                        {routeMeta.isYonsei && (
                            <>
                                {" "}
                                캠퍼스 환승 및 통합 시간표는{" "}
                                <WikiLink docId="yonsei" onNavigate={onNavigate}>
                                    연세대학교 미래캠퍼스/교통
                                </WikiLink>{" "}
                                문서에서도 함께 확인할 수 있습니다.
                            </>
                        )}
                    </WikiCallout>
                    <WikiToc items={tocItems} />
                </div>

                <WikiInfobox
                    badge={`${shortCity} ${typeLabel}`}
                    title={`${shortCity} 버스 ${routeNo}`}
                    subtitle={`${originName} ↔ ${destName}`}
                    headerStyle={{backgroundColor: routeMeta.colorTheme.main}}
                    headerClassName="text-white"
                    rows={[
                        {
                            label: "기점 ↔ 종점",
                            value: (
                                <strong>
                                    {originName} ↔ {destName}
                                </strong>
                            ),
                        },
                        {
                            label: "노선 등급",
                            value: typeLabel,
                        },
                        ...(activeVariant
                            ? [
                                  {
                                      label: "운행 요일",
                                      value: (
                                          <div className="flex flex-wrap gap-1">
                                              {variants.map((v) => (
                                                  <button
                                                      key={v.id}
                                                      type="button"
                                                      onClick={() =>
                                                          setSelectedVariantId(v.id)
                                                      }
                                                      className={`px-2 py-0.5 rounded text-[11px] font-extrabold border transition cursor-pointer ${
                                                          activeVariant.id === v.id
                                                              ? "bg-blue-600 text-white border-blue-600"
                                                              : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                                      }`}
                                                  >
                                                      {v.dayType}
                                                  </button>
                                              ))}
                                          </div>
                                      ),
                                  },
                                  {
                                      label: "첫차 · 막차",
                                      value: (
                                          <span className="font-mono font-bold">
                                              {activeVariant.firstBus} ~{" "}
                                              {activeVariant.lastBus}
                                          </span>
                                      ),
                                  },
                                  {
                                      label: "운행 횟수",
                                      value: `${activeVariant.runCount}회 (배차간격 ${activeVariant.interval})`,
                                  },
                              ]
                            : []),
                    ]}
                    footer={
                        <div className="flex items-center justify-between gap-2">
                            {activeVariant && (
                                <button
                                    type="button"
                                    onClick={() => onToggleBookmark(activeVariant.id)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-extrabold border transition cursor-pointer ${
                                        isBookmarked
                                            ? "bg-amber-500 text-white border-amber-500"
                                            : "bg-white dark:bg-[#12151e] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                                    }`}
                                >
                                    <Star
                                        className={`w-3.5 h-3.5 ${
                                            isBookmarked ? "fill-white" : "text-amber-500"
                                        }`}
                                    />
                                    <span>{isBookmarked ? "즐겨찾기됨" : "즐겨찾기"}</span>
                                </button>
                            )}
                            {onSelectMapRoute && (
                                <button
                                    type="button"
                                    onClick={() => onSelectMapRoute(routeNo)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold transition cursor-pointer"
                                >
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span>실시간 지도에서 노선·버스 보기</span>
                                </button>
                            )}
                        </div>
                    }
                />
            </div>

            {/* Section 1: 개요 */}
            <WikiSection id="overview" number="1" title="개요">
                <p>
                    <strong>
                        {shortCity} 시내버스 {routeNo}번
                    </strong>
                    은 <strong>{originName}</strong>을(를) 기점으로 하여{" "}
                    <strong>{destName}</strong>까지 운행하는 {typeLabel} 노선입니다.
                </p>

                {activeVariant && nextDepInfo && (
                    <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700 mt-2">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                    <th className="py-2 px-3 w-28 border-r border-slate-300 dark:border-slate-700">
                                        현재 기준 요일
                                    </th>
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        기점 ({originName}) 다음 출발
                                    </th>
                                    <th className="py-2 px-3">
                                        종점 ({destName}) 다음 출발
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-[#12151e]">
                                <tr>
                                    <td className="py-2.5 px-3 font-extrabold border-r border-slate-200 dark:border-slate-800">
                                        {activeVariant.dayType}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono border-r border-slate-200 dark:border-slate-800">
                                        {nextDepInfo.nextOrigin ? (
                                            <span className="text-teal-700 dark:text-teal-300 font-black">
                                                {nextDepInfo.nextOrigin.originDepTime}{" "}
                                                {nextDepInfo.originWaitMins !== null && (
                                                    <span className="font-sans text-[11px] font-bold">
                                                        (
                                                        {nextDepInfo.originWaitMins <= 0
                                                            ? "곧 출발"
                                                            : `${nextDepInfo.originWaitMins}분 후`}
                                                        )
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 font-sans">
                                                금일 운행 종료
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono">
                                        {nextDepInfo.nextDest ? (
                                            <span className="text-indigo-700 dark:text-indigo-300 font-black">
                                                {nextDepInfo.nextDest.destDepTime}{" "}
                                                {nextDepInfo.destWaitMins !== null && (
                                                    <span className="font-sans text-[11px] font-bold">
                                                        (
                                                        {nextDepInfo.destWaitMins <= 0
                                                            ? "곧 출발"
                                                            : `${nextDepInfo.destWaitMins}분 후`}
                                                        )
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 font-sans">
                                                금일 운행 종료
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </WikiSection>

            {/* Section 2: 시간대별 요약 시간표 */}
            {activeVariant && (
                <WikiSection
                    id="hourly"
                    number="2"
                    title={`시간대별 요약 시간표 (${destName} 출발 기준)`}
                >
                    <DualHourlyTimetableBlock
                        route={activeVariant}
                        allRoutes={routes}
                        now={now}
                        locationLabel={`${destName} 종점`}
                    />
                </WikiSection>
            )}

            {/* Section 3: 회차별 전체 상세 시간표 */}
            {activeVariant && (
                <WikiSection
                    id="full-timetable"
                    number="3"
                    title={`회차별 전체 상세 시간표 (${activeVariant.dayType})`}
                    rightBadge={
                        nextDepInfo && (nextDepInfo.nextOrigin || nextDepInfo.nextDest) ? (
                            <button
                                type="button"
                                onClick={scrollToNextRow}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px] font-extrabold border border-blue-200 dark:border-blue-800 cursor-pointer"
                            >
                                <LocateFixed className="w-3 h-3" />
                                <span>다음 출발 행으로</span>
                            </button>
                        ) : undefined
                    }
                >
                    {/* Variant Switcher + Search Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#161a25] border border-slate-200 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 mr-1">
                                요일 편성:
                            </span>
                            {variants.map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setSelectedVariantId(v.id)}
                                    className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                                        activeVariant.id === v.id
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white dark:bg-[#12151e] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                    }`}
                                >
                                    {v.dayType} ({v.timetable.length}회)
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full sm:w-56">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                placeholder="시각·비고 검색"
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

                    {/* Full Sequence Timetable Table */}
                    <div
                        ref={tableRef}
                        className="max-h-112 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-700 custom-scrollbar"
                    >
                        <table className="w-full border-collapse text-left text-xs">
                            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                <tr>
                                    <th className="py-2 px-3 w-14 text-center border-r border-slate-300 dark:border-slate-700">
                                        회차
                                    </th>
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        기점 출발 ({originName})
                                    </th>
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        종점 출발 ({destName})
                                    </th>
                                    <th className="py-2 px-3">비고 / 경유</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                                {filteredTimetable.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="py-6 text-center text-slate-400"
                                        >
                                            일치하는 운행 회차가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTimetable.map((row) => {
                                        const isNextOrigin =
                                            nextDepInfo?.nextOrigin?.seq === row.seq;
                                        const isNextDest =
                                            nextDepInfo?.nextDest?.seq === row.seq;

                                        return (
                                            <tr
                                                key={row.seq}
                                                data-next-departure={
                                                    isNextOrigin || isNextDest
                                                        ? "true"
                                                        : undefined
                                                }
                                                className={
                                                    isNextOrigin || isNextDest
                                                        ? "bg-blue-50/70 dark:bg-blue-950/30 font-bold"
                                                        : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                                }
                                            >
                                                <td className="py-2 px-2.5 text-center font-mono text-slate-400 border-r border-slate-200 dark:border-slate-800">
                                                    {row.seq}
                                                </td>
                                                <td className="py-2 px-3 font-mono border-r border-slate-200 dark:border-slate-800">
                                                    <span
                                                        className={
                                                            isNextOrigin
                                                                ? "px-2 py-0.5 rounded bg-teal-600 text-white font-black"
                                                                : "font-bold text-slate-900 dark:text-slate-100"
                                                        }
                                                    >
                                                        {row.originDepTime}
                                                    </span>
                                                    {isNextOrigin && (
                                                        <span className="ml-1.5 text-[10px] font-sans font-extrabold text-teal-600 dark:text-teal-400">
                                                            다음 기점 출발
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 font-mono border-r border-slate-200 dark:border-slate-800">
                                                    <span
                                                        className={
                                                            isNextDest
                                                                ? "px-2 py-0.5 rounded bg-indigo-600 text-white font-black"
                                                                : "font-bold text-slate-900 dark:text-slate-100"
                                                        }
                                                    >
                                                        {row.destDepTime}
                                                    </span>
                                                    {isNextDest && (
                                                        <span className="ml-1.5 text-[10px] font-sans font-extrabold text-indigo-600 dark:text-indigo-400">
                                                            다음 종점 출발
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                                    {row.notes || "-"}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </WikiSection>
            )}

            {/* Section 4 (or 2): 경유 정류장 일람 */}
            <WikiSection
                id="stops"
                number={activeVariant ? "4" : "2"}
                title={`경유 정류장 일람 (${routeStops.length}개 정류소)`}
            >
                <p>
                    정류장 이름을 클릭하면 실시간 지도의 해당 정류장 위치로 이동하여 실시간 버스 도착 예정 시각을 확인할 수 있습니다.
                </p>

                <WikiFoldBox
                    title={`${routeNo}번 전체 경유 정류장 목록`}
                    subtitle={`총 ${routeStops.length}개 정류소`}
                    defaultOpen={!activeVariant}
                >
                    {routeStops.length === 0 ? (
                        <div className="py-4 text-center text-slate-400 text-xs">
                            경유 정류장 데이터를 불러오는 중이거나 정보가 없습니다.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                            {routeStops.map((stop, idx) => (
                                <button
                                    key={`${stop.nodeid}-${idx}`}
                                    type="button"
                                    onClick={() => onFocusStopOnMap?.(stop, routeNo)}
                                    className="flex items-center justify-between gap-2 p-2 rounded border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50/70 dark:bg-white/[0.02] text-left transition cursor-pointer group"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                                            {stop.nodenm}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                        {stop.nodeno || ""}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </WikiFoldBox>
            </WikiSection>
        </div>
    );
};
