import { useMemo } from "react";
import { AlertTriangle, Bus, ChevronRight, Clock, MapPin } from "lucide-react";

import { UI_TEXT } from "@core/config/locale";

import { useBusArrivalInfo } from "@bus/hooks/useBusArrivalInfo";

import { formatVehicleType, secondsToMinutes } from "@shared/utils/formatters";

import type { BusStopArrival } from "@core/domain";

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
    onRouteChange
}: {
    bus: BusStopArrival;
    onRouteChange?: (name: string) => void
}) {
    const minutes = secondsToMinutes(bus.arrtime);
    const theme = getStatusTheme(minutes);
    const routeName = String(bus.routeno ?? "").trim();

    return (
        <button
            onClick={() => onRouteChange?.(routeName)}
            className={`w-full group relative flex items-center justify-between p-3 rounded-[20px] border transition-all duration-200 
                ${theme.bg} ${theme.border} hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.98]`}
        >
            <div className="flex flex-col items-start gap-1.5 overflow-hidden">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${theme.badge}`}>
                        {routeName}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 truncate tracking-tight">
                        {formatVehicleType(bus.vehicletp)}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <MapPin className="w-3 h-3 opacity-70" />
                    <span className="text-[11px] font-medium">
                        {bus.arrprevstationcnt === 0 ? UI_TEXT.BUS_ITEM.ARRIVING_SOON : UI_TEXT.BUS_ITEM.STOPS_LEFT(bus.arrprevstationcnt)}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-end shrink-0">
                <div className={`flex items-center gap-1 font-bold ${theme.text}`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-lg leading-none tracking-tight">
                        {minutes === 0 ? UI_TEXT.BUS_ITEM.ARRIVING_SOON : `${minutes}${UI_TEXT.TIME.MINUTE_SUFFIX}`}
                    </span>
                </div>
                <div
                    className="flex items-center text-[10px] text-gray-400 font-semibold group-hover:text-blue-500 transition-colors mt-1.5">
                    {UI_TEXT.BUS_ITEM.SHOW_ROUTE} <ChevronRight className="w-3 h-3 ml-0.5 opacity-70" />
                </div>
            </div>
        </button>
    );
}

function LoadingSkeleton() {
    return (
        <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-[20px]" />
            ))}
        </div>
    );
}

function ArrivalList({
    loading,
    error,
    arrivalData,
    onRouteChange,
}: {
    loading: boolean;
    error: string | null;
    arrivalData: BusStopArrival[];
    onRouteChange?: (routeName: string) => void;
}) {
    if (error) {
        return (
            <div className="p-4">
                <div
                    className="flex flex-col items-center gap-2 p-6 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/20 text-center">
                    <div className="p-2 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-full">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-400 font-semibold mt-1">{error}</p>
                </div>
            </div>
        );
    }

    if (loading && arrivalData.length === 0) return <LoadingSkeleton />;

    if (!loading && arrivalData.length === 0) {
        return (
            <div className="p-4 text-center">
                <div className="py-10 bg-gray-50 dark:bg-white/5 rounded-[24px] border border-gray-100 dark:border-white/10">
                    <div className="mx-auto w-10 h-10 bg-gray-200 dark:bg-gray-800 text-gray-400 rounded-full flex items-center justify-center mb-3">
                        <Bus className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-semibold">{UI_TEXT.BUS_LIST.NO_RUNNING_DESC}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-2">
            {arrivalData.map((bus, idx) => (
                <ArrivalItem key={`${bus.routeno}-${idx}`} bus={bus} onRouteChange={onRouteChange} />
            ))}
        </div>
    );
}

export default function BusStopPopup({
    stopId,
    onRouteChange,
}: {
    stopId: string;
    onRouteChange?: (routeName: string) => void;
}) {
    const { data: arrivalRawData, loading, error } = useBusArrivalInfo(stopId);

    const sortedArrivalData = useMemo(() => {
        return arrivalRawData
            ? [...arrivalRawData].sort((a, b) => a.arrtime - b.arrtime)
            : [];
    }, [arrivalRawData]);

    return (
        <div className="w-full min-w-[260px] sm:min-w-[320px] bg-white dark:bg-black rounded-[24px] overflow-hidden">
            <ArrivalList
                loading={loading}
                error={error}
                arrivalData={sortedArrivalData}
                onRouteChange={onRouteChange}
            />
        </div>
    );
}
