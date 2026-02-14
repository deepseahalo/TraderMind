"use client";

import { useState, useMemo, useEffect } from "react";
import { trimPosition } from "@/lib/api";

const MIN_LOT = 100;

interface Props {
  planId: number;
  stockSymbol: string;
  avgEntryPrice: number;
  currentQuantity: number;
  stopLoss: number;
  takeProfit: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 减仓弹窗
 * 表单区域 A：卖出价格、数量、理由，预览本次锁定利润
 * 表单区域 B（可选）：调整剩余持仓的止损/止盈，"Move SL to Break Even" 快捷
 */
export default function TrimPositionModal({
  planId,
  stockSymbol,
  avgEntryPrice,
  currentQuantity,
  stopLoss,
  takeProfit,
  open,
  onClose,
  onSuccess
}: Props) {
  const [exitPrice, setExitPrice] = useState("");
  const [exitQuantity, setExitQuantity] = useState("");
  const [exitLogic, setExitLogic] = useState("");
  const [newStopLoss, setNewStopLoss] = useState("");
  const [newTakeProfit, setNewTakeProfit] = useState("");
  const [moveSLToBreakEven, setMoveSLToBreakEven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exitPriceNum = Number(exitPrice);
  const exitQtyNum = Number(exitQuantity);
  const newSLNum = Number(newStopLoss);
  const newTPNum = Number(newTakeProfit);

  /** 本次操作将锁定利润 */
  const chunkPnL = useMemo(() => {
    if (!isFinite(exitPriceNum) || !isFinite(exitQtyNum) || exitQtyNum <= 0) return null;
    const pnl = (exitPriceNum - avgEntryPrice) * exitQtyNum;
    return pnl;
  }, [exitPriceNum, exitQtyNum, avgEntryPrice]);

  /** Move SL to Break Even 勾选时自动填入均价 */
  useEffect(() => {
    if (moveSLToBreakEven) {
      setNewStopLoss(avgEntryPrice.toFixed(2));
    }
  }, [moveSLToBreakEven, avgEntryPrice]);

  const handleQuickQty = (ratio: "1/2" | "1/3" | "all") => {
    if (ratio === "all") {
      setExitQuantity(String(currentQuantity));
      return;
    }
    const qty = ratio === "1/2" ? Math.floor(currentQuantity / 2) : Math.floor(currentQuantity / 3);
    const rounded = Math.max(MIN_LOT, Math.floor(qty / MIN_LOT) * MIN_LOT);
    setExitQuantity(String(rounded));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFinite(exitPriceNum) || exitPriceNum <= 0) {
      setError("请输入有效的卖出价格");
      return;
    }
    if (!isFinite(exitQtyNum) || exitQtyNum < MIN_LOT || exitQtyNum > currentQuantity) {
      setError("卖出数量须为 100 股的整数倍，且不超过当前持仓");
      return;
    }
    if (exitQtyNum % MIN_LOT !== 0) {
      setError("卖出股数须为 100 股的整数倍");
      return;
    }
    if (!exitLogic.trim()) {
      setError("请填写减仓理由");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await trimPosition(planId, {
        exitPrice: exitPriceNum,
        exitQuantity: exitQtyNum,
        exitLogic: exitLogic.trim(),
        newStopLoss: isFinite(newSLNum) && newStopLoss.trim() ? newSLNum : undefined,
        newTakeProfit: isFinite(newTPNum) && newTakeProfit.trim() ? newTPNum : undefined
      });
      onSuccess();
      onClose();
      setExitPrice("");
      setExitQuantity("");
      setExitLogic("");
      setNewStopLoss("");
      setNewTakeProfit("");
      setMoveSLToBreakEven(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "减仓失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">减仓 / 止盈 - {stockSymbol}</h3>

        {/* 当前持仓信息 */}
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">持仓均价</span>
            <span className="font-mono text-slate-200">¥{avgEntryPrice.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">当前持仓</span>
            <span className="font-mono text-slate-200">{currentQuantity.toLocaleString()} 股</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 表单区域 A：卖出 */}
          <div className="space-y-3 border-b border-slate-700 pb-4">
            <h4 className="text-sm font-medium text-amber-400">卖出</h4>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">卖出价格（元）</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">卖出数量（股）</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => handleQuickQty("1/2")}
                  className="rounded-lg border border-amber-600/50 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                >
                  1/2
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickQty("1/3")}
                  className="rounded-lg border border-amber-600/50 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                >
                  1/3
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickQty("all")}
                  className="rounded-lg border border-amber-600/50 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                >
                  全部
                </button>
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_LOT}
                max={currentQuantity}
                step={MIN_LOT}
                value={exitQuantity}
                onChange={(e) => setExitQuantity(e.target.value)}
                placeholder={`100 的整数倍，最多 ${currentQuantity}`}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-slate-100"
              />
            </div>
            {chunkPnL !== null && (
              <div className="rounded-lg border border-amber-600/50 bg-amber-500/10 px-4 py-3 text-sm">
                <span className="text-slate-400">本次操作将锁定利润：</span>
                <span
                  className={`ml-2 font-mono font-semibold ${
                    chunkPnL >= 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {chunkPnL >= 0 ? "+" : ""}¥{chunkPnL.toFixed(2)}
                </span>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">减仓理由（必填）</label>
              <input
                type="text"
                value={exitLogic}
                onChange={(e) => setExitLogic(e.target.value)}
                placeholder="例如：到达第一目标位"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100"
              />
            </div>
          </div>

          {/* 表单区域 B：策略调整（可选） */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-400">调整剩余持仓计划（可选）</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={moveSLToBreakEven}
                onChange={(e) => setMoveSLToBreakEven(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-amber-500"
              />
              <span className="text-sm text-slate-300">将止损设为持仓均价（Move SL to Break Even）</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">新止损价</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={newStopLoss}
                  onChange={(e) => setNewStopLoss(e.target.value)}
                  placeholder={stopLoss.toFixed(2)}
                  disabled={moveSLToBreakEven}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono text-slate-100 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">新止盈价</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={newTakeProfit}
                  onChange={(e) => setNewTakeProfit(e.target.value)}
                  placeholder={takeProfit.toFixed(2)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono text-slate-100"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-300"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-semibold text-slate-900 disabled:opacity-50 hover:bg-amber-400"
            >
              {submitting ? "提交中..." : "确认减仓"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
