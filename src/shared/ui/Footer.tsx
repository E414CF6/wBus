"use client";

import React from "react";
import Link from "next/link";

import {UI_TEXT} from "@shared/config/locale";

export function Footer() {
    return (
        <footer className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <div className="flex flex-wrap items-center justify-center gap-2.5 text-[11px] sm:text-xs">
                {UI_TEXT.FOOTER.LINKS.map((link) => (
                    <React.Fragment key={link.label}>
                        <Link
                            href={link.href}
                            className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors font-bold underline underline-offset-4"
                        >
                            {link.label}
                        </Link>
                        <span className="text-slate-300 dark:text-slate-700 font-normal">|</span>
                    </React.Fragment>
                ))}
                <span>{UI_TEXT.FOOTER.COPYRIGHT}</span>
            </div>
        </footer>
    );
}