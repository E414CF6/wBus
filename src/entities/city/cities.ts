import type {CityInfo} from "./types";

/**
 * Standard nationwide city codes provided by MOLIT TAGO API & Seoul TOPIS (139 cities/counties)
 */
export const NATIONWIDE_CITIES: CityInfo[] = [
    // 특별시 / 광역시 / 특별자치시 / 특별자치도
    {code: "11", name: "서울특별시", province: "서울특별시", lat: 37.5665, lng: 126.9780, zoom: 12, isMajor: true},
    {code: "12", name: "세종특별자치시", province: "세종특별자치시", lat: 36.4800, lng: 127.2890, zoom: 12, isMajor: true},
    {code: "21", name: "부산광역시", province: "부산광역시", lat: 35.1796, lng: 129.0756, zoom: 12, isMajor: true},
    {code: "22", name: "대구광역시", province: "대구광역시", lat: 35.8714, lng: 128.6014, zoom: 12, isMajor: true},
    {code: "23", name: "인천광역시", province: "인천광역시", lat: 37.4563, lng: 126.7052, zoom: 12, isMajor: true},
    {code: "24", name: "광주광역시", province: "광주광역시", lat: 35.1595, lng: 126.8526, zoom: 12, isMajor: true},
    {code: "25", name: "대전광역시/계룡시", province: "대전광역시", lat: 36.3504, lng: 127.3845, zoom: 12, isMajor: true},
    {code: "26", name: "울산광역시", province: "울산광역시", lat: 35.5384, lng: 129.3114, zoom: 12, isMajor: true},
    {code: "39", name: "제주도", province: "제주특별자치도", lat: 33.4996, lng: 126.5312, zoom: 11, isMajor: true},

    // 경기도 (31개)
    {code: "31010", name: "수원시", province: "경기도", lat: 37.2636, lng: 127.0286, zoom: 13, isMajor: true},
    {code: "31020", name: "성남시", province: "경기도", lat: 37.4201, lng: 127.1265, zoom: 13, isMajor: true},
    {code: "31030", name: "의정부시", province: "경기도", lat: 37.7381, lng: 127.0337, zoom: 13},
    {code: "31040", name: "안양시", province: "경기도", lat: 37.3943, lng: 126.9568, zoom: 13},
    {code: "31050", name: "부천시", province: "경기도", lat: 37.5034, lng: 126.7660, zoom: 13},
    {code: "31060", name: "광명시", province: "경기도", lat: 37.4786, lng: 126.8647, zoom: 13},
    {code: "31070", name: "평택시", province: "경기도", lat: 36.9921, lng: 127.1129, zoom: 12},
    {code: "31080", name: "동두천시", province: "경기도", lat: 37.9036, lng: 127.0607, zoom: 13},
    {code: "31090", name: "안산시", province: "경기도", lat: 37.3219, lng: 126.8309, zoom: 13},
    {code: "31100", name: "고양시", province: "경기도", lat: 37.6584, lng: 126.8320, zoom: 13, isMajor: true},
    {code: "31110", name: "과천시", province: "경기도", lat: 37.4292, lng: 126.9877, zoom: 13},
    {code: "31120", name: "구리시", province: "경기도", lat: 37.5943, lng: 127.1296, zoom: 13},
    {code: "31130", name: "남양주시", province: "경기도", lat: 37.6360, lng: 127.2165, zoom: 12},
    {code: "31140", name: "오산시", province: "경기도", lat: 37.1498, lng: 127.0772, zoom: 13},
    {code: "31150", name: "시흥시", province: "경기도", lat: 37.3802, lng: 126.8029, zoom: 13},
    {code: "31160", name: "군포시", province: "경기도", lat: 37.3614, lng: 126.9352, zoom: 13},
    {code: "31170", name: "의왕시", province: "경기도", lat: 37.3448, lng: 126.9683, zoom: 13},
    {code: "31180", name: "하남시", province: "경기도", lat: 37.5393, lng: 127.2148, zoom: 13},
    {code: "31190", name: "용인시", province: "경기도", lat: 37.2411, lng: 127.1776, zoom: 12, isMajor: true},
    {code: "31200", name: "파주시", province: "경기도", lat: 37.7600, lng: 126.7799, zoom: 12},
    {code: "31210", name: "이천시", province: "경기도", lat: 37.2723, lng: 127.4350, zoom: 12},
    {code: "31220", name: "안성시", province: "경기도", lat: 37.0080, lng: 127.2798, zoom: 12},
    {code: "31230", name: "김포시", province: "경기도", lat: 37.6152, lng: 126.7156, zoom: 13},
    {code: "31240", name: "화성시", province: "경기도", lat: 37.1995, lng: 126.8315, zoom: 12},
    {code: "31250", name: "광주시", province: "경기도", lat: 37.4089, lng: 127.2550, zoom: 12},
    {code: "31260", name: "양주시", province: "경기도", lat: 37.7853, lng: 127.0458, zoom: 12},
    {code: "31270", name: "포천시", province: "경기도", lat: 37.8949, lng: 127.2003, zoom: 12},
    {code: "31320", name: "여주시", province: "경기도", lat: 37.2984, lng: 127.6370, zoom: 12},
    {code: "31350", name: "연천군", province: "경기도", lat: 38.0964, lng: 127.0749, zoom: 12},
    {code: "31370", name: "가평군", province: "경기도", lat: 37.8314, lng: 127.5096, zoom: 12},
    {code: "31380", name: "양평군", province: "경기도", lat: 37.4917, lng: 127.4876, zoom: 12},

    // 강원특별자치도 (6개)
    {code: "32010", name: "춘천시", province: "강원특별자치도", lat: 37.8813, lng: 127.7298, zoom: 13, isMajor: true},
    {code: "32020", name: "원주시/횡성군", province: "강원특별자치도", lat: 37.3421, lng: 127.9198, zoom: 13, isMajor: true},
    {code: "32050", name: "태백시", province: "강원특별자치도", lat: 37.1641, lng: 128.9856, zoom: 13},
    {code: "32310", name: "홍천군", province: "강원특별자치도", lat: 37.6972, lng: 127.8887, zoom: 12},
    {code: "32360", name: "철원군", province: "강원특별자치도", lat: 38.1468, lng: 127.3134, zoom: 12},
    {code: "32410", name: "양양군", province: "강원특별자치도", lat: 38.0754, lng: 128.6189, zoom: 12},

    // 충청북도 (10개)
    {code: "33010", name: "청주시", province: "충청북도", lat: 36.6424, lng: 127.4890, zoom: 13, isMajor: true},
    {code: "33020", name: "충주시", province: "충청북도", lat: 36.9910, lng: 127.9260, zoom: 13},
    {code: "33030", name: "제천시", province: "충청북도", lat: 37.1326, lng: 128.2141, zoom: 13},
    {code: "33320", name: "보은군", province: "충청북도", lat: 36.4895, lng: 127.7337, zoom: 12},
    {code: "33330", name: "옥천군", province: "충청북도", lat: 36.3063, lng: 127.5714, zoom: 12},
    {code: "33340", name: "영동군", province: "충청북도", lat: 36.1750, lng: 127.7836, zoom: 12},
    {code: "33350", name: "진천군", province: "충청북도", lat: 36.8554, lng: 127.4433, zoom: 12},
    {code: "33360", name: "괴산군", province: "충청북도", lat: 36.8153, lng: 127.7868, zoom: 12},
    {code: "33370", name: "음성군", province: "충청북도", lat: 36.9402, lng: 127.6906, zoom: 12},
    {code: "33380", name: "단양군", province: "충청북도", lat: 36.9845, lng: 128.3656, zoom: 12},

    // 충청남도 (13개)
    {code: "34010", name: "천안시", province: "충청남도", lat: 36.8151, lng: 127.1139, zoom: 13, isMajor: true},
    {code: "34020", name: "공주시", province: "충청남도", lat: 36.4465, lng: 127.1190, zoom: 13},
    {code: "34030", name: "보령시", province: "충청남도", lat: 36.3330, lng: 126.6129, zoom: 13},
    {code: "34040", name: "아산시", province: "충청남도", lat: 36.7898, lng: 127.0019, zoom: 13},
    {code: "34050", name: "서산시", province: "충청남도", lat: 36.7845, lng: 126.4503, zoom: 13},
    {code: "34060", name: "논산시", province: "충청남도", lat: 36.1872, lng: 127.0987, zoom: 13},
    {code: "34070", name: "계룡시", province: "충청남도", lat: 36.3135, lng: 127.2488, zoom: 13},
    {code: "34310", name: "금산군", province: "충청남도", lat: 36.1087, lng: 127.4881, zoom: 12},
    {code: "34330", name: "부여군", province: "충청남도", lat: 36.2757, lng: 126.9098, zoom: 12},
    {code: "34340", name: "서천군", province: "충청남도", lat: 36.0804, lng: 126.6917, zoom: 12},
    {code: "34350", name: "청양군", province: "충청남도", lat: 36.4589, lng: 126.8020, zoom: 12},
    {code: "34380", name: "태안군", province: "충청남도", lat: 36.7456, lng: 126.2974, zoom: 12},
    {code: "34390", name: "당진시", province: "충청남도", lat: 36.8899, lng: 126.6459, zoom: 12},

    // 전라북도 (14개)
    {code: "35010", name: "전주시", province: "전라북도", lat: 35.8242, lng: 127.1480, zoom: 13, isMajor: true},
    {code: "35020", name: "군산시", province: "전라북도", lat: 35.9676, lng: 126.7366, zoom: 13},
    {code: "35030", name: "익산시", province: "전라북도", lat: 35.9483, lng: 126.9576, zoom: 13},
    {code: "35040", name: "정읍시", province: "전라북도", lat: 35.5699, lng: 126.8577, zoom: 13},
    {code: "35050", name: "남원시", province: "전라북도", lat: 35.4164, lng: 127.3904, zoom: 13},
    {code: "35060", name: "김제시", province: "전라북도", lat: 35.8036, lng: 126.8809, zoom: 13},
    {code: "35320", name: "진안군", province: "전라북도", lat: 35.7917, lng: 127.4249, zoom: 12},
    {code: "35330", name: "무주군", province: "전라북도", lat: 36.0068, lng: 127.6609, zoom: 12},
    {code: "35340", name: "장수군", province: "전라북도", lat: 35.6474, lng: 127.5215, zoom: 12},
    {code: "35350", name: "임실군", province: "전라북도", lat: 35.6178, lng: 127.2809, zoom: 12},
    {code: "35360", name: "순창군", province: "전라북도", lat: 35.3744, lng: 127.1378, zoom: 12},
    {code: "35370", name: "고창군", province: "전라북도", lat: 35.4358, lng: 126.7021, zoom: 12},
    {code: "35380", name: "부안군", province: "전라북도", lat: 35.7317, lng: 126.7334, zoom: 12},

    // 전라남도 (17개)
    {code: "36010", name: "목포시", province: "전라남도", lat: 34.8118, lng: 126.3922, zoom: 13, isMajor: true},
    {code: "36020", name: "여수시", province: "전라남도", lat: 34.7604, lng: 127.6622, zoom: 13, isMajor: true},
    {code: "36030", name: "순천시", province: "전라남도", lat: 34.9507, lng: 127.4872, zoom: 13, isMajor: true},
    {code: "36040", name: "나주시", province: "전라남도", lat: 35.0161, lng: 126.7108, zoom: 13},
    {code: "36060", name: "광양시", province: "전라남도", lat: 34.9407, lng: 127.6959, zoom: 13},
    {code: "36320", name: "곡성군", province: "전라남도", lat: 35.2820, lng: 127.2922, zoom: 12},
    {code: "36330", name: "구례군", province: "전라남도", lat: 35.2025, lng: 127.4628, zoom: 12},
    {code: "36350", name: "고흥군", province: "전라남도", lat: 34.6110, lng: 127.2849, zoom: 12},
    {code: "36380", name: "장흥군", province: "전라남도", lat: 34.6817, lng: 126.9070, zoom: 12},
    {code: "36400", name: "해남군", province: "전라남도", lat: 34.5735, lng: 126.5989, zoom: 12},
    {code: "36410", name: "영암군", province: "전라남도", lat: 34.7997, lng: 126.6967, zoom: 12},
    {code: "36420", name: "무안군", province: "전라남도", lat: 34.9904, lng: 126.4817, zoom: 12},
    {code: "36430", name: "함평군", province: "전라남도", lat: 35.0659, lng: 126.5167, zoom: 12},
    {code: "36450", name: "장성군", province: "전라남도", lat: 35.3005, lng: 126.7849, zoom: 12},
    {code: "36460", name: "완도군", province: "전라남도", lat: 34.3110, lng: 126.7550, zoom: 12},
    {code: "36470", name: "진도군", province: "전라남도", lat: 34.4868, lng: 126.2634, zoom: 12},
    {code: "36480", name: "신안군", province: "전라남도", lat: 34.8335, lng: 126.3515, zoom: 11},

    // 경상북도 (22개)
    {code: "37010", name: "포항시", province: "경상북도", lat: 36.0190, lng: 129.3435, zoom: 13, isMajor: true},
    {code: "37020", name: "경주시", province: "경상북도", lat: 35.8562, lng: 129.2247, zoom: 13, isMajor: true},
    {code: "37030", name: "김천시", province: "경상북도", lat: 36.1399, lng: 128.1136, zoom: 13},
    {code: "37040", name: "안동시", province: "경상북도", lat: 36.5684, lng: 128.7294, zoom: 13},
    {code: "37050", name: "구미시", province: "경상북도", lat: 36.1195, lng: 128.3446, zoom: 13, isMajor: true},
    {code: "37060", name: "영주시", province: "경상북도", lat: 36.8057, lng: 128.6241, zoom: 13},
    {code: "37070", name: "영천시", province: "경상북도", lat: 35.9733, lng: 128.9385, zoom: 13},
    {code: "37080", name: "상주시", province: "경상북도", lat: 36.4109, lng: 128.1591, zoom: 13},
    {code: "37090", name: "문경시", province: "경상북도", lat: 36.5938, lng: 128.1865, zoom: 13},
    {code: "37100", name: "경산시", province: "경상북도", lat: 35.8251, lng: 128.7414, zoom: 13},
    {code: "37320", name: "의성군", province: "경상북도", lat: 36.3527, lng: 128.6971, zoom: 12},
    {code: "37330", name: "청송군", province: "경상북도", lat: 36.4357, lng: 129.0573, zoom: 12},
    {code: "37340", name: "영양군", province: "경상북도", lat: 36.6667, lng: 129.1122, zoom: 12},
    {code: "37350", name: "영덕군", province: "경상북도", lat: 36.4151, lng: 129.3656, zoom: 12},
    {code: "37360", name: "청도군", province: "경상북도", lat: 35.6474, lng: 128.7340, zoom: 12},
    {code: "37370", name: "고령군", province: "경상북도", lat: 35.7259, lng: 128.2625, zoom: 12},
    {code: "37380", name: "성주군", province: "경상북도", lat: 35.9195, lng: 128.2831, zoom: 12},
    {code: "37390", name: "칠곡군", province: "경상북도", lat: 35.9956, lng: 128.4016, zoom: 12},
    {code: "37400", name: "예천군", province: "경상북도", lat: 36.6576, lng: 128.4528, zoom: 12},
    {code: "37410", name: "봉화군", province: "경상북도", lat: 36.8931, lng: 128.7325, zoom: 12},
    {code: "37420", name: "울진군", province: "경상북도", lat: 36.9931, lng: 129.4007, zoom: 12},
    {code: "37430", name: "울릉군", province: "경상북도", lat: 37.4844, lng: 130.9056, zoom: 12},

    // 경상남도 (18개)
    {code: "38010", name: "창원시", province: "경상남도", lat: 35.2280, lng: 128.6811, zoom: 13, isMajor: true},
    {code: "38030", name: "진주시", province: "경상남도", lat: 35.1802, lng: 128.1076, zoom: 13, isMajor: true},
    {code: "38050", name: "통영시", province: "경상남도", lat: 34.8544, lng: 128.4332, zoom: 13},
    {code: "38060", name: "사천시", province: "경상남도", lat: 35.0038, lng: 128.0642, zoom: 13},
    {code: "38070", name: "김해시", province: "경상남도", lat: 35.2285, lng: 128.8894, zoom: 13, isMajor: true},
    {code: "38080", name: "밀양시", province: "경상남도", lat: 35.5038, lng: 128.7466, zoom: 13},
    {code: "38090", name: "거제시", province: "경상남도", lat: 34.8806, lng: 128.6211, zoom: 13},
    {code: "38100", name: "양산시", province: "경상남도", lat: 35.3350, lng: 129.0373, zoom: 13},
    {code: "38310", name: "의령군", province: "경상남도", lat: 35.3222, lng: 128.2618, zoom: 12},
    {code: "38320", name: "함안군", province: "경상남도", lat: 35.2724, lng: 128.4065, zoom: 12},
    {code: "38330", name: "창녕군", province: "경상남도", lat: 35.5414, lng: 128.4922, zoom: 12},
    {code: "38340", name: "고성군", province: "경상남도", lat: 34.9757, lng: 128.3228, zoom: 12},
    {code: "38350", name: "남해군", province: "경상남도", lat: 34.8377, lng: 127.8924, zoom: 12},
    {code: "38360", name: "하동군", province: "경상남도", lat: 35.0672, lng: 127.7513, zoom: 12},
    {code: "38370", name: "산청군", province: "경상남도", lat: 35.4154, lng: 127.8735, zoom: 12},
    {code: "38380", name: "함양군", province: "경상남도", lat: 35.5205, lng: 127.7252, zoom: 12},
    {code: "38390", name: "거창군", province: "경상남도", lat: 35.6867, lng: 127.9095, zoom: 12},
    {code: "38400", name: "합천군", province: "경상남도", lat: 35.5667, lng: 128.1658, zoom: 12},
];

