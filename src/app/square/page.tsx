import type {Metadata} from "next";
import {MainApp} from "@widgets/AppShell";

export const metadata: Metadata = {
    title: "스퀘어", description: "실시간 소통, 제보 및 꿀팁 커뮤니티 광장",
};

export default function SquarePage() {
    return <MainApp/>;
}
