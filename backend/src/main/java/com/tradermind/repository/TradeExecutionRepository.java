package com.tradermind.repository;

import com.tradermind.entity.TradeExecution;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 交易执行记录 Repository
 */
public interface TradeExecutionRepository extends JpaRepository<TradeExecution, Long> {
}
