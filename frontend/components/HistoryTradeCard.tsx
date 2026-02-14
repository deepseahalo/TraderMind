"use client";

import { useState, useEffect } from "react";
import { TradeHistory, TradeTransaction, triggerAiReview, fetchPlanTransactions } from "@/lib/api";
import { TrendingUp, TrendingDown, Brain, Calendar, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore, pnlToR } from "@/lib/store";

const TXN_TYPE_LABELS: Record<string, string> = {
  INITIAL_ENTRY: "首次建仓",
  ADD_POSITION: "加仓",
  PARTIAL_EXIT: "减仓",
  FULL_EXIT: "清仓",
};

/** 买入类（绿色），卖出类（红色） */
const TXN_IS_BUY: Record<string, boolean> = {
  INITIAL_ENTRY: true,
  ADD_POSITION: true,
  PARTIAL_EXIT: false,
  FULL_EXIT: false,
};

interface Props {
  trade: TradeHistory;
  onAnalysisTriggered?: () => void;
}

/**
 * 历史交易卡片组件
 * 显示已平仓交易的完整信息，含交易流水
 */
export default function HistoryTradeCard({ trade, onAnalysisTriggered }: Props) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [transactionsExpanded, setTransactionsExpanded] = useState(false);
  const [transactions, setTransactions] = useState<TradeTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  useEffect(() => {
    if (transactionsExpanded && transactions.length === 0) {
      setTransactionsLoading(true);
      fetchPlanTransactions(trade.planId)
        .then(setTransactions)
        .catch(() => {})
        .finally(() => setTransactionsLoading(false));
    }
  }, [transactionsExpanded, trade.planId, transactions.length]);
  const isProfit = trade.realizedPnL > 0;
  const isLoss = trade.realizedPnL < 0;
  const pnlPercent = trade.realizedPnLPercent;

  const displayMode = useAppStore((s) => s.displayMode);
  const qtyForR = trade.totalQuantity ?? trade.positionSize;
  const rValue =
    displayMode === "R_UNIT" && qtyForR > 0
      ? pnlToR(
          trade.realizedPnL,
          trade.avgEntryPrice ?? trade.entryPrice,
          trade.stopLoss,
          qtyForR
        )
      : null;

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  /** 请求 AI 分析（历史交易无分析时可用） */
  const handleTriggerAiReview = async () => {
    setIsTriggering(true);
    setTriggerError(null);
    try {
      await triggerAiReview(trade.executionId);
      onAnalysisTriggered?.();
      // 轮询刷新，AI 分析是异步的，几秒后可刷新
      setTimeout(() => onAnalysisTriggered?.(), 5000);
    } catch (e) {
      setTriggerError(e instanceof Error ? e.message : "触发失败");
    } finally {
      setIsTriggering(false);
    }
  };

  const hasAiAnalysis =
    (trade.aiAnalysisScore !== null && trade.aiAnalysisScore !== undefined) || !!trade.aiAnalysisComment;

  // AI 分析得分颜色
  const getScoreColor = (score?: number) => {
    if (!score) return "text-slate-400";
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-rose-400";
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 space-y-4">
      {/* 头部：股票信息与盈亏分两行，避免窄屏下金额遮挡股票名称 */}
      <div className="flex flex-col gap-2">
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="text-lg font-mono font-semibold text-slate-100 shrink-0">{trade.stockSymbol}</span>
          {trade.stockName && (
            <>
              <span className="text-slate-600 shrink-0">·</span>
              <span className="text-sm text-slate-400 truncate" title={trade.stockName}>
                {trade.stockName}
              </span>
            </>
          )}
        </div>
        <div
          className={`self-start inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-semibold ${
            displayMode === "R_UNIT" && rValue !== null
              ? rValue > 0
                ? "bg-emerald-500/20 text-emerald-400"
                : rValue < 0
                ? "bg-rose-500/20 text-rose-400"
                : "bg-slate-700/50 text-slate-400"
              : isProfit
              ? "bg-rose-500/20 text-rose-400"
              : isLoss
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-slate-700/50 text-slate-400"
          }`}
        >
          {displayMode === "R_UNIT" && rValue !== null ? (
            <>
              {rValue > 0 && <TrendingUp className="h-4 w-4 flex-shrink-0" />}
              {rValue < 0 && <TrendingDown className="h-4 w-4 flex-shrink-0" />}
              <span>{rValue > 0 ? "+" : ""}{rValue.toFixed(1)}R</span>
            </>
          ) : (
            <>
              {isProfit && <TrendingUp className="h-4 w-4 flex-shrink-0" />}
              {isLoss && <TrendingDown className="h-4 w-4 flex-shrink-0" />}
              <span>
                {isProfit ? "+" : ""}¥{trade.realizedPnL.toLocaleString("zh-CN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-slate-500">|</span>
              <span>
                ({isProfit ? "+" : ""}
                {pnlPercent.toFixed(2)}%)
              </span>
            </>
          )}
        </div>
      </div>

      {/* 交易信息网格 */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-slate-500">计划价</span>
          <div className="mt-0.5 font-mono font-semibold text-slate-300">
            {trade.entryPrice}
          </div>
        </div>
        {(trade.avgEntryPrice != null && Math.abs(trade.avgEntryPrice - trade.entryPrice) > 0.001) && (
          <div>
            <span className="text-slate-500">持仓均价</span>
            <div className="mt-0.5 font-mono font-semibold text-emerald-400">
              {trade.avgEntryPrice.toFixed(2)}
            </div>
          </div>
        )}
        <div>
          <span className="text-slate-500">平仓价</span>
          <div className="mt-0.5 font-mono font-semibold text-slate-300">
            {trade.exitPrice}
          </div>
        </div>
        <div>
          <span className="text-slate-500">止损</span>
          <div className="mt-0.5 font-mono font-semibold text-rose-400">
            {trade.stopLoss}
          </div>
        </div>
        <div>
          <span className="text-slate-500">止盈</span>
          <div className="mt-0.5 font-mono font-semibold text-emerald-400">
            {trade.takeProfit}
          </div>
        </div>
        <div>
          <span className="text-slate-500">仓位</span>
          <div className="mt-0.5 font-mono font-semibold text-slate-300">
            {(trade.totalQuantity ?? trade.positionSize).toLocaleString()} 股
          </div>
        </div>
        <div>
          <span className="text-slate-500">持仓时长</span>
          <div className="mt-0.5 font-mono font-semibold text-slate-300">
            {(() => {
              const start = new Date(trade.createdAt);
              const end = new Date(trade.closedAt);
              const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
              return days > 0 ? `${days} 天` : "< 1 天";
            })()}
          </div>
        </div>
      </div>

      {/* 时间信息 */}
      <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-700">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span>开仓: {formatDate(trade.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span>平仓: {formatDate(trade.closedAt)}</span>
        </div>
      </div>

      {/* 买入逻辑 */}
      {trade.entryLogic && (
        <div className="text-xs text-slate-500 pt-2 border-t border-slate-700">
          <div className="font-medium text-slate-400 mb-1">买入逻辑</div>
          <div className="line-clamp-2">{trade.entryLogic}</div>
        </div>
      )}

      {/* 卖出逻辑 */}
      {trade.exitLogic && (
        <div className="text-xs text-slate-500 pt-2 border-t border-slate-700">
          <div className="font-medium text-slate-400 mb-1">卖出逻辑</div>
          <div className="line-clamp-2">{trade.exitLogic}</div>
        </div>
      )}

      {/* 情绪状态 */}
      {trade.emotionalState && (
        <div className="text-xs pt-2 border-t border-slate-700">
          <span className="text-slate-500">情绪状态: </span>
          <span className="text-amber-400 font-medium">{trade.emotionalState}</span>
        </div>
      )}

      {/* AI 分析 */}
      {hasAiAnalysis ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-2 pt-2 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <Brain className={`h-4 w-4 ${getScoreColor(trade.aiAnalysisScore)}`} />
            <span className="text-xs font-medium text-slate-400">AI 交易教练分析</span>
            {trade.aiAnalysisScore !== null && trade.aiAnalysisScore !== undefined && (
              <span className={`text-sm font-mono font-semibold ${getScoreColor(trade.aiAnalysisScore)}`}>
                {trade.aiAnalysisScore} 分
              </span>
            )}
          </div>
          {trade.aiAnalysisComment && (
            <div className="text-xs text-slate-300 leading-relaxed">{trade.aiAnalysisComment}</div>
          )}
        </div>
      ) : (
        <div className="pt-2 border-t border-slate-700 space-y-2">
          <button
            type="button"
            onClick={handleTriggerAiReview}
            disabled={isTriggering}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isTriggering ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                请求 AI 分析
              </>
            )}
          </button>
          {triggerError && <div className="text-xs text-rose-400">{triggerError}</div>}
        </div>
      )}

      {/* 交易流水 */}
      <div className="pt-2 border-t border-slate-700">
        <button
          type="button"
          onClick={() => setTransactionsExpanded(!transactionsExpanded)}
          className="flex items-center gap-2 w-full text-xs font-medium text-slate-400 hover:text-slate-300"
        >
          {transactionsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          交易流水
        </button>
        {transactionsExpanded && (
          <div className="mt-2 space-y-2">
            {transactionsLoading ? (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                加载中...
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-xs text-slate-500">暂无流水记录</div>
            ) : (
              transactions.map((txn) => {
                const isBuy = TXN_IS_BUY[txn.type] ?? true;
                return (
                  <div
                    key={txn.id}
                    className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${
                      isBuy
                        ? "border-emerald-600/40 bg-emerald-500/5"
                        : "border-rose-600/40 bg-rose-500/5"
                    }`}
                  >
                    <div className="flex justify-between">
                      <span
                        className={`font-medium ${isBuy ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {TXN_TYPE_LABELS[txn.type] ?? txn.type}
                      </span>
                      <span
                        className={`font-mono ${isBuy ? "text-emerald-400/80" : "text-rose-400/80"}`}
                      >
                        {isBuy ? "+" : "−"}
                        {txn.quantity.toLocaleString()} 股 @ ¥{txn.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>{txn.logicSnapshot || "—"}</span>
                      <span>{new Date(txn.transactionTime).toLocaleString("zh-CN")}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
