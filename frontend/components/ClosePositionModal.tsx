"use client";

import { useState } from "react";
import { TradePlan, closePlan } from "@/lib/api";

interface Props {
  plan: TradePlan | null;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ClosePositionModal({
  plan,
  open,
  onClose,
  onSubmitted
}: Props) {
  const [exitPrice, setExitPrice] = useState("");
  const [exitLogic, setExitLogic] = useState("");
  const [emotion, setEmotion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !plan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitPrice || !exitLogic) return;
    setSubmitting(true);
    setError(null);
    try {
      await closePlan(plan.id, {
        exitPrice: Number(exitPrice),
        exitLogic,
        emotionalState: emotion || undefined
      });
      onSubmitted();
      onClose();
      setExitPrice("");
      setExitLogic("");
      setEmotion("");
    } catch (err: any) {
      setError(err?.message || "平仓失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">
          平仓 - {plan.stockSymbol}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-800/50 p-3 text-sm">
            <div>
              <span className="text-slate-500">方向</span>
              <div className="mt-0.5 font-medium">{plan.direction === "LONG" ? "做多" : "做空"}</div>
            </div>
            <div>
              <span className="text-slate-500">开仓价</span>
              <div className="mt-0.5 font-mono font-medium">{plan.entryPrice}</div>
            </div>
            <div>
              <span className="text-slate-500">止损价</span>
              <div className="mt-0.5 font-mono font-medium">{plan.stopLoss}</div>
            </div>
            <div>
              <span className="text-slate-500">止盈价</span>
              <div className="mt-0.5 font-mono font-medium">{plan.takeProfit}</div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">平仓价格（元）</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              卖出心态 / 复盘笔记
            </label>
            <textarea
              rows={4}
              value={exitLogic}
              onChange={(e) => setExitLogic(e.target.value)}
              placeholder="记录你当时的情绪、决策理由、是否遵守了原计划..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              情绪标签（可选）
            </label>
            <input
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              placeholder="例如：恐惧 / 贪婪 / 冲动 / 冷静"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-risk/60 bg-risk/10 px-4 py-3 text-sm text-risk">
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base font-medium text-slate-300 active:bg-slate-700 active:scale-[0.98] transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !exitPrice || !exitLogic}
              className={`flex-1 rounded-lg px-4 py-3 text-base font-semibold transition-all ${
                submitting || !exitPrice || !exitLogic
                  ? "cursor-not-allowed bg-slate-700 text-slate-400"
                  : "bg-risk text-slate-50 active:bg-rose-400 active:scale-[0.98]"
              }`}
            >
              {submitting ? "提交中..." : "确认平仓"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
