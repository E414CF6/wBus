import {type NextRequest} from "next/server";
import {POST as refreshSchedulePost} from "../../schedule/refresh/route";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    return refreshSchedulePost(request);
}

