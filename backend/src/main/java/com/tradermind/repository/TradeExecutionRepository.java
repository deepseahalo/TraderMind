package com.tradermind.repository;

import com.tradermind.entity.TradeExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * 交易执行记录 Repository
 */
public interface TradeExecutionRepository extends JpaRepository<TradeExecution, Long> {

    /**
     * 按 ID 查询执行记录，并立即加载关联的 plan（避免懒加载在异步线程中失效）
     */
    @Query("SELECT e FROM TradeExecution e JOIN FETCH e.plan WHERE e.id = :id")
    Optional<TradeExecution> findByIdWithPlan(@Param("id") Long id);
}
