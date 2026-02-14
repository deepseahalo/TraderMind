"use client";

import { useState } from "react";
import { TradePlan, cancelPlan } from "@/lib/api";
import ConfirmEntryModal from "./ConfirmEntryModal";

interface Props {
  plan: TradePlan;
  onSuccess: () => void;
}

/**
 * 待成交计划卡片（PENDING 状态）
 * 操作：确认成交、撤单
 */
export default function PendingPlanCard({ plan, onSuccess }: Props) {
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCancel = async () => {
    if (!confirm("确定要撤单吗？此计划将变为已取消状态。")) return;
    setDeleting(true);
    try {
      await cancelPlan(plan.id);
      onSuccess();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "撤单失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-amber-500/30 bg-slate-900/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-mono font-semibold text-slate-100">{plan.stockSymbol}</span>
            {plan.stockName && (
              <div className="text-sm text-slate-400 mt-0.5">{plan.stockName}</div>
            )}
          </div>
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
            待成交
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500">计划价</span>
            <div className="font-mono font-semibold text-slate-300">{plan.entryPrice}</div>
          </div>
          <div>
            <span className="text-slate-500">计划仓位</span>
            <div className="font-mono font-semibold text-slate-300">
              {plan.positionSize.toLocaleString()} 股
            </div>
          </div>
          <div>
            <span className="text-slate-500">止损</span>
            <div className="font-mono font-semibold text-rose-400">{plan.stopLoss}</div>
          </div>
          <div>
            <span className="text-slate-500">止盈</span>
            <div className="font-mono font-semibold text-emerald-400">{plan.takeProfit}</div>
          </div>
        </div>
        {plan.entryLogic && (
          <div className="text-xs text-slate-500 line-clamp-2">逻辑：{plan.entryLogic}</div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setConfirmModalOpen(true)}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
          >
            确认成交
          </button>
          <button
            onClick={handleCancel}
            disabled={deleting}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            {deleting ? "撤单中..." : "撤单"}
          </button>
        </div>
      </div>

      <ConfirmEntryModal
        planId={plan.id}
        stockSymbol={plan.stockSymbol}
        stockName={plan.stockName}
        plannedPrice={plan.entryPrice}
        plannedQuantity={plan.positionSize}
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}
