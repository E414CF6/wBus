"use client";

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {BusCacheData, BusRoute, CacheMetadata} from "@shared/types/bus";
import {UI_TEXT} from "@shared/config/locale";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {NoticeBanner, NoticeModal} from "@widgets/NoticeWidget";
import {CacheInfoBanner} from "@widgets/TimetableWidget/CacheInfoBanner";
import {YonseiRouteCard} from "./YonseiRouteCard";
import {YonseiRouteDetailModal} from "./YonseiRouteDetailModal";
import {AlertTriangle, Bus, CheckCircle2, Clock, GraduationCap, Info, Sparkles, X} from "lucide-react";

interface YonseiTimetableWidgetProps {
    onSelectMapRoute?: (routeName: string) => void;
    isEmbedded?: boolean;
    initialRouteNo?: string;
}

const YONSEI_TARGET_ROUTES = ["30", "34", "34-1"];

export default function YonseiTimetableWidget({
                                                  onSelectMapRoute,
                                                  isEmbedded = false,
                                              }: YonseiTimetableWidgetProps) {
    const [data, setData] = useState<BusCacheData | null>(null);
    const [meta, setMeta] = useState<CacheMetadata | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // One-off Day Mode Override ("AUTO" | "WEEKDAY" | "VACATION") - NOT saved to localStorage!
    const [dayModeOverride, setDayModeOverride] = useState<"AUTO" | "WEEKDAY" | "VACATION">("AUTO");

    // Notice Modal state
    const [isNoticeOpen, setIsNoticeOpen] = useState<boolean>(false);
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

    const handleOpenNotice = (noticeId?: string) => {
        setSelectedNoticeId(noticeId || null);
        setIsNoticeOpen(true);
    };

    // Refresh notice toast/banner state
    const [refreshNotice, setRefreshNotice] = useState<{
        type: "success" | "info";
        message: string;
    } | null>(null);

    const [selectedRoute, setSelectedRoute] = useState<BusRoute | null>(null);
    const [bookmarks, setBookmarks] = useState<string[]>([]);
    const [now, setNow] = useState<Date>(() => new Date());

    // Update live clock every 10 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    // Load bookmarks
    useEffect(() => {
        try {
            const saved = localStorage.getItem("wonju_bus_bookmarks");
            if (saved) {
                setBookmarks(JSON.parse(saved));
            } else {
                setBookmarks(YONSEI_TARGET_ROUTES);
            }
        } catch {
            setBookmarks(YONSEI_TARGET_ROUTES);
        }
    }, []);

    const toggleBookmark = (routeId: string) => {
        setBookmarks((prev) => {
            const isBookmarked = prev.includes(routeId);
            const next = isBookmarked ? prev.filter((id) => id !== routeId) : [...prev, routeId];
            try {
                localStorage.setItem("wonju_bus_bookmarks", JSON.stringify(next));
            } catch (e) {
                console.error("Failed to save bookmarks:", e);
            }
            return next;
        });
    };

    const isRouteBookmarked = useCallback(
        (route: BusRoute) => bookmarks.includes(route.id) || bookmarks.includes(route.routeNo),
        [bookmarks]
    );

    // Fetch bus timetable data
    const fetchBusData = async (refresh = false) => {
        if (refresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const endpoint = refresh ? "/api/bus/refresh?force=true" : "/api/bus";
            const method = refresh ? "POST" : "GET";

            const res = await fetch(endpoint, {method});
            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || UI_TEXT.ERROR.FETCH_FAILED(UI_TEXT.DATA_LABELS.SCHEDULE_DATA, res.status));
            }

            setData(json.data);
            setMeta(json.meta);

            if (refresh) {
                if (json.refreshed) {
                    setRefreshNotice({
                        type: "success",
                        message: json.message || UI_TEXT.YONSEI.REFRESH_SUCCESS,
                    });
                } else {
                    setRefreshNotice({
                        type: "info",
                        message: json.message || UI_TEXT.YONSEI.REFRESH_INFO,
                    });
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : UI_TEXT.ERROR.UNKNOWN("Fetch Error"));
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBusData(false);
    }, []);

    // Filter strictly to Yonsei routes (30, 34, 34-1)
    const yonseiRoutes = useMemo(() => {
        if (!data || !data.routes) return [];
        return data.routes.filter((route) => {
            const isTargetRoute = YONSEI_TARGET_ROUTES.includes(route.routeNo.trim());
            const originStr = route.origin ? route.origin.trim() : "";
            const destStr = route.destination ? route.destination.trim() : "";
            const isYonseiOrHoechon =
                originStr.includes("연세") || originStr.includes("회촌") ||
                destStr.includes("연세") || destStr.includes("회촌");
            return isTargetRoute && isYonseiOrHoechon;
        });
    }, [data]);

    // Check if today is actual weekend (Sunday=0, Saturday=6)
    const isTodayWeekendOrHoliday = useMemo(() => {
        const day = now.getDay();
        return day === 0 || day === 6;
    }, [now]);

    // Effective Day Mode (takes one-off dayModeOverride into account)
    const effectiveIsHoliday = useMemo(() => {
        if (dayModeOverride === "WEEKDAY") return false;
        if (dayModeOverride === "VACATION") return true;
        return isTodayWeekendOrHoliday;
    }, [dayModeOverride, isTodayWeekendOrHoliday]);

    // Pair each routeNo (30, 34, 34-1) with its matching active schedule variant
    const filteredRoutes = useMemo(() => {
        if (!yonseiRoutes.length) return [];

        const targetRouteNos = ["30", "34", "34-1"];
        const result: BusRoute[] = [];

        for (const rNo of targetRouteNos) {
            const matches = yonseiRoutes.filter((r) => r.routeNo === rNo);
            if (!matches.length) continue;

            if (effectiveIsHoliday) {
                const vacationMatch = matches.find(
                    (r) =>
                        r.dayType === "방학,휴일" ||
                        r.dayType.includes("방학") ||
                        r.dayType.includes("휴일") ||
                        r.dayType.includes("토요일") ||
                        r.dayType.includes("공휴일") ||
                        r.dayType === "통상"
                );
                result.push(vacationMatch || matches[0]);
            } else {
                const weekdayMatch = matches.find(
                    (r) => r.dayType === "평일" || r.dayType === "통상"
                );
                result.push(weekdayMatch || matches[0]);
            }
        }

        return result;
    }, [yonseiRoutes, effectiveIsHoliday]);

    // Calculate the soonest upcoming departure from Yonsei (30, 34) or Hoechon (34-1) for active routes
    const soonestDeparture = useMemo(() => {
        if (!filteredRoutes.length) return null;

        let bestCandidate: {
            route: BusRoute;
            depTime: string;
            waitMins: number;
            locationLabel: string;
        } | null = null;

        const currentMins = now.getHours() * 60 + now.getMinutes();

        for (const route of filteredRoutes) {
            const isHoechon = route.routeNo === "34-1";
            const locationLabel = isHoechon ? UI_TEXT.YONSEI.LOCATION_HOECHON : UI_TEXT.YONSEI.LOCATION_YONSEI;

            const validDepartures = route.timetable.filter(
                (item) => item.destDepTime && item.destDepTime !== "-" && item.destDepTime !== ""
            );

            for (const item of validDepartures) {
                const mins = parseTimeToMinutes(item.destDepTime);
                if (mins !== null && mins >= currentMins) {
                    const waitMins = mins - currentMins;
                    if (!bestCandidate || waitMins < bestCandidate.waitMins) {
                        bestCandidate = {
                            route,
                            depTime: item.destDepTime,
                            waitMins,
                            locationLabel,
                        };
                    }
                    break;
                }
            }
        }

        return bestCandidate;
    }, [filteredRoutes, now]);

    return (
        <div
            className={isEmbedded ? "w-full" : "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-28 min-h-dvh overflow-y-auto"}>
            {/* Hero Header Card with Yonsei Branding */}
            <div
                className="mb-6 backdrop-blur-2xl bg-gradient-to-r from-blue-900/10 via-indigo-900/5 to-slate-900/10 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900/40 rounded-3xl p-6 sm:p-8 border border-blue-500/20 shadow-sm relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div
                            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black bg-[#003876] text-white shadow-sm mb-3">
                            <GraduationCap className="w-4 h-4"/>
                            <span>{UI_TEXT.YONSEI.HERO_BADGE}</span>
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            {UI_TEXT.YONSEI.HERO_TITLE}
                        </h2>

                        {/* Dedicated 3 Routes Badges */}
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <span
                                className="px-3 py-1 rounded-xl text-xs font-extrabold bg-blue-600/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-mono">
                                {UI_TEXT.YONSEI.BADGE_30}
                            </span>
                            <span
                                className="px-3 py-1 rounded-xl text-xs font-extrabold bg-blue-600/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-mono">
                                {UI_TEXT.YONSEI.BADGE_34}
                            </span>
                            <span
                                className="px-3 py-1 rounded-xl text-xs font-extrabold bg-indigo-600/10 dark:bg-indigo-400/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-mono">
                                {UI_TEXT.YONSEI.BADGE_34_1}
                            </span>
                        </div>
                    </div>

                    {/* Spotlight Next Departure Banner */}
                    {soonestDeparture ? (
                        <div
                            className="bg-white/90 dark:bg-[#181818]/90 backdrop-blur-xl p-5 rounded-2xl border border-blue-500/30 shadow-lg shrink-0 max-w-sm w-full">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span
                                    className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 animate-spin" style={{animationDuration: "8s"}}/>
                                    {UI_TEXT.YONSEI.SOONEST_TITLE}
                                </span>
                                <span
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-blue-600 text-white font-mono">
                                    {soonestDeparture.route.routeNo}번
                                </span>
                            </div>

                            <div className="flex items-baseline justify-between gap-2">
                                <div>
                                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        {soonestDeparture.locationLabel}
                                    </div>
                                    <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                                        {soonestDeparture.depTime}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span
                                        className="inline-block px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black text-sm border border-emerald-500/30">
                                        {UI_TEXT.TIMETABLE.WAIT_MINUTES(soonestDeparture.waitMins)}
                                    </span>
                                </div>
                            </div>

                            {/* One-off Day Mode Control (Directly below Next Departure Info) */}
                            <div
                                className="mt-3.5 pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-2">
                                <div
                                    className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-500"/>
                                    <span>{UI_TEXT.YONSEI.MODE_OVERRIDE_LABEL}</span>
                                </div>
                                <div
                                    className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-[10px] font-black">
                                    <button
                                        type="button"
                                        onClick={() => setDayModeOverride("AUTO")}
                                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                            dayModeOverride === "AUTO"
                                                ? "bg-blue-600 text-white shadow-xs"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                        title={UI_TEXT.YONSEI.MODE_AUTO_TOOLTIP}
                                    >
                                        {UI_TEXT.YONSEI.MODE_AUTO(isTodayWeekendOrHoliday)}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDayModeOverride("WEEKDAY")}
                                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                            dayModeOverride === "WEEKDAY"
                                                ? "bg-amber-600 text-white shadow-xs"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                        title={UI_TEXT.YONSEI.MODE_WEEKDAY_TOOLTIP}
                                    >
                                        {UI_TEXT.YONSEI.MODE_WEEKDAY}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDayModeOverride("VACATION")}
                                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                                            dayModeOverride === "VACATION"
                                                ? "bg-indigo-600 text-white shadow-xs"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                        title={UI_TEXT.YONSEI.MODE_VACATION_TOOLTIP}
                                    >
                                        {UI_TEXT.YONSEI.MODE_VACATION}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="bg-white/80 dark:bg-[#181818]/80 p-4 rounded-2xl border border-black/5 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 italic">
                            {UI_TEXT.YONSEI.NO_MORE_BUSES_TODAY}
                        </div>
                    )}
                </div>
            </div>

            {/* Refresh Notice Toast Banner */}
            {refreshNotice && (
                <div
                    className={`p-4 mb-6 rounded-2xl border flex items-center justify-between transition-all animate-fadeIn shadow-lg ${
                        refreshNotice.type === "success"
                            ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                            : "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200"
                    }`}
                >
                    <div className="flex items-center space-x-3">
                        {refreshNotice.type === "success" ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"/>
                        ) : (
                            <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"/>
                        )}
                        <span className="text-sm font-medium leading-relaxed">{refreshNotice.message}</span>
                    </div>
                    <button
                        onClick={() => setRefreshNotice(null)}
                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0 ml-3 cursor-pointer"
                        title={UI_TEXT.COMMON.CANCEL}
                    >
                        <X className="h-4 w-4"/>
                    </button>
                </div>
            )}

            {/* Dedicated ITS Notice Center Banner */}
            <NoticeBanner onClick={(id) => handleOpenNotice(id)}/>

            {/* Cache Information Banner (Compact text bar & refresh button) */}
            <CacheInfoBanner
                meta={meta}
                onRefresh={() => fetchBusData(true)}
                isRefreshing={isRefreshing}
            />

            {/* Error Banner */}
            {error && (
                <div
                    className="p-4 mb-6 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"/>
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    <button
                        onClick={() => fetchBusData(false)}
                        className="px-3 py-1 rounded-xl bg-rose-200 dark:bg-rose-500/20 hover:bg-rose-300 dark:hover:bg-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                    >
                        {UI_TEXT.COMMON.RETRY}
                    </button>
                </div>
            )}

            {/* Main Timetable Content */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-52 backdrop-blur-xl bg-white/40 dark:bg-[#121212]/40 rounded-2xl animate-pulse border border-black/5 dark:border-white/5"
                        />
                    ))}
                </div>
            ) : filteredRoutes.length === 0 ? (
                <div
                    className="backdrop-blur-xl bg-white/80 dark:bg-[#121212]/80 rounded-3xl p-12 text-center my-8 border border-slate-200 dark:border-slate-800">
                    <Bus className="h-10 w-10 mx-auto text-slate-400 mb-3"/>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                        {UI_TEXT.TIMETABLE.NO_ROUTES_FOUND}
                    </h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRoutes.map((route) => (
                        <YonseiRouteCard
                            key={route.id}
                            route={route}
                            isBookmarked={isRouteBookmarked(route)}
                            onToggleBookmark={(id) => toggleBookmark(id)}
                            onSelectRoute={(r) => setSelectedRoute(r)}
                            onSelectMapRoute={onSelectMapRoute}
                            currentTime={now}
                        />
                    ))}
                </div>
            )}

            {/* Yonsei Dedicated Route Detail Modal */}
            {selectedRoute && (
                <YonseiRouteDetailModal
                    route={selectedRoute}
                    allYonseiRoutes={yonseiRoutes}
                    onClose={() => setSelectedRoute(null)}
                    isBookmarked={isRouteBookmarked(selectedRoute)}
                    onToggleBookmark={(id) => toggleBookmark(id)}
                    onSelectMapRoute={onSelectMapRoute}
                    currentTime={now}
                />
            )}

            {/* Wonju ITS Notice Center Modal */}
            <NoticeModal
                isOpen={isNoticeOpen}
                onClose={() => {
                    setIsNoticeOpen(false);
                    setSelectedNoticeId(null);
                }}
                initialNoticeId={selectedNoticeId}
            />
        </div>
    );
}
