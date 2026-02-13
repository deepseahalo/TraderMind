package com.tradermind.domain;

/**
 * 交易计划状态
 */
public enum TradeStatus {
    PENDING, // 计划中，未实际开仓
    OPEN,    // 已开仓，持仓中
    CLOSED   // 已平仓
}
