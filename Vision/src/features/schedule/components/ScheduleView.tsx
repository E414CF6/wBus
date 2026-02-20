"use client";

import { memo, useEffect, useMemo, useState } from "react";

import { DAY_TYPES, DayType } from "@core/config/env";
import { DAY_LABELS, UI_TEXT } from "@core/config/locale";

import { getCurrentDayType } from "@schedule/utils/time";

import type { BusSchedule, RowItem } from "@core/domain";

// ----------------------------------------------------------------------
// Types & Helpers
// ----------------------------------------------------------------------

interface NextBusInfo {
    hour: string;
    minute: string;
    timeUntil: { minutes: number; seconds: number } | null;
}

/**
 * Maps internal day type constants to localized UI labels.
 */
const dayTypeToLabel = {
    [DAY_TYPES.WEEKDAY]: DAY_LABELS.WEEKDAY,
    [DAY_TYPES.WEEKEND]: DAY_LABELS.WEEKEND,
} as const;

/**
 * Returns the localized label for specific featured stop keys.
 */
function getFeaturedStopsLabel(key: string): string {
    if (key === 'general') return '';
    if (key === 'weekday') return DAY_LABELS.WEEKDAY;
    if (key === 'sunday') return DAY_LABELS.SUNDAY;
    return key;
}

/**
 * Pure function to calculate the very next bus based on current time.
 */
function findNextBus(
    schedule: Record<string, Record<string, RowItem[]>>,
    hours: string[],
    direction: string,
    now: Date
): NextBusInfo | null {
    const currentHour = now.getHours().toString().padStart(2, "0");
    const currentMinute = now.getMinutes();

    for (const hour of hours) {
        const buses = schedule[hour]?.[direction];
        if (!buses?.length) continue;

        const hourNum = parseInt(hour, 10);
        const currentHourNum = parseInt(currentHour, 10);

        // Skip past hours
        if (hourNum < currentHourNum) continue;

        for (const bus of buses) {
            const busMinute = parseInt(bus.minute, 10);

            // If it's the current hour, skip past minutes
            if (hourNum === currentHourNum && busMinute < currentMinute) continue;

            // Calculate exact time difference
            const busTime = new Date(now);
            busTime.setHours(hourNum, busMinute, 0, 0);

            const diff = busTime.getTime() - now.getTime();
            if (diff < 0) continue;

            return {
                hour,
                minute: bus.minute,
                timeUntil: {
                    minutes: Math.floor(diff / 60000),
                    seconds: Math.floor((diff % 60000) / 1000),
                },
            };
        }
    }

    return null;
}

// ----------------------------------------------------------------------
// Custom Hook
// ----------------------------------------------------------------------

function useScheduleLogic(data: BusSchedule) {
    const isGeneralSchedule = !!data.schedule.general;

    // State
    const [dayType, setDayType] = useState<DayType>(() => getCurrentDayType());
    const [direction, setDirection] = useState(data.directions[0]);
    const [now, setNow] = useState(() => new Date());

    // Effect: Update time every second to keep "Next Bus" info accurate
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const resolvedDirection = useMemo(() => {
        if (data.directions.includes(direction)) return direction;
        return data.directions[0];
    }, [data.directions, direction]);

    // Derived State: Current active schedule based on day type
    const activeSchedule = useMemo(
        () => (isGeneralSchedule ? data.schedule.general! : data.schedule[dayType]!),
        [data.schedule, dayType, isGeneralSchedule]
    );

    // Derived State: Sorted list of hours
    const hours = useMemo(
        () => Object.keys(activeSchedule).sort(),
        [activeSchedule]
    );

    // Derived State: Next bus info
    const nextBus = useMemo(
        () => findNextBus(activeSchedule, hours, resolvedDirection, now),
        [activeSchedule, hours, resolvedDirection, now]
    );

    // Determine which hour to highlight (Next bus hour OR current hour)
    const highlightedHour = nextBus?.hour ?? now.getHours().toString().padStart(2, "0");

    return {
        isGeneralSchedule,
        dayType,
        setDayType,
        direction: resolvedDirection,
        setDirection,
        activeSchedule,
        hours,
        nextBus,
        highlightedHour
    };
}

