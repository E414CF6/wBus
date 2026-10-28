export const TARGET_ROUTE_NUMBERS = ["30", "34", "34-1"] as const;

export const ROUTE_CONFIG: Record<string, {
    name: string;
    gradient: string;
    badgeBg: string;
    accentColor: string;
    destLabel: string;
    originLabel: string;
    viaStops: string;
    description: string;
}> = {
    "30": {
        name: "30번",
        gradient: "from-[#003876] to-blue-700",
        badgeBg: "bg-[#003876]",
        accentColor: "blue",
        destLabel: "연세대 출발",
        originLabel: "장양리 출발",
        viaStops: "장양리 - 북원교 - 진광중고교 - 상지대학교 - 한라비발디아파트 - 단계현진아파트 - 고속시외버스터미널 - 베스파타운 - 뜨란채 - 원주역 - 육민관고 - 흥업사거리 - 세동마을 - 연세대학교",
        description: "장양리 ↔ 터미널 ↔ 원주역 ↔ (상지대) ↔ 연세대 (매일 운행)",
    }, "34": {
        name: "34번",
        gradient: "from-blue-600 to-indigo-600",
        badgeBg: "bg-blue-600",
        accentColor: "blue",
        destLabel: "연세대 출발",
        originLabel: "장양리 출발",
        viaStops: "장양리 - 북원교 - 단계사거리 - 단계현진아파트 - 고속시외버스터미널 - YWCA - (→ 원일로 →/← 평원로 ←) - 남원로 남부시장 - 원주의료원 - 도영쇼핑 - 명륜소방서 - 오페라웨딩홀 - (← 원주역 ←) - 서곡삼거리 - 강원대학교 - 흥업사거리 - 세동마을 - 연세대학교",
        description: "장양리 ↔ 남부시장 ↔ 의료원 ↔ 한라대/흥업 ↔ 연세대",
    }, "34-1": {
        name: "34-1번",
        gradient: "from-indigo-600 to-purple-600",
        badgeBg: "bg-indigo-600",
        accentColor: "purple",
        destLabel: "회촌 출발",
        originLabel: "장양리 출발",
        viaStops: "장양리 - 북원교 - 단계사거리 - 단계현진아파트 - 고속시외버스터미널 - YWCA - (→ 원일로 →/← 평원로 ←) - 남원로 남부시장 - 원주의료원 - 도영쇼핑 - 명륜소방서 - 오페라웨딩홀 - 원주역 - 서곡삼거리 - 강원대학교 - 흥업사거리 - 세동마을 - 연세대학교 - 한촌 - 매지리 - 회촌",
        description: "장양리 ↔ 원주역 ↔ 남부시장 ↔ 연세대 ↔ 매지리/회촌",
    },
};
