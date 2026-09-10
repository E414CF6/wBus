import {type NextRequest} from "next/server";
import {GET as getSchedule} from "../schedule/route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    return getSchedule(request);
}

