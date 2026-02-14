"use client";

import { useState, useEffect } from "react";
import { TradePlan, closePlan } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

/** 完美执行阈值：执行偏差 < 1% */
const PERFECT_DEVIANCE_THRESHOLD = 0.01;

interface Props {
  plan: TradePlan | null;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

/**
 * 计算是否为完美执行
 * PlanPrice: 盈利时为目标止盈价，亏损时为目标止损价
 * 完美执行 = |ExitPrice - PlanPrice| / PlanPrice < 1%
 */
function isPerfectExecution(
  exitPrice: number,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): boolean {
  const isProfit = exitPrice >= entryPrice;
  const planPrice = isProfit ? takeProfit : stopLoss;
  if (planPrice === 0) return false;
  const deviance = Math.abs(exitPrice - planPrice);
  const deviancePercent = deviance / planPrice;
  return deviancePercent < PERFECT_DEVIANCE_THRESHOLD;
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
  const [showPerfectToast, setShowPerfectToast] = useState(false);

  // 弹窗打开时重置状态
  useEffect(() => {
    if (!open) {
      setShowPerfectToast(false);
    }
  }, [open]);

  if (!open || !plan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitPrice || !exitLogic) return;
    const exitPriceNum = Number(exitPrice);
    setSubmitting(true);
    setError(null);
    try {
      await closePlan(plan.id, {
        exitPrice: exitPriceNum,
        exitLogic,
        emotionalState: emotion || undefined
      });

      // 完美执行：显示 Confetti 和 Toast
      const perfect = isPerfectExecution(
        exitPriceNum,
        plan.entryPrice,
        plan.stopLoss,
        plan.takeProfit
      );

      if (perfect) {
        // 动态导入 confetti（避免 SSR 报错）
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#10b981", "#fbbf24", "#f59e0b", "#ffffff"]
        });
        setShowPerfectToast(true);
        // 完美执行：延迟关闭，让用户看到 Confetti 和 Toast
        setTimeout(() => {
          setShowPerfectToast(false);
          onSubmitted();
          onClose();
        }, 2500);
      } else {
        onSubmitted();
        onClose();
      }

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
      {/* 完美执行 Toast：绿色/金色正向反馈，即使是亏损交易也给予纪律嘉奖 */}
      <AnimatePresence mode="wait">
        {showPerfectToast && (
          <motion.div
            key="perfect-toast"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-4 rounded-xl bg-emerald-500/95 border border-emerald-400/50 shadow-lg shadow-emerald-500/30 flex items-center gap-2"
          >
            <span className="text-2xl">🛡️</span>
            <span className="text-base font-semibold text-white">
              完美执行！纪律分 +10
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">
          平仓 - {plan.stockSymbol}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-800/50 p-3 text-sm">
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
