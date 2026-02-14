package com.tradermind.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

/**
 * AI 交易前置质询请求 DTO
 * 输入：股票代码、当前价格、买入逻辑
 */
public record AIChallengeRequest(
        @NotBlank(message = "股票代码不能为空") String stockSymbol,
        BigDecimal currentPrice,  // 可选，用于上下文
        @NotBlank(message = "买入逻辑不能为空") String logic
) {}
