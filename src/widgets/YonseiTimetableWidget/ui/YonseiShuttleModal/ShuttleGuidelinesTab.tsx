"use client";

import {YONSEI_SHUTTLE_SCHEDULE} from "@/data/yonseiShuttleSchedule";
import {ShieldAlert} from "lucide-react";
import React from "react";

export const ShuttleGuidelinesTab: React.FC = () => {
    return (
        <div className="space-y-4">
            <div
                className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"/>
                <div>
                    <h4 className="text-xs sm:text-sm font-black">
                        무료 셔틀버스 이용 시 준수사항
                    </h4>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                        안전하고 쾌적한 통학을 위해 아래 안내사항을 반드시 숙지하여 주시기 바랍니다.
                    </p>
                </div>
            </div>

            <div className="space-y-2.5">
                {YONSEI_SHUTTLE_SCHEDULE.guidelines.map((rule, idx) => (
                    <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex items-start gap-3"
                    >
                        <div
                            className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                        </div>
                        <div
                            className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                            {rule}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
