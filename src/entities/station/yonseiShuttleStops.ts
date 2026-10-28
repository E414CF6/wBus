export interface YonseiShuttleStop {
    id: string;
    number: number;
    name: string;
    shortName: string;
    lat: number;
    lng: number;
    locationDescription: string;
    directionTag: "시내방면" | "학교방면";
    tips?: string;
}

export const YONSEI_SHUTTLE_STOPS: YonseiShuttleStop[] = [{
    id: "terminal-to-school",
    number: 1,
    name: "원주고속터미널 (원주버스터미널)",
    shortName: "원주고속터미널",
    lat: 37.34383156887645,
    lng: 127.93212342388087,
    locationDescription: "원주고속터미널 건너편 그랜드 치과 병원 앞",
    directionTag: "학교방면",
    tips: "",
}, {
    id: "campus-to-terminal",
    number: 1,
    name: "원주고속터미널 (원주버스터미널)",
    shortName: "원주고속터미널",
    lat: 37.344100648008926,
    lng: 127.93256404939314,
    locationDescription: "그랜드 치과 병원 건너편 인근",
    directionTag: "시내방면",
    tips: "",
}, {
    id: "wonju-station-to-campus",
    number: 2,
    name: "원주역",
    shortName: "원주역",
    lat: 37.31512706798006,
    lng: 127.92217451425046,
    locationDescription: "다리 건너 원주 시티투어 버스 승강장",
    directionTag: "학교방면",
    tips: "",
}, {
    id: "campus-to-wonju-station",
    number: 2,
    name: "원주역",
    shortName: "원주역",
    lat: 37.31573394450635,
    lng: 127.9214740514762,
    locationDescription: "시내버스 하차 승강장",
    directionTag: "시내방면",
    tips: "",
}, {
    id: "musil-to-campus",
    number: 3,
    name: "시청사거리 (무실동)",
    shortName: "시청사거리",
    lat: 37.334411075264576,
    lng: 127.92846956156683,
    locationDescription: "원주중부교회와 SK엔크린 주유소 사이 대로변",
    directionTag: "학교방면",
    tips: "",
}, {
    id: "campus-to-musil",
    number: 3,
    name: "시청사거리 (무실동)",
    shortName: "시청사거리",
    lat: 37.33235337110335,
    lng: 127.92660786346448,
    locationDescription: "무실센터빌 시내버스 정류장",
    directionTag: "시내방면",
    tips: "",
}, {
    id: "maeji-to-campus",
    number: 4,
    name: "매지리",
    shortName: "매지리",
    lat: 37.27877565600866,
    lng: 127.90882049043313,
    locationDescription: "청솔아파트 횡단보도 부근 (학교/등교 방면)",
    directionTag: "학교방면",
    tips: "",
}, {
    id: "campus-to-maeji",
    number: 4,
    name: "매지리",
    shortName: "매지리",
    lat: 37.27922822142208,
    lng: 127.90972515056743,
    locationDescription: "매지리 청솔아파트 시내버스정류장 (시내/하교 방면)",
    directionTag: "시내방면",
    tips: "",
}, {
    id: "mirae-hall",
    number: 5,
    name: "미래관",
    shortName: "미래관",
    lat: 37.28347600204204,
    lng: 127.90065673400042,
    locationDescription: "연세대학교 미래캠퍼스 미래관 앞 승하차장",
    directionTag: "시내방면",
    tips: "하교 시내 방면(터미널·원주역·만종역·세브란스·여주역) 셔틀버스 출발 및 하차 장소입니다.",
}, {
    id: "campus-to-yonsei-plaza",
    number: 6,
    name: "연세플라자",
    shortName: "연세플라자",
    lat: 37.277262214217906,
    lng: 127.90319571239979,
    locationDescription: "연세대학교 미래캠퍼스 연세플라자 앞",
    directionTag: "시내방면",
    tips: "",
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
