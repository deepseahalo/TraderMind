"use client";

import { useAppStore } from "@/lib/store";

/**
 * 专注模式下显示 R 单位说明
 */
export default function LayoutClient() {
  const displayMode = useAppStore((s) => s.displayMode);
  const isFocusMode = displayMode === "R_UNIT";

  if (!isFocusMode) return null;

  return (
    <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-slate-300">
      <span className="font-medium text-emerald-400">R 单位说明：</span>
      <span className="ml-1">
        盈亏 ÷ 单笔风险。1R = 盈亏等于止损距离对应的金额；+1.5R 表示盈利为单笔风险的 1.5 倍。
      </span>
    </div>
  );
}
