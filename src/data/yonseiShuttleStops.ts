export interface YonseiShuttleStop {
    id: string;
    number: number;
    name: string;
    shortName: string;
    lat: number;
    lng: number;
    locationDescription: string;
    directionTag: "시내방면" | "학교방면" | "양방향";
    tips?: string;
}

export const YONSEI_SHUTTLE_STOPS: YonseiShuttleStop[] = [{
    id: "terminal",
    number: 1,
    name: "원주고속터미널 (원주버스터미널)",
    shortName: "원주고속터미널",
    lat: 37.34383156887645,
    lng: 127.93212342388087,
    locationDescription: "원주고속터미널 건너편 그랜드 치과 병원 앞",
    directionTag: "학교방면",
    tips: "터미널 맞은편 그랜드치과병원 바로 앞 인도에서 승차합니다.",
}, {
    id: "wonju-station",
    number: 2,
    name: "원주역",
    shortName: "원주역",
    lat: 37.31573394450635,
    lng: 127.9214740514762,
    locationDescription: "원주역 시내버스정류장",
    directionTag: "학교방면",
    tips: "원주역 광장 앞 시내버스 승강장 구역에서 승차합니다.",
}, {
    id: "city-hall",
    number: 3,
    name: "시청사거리 (무실동)",
    shortName: "시청사거리",
    lat: 37.33441368172501,
    lng: 127.92842445886538,
    locationDescription: "원주 시청사거리 - 원주중부교회와 SK엔크린 주유소 사이 대로변",
    directionTag: "양방향",
    tips: "원주중부교회와 SK엔크린 주유소 사이 대로변 인도에서 승하차합니다.",
}, {
    id: "maeji-city",
    number: 4,
    name: "매지리 (시내방면)",
    shortName: "매지리 (시내방면)",
    lat: 37.27922822142208,
    lng: 127.90972515056743,
    locationDescription: "매지리 청솔아파트 버스정류장 (시내/하교 방면)",
    directionTag: "시내방면",
    tips: "하교 셔틀버스 하차 및 시내 방면 이동 정류장입니다.",
}, {
    id: "maeji-campus",
    number: 5,
    name: "매지리 (학교방면)",
    shortName: "매지리 (학교방면)",
    lat: 37.27877565600866,
    lng: 127.90882049043313,
    locationDescription: "청솔아파트 횡단보도 부근 (학교/등교 방면)",
    directionTag: "학교방면",
    tips: "등교 시 청솔아파트 횡단보도 부근에서 승차합니다.",
}, {
    id: "mirae-hall",
    number: 6,
    name: "미래관",
    shortName: "미래관",
    lat: 37.28347600204204,
    lng: 127.90065673400042,
    locationDescription: "연세대학교 미래캠퍼스 미래관 앞 승하차장",
    directionTag: "시내방면",
    tips: "하교 시내 방면(터미널·원주역·만종역·세브란스·여주역) 셔틀버스 출발 및 하차 장소입니다.",
}, {
    id: "yonsei-plaza",
    number: 7,
    name: "연세플라자",
    shortName: "연세플라자",
    lat: 37.277262214217906,
    lng: 127.90319571239979,
    locationDescription: "연세대학교 미래캠퍼스 연세플라자 앞",
    directionTag: "시내방면",
    tips: "연세플라자 앞 정류장에서 승하차합니다.",
}];

/**
 * 카카오맵 로드뷰 링크 생성
 */
export function getKakaoRoadviewUrl(lat: number, lng: number): string {
    return `https://map.kakao.com/link/roadview/${lat},${lng}`;
}

/**
 * 카카오맵 지도 링크 생성
 */
export function getKakaoMapUrl(name: string, lat: number, lng: number): string {
    return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
}
