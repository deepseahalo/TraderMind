package com.tradermind.controller;

import com.tradermind.dto.*;
import com.tradermind.service.StockMarketService;
import com.tradermind.service.TradeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 交易计划 REST API 控制器
 */
@RestController
@RequestMapping("/api/plans")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // 开发阶段允许跨域，生产环境建议配置具体域名
public class TradeController {

    private final TradeService tradeService;
    private final StockMarketService stockMarketService;

    /**
     * 创建交易计划
     * - 会自动计算仓位
     * - 会进行盈亏比纪律校验（RR >= 1.5）
     */
    @PostMapping
    public TradePlanResponse createPlan(@Valid @RequestBody CreateTradePlanRequest request) {
        return tradeService.createTradePlan(request);
    }

    /**
     * 获取所有 PENDING 状态的计划（待成交）
     */
    @GetMapping("/pending")
    public List<TradePlanResponse> getPendingPlans() {
        return tradeService.getPendingPlans();
    }

    /**
     * 获取所有 OPEN 状态的持仓（基础版本）
     */
    @GetMapping("/active")
    public List<TradePlanResponse> getActivePlans() {
        return tradeService.getActivePlans();
    }

    /**
     * 获取所有 OPEN 状态的持仓，包含实时行情数据
     * 返回包含当前价格、盈亏金额、盈亏百分比等实时数据
     */
    @GetMapping("/active/dashboard")
    public List<TradeDashboardDTO> getActiveTradesDashboard() {
        return tradeService.getActiveTradesWithMarketData();
    }

    /**
     * 获取历史交易记录（已平仓的交易）
     * 按平仓时间倒序排列
     */
    @GetMapping("/closed")
    public List<TradeHistoryDTO> getTradeHistory() {
        return tradeService.getTradeHistory();
    }

