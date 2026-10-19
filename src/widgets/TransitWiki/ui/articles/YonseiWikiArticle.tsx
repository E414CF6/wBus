"use client";

import React, {useMemo} from "react";
import {GraduationCap, MapPin, Train} from "lucide-react";
import {
    type BusRoute,
    getUpcomingDepartures,
    selectRouteVariant,
    YONSEI_SHUTTLE_SCHEDULE,
} from "@entities/schedule";
import {TARGET_ROUTE_NUMBERS} from "@entities/route";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import type {DayMode} from "@shared/types/navigation";
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

interface YonseiWikiArticleProps {
    routes: BusRoute[];
    dayMode: DayMode;
    onDayModeChange: (mode: DayMode) => void;
    isTodayWeekendOrHoliday: boolean;
    onNavigate: (docId: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
    now: Date;
}

const TOC_ITEMS: WikiTocItem[] = [
    {id: "overview", number: "1", title: "개요"},
    {id: "live-board", number: "2", title: "실시간 다음 출발 전광판 (시내버스 · 셔틀)"},
    {id: "city-buses", number: "3", title: "경유 시내버스 노선별 상세 및 시간표"},
    {id: "route-30", number: "3.1", title: "원주시 시내버스 30번", indent: 1},
    {id: "route-34", number: "3.2", title: "원주시 시내버스 34번", indent: 1},
    {id: "route-34-1", number: "3.3", title: "원주시 시내버스 34-1번", indent: 1},
    {id: "shuttle", number: "4", title: "교내 무료 통학 셔틀버스"},
    {id: "transfer", number: "5", title: "기차역 · 터미널 연계 환승 가이드"},
];

export const YonseiWikiArticle: React.FC<YonseiWikiArticleProps> = ({
    routes,
    dayMode,
    onDayModeChange,
    isTodayWeekendOrHoliday,
    onNavigate,
    onSelectMapRoute,
    now,
}) => {
    const effectiveIsHoliday = useMemo(() => {
        if (dayMode === "WEEKDAY") return false;
        if (dayMode === "VACATION") return true;
        return isTodayWeekendOrHoliday;
    }, [dayMode, isTodayWeekendOrHoliday]);

    const activeRoutes = useMemo(() => {
        const list: BusRoute[] = [];
        for (const rNo of TARGET_ROUTE_NUMBERS) {
            const route = selectRouteVariant(routes, rNo, effectiveIsHoliday);
            if (route) list.push(route);
        }
        return list;
    }, [routes, effectiveIsHoliday]);

    // Next upcoming shuttle (inbound & outbound)
    const nextShuttles = useMemo(() => {
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const isSunday = now.getDay() === 0;

        const nextIn = YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus
            .filter((item) => isSunday === item.operation_type.includes("일요일"))
            .slice()
            .sort(
                (a, b) =>
                    (parseTimeToMinutes(a.departure_time) ?? 0) -
                    (parseTimeToMinutes(b.departure_time) ?? 0)
            )
            .find((item) => {
                const m = parseTimeToMinutes(item.departure_time);
                return m !== null && m >= currentMins;
            });

        const nextOut = YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus
            .filter((item) => isSunday === item.operation_type.includes("일요일"))
            .slice()
            .sort(
                (a, b) =>
                    (parseTimeToMinutes(a.departure_time) ?? 0) -
                    (parseTimeToMinutes(b.departure_time) ?? 0)
            )
            .find((item) => {
                const m = parseTimeToMinutes(item.departure_time);
                return m !== null && m >= currentMins;
            });

        return {nextIn, nextOut};
    }, [now]);

    return (
        <div className="space-y-6">
            {/* Top Layout: Callout + TOC on Left, Infobox on Right */}
            <div className="flex flex-col-reverse md:flex-row items-start justify-between gap-4">
                <div className="w-full md:w-auto space-y-3 flex-1">
                    <WikiCallout tone="blue">
                        이 문서는 강원특별자치도 원주시 흥업면 매지리에 위치한{" "}
                        <strong>연세대학교 미래캠퍼스</strong>의 대중교통(시내버스{" "}
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
                        및{" "}
                        <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                            교내 무료 셔틀버스
                        </WikiLink>
                        ) 이용 방법과 시간표를 종합 정리한 위키 문서입니다.
                    </WikiCallout>
                    <WikiToc items={TOC_ITEMS} />
                </div>

                <WikiInfobox
                    badge="UNIVERSITY TRANSIT WIKI"
                    title="연세대학교 미래캠퍼스/교통"
                    subtitle="강원특별자치도 원주시 흥업면 연세대길 1"
                    headerClassName="bg-[#003876] text-white"
                    rows={[
                        {
                            label: "핵심 시내버스",
                            value: (
                                <div className="flex flex-wrap gap-1.5">
                                    <WikiLink
                                        docId="route:30"
                                        onNavigate={onNavigate}
                                        variant="route-pill"
                                    >
                                        30번
                                    </WikiLink>
                                    <WikiLink
                                        docId="route:34"
                                        onNavigate={onNavigate}
                                        variant="route-pill"
                                    >
                                        34번
                                    </WikiLink>
                                    <WikiLink
                                        docId="route:34-1"
                                        onNavigate={onNavigate}
                                        variant="route-pill"
                                    >
                                        34-1번
                                    </WikiLink>
                                </div>
                            ),
                        },
                        {
                            label: "교내 셔틀버스",
                            value: (
                                <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                                    연세대학교 미래캠퍼스/셔틀버스 (무료)
                                </WikiLink>
                            ),
                        },
                        {
                            label: "주요 철도 연계",
                            value: "원주역(중앙선 KTX), 만종역(강릉선 KTX), 여주역(경강선)",
                        },
                        {
                            label: "시간표 기준",
                            value: (
                                <div className="flex flex-wrap gap-1">
                                    {(
                                        [
                                            {id: "AUTO", label: "자동"},
                                            {id: "WEEKDAY", label: "평일(학기)"},
                                            {id: "VACATION", label: "방학·휴일"},
                                        ] as const
                                    ).map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => onDayModeChange(m.id)}
                                            className={`px-2 py-0.5 rounded text-[11px] font-extrabold border transition cursor-pointer ${
                                                dayMode === m.id
                                                    ? "bg-[#003876] text-white border-[#003876]"
                                                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                            }`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            {/* Section 1: 개요 */}
            <WikiSection id="overview" number="1" title="개요">
                <p>
                    연세대학교 미래캠퍼스는 원주시 남서부 흥업면 매지리에 자리하고 있어 원주 시내(원주역, 시외·고속버스터미널, 무실동, 단구동)와 캠퍼스를 직결하는{" "}
                    <strong>3개 핵심 시내버스 노선(30, 34, 34-1번)</strong>과 학교에서 직접 운행하는{" "}
                    <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                        무료 통학 셔틀버스
                    </WikiLink>
                    가 학생 및 교직원의 핵심 이동 수단 역할을 수행합니다.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>
                        <WikiLink docId="route:30" onNavigate={onNavigate}>
                            30번
                        </WikiLink>
                        과{" "}
                        <WikiLink docId="route:34" onNavigate={onNavigate}>
                            34번
                        </WikiLink>
                        은 캠퍼스 정문을 통과해 교내 안쪽(미래관·스포츠센터 인근{" "}
                        <strong>연세대 종점</strong>)까지 진입합니다.
                    </li>
                    <li>
                        <WikiLink docId="route:34-1" onNavigate={onNavigate}>
                            34-1번
                        </WikiLink>
                        은 교내로 진입하지 않고 매지리 하숙촌(청솔아파트·매지리 정류장)을 경유하여{" "}
                        <strong>회촌</strong> 종점까지 운행합니다.
                    </li>
                </ul>
            </WikiSection>

            {/* Section 2: 실시간 다음 출발 전광판 */}
            <WikiSection
                id="live-board"
                number="2"
                title="실시간 다음 출발 전광판 (시내버스 · 셔틀)"
                rightBadge={
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[11px] font-extrabold border border-blue-200 dark:border-blue-800">
                        현재 적용 기준: {effectiveIsHoliday ? "방학·토·공휴일" : "평일(학기중)"}
                    </span>
                }
            >
                <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                <th className="py-2 px-3 w-28 border-r border-slate-300 dark:border-slate-700">
                                    구분 / 노선
                                </th>
                                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                    하교 · 시내행 (캠퍼스/회촌 출발)
                                </th>
                                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                    등교 · 캠퍼스행 (장양리/역 출발)
                                </th>
                                <th className="py-2 px-3 w-28 text-center">상세 / 지도</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                            {activeRoutes.map((route) => {
                                const destDep = getUpcomingDepartures(
                                    route.timetable,
                                    "DEST",
                                    now
                                );
                                const originDep = getUpcomingDepartures(
                                    route.timetable,
                                    "ORIGIN",
                                    now
                                );
                                return (
                                    <tr
                                        key={route.id}
                                        className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                    >
                                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center gap-1.5">
                                                <WikiLink
                                                    docId={`route:${route.routeNo}`}
                                                    onNavigate={onNavigate}
                                                    variant="route-pill"
                                                >
                                                    {route.routeNo}번
                                                </WikiLink>
                                                <span className="text-[10px] text-slate-400 font-bold">
                                                    {route.dayType}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-mono">
                                            {destDep.nextDeparture ? (
                                                <div>
                                                    <strong className="text-sm text-blue-700 dark:text-blue-300 font-black">
                                                        {destDep.nextDeparture.timeStr}
                                                    </strong>
                                                    <span className="ml-1.5 px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-sans text-[11px] font-bold">
                                                        {destDep.nextDeparture.waitMins <= 0
                                                            ? "곧 출발"
                                                            : `${destDep.nextDeparture.waitMins}분 후`}
                                                    </span>
                                                    {destDep.nextDeparture.entry.notes && (
                                                        <span className="block font-sans text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                                                            ※ {destDep.nextDeparture.entry.notes}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-sans">
                                                    금일 운행 종료
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-mono">
                                            {originDep.nextDeparture ? (
                                                <div>
                                                    <strong className="text-sm text-teal-700 dark:text-teal-300 font-black">
                                                        {originDep.nextDeparture.timeStr}
                                                    </strong>
                                                    <span className="ml-1.5 px-1.5 py-0.2 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-sans text-[11px] font-bold">
                                                        {originDep.nextDeparture.waitMins <= 0
                                                            ? "곧 출발"
                                                            : `${originDep.nextDeparture.waitMins}분 후`}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-sans">
                                                    금일 운행 종료
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <WikiLink
                                                    docId={`route:${route.routeNo}`}
                                                    onNavigate={onNavigate}
                                                    variant="badge"
                                                >
                                                    문서
                                                </WikiLink>
                                                {onSelectMapRoute && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onSelectMapRoute(route.routeNo)
                                                        }
                                                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                                                    >
                                                        <MapPin className="w-3 h-3" />
                                                        <span>지도</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Free Shuttle Row */}
                            <tr className="bg-teal-50/30 dark:bg-teal-950/15 hover:bg-teal-50/60">
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                    <WikiLink
                                        docId="yonsei-shuttle"
                                        onNavigate={onNavigate}
                                        variant="route-pill"
                                        colorClass="bg-teal-600 text-white border-teal-600"
                                    >
                                        무료 셔틀
                                    </WikiLink>
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-mono">
                                    {nextShuttles.nextOut ? (
                                        <div>
                                            <strong className="text-sm text-teal-700 dark:text-teal-300 font-black">
                                                {nextShuttles.nextOut.departure_time}
                                            </strong>
                                            <span className="font-sans text-[11px] text-slate-600 dark:text-slate-300 ml-1.5">
                                                ({nextShuttles.nextOut.destination}행)
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 font-sans">운행 종료</span>
                                    )}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 font-mono">
                                    {nextShuttles.nextIn ? (
                                        <div>
                                            <strong className="text-sm text-teal-700 dark:text-teal-300 font-black">
                                                {nextShuttles.nextIn.departure_time}
                                            </strong>
                                            <span className="font-sans text-[11px] text-slate-600 dark:text-slate-300 ml-1.5">
                                                ({nextShuttles.nextIn.departure_point}발)
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 font-sans">운행 종료</span>
                                    )}
                                </td>
                                <td className="py-2.5 px-2.5 text-center">
                                    <WikiLink
                                        docId="yonsei-shuttle"
                                        onNavigate={onNavigate}
                                        variant="badge"
                                    >
                                        셔틀 문서
                                    </WikiLink>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </WikiSection>

            {/* Section 3: 경유 시내버스 노선별 상세 및 시간표 */}
            <WikiSection
                id="city-buses"
                number="3"
                title="경유 시내버스 노선별 상세 및 시간표"
            >
                <p>
                    각 노선의 시간대별 통합 시간표는 아래의{" "}
                    <strong>[ 펼치기 · 접기 ]</strong> 틀을 클릭하여 본 문서 내에서 바로 열람하거나, 개별 노선 위키 문서(
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
                    </WikiLink>
                    )로 이동해 전체 회차 및 정류장 목록을 확인할 수 있습니다.
                </p>

                {activeRoutes.map((route, idx) => {
                    const secNum = `3.${idx + 1}`;
                    const secId = `route-${route.routeNo}`;
                    const isHoechon = route.routeNo === "34-1";
                    const locationLabel = isHoechon ? "회촌 종점" : "연세대 종점";

                    return (
                        <WikiSection
                            key={route.id}
                            id={secId}
                            number={secNum}
                            level={3}
                            title={
                                <span className="inline-flex items-center gap-2">
                                    <WikiLink
                                        docId={`route:${route.routeNo}`}
                                        onNavigate={onNavigate}
                                    >
                                        원주시 시내버스/{route.routeNo}번
                                    </WikiLink>
                                    <span className="text-xs font-normal text-slate-500">
                                        ({route.origin} ↔ {route.destination})
                                    </span>
                                </span>
                            }
                            rightBadge={
                                <div className="flex items-center gap-1.5">
                                    <WikiLink
                                        docId={`route:${route.routeNo}`}
                                        onNavigate={onNavigate}
                                        variant="badge"
                                    >
                                        개별 문서
                                    </WikiLink>
                                    {onSelectMapRoute && (
                                        <button
                                            type="button"
                                            onClick={() => onSelectMapRoute(route.routeNo)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                                        >
                                            <MapPin className="w-3 h-3" />
                                            <span>실시간 지도</span>
                                        </button>
                                    )}
                                </div>
                            }
                        >
                            <p>
                                <strong>{route.routeNo}번</strong> 노선은{" "}
                                <strong>{route.origin}</strong>에서 출발하여 원주 시내 주요 지점을 경유한 뒤{" "}
                                <strong>{route.destination}</strong>까지 운행합니다. 첫차는{" "}
                                <span className="font-mono font-bold">{route.firstBus}</span>, 막차는{" "}
                                <span className="font-mono font-bold">{route.lastBus}</span>이며 일일{" "}
                                <strong>{route.runCount}회</strong> ({route.interval} 간격) 운행합니다.
                            </p>

                            <WikiFoldBox
                                title={`${route.routeNo}번 시간대별 통합 시간표 (${locationLabel} 출발 기준)`}
                                subtitle="평일 · 방학/휴일 비교 및 각주 필터"
                                headerColorClass="bg-[#003876] text-white"
                                defaultOpen={idx === 0}
                            >
                                <DualHourlyTimetableBlock
                                    route={route}
                                    allRoutes={routes}
                                    now={now}
                                    locationLabel={locationLabel}
                                />
                            </WikiFoldBox>
                        </WikiSection>
                    );
                })}
            </WikiSection>

            {/* Section 4: 교내 무료 통학 셔틀버스 */}
            <WikiSection
                id="shuttle"
                number="4"
                title="교내 무료 통학 셔틀버스"
                rightBadge={
                    <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate} variant="badge">
                        셔틀버스 상세 문서
                    </WikiLink>
                }
            >
                <p>
                    연세대학교 미래캠퍼스는 학기 중 평일 및 일요일(기숙사 귀사 편)에{" "}
                    <strong>여주역, 만종역, 원주역, 원주고속버스터미널, 시청사거리(무실동), 매지리</strong>와 교내{" "}
                    <strong>미래관</strong>을 연결하는 무료 셔틀버스를 운행합니다. 전체 등·하교 시간표와 승하차장 로드뷰는{" "}
                    <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                        연세대학교 미래캠퍼스/셔틀버스
                    </WikiLink>{" "}
                    하위 문서에서 자세히 열람할 수 있습니다.
                </p>
            </WikiSection>

            {/* Section 5: 기차역 · 터미널 연계 환승 가이드 */}
            <WikiSection
                id="transfer"
                number="5"
                title="기차역 · 터미널 연계 환승 가이드"
            >
                <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                <th className="py-2 px-3 w-36 border-r border-slate-300 dark:border-slate-700">
                                    출발 거점
                                </th>
                                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                    이용 가능 노선 및 방법
                                </th>
                                <th className="py-2 px-3 w-28 text-center">소요 시간</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                            <tr>
                                <td className="py-2.5 px-3 font-extrabold border-r border-slate-200 dark:border-slate-800">
                                    <span className="inline-flex items-center gap-1">
                                        <Train className="w-3.5 h-3.5 text-blue-600" />
                                        원주역 (중앙선 KTX)
                                    </span>
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                    원주역 시내버스 승강장에서{" "}
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
                                    또는{" "}
                                    <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                                        교내 셔틀버스
                                    </WikiLink>{" "}
                                    탑승
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono">약 15~20분</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-extrabold border-r border-slate-200 dark:border-slate-800">
                                    <span className="inline-flex items-center gap-1">
                                        <Train className="w-3.5 h-3.5 text-indigo-600" />
                                        만종역 (강릉선 KTX)
                                    </span>
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                    <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                                        교내 셔틀버스 (만종역 출발편)
                                    </WikiLink>{" "}
                                    이용 또는 시내버스 승차 후 터미널에서 30·34·34-1번 환승
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono">약 25~35분</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-extrabold border-r border-slate-200 dark:border-slate-800">
                                    <span className="inline-flex items-center gap-1">
                                        <Train className="w-3.5 h-3.5 text-teal-600" />
                                        여주역 (경강선 전철)
                                    </span>
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                    수도권 통학생 대상{" "}
                                    <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                                        여주역 ↔ 미래캠퍼스 무료 셔틀버스
                                    </WikiLink>{" "}
                                    직통 운행
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono">약 40~50분</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-3 font-extrabold border-r border-slate-200 dark:border-slate-800">
                                    <span className="inline-flex items-center gap-1">
                                        <GraduationCap className="w-3.5 h-3.5 text-slate-600" />
                                        원주종합버스터미널
                                    </span>
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                    시외·고속버스터미널 정류장에서{" "}
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
                                    상시 운행 및 건너편 그랜드치과 앞{" "}
                                    <WikiLink docId="yonsei-shuttle" onNavigate={onNavigate}>
                                        무료 셔틀버스
                                    </WikiLink>{" "}
                                    정차
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono">약 20~25분</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </WikiSection>
        </div>
    );
};
