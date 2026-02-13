package com.tradermind.dto;

import java.math.BigDecimal;

/**
 * 交易仪表盘 DTO
 * 包含实时行情数据和盈亏计算
 */
public record TradeDashboardDTO(
        Long planId,
        String stockSymbol,
        String stockName,          // 股票中文名称（如：工业富联）
        BigDecimal entryPrice,
        BigDecimal stopLoss,
        BigDecimal takeProfit,
        BigDecimal currentPrice,      // 实时当前价格
        BigDecimal pnlAmount,         // 当前盈亏金额（正数=盈利，负数=亏损）
        BigDecimal pnlPercentage,    // 盈亏百分比
        BigDecimal distanceToSL,      // 距离止损的价格差
        String riskLevel              // 风险等级: "SAFE" 或 "DANGER"
) {}