// ----------------------------------------------------------------------
// Sub-Components
// ----------------------------------------------------------------------

const RouteInfo = ({ details, featuredStops }: { details?: string[]; featuredStops?: Record<string, string[]> }) => {
    const featuredEntries = Object.entries(featuredStops ?? {})
        .map(([key, stops]) => [key, stops.filter((stop) => stop.trim().length > 0)] as const)
        .filter(([, stops]) => stops.length > 0);

    return (
        <div className="space-y-3">
            {details && details.length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-[20px] text-xs space-y-1.5">
                    {details.map((detail, i) => (
                        <p key={i} className="text-gray-600 dark:text-gray-300 font-medium">• {detail}</p>
                    ))}
                </div>
            )}

            {featuredEntries.length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-[20px] text-xs">
                    <p className="font-bold text-gray-800 dark:text-gray-200 mb-3">{UI_TEXT.SCHEDULE.MAJOR_STOPS}</p>
                    {featuredEntries.map(([key, stops]) => (
                        <div key={key} className="mb-3 last:mb-0">
                            <p className="text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">{getFeaturedStopsLabel(key)}</p>
                            <div className="flex flex-wrap gap-2">
                                {stops.map((stop, i) => (
                                    <span key={i}
                                        className="px-2.5 py-1 bg-white dark:bg-white/10 rounded-lg text-[11px] font-medium text-gray-700 dark:text-gray-200 shadow-sm border border-black/5 dark:border-white/5">
                                        {stop}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DayTypeSelector = ({ current, onChange }: { current: DayType; onChange: (t: DayType) => void }) => (
    <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-xl">
        {Object.values(DAY_TYPES).map((t) => (
            <button
                key={t}
                onClick={() => onChange(t)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${current === t ? "bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"
                    }`}
            >
                {dayTypeToLabel[t]}
            </button>
        ))}
    </div>
);

const DirectionSelector = ({
    directions,
    current,
    onChange,
    isCompact
}: {
    directions: string[];
    current: string;
    onChange: (d: string) => void;
    isCompact: boolean;
}) => (
    <div className={`flex gap-2 overflow-x-auto pb-1 custom-scrollbar ${isCompact ? "text-[11px]" : "text-xs"}`}>
        {directions.map((dir) => (
            <button
                key={dir}
                onClick={() => onChange(dir)}
                className={`${isCompact ? "px-3 py-1.5" : "px-4 py-2"
                    } rounded-full font-bold whitespace-nowrap transition-all duration-200 ${current === dir
                        ? "bg-black dark:bg-white text-white dark:text-black shadow-md"
                        : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300"
                    }`}
            >
                {dir}
            </button>
        ))}
    </div>
);

const NextBusStatus = ({
    hour,
    nextBus,
    scheduleItems
}: {
    hour: string;
    nextBus: NextBusInfo | null;
    scheduleItems?: RowItem[];
}) => (
    <div className="bg-blue-50 dark:bg-blue-500/10 rounded-[20px] overflow-hidden">
        <div className="grid grid-cols-[60px_1fr]">
            <div
                className="p-3 text-center border-r border-black/5 dark:border-white/5 font-mono font-bold flex flex-col items-center gap-1 text-blue-600 dark:text-blue-400 text-sm bg-blue-100/50 dark:bg-blue-500/20">
                <div>{hour}</div>
                {nextBus?.timeUntil && (
                    <div className="text-[10px] font-medium text-blue-500/80 dark:text-blue-400/80 tracking-tighter">
                        {nextBus.timeUntil.minutes}:{nextBus.timeUntil.seconds.toString().padStart(2, '0')}
                    </div>
                )}
            </div>
            <div className="p-3 flex flex-wrap gap-3 items-center">
                {scheduleItems?.map((item, i) => (
                    <span
                        key={i}
                        className={`text-sm ${nextBus && item.minute === nextBus.minute ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-100/50 dark:bg-blue-500/30 px-1.5 rounded-md -ml-1.5" : "font-medium text-gray-800 dark:text-gray-200"
                            }`}
                    >
                        {item.minute}
                        {item.noteId && <sup className="text-gray-400 ml-0.5">{item.noteId}</sup>}
                    </span>
                )) ?? <span className="text-gray-300"></span>}
            </div>
        </div>
    </div>
);

const TimetableGrid = ({
    hours,
    highlightedHour,
    nextBus,
    schedule,
    direction
}: {
    hours: string[];
    highlightedHour: string;
    nextBus: NextBusInfo | null;
    schedule: Record<string, Record<string, RowItem[]>>;
    direction: string;
}) => (
    <div className="bg-white dark:bg-white/5 rounded-[20px] border border-black/5 dark:border-white/10 overflow-hidden">
        {hours.map((hour) => {
            const isNow = hour === highlightedHour;
            return (
                <div
                    key={hour}
                    className={`grid grid-cols-[60px_1fr] border-b last:border-0 border-black/5 dark:border-white/5 ${isNow ? "bg-gray-50 dark:bg-white/5" : ""
                        }`}
                >
                    <div
                        className={`p-3 text-center border-r border-black/5 dark:border-white/5 font-mono font-bold flex flex-col items-center justify-center gap-1 text-xs ${isNow ? "text-black dark:text-white bg-gray-100 dark:bg-white/10" : "text-gray-400"
                            }`}
                    >
                        <div>{hour}</div>
                    </div>
                    <div className="p-3 flex flex-wrap gap-3 items-center">
                        {schedule[hour]?.[direction]?.map((item, i) => (
                            <span key={i} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {item.minute}
                                {item.noteId && <sup className="text-gray-400 ml-0.5">{item.noteId}</sup>}
                            </span>
                        )) ?? <span className="text-gray-300"></span>}
                    </div>
                </div>
            );
        })}
    </div>
);

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

function ScheduleView({ data, mode = "full" }: { data: BusSchedule; mode?: "full" | "compact" }) {
    const isCompact = mode === "compact";

    const {
        isGeneralSchedule,
        dayType,
        setDayType,
        direction,
        setDirection,
        activeSchedule,
        hours,
        nextBus,
        highlightedHour
    } = useScheduleLogic(data);

    return (
        <div className={isCompact ? "space-y-4" : "space-y-5"}>
            {!isCompact && (
                <RouteInfo details={data.routeDetails} featuredStops={data.featuredStops} />
            )}

            {!isCompact && !isGeneralSchedule && (
                <DayTypeSelector current={dayType} onChange={setDayType} />
            )}

            <DirectionSelector
                directions={data.directions}
                current={direction}
                onChange={setDirection}
                isCompact={isCompact}
            />

            {hours.includes(highlightedHour) && (
                <NextBusStatus
                    hour={highlightedHour}
                    nextBus={nextBus}
                    scheduleItems={activeSchedule[highlightedHour]?.[direction]}
                />
            )}

            {!isCompact && (
                <TimetableGrid
                    hours={hours}
                    highlightedHour={highlightedHour}
                    nextBus={nextBus}
                    schedule={activeSchedule}
                    direction={direction}
                />
            )}

            {!isCompact && data.notes && Object.keys(data.notes).length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-[20px] text-[11px] text-gray-500 space-y-1.5">
                    <p className="font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">{UI_TEXT.SCHEDULE.NOTES_TITLE}</p>
                    {Object.entries(data.notes).map(([id, text]) => (
                        <p key={id}><span className="font-semibold">{id}:</span> {text}</p>
                    ))}
                </div>
            )}

            {!isCompact && (
                <div className="text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                    {UI_TEXT.SCHEDULE.LAST_UPDATED} {data.lastUpdated}
                </div>
            )}
        </div>
    );
}

export default memo(ScheduleView);
