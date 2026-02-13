"use client";

import useSWR from "swr";
import { fetchActivePlans, fetchActiveTradesDashboard } from "@/lib/api";
import PositionCard from "./PositionCard";

const fetcher = async () => fetchActivePlans();
const dashboardFetcher = async () => fetchActiveTradesDashboard();

/**
 * 当前持仓列表组件
 * 使用新的 PositionCard 组件展示
 * 优先使用实时行情数据（dashboard），如果失败则回退到基础数据
 */
export default function ActivePositionsCard() {
  // 优先获取实时行情数据
  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading, mutate: mutateDashboard } = useSWR(
    "active-trades-dashboard",
    dashboardFetcher,
    {
      refreshInterval: 10_000, // 10秒刷新一次实时数据
      revalidateOnFocus: true
    }
  );

  // 备用：基础数据（如果实时数据获取失败）
  const { data: basicData, error: basicError, isLoading: basicLoading, mutate: mutateBasic } = useSWR(
    dashboardError ? "active-plans" : null,
    fetcher,
    {
      refreshInterval: 15_000
    }
  );

  // 使用实时数据（如果可用），否则使用基础数据
  const data = dashboardData || basicData;
  const error = dashboardError && basicError ? basicError : null;
  const isLoading = dashboardLoading || basicLoading;
  
  // 刷新函数：同时刷新两个数据源
  const mutate = () => {
    mutateDashboard();
    mutateBasic();
  };

  if (isLoading) {
    return <div className="text-sm text-slate-400 text-center py-8">加载中...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-risk/60 bg-risk/10 px-4 py-3 text-sm text-risk">
        加载持仓失败
      </div>
    );
  }

  const plans = data || [];

  if (plans.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-12">
        <div className="mb-2">暂无持仓计划</div>
        <div className="text-xs text-slate-600">点击右上角按钮创建新的交易计划</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <PositionCard
          key={"planId" in plan ? plan.planId : plan.id}
          plan={plan}
          onClose={() => mutate()}
        />
      ))}
    </div>
  );
}
