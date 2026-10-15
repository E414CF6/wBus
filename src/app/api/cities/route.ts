import {type NextRequest, NextResponse} from "next/server";

import {findNearestCity, getCityByCode, NATIONWIDE_CITIES, searchCities} from "@entities/city";

export const dynamic = "force-static";
export const revalidate = 86400; // 24 hours ISR

export async function GET(request: NextRequest) {
    try {
        const {searchParams} = request.nextUrl;
        const query = searchParams.get("query");
        const province = searchParams.get("province");
        const code = searchParams.get("code");
        const latParam = searchParams.get("lat");
        const lngParam = searchParams.get("lng");
        const isGrouped = searchParams.get("grouped") === "true";

        // 1. Direct code lookup
        if (code) {
            const city = getCityByCode(code);
            return NextResponse.json({success: true, city});
        }

        // 2. Nearest city lookup via GPS coordinates
        if (latParam && lngParam) {
            const lat = parseFloat(latParam);
            const lng = parseFloat(lngParam);
            if (!isNaN(lat) && !isNaN(lng)) {
                const nearest = findNearestCity(lat, lng);
                return NextResponse.json({success: true, nearest});
            }
        }

        // 3. Search / Filter
        let results = query ? searchCities(query) : NATIONWIDE_CITIES;
        if (province && province !== "전국") {
            results = results.filter((c) => c.province === province);
        }

        // 4. Grouped by Province
        if (isGrouped) {
            const grouped: Record<string, typeof results> = {};
            for (const city of results) {
                if (!grouped[city.province]) {
                    grouped[city.province] = [];
                }
                grouped[city.province].push(city);
            }
            return NextResponse.json(
                {success: true, total: results.length, grouped},
                {
                    headers: {
                        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
                    },
                }
            );
        }

        return NextResponse.json(
            {success: true, total: results.length, cities: results},
            {
                headers: {
                    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
                },
            }
        );
    } catch (error) {
        console.error("API /api/cities error:", error);
        return NextResponse.json(
            {success: false, error: "도시 목록 조회에 실패했습니다."},
            {status: 500}
        );
    }
}
