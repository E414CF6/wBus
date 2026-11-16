"use client";

import React, {useMemo, useState} from "react";
import {Bus, Camera, Clock, Info, MapPin, Navigation, Search} from "lucide-react";
import {getKakaoMapUrl, getKakaoRoadviewUrl} from "@entities/station";
import {
    filterShuttleSchedule,
    getNextShuttleDepartures,
    type ShuttleDayFilter,
    type WikiBoardingStop,
    type WikiLinkedRoute,
    type WikiShuttleBlock,
} from "@entities/wiki";
import {triggerHaptic} from "@shared/utils/haptics";

type ShuttleTab = "outbound" | "inbound" | "stops" | "guidelines";

export const WikiEmbeddedRoutesBlock: React.FC<{
    routes: WikiLinkedRoute[];
    onSelectRoute?: (routeNo: string, cityCode: string) => void;
}> = ({routes, onSelectRoute}) => {
    if (routes.length === 0) return null;

    return (
        <div className="space-y-2 my-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                <Bus className="w-4 h-4 text-[#003876] dark:text-sky-400" />
                <span>연결 시내버스 ({routes.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {routes.map((route, idx) => {
                    const cardContent = (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-[#003876] dark:text-sky-300">
                                    {route.label || `${route.routeNo}번`}
                                </span>
                                {onSelectRoute && (
                                    <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 group-hover:underline">
                                        지도에서 보기 →
                                    </span>
                                )}
                            </div>
                            {route.description && (
                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 line-clamp-2">
                                    {route.description}
                                </p>
                            )}
                            {route.viaStops && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2">
                                    {route.viaStops}
                                </p>
                            )}
                        </>
                    );

                    if (!onSelectRoute) {
                        return (
                            <div
                                key={`${route.cityCode}:${route.routeNo}:${idx}`}
                                className="p-3 rounded-2xl border border-slate-200/85 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] space-y-1"
                            >
                                {cardContent}
                            </div>
                        );
                    }

                    return (
                        <button
                            key={`${route.cityCode}:${route.routeNo}:${idx}`}
                            type="button"
                            onClick={() => {
                                triggerHaptic("selection");
                                onSelectRoute(route.routeNo, route.cityCode);
                            }}
                            className="text-left p-3 rounded-2xl border border-slate-200/85 dark:border-white/10 bg-slate-50/70 hover:bg-sky-50/70 dark:bg-white/[0.03] dark:hover:bg-sky-950/30 transition cursor-pointer group space-y-1"
                        >
                            {cardContent}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export const WikiEmbeddedShuttleBlock: React.FC<{
    shuttle: WikiShuttleBlock;
}> = ({shuttle}) => {
    const [shuttleTab, setShuttleTab] = useState<ShuttleTab>("outbound");
    const [shuttleDayFilter, setShuttleDayFilter] = useState<ShuttleDayFilter>("ALL");
    const [shuttleQuery, setShuttleQuery] = useState("");

    const shuttleSummary = useMemo(() => {
        if (!shuttle.enabled) return null;
        return getNextShuttleDepartures(shuttle, "AUTO");
    }, [shuttle]);

    const filteredInbound = useMemo(
        () => filterShuttleSchedule(shuttle.inbound_to_campus, shuttleDayFilter, shuttleQuery),
        [shuttle.inbound_to_campus, shuttleDayFilter, shuttleQuery],
    );

    const filteredOutbound = useMemo(
        () => filterShuttleSchedule(shuttle.outbound_from_campus, shuttleDayFilter, shuttleQuery),
        [shuttle.outbound_from_campus, shuttleDayFilter, shuttleQuery],
    );

    if (!shuttle.enabled) return null;

    const activeScheduleList =
        shuttleTab === "inbound"
            ? filteredInbound
            : shuttleTab === "outbound"
              ? filteredOutbound
              : [];

    return (
        <div className="my-3 rounded-2xl border border-sky-200/80 dark:border-sky-800/60 bg-sky-50/50 dark:bg-sky-950/20 p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#003876] dark:text-sky-300">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>{shuttle.title}</span>
                </div>
                {shuttleSummary && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-white dark:bg-slate-900 border border-sky-200/70 dark:border-sky-800 text-slate-700 dark:text-slate-200">
                        {shuttleSummary.dayType.label}
                    </span>
                )}
            </div>

            {shuttleSummary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/70 border border-sky-100 dark:border-white/10">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            다음 진입 / 등교
                        </div>
                        {shuttleSummary.nextInbound ? (
                            <div className="mt-0.5 flex items-baseline justify-between gap-2">
                                <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                                    {shuttleSummary.nextInbound.item.departure_time} ·{" "}
                                    {shuttleSummary.nextInbound.item.departure_point}
                                </span>
                                <span className="text-[11px] font-black text-sky-600 dark:text-sky-400 tabular-nums">
                                    {shuttleSummary.nextInbound.waitMins === 0
                                        ? "곧 출발"
                                        : `${shuttleSummary.nextInbound.waitMins}분 후`}
                                </span>
                            </div>
                        ) : (
                            <p className="mt-0.5 text-xs font-bold text-slate-400">
                                금일 잔여 운행 없음
                            </p>
                        )}
                    </div>

                    <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/70 border border-sky-100 dark:border-white/10">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            다음 출발 / 하교
                        </div>
                        {shuttleSummary.nextOutbound ? (
                            <div className="mt-0.5 flex items-baseline justify-between gap-2">
                                <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                                    {shuttleSummary.nextOutbound.item.departure_time} ·{" "}
                                    {shuttleSummary.nextOutbound.item.destination}
                                </span>
                                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    {shuttleSummary.nextOutbound.waitMins === 0
                                        ? "곧 출발"
                                        : `${shuttleSummary.nextOutbound.waitMins}분 후`}
                                </span>
                            </div>
                        ) : (
                            <p className="mt-0.5 text-xs font-bold text-slate-400">
                                금일 잔여 운행 없음
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white/80 dark:bg-slate-900/80 p-1 border border-slate-200/70 dark:border-white/10">
                    {(
                        [
                            {
                                id: "outbound",
                                label: `출발·하교 (${shuttle.outbound_from_campus.length})`,
                            },
                            {
                                id: "inbound",
                                label: `진입·등교 (${shuttle.inbound_to_campus.length})`,
                            },
                            {
                                id: "stops",
                                label: `정류장 (${shuttle.stop_locations.length})`,
                            },
                            {
                                id: "guidelines",
                                label: `안내 (${shuttle.guidelines.length})`,
                            },
                        ] as Array<{id: ShuttleTab; label: string}>
                    ).map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setShuttleTab(tab.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                                shuttleTab === tab.id
                                    ? "bg-[#003876] dark:bg-sky-600 text-white"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {(shuttleTab === "inbound" || shuttleTab === "outbound") && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {(["ALL", "WEEKDAY", "SUNDAY"] as ShuttleDayFilter[]).map((day) => (
                            <button
                                key={day}
                                type="button"
                                onClick={() => setShuttleDayFilter(day)}
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold transition cursor-pointer ${
                                    shuttleDayFilter === day
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                        : "bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300"
                                }`}
                            >
                                {day === "ALL" ? "전체" : day === "WEEKDAY" ? "평일" : "일요일"}
                            </button>
                        ))}
                        <div className="relative flex items-center">
                            <Search className="w-3 h-3 absolute left-2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={shuttleQuery}
                                onChange={(e) => setShuttleQuery(e.target.value)}
                                placeholder="시간·정류장 검색"
                                aria-label="셔틀 시간표 검색"
                                className="w-36 sm:w-44 pl-6 pr-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {(shuttleTab === "inbound" || shuttleTab === "outbound") && (
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {activeScheduleList.length === 0 ? (
                        <p className="py-6 text-center text-xs font-bold text-slate-400">
                            일치하는 시간표가 없습니다.
                        </p>
                    ) : (
                        activeScheduleList.map((item, idx) => (
                            <div
                                key={`${item.departure_time}-${item.departure_point}-${idx}`}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/70 dark:border-white/10"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-sm font-black text-[#003876] dark:text-sky-300 tabular-nums shrink-0">
                                        {item.departure_time}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                        {item.operation_type}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                        {item.departure_point} → {item.destination}
                                    </span>
                                </div>
                                {(item.via.length > 0 || item.note) && (
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                                        {item.via.length > 0 && (
                                            <span>
                                                경유:{" "}
                                                {item.via
                                                    .map((v) =>
                                                        v.time ? `${v.name}(${v.time})` : v.name,
                                                    )
                                                    .join(" · ")}
                                            </span>
                                        )}
                                        {item.note && (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold">
                                                {item.note}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {shuttleTab === "stops" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {shuttle.stop_locations.length === 0 ? (
                        <p className="py-4 text-xs font-bold text-slate-400">
                            등록된 셔틀 정류장 안내가 없습니다.
                        </p>
                    ) : (
                        shuttle.stop_locations.map((stop, idx) => (
                            <div
                                key={`${stop.name}-${idx}`}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/70 dark:border-white/10"
                            >
                                <div className="text-xs font-black text-slate-900 dark:text-white">
                                    {stop.name}
                                </div>
                                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                                    {stop.location_description}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {shuttleTab === "guidelines" && (
                <ul className="space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 list-disc pl-4">
                    {shuttle.guidelines.length === 0 ? (
                        <li className="list-none text-slate-400">등록된 이용 안내가 없습니다.</li>
                    ) : (
                        shuttle.guidelines.map((line, idx) => <li key={idx}>{line}</li>)
                    )}
                </ul>
            )}
        </div>
    );
};

export const WikiEmbeddedStopsBlock: React.FC<{
    stops: WikiBoardingStop[];
}> = ({stops}) => {
    if (stops.length === 0) return null;

    return (
        <div className="space-y-2 my-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>주요 승강장 · 탑승 위치 ({stops.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {stops.map((stop) => (
                    <div
                        key={stop.id}
                        className="p-3 rounded-2xl border border-slate-200/85 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.03] space-y-1.5"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {stop.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 shrink-0">
                                {stop.directionTag}
                            </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            {stop.locationDescription}
                        </p>
                        {stop.tips && (
                            <p className="flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{stop.tips}</span>
                            </p>
                        )}
                        <div className="flex items-center gap-1.5 pt-1">
                            <a
                                href={getKakaoMapUrl(stop.name, stop.lat, stop.lng)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                            >
                                <Navigation className="w-2.5 h-2.5" />
                                카카오맵
                            </a>
                            <a
                                href={getKakaoRoadviewUrl(stop.lat, stop.lng)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                            >
                                <Camera className="w-2.5 h-2.5" />
                                로드뷰
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
