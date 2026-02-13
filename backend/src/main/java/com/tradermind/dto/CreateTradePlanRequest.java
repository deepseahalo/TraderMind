package com.tradermind.dto;

import com.tradermind.domain.TradeDirection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 创建交易计划请求 DTO
 */
public record CreateTradePlanRequest(
        @NotBlank String stockSymbol,
        @NotNull TradeDirection direction,
        @NotNull BigDecimal entryPrice,
        @NotNull BigDecimal stopLoss,
        @NotNull BigDecimal takeProfit,
        Integer positionSize, // 可选：买入股数，如果不提供则自动计算
        @NotBlank String entryLogic
) {}
