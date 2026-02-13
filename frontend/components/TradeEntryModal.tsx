"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { CreateTradePlanPayload, createTradePlan, getStockPrice } from "@/lib/api";
import StockSearchInput from "./StockSearchInput";

const TOTAL_CAPITAL = 1_000_000;
const RISK_PERCENT = 0.01;
const MIN_RR = 1.5;
const CRITICAL_RR = 1.0; // RR < 1.0 时禁用提交

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceLoaded, setPriceLoaded] = useState(false);

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
   * 建议仓位
   */
  const suggestedPosition = useMemo(() => {
    if (!isFinite(entryPriceNum) || !isFinite(stopLossNum)) return 0;
    const diff = Math.abs(entryPriceNum - stopLossNum);
    if (diff === 0) return 0;
    const riskAmount = TOTAL_CAPITAL * RISK_PERCENT;
    return Math.floor(riskAmount / diff);
  }, [entryPriceNum, stopLossNum]);

  const rrTooLow = !isNaN(riskReward) && riskReward < MIN_RR;
  const rrCritical = !isNaN(riskReward) && riskReward < CRITICAL_RR;

  /** A股特征：代码以 6、0、3 开头 */
  const isAShare = /^[603]/.test(form.stockSymbol.trim());

  // 买入股数
  const positionSizeNum = Number(form.positionSize);
  const actualPositionSize = isFinite(positionSizeNum) && positionSizeNum > 0 
    ? positionSizeNum 
    : suggestedPosition;

  // RR < 1.0 时禁用提交；RR 1.0~1.5 仅显示警告，仍可提交
  // 买入股数可选，如果未输入则使用建议仓位
  const canSubmit =
    !submitting &&
    form.stockSymbol.trim() &&
    form.entryLogic.trim() &&
    isFinite(entryPriceNum) &&
    isFinite(stopLossNum) &&
    isFinite(takeProfitNum) &&
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

  /** 点击逻辑标签，追加到买入逻辑 */
  const appendLogicTag = (tag: string) => {
    setForm((prev) => {
      const current = prev.entryLogic.trim();
      const appended = current ? `${current}，${tag}` : tag;
      return { ...prev, entryLogic: appended };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      // 如果用户输入了股数就使用用户的，否则使用建议仓位（后端会自动计算）
      const finalPositionSize = isFinite(positionSizeNum) && positionSizeNum > 0 
        ? positionSizeNum 
        : suggestedPosition;
      
      const payload: CreateTradePlanPayload = {
        stockSymbol: form.stockSymbol.trim(),
        direction: "LONG", // A股只支持做多
        entryPrice: Number(form.entryPrice),
        stopLoss: Number(form.stopLoss),
        takeProfit: Number(form.takeProfit),
        ...(finalPositionSize > 0 && { positionSize: finalPositionSize }),
        entryLogic: form.entryLogic.trim()
      };
      await createTradePlan(payload);
      setSuccess("计划创建成功！");
      
      // 重置表单
      setForm({
        stockSymbol: "",
        direction: "LONG",
        entryPrice: "",
        stopLoss: "",
        takeProfit: "",
        positionSize: "",
        entryLogic: ""
      });

      // 延迟关闭，让用户看到成功消息
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

  const handleClose = () => {
    if (!submitting) {
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-900 shadow-xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between overflow-hidden">
          <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">新建交易计划</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-50 flex-shrink-0 ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-x-hidden">
          {/* 标的代码 - 使用股票搜索组件 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">标的代码（A股）</label>
            <StockSearchInput
              value={form.stockSymbol}
              onChange={(code) => setForm((prev) => ({ ...prev, stockSymbol: code }))}
              placeholder="搜索股票代码或名称，如：600519 或 茅台"
            />
          </div>


          {/* 价格输入 */}
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                买入价（元）
                {loadingPrice && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    获取中...
                  </span>
                )}
                {priceLoaded && !loadingPrice && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    已自动填充
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.entryPrice}
                  onChange={handleChange("entryPrice")}
                  placeholder={loadingPrice ? "正在获取价格..." : "例如：1700.00"}
                  disabled={loadingPrice}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {priceLoaded && !loadingPrice && form.entryPrice && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!form.stockSymbol.trim()) return;
                        setLoadingPrice(true);
                        setError(null);
                        try {
                          const result = await getStockPrice(form.stockSymbol.trim());
                          if (result.success && result.price !== undefined) {
                            setForm((prev) => ({
                              ...prev,
                              entryPrice: result.price!.toFixed(2)
                            }));
                          }
                        } catch (err) {
                          console.error("刷新价格失败:", err);
                        } finally {
                          setLoadingPrice(false);
                        }
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                      title="刷新价格"
                    >
                      刷新
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">止损价（元）</label>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.stopLoss}
                  onChange={handleChange("stopLoss")}
                  placeholder="根据买入价计算"
                  className="flex-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <div className="flex gap-1.5 sm:flex-shrink-0 w-full sm:w-auto">
                  {([5, 8, 10] as const).map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyStopLossPercent(pct)}
                      disabled={!isFinite(entryPriceNum) || entryPriceNum <= 0}
                      className="flex-1 sm:flex-none rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-2 text-xs font-mono text-slate-300 hover:bg-slate-700 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      title={`止损价 = 买入价 × (1 - ${pct}%)`}
                    >
                      [−{pct}%]
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">止盈价（元）</label>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.takeProfit}
                  onChange={handleChange("takeProfit")}
                  placeholder="根据买入价计算"
                  className="flex-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <div className="flex gap-1.5 sm:flex-shrink-0 w-full sm:w-auto">
                  {([5, 8, 10, 15] as const).map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyTakeProfitPercent(pct)}
                      disabled={!isFinite(entryPriceNum) || entryPriceNum <= 0}
                      className="flex-1 sm:flex-none rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-2 text-xs font-mono text-slate-300 hover:bg-slate-700 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      title={`止盈价 = 买入价 × (1 + ${pct}%)`}
                    >
                      [+{pct}%]
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">买入股数</label>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  type="number"
                  inputMode="numeric"
                  step="100"
                  value={form.positionSize}
                  onChange={handleChange("positionSize")}
                  placeholder="输入买入股数"
                  className="flex-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                {suggestedPosition > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, positionSize: suggestedPosition.toString() }))}
                    className="flex-shrink-0 rounded-lg border border-emerald-600 bg-emerald-500/10 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500 transition-colors whitespace-nowrap"
                    title={`使用建议仓位：${suggestedPosition.toLocaleString()} 股`}
                  >
                    使用建议
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 买入逻辑 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">买入逻辑</label>
            <textarea
              rows={4}
              value={form.entryLogic}
              onChange={handleChange("entryLogic")}
              placeholder="写下你的买入理由、逻辑假设和风险点..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5 w-full">
              {LOGIC_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendLogicTag(tag)}
                  className="rounded-full border border-slate-600 bg-slate-800/80 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:border-slate-500 transition-colors whitespace-nowrap"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* 计算结果显示 */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 sm:p-4 space-y-3 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs sm:text-sm text-slate-400 flex-shrink-0">预计盈亏比 (RR)</span>
              <span
                className={`inline-flex items-center gap-1.5 text-sm sm:text-base font-mono font-semibold flex-shrink-0 ${
                  isNaN(riskReward)
                    ? "text-slate-500"
                    : rrTooLow
                    ? "text-risk"
                    : "text-profit"
                }`}
              >
                {isNaN(riskReward) ? "--" : riskReward.toFixed(2)}
                {rrTooLow && <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />}
              </span>
            </div>
            {rrTooLow && (
              <div className={`text-xs rounded-lg px-3 py-2 flex items-start sm:items-center gap-2 break-words ${
                rrCritical ? "text-risk bg-risk/10" : "text-amber-400 bg-amber-500/10"
              }`}>
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="flex-1">
                  {rrCritical ? (
                    "盈亏比 < 1.0，禁止提交"
                  ) : (
                    "盈亏比 < 1.5，建议提高止盈或缩小止损"
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-slate-700 gap-2 min-w-0">
              <span className="text-xs sm:text-sm text-slate-400 flex-shrink-0">建议仓位（1% 风险）</span>
              <span className="text-sm sm:text-base font-mono font-semibold text-emerald-400 flex-shrink-0 whitespace-nowrap">
                {suggestedPosition > 0 ? suggestedPosition.toLocaleString() : "--"} <span className="text-xs text-slate-400">股</span>
              </span>
            </div>
            {isFinite(positionSizeNum) && positionSizeNum > 0 && positionSizeNum !== suggestedPosition && (
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs sm:text-sm text-slate-400 flex-shrink-0">实际买入</span>
                <span className="text-sm sm:text-base font-mono font-semibold text-slate-300 flex-shrink-0 whitespace-nowrap">
                  {positionSizeNum.toLocaleString()} <span className="text-xs text-slate-400">股</span>
                </span>
              </div>
            )}
          </div>

          {/* 错误/成功消息 */}
          {error && (
            <div className="rounded-lg border border-risk/60 bg-risk/10 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-risk break-words">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-profit/60 bg-profit/10 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-profit break-words">
              {success}
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex gap-2 sm:gap-3 pt-2 w-full">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-slate-300 active:bg-slate-700 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex-1 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold transition-all ${
                canSubmit
                  ? "bg-emerald-500 text-slate-900 active:bg-emerald-400 active:scale-[0.98]"
                  : "cursor-not-allowed bg-slate-800 text-slate-500"
              }`}
            >
              {submitting ? "提交中..." : "提交计划"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
