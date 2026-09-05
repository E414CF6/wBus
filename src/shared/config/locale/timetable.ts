export const TIMETABLE_STRINGS = {
    HERO_BADGE: "원주시 시내버스 시간표",
    HERO_TITLE: "노선별 운행 시간표",
    HERO_SUBTITLE: "시내버스의 기점/종점 출발 시각 및 실시간 정보",
    TITLE: "원주 시내버스 운행 시간표",
    STATS_TOTAL_ROUTES: "등록 노선",
    STATS_BOOKMARKS: "즐겨찾기",

    BASE_DATETIME_LABEL: "기준 일시:",
    CACHE_REFRESH_BUTTON: "시간표 갱신",
    CACHE_REFRESHING: "갱신 중...",
    CACHE_BANNER_TITLE: "기준 일시",

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

    SEARCH_PLACEHOLDER: "노선 번호 또는 기점·종점 검색 (예: 30, 연세대)",
    SEARCH_MODAL_PLACEHOLDER: "시간표 검색...",
    CLEAR_SEARCH_ARIA: "검색어 지우기",
    SEARCH_RESULTS_LABEL: "검색 결과:",
    ROUTE_COUNT: (count: number) => `${count}개`,
    RESET_FILTER: "필터 초기화",

    ALL_TAB: "전체 노선",
    FAVORITES_TAB: "즐겨찾기",
    CATEGORY_ALL: "전체",

    DAY_ALL: "전체",
    DAY_WEEKDAY: "평일",
    DAY_SATURDAY: "토요일",
    DAY_SAT_SUN_HOLIDAY: "토·일·공휴일",
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
} as const;
