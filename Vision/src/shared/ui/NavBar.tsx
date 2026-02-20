"use client";

import { MapIcon } from "lucide-react";

import { APP_CONFIG } from "@core/config/env";

interface NavBarProps {
    className?: string;
}

/**
 * Floating Navigation Bar / Header.
 * Displays the App Logo and Name in a glassmorphism "pill" style.
 */
export default function NavBar({ className = "" }: NavBarProps) {
    return (
        <nav
            aria-label="Main Navigation"
            className={`absolute top-[env(safe-area-inset-top,1rem)] left-4 z-50 mt-4 ${className}`}
        >
            <div
                className="
          flex items-center gap-3 p-2.5 pr-5 
          bg-white/80 dark:bg-[#111111]/80 backdrop-blur-3xl 
          border border-black/[0.04] dark:border-white/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-[24px]
          transition-transform hover:scale-105 active:scale-95 cursor-default
        "
            >
                {/* Logo Icon Container */}
                <div className="flex items-center justify-center w-[34px] h-[34px] rounded-[14px] bg-black dark:bg-white text-white dark:text-black">
                    <MapIcon className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                </div>

                {/* App Title */}
                <h1 className="text-[16px] font-extrabold text-black dark:text-white tracking-tight select-none">
                    {APP_CONFIG.NAME}
                </h1>
            </div>
        </nav>
    );
}
