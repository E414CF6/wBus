import {type NextRequest} from "next/server";
import {POST as refreshSchedulePost} from "../../schedule/refresh/route";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    console.warn("[DEPRECATION] POST /api/bus/refresh is deprecated. Please migrate to POST /api/schedule/refresh.");
    const response = await refreshSchedulePost(request);
    response.headers.set("Deprecation", "true");
    response.headers.set("Link", '</api/schedule/refresh>; rel="alternate"');
    return response;
}

