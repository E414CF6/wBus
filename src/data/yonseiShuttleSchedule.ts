export interface ShuttleStopLocation {
    name: string;
    location_description: string;
}

export interface ShuttleViaStop {
    name: string;
    time?: string | null;
    is_fixed_time?: boolean;
}

export interface ShuttleInboundItem {
    operation_type: string; // "평일 운행" | "일요일 특별편"
    departure_point: string;
    departure_time: string;
    via: ShuttleViaStop[];
    destination: string;
    note?: string | null;
}

export interface ShuttleOutboundItem {
    operation_type: string; // "평일 운행" | "일요일 운행"
    departure_point: string;
    departure_time: string;
    destination: string;
    via: ShuttleViaStop[];
    note?: string | null;
}

export interface ShuttleBusScheduleData {
    title: string;
    stop_locations: ShuttleStopLocation[];
    inbound_to_campus: ShuttleInboundItem[];
    outbound_from_campus: ShuttleOutboundItem[];
    guidelines: string[];
}

export const YONSEI_SHUTTLE_SCHEDULE: ShuttleBusScheduleData = {
    title: "여주·원주 지역 무료셔틀버스 시간표",
    stop_locations: [{
        name: "원주고속터미널 (원주버스터미널)", location_description: "원주고속터미널 건너편 그랜드 치과 병원 앞",
    }, {
        name: "원주역", location_description: "원주역 시내버스정류장",
    }, {
        name: "시청사거리 (무실동)", location_description: "원주 시청사거리 - 원주중부교회와 SK엔크린 주유소 사이 대로변",
    }, {
        name: "만종역 / 여주역", location_description: "버스정류장",
    }, {
        name: "매지리 (청솔아파트)", location_description: "등교 - 청솔아파트 횡단보도 부근 승차 / 하교 - 버스정류장 하차",
    }, {
        name: "원주세브란스 장례식장", location_description: "원주세브란스기독병원 장례식장 주차장 앞",
    },],
    inbound_to_campus: [{
        operation_type: "평일 운행", departure_point: "여주역", departure_time: "07:13", via: [{
            name: "원주고속터미널", time: "07:53", is_fixed_time: true,
        }, {
            name: "원주시청사거리(무실동)", time: null, is_fixed_time: false,
        }, {
            name: "원주역", time: "08:05", is_fixed_time: true,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행", departure_point: "여주역", departure_time: "07:30", via: [{
            name: "원주고속터미널", time: "08:12", is_fixed_time: true,
        }, {
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "원주역", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: "08:32", is_fixed_time: true,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행",
        departure_point: "여주역",
        departure_time: "12:15",
        via: [],
        destination: "미래캠퍼스",
        note: null,
    }, {
        operation_type: "평일 운행",
        departure_point: "여주역",
        departure_time: "14:20",
        via: [],
        destination: "미래캠퍼스",
        note: "직행 버스",
    }, {
        operation_type: "평일 운행",
        departure_point: "여주역",
        departure_time: "17:50",
        via: [],
        destination: "미래캠퍼스",
        note: null,
    }, {
        operation_type: "평일 운행",
        departure_point: "원주역(시내버스정류장)",
        departure_time: "12:23",
        via: [],
        destination: "미래캠퍼스",
        note: "직행 버스",
    }, {
        operation_type: "평일 운행", departure_point: "원주고속터미널 건너편 그랜드치과", departure_time: "14:30", via: [{
            name: "시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행", departure_point: "원주고속터미널 건너편 그랜드치과", departure_time: "15:40", via: [{
            name: "시청사거리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행", departure_point: "원주고속터미널 건너편 그랜드치과", departure_time: "17:15", via: [{
            name: "시청사거리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행", departure_point: "원주세브란스 장례식장 주차장 앞", departure_time: "12:50", via: [{
            name: "원주고속터미널", time: null, is_fixed_time: false,
        }, {
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행", departure_point: "원주세브란스 장례식장 주차장 앞", departure_time: "16:40", via: [{
            name: "원주고속터미널", time: null, is_fixed_time: false,
        }, {
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행", departure_point: "원주세브란스 장례식장 주차장 앞", departure_time: "17:50", via: [{
            name: "원주고속터미널", time: null, is_fixed_time: false,
        }, {
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행", departure_point: "만종역 버스정류장", departure_time: "08:20", via: [{
            name: "원주고속터미널", time: "08:31", is_fixed_time: true,
        }, {
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "평일 운행", departure_point: "만종역 버스정류장", departure_time: "09:20", via: [{
            name: "원주고속터미널", time: "09:30", is_fixed_time: true,
        }, {
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: null,
    }, {
        operation_type: "일요일 특별편", departure_point: "원주고속터미널 건너편 그랜드치과", departure_time: "18:00", via: [{
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "원주역", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: "일요일 운행",
    }, {
        operation_type: "일요일 특별편", departure_point: "원주고속터미널 건너편 그랜드치과", departure_time: "19:40", via: [{
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "원주역", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: "일요일 운행",
    }, {
        operation_type: "일요일 특별편", departure_point: "원주고속터미널 건너편 그랜드치과", departure_time: "20:40", via: [{
            name: "원주시청사거리", time: null, is_fixed_time: false,
        }, {
            name: "원주역", time: null, is_fixed_time: false,
        }, {
            name: "매지리", time: null, is_fixed_time: false,
        },], destination: "미래캠퍼스", note: "일요일 운행",
    },],
    outbound_from_campus: [{
        operation_type: "평일 운행",
        departure_point: "미래관",
        departure_time: "13:00",
        destination: "여주역",
        via: [],
        note: "여주역 직행",
    }, {
        operation_type: "평일 운행",
        departure_point: "미래관",
        departure_time: "17:00",
        destination: "여주역",
        via: [],
        note: null,
    }, {
        operation_type: "평일 운행", departure_point: "미래관", departure_time: "16:10", destination: "만종역", via: [{
            name: "매지리", time: null,
        }, {
            name: "원주역", time: null,
        }, {
            name: "시청사거리", time: null,
        }, {
            name: "원주고속터미널", time: null,
        },], note: null,
    }, {
        operation_type: "평일 운행", departure_point: "미래관", departure_time: "17:50", destination: "만종역", via: [{
            name: "매지리", time: null,
        },], note: "목요일만 만종역 경유 후 여주역까지 연장운행 (매주 목요일: 매지리→만종역→여주역)",
    }, {
        operation_type: "평일 운행", departure_point: "미래관", departure_time: "14:00", destination: "원주고속터미널", via: [{
            name: "매지리", time: null,
        }, {
            name: "원주역", time: null,
        }, {
            name: "시청사거리", time: null,
        },], note: null,
    }, {
        operation_type: "평일 운행", departure_point: "미래관", departure_time: "15:00", destination: "원주고속터미널", via: [{
            name: "매지리", time: null,
        }, {
            name: "원주역", time: null,
        }, {
            name: "시청사거리", time: null,
        },], note: null,
    }, {
        operation_type: "평일 운행", departure_point: "미래관", departure_time: "16:50", destination: "원주고속터미널", via: [{
            name: "원주역", time: null,
        }, {
            name: "시청사거리", time: null,
        },], note: null,
    }, {
        operation_type: "평일 운행", departure_point: "미래관", departure_time: "12:05", destination: "원주세브란스 장례식장", via: [{
            name: "매지리", time: null,
        }, {
            name: "원주역", time: null,
        }, {
            name: "시청사거리", time: null,
        }, {
            name: "원주고속터미널", time: null,
        },], note: null,
    }, {
        operation_type: "평일 운행", departure_point: "미래관", departure_time: "16:10", destination: "원주세브란스 장례식장", via: [{
            name: "매지리", time: null,
        }, {
            name: "시청사거리", time: null,
        }, {
            name: "원주고속터미널", time: null,
        },], note: "원주역 미정차",
    }, {
        operation_type: "평일 운행", departure_point: "미래관", departure_time: "17:15", destination: "원주세브란스 장례식장", via: [{
            name: "매지리", time: null,
        }, {
            name: "시청사거리", time: null,
        }, {
            name: "원주고속터미널", time: null,
        },], note: null,
    }, {
        operation_type: "일요일 운행", departure_point: "미래관", departure_time: "18:45", destination: "원주고속터미널", via: [{
            name: "매지리", time: null,
        }, {
            name: "원주역", time: null,
        }, {
            name: "시청사거리", time: null,
        },], note: "일요일 운행",
    }, {
        operation_type: "일요일 운행", departure_point: "미래관", departure_time: "20:05", destination: "원주고속터미널", via: [{
            name: "매지리", time: null,
        }, {
            name: "원주역", time: null,
        }, {
            name: "시청사거리", time: null,
        },], note: "일요일 운행",
    },],
    guidelines: ["버스는 정시 출발합니다. 출발 5분 전까지 탑승 완료 바랍니다.", "주말(일요일) 등교 노선은 예약 인원이 21명 이하일 경우 배차가 취소되며, 취소시 문자로 개별 통지합니다.", "차량 고장 또는 기타 부득이한 사정으로 운행이 불가능할 수 있으며, 도로 사정 등으로 버스탑승 시각이 지연될 수 있습니다.", "미래캠퍼스발 셔틀버스 탑승 후 매지리에서 하차를 원하실 경우 버스 기사님께 미리 말씀해 주세요.", "효율적 운영을 위해 시간이 변동될 수 있으니 공지사항을 수시로 확인해주시기 바랍니다.",],
};
