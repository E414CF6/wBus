"use client";

import React, {useMemo, useState} from "react";
import {Camera, ExternalLink, MapPin, Navigation, Search, X} from "lucide-react";
import {YONSEI_SHUTTLE_SCHEDULE} from "@entities/schedule";
import {
    getKakaoMapUrl,
    getKakaoRoadviewUrl,
    YONSEI_SHUTTLE_STOPS,
    type YonseiShuttleStop,
} from "@entities/station";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {
    WikiCallout,
    WikiInfobox,
    WikiLink,
    WikiSection,
    WikiToc,
    type WikiTocItem,
} from "../WikiPrimitives";

interface YonseiShuttleWikiArticleProps {
    onNavigate: (docId: string) => void;
    onFlyToLocation?: (lat: number, lng: number, label: string) => void;
    now: Date;
}

type DayFilter = "ALL" | "WEEKDAY" | "SUNDAY";

const TOC_ITEMS: WikiTocItem[] = [
    {id: "overview", number: "1", title: "개요 및 이용 수칙"},
    {id: "inbound", number: "2", title: "등교 (캠퍼스행) 운행 시간표"},
    {id: "outbound", number: "3", title: "하교 (캠퍼스발) 운행 시간표"},
    {id: "stops", number: "4", title: "정류장별 승하차 위치 상세 및 로드뷰"},
];

