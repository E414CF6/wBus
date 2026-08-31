"use client";

import React, {Suspense} from "react";
import {AppShell} from "./AppShell";

export function MainApp() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19]"/>}>
            <AppShell/>
        </Suspense>
    );
}

export default MainApp;
