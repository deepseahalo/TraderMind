"use client";

/**
 * 仪表盘顶部概览卡片
 * 展示核心交易指标
 */
export default function DashboardOverview() {
  // TODO: 从 API 获取真实数据
  const totalEquity = 1_000_000; // 总权益
  const riskExposure = 15_000; // 当前风险敞口（模拟）
  const winRate = 65; // 胜率（模拟）

  // 格式化金额：超过 1万 显示为 "X万"
  const formatCurrency = (amount: number) => {
    if (amount >= 10_000) {
      const wan = (amount / 10_000).toFixed(1);
      return `${wan}万`;
    }
    return amount.toLocaleString();
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
      {/* 总权益 */}
      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-3 sm:p-4 overflow-hidden">
        <div className="text-[10px] sm:text-xs text-slate-400 mb-1 truncate">总权益</div>
        <div className="text-sm sm:text-base font-bold text-slate-100 truncate">
          ¥{formatCurrency(totalEquity)}
        </div>
      </div>

      {/* 当前风险敞口 */}
      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-3 sm:p-4 overflow-hidden">
        <div className="text-[10px] sm:text-xs text-slate-400 mb-1 truncate">风险敞口</div>
        <div className="text-sm sm:text-base font-bold text-rose-400 truncate">
          ¥{formatCurrency(riskExposure)}
        </div>
        <div className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 truncate">
          {(riskExposure / totalEquity * 100).toFixed(1)}%
        </div>
      </div>

      {/* 胜率 */}
      <div className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-3 sm:p-4 overflow-hidden">
        <div className="text-[10px] sm:text-xs text-slate-400 mb-1 truncate">胜率</div>
        <div className="text-sm sm:text-base font-bold text-emerald-400 truncate">
          {winRate}%
        </div>
      </div>
    </div>
  );
}
