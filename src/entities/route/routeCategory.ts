export interface RouteCategoryInfo {
    id: string;
    label: string;
    dotClass: string;
    activeClass: string;
    order: number;
}

/**
 * Automatically classifies transit route types (from TAGO, TOPIS, or local BIS)
 * into human-friendly, localized categories for the Route Selector.
 *
 * e.g. "공항버스" -> 공항, "좌석버스" / "직행좌석" -> 좌석, "순환버스" -> 순환,
 * "일반버스" -> 일반, "마을버스" -> 마을, "급행버스" -> 급행, "간선" -> 간선, etc.
 */
export function resolveRouteCategory(routeType?: string | null): RouteCategoryInfo {
    const tp = (routeType || "").trim().toLowerCase();

    // 1. 공항버스 / 공항리무진
    if (/공항|airport/i.test(tp)) {
        return {
            id: "AIRPORT",
            label: "공항",
            dotClass: "bg-sky-500",
            activeClass: "bg-sky-600 text-white shadow-md shadow-sky-500/30 scale-[1.02]",
            order: 10,
        };
    }

    // 2. 심야버스 / 심야
    if (/심야|night/i.test(tp)) {
        return {
            id: "NIGHT",
            label: "심야",
            dotClass: "bg-purple-600",
            activeClass: "bg-purple-600 text-white shadow-md shadow-purple-500/30 scale-[1.02]",
            order: 20,
        };
    }

    // 3. 좌석버스 / 직행좌석 / 좌석
    if (/좌석/i.test(tp)) {
        return {
            id: "SEAT",
            label: "좌석",
            dotClass: "bg-orange-500",
            activeClass: "bg-orange-600 text-white shadow-md shadow-orange-500/30 scale-[1.02]",
            order: 30,
        };
    }

    // 4. 급행버스 / 급행간선 / 급행
    if (/급행|express/i.test(tp)) {
        return {
            id: "EXPRESS",
            label: "급행",
            dotClass: "bg-red-500",
            activeClass: "bg-red-600 text-white shadow-md shadow-red-500/30 scale-[1.02]",
            order: 40,
        };
    }

    // 5. 광역버스 / 광역
    if (/광역/i.test(tp)) {
        return {
            id: "WIDE_AREA",
            label: "광역",
            dotClass: "bg-rose-600",
            activeClass: "bg-rose-600 text-white shadow-md shadow-rose-500/30 scale-[1.02]",
            order: 50,
        };
    }

    // 6. 간선버스 / 간선
    if (/간선|trunk/i.test(tp)) {
        return {
            id: "MAIN",
            label: "간선",
            dotClass: "bg-blue-600",
            activeClass: "bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-[1.02]",
            order: 60,
        };
    }

    // 7. 지선버스 / 지선
    if (/지선|feeder|branch/i.test(tp)) {
        return {
            id: "BRANCH",
            label: "지선",
            dotClass: "bg-emerald-600",
            activeClass: "bg-emerald-600 text-white shadow-md shadow-emerald-500/30 scale-[1.02]",
            order: 70,
        };
    }

    // 8. 순환버스 / 순환
    if (/순환|circuit/i.test(tp)) {
        return {
            id: "CIRCULAR",
            label: "순환",
            dotClass: "bg-teal-600",
            activeClass: "bg-teal-600 text-white shadow-md shadow-teal-500/30 scale-[1.02]",
            order: 80,
        };
    }

    // 9. 마을버스 / 마을
    if (/마을|village|town/i.test(tp)) {
        return {
            id: "VILLAGE",
            label: "마을",
            dotClass: "bg-lime-500",
            activeClass: "bg-lime-600 text-white shadow-md shadow-lime-500/30 scale-[1.02]",
            order: 90,
        };
    }

    // 10. 농어촌버스 / 농어촌
    if (/농어촌|rural/i.test(tp)) {
        return {
            id: "RURAL",
            label: "농어촌",
            dotClass: "bg-amber-600",
            activeClass: "bg-amber-600 text-white shadow-md shadow-amber-600/30 scale-[1.02]",
            order: 100,
        };
    }

    // 11. 시외버스 / 시외
    if (/시외/i.test(tp)) {
        return {
            id: "INTERCITY",
            label: "시외",
            dotClass: "bg-indigo-600",
            activeClass: "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-[1.02]",
            order: 110,
        };
    }

    // 12. 관광버스 / 관광
    if (/관광|tour/i.test(tp)) {
        return {
            id: "TOUR",
            label: "관광",
            dotClass: "bg-pink-600",
            activeClass: "bg-pink-600 text-white shadow-md shadow-pink-500/30 scale-[1.02]",
            order: 120,
        };
    }

    // 13. 맞춤형 / 따복 / 공영
    if (/맞춤|따복|공영/i.test(tp)) {
        return {
            id: "CUSTOM",
            label: "맞춤·공영",
            dotClass: "bg-cyan-600",
            activeClass: "bg-cyan-600 text-white shadow-md shadow-cyan-500/30 scale-[1.02]",
            order: 130,
        };
    }

    // 13.5. 수요응답 / DRT
    if (/수요응답|drt/i.test(tp)) {
        return {
            id: "DRT",
            label: "수요응답",
            dotClass: "bg-indigo-500",
            activeClass: "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-[1.02]",
            order: 135,
        };
    }

    // 14. 일반버스 / 일반 / 시내버스
    if (/일반|시내/i.test(tp)) {
        return {
            id: "GENERAL",
            label: "일반",
            dotClass: "bg-blue-500",
            activeClass: "bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-[1.02]",
            order: 55,
        };
    }

    // 15. Other custom string - strip trailing "버스" or "형시내버스"
    const cleaned = (routeType || "").replace(/(형)?(시내)?버스$/, "").trim();
    if (cleaned) {
        return {
            id: `TYPE_${cleaned}`,
            label: cleaned,
            dotClass: "bg-slate-500",
            activeClass: "bg-slate-700 text-white shadow-md shadow-slate-600/30 scale-[1.02]",
            order: 140,
        };
    }

    // 16. Fallback default
    return {
        id: "GENERAL",
        label: "일반",
        dotClass: "bg-blue-500",
        activeClass: "bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-[1.02]",
        order: 55,
    };
}
