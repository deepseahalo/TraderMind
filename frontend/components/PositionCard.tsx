"use client";

import { useState } from "react";
import { TradePlan, TradeDashboard, closePlan, deletePlan } from "@/lib/api";
import ClosePositionModal from "./ClosePositionModal";
import AddPositionModal from "./AddPositionModal";
import TrimPositionModal from "./TrimPositionModal";
import { XCircle, AlertTriangle, Trash2, Plus, Minus } from "lucide-react";
import { useAppStore, pnlToR } from "@/lib/store";

interface Props {
  plan: TradePlan | TradeDashboard;
  onClose: () => void;
}

/**
 * 单个持仓卡片组件
 * 支持 TradePlan 和 TradeDashboard，区分计划价与持仓均价
 */
export default function PositionCard({ plan, onClose }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDashboard = "currentPrice" in plan;

  const stockName = isDashboard
    ? (plan as TradeDashboard).stockName
    : ("stockName" in plan ? plan.stockName : null);

  const currentPrice = isDashboard
    ? (plan as TradeDashboard).currentPrice
    : plan.entryPrice;
  const entryPrice = plan.entryPrice;  // 计划价
  const avgEntryPrice = isDashboard && "avgEntryPrice" in plan
    ? (plan as TradeDashboard).avgEntryPrice
    : ("avgEntryPrice" in plan && plan.avgEntryPrice != null ? plan.avgEntryPrice : plan.entryPrice);
  const stopLoss = plan.stopLoss;
  const takeProfit = plan.takeProfit;

  // 当前剩余持仓：优先 currentQuantity（减仓后递减），否则 totalQuantity
  const currentQty =
    isDashboard && "currentQuantity" in plan
      ? (plan as TradeDashboard).currentQuantity
      : ("currentQuantity" in plan && plan.currentQuantity != null
          ? plan.currentQuantity
          : null) ?? ("totalQuantity" in plan && plan.totalQuantity != null ? plan.totalQuantity : plan.positionSize) ?? 0;
  const totalQty =
    isDashboard && "totalQuantity" in plan
      ? (plan as TradeDashboard).totalQuantity
      : ("totalQuantity" in plan && plan.totalQuantity != null ? plan.totalQuantity : plan.positionSize) ?? 0;
  const positionSize = currentQty;
  const realizedPnLVal =
    isDashboard && "realizedPnL" in plan
      ? (plan as TradeDashboard).realizedPnL
      : ("realizedPnL" in plan ? plan.realizedPnL : null) ?? 0;
  const pnlAmount = isDashboard
    ? (plan as TradeDashboard).pnlAmount
    : positionSize > 0
    ? (currentPrice - avgEntryPrice) * positionSize
    : null;
  const pnlPercentage = isDashboard ? (plan as TradeDashboard).pnlPercentage : null;
  const riskLevel = isDashboard ? (plan as TradeDashboard).riskLevel : "SAFE";

  // 获取 planId（兼容两种类型）
  const planId =
    "planId" in plan ? plan.planId : "id" in plan ? plan.id : 0;

  // 计算当前价在 SL-TP 区间中的相对位置 (0~100)
  const range = takeProfit - stopLoss;
  const currentPosPercent =
    range === 0 ? 50 : ((currentPrice - stopLoss) / range) * 100;
  const clampedCurrentPos = Math.max(0, Math.min(100, currentPosPercent));

  // 持仓均价在区间中的位置（盈亏计算基准）
  const entryPosPercent =
    range === 0 ? 50 : ((avgEntryPrice - stopLoss) / range) * 100;
  const clampedEntryPos = Math.max(0, Math.min(100, entryPosPercent));

  // 盈亏百分比
  const pnlPercent =
    pnlPercentage !== null
      ? pnlPercentage
      : avgEntryPrice > 0
      ? ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100
      : 0;

  const isProfit = pnlPercent > 0;
  const isLoss = pnlPercent < 0;

  const displayMode = useAppStore((s) => s.displayMode);
  const rValue =
    displayMode === "R_UNIT" &&
    pnlAmount !== null &&
    positionSize > 0
      ? pnlToR(pnlAmount, avgEntryPrice, stopLoss, positionSize)
      : null;

  // 当前价接近止损（距 SL 区间 < 15%）或接近止盈（距 TP 区间 < 15%）
  const nearSL = clampedCurrentPos < 15;
  const nearTP = clampedCurrentPos > 85;
  // 颜色逻辑：亏损=绿色，盈利=红色（与金融传统相反）
  const cursorColor = nearSL ? "loss" : nearTP ? "profit" : isProfit ? "profit" : "loss";
  
  return (
    <>
      <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 space-y-3">
        {/* 首行：股票代码 + 名称 | 当前持仓 | 当前盈亏 */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-base font-mono font-semibold text-slate-100">
              {plan.stockSymbol}
            </div>
            {stockName && (
              <div className="text-sm text-slate-400 mt-0.5 truncate" title={stockName}>
                {stockName}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-xs text-slate-500 block">持仓</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {positionSize > 0 ? positionSize.toLocaleString() : "N/A"}股
              </span>
            </div>
            <div
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs font-semibold ${
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
              <span>
                {rValue > 0 ? "+" : ""}{rValue.toFixed(1)}R
              </span>
            ) : pnlAmount !== null ? (
              <>
                <span>
                  {pnlAmount > 0 ? "+" : ""}¥
                  {pnlAmount.toLocaleString("zh-CN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-slate-500">|</span>
                <span>
                  ({pnlPercent > 0 ? "+" : ""}
                  {pnlPercent.toFixed(2)}%)
                </span>
              </>
            ) : (
              <>
                <span>
                  {pnlPercent > 0 ? "+" : ""}
                  {pnlPercent.toFixed(2)}%
                </span>
              </>
            )}
            {riskLevel === "DANGER" && <AlertTriangle className="h-3 w-3 text-rose-400 ml-0.5" />}
            </div>
          </div>
        </div>

        {/* 买入逻辑 */}
        {"entryLogic" in plan && plan.entryLogic && (
          <div className="text-xs">
            <div className="text-slate-500 mb-1">买入逻辑</div>
            <div className="text-slate-400 line-clamp-2 leading-relaxed">{plan.entryLogic}</div>
          </div>
        )}

        {/* 进度条 */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span className="font-mono tabular-nums">{stopLoss}</span>
            <span className="font-mono font-medium text-slate-300 tabular-nums">{currentPrice}</span>
            <span className="font-mono tabular-nums">{takeProfit}</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-white/[0.06] overflow-visible">
            {/* 亏损区：Entry 左侧，极淡绿 */}
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500/15 transition-all duration-300 ease-out"
              style={{ width: `${clampedEntryPos}%` }}
            />
            {/* 盈利区：Entry 右侧，极淡红 */}
            <div
              className="absolute inset-y-0 right-0 rounded-r-full bg-rose-500/15 transition-all duration-300 ease-out"
              style={{
                left: `${clampedEntryPos}%`,
                width: `${100 - clampedEntryPos}%`,
              }}
            />

            {/* 持仓均价标记：小圆点 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-[2] w-1.5 h-1.5 rounded-full bg-slate-400/60 transition-all duration-300 ease-out"
              style={{ left: `${clampedEntryPos}%` }}
              title={`持仓均价 ${avgEntryPrice.toFixed(2)}`}
            />

            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-[3] transition-all duration-300 ease-out"
              style={{ left: `${clampedCurrentPos}%` }}
            >
              <div
                className={`w-3 h-3 rounded-full border border-slate-500/30 ${
                  cursorColor === "profit"
                    ? "bg-rose-400"
                    : "bg-emerald-400"
                } shadow-[0_1px_3px_rgba(0,0,0,0.3)]`}
                title={`当前价 ${currentPrice}`}
              />
            </div>
          </div>
        </div>

        {/* 交易信息：2x2 布局，留足间距 */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">开仓</span>
            <div className="font-mono font-medium text-slate-300">
              {Math.abs(entryPrice - avgEntryPrice) > 0.001 ? (
                <>
                  <span title="计划价">{plan.entryPrice}</span>
                  <span className="text-slate-500 mx-1">·</span>
                  <span className="text-emerald-400" title="持仓均价">{avgEntryPrice.toFixed(2)}</span>
                </>
              ) : (
                plan.entryPrice
              )}
            </div>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">止损</span>
            <div className="font-mono font-medium text-rose-400">{plan.stopLoss}</div>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">止盈</span>
            <div className="font-mono font-medium text-emerald-400">{plan.takeProfit}</div>
          </div>
          {("riskRewardRatio" in plan && plan.riskRewardRatio != null) && (
            <div>
              <span className="text-slate-500 block mb-0.5">盈亏比</span>
              <div
                className={`font-mono font-medium ${
                  Number(plan.riskRewardRatio) >= 1.5 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {Number(plan.riskRewardRatio).toFixed(2)}
              </div>
            </div>
          )}
          {realizedPnLVal !== undefined && realizedPnLVal !== null && realizedPnLVal !== 0 && (
            <div className="col-span-2">
              <span className="text-slate-500 block mb-0.5">已落袋</span>
              <div
                className={`font-mono font-medium ${
                  realizedPnLVal > 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {realizedPnLVal > 0 ? "+" : ""}¥{Number(realizedPnLVal).toLocaleString("zh-CN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
            </div>
          )}
        </div>

        {/* 距止损 + 操作按钮：2x2 网格保证同屏展示 */}
        <div className="pt-2 border-t border-slate-700/80 space-y-2">
          {"distanceToSL" in plan && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">距止损</span>
              <span
                className={`font-mono font-medium ${
                  (plan as TradeDashboard).distanceToSL > 0 ? "text-slate-300" : "text-risk"
                }`}
              >
                {(plan as TradeDashboard).distanceToSL > 0 ? "+" : ""}
                {(plan as TradeDashboard).distanceToSL.toFixed(2)}
              </span>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center justify-center gap-1 rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-2 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
              title="加仓"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" /> 加仓
            </button>
            <button
              onClick={() => setTrimModalOpen(true)}
              className="flex items-center justify-center gap-1 rounded-lg border border-amber-600/50 bg-amber-500/10 px-2 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
              title="减仓"
            >
              <Minus className="h-3.5 w-3.5 shrink-0" /> 减仓
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center justify-center gap-1 rounded-lg border border-rose-600/50 bg-rose-500/10 px-2 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20"
              title="平仓"
            >
              <XCircle className="h-3.5 w-3.5 shrink-0" /> 平仓
            </button>
            <button
              onClick={async () => {
                if (!confirm(`确定要删除 ${plan.stockSymbol} 的持仓吗？此操作不可恢复。`)) return;
                setDeleting(true);
                try {
                  const planId = "planId" in plan ? plan.planId : "id" in plan ? plan.id : 0;
                  await deletePlan(planId);
                  onClose();
                } catch (error: any) {
                  alert("删除失败: " + (error.message || "未知错误"));
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="flex items-center justify-center gap-1 rounded-lg border border-rose-600/40 bg-rose-500/5 px-2 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/15 disabled:opacity-50"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              {deleting ? "..." : "删除"}
            </button>
          </div>
        </div>
      </div>

      <AddPositionModal
        planId={planId}
        stockSymbol={plan.stockSymbol}
        stockName={stockName ?? undefined}
        avgEntryPrice={avgEntryPrice}
        totalQuantity={totalQty}
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={onClose}
      />

      <TrimPositionModal
        planId={planId}
        stockSymbol={plan.stockSymbol}
        avgEntryPrice={avgEntryPrice}
        currentQuantity={positionSize}
        stopLoss={stopLoss}
        takeProfit={takeProfit}
        open={trimModalOpen}
        onClose={() => setTrimModalOpen(false)}
        onSuccess={onClose}
      />

      <ClosePositionModal
        plan={
          isDashboard
            ? {
                id: (plan as TradeDashboard).planId,
                stockSymbol: plan.stockSymbol,
                direction: "LONG",
                entryPrice: avgEntryPrice,
                avgEntryPrice,
                positionSize,
                totalQuantity: positionSize,
                stopLoss: plan.stopLoss,
                takeProfit: plan.takeProfit,
                riskRewardRatio: 0,
                entryLogic: "",
                status: "OPEN",
                createdAt: "",
              }
            : (plan as TradePlan)
        }
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={() => {
          setModalOpen(false);
          onClose();
        }}
      />
    </>
  );
}
