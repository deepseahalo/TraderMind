"use client";

import useSWR from "swr";
import { fetchPendingPlans, fetchActivePlans, fetchActiveTradesDashboard } from "@/lib/api";
import PositionCard from "./PositionCard";
import PendingPlanCard from "./PendingPlanCard";

const pendingFetcher = () => fetchPendingPlans();
const dashboardFetcher = () => fetchActiveTradesDashboard();
const basicFetcher = () => fetchActivePlans();

/**
 * 当前持仓列表：分区展示 待成交计划 + 当前持仓
 */
export default function ActivePositionsCard() {
  const { data: pendingPlans, mutate: mutatePending } = useSWR(
    "pending-plans",
    pendingFetcher,
    { refreshInterval: 15_000, revalidateOnFocus: true }
  );

  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading, mutate: mutateDashboard } = useSWR(
    "active-trades-dashboard",
    dashboardFetcher,
    { refreshInterval: 10_000, revalidateOnFocus: true }
  );

  const { data: basicData, mutate: mutateBasic } = useSWR(
    dashboardError ? "active-plans" : null,
    basicFetcher,
    { refreshInterval: 15_000 }
  );

  const activeData = dashboardData || basicData;
  const isLoading = dashboardLoading && !dashboardError;

  const mutate = () => {
    mutatePending();
    mutateDashboard();
    mutateBasic();
  };

  if (isLoading && !pendingPlans?.length) {
    return <div className="text-sm text-slate-400 text-center py-8">加载中...</div>;
  }

  const pending = pendingPlans || [];
  const active = activeData || [];
  const hasAny = pending.length > 0 || active.length > 0;

  if (!hasAny) {
    return (
      <div className="text-sm text-slate-500 text-center py-12">
        <div className="mb-2">暂无持仓计划</div>
        <div className="text-xs text-slate-600">点击右上角「新建计划」创建交易计划</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 区域 A：待成交计划 */}
      {pending.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">
            待成交计划
          </h4>
          <div className="space-y-3">
            {pending.map((plan) => (
              <PendingPlanCard key={plan.id} plan={plan} onSuccess={mutate} />
            ))}
          </div>
        </div>
      )}

      {/* 区域 B：当前持仓 */}
      {active.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">
            当前持仓
          </h4>
          <div className="space-y-3">
            {active.map((plan) => (
              <PositionCard
                key={"planId" in plan ? plan.planId : plan.id}
                plan={plan}
                onClose={mutate}
              />
            ))}
          </div>
        </div>
      )}

      {dashboardError && !basicData?.length && (
        <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          加载持仓数据失败
        </div>
      )}
    </div>
  );
}
