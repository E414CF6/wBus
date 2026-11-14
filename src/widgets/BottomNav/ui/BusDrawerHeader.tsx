import React from "react";
import {Bus, RefreshCw, X} from "lucide-react";

interface BusDrawerHeaderProps {
    selectedRoute: string;
    routeSubInfo: string;
    runningBusCount: number;
    isConnecting: boolean;
    timeAgo: string;
    isRefreshing: boolean;
    hasBottomSplit: boolean;
    metaThemeMainColor?: string;
    metaThemeBg?: string;
    metaThemeText?: string;
    metaThemeShadow?: string;
    onRefresh: () => void;
    onClose: () => void;
}

export const BusDrawerHeader: React.FC<BusDrawerHeaderProps> = ({
                                                                    selectedRoute,
                                                                    routeSubInfo,
                                                                    runningBusCount,
                                                                    isConnecting,
                                                                    timeAgo,
                                                                    isRefreshing,
                                                                    hasBottomSplit,
                                                                    metaThemeMainColor: _metaThemeMainColor = "#2563eb",
                                                                    metaThemeBg = "bg-blue-600 dark:bg-blue-500",
                                                                    metaThemeText = "text-blue-600 dark:text-blue-400",
                                                                    metaThemeShadow = "shadow-blue-600/25",
                                                                    onRefresh,
                                                                    onClose,
                                                                }) => {
    return (
        <div className="flex items-center justify-between px-4 sm:px-5 pt-2 pb-2.5 lg:pt-4 lg:pb-3 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div
                    className={`flex items-center justify-center rounded-xl lg:rounded-2xl text-white shadow-sm transition-all duration-200 shrink-0 ${metaThemeBg} ${metaThemeShadow} ${
                        hasBottomSplit ? "w-9 h-9" : "w-9 h-9 lg:w-11 lg:h-11"
                    }`}
                >
                    <Bus className={hasBottomSplit ? "w-4.5 h-4.5" : "w-4.5 h-4.5 lg:w-5 lg:h-5"}/>
                </div>
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2
                            className={`font-black text-slate-900 dark:text-white tracking-tight leading-none transition-all duration-200 ${
                                hasBottomSplit ? "text-lg sm:text-xl" : "text-lg sm:text-xl lg:text-2xl"
                            }`}
                        >
                            {selectedRoute}
                        </h2>
                        <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-white/[0.08] ${metaThemeText}`}
                        >
                            {!isConnecting && runningBusCount > 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"/>
                            )}
                            <span>
                                {isConnecting ? "연결 중..." : `실시간 ${runningBusCount}대`}
                            </span>
                        </span>
                        {timeAgo && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                {timeAgo}
                            </span>
                        )}
                    </div>
                    <p
                        className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[245px] sm:max-w-[300px] mt-0.5"
                        title={routeSubInfo}
                    >
                        {routeSubInfo}
                    </p>
                </div>
            </div>

            {/* Right Top Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                    type="button"
                    onClick={onRefresh}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/[0.14] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer active:scale-90"
                    title="실시간 위치 새로고침"
                    aria-label="실시간 위치 새로고침"
                >
                    <RefreshCw
                        className={`w-3.5 h-3.5 ${isRefreshing ? `animate-spin ${metaThemeText}` : ""}`}
                    />
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/[0.14] flex lg:hidden items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer active:scale-90"
                    title="닫기"
                    aria-label="닫기"
                >
                    <X className="w-4 h-4"/>
                </button>
            </div>
        </div>
    );
};
