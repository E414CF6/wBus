"use client";

import React from "react";
import {MapIcon, Radio} from "lucide-react";
import {
    type AppSettings,
    LIVE_POLLING_INTERVAL_OPTIONS,
    type LivePollingIntervalMs,
} from "@shared/config/settingsCookie";
import {triggerHaptic} from "@shared/utils/haptics";
import {SettingsBlock, SettingsGroup, SettingsSectionHeader, SettingsToggleRow} from "../SettingsPrimitives";

const POLLING_INTERVAL_LABELS: Record<LivePollingIntervalMs, { label: string; hint: string }> = {
    5000: {label: "5초", hint: "빠른 갱신"},
    10000: {label: "10초", hint: "기본"},
    15000: {label: "15초", hint: "보통"},
    30000: {label: "30초", hint: "절약"},
};

interface MapSettingsTabProps {
    settings: AppSettings;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export const MapSettingsTab: React.FC<MapSettingsTabProps> = ({settings, onUpdateSettings}) => (
    <>
        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Radio className="w-3.5 h-3.5 text-emerald-500"/>}
                title="실시간 위치 추적"
            />
            <SettingsGroup>
                <SettingsBlock>
                    <div>
                        <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                            실시간 버스 위치 갱신 주기
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            짧을수록 위치가 빠르게 반영되고, 길수록 배터리·데이터를 절약합니다
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
                    title="버스 마커 부드러운 이동"
                    description="노선 경로를 따라 버스가 부드럽게 주행하도록 보간 애니메이션을 적용합니다"
                    checked={settings.smoothBusAnimation}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({smoothBusAnimation: next});
                    }}
                    ariaLabel="버스 마커 부드러운 이동 전환"
                />

                <SettingsToggleRow
                    title="버스 마커 차량번호 표시"
                    description="지도 위 버스 아이콘 아래에 차량번호 뒷 4자리를 함께 표시합니다"
                    checked={settings.showBusPlateNumber}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showBusPlateNumber: next});
                    }}
                    ariaLabel="버스 마커 차량번호 표시 전환"
                />
            </SettingsGroup>
        </section>

        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<MapIcon className="w-3.5 h-3.5 text-sky-500"/>}
                title="지도 레이어 및 조작"
            />
            <SettingsGroup>
                <SettingsToggleRow
                    title="지도 주변 정류장 표시"
                    description="지도를 확대했을 때 선택한 노선 외 주변 일반 정류장도 함께 표시합니다"
                    checked={settings.showNearbyStops}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showNearbyStops: next});
                    }}
                    ariaLabel="지도 주변 정류장 표시 전환"
                />

                <SettingsToggleRow
                    title="지도 정류장 이름 라벨 표시"
                    description="확대 시 정류장 핀 옆에 정류장 이름을 표시합니다 (끄면 지도가 더 간결해집니다)"
                    checked={settings.showStopLabels}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showStopLabels: next});
                    }}
                    ariaLabel="지도 정류장 이름 라벨 표시 전환"
                />

                <SettingsToggleRow
                    title="노선 변경 시 지도 자동 맞춤"
                    description="새 노선을 선택할 때 전체 노선 경로가 한눈에 들어오도록 지도를 이동합니다"
                    checked={settings.autoFitRouteBounds}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({autoFitRouteBounds: next});
                    }}
                    ariaLabel="노선 변경 시 지도 자동 맞춤 전환"
                />

                <SettingsToggleRow
                    title="기점·종점 시간표 핀 표시"
                    description="지도 위 기점·종점·회차 정류장의 다음 출발 시각 핀을 표시합니다"
                    checked={settings.showTimetablePins}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showTimetablePins: next});
                    }}
                    ariaLabel="기점·종점 시간표 핀 표시 전환"
                />

                <SettingsToggleRow
                    title="지도 줌·나침반 버튼 표시"
                    description="지도 우측 상단의 확대/축소 및 나침반 컨트롤 버튼을 표시합니다"
                    checked={settings.showMapControls}
                    onChange={(next) => {
                        triggerHaptic("selection");
                        onUpdateSettings({showMapControls: next});
                    }}
                    ariaLabel="지도 줌 나침반 버튼 표시 전환"
                />
            </SettingsGroup>
        </section>
    </>
);
