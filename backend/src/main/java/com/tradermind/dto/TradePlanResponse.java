package com.tradermind.dto;

import com.tradermind.domain.TradeDirection;
import com.tradermind.domain.TradeStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 返回给前端的交易计划视图
 */
public record TradePlanResponse(
        Long id,
        String stockSymbol,
        String stockName,          // 股票中文名称
        TradeDirection direction,
        BigDecimal entryPrice,
        BigDecimal avgEntryPrice,   // 加权平均成本（建仓/加仓后），PENDING 时为 null
        Integer positionSize,      // 计划仓位（建议）
        Integer totalQuantity,     // 历史总买入量，PENDING 时为 null
        Integer currentQuantity,   // 当前剩余持仓，PENDING 时为 null
        BigDecimal realizedPnL,    // 累计已落袋盈亏
        BigDecimal stopLoss,
        BigDecimal takeProfit,
        BigDecimal riskRewardRatio,
        String entryLogic,
        TradeStatus status,
        LocalDateTime createdAt
) {}
