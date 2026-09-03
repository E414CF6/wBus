import type {ShuttleInboundItem, ShuttleOutboundItem, ShuttleViaStop,} from "@/data/yonseiShuttleSchedule";
import type {BusRoute} from "@shared/types/bus";

export type YonseiShuttleItem = ShuttleInboundItem | ShuttleOutboundItem;
export type {ShuttleViaStop};

export interface MinuteItem {
    seq: number;
    destDepTime: string;
    minuteStr: string;
    type: string;
    notes: string;
    footnoteSymbol?: string;
    footnoteNumber?: number;
    isNextBus: boolean;
}

export interface HourlyRow {
    hourStr: string;
    displayHour: string;
    isCurrentHour: boolean;
    weekdayMinutes: MinuteItem[];
    vacationMinutes: MinuteItem[];
}

export interface SelectedFootnoteInfo {
    num: number;
    symbol: string;
    noteText: string;
    count: number;
}

export interface YonseiRouteDetailModalProps {
    route: BusRoute | null;
    allYonseiRoutes?: BusRoute[];
    onClose: () => void;
    isBookmarked?: boolean;
    onToggleBookmark?: (routeId: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
    currentTime?: Date;
}

export type ShuttleTab = "inbound" | "outbound" | "stops" | "guidelines";
export type DayFilter = "ALL" | "WEEKDAY" | "SUNDAY";

export interface YonseiShuttleModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: ShuttleTab;
    currentTime?: Date;
}
