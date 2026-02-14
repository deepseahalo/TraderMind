"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, CheckCircle2, AlertTriangle, Mic } from "lucide-react";
import { CreateTradePlanPayload, createTradePlan, getAIPreTradeChallenge, getStockPrice, getSettings } from "@/lib/api";
import StockSearchInput from "./StockSearchInput";

const MIN_RR = 1.5;
const CRITICAL_RR = 1.0; // RR < 1.0 时禁用提交
/** A股一手 = 100股，买入股数必须为正100股的整数倍 */
const MIN_LOT = 100;

/** 买入逻辑快捷标签 */
const LOGIC_TAGS = ["突破回踩", "均线金叉", "业绩超预期", "超跌反弹", "趋势跟随", "支撑位反弹"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TradeEntryModal({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<{
    stockSymbol: string;
    direction: "LONG" | "SHORT";
    entryPrice: string;
    stopLoss: string;
    takeProfit: string;
    positionSize: string; // 买入股数
    entryLogic: string;
  }>({
    stockSymbol: "",
    direction: "LONG",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    positionSize: "",
    entryLogic: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeRisks, setChallengeRisks] = useState<string[]>([]);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceLoaded, setPriceLoaded] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [settings, setSettings] = useState<{ totalCapital: number; riskPercent: number }>({
    totalCapital: 1_000_000,
    riskPercent: 0.01
  });

  // 弹窗打开时拉取最新设置，用于建议仓位与「使用建议」按钮计算（与设置页保持一致）
  useEffect(() => {
    if (open) {
      getSettings().then((s) => setSettings(s)).catch(() => {});
    }
  }, [open]);

  // 价格输入转为 number
  const entryPriceNum = Number(form.entryPrice);
  const stopLossNum = Number(form.stopLoss);
  const takeProfitNum = Number(form.takeProfit);

  /**
   * 预计盈亏比
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
   * 建议仓位：基于设置中的总资金和风险百分比
   * positionSize = (totalCapital * riskPercent) / |entryPrice - stopLoss|
   * A股规则：向下取整到100的整数倍，最小100股（一手）
   */
  const suggestedPosition = useMemo(() => {
    if (!isFinite(entryPriceNum) || !isFinite(stopLossNum)) return 0;
    const diff = Math.abs(entryPriceNum - stopLossNum);
    if (diff === 0) return 0;
    const riskAmount = settings.totalCapital * settings.riskPercent;
    const raw = Math.floor(riskAmount / diff);
    const lots = Math.max(1, Math.floor(raw / MIN_LOT));
    return lots * MIN_LOT;
  }, [entryPriceNum, stopLossNum, settings.totalCapital, settings.riskPercent]);

  const rrTooLow = !isNaN(riskReward) && riskReward < MIN_RR;
  const rrCritical = !isNaN(riskReward) && riskReward < CRITICAL_RR;

  /** A股特征：代码以 6、0、3 开头 */
  const isAShare = /^[603]/.test(form.stockSymbol.trim());

  // 买入股数：用户输入或建议仓位
  const positionSizeNum = Number(form.positionSize);
  const actualPositionSize = isFinite(positionSizeNum) && positionSizeNum > 0
    ? positionSizeNum
    : suggestedPosition;

  /** A股：股数必须 >= 100 且为 100 的整数倍 */
  const isValidPositionSize =
    actualPositionSize >= MIN_LOT && actualPositionSize % MIN_LOT === 0;

  // RR < 1.0 时禁用提交；RR 1.0~1.5 仅显示警告，仍可提交
  // 买入股数需满足：正100股（一手）的整数倍
  const canSubmit =
    !submitting &&
    !challengeLoading &&
    form.stockSymbol.trim() &&
    form.entryLogic.trim() &&
    isFinite(entryPriceNum) &&
    isFinite(stopLossNum) &&
    isFinite(takeProfitNum) &&
    isValidPositionSize &&
    !rrCritical;

  // A股只支持做多，direction 固定为 LONG

  // 当选择股票后，自动获取当前价格
  useEffect(() => {
    const fetchPrice = async () => {
      // 如果股票代码为空或太短，清除价格
      if (!form.stockSymbol.trim() || form.stockSymbol.length < 6) {
        setPriceLoaded(false);
        if (!form.stockSymbol.trim()) {
          setForm((prev) => ({ ...prev, entryPrice: "" }));
        }
        return;
      }

      // 如果已经有手动输入的价格，不自动获取（避免覆盖用户输入）
      // 注意：只在首次选择股票时自动填充，如果用户已经手动输入过价格，不再自动覆盖
      if (form.entryPrice.trim()) {
        return;
      }

      setLoadingPrice(true);
      setError(null);
      
      try {
        const result = await getStockPrice(form.stockSymbol.trim());
        if (result.success && result.price !== undefined) {
          setForm((prev) => ({
            ...prev,
            entryPrice: result.price!.toFixed(2)
          }));
          setPriceLoaded(true);
        } else {
          setError(result.message || "无法获取股票价格");
          setPriceLoaded(false);
        }
      } catch (err: any) {
        console.error("获取股票价格失败:", err);
        setError("获取股票价格失败，请手动输入");
        setPriceLoaded(false);
      } finally {
        setLoadingPrice(false);
      }
    };

    // 防抖：500ms 后执行
    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [form.stockSymbol]);

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (field === "entryPrice") {
        setPriceLoaded(false);
      }
    };

  /** 智能止损：根据买入价和百分比计算止损价 */
  const applyStopLossPercent = (percent: number) => {
    if (!isFinite(entryPriceNum) || entryPriceNum <= 0) return;
    const sl = entryPriceNum * (1 - percent / 100);
    setForm((prev) => ({ ...prev, stopLoss: sl.toFixed(2) }));
  };

  /** 智能止盈：根据买入价和百分比计算止盈价 */
  const applyTakeProfitPercent = (percent: number) => {
    if (!isFinite(entryPriceNum) || entryPriceNum <= 0) return;
    const tp = entryPriceNum * (1 + percent / 100);
    setForm((prev) => ({ ...prev, takeProfit: tp.toFixed(2) }));
  };

  /** 语音输入占位符（Mock）：2 秒后填入示例文本 */
  const handleVoiceMock = () => {
    if (voiceListening) return;
    setVoiceListening(true);
    setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        entryLogic:
          prev.entryLogic.trim() +
          (prev.entryLogic.trim() ? " " : "") +
          "突破 20 日均线，量能配合，作为底仓买入."
      }));
      setVoiceListening(false);
    }, 2000);
  };

  /** 点击逻辑标签，追加到买入逻辑 */
  const appendLogicTag = (tag: string) => {
    setForm((prev) => {
      const current = prev.entryLogic.trim();
      const appended = current ? `${current}，${tag}` : tag;
      return { ...prev, entryLogic: appended };
    });
  };

  /** 真正的提交：在用户通过 AI 质询确认后调用 */
  const doActualSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setShowChallengeDialog(false);
    setChallengeRisks([]);
    try {
      const finalPositionSize = isFinite(positionSizeNum) && positionSizeNum > 0 
        ? positionSizeNum 
        : suggestedPosition;
      
      const payload: CreateTradePlanPayload = {
        stockSymbol: form.stockSymbol.trim(),
        direction: "LONG",
        entryPrice: Number(form.entryPrice),
        stopLoss: Number(form.stopLoss),
        takeProfit: Number(form.takeProfit),
        ...(finalPositionSize > 0 && { positionSize: finalPositionSize }),
        entryLogic: form.entryLogic.trim()
      };
      await createTradePlan(payload);
      setSuccess("计划已创建，请到「待成交计划」确认成交");
      
      setForm({
        stockSymbol: "",
        direction: "LONG",
        entryPrice: "",
        stopLoss: "",
        takeProfit: "",
        positionSize: "",
        entryLogic: ""
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
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

  /** 提交计划：先调用 AI 质询，再弹二次确认 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || challengeLoading) return;
    setChallengeLoading(true);
    setError(null);
    try {
      const risks = await getAIPreTradeChallenge(
        form.stockSymbol.trim(),
        isFinite(entryPriceNum) ? entryPriceNum : null,
        form.entryLogic.trim()
      );
      setChallengeRisks(risks);
      setShowChallengeDialog(true);
    } catch (err: any) {
      const msg = err?.message || "AI 质询失败，请重试";
      setError(typeof err === "object" && "message" in err ? String(err.message) : String(msg));
    } finally {
      setChallengeLoading(false);
    }
  };

  const handleClose = () => {
    if (!submitting && !challengeLoading) {
      setError(null);
      setSuccess(null);
      setShowChallengeDialog(false);
      setChallengeRisks([]);
      onClose();
    }
  };

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/5 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 - Apple 风格 */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-xl px-5 py-4 flex items-center justify-between border-b border-white/5">
          <h2 className="text-lg font-semibold text-slate-100">新建交易计划</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 rounded-full hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 表单内容 - 分组卡片布局 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-6 overflow-x-hidden">
          {/* 分组 1：标的选择 */}
          <div className="rounded-2xl bg-white/[0.03] p-4 space-y-4">
            <div className="text-sm font-medium text-slate-300">标的</div>
            <StockSearchInput
              value={form.stockSymbol}
              onChange={(code) => setForm((prev) => ({ ...prev, stockSymbol: code }))}
              placeholder="搜索股票代码或名称"
            />
          </div>

          {/* 分组 2：价格与风控 */}
          <div className="rounded-2xl bg-white/[0.03] p-4 space-y-5">
            <div className="text-sm font-medium text-slate-300">价格与风控</div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs text-slate-500">
                <span>买入价</span>
                {loadingPrice && (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> 获取中...
                  </span>
                )}
                {priceLoaded && !loadingPrice && (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> 已填充
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={form.entryPrice}
                  onChange={handleChange("entryPrice")}
                  placeholder={loadingPrice ? "正在获取..." : "元"}
                  disabled={loadingPrice}
                  className="flex-1 min-w-0 rounded-xl border-0 bg-white/5 px-4 py-3.5 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none disabled:opacity-50 touch-manipulation"
                />
                {form.stockSymbol.trim().length >= 6 && !loadingPrice && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!form.stockSymbol.trim()) return;
                      setLoadingPrice(true);
                      setError(null);
                      try {
                        const result = await getStockPrice(form.stockSymbol.trim());
                        if (result.success && result.price !== undefined) {
                          setForm((prev) => ({ ...prev, entryPrice: result.price!.toFixed(2) }));
                        }
                      } finally {
                        setLoadingPrice(false);
                      }
                    }}
                    className="shrink-0 self-center rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-white/10 hover:text-emerald-300 transition-colors"
                  >
                    刷新
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500">止损价</label>
              <div className="flex gap-2">
                {([5, 8, 6] as const).map((percent, i) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => applyStopLossPercent(percent)}
                    disabled={!isFinite(entryPriceNum) || entryPriceNum <= 0}
                    className="flex-1 rounded-full bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
                  >
                    {i === 2 ? "-6%" : `-${percent}%`}
                  </button>
                ))}
              </div>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.stopLoss}
                onChange={handleChange("stopLoss")}
                placeholder="元"
                className="w-full rounded-xl border-0 bg-white/5 px-4 py-3.5 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500">止盈价</label>
              <div className="flex gap-2">
                {([5, 8, 10, 15] as const).map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyTakeProfitPercent(pct)}
                    disabled={!isFinite(entryPriceNum) || entryPriceNum <= 0}
                    className="flex-1 rounded-full bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.takeProfit}
                onChange={handleChange("takeProfit")}
                placeholder="元"
                className="w-full rounded-xl border-0 bg-white/5 px-4 py-3.5 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500">买入股数</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_LOT}
                  step={MIN_LOT}
                  value={form.positionSize}
                  onChange={handleChange("positionSize")}
                  placeholder="100 的整数倍"
                  className="flex-1 rounded-xl border-0 bg-white/5 px-4 py-3.5 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
                />
                {suggestedPosition > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, positionSize: suggestedPosition.toString() }))}
                    className="shrink-0 rounded-xl bg-emerald-500/20 px-4 py-3.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  >
                    建议
                  </button>
                )}
              </div>
              {!isValidPositionSize && actualPositionSize > 0 && (
                <p className="text-xs text-amber-400">须为 100 股的整数倍</p>
              )}
            </div>
          </div>

          {/* 分组 3：买入逻辑 */}
          <div className="rounded-2xl bg-white/[0.03] p-4 space-y-4">
            <div className="text-sm font-medium text-slate-300">买入逻辑</div>
            <div className="relative">
              <textarea
                rows={4}
                value={form.entryLogic}
                onChange={handleChange("entryLogic")}
                placeholder={voiceListening ? "正在听..." : "写下买入理由与风险点..."}
                disabled={voiceListening}
                className="w-full rounded-xl border-0 bg-white/5 px-4 py-3.5 pr-12 text-base text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none resize-none disabled:opacity-70"
              />
              <button
                type="button"
                onClick={handleVoiceMock}
                disabled={voiceListening}
                className="absolute right-3 bottom-3 p-2 rounded-full text-slate-400 hover:text-emerald-400 hover:bg-white/5 transition-colors"
              >
                <Mic className={`h-4 w-4 ${voiceListening ? "animate-pulse text-emerald-400" : ""}`} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {LOGIC_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendLogicTag(tag)}
                  className="rounded-full bg-white/5 px-3 py-2 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-300 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 分组 4：计算结果 */}
          <div className="rounded-2xl bg-white/[0.03] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">预计盈亏比</span>
              <span
                className={`font-mono font-semibold ${
                  isNaN(riskReward) ? "text-slate-500" : rrTooLow ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {isNaN(riskReward) ? "--" : riskReward.toFixed(2)}
                {rrTooLow && <AlertTriangle className="inline h-4 w-4 ml-1" />}
              </span>
            </div>
            {rrTooLow && (
              <div className={`text-xs rounded-xl px-3 py-2.5 ${
                rrCritical ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
              }`}>
                {rrCritical ? "盈亏比 < 1.0，禁止提交" : "盈亏比 < 1.5，建议提高止盈或缩小止损"}
              </div>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <span className="text-sm text-slate-400">建议仓位（{(settings.riskPercent * 100).toFixed(0)}% 风险）</span>
              <span className="font-mono font-medium text-emerald-400">
                {suggestedPosition > 0 ? suggestedPosition.toLocaleString() : "--"} 股
              </span>
            </div>
            {isFinite(positionSizeNum) && positionSizeNum > 0 && positionSizeNum !== suggestedPosition && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">实际买入</span>
                <span className="font-mono font-medium text-slate-300">{positionSizeNum.toLocaleString()} 股</span>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 rounded-xl bg-white/5 py-3.5 text-base font-medium text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 rounded-xl py-3.5 text-base font-semibold transition-all ${
                canSubmit
                  ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                  : "bg-white/5 text-slate-500 cursor-not-allowed"
              }`}
            >
              {challengeLoading ? "质询中..." : submitting ? "提交中..." : "提交计划"}
            </button>
          </div>
        </form>

        {/* 灵魂三问 - AI 质询二次确认弹窗 */}
        {showChallengeDialog && (
          <div
            className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-t-3xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-sm mx-5 rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="text-base font-semibold text-slate-100">灵魂三问</h3>
                <p className="text-xs text-slate-500 mt-0.5">DeepSeek 风险质询</p>
              </div>
              <div className="px-5 py-4 space-y-3 max-h-48 overflow-y-auto">
                {challengeRisks.map((risk, i) => (
                  <div key={i} className="flex gap-3 text-sm text-slate-300">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 text-xs font-medium flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="flex-1 leading-relaxed">{risk}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 flex gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => { setShowChallengeDialog(false); setChallengeRisks([]); }}
                  className="flex-1 rounded-xl bg-white/5 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors"
                >
                  取消开仓
                </button>
                <button
                  type="button"
                  onClick={doActualSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "提交中..." : "确认开仓"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
