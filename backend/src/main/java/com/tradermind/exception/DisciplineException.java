package com.tradermind.exception;

/**
 * 交易纪律异常：盈亏比不达标时抛出
 */
public class DisciplineException extends RuntimeException {
    public DisciplineException(String message) {
        super(message);
    }
}
