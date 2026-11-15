import type {WikiPageDocument} from "../types";

const SEED_TIMESTAMP = "2026-03-01T00:00:00.000Z";

export function createWonjuTerminalSeed(): WikiPageDocument {
    return {
        slug: "wonju-terminal",
        title: "원주 고속·시외버스터미널",
        subtitle: "시외버스 환승, 단계동 정류장 구분 및 연세대·혁신도시 방면 시내버스 안내",
        category: "terminal",
        cityCode: "32020",
        tags: ["원주터미널", "단계동", "환승", "시내버스"],
        version: 1,
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
        lastEditor: {
            nickname: "wBus 초기 데이터",
            editorId: "seed-system",
        },
        isProtected: false,
        linkedRoutes: [
            {
                routeNo: "30",
                cityCode: "32020",
                label: "30번",
                description: "터미널 ↔ 원주역 ↔ 흥업 ↔ 연세대 미래캠퍼스",
            },
            {
                routeNo: "34",
                cityCode: "32020",
                label: "34번",
                description: "터미널 ↔ 남부시장 ↔ 한라대 ↔ 연세대 미래캠퍼스",
            },
            {
                routeNo: "34-1",
                cityCode: "32020",
                label: "34-1번",
                description: "터미널 ↔ 원주역 ↔ 연세대 ↔ 회촌",
            },
        ],
        shuttle: null,
        boardingStops: [
            {
                id: "wonju-terminal-school-bound",
                number: 1,
                name: "고속시외버스터미널 (건너편 / 그랜드치과 앞)",
                shortName: "터미널 건너편",
                lat: 37.34383156887645,
                lng: 127.93212342388087,
                locationDescription: "연세대 방면 시내버스 및 학교행 무료 셔틀 승차",
                directionTag: "학교방면",
                tips: "터미널 정문에서 횡단보도를 건너 그랜드치과 앞 정류장을 이용하세요.",
            },
        ],
        markdownBody: `## 정류장 방향 구분하기

원주고속·시외버스터미널 앞 도로는 **터미널 앞**과 **건너편(그랜드치과 앞)**의 진행 방향이 반대이므로 탑승 전 방향을 꼭 확인해야 합니다.

- **연세대·흥업·시청 방면**: 터미널 건너편 정류장에서 [[route:32020:30]], [[route:32020:34]], [[route:32020:34-1]] 탑승
- **장양리·태장동·우산동 방면**: 터미널 정문 앞 정류장에서 탑승

## 연계 허브 문서

- [[yonsei-mirae|연세대학교 미래캠퍼스 버스·셔틀 위키]]
- [[wonju-station|KTX 원주역 환승 가이드]]

> [!TIP]
> 고속버스 하차 후 [[roadview:37.343832,127.932123,터미널 건너편 정류장]]을 미리 확인해 두면 초행길에도 정류장을 쉽게 찾을 수 있습니다.
`,
    };
}

export function createWonjuStationSeed(): WikiPageDocument {
    return {
        slug: "wonju-station",
        title: "원주역 (무실동 KTX)",
        subtitle: "중앙선 KTX 원주역 시내버스·셔틀버스 승차장 위치 및 환승 팁",
        category: "terminal",
        cityCode: "32020",
        tags: ["원주역", "KTX", "무실동", "환승"],
        version: 1,
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
        lastEditor: {
            nickname: "wBus 초기 데이터",
            editorId: "seed-system",
        },
        isProtected: false,
        linkedRoutes: [
            {
                routeNo: "30",
                cityCode: "32020",
                label: "30번",
                description: "장양리 ↔ 터미널 ↔ 원주역 ↔ 연세대",
            },
            {
                routeNo: "34-1",
                cityCode: "32020",
                label: "34-1번",
                description: "장양리 ↔ 남부시장 ↔ 원주역 ↔ 회촌",
            },
        ],
        shuttle: null,
        boardingStops: [
            {
                id: "wonju-station-platform",
                number: 1,
                name: "원주역 시내버스·셔틀 승강장",
                shortName: "원주역 승강장",
                lat: 37.31512706798006,
                lng: 127.92217451425046,
                locationDescription: "원주역 출구에서 도보 이동 후 시내버스/셔틀 승강장 이용",
                directionTag: "공통",
                tips: "열차 도착 직후에는 택시·버스 대기줄이 길 수 있으니 셔틀 시간표를 먼저 확인하세요.",
            },
        ],
        markdownBody: `## KTX 원주역 버스 이용 팁

2021년 무실동으로 이전한 신 원주역에서는 역 광장 앞 승강장에서 시내버스와 [[yonsei-mirae|연세대 미래캠퍼스 셔틀]]을 이용할 수 있습니다.

- **연세대 미래캠퍼스 방면**: [[route:32020:30]], [[route:32020:34-1]] (시내버스) 또는 평일 지정 시각 셔틀 이용
- **시청·원주터미널 방면**: 시내 방향 정류장에서 환승 가능

> [!NOTE]
> 역 주변 도로 공사나 행사로 승강장 위치가 임시 변경될 경우 이 문서를 바로 수정해 주세요!
`,
    };
}
