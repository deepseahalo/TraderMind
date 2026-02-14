package com.tradermind.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * 加仓请求
 */
public record AddPositionRequest(
        @NotNull
        @DecimalMin("0.0001")
        BigDecimal addPrice,

        @NotNull
        @Positive
        Integer addQuantity,

        String addLogic
) {}
