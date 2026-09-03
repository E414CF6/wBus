export interface YonseiDaySchedule {
    origin: string[];
    dest: string[];
}

/**
 * Localization & Text Constants
 * APP_LOCALE: Locale, language codes, and scraper request headers
 * UI_TEXT: User-facing strings
 */

export const APP_LOCALE = {
    LOCALE: "ko-KR", LANG: "ko", OG_LOCALE: "ko_KR", ACCEPT_LANGUAGE: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
} as const;

export const LOCALE = APP_LOCALE.LOCALE;
export const HTML_LANG = APP_LOCALE.LANG;

const YONSEI_STRINGS = {
    HERO_BADGE: "연세대 미래캠",
    HERO_TITLE: "연세대학교 미래캠퍼스 버스 시간표",
    HERO_SUBTITLE: "30번, 34번, 34-1번 종합 운행 정보 (실시간 출발 시각)",
    TITLE: "연세대학교 미래캠퍼스 버스 시간표",
    SUBTITLE: "30번, 34번, 34-1번 종합 운행 정보",
    INFO_TITLE: "연세대 미래캠퍼스 노선 안내",
    INFO_DESC: "매지리(연세대)를 기점/종점으로 운행하는 주요 시내버스 노선입니다.",

    TAB_ALL: "전체 노선",
    TAB_30: "30번 (연세대)",
    TAB_34: "34번 (연세대)",
    TAB_34_1: "34-1번 (회촌)",

    BADGE_30: "30번 (연세대 출발)",
    BADGE_34: "34번 (연세대 출발)",
    BADGE_34_1: "34-1번 (회촌 출발)",
    BADGE_YONSEI: "연세대",
    BADGE_HOECHON: "회촌",

    VIA_LABEL: "주요 경유지",
    VIA_SHORT_LABEL: "주요 경유",
    VIA_30: "장양리 - 북원교 - 진광중고교 - 상지대학교 - 한라비발디아파트 - 단계현진아파트 - 고속시외버스터미널 - 베스타운 - 뜨란채 - 원주역 - 육민관고 - 흥업사거리 - 세동마을 - 연세대학교",
    VIA_34: "장양리 - 북원교 - 단계사거리 - 단계현진아파트 - 고속시외버스터미널 - YWCA - (→ 원일로 →/← 평원로 ←) - 남원로 남부시장 - 원주의료원 - 도형쇼핑 - 명륜소방서 - 오페라웨딩홀 - (← 원주역 ←) - 서곡삼거리 - 강원대학교 - 흥업사거리 - 세동마을 - 연세대학교",
    VIA_34_1: "장양리 - 북원교 - 단계사거리 - 단계현진아파트 - 고속시외버스터미널 - YWCA - (→ 원일로 →/← 평원로 ←) - 남원로 남부시장 - 원주의료원 - 도형쇼핑 - 명륜소방서 - 오페라웨딩홀 - 원주역 - 서곡삼거리 - 강원대학교 - 흥업사거리 - 세동마을 - 연세대학교 - 한촌 - 매지리 - 회촌",

    LOCATION_YONSEI: "연세대 출발",
    LOCATION_HOECHON: "회촌 출발",
    TIMETABLE_TITLE: (label: string) => `${label} 시간표`,

    MODE_OVERRIDE_LABEL: "운행 기준",
    MODE_AUTO_TOOLTIP: "자동 감지 (오늘 요일 기준)",
    MODE_WEEKDAY: "평일",
    MODE_WEEKDAY_TOOLTIP: "평일 기준 시간표",
    MODE_VACATION: "방학 · 휴일",
    MODE_VACATION_TOOLTIP: "방학 · 휴일 기준 시간표",

    STATUS_DEPARTING_SOON: "곧 출발",
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
    FOOTNOTE_ALL: "전체 보기",
    FOOTNOTE_CLEAR: "강조 해제",
    FOOTNOTE_COUNT_SUFFIX: (count: number) => `${count}회`,
    FOOTNOTE_TOOLTIP_ACTIVE: "클릭하여 이 비고 시간만 강조",
    FOOTNOTE_TOOLTIP_CLEAR: "클릭하여 각주 강조 해제",

    REFRESH_SUCCESS: "시간표 데이터가 원주시 ITS에서 새로 수집되어 갱신되었습니다.",
    REFRESH_INFO: "최소 갱신 시간이 지나지 않아 기존 저장소 JSON 데이터를 사용합니다.",
} as const;

