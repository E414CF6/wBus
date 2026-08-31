import type {Metadata} from "next";
import {MainApp} from "@widgets/AppShell";

export const metadata: Metadata = {
    title: "실시간 지도", description: "원주시 시내버스 실시간 GPS 위치 및 노선 지도",
};

export default function MapPage() {
    return <MainApp/>;
}
