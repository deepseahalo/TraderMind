"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X, TrendingUp, Loader2 } from "lucide-react";
import { searchStocks, StockSearchResult } from "@/lib/api";

interface Props {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

/** 用 Portal 渲染 overlay 到 body，避免覆盖下方表单导致点击错位 */
function useOverlayPosition(containerRef: React.RefObject<HTMLDivElement | null>, visible: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!visible || !containerRef.current || typeof document === "undefined") {
      setPos(null);
      return;
    }
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [visible, containerRef]);

  return pos;
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

  // 点击外部关闭搜索结果（排除 Portal 渲染的 overlay，否则无法选中下拉项）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-stock-search-overlay]")) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const overlayVisible =
    (showResults && results.length > 0) ||
    isSearching ||
    (!isSearching && searchTerm.length > 0 && results.length === 0 && (showResults || !!error));
  const overlayPos = useOverlayPosition(containerRef, overlayVisible);

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
          className="w-full rounded-xl border-0 bg-white/5 pl-10 pr-10 py-3.5 text-base text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
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

      {/* Portal 渲染到 body，避免 overlay 覆盖下方表单导致点击错位 */}
      {overlayPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div data-stock-search-overlay>
            {showResults && results.length > 0 && (
              <div
                className="fixed z-[9999] rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl max-h-64 overflow-y-auto"
                style={{
                  top: overlayPos.top,
                  left: overlayPos.left,
                  width: overlayPos.width
                }}
              >
                {results.map((stock) => (
                  <button
                    key={stock.code}
                    type="button"
                    onClick={() => handleSelect(stock)}
                    className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
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
            {isSearching && (
              <div
                className="fixed z-[9999] rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-400 flex items-center gap-2"
                style={{
                  top: overlayPos.top,
                  left: overlayPos.left,
                  width: overlayPos.width
                }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                搜索中...
              </div>
            )}
            {!isSearching && searchTerm && results.length === 0 && (showResults || error) && (
              <div
                className={`fixed z-[9999] rounded-lg border px-4 py-3 text-sm ${
                  error
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-400"
                    : "border-slate-700 bg-slate-900 text-slate-400"
                }`}
                style={{
                  top: overlayPos.top,
                  left: overlayPos.left,
                  width: overlayPos.width
                }}
              >
                {error || "未找到匹配的股票"}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
