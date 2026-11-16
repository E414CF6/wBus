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
