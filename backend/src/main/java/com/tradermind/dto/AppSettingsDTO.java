package com.tradermind.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 应用设置 DTO
 */
public record AppSettingsDTO(
        @NotNull(message = "总资金不能为空")
        @DecimalMin(value = "1000", message = "总资金不能低于 1000 元")
        @DecimalMax(value = "999999999999.99", message = "总资金超出有效范围")
        BigDecimal totalCapital,

        @NotNull(message = "单笔风险百分比不能为空")
        @DecimalMin(value = "0.001", message = "单笔风险不能低于 0.1%")
        @DecimalMax(value = "0.1", message = "单笔风险不能高于 10%")
        BigDecimal riskPercent
) {
}
