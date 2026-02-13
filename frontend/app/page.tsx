"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import ActivePositionsCard from "@/components/ActivePositionsCard";
import TradeEntryModal from "@/components/TradeEntryModal";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTradeSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <>
      <main className="space-y-4 pb-6">
        {/* 标签页和新建按钮 */}
        <div className="flex items-center justify-between mb-4">
          {/* 标签页 */}
          <div className="flex gap-2 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("positions")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "positions"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              当前持仓
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "history"
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              历史交易
            </button>
          </div>

          {/* 新建交易计划按钮 */}
          <button
            onClick={() => setTradeModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:bg-emerald-400 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            新建计划
          </button>
        </div>

        {/* 内容区域 */}
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 shadow-lg min-h-[400px]">
          {activeTab === "positions" ? (
            <ActivePositionsCard key={refreshKey} />
          ) : (
            <div className="text-sm text-slate-500 text-center py-12">
              <div className="mb-2">历史交易功能开发中</div>
              <div className="text-xs text-slate-600">即将推出...</div>
            </div>
          )}
        </div>
      </main>

      {/* 交易计划弹窗 */}
      <TradeEntryModal
        open={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        onSuccess={handleTradeSuccess}
      />
    </>
  );
}
