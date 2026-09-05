import {APP_LOCALE} from "./appLocale";

export const COMMON_STRINGS = {
    LOADING_LIVE: "실시간 버스 정보를 불러오는 중...",
    LOADING: "로딩 중...",
    RETRY: "다시 시도",
    CONFIRM: "확인",
    CANCEL: "취소",
    EXPAND: "펼치기",
    COLLAPSE: "접기",
    CLOSE: "닫기",
    ROUTE_LABEL: (route: string) => `${route}번`,
} as const;

export const CONNECTION_STRINGS = {
    CONNECTING: "연결 중...",
    CONNECTED: "실시간 연결됨",
    FALLBACK: "업데이트 중",
    SUSPENDED: "대기 상태",
    SERVICE_ENDED: "운행 종료",
    STATUS_TOOLTIP: "실시간 연결 상태 (클릭 시 재연결)",
    DEGRADED: "(지연)",
    TOOLTIP_CONNECTING: "실시간 위치 API 연결 대기 중",
    TOOLTIP_WAITING: "화면 비활성화로 일시 대기 중",
    TOOLTIP_DEGRADED: "실시간 버스 운행 중 (일부 데이터 지연)",
    TOOLTIP_SERVICE_ENDED: "현재 운행 중인 버스가 없습니다 (운행 종료 또는 배차 대기)",
} as const;

export const TIME_STRINGS = {
    MINUTE_SUFFIX: "분",
    HOUR_SUFFIX: "시간",
    DAY_SUFFIX: "일",
    SECOND_SUFFIX: "초",
    JUST_NOW: "방금 전",
    SECONDS_AGO: (sec: number) => `${sec}초 전`,
    MINUTES_AGO: (min: number) => `${min}분 전`,
    HOURS_AGO: (hours: number) => `${hours}시간 전`,
    DAYS_AGO: (days: number) => `${days}일 전`,
    REFRESH_AVAILABLE_NOW: "지금 갱신 가능",
    REFRESH_AVAILABLE_DAYS: (days: number, hours: number) => `${days}일 ${hours}시간 후 갱신 가능`,
    REFRESH_AVAILABLE_HOURS: (hours: number, mins: number) => `${hours}시간 ${mins}분 후 갱신 가능`,
    REFRESH_AVAILABLE_MINS: (mins: number) => `${mins}분 후 갱신 가능`,
} as const;

export const ACCESSIBILITY_STRINGS = {
    MAIN_NAV: "메인 내비게이션",
    SKIP_LINK: "본문 바로가기",
    THEME_SWITCH: "화면 테마 변경",
    LOADING_APP: "앱 로딩 중",
    TOGGLE_SCHEDULE: "시간표 토글",
    ERROR_ICON: "오류",
    BUS_ICON_ALT: "버스",
    CLOSE_MODAL: "모달 닫기",
} as const;

export const NAV_STRINGS = {
    HOME: "홈",
    BACK_LIST: "목록으로 돌아가기",
    SHOW_LIST: "버스 목록 보기",
    HIDE_LIST: "버스 목록 숨기기",
    BUS_LIST_LABEL: "버스 목록",
    NOTICE_OPEN_ARIA: "알림마당 열기",
    THEME_TOGGLE_LABEL: "화면 테마 변경",
} as const;

export const BOTTOM_NAV_STRINGS = {
    TAB_SCHEDULE: "시간표",
    TAB_MAP: "실시간 지도",
    TAB_CHAT: "스퀘어",
    TAB_YONSEI: "연세대",
    TAB_ALL: "전체",
    RUNNING_LIST_BTN: (count: number) => `운행 목록 (${count})`,
    RUNNING_LIST_TITLE: (route: string, count: number) => `${route}번 노선 운행 목록 (${count}대)`,
    TOGGLE_THEME: "테마 변경",
    CHAT_ALL_FILTER: "전체",
    PICK_ROUTE_TITLE: "노선 선택",
    SELECT_ROUTE_TITLE: "노선 선택 (검색/목록)",
    DEFAULT_ROUTE_NAME: "노선",
} as const;

export const BUS_SERVICE_STRINGS = {
    DATA_UPDATED: "시간표 데이터가 업데이트되었습니다.",
    TIMEOUT_MAINTAIN_CACHE: "서버 연결 시간 초과로 인해 신규 수집을 취소하고 기존 시간표를 유지합니다.",
    SERVER_TIMEOUT_FALLBACK: "서버 응답 지연으로 기존 시간표를 유지합니다.",
    REFRESH_ERROR: "시간표 갱신 처리 중 오류가 발생했습니다.",
} as const;

