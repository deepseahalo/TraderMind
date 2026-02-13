"use client";

import { useState, useMemo } from "react";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { CreateTradePlanPayload, createTradePlan } from "@/lib/api";

const TOTAL_CAPITAL = 1_000_000;
const RISK_PERCENT = 0.01;
const MIN_RR = 1.5;

export default function TradeEntryForm() {
  const [form, setForm] = useState<{
    stockSymbol: string;
    direction: "LONG" | "SHORT";
    entryPrice: string;
    stopLoss: string;
    takeProfit: string;
    entryLogic: string;
  }>({
    stockSymbol: "",
    direction: "LONG", // A股仅支持做多，固定为 LONG
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    entryLogic: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 价格输入转为 number，若为空或非法则为 NaN
  const entryPriceNum = Number(form.entryPrice);
  const stopLossNum = Number(form.stopLoss);
  const takeProfitNum = Number(form.takeProfit);

  /**
   * 预计盈亏比（仅前端提示）
   * RR = |TP - EP| / |EP - SL|
   * 注意：真正的纪律校验以后端 BigDecimal 计算为准
   */
  const riskReward = useMemo(() => {
    if (
      !isFinite(entryPriceNum) ||
      !isFinite(stopLossNum) ||
      !isFinite(takeProfitNum)
    )
      return NaN;
    if (entryPriceNum === stopLossNum) return NaN;
    const reward = Math.abs(takeProfitNum - entryPriceNum);
    const risk = Math.abs(entryPriceNum - stopLossNum);
    if (risk === 0) return NaN;
    return reward / risk;
  }, [entryPriceNum, stopLossNum, takeProfitNum]);

  /**
   * 建议仓位：
   * position = (TotalCapital * 0.01) / |entryPrice - stopLoss|
   * 与后端公式一致，这里作为实时 UX 提示
   */
  const suggestedPosition = useMemo(() => {
    if (!isFinite(entryPriceNum) || !isFinite(stopLossNum)) return 0;
    const diff = Math.abs(entryPriceNum - stopLossNum);
    if (diff === 0) return 0;
    const riskAmount = TOTAL_CAPITAL * RISK_PERCENT;
    return Math.floor(riskAmount / diff);
  }, [entryPriceNum, stopLossNum]);

  const rrTooLow = !isNaN(riskReward) && riskReward < MIN_RR;

  const canSubmit =
    !submitting &&
    form.stockSymbol.trim() &&
    form.entryLogic.trim() &&
    isFinite(entryPriceNum) &&
    isFinite(stopLossNum) &&
    isFinite(takeProfitNum) &&
    !rrTooLow;

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: CreateTradePlanPayload = {
        stockSymbol: form.stockSymbol.trim(),
        direction: "LONG", // A股仅支持做多，强制设置为 LONG
        entryPrice: Number(form.entryPrice),
        stopLoss: Number(form.stopLoss),
        takeProfit: Number(form.takeProfit),
        entryLogic: form.entryLogic.trim()
      };
      await createTradePlan(payload);
      setSuccess("计划创建成功，已提交给后端纪律守门员校验。");
      setForm((prev) => ({
        ...prev,
        stockSymbol: "",
        entryPrice: "",
        stopLoss: "",
        takeProfit: "",
        entryLogic: ""
      }));
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.message?.message ||
        err?.message?.error ||
        "创建计划失败";
      setError(
        typeof err === "object" && "message" in err ? String(err.message) : String(msg)
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 标的代码 - 全宽 */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">标的代码（A股）</label>
        <input
          value={form.stockSymbol}
          onChange={handleChange("stockSymbol")}
          placeholder="例如：000001 / 510300"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {/* 方向 - 全宽 */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">方向</label>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400"
            disabled
          >
            <ArrowUpCircle className="h-5 w-5" />
            做多（买入）
          </button>
          <button
            type="button"
            disabled
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
          >
            <ArrowDownCircle className="h-5 w-5" />
            做空
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">A股仅支持做多</p>
      </div>

      {/* 价格输入 - 移动端单列 */}
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">买入价（元）</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.entryPrice}
            onChange={handleChange("entryPrice")}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">止损价（元）</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.stopLoss}
            onChange={handleChange("stopLoss")}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">止盈价（元）</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.takeProfit}
            onChange={handleChange("takeProfit")}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-300">买入逻辑</label>
        <textarea
          rows={4}
          value={form.entryLogic}
          onChange={handleChange("entryLogic")}
          placeholder="写下你的买入理由、逻辑假设和风险点..."
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
        />
      </div>

      {/* 计算结果显示 - 移动端优化 */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">预计盈亏比 (RR)</span>
          <span
            className={`text-base font-mono font-semibold ${
              isNaN(riskReward)
                ? "text-slate-500"
                : rrTooLow
                ? "text-risk"
                : "text-profit"
            }`}
          >
            {isNaN(riskReward) ? "--" : riskReward.toFixed(2)}
          </span>
        </div>
        {rrTooLow && (
          <div className="text-xs text-risk bg-risk/10 rounded px-2 py-1">
            盈亏比 &lt; 1.5，违反纪律，禁止开仓
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <span className="text-sm text-slate-400">建议仓位（1% 风险）</span>
          <span className="text-base font-mono font-semibold text-emerald-400">
            {suggestedPosition > 0 ? suggestedPosition.toLocaleString() : "--"} <span className="text-xs text-slate-400">股</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-risk/60 bg-risk/10 px-4 py-3 text-sm text-risk">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-profit/60 bg-profit/10 px-4 py-3 text-sm text-profit">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className={`w-full rounded-lg px-4 py-4 text-base font-semibold transition-all ${
          canSubmit
            ? "bg-emerald-500 text-slate-900 active:bg-emerald-400 active:scale-[0.98]"
            : "cursor-not-allowed bg-slate-800 text-slate-500"
        }`}
      >
        {submitting ? "提交中..." : "提交交易计划"}
      </button>
    </form>
  );
}
