import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="mt-12 pt-6 pb-10 border-t border-slate-200/80 dark:border-white/10 text-center text-xs text-slate-500 dark:text-slate-400">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="font-medium">
          © {new Date().getFullYear()} 연세대학교 미래캠퍼스 버스 시간표 (wBus Lite)
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          원주시 교통정보센터(ITS) 운행 시간표 데이터 기준 · 실시간 도로 상황에 따라 차이가 있을 수 있습니다.
        </p>
      </div>
    </footer>
  );
};
