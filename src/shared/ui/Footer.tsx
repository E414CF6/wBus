"use client";

import Link from "next/link";
import {UI_TEXT} from "@shared/config/locale";

export function Footer() {
    return (
        <footer className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 font-medium space-y-2">
            <div className="flex items-center justify-center gap-3 text-[11px]">
                {UI_TEXT.FOOTER.LINKS.map((link) => (
                    <Link
                        key={link.label}
                        href={link.href}
                        className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors font-bold underline underline-offset-4"
                    >
                        {link.label}
                    </Link>
                ))}
            </div>
            <p>{UI_TEXT.FOOTER.COPYRIGHT} · {UI_TEXT.FOOTER.DESCRIPTION}</p>
        </footer>
    );
}
