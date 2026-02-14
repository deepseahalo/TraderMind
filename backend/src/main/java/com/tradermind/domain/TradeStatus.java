package com.tradermind.domain;

/**
 * 交易计划状态
 */
public enum TradeStatus {
    PENDING,   // 等待建仓，计划已制定但未成交
    OPEN,      // 持仓中，已建仓或已加仓
    CLOSED,    // 已平仓
    CANCELLED  // 计划取消（撤单）
}
