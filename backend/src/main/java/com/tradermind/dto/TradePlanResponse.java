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
        TradeDirection direction,
        BigDecimal entryPrice,
        BigDecimal stopLoss,
        BigDecimal takeProfit,
        Integer positionSize,
        BigDecimal riskRewardRatio,
        String entryLogic,
        TradeStatus status,
        LocalDateTime createdAt
) {}
