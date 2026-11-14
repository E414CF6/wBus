"use client";

import React from "react";
import {Compass, Vibrate} from "lucide-react";
import type {AppSettings} from "@shared/config/settingsCookie";
import {triggerHaptic} from "@shared/utils/haptics";
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
                title="지역 및 지도 기억"
                right={
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        현재: {currentCityName}
                    </span>
                }
            />
            <SettingsGroup>
                <SettingsToggleRow
                    title="지도 이동 시 지역 자동 감지"
                    description="지도를 다른 시·군으로 이동하면 해당 지역 전환 알림을 표시합니다"
                    checked={settings.autoDetectCity}
                    onChange={onToggleAutoDetect}
                    ariaLabel="지도 이동 시 지역 자동 감지 전환"
                />

                <SettingsToggleRow
                    title="마지막 지도 위치 기억"
                    description="앱을 다시 열 때 마지막으로 보던 지도 위치와 확대 수준을 복원합니다"
                    checked={settings.rememberMapView}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({rememberMapView: next});
                    }}
                    ariaLabel="마지막 지도 위치 기억 전환"
                />
            </SettingsGroup>
        </section>

        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Vibrate className="w-3.5 h-3.5 text-indigo-500"/>}
                title="접근성 및 기기 반응"
            />
            <SettingsGroup>
                <SettingsToggleRow
                    title="화면 전환·모션 줄이기"
                    description="모달 전환과 지도 이동 애니메이션을 최소화해 배터리·눈 피로를 줄입니다"
                    checked={settings.reduceMotion}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({reduceMotion: next});
                    }}
                    ariaLabel="화면 전환 모션 줄이기 전환"
                />

                <SettingsToggleRow
                    title="모바일 터치 진동 (햅틱 피드백)"
                    description="지원 기기에서 버튼 조작 시 짧은 진동 피드백을 제공합니다"
                    checked={settings.hapticEnabled}
                    onChange={onToggleHaptic}
                    ariaLabel="모바일 터치 진동 피드백 전환"
                />
            </SettingsGroup>
        </section>
    </>
);