// ============================================================================
// Timetable Strings
// ============================================================================

const TIMETABLE_STRINGS = {
    HERO_BADGE: "원주시 시내버스 시간표",
    HERO_TITLE: "노선별 운행 시간표",
    HERO_SUBTITLE: "시내버스의 기점/종점 출발 시각 및 실시간 정보",
    TITLE: "원주시내버스 운행 시간표",
    STATS_TOTAL_ROUTES: "등록 노선",
    STATS_BOOKMARKS: "즐겨찾기",

    BASE_DATETIME_LABEL: "기준 일시:",
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

// ============================================================================
// Yonsei Shuttle Strings
// ============================================================================

const YONSEI_SHUTTLE_STRINGS = {
    SHUTTLE_TITLE: "셔틀버스",
    HEADER_SUBTITLE: "연세대학교 미래캠퍼스 셔틀버스",
    SATURDAY_NO_RUN: "토요일 미운행",
    SERVICE_ENDED: "운행 종료",
    SATURDAY_NO_RUN_DESC: "토요일은 셔틀버스를 운행하지 않습니다 (시간표 및 정류장 위치 확인)",
    SERVICE_ENDED_DESC: "오늘 셔틀버스 운행이 종료되었습니다 (전체 시간표 및 정류장 확인)",
    VIEW_TIMETABLE: "시간표 보기",
    SUNDAY_SPECIAL_RUN: "일요일 특별운행",
    WEEKDAY_REGULAR_RUN: "평일 정규운행",
    NEXT_TO_CAMPUS: "다음 등교 셔틀 (캠퍼스행)",
    NEXT_FROM_CAMPUS: "다음 하교 셔틀 (캠퍼스발)",
    DEPARTING_SOON: "곧 출발",
    TIMETABLE_AND_STOPS: "시간표 & 정류장 위치",
    VIEW_DETAIL: "자세히 보기",
    TO_CAMPUS_TAB: "등교",
    FROM_CAMPUS_TAB: "하교",
    STOPS_LOCATION_TAB: "탑승 장소",
    USAGE_GUIDE_TAB: "이용 안내",
    FILTER_ALL: "전체",
    FILTER_WEEKDAY: "평일 운행",
    FILTER_SUNDAY: "일요일 특별편",
    SEARCH_PLACEHOLDER: "정류장명 (여주역, 터미널, 원주역, 세브란스 등) 또는 시간 검색...",
    TOTAL_RUNS: (count: number) => `총 ${count}회 운행`,
    NEXT_BUS: "다음 버스",
    DEPARTURE_PREFIX: "출발:",
    DEPARTURE_ORIGIN_PREFIX: "출발지:",
    ARRIVAL_LABEL: "도착",
    DESTINATION_SUFFIX: (dest: string) => `→ ${dest} 행`,
    VIA_AND_TIME: "경유 정류장 및 통과 시각",
    DROP_ONLY_STOPS: "하차 경유 정류장",
    NO_VIA_EXPRESS: "중간 경유지 없음 (직행 노선)",
    EMPTY_TO_CAMPUS: "검색 조건에 일치하는 등교 셔틀버스가 없습니다.",
    EMPTY_FROM_CAMPUS: "검색 조건에 일치하는 하교 셔틀버스가 없습니다.",
    GUIDELINES_TITLE: "무료 셔틀버스 이용 시 준수사항",
    GUIDELINES_DESC: "안전하고 쾌적한 통학을 위해 아래 안내사항을 반드시 숙지하여 주시기 바랍니다.",
    STOPS_NOTICE: "무료 셔틀버스는 지정된 탑승 장소에서만 승하차가 가능합니다. 출발 5분 전까지 대기해주세요.",
} as const;

// ============================================================================
// Chat (Square) Strings
// ============================================================================

const CHAT_STRINGS = {
    NO_MY_POSTS: "내가 작성한 글이 아직 없습니다.",
    NO_POSTS: "등록된 이야기가 없습니다.",
    FIRST_POST_HINT: "상단 입력창에서 첫 번째 스퀘어 이야기를 남겨보세요!",
    ENCRYPTED_PROFILE: "암호화된 익명 프로필",
    MY_PROFILE: "내 프로필",
    REALTIME_TREND: "실시간 트렌드",
    POPULAR_THREADS: "인기 스레드",
    CHANGE_NICKNAME: "익명 닉네임 변경",
    CHANGE_NICKNAME_DESC: "새로운 닉네임을 발급받습니다. 기존 작성한 글은 계속 보존됩니다.",
    RANDOM_GENERATE: "랜덤 생성",
    HOT_KEYWORDS: "실시간 화제의 키워드",
    TOAST_POST_SUCCESS: "스퀘어 광장에 글이 등록되었습니다.",
    TOAST_POST_ERROR: "글 등록 중 오류가 발생했습니다.",
    TOAST_REPLY_SUCCESS: "답글이 등록되었습니다.",
    TOAST_REPLY_ERROR: "답글 등록 중 오류가 발생했습니다.",
    CONFIRM_DELETE: "정말 이 글을 삭제하시겠습니까?",
    TOAST_DELETE_SUCCESS: "글이 삭제되었습니다.",
    TOAST_DELETE_FORBIDDEN: "삭제할 수 없습니다.",
    TOAST_LINK_COPIED: "글 링크가 클립보드에 복사되었습니다.",
    DEFAULT_ANONYMOUS: "익명",
    OPEN_PROFILE_TITLE: "내 스퀘어 프로필 열기",
    REFRESH_NICKNAME_TITLE: "랜덤 닉네임 새로고침",
    CHANGE_NICKNAME_BTN: "닉네임 변경",
    INPUT_PLACEHOLDER: "무슨 일이 일어나고 있나요?",
    POSTING: "게시 중...",
    POST_SUBMIT: "게시하기",
    SEARCH_TITLE: "검색",
    REFRESH_TITLE: "새로고침",
    RADAR_TITLE: "내 프로필 및 레이더 열기",
    HOT_TAB: "인기",
    SEARCH_PLACEHOLDER: "닉네임, #해시태그, 키워드 검색...",
    CLEAR_FILTER_TITLE: "필터 해제",
    STATUS_ACTIVE: "활동 중",
    STATUS_PARTICIPATING: "참여 중",
    MY_POSTS_COUNT_LABEL: "내 작성 글",
    MY_POSTS_AND_REPLIES: "내 작성글 / 댓글",
    MY_LIKED_COUNT_LABEL: "공감한 글",
    MY_LIKED_STORIES: "공감한 이야기",
    TREND_HASHTAGS: "실시간 트렌드 해시태그",
    HOT_DEBATE: "지금 뜨거운 HOT 토론",
    CLEAN_GUIDE: "스퀘어 클린 가이드",
    REPLY_PLACEHOLDER: "답글 내용을 입력하세요...",
    REPLY_POSTING: "등록 중...",
    REPLY_SUBMIT: "답글 등록",
    SHARE_TITLE: "공유",
    DELETE_TITLE: "삭제",
    REPLY_LABEL: "답글",
    POST_FAIL: "스퀘어 글 등록에 실패했습니다.",
    DELETE_FAIL: "스퀘어 글 삭제에 실패했습니다.",
} as const;

// ============================================================================
// Route Select Strings
// ============================================================================

const ROUTE_SELECT_STRINGS = {
    MODAL_TITLE: "노선 선택",
    MODAL_ARIA: "실시간 노선 선택기",
    SEARCH_PLACEHOLDER: "노선 번호 또는 행선지 검색 (예: 30, 연세대, 횡성, 문막...)",
    CLEAR_SEARCH_ARIA: "검색어 지우기",
    CATEGORY_ALL: (count: number) => `전체 (${count})`,
    CATEGORY_BOOKMARKS: (count: number) => `즐겨찾기 (${count})`,
    CATEGORY_YONSEI: "연세대 (30·34·34-1)",
    CAT_1_19: "1~19번",
    CAT_20_49: "20~49번",
    CAT_50_99: "50~99번",
    CAT_100_PLUS: "100번대+",
    CATEGORY_PUBLIC: "공영·순환",
    CURRENT_ROUTE_PREFIX: (route: string) => `현재: ${route}번`,
    TOTAL_ROUTES_COUNT: (count: number) => `원주시 실시간 버스 ${count}개 노선`,
    CAMPUS_ROUTES_LABEL: "연세대 캠퍼스 노선",
    RECENT_SEARCH_LABEL: "최근 조회:",
    NO_RESULTS_TITLE: "일치하는 노선이 없습니다",
    NO_BOOKMARKS_DESC: "즐겨찾기한 노선이 없습니다. 별표(★)를 눌러 노선을 등록해보세요.",
    NO_RESULTS_DESC: "노선 번호나 행선지를 다시 확인해 주세요.",
    VIEW_ALL_ROUTES_BTN: "전체 노선 보기",
    YONSEI_BADGE: "연세대",
    BOOKMARK_ADD_TITLE: "즐겨찾기 등록",
    BOOKMARK_REMOVE_TITLE: "즐겨찾기 해제",
    CURRENT_ROUTE_LABEL: "현재 노선:",
    DISPLAYED_COUNT: (count: number) => `${count}개 표시 중`,
    STOP_CURRENT_ROUTE: "현재 노선",
    STOP_NEARBY: "주변 정류장",
    SELECT_OTHER_ROUTE_TITLE: "다른 노선 선택하기 (검색/목록)",
    OPEN_ROUTE_SELECT_ARIA: "노선 선택 모달 열기",
} as const;

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
        ROUTE_LABEL: (route: string) => `${route}번`,
    },

    CONNECTION: {
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
    },

    TIME: {
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
    },

    ACCESSIBILITY: {
        MAIN_NAV: "메인 내비게이션",
        SKIP_LINK: "본문 바로가기",
        THEME_SWITCH: "화면 테마 변경",
        LOADING_APP: "앱 로딩 중",
        TOGGLE_SCHEDULE: "시간표 토글",
        ERROR_ICON: "오류",
        BUS_ICON_ALT: "버스",
        CLOSE_MODAL: "모달 닫기",
    },

    NAV: {
        HOME: "홈",
        BACK_LIST: "목록으로 돌아가기",
        SHOW_LIST: "버스 목록 보기",
        HIDE_LIST: "버스 목록 숨기기",
        BUS_LIST_LABEL: "버스 목록",
        NOTICE_OPEN_ARIA: "알림마당 열기",
        THEME_TOGGLE_LABEL: "화면 테마 변경",
    },

    TIMETABLE: TIMETABLE_STRINGS, TIMETABLE_HEADER: TIMETABLE_STRINGS,

    BOTTOM_NAV: {
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
    },

    YONSEI: YONSEI_STRINGS, YONSEI_TIMETABLE: YONSEI_STRINGS, YONSEI_SHUTTLE: YONSEI_SHUTTLE_STRINGS,

    CHAT: CHAT_STRINGS,

    ROUTE_SELECT: ROUTE_SELECT_STRINGS,

    BUS_SERVICE: {
        DATA_UPDATED: "시간표 데이터가 업데이트되었습니다.",
        TIMEOUT_MAINTAIN_CACHE: "서버 연결 시간 초과로 인해 신규 수집을 취소하고 기존 시간표를 유지합니다.",
        SERVER_TIMEOUT_FALLBACK: "서버 응답 지연으로 기존 시간표를 유지합니다.",
        REFRESH_ERROR: "시간표 갱신 처리 중 오류가 발생했습니다.",
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
        NO_RUNNING: "운행 중인 버스 없음",
        NO_RUNNING_DESC: "운행 중인 버스가 없습니다.",
        EMPTY_TODAY: "오늘 운행 예정인 버스가 없습니다.",
    },

    BUS_ITEM: {
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
    },

    MAP: {
        BUS_LOCATION_TITLE: "실시간 버스 위치", BUS_LOCATION_DESC: "지도에서 실시간으로 버스 위치를 확인하세요.",
    },

    STOP_POPUP: {
        STATION_ID_LABEL: "정류장 ID", STATION_ID_FALLBACK: "N/A",
    },

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
        SITE_NAME: "wBus",
        TITLE: "wBus",
        TITLE_TEMPLATE: "wBus / %s",
        DESC: "원주시 시내버스 실시간 위치 지도, 정류장 도착 정보 및 연세대 미래캠퍼스(30번·34번·34-1번·셔틀) 노선별 최신 운행 시간표",
        SHORT_DESC: "원주 시내버스 실시간 도착 정보 & 시간표",
        KEYWORDS: ["wBus", "더블유버스", "원주버스", "원주시내버스", "원주 버스 실시간", "원주 버스 시간표", "원주 버스 위치", "연세대 미래캠퍼스 버스", "연세대 미래캠 버스", "연세대 셔틀버스", "30번 버스", "34번 버스", "34-1번 버스", "원주시 교통정보",],
        OG_LOCALE: APP_LOCALE.OG_LOCALE,
        AUTHOR: "wBus",
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
        PREV_NOTICE_ARIA: "이전 최신공지",
        NEXT_NOTICE_ARIA: "다음 최신공지",
        NOTICE_INDEX_ARIA: (index: number) => `공지 ${index}`,
        REFRESH: "새로고침",
        ATTACHMENT: "첨부파일",
        ATTACHMENT_COUNT: (count: number) => `첨부파일 (${count})`,
        ATTACHMENT_EXIST_TITLE: "첨부파일 있음",
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
        TOTAL_COUNT_FORMAT: (count: number) => `전체 소식 (${count}건)`,
        TOTAL_COUNT_LABEL: "전체 소식",
        SUBTITLE: "Wonju Notice Center",
    },

    DATA_LABELS: {
        SCHEDULE_DATA: "시간표 데이터",
    },

    ROUTE_MAP: {
        ORIGIN: "기점", DESTINATION: "종점", FIRST_BUS: "첫차", LAST_BUS: "막차", INTERVAL: "배차간격", MINUTES_UNIT: "분",
    },

    FOOTER: {
        COPYRIGHT: "© 2026 wBus",
        DESCRIPTION: "시내버스 정보 서비스",
        LINKS: [{label: "이용약관", href: "/terms"}, {label: "개인정보처리방침", href: "/privacy"},],
        DISCLAIMER: "본 서비스는 참고용이며, 실제 운행 정보와 다를 수 있습니다.",
    },
} as const;