export const DEFAULT_CITY: CityInfo = NATIONWIDE_CITIES.find((c) => c.code === "32020")!;

const cityMapByCode = new Map<string, CityInfo>();
NATIONWIDE_CITIES.forEach((c) => cityMapByCode.set(c.code, c));

export function getCityByCode(code?: string | null): CityInfo {
    if (!code) return DEFAULT_CITY;
    return cityMapByCode.get(code) || DEFAULT_CITY;
}

export function searchCities(query: string): CityInfo[] {
    const q = query.trim().toLowerCase();
    if (!q) return NATIONWIDE_CITIES;
    return NATIONWIDE_CITIES.filter(
        (c) => c.name.toLowerCase().includes(q) || c.province.toLowerCase().includes(q) || c.code.includes(q)
    );
}

/**
 * Finds the nearest city from a given coordinate (lat, lng) along with the approximate distance in km.
 * Uses flat-surface projection with latitude scaling (accurate to within 0.5% across South Korea).
 */
export function findNearestCityWithDistance(lat: number, lng: number): { city: CityInfo; distanceKm: number } {
    let nearest = DEFAULT_CITY;
    let minDistanceSq = Infinity;

    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);

    for (const city of NATIONWIDE_CITIES) {
        const dLat = (city.lat - lat) * 111.0;
        const dLng = (city.lng - lng) * 111.0 * cosLat;
        const distSq = dLat * dLat + dLng * dLng;
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            nearest = city;
        }
    }

    return {
        city: nearest,
        distanceKm: Math.sqrt(minDistanceSq),
    };
}

/**
 * Finds the nearest city from a given GPS coordinate (lat, lng)
 */
export function findNearestCity(lat: number, lng: number): CityInfo {
    return findNearestCityWithDistance(lat, lng).city;
}

