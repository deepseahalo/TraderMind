package com.tradermind.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 平仓请求 DTO
 */
public record CloseTradeRequest(
        @NotNull BigDecimal exitPrice,
        @NotBlank String exitLogic,
        String emotionalState
) {}
