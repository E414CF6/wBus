import type {Metadata} from "next";
import {MainApp} from "@widgets/AppShell";
import {UI_TEXT} from "@shared/config/locale";

export const metadata: Metadata = {
    title: UI_TEXT.METADATA.TITLE, description: UI_TEXT.METADATA.DESC, alternates: {
        canonical: "/",
    },
};

export default function HomePage() {
    return <MainApp/>;
}
