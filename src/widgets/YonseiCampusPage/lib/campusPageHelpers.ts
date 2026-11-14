import type {CampusDirectionMode} from "./yonseiShuttleUtils";

const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function getDefaultDirection(now: Date): CampusDirectionMode {
    return now.getHours() < 12 ? "INBOUND" : "OUTBOUND";
}

export function formatHeaderClock(date: Date): string {
    const hh = date.getHours().toString().padStart(2, "0");
    const mm = date.getMinutes().toString().padStart(2, "0");
    const dayName = KOREAN_WEEKDAYS[date.getDay()];
    return `${hh}:${mm} (${dayName})`;
}

export interface ShuttleWaitBadge {
    pillClass: string;
    dotClass: string | null;
    label: string;
}

export function getShuttleWaitBadge(waitMins: number): ShuttleWaitBadge {
    if (waitMins <= 10) {
        return {
            pillClass: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30 font-black",
            dotClass: "bg-rose-500",
            label: waitMins === 0 ? "곧 출발" : `${waitMins}분 후`,
        };
    }
    if (waitMins <= 30) {
        return {
            pillClass:
                "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-black",
            dotClass: null,
            label: `${waitMins}분 후`,
        };
    }
    return {
        pillClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25 font-extrabold",
        dotClass: null,
        label: `${waitMins}분 후`,
    };
}
