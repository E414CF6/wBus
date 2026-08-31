"use client";

import {UI_TEXT} from "@shared/config/locale";

export function Footer() {
    return (
        <footer className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <p>{UI_TEXT.FOOTER.COPYRIGHT}</p>
        </footer>
    );
}
