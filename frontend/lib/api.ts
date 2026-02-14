// API 基础 URL
// 默认空字符串 = 同源，由 next.config.js rewrites 转发到后端（适用于局域网、ngrok 等单端口暴露）
// 若需直连后端，可设置 NEXT_PUBLIC_API_BASE_URL=http://host:8080
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  return ""; // 同源，走 /api/* -> 后端 8080
}

const BASE_URL = getBaseUrl();

export type TradeDirection = "LONG" | "SHORT";

export interface TradePlan {
  id: number;
  stockSymbol: string;
  stockName?: string;  // 股票中文名称
  direction: TradeDirection;
  entryPrice: number;
  avgEntryPrice: number | null;  // 加权平均成本，PENDING 时为 null
  positionSize: number;          // 计划仓位
  totalQuantity: number | null;   // 历史总买入量，PENDING 时为 null
  currentQuantity?: number | null;   // 当前剩余持仓，减仓后递减
  realizedPnL?: number | null;       // 累计已落袋盈亏
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  entryLogic: string;
  status: "PENDING" | "OPEN" | "CLOSED" | "CANCELLED";
  createdAt: string;
}

export interface TradeDashboard {
  planId: number;
  stockSymbol: string;
  stockName?: string;
  entryPrice: number;       // 计划价（复盘对比）
  avgEntryPrice: number;   // 持仓均价（盈亏计算基准）
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  totalQuantity: number;    // 历史总买入量
  currentQuantity: number;  // 当前剩余持仓（减仓后递减）
  realizedPnL?: number;     // 累计已落袋盈亏（减仓所得）
  currentPrice: number;
  pnlAmount: number;
  pnlPercentage: number;
  distanceToSL: number;
  riskLevel: "SAFE" | "DANGER";
  entryLogic?: string;  // 买入逻辑
  riskRewardRatio?: number;  // 盈亏比
}

export interface TrimPositionPayload {
  exitPrice: number;
  exitQuantity: number;
  exitLogic: string;
  newStopLoss?: number;
  newTakeProfit?: number;
}

export interface CreateTradePlanPayload {
  stockSymbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize?: number; // 可选：买入股数，如果不提供则后端自动计算
  entryLogic: string;
}

export interface CloseTradePayload {
  exitPrice: number;
  exitLogic: string;
  emotionalState?: string;
}

export interface TradeExecution {
  executionId: number;
  planId: number;
  exitPrice: number;
  realizedPnL: number;
  aiAnalysisScore?: number;
  aiAnalysisComment?: string;
}

export interface TradeHistory {
  executionId: number;
  planId: number;
  stockSymbol: string;
  stockName?: string;
  direction: TradeDirection;
  entryPrice: number;       // 计划价
  avgEntryPrice: number;    // 实际持仓均价
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  totalQuantity: number;    // 平仓时实际仓位
  realizedPnL: number;
  realizedPnLPercent: number;
  entryLogic: string;
  exitLogic: string;
  emotionalState?: string;
  aiAnalysisScore?: number;
  aiAnalysisComment?: string;
  createdAt: string;
  closedAt: string;
}

export type TransactionType = "INITIAL_ENTRY" | "ADD_POSITION" | "PARTIAL_EXIT" | "FULL_EXIT";

export interface TradeTransaction {
  id: number;
  type: TransactionType;
  price: number;
  quantity: number;
  transactionTime: string;
  logicSnapshot?: string;
}

export async function createTradePlan(payload: CreateTradePlanPayload) {
  const res = await fetch(`${BASE_URL}/api/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "创建失败" }));
    throw new Error(error.message || "创建失败");
  }
  return (await res.json()) as TradePlan;
}

/**
 * 获取待成交计划（PENDING）
 */
export async function fetchPendingPlans(): Promise<TradePlan[]> {
  const res = await fetch(`${BASE_URL}/api/plans/pending`, { cache: "no-store" });
  if (!res.ok) throw new Error("获取待成交计划失败");
  return (await res.json()) as TradePlan[];
}

/**
 * 首次建仓：将 PENDING 计划转为 OPEN 持仓
 */
export async function executePlan(planId: number, actualPrice: number, quantity: number): Promise<TradePlan> {
  const res = await fetch(`${BASE_URL}/api/plans/${planId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actualPrice, quantity })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "建仓失败" }));
    throw new Error(error.message || "建仓失败");
  }
  return (await res.json()) as TradePlan;
}

