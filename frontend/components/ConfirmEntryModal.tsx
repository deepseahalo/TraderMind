"use client";

import { useState, useEffect } from "react";
import { executePlan, getStockPrice } from "@/lib/api";

const MIN_LOT = 100;

interface Props {
  planId: number;
  stockSymbol: string;
  stockName?: string;
  plannedPrice: number;
  plannedQuantity: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 确认成交弹窗：输入实际成交价和数量，执行首次建仓
 */
export default function ConfirmEntryModal({
  planId,
  stockSymbol,
  stockName,
  plannedPrice,
  plannedQuantity,
  open,
  onClose,
  onSuccess
}: Props) {
  const [actualPrice, setActualPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  useEffect(() => {
    if (open) {
      setActualPrice(plannedPrice.toString());
      setQuantity(plannedQuantity.toString());
      setError(null);
    }
  }, [open, plannedPrice, plannedQuantity]);

  const handleFetchPrice = async () => {
    if (!stockSymbol?.trim()) return;
    setLoadingPrice(true);
    try {
      const result = await getStockPrice(stockSymbol.trim());
      if (result.success && result.price !== undefined) {
        setActualPrice(result.price.toFixed(2));
      } else {
        setError(result.message || "获取价格失败");
      }
    } catch {
      setError("获取价格失败");
    } finally {
      setLoadingPrice(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(actualPrice);
    const qtyNum = Number(quantity);
    if (!isFinite(priceNum) || priceNum <= 0 || !isFinite(qtyNum) || qtyNum < MIN_LOT) {
      setError("请输入有效的成交价和数量（100股起，100的整数倍）");
      return;
    }
    if (qtyNum % MIN_LOT !== 0) {
      setError("买入股数须为100股的整数倍");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await executePlan(planId, priceNum, qtyNum);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "确认成交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">确认成交 - {stockName || stockSymbol}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">实际成交价（元）</label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={actualPrice}
                onChange={(e) => setActualPrice(e.target.value)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-slate-100"
              />
              <button
                type="button"
                onClick={handleFetchPrice}
                disabled={loadingPrice}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                {loadingPrice ? "获取中..." : "获取现价"}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">成交数量（股）</label>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_LOT}
              step={MIN_LOT}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100股起，100的整数倍"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-slate-100"
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
              {submitting ? "提交中..." : "确认成交"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
