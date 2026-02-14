package com.tradermind.domain;

/**
 * 交易流水类型
 */
public enum TransactionType {
    INITIAL_ENTRY,  // 首次建仓
    ADD_POSITION,    // 加仓
    PARTIAL_EXIT,    // 减仓
    FULL_EXIT        // 清仓
}
