package com.tradermind.dto;

import java.math.BigDecimal;

/**
 * 交易仪表盘 DTO
 * 包含实时行情数据和盈亏计算
 * 盈亏基于 avgEntryPrice（持仓均价），非计划价
 */
public record TradeDashboardDTO(
        Long planId,
        String stockSymbol,
        String stockName,          // 股票中文名称（如：工业富联）
        BigDecimal entryPrice,     // 计划价（复盘对比）
        BigDecimal avgEntryPrice,  // 持仓均价（盈亏计算基准）
        BigDecimal stopLoss,
        BigDecimal takeProfit,
        Integer positionSize,      // 计划仓位（建议）
        Integer totalQuantity,     // 历史总买入量
        Integer currentQuantity,   // 当前剩余持仓（减仓后递减）
        BigDecimal realizedPnL,    // 累计已落袋盈亏（减仓所得）
        BigDecimal currentPrice,      // 实时当前价格
        BigDecimal pnlAmount,         // 当前持仓盈亏金额（正数=盈利，负数=亏损）
        BigDecimal pnlPercentage,    // 盈亏百分比
        BigDecimal distanceToSL,      // 距离止损的价格差
        String riskLevel,             // 风险等级: "SAFE" 或 "DANGER"
        String entryLogic,            // 买入逻辑
        BigDecimal riskRewardRatio    // 盈亏比 RR
) {}
