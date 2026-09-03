"use client";

import {YONSEI_SHUTTLE_SCHEDULE} from "@/data/yonseiShuttleSchedule";
import {Info, MapPin} from "lucide-react";
import React from "react";
import {UI_TEXT} from "@shared/config/locale";

export const ShuttleStopsTab: React.FC = () => {
    return (
        <div className="space-y-3">
            <div
                className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-900 dark:text-blue-200 font-medium flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0"/>
                <span>{UI_TEXT.YONSEI_SHUTTLE.STOPS_NOTICE}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {YONSEI_SHUTTLE_SCHEDULE.stop_locations.map((stop, idx) => (
                    <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex flex-col justify-between space-y-2 hover:border-blue-500/40 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className="w-7 h-7 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                            </div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                {stop.name}
                            </h4>
                        </div>

                        <div
                            className="p-2.5 rounded-xl bg-white dark:bg-[#181e2c] border border-slate-200/60 dark:border-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"/>
                            <span>{stop.location_description}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
