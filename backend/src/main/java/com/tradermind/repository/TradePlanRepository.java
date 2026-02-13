package com.tradermind.repository;

import com.tradermind.domain.TradeStatus;
import com.tradermind.entity.TradePlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 交易计划 Repository
 */
public interface TradePlanRepository extends JpaRepository<TradePlan, Long> {

    /**
     * 根据状态查询交易计划
     */
    List<TradePlan> findByStatus(TradeStatus status);
}
