import {ROUTE_CONFIG, TARGET_ROUTE_NUMBERS} from "@entities/route";
import {YONSEI_SHUTTLE_SCHEDULE} from "@entities/schedule/yonseiShuttleSchedule";
import {YONSEI_SHUTTLE_STOPS} from "@entities/station/yonseiShuttleStops";
import type {WikiPageDocument} from "../types";

const SEED_TIMESTAMP = "2026-03-01T00:00:00.000Z";

export const YONSEI_MIRAE_WIKI_SLUG = "yonsei-mirae";

export function createYonseiMiraeSeed(): WikiPageDocument {
    return {
        slug: YONSEI_MIRAE_WIKI_SLUG,
        title: "연세대학교 미래캠퍼스",
        subtitle: "무료 셔틀버스 · 시내버스(30·34·34-1) 시간표와 탑승 위치, 학우들이 직접 업데이트하는 통학 위키",
        category: "campus",
        cityCode: "32020",
        tags: ["연세대 미래캠퍼스", "원주", "셔틀버스", "30번", "34번", "34-1번"],
        version: 1,
        createdAt: SEED_TIMESTAMP,
        updatedAt: SEED_TIMESTAMP,
        lastEditor: {
            nickname: "wBus 초기 데이터",
            editorId: "seed-system",
        },
        isProtected: false,
        linkedRoutes: TARGET_ROUTE_NUMBERS.map((routeNo) => {
            const cfg = ROUTE_CONFIG[routeNo];
            return {
                routeNo,
                cityCode: "32020",
                label: cfg?.name ?? `${routeNo}번`,
                description: cfg?.description ?? "",
                destLabel: cfg?.destLabel ?? "연세대 출발",
                originLabel: cfg?.originLabel ?? "장양리 출발",
                viaStops: cfg?.viaStops ?? "",
            };
        }),
        shuttle: {
            enabled: true,
            title: YONSEI_SHUTTLE_SCHEDULE.title,
            stop_locations: YONSEI_SHUTTLE_SCHEDULE.stop_locations.map((s) => ({...s})),
            inbound_to_campus: YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus.map((item) => ({
                ...item,
                via: item.via.map((v) => ({...v})),
            })),
            outbound_from_campus: YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus.map((item) => ({
                ...item,
                via: item.via.map((v) => ({...v})),
            })),
            guidelines: [...YONSEI_SHUTTLE_SCHEDULE.guidelines],
        },
        boardingStops: YONSEI_SHUTTLE_STOPS.map((stop) => ({...stop})),
        markdownBody: `## 캠퍼스 통학 핵심 요약

연세대학교 미래캠퍼스(매지리)와 원주 시내·기차역을 잇는 주요 교통편은 **무료 교내 셔틀버스**와 **원주 시내버스([[route:32020:30]], [[route:32020:34]], [[route:32020:34-1]])**입니다.

> [!TIP]
> 학기 중 시간표 변경, 임시 탑승 장소 이동, 공사 우회, 시험기간 증차 등 변동 사항이 생기면 상단 **편집** 버튼으로 학우들과 바로 공유해 주세요!

## 시내버스 노선별 선택 가이드

| 노선 | 주요 경유지 | 특징 및 추천 대상 |
| :--- | :--- | :--- |
| [[route:32020:30]] | 장양리 ↔ 터미널 ↔ 원주역 ↔ 흥업 ↔ 연세대 | 배차가 가장 잦은 핵심 간선 노선 (일부 시간대 상지대 경유) |
| [[route:32020:34]] | 장양리 ↔ 남부시장 ↔ 의료원 ↔ 한라대 ↔ 연세대 | 남부시장·원주의료원·시내 중심가(원일로/평원로) 이용 시 유리 |
| [[route:32020:34-1]] | 장양리 ↔ 남부시장 ↔ 원주역 ↔ 연세대 ↔ 매지리/회촌 | 회촌 종점 노선으로 매지리·청솔아파트 방면 연계 |

## 기차역 · 터미널 환승 팁

- **KTX 원주역(무실동)**: 시내버스 [[route:32020:30]] 또는 [[route:32020:34-1]]을 이용하거나, 시간대가 맞다면 [[wonju-station|원주역 환승 위키]]에 정리된 무료 셔틀을 이용하세요.
- **원주고속·시외버스터미널**: 터미널 건너편 정류장에서 [[route:32020:30]]·[[route:32020:34]] 탑승이 가능하며, 셔틀은 그랜드치과병원 앞에서 출발합니다. 자세한 위치는 [[wonju-terminal|원주터미널 위키]]에서도 확인할 수 있습니다.
- **만종역(KTX 강릉선)**: 등·하교 무료 셔틀 직통편이 하루 2~3회 운행됩니다.

> [!NOTE]
> 토요일 및 법정 공휴일에는 무료 셔틀버스가 운행하지 않으며, 시내버스는 **방학·휴일 감축 시간표**로 운행될 수 있습니다. 상단 설정에서 \`평일\` / \`방학·휴일\` 기준을 수동 전환해 확인하세요.
`,
    };
}
