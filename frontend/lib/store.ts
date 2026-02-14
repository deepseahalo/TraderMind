import { create } from "zustand";

/** 显示模式：金额 或 R 单位（专注模式，隐藏金额） */
export type DisplayMode = "MONEY" | "R_UNIT";

interface AppStore {
  /** 专注模式：R_UNIT 时隐藏金额，显示 R 值 */
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  /** 切换专注模式 */
  toggleFocusMode: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  displayMode: "MONEY",
  setDisplayMode: (mode) => set({ displayMode: mode }),
  toggleFocusMode: () =>
    set((s) => ({
      displayMode: s.displayMode === "MONEY" ? "R_UNIT" : "MONEY",
    })),
}));

/**
 * 将 PnL 金额转换为 R 值
 * R = PnL / (|EntryPrice - StopLoss| * PositionSize)
 */
export function pnlToR(
  pnl: number,
  entryPrice: number,
  stopLoss: number,
  positionSize: number
): number | null {
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  if (riskPerShare === 0 || positionSize <= 0) return null;
  const totalRisk = riskPerShare * positionSize;
  if (totalRisk === 0) return null;
  return pnl / totalRisk;
}
