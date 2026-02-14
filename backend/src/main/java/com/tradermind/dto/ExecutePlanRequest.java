package com.tradermind.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * 首次建仓请求
 */
public record ExecutePlanRequest(
        @NotNull
        @DecimalMin("0.0001")
        BigDecimal actualPrice,

        @NotNull
        @Positive
        Integer quantity
) {}
