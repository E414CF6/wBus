import {redirect} from "next/navigation";
import {buildPageHref, SPECIAL_PAGE_IDS} from "@shared/config/pages";

export default function YonseiLegacyRedirectPage() {
    redirect(buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE));
}
