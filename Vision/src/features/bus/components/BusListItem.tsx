import React from "react";
import { ArrowDown, ArrowUp, HelpCircle } from "lucide-react";

import PopupMarquee from "@shared/ui/MarqueeText";

import { UI_TEXT } from "@core/config/locale";

import type { BusItem } from "@core/domain";
import type { DirectionCode } from "@bus/hooks/useBusDirection";

type BusListItemProps = {
    bus: BusItem;
    routeName: string;
    getDirection: (nodeId: string | null | undefined, nodeOrd: number, routeId?: string | null) => DirectionCode;
    onClick: (lat: number, lng: number) => void;
};

export const BusListItem = React.memo(({ bus, routeName, getDirection, onClick }: BusListItemProps) => {
    const direction = bus.nodeid && bus.nodeord !== undefined
        ? getDirection(bus.nodeid, bus.nodeord, bus.routeid)
        : null;

    const stopName = bus.nodenm || "";
    const iconProps = {
        className: "w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500",
        "aria-hidden": true as const,
    };
    const directionIcon = direction === 1
        ? <ArrowUp {...iconProps} />
        : direction === 0
            ? <ArrowDown {...iconProps} />
            : <HelpCircle {...iconProps} />;

    return (
        <li>
            <button
                type="button"
                className="flex w-full justify-between items-center py-3 px-3 cursor-pointer bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 rounded-2xl group active:scale-[0.98] text-left border border-transparent"
                onClick={() => onClick(bus.gpslati, bus.gpslong)}
                aria-label={`${bus.vehicleno} ${UI_TEXT.BUS_ITEM.CURRENT_LOC} ${stopName}`}
            >
                <div className="flex flex-col gap-1 shrink-0 min-w-fit mr-2">
                    <span
                        className="font-bold text-base text-gray-900 dark:text-white transition-colors whitespace-nowrap">
                        {bus.vehicleno}
                    </span>
                    <span
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-full px-2 py-0.5 inline-block w-fit">
                        {routeName}
                    </span>
                </div>

                <div
                    className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 text-right min-w-0 flex-1 justify-end">
                    <div className="text-xs font-medium max-w-[80px]">
                        <PopupMarquee text={stopName} maxLength={8} />
                    </div>
                    {directionIcon}
                </div>
            </button>
        </li>
    );
});

BusListItem.displayName = 'BusListItem';
