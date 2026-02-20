import React from "react";
import { ArrowDown, ArrowUp, HelpCircle } from "lucide-react";

import PopupMarquee from "@shared/ui/MarqueeText";
import Pill from "@shared/ui/Pill";

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
        className: "w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-colors group-hover:text-gray-600 dark:group-hover:text-gray-300",
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
                className="flex w-full justify-between items-center py-3 px-4 cursor-pointer bg-transparent hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all duration-200 rounded-2xl group active:scale-[0.98] text-left border border-transparent"
                onClick={() => onClick(bus.gpslati, bus.gpslong)}
                aria-label={`${bus.vehicleno} ${UI_TEXT.BUS_ITEM.CURRENT_LOC} ${stopName}`}
            >
                <div className="flex flex-col gap-1.5 shrink-0 min-w-fit mr-4">
                    <span
                        className="font-bold text-base text-gray-900 dark:text-gray-100 transition-colors whitespace-nowrap leading-none">
                        {bus.vehicleno}
                    </span>
                    <Pill tone="soft" size="sm" className="w-fit !text-[10px] !px-1.5 !py-0">
                        {routeName}
                    </Pill>
                </div>

                <div
                    className="flex items-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 text-right min-w-0 flex-1 justify-end transition-colors">
                    <div className="text-[13px] font-medium max-w-[100px]">
                        <PopupMarquee text={stopName} maxLength={10} />
                    </div>
                    <div className="shrink-0">
                        {directionIcon}
                    </div>
                </div>
            </button>
        </li>
    );
});

BusListItem.displayName = 'BusListItem';
