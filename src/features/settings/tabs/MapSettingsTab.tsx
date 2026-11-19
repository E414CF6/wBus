"use client";

import React from "react";
import {MapIcon, Radio} from "lucide-react";
import {
    type AppSettings,
    LIVE_POLLING_INTERVAL_OPTIONS,
    type LivePollingIntervalMs,
} from "@shared/config/settingsCookie";
import {triggerHaptic} from "@shared/utils/haptics";
import {UI_TEXT} from "@shared/config/locale";
import {SettingsBlock, SettingsGroup, SettingsSectionHeader, SettingsToggleRow} from "../SettingsPrimitives";

const POLLING_INTERVAL_LABELS: Record<LivePollingIntervalMs, { label: string; hint: string }> =
    UI_TEXT.SETTINGS.MAP.POLLING_LABELS;

interface MapSettingsTabProps {
    settings: AppSettings;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export const MapSettingsTab: React.FC<MapSettingsTabProps> = ({settings, onUpdateSettings}) => (
    <>
        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Radio className="w-3.5 h-3.5 text-emerald-500"/>}
                title={UI_TEXT.SETTINGS.MAP.SECTION_TRACKING}
            />
            <SettingsGroup>
                <SettingsBlock>
                    <div>
                        <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                            {UI_TEXT.SETTINGS.MAP.POLLING_INTERVAL_TITLE}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            {UI_TEXT.SETTINGS.MAP.POLLING_INTERVAL_DESC}
                        </p>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {LIVE_POLLING_INTERVAL_OPTIONS.map((ms) => {
                            const meta = POLLING_INTERVAL_LABELS[ms];
                            const active = settings.livePollingIntervalMs === ms;
                            return (
                                <button
                                    key={ms}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        onUpdateSettings({livePollingIntervalMs: ms});
                                    }}
                                    className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border transition cursor-pointer ${
                                        active
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                    }`}
                                >
                                    <span className="text-xs font-black">{meta.label}</span>
                                    <span
                                        className={`text-[10px] font-semibold mt-0.5 ${
                                            active ? "text-white/75 dark:text-slate-600" : "text-slate-400"
                                        }`}
                                    >
                                        {meta.hint}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </SettingsBlock>

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.MAP.SMOOTH_ANIM_TITLE}
                    description={UI_TEXT.SETTINGS.MAP.SMOOTH_ANIM_DESC}
                    checked={settings.smoothBusAnimation}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({smoothBusAnimation: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.MAP.SMOOTH_ANIM_ARIA}
                />

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.MAP.PLATE_NUMBER_TITLE}
                    description={UI_TEXT.SETTINGS.MAP.PLATE_NUMBER_DESC}
                    checked={settings.showBusPlateNumber}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showBusPlateNumber: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.MAP.PLATE_NUMBER_ARIA}
                />
            </SettingsGroup>
        </section>

        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<MapIcon className="w-3.5 h-3.5 text-sky-500"/>}
                title={UI_TEXT.SETTINGS.MAP.SECTION_LAYERS}
            />
            <SettingsGroup>
                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.MAP.NEARBY_STOPS_TITLE}
                    description={UI_TEXT.SETTINGS.MAP.NEARBY_STOPS_DESC}
                    checked={settings.showNearbyStops}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showNearbyStops: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.MAP.NEARBY_STOPS_ARIA}
                />

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.MAP.STOP_LABELS_TITLE}
                    description={UI_TEXT.SETTINGS.MAP.STOP_LABELS_DESC}
                    checked={settings.showStopLabels}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showStopLabels: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.MAP.STOP_LABELS_ARIA}
                />

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.MAP.AUTO_FIT_TITLE}
                    description={UI_TEXT.SETTINGS.MAP.AUTO_FIT_DESC}
                    checked={settings.autoFitRouteBounds}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({autoFitRouteBounds: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.MAP.AUTO_FIT_ARIA}
                />

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.MAP.TIMETABLE_PINS_TITLE}
                    description={UI_TEXT.SETTINGS.MAP.TIMETABLE_PINS_DESC}
                    checked={settings.showTimetablePins}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showTimetablePins: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.MAP.TIMETABLE_PINS_ARIA}
                />

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.MAP.WIKI_PINS_TITLE}
                    description={UI_TEXT.SETTINGS.MAP.WIKI_PINS_DESC}
                    checked={settings.showWikiPins}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showWikiPins: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.MAP.WIKI_PINS_ARIA}
                />

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.MAP.MAP_CONTROLS_TITLE}
                    description={UI_TEXT.SETTINGS.MAP.MAP_CONTROLS_DESC}
                    checked={settings.showMapControls}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showMapControls: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.MAP.MAP_CONTROLS_ARIA}
                />
            </SettingsGroup>
        </section>
    </>
);
