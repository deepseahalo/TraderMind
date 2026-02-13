"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, TrendingUp, Loader2 } from "lucide-react";
import { searchStocks, StockSearchResult } from "@/lib/api";

interface Props {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

/**
 * 股票搜索输入组件
 * 支持输入股票代码或名称进行搜索（通过API）
 */
export default function StockSearchInput({ value, onChange, placeholder }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelected, setIsSelected] = useState(false); // 标记是否已选择股票
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // 同步外部 value 变化到内部 searchTerm（当 value 被外部清空时）
  useEffect(() => {
    if (!value && searchTerm) {
      setSearchTerm("");
      setResults([]);
      setShowResults(false);
      setIsSelected(false); // 重置选择状态
    }
  }, [value]);

  // 搜索股票（通过API）
  useEffect(() => {
    // 如果已选择股票，不触发搜索
    if (isSelected) {
      return;
    }

    if (!searchTerm.trim()) {
      setResults([]);
      setShowResults(false);
      setError(null);
      return;
    }

    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearching(true);
    setError(null);

    // 防抖：500ms 后执行搜索
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log("搜索股票:", searchTerm.trim());
        const searchResults = await searchStocks(searchTerm.trim());
        console.log("搜索结果:", searchResults);
        setResults(searchResults);
        setShowResults(searchResults.length > 0);
        if (searchResults.length === 0) {
          setError("未找到匹配的股票");
        }
      } catch (error: any) {
        console.error("搜索股票失败:", error);
        const errorMsg = error?.message || "搜索失败，请检查网络连接";
        setError(errorMsg);
        setResults([]);
        setShowResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, isSelected]);

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (stock: StockSearchResult) => {
    onChange(stock.code);
    // 显示股票代码和名称，方便用户确认
    setSearchTerm(`${stock.code} ${stock.name}`);
    setShowResults(false);
    setError(null);
    setResults([]); // 清空搜索结果
    setIsSelected(true); // 标记已选择，防止触发新的搜索
  };

  const handleClear = () => {
    setSearchTerm("");
    onChange("");
    setShowResults(false);
    setError(null);
    setIsSelected(false); // 重置选择状态
  };

  const getMarketLabel = (market: string) => {
    switch (market) {
      case "sh": return "沪";
      case "sz": return "深";
      case "hk": return "港";
      case "us": return "美";
      default: return "";
    }
  };

  const getMarketColor = (market: string) => {
    switch (market) {
      case "sh": return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "sz": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      default: return "bg-slate-700 text-slate-300 border-slate-600";
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            const newValue = e.target.value;
            setSearchTerm(newValue);
            setIsSelected(false); // 用户重新输入时，重置选择状态
            if (!newValue.trim()) {
              onChange("");
            }
          }}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true);
            }
          }}
          placeholder={placeholder || "搜索股票代码或名称，如：600519 或 茅台"}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-10 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        {(searchTerm || value) && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 搜索结果下拉列表 */}
      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-slate-700 bg-slate-900 shadow-xl max-h-64 overflow-y-auto">
          {results.map((stock) => (
            <button
              key={stock.code}
              onClick={() => handleSelect(stock)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors text-left"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <TrendingUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-100">
                      {stock.code}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${getMarketColor(stock.market)}`}>
                      {getMarketLabel(stock.market)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 truncate mt-0.5">
                    {stock.name}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 搜索中提示 */}
      {isSearching && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          搜索中...
        </div>
      )}

      {/* 无结果/错误提示 */}
      {!isSearching && searchTerm && results.length === 0 && (showResults || error) && (
        <div className={`absolute z-50 w-full mt-1 rounded-lg border px-4 py-3 text-sm ${
          error 
            ? "border-rose-500/50 bg-rose-500/10 text-rose-400" 
            : "border-slate-700 bg-slate-900 text-slate-400"
        }`}>
          {error || "未找到匹配的股票"}
        </div>
      )}
    </div>
  );
}
