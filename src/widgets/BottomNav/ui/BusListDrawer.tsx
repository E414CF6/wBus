"use client";

import React from "react";
import {Bus, Loader2, X} from "lucide-react";
import {UI_TEXT} from "@shared/config/locale";
import type {BusItem} from "@entities/bus/types";
import type {DirectionCode} from "@entities/route/types";
import {BusListItem} from "./BusListItem";

interface BusListDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedRoute: string;
    runningBuses: BusItem[];
    isConnecting: boolean;
    getDirection?: (nodeId: string | null | undefined, nodeOrd: number, routeId?: string | null) => DirectionCode;
    onBusClick: (lat: number, lng: number) => void;
}

export const BusListDrawer: React.FC<BusListDrawerProps> = ({
                                                                isOpen,
                                                                onClose,
                                                                selectedRoute,
                                                                runningBuses,
                                                                isConnecting,
                                                                getDirection,
                                                                onBusClick,
                                                            }) => {
    if (!isOpen) return null;

    return (
        <div
            className="w-full max-w-sm backdrop-blur-2xl bg-white/90 dark:bg-[#121212]/90 border border-black/10 dark:border-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.7)] rounded-[28px] overflow-hidden transition-all duration-300 animate-fadeIn">
            <div
                className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="flex items-center space-x-2">
                    <div
                        className="flex items-center justify-center w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Bus className="w-4 h-4"/>
                    </div>
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {isConnecting
                            ? `${selectedRoute}번 실시간 연결 중`
                            : runningBuses.length > 0
                                ? UI_TEXT.BOTTOM_NAV.RUNNING_LIST_TITLE(selectedRoute, runningBuses.length)
                                : `${selectedRoute}번 운행 종료 (0대)`}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4"/>
                </button>
            </div>

            <ul className="text-xs sm:text-sm text-black dark:text-white max-h-[35svh] overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                {isConnecting ? (
                    <li className="flex flex-col items-center justify-center py-8 text-amber-600 dark:text-amber-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin"/>
                        <span className="text-xs font-semibold">
                            실시간 위치 정보를 확인하고 있습니다...
                        </span>
                    </li>
                ) : runningBuses.length === 0 ? (
                    <li className="text-center py-7 text-slate-500 dark:text-slate-400 text-xs font-medium space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                            현재 운행 중인 버스가 없습니다.
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            운행 종료 시간대이거나 차고지 배차 대기 중입니다.
                        </p>
                    </li>
                ) : (
                    runningBuses.map((bus) => (
                        <BusListItem
                            key={`${selectedRoute}-${bus.vehicleno}`}
                            bus={bus}
                            routeName={selectedRoute}
                            getDirection={getDirection || (() => 0)}
                            onClick={(lat, lng) => onBusClick(lat, lng)}
                        />
                    ))
                )}
            </ul>
        </div>
    );
};
