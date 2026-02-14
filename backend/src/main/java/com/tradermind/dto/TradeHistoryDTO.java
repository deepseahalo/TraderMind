package com.tradermind.dto;

import com.tradermind.domain.TradeDirection;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 历史交易记录 DTO
 * 包含交易计划和执行记录的完整信息
 */
public record TradeHistoryDTO(
        Long executionId,           // 执行记录 ID
        Long planId,                 // 交易计划 ID
        String stockSymbol,          // 股票代码
        String stockName,            // 股票中文名称
        TradeDirection direction,    // 方向
        BigDecimal entryPrice,       // 计划开仓价（复盘对比）
        BigDecimal avgEntryPrice,    // 实际持仓均价（PnL 计算基准）
        BigDecimal exitPrice,        // 平仓价
        BigDecimal stopLoss,         // 止损价
        BigDecimal takeProfit,       // 止盈价
        Integer positionSize,        // 计划仓位
        Integer totalQuantity,       // 平仓时实际仓位
        BigDecimal realizedPnL,      // 实现盈亏
        BigDecimal realizedPnLPercent, // 实现盈亏百分比
        String entryLogic,           // 买入逻辑
        String exitLogic,            // 卖出逻辑
        String emotionalState,       // 情绪状态
        Integer aiAnalysisScore,     // AI 分析得分
        String aiAnalysisComment,    // AI 分析评论
        LocalDateTime createdAt,     // 开仓时间
        LocalDateTime closedAt        // 平仓时间（执行时间）
) {}
