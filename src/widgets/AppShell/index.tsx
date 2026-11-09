"use client";

import React, {Suspense} from "react";
import {AppShell} from "./AppShell";

export function MainApp() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#090d16]"/>}>
            <AppShell/>
        </Suspense>
    );
}

export default MainApp;
