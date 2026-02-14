package com.tradermind.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * 减仓请求 DTO
 * 支持减仓时同步更新剩余仓位的止损/止盈
 */
public record TrimPositionRequest(
        /** 卖出价格 */
        @NotNull
        @DecimalMin("0.0001")
        BigDecimal exitPrice,

        /** 卖出数量 */
        @NotNull
        @Positive
        Integer exitQuantity,

        /** 减仓理由（如：到达第一目标位） */
        @NotBlank
        String exitLogic,

        /** 减仓后新的止损价（可选，如：上移止损至成本价） */
        BigDecimal newStopLoss,

        /** 减仓后新的止盈价（可选） */
        BigDecimal newTakeProfit
) {}
