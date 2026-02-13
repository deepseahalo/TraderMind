package com.tradermind.dto;

import java.math.BigDecimal;

/**
 * 平仓后返回的执行结果
 */
public record TradeExecutionResponse(
        Long executionId,
        Long planId,
        BigDecimal exitPrice,
        BigDecimal realizedPnL,
        Integer aiAnalysisScore,
        String aiAnalysisComment
) {}