/**
 * 减仓：部分卖出，落袋盈亏，可同步更新剩余仓位的止损/止盈
 */
export async function trimPosition(
  planId: number,
  payload: TrimPositionPayload
): Promise<TradePlan> {
  const res = await fetch(`${BASE_URL}/api/plans/${planId}/trim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exitPrice: payload.exitPrice,
      exitQuantity: payload.exitQuantity,
      exitLogic: payload.exitLogic || "",
      newStopLoss: payload.newStopLoss ?? undefined,
      newTakeProfit: payload.newTakeProfit ?? undefined
    })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "减仓失败" }));
    throw new Error(error.message || "减仓失败");
  }
  return (await res.json()) as TradePlan;
}

/**
 * 加仓
 */
export async function addPosition(
  planId: number,
  addPrice: number,
  addQuantity: number,
  addLogic?: string
): Promise<TradePlan> {
  const res = await fetch(`${BASE_URL}/api/plans/${planId}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      addPrice,
      addQuantity,
      addLogic: addLogic || ""
    })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "加仓失败" }));
    throw new Error(error.message || "加仓失败");
  }
  return (await res.json()) as TradePlan;
}

/**
 * 撤单：取消 PENDING 计划
 */
export async function cancelPlan(planId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/plans/${planId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || "撤单失败");
  }
}

/**
 * 获取计划的所有交易流水
 */
export async function fetchPlanTransactions(planId: number): Promise<TradeTransaction[]> {
  const res = await fetch(`${BASE_URL}/api/plans/${planId}/transactions`, { cache: "no-store" });
  if (!res.ok) throw new Error("获取流水失败");
  return (await res.json()) as TradeTransaction[];
}

export async function fetchActivePlans() {
  try {
    const res = await fetch(`${BASE_URL}/api/plans/active`, {
      cache: "no-store"
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`获取持仓失败: ${res.status} ${res.statusText}`, errorText);
      throw new Error(`获取持仓失败: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as TradePlan[];
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`网络错误: 无法连接到 ${BASE_URL}`, error);
      throw new Error(`无法连接到后端服务器 (${BASE_URL})，请检查网络连接和后端服务是否运行`);
    }
    throw error;
  }
}

export async function fetchActiveTradesDashboard() {
  try {
    const res = await fetch(`${BASE_URL}/api/plans/active/dashboard`, {
      cache: "no-store"
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`获取持仓仪表盘数据失败: ${res.status} ${res.statusText}`, errorText);
      throw new Error(`获取持仓仪表盘数据失败: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as TradeDashboard[];
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`网络错误: 无法连接到 ${BASE_URL}`, error);
      throw new Error(`无法连接到后端服务器 (${BASE_URL})，请检查网络连接和后端服务是否运行`);
    }
    throw error;
  }
}

