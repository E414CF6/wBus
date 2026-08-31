import type {Metadata} from "next";
import {MainApp} from "@widgets/AppShell";

export const metadata: Metadata = {
    title: "wBus", description: "연세대 미래캠퍼스 30, 34, 34-1번 및 원주시 시내버스 운행 시간표와 실시간 버스 정보",
};

export default function HomePage() {
    return <MainApp/>;
}
