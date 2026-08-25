/**
 * Localization & Text Constants
 * UI_TEXT: User-facing strings
 */

// ============================================================================
// User Interface Text (Korean)
// ============================================================================

export const UI_TEXT = {
    COMMON: {
        LOADING_LIVE: "실시간 버스 정보를 불러오는 중...",
        LOADING: "로딩 중...",
        RETRY: "다시 시도",
        CONFIRM: "확인",
        CANCEL: "취소",
        EXPAND: "펼치기",
        COLLAPSE: "접기",
        CLOSE: "닫기",
        COUNT_ITEMS: (count: number) => `${count}개`,
        ROUTE_LABEL: (route: string) => `${route}번`,
    },

    CONNECTION: {
        CONNECTING: "연결 중...",
        CONNECTED: "실시간 연결됨",
        FALLBACK: "업데이트 중",
        SUSPENDED: "대기 상태",
        STATUS_TOOLTIP: "실시간 연결 상태 (클릭 시 재연결)",
        DEGRADED: "(지연)",
    },

    TIME: {
        MINUTE_SUFFIX: "분",
        HOUR_SUFFIX: "시간",
        DAY_SUFFIX: "일",
        SECOND_SUFFIX: "초",
        JUST_NOW: "방금 전",
        SECONDS_AGO: (sec: number) => `${sec}초 전`,
        MINUTES_AGO: (min: number) => `${min}분 전`,
        FORMAT_REMAINING: (min: number) => `${min}분`,
        REFRESH_AVAILABLE_NOW: "지금 갱신 가능",
        REFRESH_AVAILABLE_DAYS: (days: number, hours: number) => `${days}일 ${hours}시간 후 갱신 가능`,
        REFRESH_AVAILABLE_HOURS: (hours: number, mins: number) => `${hours}시간 ${mins}분 후 갱신 가능`,
        REFRESH_AVAILABLE_MINS: (mins: number) => `${mins}분 후 갱신 가능`,
    },

    NAV: {
        HOME: "홈",
        BACK_LIST: "목록으로 돌아가기",
        SHOW_LIST: "버스 목록 보기",
        HIDE_LIST: "버스 목록 숨기기",
        BUS_LIST_LABEL: "버스 목록",
        NOTICE_OPEN_ARIA: "알림마당 열기",
    },

    TIMETABLE: {
        HERO_BADGE: "원주시 시내버스 시간표",
        HERO_TITLE: "노선별 운행 시간표",
        HERO_SUBTITLE: "시내버스의 기점/종점 출발 시각 및 실시간 정보",
        STATS_TOTAL_ROUTES: "등록 노선",
        STATS_BOOKMARKS: "즐겨찾기",

        BASE_DATETIME_LABEL: "기준 일시:",
        CACHE_CRITERIA: (time: string) => `시간표 기준: ${time}`,
        CACHE_REFRESH_BUTTON: "시간표 갱신",
        CACHE_REFRESHING: "갱신 중...",

        BOOKMARKS_BANNER_TITLE: "즐겨찾기 노선 모아보기",
        BOOKMARKS_BANNER_COUNT: (count: number) => `${count}개 노선`,

        VIEW_TIMETABLE_DETAIL: "시간표 상세 보기",
        VIEW_TIMETABLE_BTN: "시간표",
        VIEW_REALTIME_MAP_BTN: "실시간 지도",

        ORIGIN_LABEL: (origin: string) => `기점(${origin})`,
        DEST_LABEL: (dest: string) => `종점(${dest})`,
        WAIT_MINUTES: (min: number) => `${min}분`,

        SERVICE_ENDED: "금일 운행 종료",
        FIRST_LAST_BUS: "첫차 / 막차",
        RUN_INTERVAL: "운행 / 배차",
        FIRST_BUS_LABEL: "첫차:",
        LAST_BUS_LABEL: "막차:",
        RUN_COUNT_LABEL: "운행:",
        NEXT_BADGE: "다음",

        ORIGIN_DEP: (origin: string) => `${origin} 출발 (기점)`,
        DEST_DEP: (dest: string) => `${dest} 출발 (종점)`,
        RUN_TYPE: "운행 구분",
        RUN_DAY: "운행일",
        MAIN_ROUTES_LABEL: "주요노선:",
        NOTES: "비고",
        SEQ: "순번",

        SEARCH_PLACEHOLDER: "노선 번호, 주요 정류장, 기점/종점 검색...",
        SEARCH_MODAL_PLACEHOLDER: "시간표 검색...",
        CLEAR_SEARCH_ARIA: "검색어 지우기",
        SEARCH_RESULTS_LABEL: "검색 결과:",
        SEARCH_RESULTS_COUNT: (count: number) => `검색 결과: ${count}개 노선`,
        ROUTE_COUNT: (count: number) => `${count}개`,
        RESET_FILTER: "필터 초기화",

        DAY_ALL: "전체",
        DAY_WEEKDAY: "평일",
        DAY_SATURDAY: "토요일",
        DAY_SUN_HOLIDAY: "일·공휴일",
        DAY_VACATION_HOLIDAY: "방학·휴일",
        DAY_WEEKEND_HOLIDAY: "주말·공휴일",

        CAT_ALL: "전체 노선",
        CAT_2: "2번 계열 (횡성)",
        CAT_3_4: "3·4번 계열",
        CAT_6_7_8: "6·7·8번",
        CAT_16: "16번 (순환)",
        CAT_30: "30번대 (연세대)",
        CAT_41: "41번 (구룡사)",
        CAT_50: "50번대 (문막)",

        NO_ROUTES_FOUND: "검색 조건과 일치하는 노선이 없습니다.",
        NO_ROUTES_DESC: "검색어 또는 운행일 필터를 변경하거나 즐겨찾기 상태를 확인해 보세요.",
        ALL_ROUTES_BTN: "모든 노선 보기",

        BOOKMARK_TOGGLE_ADD: "즐겨찾기 추가",
        BOOKMARK_TOGGLE_REMOVE: "즐겨찾기 해제",

        FILTER_ALL_DAYS: "전체 운행일",
        FILTER_BOOKMARKS_ONLY: "즐겨찾기만 보기",
    },

    BOTTOM_NAV: {
        TAB_SCHEDULE: "시간표",
        TAB_MAP: "실시간 지도",
        TAB_YONSEI: "연세대학교",
        TAB_ALL: "전체",
        ROUTE_OPTION: (route: string) => `${route}번 노선`,
        RUNNING_LIST_BTN: (count: number) => `운행 목록 (${count})`,
        RUNNING_LIST_TITLE: (route: string, count: number) => `${route}번 노선 운행 목록 (${count}대)`,
        TOGGLE_THEME: "테마 변경",
    },

    YONSEI: {
        HERO_BADGE: "연세대학교 미래캠퍼스",
        HERO_TITLE: "시내버스 시간표",
        HERO_SUBTITLE: "",
        SOONEST_TITLE: "다음 출발 예정 버스",
        ALL_SOONEST_TITLE: "실시간 다음 출발 현황",
        NO_MORE_BUSES_TODAY: "금일 남은 운행 버스가 없습니다.",

        BADGE_30: "30번 (연세대 출발)",
        BADGE_34: "34번 (연세대 출발)",
        BADGE_34_1: "34-1번 (회촌 출발)",
        BADGE_YONSEI: "연세대",
        BADGE_HOECHON: "회촌",

        VIA_LABEL: "주요 경유지",
        VIA_SHORT_LABEL: "주요 경유",
        VIA_30: "장양리 - 북원교 - 진광중고교 - 상지대학교 - 한라비발디아파트 - 단계현진아파트 - 고속시외버스터미널 - 베스파타운 - 뜨란채 - 원주역 - 육민관고 - 흥업사거리 - 세동마을 - 연세대학교",
        VIA_34: "장양리 - 북원교 - 단계사거리 - 단계현진아파트 - 고속시외버스터미널 - YWCA - (→ 원일로 →/← 평원로 ←) - 남원로 남부시장 - 원주의료원 - 도영쇼핑 - 명륜소방서 - 오페라웨딩홀 - (← 원주역 ←) - 서곡삼거리 - 강원대학교 - 흥업사거리 - 세동마을 - 연세대학교",
        VIA_34_1: "장양리 - 북원교 - 단계사거리 - 단계현진아파트 - 고속시외버스터미널 - YWCA - (→ 원일로 →/← 평원로 ←) - 남원로 남부시장 - 원주의료원 - 도영쇼핑 - 명륜소방서 - 오페라웨딩홀 - 원주역 - 서곡삼거리 - 강원대학교 - 흥업사거리 - 세동마을 - 연세대학교 - 한촌 - 매지리 - 회촌",

        LOCATION_YONSEI: "연세대 출발",
        LOCATION_HOECHON: "회촌 출발",
        TIMETABLE_TITLE: (label: string) => `${label} 시간표`,

        MODE_OVERRIDE_LABEL: "운행 기준",
        MODE_AUTO: (isHoliday: boolean) => `자동 (${isHoliday ? "휴일" : "평일"})`,
        MODE_AUTO_TOOLTIP: "자동 감지 (오늘 요일 기준)",
        MODE_WEEKDAY: "평일",
        MODE_WEEKDAY_TOOLTIP: "평일 기준 시간표",
        MODE_VACATION: "방학 · 휴일",
        MODE_VACATION_TOOLTIP: "방학 · 휴일 기준 시간표",

        STATUS_DEPARTING_SOON: "곧 출발",
        STATUS_MINUTES_LEFT: (min: number) => `${min}분 후`,
        STATUS_MINUTES_REL: (min: number) => `+${min}분`,

        SCHEDULE_APPLIED_ALL_DAYS: "매일",
        SCHEDULE_APPLIED_WEEKDAY: "평일",
        SCHEDULE_APPLIED_VACATION: "방학 · 휴일",

        TOTAL_RUNS: (count: number) => `총 ${count}회 운행`,
        NEXT_LOCATION_DEP: (location: string) => `다음 ${location}`,
        SERVICE_ENDED: "오늘 운행 종료",
        UPCOMING_DEP_TIMES: "이어지는 출발 시각",
        FULL_TIMETABLE_DETAIL: "전체 시간표 상세",
        VIEW_TIMETABLE_BTN: "시간표 보기",
        REALTIME_MAP_BTN: "실시간 지도",
        MAP_SHORT_BTN: "지도",

        SEARCH_MODAL_PLACEHOLDER: "출발 시각 또는 비고 검색...",
        HOURS_DISPLAYED: (count: number) => `${count}개 시간대 표시 중`,
        HOUR_LABEL: "시간",
        HOUR_SUFFIX: "시",
        CURRENT_HOUR_BADGE: "현재 시각",
        CURRENT_HOUR_STR: (hour: string) => `현재 ${hour}시`,
        SINGLE_COLUMN_TITLE: "매일 운행 (평일 · 휴일 동일)",
        WEEKDAY_COLUMN: "평일",
        VACATION_COLUMN: "방학 / 휴일",
        NO_TIMES_MATCH: "검색 조건에 맞는 출발 시각이 없습니다.",
        NEXT_BUS_BADGE: "다음",
        FOOTNOTE_TITLE: "각주 안내 (비고)",
        FOOTNOTE_SCROLL_HINT: "좌우로 스크롤하여 확인",

        REFRESH_SUCCESS: "시간표 데이터가 원주시 ITS에서 새로 수집되어 갱신되었습니다.",
        REFRESH_INFO: "최소 갱신 시간이 지나지 않아 기존 저장소 JSON 데이터를 사용합니다.",
    },

    BUS_SERVICE: {
        DATA_UPDATED: "시간표 데이터가 업데이트되었습니다.",
        TIMEOUT_MAINTAIN_CACHE: "서버 연결 시간 초과로 인해 신규 수집을 취소하고 기존 저장소의 최신 시간표를 유지합니다.",
        SERVER_TIMEOUT_FALLBACK: "원주시 ITS 서버 응답 지연으로 기존 저장소의 시간표를 유지합니다.",
        REFRESH_ERROR: "시간표 갱신 처리 중 오류가 발생했습니다.",
        MIN_INTERVAL_NOT_REACHED: (nextAvailableStr: string) =>
            `최소 하한 갱신 시간이 지나지 않아 시간표를 갱신하지 않았습니다. (다음 갱신 가능: ${nextAvailableStr})`,
    },

    SCHEDULE: {
        MAJOR_STOPS: "주요 정류장",
        TIMETABLE: "시간표",
        NEXT_BUS: "다음 버스",
        SHOW_DETAILS: "시간표 보기",
        HIDE_DETAILS: "시간표 접기",
        NO_SERVICE: "운행 없음",
        NOTES_TITLE: "참고 사항",
        LAST_UPDATED: "최종 업데이트:",
    },

    BUS_LIST: {
        TITLE_ALL: "전체 버스 목록",
        TITLE_ROUTE: (route: string) => `${route}번 버스`,
        COUNT_RUNNING: (count: number) => `${count}대 운행 중`,
        NO_RUNNING: "운행 중인 버스 없음",
        NO_RUNNING_DESC: "운행 중인 버스가 없습니다.",
        EMPTY_TODAY: "오늘 운행 예정인 버스가 없습니다.",
    },

    BUS_ITEM: {
        ARRIVING_SOON: "곧 도착",
        STOPS_LEFT: (count: number) => (count === 1 ? "1정거장 전" : `${count}정거장 전`),
        VEHICLE_NUM: "차량번호",
        CURRENT_LOC: "현재위치",
        STATUS_CHECKING: "정보 확인 중...",
        RUNNING_NOW: "운행중",
        SHOW_ROUTE: "경로보기",
        CLICK_ROUTE_FOR_INFO: "버스 번호를 클릭하여 상세 정보를 확인하세요.",
    },

    MAP: {
        BUS_LOCATION_TITLE: "실시간 버스 위치",
        BUS_LOCATION_DESC: "지도에서 실시간으로 버스 위치를 확인하세요.",
    },

    STOP_POPUP: {
        STATION_ID_LABEL: "정류장 ID",
        STATION_ID_FALLBACK: "N/A",
    },

    // User-facing Error Messages
    ERROR: {
        TITLE: "문제가 발생했습니다",
        LOCATION_DENIED: "위치 권한을 허용해주세요.",
        ROUTE_NOT_FOUND: "요청하신 노선 정보를 찾을 수 없습니다.",
        NO_ARRIVAL_INFO: "도착 정보를 불러올 수 없습니다.",
        SERVICE_ENDED: "운행이 종료되었습니다.",
        FETCH_FAILED: (resource: string, status: number) => `${resource} 정보를 불러오는 데 실패했습니다. (상태 코드: ${status})`,
        ROUTE_MISSING: (route: string) => `노선 정보를 찾을 수 없습니다: ${route}`,
        UNKNOWN: (detail: string) => `일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (${detail})`,
        REFRESH_FAILED: "시간표 갱신 처리 중 오류가 발생했습니다.",
    },

    METADATA: {
        TITLE: "wBus",
        DESC: "원주 시내버스 실시간 도착 정보 & 시간표",
    },

    NOTICE: {
        SECTION_TITLE: "알림마당",
        WIDGET_TITLE: "원주시 교통정보센터 알림마당",
        LATEST_ITS: "원주시 교통정보센터 소식",
        VIEW_ALL: "전체보기",
        NO_NOTICES: "등록된 공지사항이 없습니다.",
        SEARCH_PLACEHOLDER: "알림마당 검색어 입력...",
        SEARCH_BUTTON: "검색",
        TAB_ALL: "전체",
        TAB_PINNED: "공지",
        PINNED_BADGE: "공지",
        BADGE_NEW: "최근",
        PINNED_COUNT: (count: number) => `중요 공지 ${count}건`,
        PREV_NOTICE_ARIA: "이전 최신공지",
        NEXT_NOTICE_ARIA: "다음 최신공지",
        NOTICE_INDEX_ARIA: (index: number) => `공지 ${index}`,
        REFRESH: "새로고침",
        ATTACHMENT: "첨부파일",
        ATTACHMENT_COUNT: (count: number) => `첨부파일 (${count})`,
        HITS: "조회수",
        WRITER: "작성자",
        DATE: "등록일",
        OFFICIAL_LINK: "원주시 교통정보센터 바로가기",
        PREV_NOTICE: "이전글",
        NEXT_NOTICE: "다음글",
        BACK_TO_LIST: "목록으로",
        VIEW_ORIGINAL: "원문 보기",
        ERROR_FETCH_LIST: "알림 정보를 불러오는 중 오류가 발생했습니다.",
        ERROR_FETCH_DETAIL: "상세 정보를 불러올 수 없습니다.",
        ERROR_INVALID_ID: "유효하지 않은 게시글 ID입니다.",
        PAGE_FORMAT: (page: number, total: number) => `${page} / ${total} 페이지`,
        PREV_PAGE: "이전",
        NEXT_PAGE: "다음",
        DEFAULT_WRITER: "원주시",
    },

    ACCESSIBILITY: {
        MAIN_NAV: "메인 내비게이션",
        LOADING_APP: "앱 로딩 중",
        TOGGLE_SCHEDULE: "시간표 토글",
        ERROR_ICON: "오류",
        BUS_ICON_ALT: "버스",
        CLOSE_MODAL: "모달 닫기",
    },

    DATA_LABELS: {
        SCHEDULE_DATA: "시간표 데이터",
    },

    FOOTER: {
        COPYRIGHT: "© 2026 wBus",
        DESCRIPTION: "시내버스 정보 서비스",
        LINKS: [{label: "이용약관", href: "#"}, {label: "개인정보처리방침", href: "#"}],
        DISCLAIMER: "본 서비스는 참고용이며, 실제 운행 정보와 다를 수 있습니다.",
    },
} as const;
