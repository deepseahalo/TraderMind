"use client";

import useSWR from "swr";
import { fetchTradeHistory, TradeHistory } from "@/lib/api";
import HistoryTradeCard from "./HistoryTradeCard";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useAppStore, pnlToR } from "@/lib/store";

/**
 * 历史交易列表组件
 * 显示所有已平仓的交易记录
 */
export default function HistoryTradesCard() {
  const { data: trades, error, isLoading, mutate } = useSWR<TradeHistory[]>(
    "trade-history",
    fetchTradeHistory,
    {
      revalidateOnFocus: false,
      refreshInterval: 0
    }
  );
  const displayMode = useAppStore((s) => s.displayMode);

  // 计算统计信息
  const stats = trades
    ? {
        total: trades.length,
        profit: trades.filter((t) => t.realizedPnL > 0).length,
        loss: trades.filter((t) => t.realizedPnL < 0).length,
        breakEven: trades.filter((t) => t.realizedPnL === 0).length,
        totalPnL: trades.reduce((sum, t) => sum + t.realizedPnL, 0),
        totalPnLPercent: trades.length > 0
          ? trades.reduce((sum, t) => sum + t.realizedPnLPercent, 0) / trades.length
          : 0,
        totalR:
          displayMode === "R_UNIT"
            ? trades.reduce((sum, t) => {
                const qty = t.totalQuantity ?? t.positionSize;
                const entry = t.avgEntryPrice ?? t.entryPrice;
                const r = pnlToR(t.realizedPnL, entry, t.stopLoss, qty);
                return sum + (r ?? 0);
              }, 0)
            : null,
      }
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="ml-3 text-sm text-slate-400">加载历史交易...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
        加载失败: {error instanceof Error ? error.message : "未知错误"}
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-sm text-slate-500 mb-2">暂无历史交易记录</div>
        <div className="text-xs text-slate-600">平仓后的交易会显示在这里</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="text-xs text-slate-500 mb-1">总交易数</div>
            <div className="text-lg font-mono font-semibold text-slate-200">
              {stats.total}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-rose-400" />
              盈利
            </div>
            <div className="text-lg font-mono font-semibold text-rose-400">
              {stats.profit}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-emerald-400" />
              亏损
            </div>
            <div className="text-lg font-mono font-semibold text-emerald-400">
              {stats.loss}
            </div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="text-xs text-slate-500 mb-1">总盈亏</div>
            {displayMode === "R_UNIT" && stats.totalR !== null ? (
              <div
                className={`text-lg font-mono font-semibold ${
                  stats.totalR > 0
                    ? "text-emerald-400"
                    : stats.totalR < 0
                    ? "text-rose-400"
                    : "text-slate-400"
                }`}
              >
                {stats.totalR > 0 ? "+" : ""}{stats.totalR.toFixed(1)}R
              </div>
            ) : (
              <>
                <div
                  className={`text-lg font-mono font-semibold ${
                    stats.totalPnL > 0
                      ? "text-rose-400"
                      : stats.totalPnL < 0
                      ? "text-emerald-400"
                      : "text-slate-400"
                  }`}
                >
                  {stats.totalPnL > 0 ? "+" : ""}¥
                  {stats.totalPnL.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  ({stats.totalPnLPercent > 0 ? "+" : ""}
                  {stats.totalPnLPercent.toFixed(2)}%)
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 交易列表 */}
      <div className="space-y-3">
        {trades.map((trade) => (
          <HistoryTradeCard
            key={trade.executionId}
            trade={trade}
            onAnalysisTriggered={() => mutate()}
          />
        ))}
      </div>
    </div>
  );
}
