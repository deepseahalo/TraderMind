"use client";

import { useState, useMemo } from "react";
import { addPosition } from "@/lib/api";

const MIN_LOT = 100;

interface Props {
  planId: number;
  stockSymbol: string;
  stockName?: string;
  avgEntryPrice: number;
  totalQuantity: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 加仓弹窗
 * 实时预览：加仓后均价 = ((旧均价*旧数量) + (加仓价*加仓数量)) / (旧数量+加仓数量)
 */
export default function AddPositionModal({
  planId,
  stockSymbol,
  stockName,
  avgEntryPrice,
  totalQuantity,
  open,
  onClose,
  onSuccess
}: Props) {
  const [addPrice, setAddPrice] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addLogic, setAddLogic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPriceNum = Number(addPrice);
  const addQtyNum = Number(addQuantity);

  /** 加仓后均价预览 */
  const newAvgPreview = useMemo(() => {
    if (!isFinite(addPriceNum) || addPriceNum <= 0 || !isFinite(addQtyNum) || addQtyNum < MIN_LOT) {
      return null;
    }
    if (addQtyNum % MIN_LOT !== 0) return null;
    const totalCost = avgEntryPrice * totalQuantity + addPriceNum * addQtyNum;
    const newQty = totalQuantity + addQtyNum;
    return totalCost / newQty;
  }, [avgEntryPrice, totalQuantity, addPriceNum, addQtyNum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFinite(addPriceNum) || addPriceNum <= 0 || !isFinite(addQtyNum) || addQtyNum < MIN_LOT) {
      setError("请输入有效的加仓价和数量");
      return;
    }
    if (addQtyNum % MIN_LOT !== 0) {
      setError("加仓股数须为100股的整数倍");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addPosition(planId, addPriceNum, addQtyNum, addLogic.trim() || undefined);
      onSuccess();
      onClose();
      setAddPrice("");
      setAddQuantity("");
      setAddLogic("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加仓失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">加仓 - {stockName || stockSymbol}</h3>
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">当前均价</span>
            <span className="font-mono text-slate-200">¥{avgEntryPrice.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">当前持仓</span>
            <span className="font-mono text-slate-200">{totalQuantity.toLocaleString()} 股</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">加仓价格（元）</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">加仓数量（股）</label>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_LOT}
              step={MIN_LOT}
              value={addQuantity}
              onChange={(e) => setAddQuantity(e.target.value)}
              placeholder="100的整数倍"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-slate-100"
            />
          </div>
          {newAvgPreview !== null && (
            <div className="rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-4 py-3 text-sm">
              <span className="text-slate-400">加仓后均价将变为：</span>
              <span className="ml-2 font-mono font-semibold text-emerald-400">
                ¥{newAvgPreview.toFixed(2)}
              </span>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">加仓逻辑（可选）</label>
            <input
              type="text"
              value={addLogic}
              onChange={(e) => setAddLogic(e.target.value)}
              placeholder="例如：突破加仓"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100"
            />
          </div>
          {error && (
            <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}
          <div className="flex gap-3">
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
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-900 disabled:opacity-50"
            >
              {submitting ? "提交中..." : "确认加仓"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