export const YonseiShuttleWikiArticle: React.FC<YonseiShuttleWikiArticleProps> = ({
    onNavigate,
    onFlyToLocation,
    now,
}) => {
    const [dayFilter, setDayFilter] = useState<DayFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const isSunday = now.getDay() === 0;

    const filteredInbound = useMemo(() => {
        return YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus
            .filter((item) => {
                if (dayFilter === "WEEKDAY" && item.operation_type.includes("일요일"))
                    return false;
                if (dayFilter === "SUNDAY" && !item.operation_type.includes("일요일"))
                    return false;
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchPoint = item.departure_point.toLowerCase().includes(q);
                    const matchTime = item.departure_time.includes(q);
                    const matchDest = item.destination.toLowerCase().includes(q);
                    const matchVia = item.via.some((v) =>
                        v.name.toLowerCase().includes(q)
                    );
                    const matchNote = item.note
                        ? item.note.toLowerCase().includes(q)
                        : false;
                    if (
                        !matchPoint &&
                        !matchTime &&
                        !matchDest &&
                        !matchVia &&
                        !matchNote
                    )
                        return false;
                }
                return true;
            })
            .slice()
            .sort(
                (a, b) =>
                    (parseTimeToMinutes(a.departure_time) ?? 0) -
                    (parseTimeToMinutes(b.departure_time) ?? 0)
            );
    }, [dayFilter, searchQuery]);

    const filteredOutbound = useMemo(() => {
        return YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus
            .filter((item) => {
                if (dayFilter === "WEEKDAY" && item.operation_type.includes("일요일"))
                    return false;
                if (dayFilter === "SUNDAY" && !item.operation_type.includes("일요일"))
                    return false;
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchPoint = item.departure_point.toLowerCase().includes(q);
                    const matchTime = item.departure_time.includes(q);
                    const matchDest = item.destination.toLowerCase().includes(q);
                    const matchVia = item.via.some((v) =>
                        v.name.toLowerCase().includes(q)
                    );
                    const matchNote = item.note
                        ? item.note.toLowerCase().includes(q)
                        : false;
                    if (
                        !matchPoint &&
                        !matchTime &&
                        !matchDest &&
                        !matchVia &&
                        !matchNote
                    )
                        return false;
                }
                return true;
            })
            .slice()
            .sort(
                (a, b) =>
                    (parseTimeToMinutes(a.departure_time) ?? 0) -
                    (parseTimeToMinutes(b.departure_time) ?? 0)
            );
    }, [dayFilter, searchQuery]);

    const nextInboundIdx = useMemo(() => {
        for (let i = 0; i < filteredInbound.length; i++) {
            const item = filteredInbound[i];
            const isItemSunday = item.operation_type.includes("일요일");
            if (isSunday !== isItemSunday && dayFilter === "ALL") continue;
            const mins = parseTimeToMinutes(item.departure_time);
            if (mins !== null && mins >= currentMins) return i;
        }
        return -1;
    }, [filteredInbound, currentMins, isSunday, dayFilter]);

    const nextOutboundIdx = useMemo(() => {
        for (let i = 0; i < filteredOutbound.length; i++) {
            const item = filteredOutbound[i];
            const isItemSunday = item.operation_type.includes("일요일");
            if (isSunday !== isItemSunday && dayFilter === "ALL") continue;
            const mins = parseTimeToMinutes(item.departure_time);
            if (mins !== null && mins >= currentMins) return i;
        }
        return -1;
    }, [filteredOutbound, currentMins, isSunday, dayFilter]);

    return (
        <div className="space-y-6">
            {/* Top Layout: Callout + TOC on Left, Infobox on Right */}
            <div className="flex flex-col-reverse md:flex-row items-start justify-between gap-4">
                <div className="w-full md:w-auto space-y-3 flex-1">
                    <WikiCallout tone="teal">
                        이 문서는{" "}
                        <WikiLink docId="yonsei" onNavigate={onNavigate}>
                            연세대학교 미래캠퍼스
                        </WikiLink>
                        에서 운행하는 <strong>교내 무료 통학 셔틀버스</strong>의 등·하교 시간표, 경유지 정차 시각 및 승하차장 위치를 정리한 위키 문서입니다.
                    </WikiCallout>
                    <WikiToc items={TOC_ITEMS} />
                </div>

                <WikiInfobox
                    badge="CAMPUS SHUTTLE BUS"
                    title="연세대 미래캠퍼스 셔틀버스"
                    subtitle="교내 무료 통학버스 운행 정보"
                    headerClassName="bg-teal-700 text-white"
                    rows={[
                        {label: "운행 요금", value: "무료 (재학생 및 교직원)"},
                        {
                            label: "운행 일자",
                            value: "학기 중 평일 운행 / 일요일 특별편 운행 (공휴일·방학 미운행)",
                        },
                        {
                            label: "주요 거점",
                            value: "여주역, 만종역, 원주역, 원주고속터미널, 시청사거리, 매지리, 세브란스기독병원",
                        },
                        {
                            label: "등·하교 횟수",
                            value: `등교 ${YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus.length}회 / 하교 ${YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus.length}회`,
                        },
                        {
                            label: "연계 시내버스",
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
                    ]}
                />
            </div>

            {/* Filter & Search Bar shared across Sections 2 & 3 */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#161a25] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 mr-1">
                        운행일 필터:
                    </span>
                    {(
                        [
                            {id: "ALL", label: "전체 보기"},
                            {id: "WEEKDAY", label: "평일 운행"},
                            {id: "SUNDAY", label: "일요일 특별편"},
                        ] as const
                    ).map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setDayFilter(f.id)}
                            className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                                dayFilter === f.id
                                    ? "bg-teal-600 text-white border-teal-600"
                                    : "bg-white dark:bg-[#12151e] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="정류장·시간 검색 (예: 여주역, 원주역, 08:)"
                        className="w-full pl-8 pr-7 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Section 1: 개요 및 이용 수칙 */}
            <WikiSection id="overview" number="1" title="개요 및 이용 수칙">
                <ul className="list-decimal pl-5 space-y-1.5">
                    {YONSEI_SHUTTLE_SCHEDULE.guidelines.map((rule, idx) => (
                        <li key={idx} className="font-medium">
                            {rule}
                        </li>
                    ))}
                </ul>
            </WikiSection>

            {/* Section 2: 등교 (캠퍼스행) 운행 시간표 */}
            <WikiSection
                id="inbound"
                number="2"
                title={`등교 (캠퍼스행) 운행 시간표 (${filteredInbound.length}회)`}
            >
                <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                <th className="py-2 px-3 w-20 text-center border-r border-slate-300 dark:border-slate-700">
                                    출발 시각
                                </th>
                                <th className="py-2 px-3 w-24 text-center border-r border-slate-300 dark:border-slate-700">
                                    운행 구분
                                </th>
                                <th className="py-2 px-3 w-36 border-r border-slate-300 dark:border-slate-700">
                                    출발 기점
                                </th>
                                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                    경유 정류장 및 정차 시각
                                </th>
                                <th className="py-2 px-3 w-24 text-center">도착지</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                            {filteredInbound.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">
                                        검색 조건에 일치하는 등교 셔틀버스가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredInbound.map((item, idx) => {
                                    const isNext = idx === nextInboundIdx;
                                    const isSun = item.operation_type.includes("일요일");
                                    return (
                                        <tr
                                            key={idx}
                                            className={
                                                isNext
                                                    ? "bg-teal-50/80 dark:bg-teal-950/35 font-bold"
                                                    : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                            }
                                        >
                                            <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                                                <span>{item.departure_time}</span>
                                                {isNext && (
                                                    <span className="block mt-0.5 px-1 py-0.2 rounded bg-teal-600 text-white font-sans text-[9px] font-black">
                                                        다음 버스
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-800">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                                        isSun
                                                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                                            : "bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300"
                                                    }`}
                                                >
                                                    {item.operation_type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-extrabold text-teal-800 dark:text-teal-300 border-r border-slate-200 dark:border-slate-800">
                                                {item.departure_point}
                                            </td>
                                            <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                                {item.via.length === 0 ? (
                                                    <span className="text-slate-400 italic">
                                                        무정차 직통
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {item.via.map((v, vIdx) => (
                                                            <span
                                                                key={vIdx}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-xs"
                                                            >
                                                                <span>{v.name}</span>
                                                                {v.time && (
                                                                    <strong className="font-mono text-teal-600 dark:text-teal-400">
                                                                        ({v.time})
                                                                    </strong>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {item.note && (
                                                    <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                                                        ※ {item.note}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-2.5 text-center font-bold text-slate-700 dark:text-slate-300">
                                                {item.destination}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </WikiSection>

            {/* Section 3: 하교 (캠퍼스발) 운행 시간표 */}
            <WikiSection
                id="outbound"
                number="3"
                title={`하교 (캠퍼스발) 운행 시간표 (${filteredOutbound.length}회)`}
            >
                <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                <th className="py-2 px-3 w-20 text-center border-r border-slate-300 dark:border-slate-700">
                                    출발 시각
                                </th>
                                <th className="py-2 px-3 w-24 text-center border-r border-slate-300 dark:border-slate-700">
                                    운행 구분
                                </th>
                                <th className="py-2 px-3 w-32 border-r border-slate-300 dark:border-slate-700">
                                    출발 장소
                                </th>
                                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                    하차 경유 정류장
                                </th>
                                <th className="py-2 px-3 w-28 text-center">종착 행선지</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                            {filteredOutbound.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400">
                                        검색 조건에 일치하는 하교 셔틀버스가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredOutbound.map((item, idx) => {
                                    const isNext = idx === nextOutboundIdx;
                                    const isSun = item.operation_type.includes("일요일");
                                    return (
                                        <tr
                                            key={idx}
                                            className={
                                                isNext
                                                    ? "bg-emerald-50/80 dark:bg-emerald-950/35 font-bold"
                                                    : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                            }
                                        >
                                            <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                                                <span>{item.departure_time}</span>
                                                {isNext && (
                                                    <span className="block mt-0.5 px-1 py-0.2 rounded bg-emerald-600 text-white font-sans text-[9px] font-black">
                                                        다음 버스
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-800">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                                        isSun
                                                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                                            : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                                    }`}
                                                >
                                                    {item.operation_type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                                                {item.departure_point}
                                            </td>
                                            <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                                {item.via.length === 0 ? (
                                                    <span className="text-slate-400 italic">
                                                        무정차 직통
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {item.via.map((v, vIdx) => (
                                                            <span
                                                                key={vIdx}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-xs"
                                                            >
                                                                <span>{v.name}</span>
                                                                {v.time && (
                                                                    <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                                                                        ({v.time})
                                                                    </strong>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {item.note && (
                                                    <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                                                        ※ {item.note}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-2.5 text-center font-extrabold text-emerald-700 dark:text-emerald-300">
                                                {item.destination}행
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </WikiSection>

            {/* Section 4: 정류장별 승하차 위치 상세 및 로드뷰 */}
            <WikiSection
                id="stops"
                number="4"
                title="정류장별 승하차 위치 상세 및 로드뷰"
            >
                <p>
                    셔틀버스는 일반 시내버스 정류장과 승하차 위치가 다른 곳이 있으므로 아래 표의 상세 설명과 로드뷰를 미리 확인하시기 바랍니다.
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                <th className="py-2 px-3 w-36 border-r border-slate-300 dark:border-slate-700">
                                    정류장명
                                </th>
                                <th className="py-2 px-3 w-20 text-center border-r border-slate-300 dark:border-slate-700">
                                    방면
                                </th>
                                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                    상세 승하차 위치 설명
                                </th>
                                <th className="py-2 px-3 w-44 text-center">위치 확인 · 로드뷰</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                            {YONSEI_SHUTTLE_STOPS.map((stop: YonseiShuttleStop) => {
                                const roadviewUrl = getKakaoRoadviewUrl(stop.lat, stop.lng);
                                const mapUrl = getKakaoMapUrl(stop.name, stop.lat, stop.lng);
                                return (
                                    <tr
                                        key={stop.id}
                                        className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                    >
                                        <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                                            {stop.name}
                                        </td>
                                        <td className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    stop.directionTag === "학교방면"
                                                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                                                        : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                                }`}
                                            >
                                                {stop.directionTag}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                                            {stop.locationDescription}
                                        </td>
                                        <td className="py-2.5 px-2.5 text-center">
                                            <div className="flex flex-wrap items-center justify-center gap-1">
                                                {onFlyToLocation && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onFlyToLocation(
                                                                stop.lat,
                                                                stop.lng,
                                                                stop.name
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                                                        title="본 지도에서 위치 보기"
                                                    >
                                                        <MapPin className="w-3 h-3" />
                                                        <span>지도</span>
                                                    </button>
                                                )}
                                                <a
                                                    href={roadviewUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold"
                                                >
                                                    <Camera className="w-3 h-3" />
                                                    <span>로드뷰</span>
                                                </a>
                                                <a
                                                    href={mapUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[11px] font-bold"
                                                >
                                                    <Navigation className="w-2.5 h-2.5" />
                                                    <span>길찾기</span>
                                                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </WikiSection>
        </div>
    );
};
