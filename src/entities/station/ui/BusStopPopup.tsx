import {useBusArrivalInfo} from "@entities/station/hooks";

import type {BusStopArrival} from "@entities/station/types";

import {UI_TEXT} from "@shared/config/locale";

import {formatVehicleType, secondsToMinutes} from "@shared/utils/formatters";

import {AlertTriangle, Bus, ChevronRight, Clock, MapPin, RefreshCw} from "lucide-react";
import {useMemo} from "react";

// Sets the theme based on arrival time in minutes
const getStatusTheme = (minutes: number) => {
    if (minutes <= 2) return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-50/50 dark:bg-red-500/10",
        border: "border-red-100 dark:border-red-500/20",
        badge: "bg-red-500 text-white",
        label: UI_TEXT.BUS_ITEM.ARRIVING_SOON
    };
    if (minutes <= 5) return {
        text: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50/50 dark:bg-amber-500/10",
        border: "border-amber-100 dark:border-amber-500/20",
        badge: "bg-amber-500 text-white",
        label: UI_TEXT.BUS_ITEM.ARRIVING_SOON
    };
    return {
        text: "text-blue-600 dark:text-blue-400",
        bg: "bg-gray-50 dark:bg-white/5",
        border: "border-transparent",
        badge: "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
        label: UI_TEXT.BUS_ITEM.RUNNING_NOW
    };
};

function ArrivalItem({
                         bus,
                         isCurrentRoute,
                         onRouteChange,
                     }: {
    bus: BusStopArrival;
    isCurrentRoute?: boolean;
    onRouteChange?: (name: string) => void;
}) {
    const minutes = secondsToMinutes(bus.arrtime);
    const theme = getStatusTheme(minutes);
    const routeName = String(bus.routeno ?? "").trim();

    return (
        <button
            type="button"
            onClick={() => onRouteChange?.(routeName)}
            className={`w-full group relative flex items-center justify-between p-3.5 rounded-[20px] border transition-all duration-200 cursor-pointer ${
                isCurrentRoute
                    ? "bg-blue-50/80 dark:bg-blue-500/15 border-blue-400/50 dark:border-blue-400/40 ring-1 ring-blue-500/20"
                    : `${theme.bg} ${theme.border}`
            } hover:opacity-90 active:scale-[0.98]`}
        >
            <div className="flex flex-col items-start gap-1.5 overflow-hidden">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black shadow-sm ${
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
                        className="text-[10px] font-bold text-gray-400 dark:text-gray-500 truncate tracking-tight uppercase">
                        {formatVehicleType(bus.vehicletp)}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <MapPin className="w-3 h-3 opacity-60"/>
                    <span className="text-[11px] font-bold">
                        {bus.arrprevstationcnt === 0 ? UI_TEXT.BUS_ITEM.ARRIVING_SOON : UI_TEXT.BUS_ITEM.STOPS_LEFT(bus.arrprevstationcnt)}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-end shrink-0 ml-4">
                <div className={`flex items-center gap-1 font-black ${theme.text}`}>
                    <Clock className="w-3.5 h-3.5 opacity-80"/>
                    <span className="text-xl leading-none tracking-tighter">
                        {minutes === 0 ? UI_TEXT.BUS_ITEM.ARRIVING_SOON : `${minutes}${UI_TEXT.TIME.MINUTE_SUFFIX}`}
                    </span>
                </div>
                <div
                    className="flex items-center text-[10px] text-gray-400 dark:text-gray-500 font-bold group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors mt-2">
                    {isCurrentRoute ? "현재 노선" : UI_TEXT.BUS_ITEM.SHOW_ROUTE}
                    <ChevronRight className="w-3 h-3 ml-0.5 opacity-50"/>
                </div>
            </div>
        </button>
    );
}

function LoadingSkeleton() {
    return (<div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
            <div key={i} className="h-18 w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-[20px]"/>))}
    </div>);
}

function ArrivalList({
                         loading,
                         isValidating,
                         error,
                         arrivalData,
                         currentRouteName,
                         onRouteChange,
                         onRefresh,
                     }: {
    loading: boolean;
    isValidating: boolean;
    error: string | null;
    arrivalData: BusStopArrival[];
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
                className="py-8 px-4 bg-gray-50 dark:bg-white/5 rounded-[20px] border border-gray-100 dark:border-white/10 flex flex-col items-center">
                <div
                    className="mx-auto w-10 h-10 bg-gray-200 dark:bg-gray-800 text-gray-400 rounded-full flex items-center justify-center mb-2.5">
                    <Bus className="w-5 h-5"/>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 font-semibold">{UI_TEXT.BUS_LIST.NO_RUNNING_DESC}</p>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-white/10 text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-black/8 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/15 transition cursor-pointer active:scale-95"
                >
                    <RefreshCw className={`w-3 h-3 ${isValidating ? "animate-spin text-blue-500" : ""}`}/>
                    <span>도착정보 새로고침</span>
                </button>
            </div>
        </div>);
    }

    return (<div className="max-h-80 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-2">
        {arrivalData.map((bus, idx) => {
            const rName = String(bus.routeno ?? "").trim();
            const isCurrentRoute = Boolean(currentRouteName && rName === currentRouteName);
            return (
                <ArrivalItem
                    key={`${bus.routeno}-${idx}`}
                    bus={bus}
                    isCurrentRoute={isCurrentRoute}
                    onRouteChange={onRouteChange}
                />
            );
        })}
    </div>);
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
    const {data: arrivalRawData, loading, isValidating, error, refresh} = useBusArrivalInfo(stopId, cityCode);

    const sortedArrivalData = useMemo(() => {
        if (!arrivalRawData) return [];
        return [...arrivalRawData].sort((a, b) => {
            const aIsCurrent = currentRouteName && String(a.routeno ?? "").trim() === currentRouteName ? 1 : 0;
            const bIsCurrent = currentRouteName && String(b.routeno ?? "").trim() === currentRouteName ? 1 : 0;
            if (aIsCurrent !== bIsCurrent) return bIsCurrent - aIsCurrent;
            return a.arrtime - b.arrtime;
        });
    }, [arrivalRawData, currentRouteName]);

    return (<div className="w-full min-w-65 sm:min-w-[320px] bg-transparent overflow-hidden">
        <ArrivalList
            loading={loading}
            isValidating={isValidating}
            error={error}
            arrivalData={sortedArrivalData}
            currentRouteName={currentRouteName}
            onRouteChange={onRouteChange}
            onRefresh={refresh}
        />
    </div>);
}
