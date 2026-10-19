"use client";

import React, {useMemo, useState} from "react";
import {
    AlertTriangle,
    ArrowRight,
    MapPin,
    RefreshCw,
    Search,
    Star,
    X,
} from "lucide-react";
import {
    type BusRoute,
    type CacheMetadata,
    getNextDeparture,
} from "@entities/schedule";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {useNoticeList} from "@entities/notice/hooks";
import type {CityInfo} from "@entities/city";
import {
    WikiCallout,
    WikiInfobox,
    WikiLink,
    WikiSection,
    WikiToc,
    type WikiTocItem,
} from "../WikiPrimitives";

interface CityWikiArticleProps {
    city: CityInfo;
    routes: BusRoute[];
    allRouteNames: string[];
    meta: CacheMetadata | null;
    isLoading: boolean;
    isRefreshing: boolean;
    error: string | null;
    onRefresh: (force: boolean) => void;
    bookmarks: string[];
    isRouteBookmarked: (route: BusRoute) => boolean;
    onToggleBookmark: (routeId: string) => void;
    onNavigate: (docId: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
    now: Date;
}

const QUICK_CATEGORIES = [
    {id: "ALL", label: "전체"},
    {id: "30", label: "30번대(연세대·문막)"},
    {id: "2", label: "2~20번대"},
    {id: "3", label: "3~4번대"},
    {id: "16", label: "16번대"},
    {id: "41", label: "41번대"},
    {id: "50", label: "50번대(혁신·기업)"},
    {id: "6", label: "6~8·기타"},
];

export const CityWikiArticle: React.FC<CityWikiArticleProps> = ({
    city,
    routes,
    allRouteNames,
    meta,
    isLoading,
    isRefreshing,
    error,
    onRefresh,
    bookmarks: _bookmarks,
    isRouteBookmarked,
    onToggleBookmark,
    onNavigate,
    onSelectMapRoute,
    now,
}) => {
    const isWonju = city.code === "32020";
    const shortCity = city.name.split("/")[0];

    // Live notices for Wonju
    const {data: noticeData, loading: noticeLoading} = useNoticeList(1, "");
    const recentNotices = useMemo(
        () => (isWonju ? (noticeData?.notices ?? []).slice(0, 4) : []),
        [isWonju, noticeData]
    );

    // Filter states for the Route Index Wiki Table
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDayType, setSelectedDayType] = useState("ALL");
    const [selectedCategory, setSelectedCategory] = useState("ALL");
    const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);

    // Bookmarked routes with live upcoming departures
    const bookmarkedRoutes = useMemo(() => {
        if (!routes.length) return [];
        return routes.filter(isRouteBookmarked);
    }, [routes, isRouteBookmarked]);

    // Filtered routes for Section 5
    const filteredRoutes = useMemo(() => {
        if (!routes || routes.length === 0) return [];
        const filtered = routes.filter((route) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesNo =
                    route.routeNo.toLowerCase().includes(q) ||
                    route.rawNo.toLowerCase().includes(q);
                const matchesOrigin = route.origin.toLowerCase().includes(q);
                const matchesDest = route.destination.toLowerCase().includes(q);
                if (!matchesNo && !matchesOrigin && !matchesDest) return false;
            }
            if (selectedDayType !== "ALL" && route.dayType !== selectedDayType) {
                return false;
            }
            if (selectedCategory !== "ALL") {
                if (selectedCategory === "2" && !route.routeNo.startsWith("2")) return false;
                if (
                    selectedCategory === "3" &&
                    !route.routeNo.startsWith("3") &&
                    !route.routeNo.startsWith("4")
                )
                    return false;
                if (
                    selectedCategory === "6" &&
                    !["6", "7", "8"].some((c) => route.routeNo.startsWith(c))
                )
                    return false;
                if (selectedCategory === "16" && !route.routeNo.startsWith("16"))
                    return false;
                if (
                    selectedCategory === "30" &&
                    !["30", "31", "32", "34"].some((c) => route.routeNo.startsWith(c))
                )
                    return false;
                if (selectedCategory === "41" && !route.routeNo.startsWith("41"))
                    return false;
                if (
                    selectedCategory === "50" &&
                    !["50", "51"].some((c) => route.routeNo.startsWith(c))
                )
                    return false;
            }
            if (showOnlyBookmarks && !isRouteBookmarked(route)) {
                return false;
            }
            return true;
        });

        return [...filtered].sort((a, b) => {
            const aBm = isRouteBookmarked(a) ? 1 : 0;
            const bBm = isRouteBookmarked(b) ? 1 : 0;
            if (aBm !== bBm) return bBm - aBm;
            return a.routeNo.localeCompare(b.routeNo, undefined, {numeric: true});
        });
    }, [
        routes,
        searchQuery,
        selectedDayType,
        selectedCategory,
        showOnlyBookmarks,
        isRouteBookmarked,
    ]);

    const tocItems: WikiTocItem[] = useMemo(() => {
        if (isWonju) {
            return [
                {id: "overview", number: "1", title: "개요"},
                {id: "notices", number: "2", title: "실시간 교통 공지사항"},
                {id: "hubs", number: "3", title: "주요 거점 및 대학 교통 문서"},
                {id: "bookmarks", number: "4", title: "즐겨찾기 노선 실시간 다음 출발"},
                {id: "routes", number: "5", title: "전체 운행 노선 색인 및 시간표"},
            ];
        }
        return [
            {id: "overview", number: "1", title: "개요"},
            {id: "routes", number: "2", title: "운행 노선 일람"},
        ];
    }, [isWonju]);

    const uniqueRouteCount = useMemo(() => {
        const s = new Set<string>();
        routes.forEach((r) => s.add(r.routeNo));
        allRouteNames.forEach((r) => s.add(r));
        return s.size;
    }, [routes, allRouteNames]);

    return (
        <div className="space-y-6">
            {/* Top Layout: TOC on Left, Wiki Infobox on Right */}
            <div className="flex flex-col-reverse md:flex-row items-start justify-between gap-4">
                <div className="w-full md:w-auto space-y-3 flex-1">
                    <WikiCallout tone="blue">
                        이 문서는 <strong>{city.name}</strong> 관내를 운행하는 시내버스 노선 체계, 시간표, 경유 정류장 및 실시간 교통 정보를 다루는 통합 대중교통 위키 대문 문서입니다. 각 노선 번호를 클릭하면 해당 노선의 상세 위키 문서로 이동합니다.
                    </WikiCallout>
                    <WikiToc items={tocItems} />
                </div>

                <WikiInfobox
                    badge={city.province}
                    title={`${shortCity} 시내버스`}
                    subtitle={`${city.name} 대중교통 정보 체계`}
                    rows={[
                        {label: "관할 지자체", value: `${city.province} ${city.name}`},
                        {
                            label: "운행 노선 수",
                            value: (
                                <span>
                                    총 <strong>{uniqueRouteCount}개</strong> 노선
                                    {isWonju && routes.length > 0 && (
                                        <span className="text-slate-400 text-[11px] ml-1">
                                            (시간표 {routes.length}개 편성)
                                        </span>
                                    )}
                                </span>
                            ),
                        },
                        ...(isWonju
                            ? [
                                  {
                                      label: "주요 대학 거점",
                                      value: (
                                          <div className="flex flex-wrap gap-1.5">
                                              <WikiLink docId="yonsei" onNavigate={onNavigate}>
                                                  연세대 미래캠퍼스
                                              </WikiLink>
                                              <span>·</span>
                                              <WikiLink
                                                  docId="yonsei-shuttle"
                                                  onNavigate={onNavigate}
                                              >
                                                  무료 셔틀버스
                                              </WikiLink>
                                          </div>
                                      ),
                                  },
                                  {
                                      label: "시간표 기준",
                                      value: (
                                          <div className="flex items-center justify-between gap-2">
                                              <span className="text-[11px]">
                                                  {meta?.updatedAt
                                                      ? new Date(meta.updatedAt).toLocaleDateString(
                                                            "ko-KR"
                                                        )
                                                      : "최신 동기화됨"}
                                              </span>
                                              <button
                                                  type="button"
                                                  onClick={() => onRefresh(true)}
                                                  disabled={isRefreshing}
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-[11px] font-bold text-blue-600 dark:text-blue-400 cursor-pointer disabled:opacity-50"
                                              >
                                                  <RefreshCw
                                                      className={`w-3 h-3 ${
                                                          isRefreshing ? "animate-spin" : ""
                                                      }`}
                                                  />
                                                  <span>갱신</span>
                                              </button>
                                          </div>
                                      ),
                                  },
                              ]
                            : []),
                    ]}
                />
            </div>

            {/* Section 1: 개요 */}
            <WikiSection id="overview" number="1" title="개요">
                <p>
                    <strong>{city.name} 시내버스</strong>는 {city.province} {city.name} 일대를 연결하는 기간 대중교통 수단입니다.
                    {isWonju ? (
                        <>
                            {" "}
                            원주시는 시내 권역(단구·무실·단계·혁신·기업도시)과 외곽 거점(문막읍, 흥업면 매지리{" "}
                            <WikiLink docId="yonsei" onNavigate={onNavigate}>
                                연세대학교 미래캠퍼스
                            </WikiLink>
                            , 귀래, 신림 등)을 잇는 간선·지선 및 대학 통학 노선으로 편성되어 있으며, 평일(학기중)과 방학·토·공휴일 시간표가 이원화되어 운행되는 노선이 많습니다.
                        </>
                    ) : (
                        <>
                            {" "}
                            아래 노선 일람에서 각 노선 문서를 열람하거나 실시간 지도에서 버스 위치 및 정류장 도착 정보를 확인할 수 있습니다.
                        </>
                    )}
                </p>
            </WikiSection>

            {/* Section 2: 실시간 교통 공지사항 (Wonju) */}
            {isWonju && (
                <WikiSection
                    id="notices"
                    number="2"
                    title="실시간 교통 공지사항"
                    rightBadge={
                        <WikiLink docId="notices" onNavigate={onNavigate} variant="badge">
                            전체 공지 문서 보기
                        </WikiLink>
                    }
                >
                    <p>
                        원주시 교통정보센터(ITS)에서 발표하는 시내버스 노선 변경, 도로 통제 우회 운행, 감회 및 방학 시간표 적용 공지입니다. 제목을 클릭하면 상세 공지 위키 문서로 이동합니다.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                    <th className="py-2 px-3 w-18 text-center border-r border-slate-300 dark:border-slate-700">
                                        구분
                                    </th>
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        공지 제목
                                    </th>
                                    <th className="py-2 px-3 w-24 text-center">작성일</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                                {noticeLoading && recentNotices.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-center text-slate-400">
                                            공지사항을 불러오는 중입니다...
                                        </td>
                                    </tr>
                                ) : recentNotices.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-center text-slate-400">
                                            등록된 공지사항이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    recentNotices.map((n) => (
                                        <tr
                                            key={n.id}
                                            className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                        >
                                            <td className="py-2 px-2.5 text-center border-r border-slate-200 dark:border-slate-800">
                                                {n.isNotice ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-black">
                                                        공지
                                                    </span>
                                                ) : (
                                                    <span className="font-mono text-slate-400">
                                                        #{n.num}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800">
                                                <WikiLink
                                                    docId={`notice:${n.id}`}
                                                    onNavigate={onNavigate}
                                                >
                                                    {n.title}
                                                </WikiLink>
                                            </td>
                                            <td className="py-2 px-2.5 text-center font-mono text-slate-500">
                                                {n.date}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </WikiSection>
            )}

            {/* Section 3: 주요 거점 및 대학 교통 문서 (Wonju) */}
            {isWonju && (
                <WikiSection id="hubs" number="3" title="주요 거점 및 대학 교통 문서">
                    <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                    <th className="py-2 px-3 w-44 border-r border-slate-300 dark:border-slate-700">
                                        문서명
                                    </th>
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        주요 내용 및 연계 노선
                                    </th>
                                    <th className="py-2 px-3 w-28 text-center">하위·연계 문서</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                                <tr>
                                    <td className="py-2.5 px-3 font-extrabold border-r border-slate-200 dark:border-slate-800">
                                        <WikiLink docId="yonsei" onNavigate={onNavigate}>
                                            연세대학교 미래캠퍼스/교통
                                        </WikiLink>
                                    </td>
                                    <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                        매지리 캠퍼스 경유 시내버스{" "}
                                        <WikiLink docId="route:30" onNavigate={onNavigate}>
                                            30번
                                        </WikiLink>
                                        ,{" "}
                                        <WikiLink docId="route:34" onNavigate={onNavigate}>
                                            34번
                                        </WikiLink>
                                        ,{" "}
                                        <WikiLink docId="route:34-1" onNavigate={onNavigate}>
                                            34-1번
                                        </WikiLink>{" "}
                                        실시간 다음 출발, 평일/방학 시간대별 비교 시간표 및 철도역·터미널 환승 안내
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                        <WikiLink
                                            docId="yonsei"
                                            onNavigate={onNavigate}
                                            variant="route-pill"
                                        >
                                            문서 열람
                                        </WikiLink>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-2.5 px-3 font-extrabold border-r border-slate-200 dark:border-slate-800">
                                        <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                                            연세대학교 미래캠퍼스/셔틀버스
                                        </WikiLink>
                                    </td>
                                    <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                        여주역 · 만종역 · 원주역 · 원주고속터미널 · 시청사거리 ↔ 미래캠퍼스 무료 통학 셔틀버스 등·하교 시간표 및 정류장 위치 안내
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                        <WikiLink
                                            docId="yonsei-shuttle"
                                            onNavigate={onNavigate}
                                            variant="route-pill"
                                        >
                                            문서 열람
                                        </WikiLink>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-2.5 px-3 font-extrabold border-r border-slate-200 dark:border-slate-800">
                                        <WikiLink docId="notices" onNavigate={onNavigate}>
                                            원주시 교통정보센터/공지사항
                                        </WikiLink>
                                    </td>
                                    <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                        원주시 시내버스 공식 공지사항 전체 아카이브 및 검색
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                        <WikiLink
                                            docId="notices"
                                            onNavigate={onNavigate}
                                            variant="route-pill"
                                        >
                                            문서 열람
                                        </WikiLink>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </WikiSection>
            )}

            {/* Section 4: 즐겨찾기 노선 실시간 다음 출발 (Wonju) */}
            {isWonju && bookmarkedRoutes.length > 0 && (
                <WikiSection
                    id="bookmarks"
                    number="4"
                    title={`즐겨찾기 노선 실시간 다음 출발 (${bookmarkedRoutes.length})`}
                >
                    <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-amber-50/80 dark:bg-amber-950/30 text-slate-800 dark:text-amber-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                    <th className="py-2 px-3 w-24 border-r border-slate-300 dark:border-slate-700">
                                        노선 문서
                                    </th>
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        운행 구간 (요일)
                                    </th>
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        기점 다음 출발
                                    </th>
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        종점 다음 출발
                                    </th>
                                    <th className="py-2 px-3 w-20 text-center">지도</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                                {bookmarkedRoutes.map((route) => {
                                    const {
                                        nextOrigin,
                                        nextDest,
                                        originWaitMins,
                                        destWaitMins,
                                    } = getNextDeparture(route.timetable, now);
                                    return (
                                        <tr
                                            key={route.id}
                                            className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                        >
                                            <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-black">
                                                <WikiLink
                                                    docId={`route:${route.routeNo}`}
                                                    onNavigate={onNavigate}
                                                    variant="route-pill"
                                                >
                                                    {route.routeNo}번
                                                </WikiLink>
                                            </td>
                                            <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                                    {route.origin} ↔ {route.destination}
                                                </span>
                                                <span className="ml-1.5 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-[10px] font-bold text-slate-500">
                                                    {route.dayType}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-mono">
                                                {nextOrigin ? (
                                                    <span>
                                                        <strong className="text-teal-700 dark:text-teal-300">
                                                            {nextOrigin.originDepTime}
                                                        </strong>
                                                        {originWaitMins !== null && (
                                                            <span className="text-[11px] text-slate-500 ml-1 font-sans">
                                                                ({originWaitMins <= 0 ? "곧 출발" : `${originWaitMins}분 후`})
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-sans">운행 종료</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-mono">
                                                {nextDest ? (
                                                    <span>
                                                        <strong className="text-indigo-700 dark:text-indigo-300">
                                                            {nextDest.destDepTime}
                                                        </strong>
                                                        {destWaitMins !== null && (
                                                            <span className="text-[11px] text-slate-500 ml-1 font-sans">
                                                                ({destWaitMins <= 0 ? "곧 출발" : `${destWaitMins}분 후`})
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-sans">운행 종료</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                {onSelectMapRoute && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onSelectMapRoute(route.routeNo)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                                                    >
                                                        <MapPin className="w-3 h-3" />
                                                        <span>지도</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </WikiSection>
            )}

            {/* Section 5 (or 2): 전체 운행 노선 색인 및 시간표 */}
            <WikiSection
                id="routes"
                number={isWonju ? "5" : "2"}
                title={`전체 운행 노선 색인 및 시간표 (${
                    isWonju ? filteredRoutes.length : allRouteNames.length
                })`}
            >
                {isWonju ? (
                    <div className="space-y-3">
                        {/* Filter Controls Box */}
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#161a25] border border-slate-200 dark:border-slate-800 space-y-2.5">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="노선 번호, 기점, 종점 검색 (예: 34, 연세대, 장양리, 문막)"
                                        className="w-full pl-8 pr-8 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    {["ALL", "평일", "방학,휴일", "매일"].map((dt) => (
                                        <button
                                            key={dt}
                                            type="button"
                                            onClick={() => setSelectedDayType(dt)}
                                            className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                                                selectedDayType === dt
                                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                                                    : "bg-white dark:bg-[#12151e] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                            }`}
                                        >
                                            {dt === "ALL" ? "모든 요일" : dt}
                                        </button>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => setShowOnlyBookmarks((prev) => !prev)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                                            showOnlyBookmarks
                                                ? "bg-amber-500 text-white border-amber-500"
                                                : "bg-white dark:bg-[#12151e] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                        }`}
                                    >
                                        <Star
                                            className={`w-3 h-3 ${
                                                showOnlyBookmarks ? "fill-white" : "text-amber-500"
                                            }`}
                                        />
                                        <span>즐겨찾기만</span>
                                    </button>
                                </div>
                            </div>

                            {/* Category Quick Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-800">
                                {QUICK_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                                            selectedCategory === cat.id
                                                ? "bg-blue-600 text-white"
                                                : "bg-slate-200/70 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-300/70"
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 font-bold">
                                    <AlertTriangle className="w-4 h-4" />
                                    {error}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onRefresh(false)}
                                    className="px-2.5 py-1 rounded bg-rose-200 dark:bg-rose-800 font-bold cursor-pointer"
                                >
                                    다시 시도
                                </button>
                            </div>
                        )}

                        {/* Wiki Table of Routes */}
                        <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                        <th className="py-2.5 px-2.5 w-10 text-center border-r border-slate-300 dark:border-slate-700">
                                            ★
                                        </th>
                                        <th className="py-2.5 px-3 w-24 border-r border-slate-300 dark:border-slate-700">
                                            노선 문서
                                        </th>
                                        <th className="py-2.5 px-3 w-24 border-r border-slate-300 dark:border-slate-700">
                                            운행 요일
                                        </th>
                                        <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-700">
                                            기점 ↔ 종점
                                        </th>
                                        <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-700">
                                            첫차 ~ 막차 (배차)
                                        </th>
                                        <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-700">
                                            다음 출발
                                        </th>
                                        <th className="py-2.5 px-2.5 w-20 text-center">실시간 지도</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                                    {isLoading && filteredRoutes.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="py-8 text-center text-slate-400"
                                            >
                                                시간표 데이터를 불러오는 중입니다...
                                            </td>
                                        </tr>
                                    ) : filteredRoutes.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="py-8 text-center text-slate-400"
                                            >
                                                조건에 일치하는 노선 문서가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRoutes.map((route) => {
                                            const bookmarked = isRouteBookmarked(route);
                                            const {soonest} = getNextDeparture(
                                                route.timetable,
                                                now
                                            );
                                            return (
                                                <tr
                                                    key={route.id}
                                                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                                >
                                                    <td className="py-2 px-2 text-center border-r border-slate-200 dark:border-slate-800">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onToggleBookmark(route.id)
                                                            }
                                                            className="p-1 text-slate-400 hover:text-amber-500 cursor-pointer"
                                                            title="즐겨찾기 토글"
                                                        >
                                                            <Star
                                                                className={`w-3.5 h-3.5 ${
                                                                    bookmarked
                                                                        ? "fill-amber-400 text-amber-500"
                                                                        : ""
                                                                }`}
                                                            />
                                                        </button>
                                                    </td>
                                                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-black">
                                                        <WikiLink
                                                            docId={`route:${route.routeNo}`}
                                                            onNavigate={onNavigate}
                                                            variant="route-pill"
                                                        >
                                                            {route.routeNo}번
                                                        </WikiLink>
                                                    </td>
                                                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800">
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                            {route.dayType}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onNavigate(
                                                                    `route:${route.routeNo}`
                                                                )
                                                            }
                                                            className="hover:underline text-left cursor-pointer inline-flex items-center gap-1"
                                                        >
                                                            <span>{route.origin}</span>
                                                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span>{route.destination}</span>
                                                        </button>
                                                    </td>
                                                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-mono text-slate-600 dark:text-slate-400">
                                                        {route.firstBus} ~ {route.lastBus}{" "}
                                                        <span className="font-sans text-[11px]">
                                                            ({route.runCount}회 · {route.interval})
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-mono">
                                                        {soonest ? (
                                                            <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                                                                {soonest.time}{" "}
                                                                <span className="font-sans text-[10px] font-bold">
                                                                    (
                                                                    {soonest.type === "origin"
                                                                        ? "기점"
                                                                        : "종점"}{" "}
                                                                    ·{" "}
                                                                    {soonest.waitMins <= 0
                                                                        ? "곧 출발"
                                                                        : `${soonest.waitMins}분 후`}
                                                                    )
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 font-sans">
                                                                운행 종료
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2 text-center">
                                                        {onSelectMapRoute && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    onSelectMapRoute(route.routeNo)
                                                                }
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                                                            >
                                                                <MapPin className="w-3 h-3" />
                                                                <span>지도</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Non-Wonju City Route Directory (Seoul & Nationwide) */
                    <div className="space-y-3">
                        <p>
                            {city.name} 관내에서 운행 중인 시내버스 노선 목록입니다. 노선 번호를 클릭하면 경유 정류장 및 노선 상세 위키 문서로 이동합니다.
                        </p>

                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`${shortCity} 버스 번호, 기점, 종점 검색`}
                                className="w-full pl-8 pr-8 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="max-h-112 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-700 custom-scrollbar">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                    <tr>
                                        <th className="py-2 px-3 w-28 border-r border-slate-300 dark:border-slate-700">
                                            노선 문서
                                        </th>
                                        <th className="py-2 px-3 w-24 border-r border-slate-300 dark:border-slate-700">
                                            유형
                                        </th>
                                        <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                            기점 ↔ 종점
                                        </th>
                                        <th className="py-2 px-2.5 w-20 text-center">실시간 지도</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                                    {allRouteNames.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-6 text-center text-slate-400">
                                                노선 목록을 불러오는 중입니다...
                                            </td>
                                        </tr>
                                    ) : (
                                        allRouteNames
                                            .filter((rName) => {
                                                if (!searchQuery.trim()) return true;
                                                const q = searchQuery.toLowerCase().trim();
                                                const rMeta = getRouteMeta(rName, city.code);
                                                return (
                                                    rName.toLowerCase().includes(q) ||
                                                    rMeta.origin.toLowerCase().includes(q) ||
                                                    rMeta.destination.toLowerCase().includes(q) ||
                                                    (rMeta.routeType || "").toLowerCase().includes(q)
                                                );
                                            })
                                            .map((rName) => {
                                                const rMeta = getRouteMeta(rName, city.code);
                                                return (
                                                    <tr
                                                        key={rName}
                                                        className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                                    >
                                                        <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-black">
                                                            <WikiLink
                                                                docId={`route:${rName}`}
                                                                onNavigate={onNavigate}
                                                                variant="route-pill"
                                                            >
                                                                {rName}번
                                                            </WikiLink>
                                                        </td>
                                                        <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800">
                                                            <span
                                                                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${rMeta.colorTheme.badgeBg} ${rMeta.colorTheme.text}`}
                                                            >
                                                                {rMeta.routeType || "시내"}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-100">
                                                            <button
                                                                type="button"
                                                                onClick={() => onNavigate(`route:${rName}`)}
                                                                className="hover:underline text-left cursor-pointer inline-flex items-center gap-1"
                                                            >
                                                                <span>{rMeta.origin}</span>
                                                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                                                <span>{rMeta.destination}</span>
                                                            </button>
                                                        </td>
                                                        <td className="py-2 px-2 text-center">
                                                            {onSelectMapRoute && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onSelectMapRoute(rName)}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                                                                >
                                                                    <MapPin className="w-3 h-3" />
                                                                    <span>지도</span>
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </WikiSection>
        </div>
    );
};
