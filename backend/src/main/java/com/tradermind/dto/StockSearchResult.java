package com.tradermind.dto;

/**
 * 股票搜索结果 DTO
 */
public record StockSearchResult(
        String code,        // 股票代码
        String name,        // 股票名称
        String market       // 市场（如：上海、深圳）
) {}
