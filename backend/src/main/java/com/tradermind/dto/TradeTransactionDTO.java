package com.tradermind.dto;

import com.tradermind.domain.TransactionType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 交易流水 DTO
 */
public record TradeTransactionDTO(
        Long id,
        TransactionType type,
        BigDecimal price,
        Integer quantity,
        LocalDateTime transactionTime,
        String logicSnapshot
) {}
