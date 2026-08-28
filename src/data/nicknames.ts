export const RANDOM_NICKNAMES = [// 연세대 미래캠퍼스 및 원주 테마
    "매지호 오리", "학관 셔틀러", "34번 막차요정", "독수리 기숙사생", "백양로 산책러", "공학관 야행성", "미래캠 버스마스터", "키스로드 낭만파", "세연학사 통학생", "정의관 열공러", "창조관 실험맨", "매지리 카페투어", "청송관 벼락치기", "도서관 3층 상주자", "매지호 노을배경", "31번 버스 수호자", "30번 단골승객", "34-1번 타임트래블러", "원주역 타임어택", "만종역 KTX 환승러", "매지리 야식탐험대", "수강신청 금손", "학관 돈까스 마스터", "백양관 엘베러", "미래도서관 지박령", "독수리광장 비둘기", "연세프라자 단골", "원주캠 마스코트", "통학버스 1열 사수", "새벽 셔틀 승객", "무실동 통학생", "단계동 환승러", "혁신도시 셔틀러", "기업도시 원정대", "매지 삼거리 질주러", "세연 긱사생",

    // 대학생 및 일상 공감 테마
    "월요일이 싫은 사람", "오늘도 아메리카노", "이불 밖은 위험해", "교양 수업 영혼 탈곡기", "통장 잔고 300원", "카페인으로 호흡 중", "과제 제출 1분 전", "출석체크 턱걸이", "졸업시켜주세요", "A+ 수집가 꿈나무", "학점 심폐소생술사", "학점 4.5 요정", "자체 휴강 유혹자", "교재 찍먹파", "교수님 제발요", "팀플 총대 메기", "조별과제 무임승차 거부자", "밤샘 전문 연구원", "알람 10개 설정", "방학만 바라보는 해바라기", "멘탈 쿠쿠다스", "프로 지각러 탈출기", "시험기간 카페 죽돌이", "종강 바라기", "학식 푸드파이터", "존예 인플루언서", "존잘 남학생"];

/**
 * 무작위 닉네임을 반환합니다.
 * @param exclude 이전 닉네임과 중복을 피하고 싶을 때 제외할 닉네임
 */
export function getRandomNickname(exclude?: string): string {
    const pool = exclude && RANDOM_NICKNAMES.length > 1 ? RANDOM_NICKNAMES.filter((name) => name !== exclude) : RANDOM_NICKNAMES;

    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}

/**
 * 7자리 랜덤 해시태그(예: '#d67qe62')를 생성합니다.
 */
export function generateUserTag(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `#${result}`;
}