export const YONSEI_STATIC_TIMETABLES: Record<string, {
    weekday: YonseiDaySchedule; vacation: YonseiDaySchedule;
}> = {
    "30": {
        weekday: {
            origin: ["06:00", "06:30", "07:00", "07:20", "07:40", "08:00", "08:20", "08:40", "09:00", "09:20", "09:40", "10:00", "10:20", "10:40", "11:00", "11:20", "11:40", "12:00", "12:20", "12:40", "13:00", "13:20", "13:40", "14:00", "14:20", "14:40", "15:00", "15:20", "15:40", "16:00", "16:20", "16:40", "17:00", "17:20", "17:40", "18:00", "18:20", "18:40", "19:00", "19:20", "19:40", "20:00", "20:30", "21:00", "21:30", "22:00"],
            dest: ["06:40", "07:10", "07:45", "08:05", "08:25", "08:45", "09:05", "09:25", "09:45", "10:05", "10:25", "10:45", "11:05", "11:25", "11:45", "12:05", "12:25", "12:45", "13:05", "13:25", "13:45", "14:05", "14:25", "14:45", "15:05", "15:25", "15:45", "16:05", "16:25", "16:45", "17:05", "17:25", "17:45", "18:05", "18:25", "18:45", "19:05", "19:25", "19:45", "20:05", "20:25", "20:45", "21:15", "21:45", "22:15", "22:45"],
        }, vacation: {
            origin: ["06:00", "06:35", "07:10", "07:45", "08:20", "08:55", "09:30", "10:05", "10:40", "11:15", "11:50", "12:25", "13:00", "13:35", "14:10", "14:45", "15:20", "15:55", "16:30", "17:05", "17:40", "18:15", "18:50", "19:25", "20:00", "20:40", "21:20", "22:00"],
            dest: ["06:40", "07:15", "07:55", "08:30", "09:05", "09:40", "10:15", "10:50", "11:25", "12:00", "12:35", "13:10", "13:45", "14:20", "14:55", "15:30", "16:05", "16:40", "17:15", "17:50", "18:25", "19:00", "19:35", "20:10", "20:45", "21:25", "22:05", "22:45"],
        },
    }, "34": {
        weekday: {
            origin: ["06:05", "06:45", "07:25", "08:05", "08:45", "09:25", "10:05", "10:45", "11:25", "12:05", "12:45", "13:25", "14:05", "14:45", "15:25", "16:05", "16:45", "17:25", "18:05", "18:45", "19:25", "20:05", "20:45", "21:25", "22:05"],
            dest: ["06:50", "07:30", "08:10", "08:50", "09:30", "10:10", "10:50", "11:30", "12:10", "12:50", "13:30", "14:10", "14:50", "15:30", "16:10", "16:50", "17:30", "18:10", "18:50", "19:30", "20:10", "20:50", "21:30", "22:10", "22:50"],
        }, vacation: {
            origin: ["06:05", "06:55", "07:45", "08:35", "09:25", "10:15", "11:05", "11:55", "12:45", "13:35", "14:25", "15:15", "16:05", "16:55", "17:45", "18:35", "19:25", "20:15", "21:05", "21:55"],
            dest: ["06:50", "07:40", "08:30", "09:20", "10:10", "11:00", "11:50", "12:40", "13:30", "14:20", "15:10", "16:00", "16:50", "17:40", "18:30", "19:20", "20:10", "21:00", "21:50", "22:40"],
        },
    }, "34-1": {
        weekday: {
            origin: ["06:25", "07:05", "07:45", "08:25", "09:05", "09:45", "10:25", "11:05", "11:45", "12:25", "13:05", "13:45", "14:25", "15:05", "15:45", "16:25", "17:05", "17:45", "18:25", "19:05", "19:45", "20:25", "21:05", "21:45"],
            dest: ["07:10", "07:50", "08:30", "09:10", "09:50", "10:30", "11:10", "11:50", "12:30", "13:10", "13:50", "14:30", "15:10", "15:50", "16:30", "17:10", "17:50", "18:30", "19:10", "19:50", "20:30", "21:10", "21:50", "22:30"],
        }, vacation: {
            origin: ["06:30", "07:20", "08:10", "09:00", "09:50", "10:40", "11:30", "12:20", "13:10", "14:00", "14:50", "15:40", "16:30", "17:20", "18:10", "19:00", "19:50", "20:40", "21:30"],
            dest: ["07:15", "08:05", "08:55", "09:45", "10:35", "11:25", "12:15", "13:05", "13:55", "14:45", "15:35", "16:25", "17:15", "18:05", "18:55", "19:45", "20:35", "21:25", "22:15"],
        },
    },
};