export const SCHEDULE_STRINGS = {
    MAJOR_STOPS: "주요 정류장",
    TIMETABLE: "시간표",
    NEXT_BUS: "다음 버스",
    SHOW_DETAILS: "시간표 보기",
    HIDE_DETAILS: "시간표 접기",
    NO_SERVICE: "운행 없음",
    NOTES_TITLE: "참고 사항",
    LAST_UPDATED: "최종 업데이트:",
} as const;

export const BUS_LIST_STRINGS = {
    TITLE_ALL: "전체 버스 목록",
    TITLE_ROUTE: (route: string) => `${route}번 버스`,
    NO_RUNNING: "운행 중인 버스 없음",
    NO_RUNNING_DESC: "운행 중인 버스가 없습니다.",
    EMPTY_TODAY: "오늘 운행 예정인 버스가 없습니다.",
} as const;

export const BUS_ITEM_STRINGS = {
    ARRIVING_SOON: "곧 도착",
    STOPS_LEFT: (count: number) => (count === 1 ? "1정거장 전" : `${count}정거장 전`),
    VEHICLE_NUM: "차량번호",
    CURRENT_LOC: "현재위치",
    DESTINATION: "방면",
    LOW_BUS_BADGE: "저상",
    DIRECTION_UP: "상행",
    DIRECTION_DOWN: "하행",
    DIRECTION_UNKNOWN: "방향 미정",
    MINUTES_AGO: (min: number) => `${min}분 전`,
    JUST_NOW: "방금 전",
    STATUS_CHECKING: "정보 확인 중...",
    RUNNING_NOW: "운행중",
    SHOW_ROUTE: "경로보기",
    CLICK_ROUTE_FOR_INFO: "버스 번호를 클릭하여 상세 정보를 확인하세요.",
} as const;

export const MAP_STRINGS = {
    BUS_LOCATION_TITLE: "실시간 버스 위치",
    BUS_LOCATION_DESC: "지도에서 실시간으로 버스 위치를 확인하세요.",
} as const;

export const STOP_POPUP_STRINGS = {
    STATION_ID_LABEL: "정류장 ID",
    STATION_ID_FALLBACK: "N/A",
} as const;

export const ERROR_STRINGS = {
    TITLE: "문제가 발생했습니다",
    LOCATION_DENIED: "위치 권한을 허용해주세요.",
    ROUTE_NOT_FOUND: "요청하신 노선 정보를 찾을 수 없습니다.",
    NO_ARRIVAL_INFO: "도착 정보를 불러올 수 없습니다.",
    SERVICE_ENDED: "운행이 종료되었습니다.",
    FETCH_FAILED: (resource: string, status: number) => `${resource} 정보를 불러오는 데 실패했습니다. (상태 코드: ${status})`,
    ROUTE_MISSING: (route: string) => `노선 정보를 찾을 수 없습니다: ${route}`,
    UNKNOWN: (detail: string) => `일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (${detail})`,
    REFRESH_FAILED: "시간표 갱신 처리 중 오류가 발생했습니다.",
} as const;

export const METADATA_STRINGS = {
    SITE_NAME: "wBus",
    TITLE: "wBus",
    TITLE_TEMPLATE: "wBus / %s",
    DESC: "원주시 시내버스 실시간 위치 지도, 정류장 도착 정보 및 연세대 미래캠퍼스(30번·34번·34-1번·셔틀) 노선별 최신 운행 시간표",
    SHORT_DESC: "원주 시내버스 실시간 도착 정보 & 시간표",
    KEYWORDS: [
        "wBus", "더블유버스", "원주버스", "원주시내버스", "원주 버스 실시간",
        "원주 버스 시간표", "원주 버스 위치", "연세대 미래캠퍼스 버스",
        "연세대 미래캠 버스", "연세대 셔틀버스", "30번 버스", "34번 버스",
        "34-1번 버스", "원주시 교통정보",
    ],
    OG_LOCALE: APP_LOCALE.OG_LOCALE,
    AUTHOR: "wBus",
} as const;

export const DATA_LABELS_STRINGS = {
    SCHEDULE_DATA: "시간표 데이터",
} as const;

export const ROUTE_MAP_STRINGS = {
    ORIGIN: "기점",
    DESTINATION: "종점",
    FIRST_BUS: "첫차",
    LAST_BUS: "막차",
    INTERVAL: "배차간격",
    MINUTES_UNIT: "분",
} as const;

export const FOOTER_STRINGS = {
    COPYRIGHT: "© 2026 wBus",
    DESCRIPTION: "시내버스 정보 서비스",
    LINKS: [
        {label: "이용약관", href: "/terms"},
        {label: "개인정보처리방침", href: "/privacy"},
    ],
    DISCLAIMER: "본 서비스는 참고용이며, 실제 운행 정보와 다를 수 있습니다.",
} as const;
