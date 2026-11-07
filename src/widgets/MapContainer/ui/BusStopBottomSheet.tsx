import React from "react";
import {createPortal} from "react-dom";
import {ArrowLeftRight, BusFront, Info, MapPin, MapPinned, Star, X} from "lucide-react";
import type {BusStop} from "@entities/station/types";
import {BusStopPopup} from "@entities/station";
import {UI_TEXT} from "@shared/config/locale";

export interface BusStopBottomSheetProps {
    isOpen: boolean;
    stop: BusStop;
    cityCode: string;
    currentRouteName: string;
    isRouteStop: boolean;
    isFavorite: boolean;
    color: string;
    pairedOppositeStop?: BusStop | null;
    onToggleFavorite?: (stop: BusStop) => void;
    onSelectOppositeStop?: (stop: BusStop) => void;
    onSelectRoute: (route: string) => void;
    onClose: () => void;
}

export const BusStopBottomSheet: React.FC<BusStopBottomSheetProps> = ({
    isOpen,
    stop,
    cityCode,
    currentRouteName,
    isRouteStop,
    isFavorite,
    color,
    pairedOppositeStop,
    onToggleFavorite,
    onSelectOppositeStop,
    onSelectRoute,
    onClose,
}) => {
    if (typeof document === "undefined" || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[120] flex flex-col justify-end items-center pb-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] pointer-events-none px-3">
            {/* Click-outside backdrop */}
            <div
                className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-[1px] transition-opacity animate-fadeIn pointer-events-auto"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Floating Bus Stop Bottom Sheet */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`${stop.nodenm} 정류장 실시간 도착 정보`}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 pointer-events-auto flex flex-col bg-white dark:bg-[#11131a] backdrop-blur-3xl overflow-hidden rounded-[28px] shadow-[0_16px_48px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] border border-black/10 dark:border-white/12 w-full max-w-md max-h-[70vh] animate-fadeIn select-none"
            >
                {/* Mobile Drawer Handle Indicator */}
                <div className="pt-2 pb-0.5 flex justify-center shrink-0">
                    <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                </div>

                {/* Header Section */}
                <div className="relative overflow-hidden bg-transparent px-5 py-4 text-black dark:text-white border-b border-black/5 dark:border-white/5 shrink-0">
                    <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                        <BusFront size={100} strokeWidth={1} />
                    </div>

                    <div className="relative z-10 flex flex-col gap-2.5">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 min-w-0">
                                <div
                                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                                    style={{
                                        backgroundColor: isRouteStop ? color : isFavorite ? "#f59e0b" : "#475569",
                                    }}
                                >
                                    {isRouteStop ? (
                                        <MapPinned size={18} strokeWidth={2.5} />
                                    ) : (
                                        <MapPin size={18} strokeWidth={2.5} />
                                    )}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h3 className="truncate text-base sm:text-lg font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                                            {stop.nodenm}
                                        </h3>
                                        <span
                                            className="px-1.5 py-0.2 rounded-md text-[9px] font-black text-white"
                                            style={{
                                                backgroundColor: isRouteStop ? color : "#64748b",
                                            }}
                                        >
                                            {isRouteStop ? "현재 노선" : "주변 정류장"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1 text-gray-500 dark:text-gray-400">
                                        <span className="text-[10px] font-bold uppercase tracking-widest">
                                            {UI_TEXT.STOP_POPUP.STATION_ID_LABEL}
                                        </span>
                                        <span className="text-[11px] font-mono font-semibold">
                                            {stop.nodeno || UI_TEXT.STOP_POPUP.STATION_ID_FALLBACK}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {onToggleFavorite && (
                                    <button
                                        type="button"
                                        onClick={() => onToggleFavorite(stop)}
                                        className={`p-1.5 rounded-full border transition cursor-pointer active:scale-90 ${
                                            isFavorite
                                                ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                                                : "bg-slate-100 dark:bg-white/10 border-transparent text-slate-400 hover:text-amber-500"
                                        }`}
                                        title={isFavorite ? "즐겨찾는 정류장 해제" : "즐겨찾는 정류장 등록"}
                                        aria-label={isFavorite ? "즐겨찾는 정류장 해제" : "즐겨찾는 정류장 등록"}
                                    >
                                        <Star className={`w-3.5 h-3.5 ${isFavorite ? "fill-amber-400" : ""}`} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/15 transition cursor-pointer active:scale-90"
                                    title="팝업 닫기"
                                    aria-label="정류장 팝업 닫기"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Paired Opposite Stop Quick-Switcher Banner */}
                        {pairedOppositeStop && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onSelectOppositeStop?.(pairedOppositeStop);
                                }}
                                className="mt-1 inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold border border-black/5 dark:border-white/10 transition-all cursor-pointer active:scale-98 group/opp"
                                title={`건너편 정류장(${pairedOppositeStop.nodenm}) 실시간 정보 보기`}
                            >
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">건너편</span>
                                    <span className="font-extrabold truncate text-slate-900 dark:text-white">
                                        {pairedOppositeStop.nodenm}
                                    </span>
                                    {pairedOppositeStop.nodeno && (
                                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                            ({pairedOppositeStop.nodeno})
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 shrink-0 group-hover/opp:translate-x-0.5 transition-transform">
                                    전환 →
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Body Section: Real-time Bus Arrivals at this Stop */}
                <div className="relative flex-1 min-h-30 overflow-y-auto custom-scrollbar bg-transparent">
                    <BusStopPopup
                        stopId={stop.nodeid}
                        cityCode={cityCode}
                        currentRouteName={currentRouteName}
                        onRouteChange={onSelectRoute}
                    />
                </div>

                {/* Footer Section */}
                <div className="flex items-center justify-center border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 py-2.5 px-4 shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                        <Info size={14} />
                        <span>{UI_TEXT.BUS_ITEM.CLICK_ROUTE_FOR_INFO}</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
