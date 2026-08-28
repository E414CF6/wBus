"use client";

import React, { useState } from "react";
import { Info, X, ChevronRight, Bus } from "lucide-react";

export const NoticeBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="mb-6 p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-500/30 text-blue-950 dark:text-blue-200 flex items-start sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
          <Bus className="w-4 h-4" />
        </div>
        <div className="text-xs sm:text-sm">
          <p className="font-extrabold text-blue-900 dark:text-blue-100 flex items-center gap-1.5">
            <span>연세대학교 미래캠퍼스 버스 이용 안내</span>
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5 leading-relaxed">
            <span className="font-bold text-[#003876] dark:text-blue-400">30번</span>은 학기·방학 구분 없이 매일 동일하게 운행되며,{" "}
            <span className="font-bold text-blue-700 dark:text-blue-400">34번·34-1번</span>은 평일과 방학·휴일 시간표가 다릅니다.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setIsVisible(false)}
        className="p-1 rounded-lg text-blue-400 hover:text-blue-700 dark:hover:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shrink-0 cursor-pointer"
        aria-label="안내 닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
