"use client";

import { useAppStore } from "@/lib/store";

/**
 * 专注模式切换开关
 * 开启时隐藏金额，以 R 单位显示盈亏
 */
export default function FocusModeToggle() {
  const { displayMode, toggleFocusMode } = useAppStore();
  const isFocusMode = displayMode === "R_UNIT";

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <span className="text-xs text-slate-400 whitespace-nowrap">专注模式</span>
      <button
        type="button"
        role="switch"
        aria-checked={isFocusMode}
        onClick={toggleFocusMode}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 ${
          isFocusMode ? "bg-emerald-500" : "bg-slate-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isFocusMode ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      <span className={`text-xs whitespace-nowrap ${isFocusMode ? "text-emerald-400" : "text-slate-500"}`}>
        {isFocusMode ? "隐藏金额" : "显示金额"}
      </span>
    </label>
  );
}