export async function closePlan(id: number, payload: CloseTradePayload) {
  const res = await fetch(`${BASE_URL}/api/plans/${id}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "平仓失败" }));
    throw new Error(error.message || "平仓失败");
  }
  return (await res.json()) as TradeExecution;
}

/**
 * 删除交易计划
 * @param id 交易计划 ID
 */
export async function deletePlan(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/plans/${id}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "删除失败" }));
    throw new Error(error.message || "删除失败");
  }
}

/**
 * 根据股票代码删除交易计划
 * @param stockSymbol 股票代码
 */
export async function deletePlanByStockSymbol(stockSymbol: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/plans/stock/${encodeURIComponent(stockSymbol)}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "删除失败" }));
    throw new Error(error.message || "删除失败");
  }
}

/**
 * 为历史交易触发 AI 分析
 * 异步执行，立即返回。适用于平仓时 AI 分析失败或历史数据无分析记录的场景
 * @param executionId 交易执行记录 ID
 */
export async function triggerAiReview(executionId: number): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${BASE_URL}/api/plans/closed/${executionId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json().catch(() => ({ success: false, message: "请求失败" }));
  if (!res.ok || !data.success) {
    throw new Error(data.message || "触发 AI 分析失败");
  }
  return data;
}

/**
 * 获取历史交易记录（已平仓的交易）
 * @returns 历史交易列表，按平仓时间倒序排列
 */
export async function fetchTradeHistory(): Promise<TradeHistory[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/plans/closed`, {
      cache: "no-store"
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`获取历史交易失败: ${res.status} ${res.statusText}`, errorText);
      throw new Error(`获取历史交易失败: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as TradeHistory[];
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`网络错误: 无法连接到 ${BASE_URL}`, error);
      throw new Error(`无法连接到后端服务器 (${BASE_URL})，请检查网络连接和后端服务是否运行`);
    }
    throw error;
  }
}

export interface StockPriceResponse {
  success: boolean;
  price?: number;
  stockCode?: string;
  message?: string;
}

/**
 * 获取股票实时价格
 * @param stockCode 股票代码（如：600519, 000001）
 * @returns 股票价格信息
 */
export async function getStockPrice(stockCode: string): Promise<StockPriceResponse> {
  const res = await fetch(`${BASE_URL}/api/plans/stock/${encodeURIComponent(stockCode)}/price`, {
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("获取股票价格失败");
  }
  return (await res.json()) as StockPriceResponse;
}

/** 应用设置：总资金、单笔风险百分比 */
export interface AppSettings {
  totalCapital: number;
  riskPercent: number;
}

/**
 * 获取应用设置
 */
export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${BASE_URL}/api/settings`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("获取设置失败");
  }
  const data = await res.json();
  return {
    totalCapital: Number(data.totalCapital),
    riskPercent: Number(data.riskPercent)
  };
}

/**
 * 更新应用设置
 */
export async function updateSettings(payload: AppSettings): Promise<AppSettings> {
  const res = await fetch(`${BASE_URL}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      totalCapital: payload.totalCapital,
      riskPercent: payload.riskPercent
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "保存失败" }));
    throw new Error(err.message || "保存设置失败");
  }
  const data = await res.json();
  return {
    totalCapital: Number(data.totalCapital),
    riskPercent: Number(data.riskPercent)
  };
}

export interface StockSearchResult {
  code: string;
  name: string;
  market: string;
}

/**
 * 搜索股票
 * @param keyword 搜索关键词（股票代码或名称）
 * @returns 股票搜索结果列表
 */
/**
 * AI 交易前置质询
 * 获取 DeepSeek 对买入逻辑的风险点质询（通常 3 条）
 * @param stockSymbol 股票代码
 * @param currentPrice 当前价格（可选）
 * @param logic 买入逻辑
 * @returns 风险点字符串数组
 */
export async function getAIPreTradeChallenge(
  stockSymbol: string,
  currentPrice: number | null,
  logic: string
): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/api/ai/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stockSymbol,
      currentPrice: currentPrice != null ? currentPrice : undefined,
      logic
    })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "AI 质询失败" }));
    throw new Error(error.message || "AI 质询失败");
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function searchStocks(keyword: string): Promise<StockSearchResult[]> {
  if (!keyword || !keyword.trim()) {
    return [];
  }
  
  try {
    const url = `${BASE_URL}/api/plans/stock/search?keyword=${encodeURIComponent(keyword.trim())}`;
    console.log("搜索股票 API URL:", url);
    
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("搜索股票失败:", res.status, errorText);
      throw new Error(`搜索失败: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log("搜索股票响应:", data);
    
    // 确保返回的是数组
    if (!Array.isArray(data)) {
      console.warn("搜索股票返回的不是数组:", data);
      return [];
    }
    
    return data as StockSearchResult[];
  } catch (error: any) {
    console.error("搜索股票异常:", error);
    if (error.message) {
      throw error;
    }
    throw new Error(`搜索股票失败: ${error.message || "网络错误"}`);
  }
}
