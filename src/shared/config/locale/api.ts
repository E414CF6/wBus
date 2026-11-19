export const API_STRINGS = {
    AUTH_REQUIRED: "인증되지 않은 요청입니다. (CRON_SECRET 또는 ADMIN_KEY 필요)",
    CITIES_FETCH_FAILED: "도시 목록 조회에 실패했습니다.",
    CITIES_ALL_PROVINCE: "전국",
    CRON_ROUTES_FAILED: "노선 갱신 실패",
    CRON_UNIFIED_FAILED: "통합 데이터셋 갱신 실패",
    NOTICE_INVALID_ID: "유효하지 않은 공지사항 ID입니다.",
    NOTICE_DETAIL_FAILED: "공지사항 상세 조회 실패",
    NOTICE_LIST_FAILED: "공지사항 조회 실패",
    ROUTES_REFRESH_FAILED: "노선 데이터 갱신 실패",
    SCHEDULE_REFRESH_FAILED: "시간표 갱신 실패",
    ROUTE_SYNC: {
        MISSING_API_KEY: "DATA_GO_KR_SERVICE_KEY 환경변수가 설정되지 않아 노선 데이터를 갱신할 수 없습니다.",
        FETCH_LIST_FAILED: (detail: string) => `공공데이터포털 노선 목록 조회 실패: ${detail}`,
        COMPLETE: (processed: number, skipped: number) =>
            `${processed}개 노선 갱신 완료 (${skipped}개 변경 없음 스킵).`,
    },
    SCHEDULE: {
        COOLDOWN_WAIT: (waitSec: number) => `방금 시간표를 갱신했습니다. ${waitSec}초 후 다시 시도해주세요.`,
        VALIDATION_REJECTED: (reason: string) =>
            `수집 데이터 검증 실패(${reason})로 기존 시간표를 유지합니다.`,
        SCRAPE_SUCCESS: (totalRoutes: number) =>
            `최신 시간표 (${totalRoutes}개 노선)를 성공적으로 수집하여 갱신했습니다.`,
        SCRAPE_FALLBACK: "서버 응답 지연으로 기존 저장된 최신 시간표를 유지합니다.",
        MIN_INTERVAL_WAIT: (days: number, nextAvailableStr: string) =>
            `최소 갱신 주기(${days}일)가 지나지 않아 기존 시간표를 사용합니다. (다음 갱신 가능: ${nextAvailableStr})`,
        FETCH_FAILED: "시간표 데이터를 불러올 수 없습니다.",
        REFRESH_FAILED: "시간표 갱신에 실패했습니다.",
        REFRESHED_TOAST: "최신 시간표로 갱신되었습니다.",
        UP_TO_DATE_TOAST: "최신 시간표가 이미 유지되고 있습니다.",
        REFRESH_ERROR_TOAST: "시간표 갱신 중 오류가 발생했습니다.",
        LOAD_ERROR: "시간표 데이터를 불러오는데 실패했습니다.",
    },
    DB: {
        MISSING_URL: "DATABASE_URL 또는 POSTGRES_URL 환경 변수가 설정되지 않았습니다.",
    },
} as const;
