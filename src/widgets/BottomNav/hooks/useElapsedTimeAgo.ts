import {useEffect, useState} from "react";

export function formatTimeAgo(lastUpdated?: number | null, now: number = Date.now()): string {
    if (!lastUpdated) return "방금 전";
    const diffSec = Math.max(0, Math.floor((now - lastUpdated) / 1000));
    if (diffSec < 60) {
        return `${diffSec}초 전`;
    }
    const min = Math.floor(diffSec / 60);
    return `${min}분 전`;
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
