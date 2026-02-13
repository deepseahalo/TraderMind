"use client";

import { useState } from "react";
import { TradePlan, TradeDashboard, closePlan, deletePlan } from "@/lib/api";
import ClosePositionModal from "./ClosePositionModal";
import { XCircle, AlertTriangle, Trash2 } from "lucide-react";

interface Props {
  plan: TradePlan | TradeDashboard;
  onClose: () => void;
}

/**
 * 单个持仓卡片组件
 * 包含区间进度条、盈亏 Badge、股票名称展示
 * 支持 TradePlan（基础数据）和 TradeDashboard（实时数据）
 */
export default function PositionCard({ plan, onClose }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 判断是否为实时数据
  const isDashboard = "currentPrice" in plan;

  // 获取股票展示文本：优先 "代码 | 名称"
  const stockDisplay =
    isDashboard && (plan as TradeDashboard).stockName
      ? `${plan.stockSymbol} | ${(plan as TradeDashboard).stockName}`
      : plan.stockSymbol;

  // 获取当前价格（优先使用实时数据）
  const currentPrice = isDashboard
    ? (plan as TradeDashboard).currentPrice
    : plan.entryPrice;
  const entryPrice = plan.entryPrice;
  const stopLoss = plan.stopLoss;
  const takeProfit = plan.takeProfit;

  // 获取盈亏数据：实时数据用 API，基础数据按仓位计算
  const positionSize = "positionSize" in plan ? plan.positionSize : 0;
  const pnlAmount = isDashboard
    ? (plan as TradeDashboard).pnlAmount
    : positionSize > 0
    ? (currentPrice - entryPrice) * positionSize
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

  // 开仓价在区间中的位置
  const entryPosPercent =
    range === 0 ? 50 : ((entryPrice - stopLoss) / range) * 100;
  const clampedEntryPos = Math.max(0, Math.min(100, entryPosPercent));

  // 盈亏百分比
  const pnlPercent =
    pnlPercentage !== null
      ? pnlPercentage
      : ((currentPrice - entryPrice) / entryPrice) * 100;

  const isProfit = pnlPercent > 0;
  const isLoss = pnlPercent < 0;

  // 当前价接近止损（距 SL 区间 < 15%）或接近止盈（距 TP 区间 < 15%）
  const nearSL = clampedCurrentPos < 15;
  const nearTP = clampedCurrentPos > 85;
  // 颜色逻辑：亏损=绿色，盈利=红色（与金融传统相反）
  const cursorColor = nearSL ? "loss" : nearTP ? "profit" : isProfit ? "profit" : "loss";
  
  // 当前价和开仓价是否接近（差距小于5%），如果接近则隐藏开仓标签避免重叠
  const isNearEntry = Math.abs(clampedCurrentPos - clampedEntryPos) < 5;

  return (
    <>
      <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 space-y-4">
        {/* 头部：标的（代码 | 名称） */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-mono font-semibold text-slate-100 truncate">
              {stockDisplay}
            </span>
          </div>
        </div>

        {/* 盈亏 Badge：金额 + 百分比，带背景色块 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">当前盈亏</span>
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-semibold ${
              isProfit
                ? "bg-rose-500/20 text-rose-400"
                : isLoss
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-slate-700/50 text-slate-400"
            }`}
          >
            {pnlAmount !== null ? (
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
            {riskLevel === "DANGER" && (
              <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* 区间进度条：SL ─── Entry ─── 当前价 ─── TP */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">止损 {stopLoss}</span>
            <span className="font-mono font-medium text-slate-300">
              当前 {currentPrice}
            </span>
            <span className="font-mono">止盈 {takeProfit}</span>
          </div>

          {/* 进度条容器：亏损区（左）| 开仓价 | 盈利区（右） */}
          <div className="relative h-10 rounded-xl bg-slate-800/50 border border-slate-700/30 overflow-hidden shadow-inner">
            {/* 亏损区：Entry 左侧，绿色渐变（亏损=绿色）- 更平滑的渐变 */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-600/35 via-emerald-500/20 to-emerald-500/5 transition-all duration-700 ease-in-out"
              style={{ width: `${clampedEntryPos}%` }}
            />
            {/* 盈利区：Entry 右侧，红色渐变（盈利=红色）- 更平滑的渐变 */}
            <div
              className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-rose-600/35 via-rose-500/20 to-rose-500/5 transition-all duration-700 ease-in-out"
              style={{
                left: `${clampedEntryPos}%`,
                width: `${100 - clampedEntryPos}%`,
              }}
            />

            {/* 开仓价标记：更柔和的视觉标记 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-[3] transition-all duration-700 ease-in-out"
              style={{ left: `${clampedEntryPos}%` }}
            >
              {/* 开仓标签 - 当游标接近时隐藏，避免重叠 */}
              {!isNearEntry && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <div className="px-2 py-0.5 rounded-md bg-slate-800/95 backdrop-blur-sm border border-slate-600/30 text-[10px] font-medium text-slate-300 shadow-lg">
                    开仓
                  </div>
                </div>
              )}
              {/* 更柔和的标记点 - 使用更小的尺寸和更低的透明度 */}
              <div className="w-1 h-1 rounded-full bg-slate-300/40 shadow-sm" />
            </div>

            {/* 当前价光标：更丝滑的圆形游标 */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-700 ease-in-out ${
                cursorColor === "profit"
                  ? "text-rose-500"
                  : "text-emerald-500"
              }`}
              style={{ left: `${clampedCurrentPos}%` }}
            >
              {/* 外层光晕 - 更柔和的光晕效果 */}
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full ${
                cursorColor === "profit"
                  ? "bg-rose-500/10"
                  : "bg-emerald-500/10"
              } blur-xl`} />
              {/* 中层光晕 */}
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full ${
                cursorColor === "profit"
                  ? "bg-rose-500/20"
                  : "bg-emerald-500/20"
              } blur-md`} />
              {/* 内层光晕 */}
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${
                cursorColor === "profit"
                  ? "bg-rose-500/30"
                  : "bg-emerald-500/30"
              } blur-sm`} />
              {/* 圆形游标 - 更精致的样式 */}
              <div className={`relative z-10 w-4 h-4 rounded-full border-2 ${
                cursorColor === "profit"
                  ? "bg-rose-500 border-rose-400/80 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                  : "bg-emerald-500 border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              } shadow-lg`} />
            </div>
          </div>
        </div>

        {/* 交易信息网格 */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500">开仓价</span>
            <div className="mt-0.5 font-mono font-semibold text-slate-300">
              {plan.entryPrice}
            </div>
          </div>
          <div>
            <span className="text-slate-500">止损</span>
            <div className="mt-0.5 font-mono font-semibold text-rose-400">
              {plan.stopLoss}
            </div>
          </div>
          <div>
            <span className="text-slate-500">止盈</span>
            <div className="mt-0.5 font-mono font-semibold text-emerald-400">
              {plan.takeProfit}
            </div>
          </div>
          <div>
            <span className="text-slate-500">仓位</span>
            <div className="mt-0.5 font-mono font-semibold text-slate-300">
              {"positionSize" in plan ? plan.positionSize : "N/A"}
            </div>
          </div>
        </div>

        {/* 盈亏比和距离止损 */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <div className="space-y-1">
            {"riskRewardRatio" in plan && (
              <div>
                <span className="text-xs text-slate-500">盈亏比</span>
                <span
                  className={`ml-2 text-sm font-mono font-semibold ${
                    plan.riskRewardRatio >= 1.5 ? "text-profit" : "text-risk"
                  }`}
                >
                  {plan.riskRewardRatio?.toFixed?.(2) ?? plan.riskRewardRatio}
                </span>
              </div>
            )}
            {"distanceToSL" in plan && (
              <div>
                <span className="text-xs text-slate-500">距止损</span>
                <span
                  className={`ml-2 text-xs font-mono ${
                    (plan as TradeDashboard).distanceToSL > 0
                      ? "text-slate-300"
                      : "text-risk"
                  }`}
                >
                  {(plan as TradeDashboard).distanceToSL > 0 ? "+" : ""}
                  {(plan as TradeDashboard).distanceToSL.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 active:bg-risk/10 active:border-risk active:text-risk active:scale-[0.98] transition-all"
            >
              <XCircle className="h-4 w-4" />
              平仓
            </button>
            <button
              onClick={async () => {
                if (!confirm(`确定要删除 ${plan.stockSymbol} 的持仓吗？此操作不可恢复。`)) {
                  return;
                }
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
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "删除中..." : "删除"}
            </button>
          </div>
        </div>

        {/* 买入逻辑 */}
        {"entryLogic" in plan && plan.entryLogic && (
          <div className="text-xs text-slate-500 line-clamp-2 pt-2 border-t border-slate-700">
            逻辑：{plan.entryLogic}
          </div>
        )}
      </div>

      <ClosePositionModal
        plan={
          isDashboard
            ? {
                id: (plan as TradeDashboard).planId,
                stockSymbol: plan.stockSymbol,
                direction: "LONG",
                entryPrice: plan.entryPrice,
                stopLoss: plan.stopLoss,
                takeProfit: plan.takeProfit,
                positionSize: 0,
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
