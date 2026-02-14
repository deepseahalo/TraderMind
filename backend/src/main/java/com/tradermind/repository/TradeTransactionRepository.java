package com.tradermind.repository;

import com.tradermind.entity.TradeTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 交易流水 Repository
 */
public interface TradeTransactionRepository extends JpaRepository<TradeTransaction, Long> {

    /**
     * 按计划 ID 查询流水，按时间正序
     */
    List<TradeTransaction> findByPlanIdOrderByTransactionTimeAsc(Long planId);
}
