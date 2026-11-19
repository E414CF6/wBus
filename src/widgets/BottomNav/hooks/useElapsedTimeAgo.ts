import {useEffect, useState} from "react";
import {UI_TEXT} from "@shared/config/locale";

export function formatTimeAgo(lastUpdated?: number | null, now: number = Date.now()): string {
    if (!lastUpdated) return UI_TEXT.TIME.JUST_NOW;
    const diffSec = Math.max(0, Math.floor((now - lastUpdated) / 1000));
    if (diffSec < 60) {
        return UI_TEXT.TIME.SECONDS_AGO(diffSec);
    }
    const min = Math.floor(diffSec / 60);
    return UI_TEXT.TIME.MINUTES_AGO(min);
}

export function useElapsedTimeAgo(lastUpdated?: number | null, enabled: boolean = true) {
    const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(lastUpdated));

    useEffect(() => {
        if (!enabled) return;
        const update = () => {
            setTimeAgo(formatTimeAgo(lastUpdated));
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [enabled, lastUpdated]);

    return timeAgo;
}
