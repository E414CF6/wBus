import {redirect} from "next/navigation";
import {YONSEI_MIRAE_WIKI_SLUG} from "@entities/wiki";

export default function YonseiLegacyRedirectPage() {
    redirect(`/wiki/${encodeURIComponent(YONSEI_MIRAE_WIKI_SLUG)}`);
}
