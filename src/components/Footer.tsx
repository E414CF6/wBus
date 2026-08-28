import React from "react";

export const Footer: React.FC = () => {
    return (<footer
        className="mt-12 pt-6 pb-10 border-t border-slate-200/80 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400 w-full">
        <div className="w-full px-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-medium">
                © {new Date().getFullYear()} wBus Lite
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                실시간 도로 상황에 따라 차이가 있을 수 있습니다.
            </p>
        </div>
    </footer>);
};
