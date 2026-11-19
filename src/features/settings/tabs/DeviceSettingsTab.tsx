"use client";

import React from "react";
import {Compass, Vibrate} from "lucide-react";
import type {AppSettings} from "@shared/config/settingsCookie";
import {triggerHaptic} from "@shared/utils/haptics";
import {UI_TEXT} from "@shared/config/locale";
import {SettingsGroup, SettingsSectionHeader, SettingsToggleRow} from "../SettingsPrimitives";

interface DeviceSettingsTabProps {
    settings: AppSettings;
    currentCityName: string;
    onToggleAutoDetect: (next: boolean) => void;
    onToggleHaptic: (next: boolean) => void;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export const DeviceSettingsTab: React.FC<DeviceSettingsTabProps> = ({
                                                                        settings,
                                                                        currentCityName,
                                                                        onToggleAutoDetect,
                                                                        onToggleHaptic,
                                                                        onUpdateSettings,
                                                                    }) => (
    <>
        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Compass className="w-3.5 h-3.5 text-emerald-500"/>}
                title={UI_TEXT.SETTINGS.DEVICE.SECTION_REGION}
                right={
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {UI_TEXT.SETTINGS.DEVICE.CURRENT_CITY(currentCityName)}
                    </span>
                }
            />
            <SettingsGroup>
                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.DEVICE.AUTO_DETECT_TITLE}
                    description={UI_TEXT.SETTINGS.DEVICE.AUTO_DETECT_DESC}
                    checked={settings.autoDetectCity}
                    onChange={onToggleAutoDetect}
                    ariaLabel={UI_TEXT.SETTINGS.DEVICE.AUTO_DETECT_ARIA}
                />

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.DEVICE.REMEMBER_VIEW_TITLE}
                    description={UI_TEXT.SETTINGS.DEVICE.REMEMBER_VIEW_DESC}
                    checked={settings.rememberMapView}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({rememberMapView: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.DEVICE.REMEMBER_VIEW_ARIA}
                />
            </SettingsGroup>
        </section>

        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Vibrate className="w-3.5 h-3.5 text-indigo-500"/>}
                title={UI_TEXT.SETTINGS.DEVICE.SECTION_ACCESSIBILITY}
            />
            <SettingsGroup>
                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.DEVICE.REDUCE_MOTION_TITLE}
                    description={UI_TEXT.SETTINGS.DEVICE.REDUCE_MOTION_DESC}
                    checked={settings.reduceMotion}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({reduceMotion: next});
                    }}
                    ariaLabel={UI_TEXT.SETTINGS.DEVICE.REDUCE_MOTION_ARIA}
                />

                <SettingsToggleRow
                    title={UI_TEXT.SETTINGS.DEVICE.HAPTIC_TITLE}
                    description={UI_TEXT.SETTINGS.DEVICE.HAPTIC_DESC}
                    checked={settings.hapticEnabled}
                    onChange={onToggleHaptic}
                    ariaLabel={UI_TEXT.SETTINGS.DEVICE.HAPTIC_ARIA}
                />
            </SettingsGroup>
        </section>
    </>
);
