import {useBusArrivalInfo} from "@entities/station/hooks";

import type {BusStopArrival} from "@entities/station/types";

import {UI_TEXT} from "@shared/config/locale";

import {formatVehicleType, secondsToMinutes} from "@shared/utils/formatters";

import {AlertTriangle, Bus, ChevronRight, Clock, MapPin, RefreshCw} from "lucide-react";
import {useEffect, useMemo, useState} from "react";

// Sets the theme based on arrival time in minutes
const getStatusTheme = (minutes: number) => {
    if (minutes <= 2) return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-50/70 dark:bg-red-500/12",
        border: "border-red-200/80 dark:border-red-500/25",
        badge: "bg-red-500 text-white",
        label: UI_TEXT.BUS_ITEM.ARRIVING_SOON
    };
    if (minutes <= 5) return {
        text: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50/70 dark:bg-amber-500/12",
        border: "border-amber-200/80 dark:border-amber-500/25",
        badge: "bg-amber-500 text-white",
        label: UI_TEXT.BUS_ITEM.ARRIVING_SOON
    };
    return {
        text: "text-blue-600 dark:text-blue-400",
        bg: "bg-slate-50/90 dark:bg-white/[0.04]",
        border: "border-black/5 dark:border-white/8",
        badge: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200",
        label: UI_TEXT.BUS_ITEM.RUNNING_NOW
    };
};

function formatCountdownText(remainingSecs: number): { mainText: string; subText?: string; isImminent: boolean } {
    if (remainingSecs <= 45) {
        return {
            mainText: UI_TEXT.BUS_ITEM.ARRIVING_SOON,
            subText: remainingSecs > 0 ? `${remainingSecs}초` : undefined,
            isImminent: true,
        };
    }
    const mins = Math.floor(remainingSecs / 60);
    const secs = remainingSecs % 60;
    if (mins < 5) {
        return {
            mainText: `${mins}분 ${secs}초`,
            isImminent: mins <= 2,
        };
    }
    return {
        mainText: `${mins}${UI_TEXT.TIME.MINUTE_SUFFIX}`,
        subText: `${secs}초`,
        isImminent: false,
    };
}

