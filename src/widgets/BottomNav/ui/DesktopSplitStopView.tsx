import React from "react";
import {ArrowLeftRight, Info, MapPin, MapPinned, Star, X} from "lucide-react";
import type {BusStop} from "@entities/station/types";
import {BusStopPopup} from "@entities/station";
import type {MapRef} from "react-map-gl/maplibre";

interface DesktopSplitStopViewProps {
    selectedStop: BusStop;
    isSelectedStopRouteStop: boolean;
    pairedOppositeStop?: BusStop | null;
    isFavoriteStop: (nodeid: string) => boolean;
    toggleFavoriteStop: (stop: BusStop) => void;
    onClose: () => void;
    onSelectStop: (stop: BusStop) => void;
    metaThemeMainColor?: string;
    metaThemeTextColor?: string;
    cityName?: string;
    selectedRoute: string;
    currentCityCode: string;
    onRouteChange?: (routeName: string) => void;
    map?: MapRef | null;
}

export const DesktopSplitStopView: React.FC<DesktopSplitStopViewProps> = ({
    selectedStop,
    isSelectedStopRouteStop,
    pairedOppositeStop,
    isFavoriteStop,
    toggleFavoriteStop,
    onClose,
    onSelectStop,
    metaThemeMainColor = "#2563eb",
    metaThemeTextColor = "text-blue-500 dark:text-blue-400",
    cityName,
    selectedRoute,
    currentCityCode,
    onRouteChange,
    map,
}) => {
    return (
        <div className="w-full flex-[48] h-[48%] min-h-[260px] border-t border-slate-200/80 dark:border-white/10 flex flex-col overflow-hidden bg-white dark:bg-[#11131a] animate-fadeIn select-none">
            <div className="w-full h-full flex flex-col overflow-hidden">
                {/* Stop Header */}
                <div className="flex items-start justify-between px-4 py-3 border-b border-slate-200/80 dark:border-white/10 shrink-0 bg-slate-50/70 dark:bg-white/[0.03]">
                    <div className="flex items-start gap-3 min-w-0">
                        <div
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                            style={{
                                backgroundColor: isSelectedStopRouteStop
                                    ? metaThemeMainColor
                                    : isFavoriteStop(selectedStop.nodeid)
                                    ? "#f59e0b"
                                    : "#475569",
                            }}
                        >
                            {isSelectedStopRouteStop ? (
                                <MapPinned size={18} strokeWidth={2.5} />
                            ) : (
                                <MapPin size={18} strokeWidth={2.5} />
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                    className="px-1.5 py-0.2 rounded-md text-[9px] font-black text-white"
                                    style={{
                                        backgroundColor: isSelectedStopRouteStop ? metaThemeMainColor : "#64748b",
                                    }}
                                >
                                    {isSelectedStopRouteStop ? "현재 노선" : "주변 정류장"}
                                </span>
                                {cityName && (
                                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                                        {cityName}
                                    </span>
                                )}
                            </div>
                            <h3
                                className="truncate text-lg font-black text-slate-900 dark:text-white mt-0.5 leading-tight"
                                title={selectedStop.nodenm}
                            >
                                {selectedStop.nodenm}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 text-slate-500 dark:text-slate-400 text-xs">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    ID
                                </span>
                                <span className="font-mono font-bold text-[11px]">
                                    {selectedStop.nodeno || "미부여"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons: Favorite & Close Pane */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                            type="button"
                            onClick={() => toggleFavoriteStop(selectedStop)}
                            className={`p-1.5 rounded-full border transition cursor-pointer active:scale-90 ${
                                isFavoriteStop(selectedStop.nodeid)
                                    ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                                    : "bg-slate-100 dark:bg-white/10 border-transparent text-slate-400 hover:text-amber-500"
                            }`}
                            title={isFavoriteStop(selectedStop.nodeid) ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                            aria-label="즐겨찾기"
                        >
                            <Star
                                className={`w-3.5 h-3.5 ${isFavoriteStop(selectedStop.nodeid) ? "fill-amber-400" : ""}`}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/15 transition cursor-pointer active:scale-90"
                            title="정류장 정보 닫기 (분할 해제)"
                            aria-label="정류장 정보 닫기"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Paired Opposite Stop Switcher */}
                {pairedOppositeStop && (
                    <div className="px-4 py-1.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                onSelectStop(pairedOppositeStop);
                                if (map && pairedOppositeStop.gpslong && pairedOppositeStop.gpslati) {
                                    map.flyTo({
                                        center: [pairedOppositeStop.gpslong, pairedOppositeStop.gpslati],
                                        duration: 400,
                                    });
                                }
                            }}
                            className="w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold border border-black/5 dark:border-white/10 transition-all cursor-pointer active:scale-98 group/opp"
                            title={`건너편 정류장(${pairedOppositeStop.nodenm}) 실시간 정보 보기`}
                        >
                            <div className="flex items-center gap-1.5 min-w-0">
                                <ArrowLeftRight className={`w-3.5 h-3.5 ${metaThemeTextColor} shrink-0`} />
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
                            <span
                                className={`text-[10px] font-black ${metaThemeTextColor} shrink-0 group-hover/opp:translate-x-0.5 transition-transform`}
                            >
                                전환 →
                            </span>
                        </button>
                    </div>
                )}

                {/* Live Arrivals Body */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
                    <BusStopPopup
                        stopId={selectedStop.nodeid}
                        cityCode={currentCityCode}
                        currentRouteName={selectedRoute}
                        onRouteChange={onRouteChange}
                    />
                </div>

                {/* Footer Info Note */}
                <div className="px-4 py-2 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-200/80 dark:border-white/10 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>실시간 버스 도착 정보는 정류장 기준 30초 주기로 갱신됩니다</span>
                </div>
            </div>
        </div>
    );
};
