import type {Metadata} from "next";
import {MainApp} from "@widgets/AppShell";

export const metadata: Metadata = {
    title: "버스 시간표 - wBus", description: "원주시 시내버스 및 연세대 미래캠퍼스 노선별 운행 시간표",
};

export default function SchedulePage() {
    return <MainApp/>;
}