function ArrivalItem({
                         bus,
                         elapsedSeconds,
                         isCurrentRoute,
                         onRouteChange,
                     }: {
    bus: BusStopArrival;
    elapsedSeconds: number;
    isCurrentRoute?: boolean;
    onRouteChange?: (name: string) => void;
}) {
    const remainingSecs = Math.max(0, bus.arrtime - elapsedSeconds);
    const minutes = secondsToMinutes(remainingSecs);
    const theme = getStatusTheme(minutes);
    const countdown = formatCountdownText(remainingSecs);
    const routeName = String(bus.routeno ?? "").trim();

    return (
        <button
            type="button"
            onClick={() => onRouteChange?.(routeName)}
            className={`w-full group relative flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                isCurrentRoute
                    ? "bg-blue-50/90 dark:bg-blue-500/15 border-blue-400/60 dark:border-blue-400/40 ring-1 ring-blue-500/20 shadow-xs"
                    : `${theme.bg} ${theme.border}`
            } hover:opacity-95 active:scale-[0.98]`}
        >
            <div className="flex flex-col items-start gap-1.5 overflow-hidden">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black shadow-xs ${
                        isCurrentRoute ? "bg-blue-600 text-white" : theme.badge
                    }`}>
                        {routeName}번
                    </span>
                    {isCurrentRoute && (
                        <span
                            className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            보고 있는 노선
                        </span>
                    )}
                    <span
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate tracking-tight uppercase">
                        {formatVehicleType(bus.vehicletp)}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <MapPin className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0"/>
                    <span className="text-[11px] font-extrabold">
                        {bus.arrprevstationcnt === 0 ? UI_TEXT.BUS_ITEM.ARRIVING_SOON : UI_TEXT.BUS_ITEM.STOPS_LEFT(bus.arrprevstationcnt)}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-end shrink-0 ml-3">
                <div className={`flex items-baseline gap-1 font-black ${theme.text}`}>
                    <Clock className={`w-3.5 h-3.5 opacity-80 self-center ${countdown.isImminent ? "animate-pulse" : ""}`}/>
                    <span className="text-lg sm:text-xl leading-none tracking-tight font-mono">
                        {countdown.mainText}
                    </span>
                    {countdown.subText && (
                        <span className="text-[10px] font-mono font-bold opacity-75">
                            ({countdown.subText})
                        </span>
                    )}
                </div>
                <div
                    className="flex items-center text-[10px] text-slate-400 dark:text-slate-500 font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-1.5">
                    {isCurrentRoute ? "현재 노선" : UI_TEXT.BUS_ITEM.SHOW_ROUTE}
                    <ChevronRight className="w-3 h-3 ml-0.5 opacity-60 group-hover:translate-x-0.5 transition-transform"/>
                </div>
            </div>
        </button>
    );
}

function LoadingSkeleton() {
    return (<div className="p-4 space-y-2.5">
        {[1, 2, 3].map((i) => (
            <div key={i} className="h-18 w-full bg-slate-100 dark:bg-white/5 animate-pulse rounded-[20px]"/>))}
    </div>);
}

function ArrivalList({
                         loading,
                         isValidating,
                         error,
                         arrivalData,
                         elapsedSeconds,
                         currentRouteName,
                         onRouteChange,
                         onRefresh,
                     }: {
    loading: boolean;
    isValidating: boolean;
    error: string | null;
    arrivalData: BusStopArrival[];
    elapsedSeconds: number;
    currentRouteName?: string;
    onRouteChange?: (routeName: string) => void;
    onRefresh: () => void;
}) {
    if (error) {
        return (<div className="p-4">
            <div
                className="flex flex-col items-center gap-2.5 p-6 bg-red-50 dark:bg-red-500/10 rounded-[20px] border border-red-100 dark:border-red-500/20 text-center">
                <div className="p-2 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full">
                    <AlertTriangle className="w-6 h-6"/>
                </div>
                <p className="text-sm text-red-800 dark:text-red-400 font-semibold">{error}</p>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-white/10 text-xs font-extrabold text-slate-700 dark:text-slate-200 border border-black/10 dark:border-white/10 hover:bg-slate-50 transition cursor-pointer active:scale-95"
                >
                    <RefreshCw className={`w-3 h-3 ${isValidating ? "animate-spin" : ""}`}/>
                    <span>다시 시도</span>
                </button>
            </div>
        </div>);
    }

    if (loading && arrivalData.length === 0) return <LoadingSkeleton/>;

    if (!loading && arrivalData.length === 0) {
        return (<div className="p-4 text-center">
            <div
                className="py-7 px-4 bg-slate-50 dark:bg-white/[0.03] rounded-[20px] border border-slate-100 dark:border-white/8 flex flex-col items-center">
                <div
                    className="mx-auto w-10 h-10 bg-slate-200/70 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-2.5">
                    <Bus className="w-5 h-5"/>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-bold">{UI_TEXT.BUS_LIST.NO_RUNNING_DESC}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">곧 도착 예정인 버스가 없습니다</p>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-white/10 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 border border-black/8 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/15 transition cursor-pointer active:scale-95 shadow-2xs"
                >
                    <RefreshCw className={`w-3 h-3 ${isValidating ? "animate-spin text-blue-500" : ""}`}/>
                    <span>도착정보 새로고침</span>
                </button>
            </div>
        </div>);
    }

    return (
        <div className="flex flex-col">
            {/* Sub-header with live status & manual refresh */}
            <div className="flex items-center justify-between px-4 pt-2.5 pb-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                    도착 예정 <strong className="text-slate-900 dark:text-white font-extrabold">{arrivalData.length}개</strong> 노선
                </span>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[10px] font-bold text-slate-500 dark:text-slate-400 transition cursor-pointer active:scale-95"
                    title="실시간 도착정보 새로고침"
                >
                    <RefreshCw className={`w-2.5 h-2.5 ${isValidating ? "animate-spin text-blue-500" : ""}`}/>
                    <span>{elapsedSeconds <= 1 ? "방금 갱신" : `${elapsedSeconds}초 전`}</span>
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2.5 sm:p-3 pt-1.5 space-y-2">
                {arrivalData.map((bus, idx) => {
                    const rName = String(bus.routeno ?? "").trim();
                    const isCurrentRoute = Boolean(currentRouteName && rName === currentRouteName);
                    return (
                        <ArrivalItem
                            key={`${bus.routeno}-${idx}`}
                            bus={bus}
                            elapsedSeconds={elapsedSeconds}
                            isCurrentRoute={isCurrentRoute}
                            onRouteChange={onRouteChange}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default function BusStopPopup({
                                         stopId,
                                         cityCode = "32020",
                                         currentRouteName,
                                         onRouteChange,
                                     }: {
    stopId: string;
    cityCode?: string;
    currentRouteName?: string;
    onRouteChange?: (routeName: string) => void;
}) {
    const {data: arrivalRawData, loading, isValidating, error, lastUpdated, refresh} = useBusArrivalInfo(stopId, cityCode);
    const [nowMs, setNowMs] = useState<number>(() => Date.now());

    // 1-second live ticker for real-time arrival countdown
    useEffect(() => {
        const timer = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const elapsedSeconds = useMemo(() => {
        if (!lastUpdated) return 0;
        return Math.max(0, Math.min(30, Math.floor((nowMs - lastUpdated) / 1000)));
    }, [nowMs, lastUpdated]);

    const sortedArrivalData = useMemo(() => {
        if (!arrivalRawData) return [];
        return [...arrivalRawData].sort((a, b) => {
            const aIsCurrent = currentRouteName && String(a.routeno ?? "").trim() === currentRouteName ? 1 : 0;
            const bIsCurrent = currentRouteName && String(b.routeno ?? "").trim() === currentRouteName ? 1 : 0;
            if (aIsCurrent !== bIsCurrent) return bIsCurrent - aIsCurrent;
            return a.arrtime - b.arrtime;
        });
    }, [arrivalRawData, currentRouteName]);

    return (<div className="w-full min-w-68 sm:min-w-[330px] bg-transparent overflow-hidden">
        <ArrivalList
            loading={loading}
            isValidating={isValidating}
            error={error}
            arrivalData={sortedArrivalData}
            elapsedSeconds={elapsedSeconds}
            currentRouteName={currentRouteName}
            onRouteChange={onRouteChange}
            onRefresh={refresh}
        />
    </div>);
}

