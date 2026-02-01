/**
 * Localization & Text Constants
 * * UI_TEXT: User-facing strings (Korean)
 */

// ============================================================================
// User Interface Text (Korean)
// ============================================================================

export const UI_TEXT = {
    COMMON: {
        LOADING_LIVE: "실시간 버스 정보를 불러오는 중...",
        LOADING: '로딩 중...',
        RETRY: '다시 시도',
        CONFIRM: '확인',
        CANCEL: '취소',
        EXPAND: '펼치기',
        COLLAPSE: '접기',
    },

    TIME: {
        MINUTE_SUFFIX: '분',
        HOUR_SUFFIX: '시간',
        FORMAT_REMAINING: (min: number) => `${min}분`,
    },

    NAV: {
        HOME: '홈',
        BACK_LIST: '목록으로 돌아가기',
        SHOW_LIST: '버스 목록 보기',
        HIDE_LIST: '버스 목록 숨기기',
    },

    SCHEDULE: {
        MAJOR_STOPS: '주요 정류장',
        TIMETABLE: '시간표',
        NEXT_BUS: '다음 버스',
        SHOW_DETAILS: '시간표 보기',
        HIDE_DETAILS: '시간표 접기',
        NO_SERVICE: '운행 없음',
        NOTES_TITLE: '참고 사항',
        LAST_UPDATED: '최종 업데이트:',
    },

    BUS_LIST: {
        TITLE_ALL: '전체 버스 목록',
        TITLE_ROUTE: (route: string) => `${route}번 버스`,
        COUNT_RUNNING: (count: number) => `${count}대 운행 중`,
        NO_RUNNING: '운행 중인 버스 없음',
        NO_RUNNING_DESC: '운행 중인 버스가 없습니다.',
        EMPTY_TODAY: '오늘 운행 예정인 버스가 없습니다.',
    },

    BUS_ITEM: {
        ARRIVING_SOON: '곧 도착',
        STOPS_LEFT: (count: number) => count === 1 ? '1정거장 전' : `${count}정거장 전`,
        VEHICLE_NUM: '차량번호',
        CURRENT_LOC: '현재위치',
        STATUS_CHECKING: '정보 확인 중...',
        RUNNING_NOW: '운행중',
        SHOW_ROUTE: '경로보기',
        CLICK_ROUTE_FOR_INFO: '버스 번호를 클릭하여 상세 정보를 확인하세요.',
    },

    MAP: {
        BUS_LOCATION_TITLE: '실시간 버스 위치',
        BUS_LOCATION_DESC: '지도에서 실시간으로 버스 위치를 확인하세요.',
    },

    // User-facing Error Messages
    ERROR: {
        TITLE: '문제가 발생했습니다',
        NETWORK: (detail: string) => `네트워크 연결 상태를 확인해주세요. (${detail})`,
        LOCATION_DENIED: '위치 권한을 허용해주세요.',
        ROUTE_NOT_FOUND: '요청하신 노선 정보를 찾을 수 없습니다.',
        NO_ARRIVAL_INFO: '도착 정보를 불러올 수 없습니다.',
        SERVICE_ENDED: '운행이 종료되었습니다.',
        FETCH_FAILED: (resource: string, status: number) => `${resource} 정보를 불러오는 데 실패했습니다. (상태 코드: ${status})`,
        ROUTE_MISSING: (route: string) => `노선 정보를 찾을 수 없습니다: ${route}`,
        UNKNOWN: (detail: string) => `일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (${detail})`,
    },

    METADATA: {
        TITLE: 'wBus',
        DESC: '원주 시내버스 실시간 도착 정보 & 시간표',
    },

    NOTICE: {
        SECTION_TITLE: '공지사항',
        NO_NOTICES: '공지사항이 없습니다.'
    },

    FOOTER: {
        COPYRIGHT: '© 2026 wBus',
        DESCRIPTION: '시내버스 정보 서비스',
        LINKS: [
            { label: '이용약관', href: '#' },
            { label: '개인정보처리방침', href: '#' },
        ],
        DISCLAIMER: '본 서비스는 참고용이며, 실제 운행 정보와 다를 수 있습니다.',
    }
} as const;

// ============================================================================
// Domain Constants (Labels used in logic/display mix)
// ============================================================================

export const ARRIVAL_STATUS_LABELS = {
    LOADING: '정보 수신 중...',
    NO_INFO: '도착 정보 없음',
    ENDED: '운행 종료',
} as const;

export const DAY_LABELS = {
    WEEKDAY: '평일',
    WEEKEND: '주말/공휴일',
    SUNDAY: '일요일',
} as const;
