import type {Metadata} from "next";
import {MainApp} from "@widgets/AppShell";

export const metadata: Metadata = {
    title: "실시간 톡 - wBus", description: "원주시 시내버스 이용자 실시간 소통, 운행 제보 및 꿀팁 커뮤니티",
};

export default function ChatPage() {
    return <MainApp/>;
}
