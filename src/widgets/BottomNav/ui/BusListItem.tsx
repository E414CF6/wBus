import React from "react";
import {ArrowDown, ArrowUp, HelpCircle} from "lucide-react";

import type {BusItem} from "@entities/bus/types";
import type {DirectionCode} from "@entities/route/types";

import {UI_TEXT} from "@shared/config/locale";

type BusListItemProps = {
    bus: BusItem;
    routeName: string;
    getDirection: (nodeId: string | null | undefined, nodeOrd: number, routeId?: string | null) => DirectionCode;
    onClick: (lat: number, lng: number) => void;
};

export const BusListItem = React.memo(({bus, routeName, getDirection, onClick}: BusListItemProps) => {
    const direction = bus.nodeid && bus.nodeord !== undefined ? getDirection(bus.nodeid, bus.nodeord, bus.routeid) : null;
    const isUp = direction === 1;
    const isDown = direction === 0;

    const stopName = bus.nodenm || "";

    return (
        <li>
            <button
                type="button"
                className="flex w-full justify-between items-center py-3.5 px-4 cursor-pointer bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-all duration-200 rounded-[20px] group active:scale-[0.98] text-left border border-transparent hover:border-black/[0.04] dark:hover:border-white/[0.06]"
                onClick={() => onClick(bus.gpslati, bus.gpslong)}
                aria-label={`${bus.vehicleno} ${UI_TEXT.BUS_ITEM.CURRENT_LOC} ${stopName}`}
            >
                <div className="flex flex-col gap-1.5 shrink-0 min-w-fit mr-4">
                    <span
                        className="font-extrabold text-[17px] text-gray-900 dark:text-gray-100 group-hover:text-black dark:group-hover:text-white transition-colors whitespace-nowrap leading-none tracking-tight">
                        {bus.vehicleno}
                    </span>
                    <span
                        className={`w-fit text-[10px] font-extrabold px-2 py-0.5 rounded-full border transition-colors ${
                            isUp
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25"
                                : isDown
                                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25"
                                    : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25"
                        }`}
                    >
                        {routeName}번
                    </span>
                </div>

                <div
                    className="flex items-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white text-right min-w-0 flex-1 justify-end transition-colors">
                    <span className="text-[13px] font-medium truncate min-w-0" title={stopName}>
                        {stopName}
                    </span>
                    <div className="shrink-0">
                        {isUp ? (
                            <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                                <ArrowUp className="w-3 h-3" strokeWidth={2.5}/>
                                <span>상행</span>
                            </span>
                        ) : isDown ? (
                            <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300">
                                <ArrowDown className="w-3 h-3" strokeWidth={2.5}/>
                                <span>하행</span>
                            </span>
                        ) : (
                            <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                                <HelpCircle className="w-3 h-3"/>
                            </span>
                        )}
                    </div>
                </div>
            </button>
        </li>
    );
});

BusListItem.displayName = "BusListItem";
