// 动态获取 API 基础 URL
// 优先使用环境变量，否则根据当前访问地址自动检测
function getBaseUrl(): string {
  // 如果设置了环境变量，优先使用
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // 在浏览器环境中，动态检测 hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // 如果是 localhost 或 127.0.0.1，使用 localhost:8080
    // 否则使用相同的 hostname，端口改为 8080（适用于局域网访问）
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    // 对于 IP 地址（如 192.168.x.x），使用相同的 IP 和 8080 端口
    return `http://${hostname}:8080`;
  }
  
  // 服务端渲染时默认使用 localhost
  return 'http://localhost:8080';
}

const BASE_URL = getBaseUrl();

export type TradeDirection = "LONG" | "SHORT";

export interface TradePlan {
  id: number;
  stockSymbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskRewardRatio: number;
  entryLogic: string;
  status: "PENDING" | "OPEN" | "CLOSED";
  createdAt: string;
}

export interface TradeDashboard {
  planId: number;
  stockSymbol: string;
  stockName?: string;  // 股票中文名称（仪表盘接口返回）
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  currentPrice: number;
  pnlAmount: number;
  pnlPercentage: number;
  distanceToSL: number;
  riskLevel: "SAFE" | "DANGER";
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
