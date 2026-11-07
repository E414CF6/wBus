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
    metaThemeMainColor = "#2563eb",
    metaThemeBg = "bg-blue-600 dark:bg-blue-500",
    metaThemeText = "text-blue-600 dark:text-blue-400",
    metaThemeShadow = "shadow-blue-600/25",
    onRefresh,
    onClose,
}) => {
    return (
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className={`flex items-center justify-center rounded-2xl text-white shadow-md transition-all duration-200 shrink-0 ${metaThemeBg} ${metaThemeShadow} ${
                        hasBottomSplit ? "w-10 h-10" : "w-12 h-12"
                    }`}
                >
                    <Bus className={hasBottomSplit ? "w-5 h-5" : "w-6 h-6"} />
                </div>
                <div className="flex flex-col min-w-0">
                    <h2
                        className={`font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5 transition-all duration-200 ${
                            hasBottomSplit ? "text-xl sm:text-2xl" : "text-3xl"
                        }`}
                    >
                        {selectedRoute}
                    </h2>
                    <p
                        className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[210px] sm:max-w-[260px] mt-1"
                        title={routeSubInfo}
                    >
                        {routeSubInfo}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                        <span className={`font-bold ${metaThemeText}`}>
                            {isConnecting ? "실시간 연결 중..." : `실시간 ${runningBusCount}대 운행중`}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 font-medium">{timeAgo}</span>
                    </div>
                </div>
            </div>

            {/* Right Top Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 ml-2">
                <button
                    type="button"
                    onClick={onRefresh}
                    className="w-8 h-8 rounded-full border border-slate-200/80 dark:border-white/15 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/15 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer active:scale-90"
                    title="실시간 위치 새로고침"
                    aria-label="실시간 위치 새로고침"
                >
                    <RefreshCw
                        className={`w-4 h-4 ${isRefreshing ? `animate-spin ${metaThemeText}` : ""}`}
                    />
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-full border border-slate-200/80 dark:border-white/15 bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/15 flex md:hidden items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer active:scale-90"
                    title="닫기"
                    aria-label="닫기"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
