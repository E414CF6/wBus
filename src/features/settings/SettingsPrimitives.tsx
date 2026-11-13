"use client";

import React from "react";

import {ToggleSwitch} from "./ToggleSwitch";

export interface SettingsSectionHeaderProps {
    icon?: React.ReactNode;
    title: string;
    right?: React.ReactNode;
}

/**
 * Compact uppercase section label with optional trailing metadata.
 */
export function SettingsSectionHeader({icon, title, right}: SettingsSectionHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {icon}
                <span>{title}</span>
            </h3>
            {right}
        </div>
    );
}

/**
 * Grouped inset card container with hairline dividers between rows.
 */
export function SettingsGroup({
                                  children,
                                  className = "",
                              }: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/[0.06] overflow-hidden ${className}`}
        >
            {children}
        </div>
    );
}

export interface SettingsToggleRowProps {
    icon?: React.ReactNode;
    title: string;
    description: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
}

/**
 * Uniform toggle row used inside a SettingsGroup.
 */
export function SettingsToggleRow({
                                      icon,
                                      title,
                                      description,
                                      checked,
                                      onChange,
                                      ariaLabel,
                                  }: SettingsToggleRowProps) {
    return (
        <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
                {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
                <div className="min-w-0">
                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white leading-snug">
                        {title}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
            <ToggleSwitch checked={checked} onChange={onChange} ariaLabel={ariaLabel}/>
        </div>
    );
}

/**
 * Padded content block inside a SettingsGroup for segmented controls or custom layouts.
 */
export function SettingsBlock({
                                  children,
                                  className = "",
                              }: {
    children: React.ReactNode;
    className?: string;
}) {
    return <div className={`p-3.5 space-y-2.5 ${className}`}>{children}</div>;
}