    /**
     * 为历史交易触发 AI 分析
     * 异步执行，立即返回。适用于平仓时 AI 分析失败或历史数据无分析记录的场景
     */
    @PostMapping("/closed/{executionId}/review")
    public Map<String, Object> triggerAiReviewForHistory(@PathVariable("executionId") Long executionId) {
        Map<String, Object> result = new HashMap<>();
        try {
            tradeService.triggerAiReviewForExecution(executionId);
            result.put("success", true);
            result.put("message", "AI 分析已触发，请稍后刷新查看结果");
        } catch (IllegalArgumentException e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * 首次建仓：将 PENDING 计划转为 OPEN 持仓
     */
    @PostMapping("/{id}/execute")
    public TradePlanResponse executePlan(
            @PathVariable("id") Long id,
            @Valid @RequestBody ExecutePlanRequest request
    ) {
        return tradeService.executePlan(id, request);
    }

    /**
     * 加仓：在 OPEN 持仓上增加数量，重新计算加权平均价
     */
    @PostMapping("/{id}/add")
    public TradePlanResponse addPosition(
            @PathVariable("id") Long id,
            @Valid @RequestBody AddPositionRequest request
    ) {
        return tradeService.addPosition(id, request);
    }

    /**
     * 减仓：部分卖出，落袋盈亏，可同步更新剩余仓位的止损/止盈
     */
    @PostMapping("/{id}/trim")
    public TradePlanResponse trimPosition(
            @PathVariable("id") Long id,
            @Valid @RequestBody TrimPositionRequest request
    ) {
        return tradeService.executePartialExit(id, request);
    }

    /**
     * 撤单：将 PENDING 计划改为 CANCELLED
     */
    @PostMapping("/{id}/cancel")
    public Map<String, Object> cancelPlan(@PathVariable("id") Long id) {
        Map<String, Object> result = new HashMap<>();
        try {
            tradeService.cancelPlan(id);
            result.put("success", true);
            result.put("message", "计划已取消");
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", e.getMessage());
        }
        return result;
    }

    /**
     * 获取计划的所有交易流水
     */
    @GetMapping("/{id}/transactions")
    public List<TradeTransactionDTO> getPlanTransactions(@PathVariable("id") Long id) {
        return tradeService.getTransactionsByPlanId(id);
    }

    /**
     * 平仓接口：根据 planId 和 exitPrice / exitLogic 平仓
     * 平仓后会异步触发 AI 交易教练分析
     */
    @PostMapping("/{id}/close")
    public TradeExecutionResponse closePlan(
            @PathVariable("id") Long id,
            @Valid @RequestBody CloseTradeRequest request
    ) {
        return tradeService.closePlan(id, request);
    }

    /**
     * 删除交易计划
     * 根据股票代码删除对应的交易计划
     */
    @DeleteMapping("/stock/{stockSymbol}")
    public Map<String, Object> deletePlanByStockSymbol(@PathVariable("stockSymbol") String stockSymbol) {
        Map<String, Object> result = new HashMap<>();
        try {
            tradeService.deletePlanByStockSymbol(stockSymbol);
            result.put("success", true);
            result.put("message", "删除成功");
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "删除失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 根据 ID 删除交易计划
     */
    @DeleteMapping("/{id}")
    public Map<String, Object> deletePlan(@PathVariable("id") Long id) {
        Map<String, Object> result = new HashMap<>();
        try {
            tradeService.deletePlan(id);
            result.put("success", true);
            result.put("message", "删除成功");
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "删除失败: " + e.getMessage());
        }
        return result;
    }

    /**
     * 获取股票实时价格
     * 用于在创建交易计划时自动填充当前价格
     */
    @GetMapping("/stock/{code}/price")
    public Map<String, Object> getStockPrice(@PathVariable("code") String stockCode) {
        Map<String, Object> result = new HashMap<>();
        BigDecimal price = stockMarketService.getCurrentPrice(stockCode);
        
        if (price.compareTo(BigDecimal.valueOf(-1)) == 0) {
            result.put("success", false);
            result.put("message", "无法获取股票价格，请检查股票代码是否正确");
        } else {
            result.put("success", true);
            result.put("price", price.doubleValue());
            result.put("stockCode", stockCode);
        }
        
        return result;
    }

    /**
     * 搜索股票
     * 支持通过股票代码或名称搜索
     * 
     * @param keyword 搜索关键词（股票代码或名称）
     * @return 股票搜索结果列表
     */
    @GetMapping("/stock/search")
    public List<StockSearchResult> searchStocks(@RequestParam("keyword") String keyword) {
        List<StockSearchResult> results = new ArrayList<>();
        
        if (keyword == null || keyword.trim().isEmpty()) {
            return results;
        }
        
        String trimmedKeyword = keyword.trim();
        
        // 如果输入的是6位数字股票代码，直接查询
        if (trimmedKeyword.matches("^\\d{6}$")) {
            StockMarketService.StockInfo info = stockMarketService.getStockInfo(trimmedKeyword);
            if (info != null) {
                results.add(new StockSearchResult(info.getCode(), info.getName(), info.getMarket()));
            }
            return results;
        }
        
        // 如果是部分代码（3-5位数字），尝试匹配可能的股票代码
        if (trimmedKeyword.matches("^\\d{3,5}$")) {
            // 生成可能的股票代码进行查询
            List<String> possibleCodes = generatePossibleCodes(trimmedKeyword);
            for (String code : possibleCodes) {
                StockMarketService.StockInfo info = stockMarketService.getStockInfo(code);
                if (info != null) {
                    results.add(new StockSearchResult(info.getCode(), info.getName(), info.getMarket()));
                    if (results.size() >= 10) break; // 最多返回10个结果
                }
            }
            return results;
        }
        
        // 名称搜索：使用东方财富 API，支持全 A 股
        List<StockMarketService.StockInfo> searchResults = stockMarketService.searchStocks(trimmedKeyword);
        for (StockMarketService.StockInfo info : searchResults) {
            results.add(new StockSearchResult(info.getCode(), info.getName(), info.getMarket()));
        }

        return results;
    }
    
    /**
     * 根据部分代码生成可能的完整股票代码
     */
    private List<String> generatePossibleCodes(String partialCode) {
        List<String> codes = new ArrayList<>();
        int length = partialCode.length();
        
        if (length == 3) {
            // 3位数字：可能是600xxx, 000xxx, 300xxx等
            codes.add("600" + partialCode);
            codes.add("601" + partialCode);
            codes.add("603" + partialCode);
            codes.add("000" + partialCode);
            codes.add("002" + partialCode);
            codes.add("300" + partialCode);
        } else if (length == 4) {
            // 4位数字：可能是60xxxx, 00xxxx, 30xxxx等
            codes.add("60" + partialCode);
            codes.add("00" + partialCode);
            codes.add("30" + partialCode);
        } else if (length == 5) {
            // 5位数字：可能是6xxxxx, 0xxxxx, 3xxxxx等
            codes.add("6" + partialCode);
            codes.add("0" + partialCode);
            codes.add("3" + partialCode);
        }
        
        return codes;
    }
}
