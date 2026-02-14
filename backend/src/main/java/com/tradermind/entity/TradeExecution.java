package com.tradermind.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 交易执行记录：平仓时生成
 * 记录实际执行结果和 AI 分析
 */
@Entity
@Table(name = "trade_execution")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradeExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 关联的交易计划
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private TradePlan plan;

    // 实际平仓价格
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal exitPrice;

    // 实现盈亏，使用 BigDecimal 精确表示
    @Column(precision = 19, scale = 4)
    private BigDecimal realizedPnL;

    // 卖出逻辑 / 心态记录 - 使用 TEXT 避免 PostgreSQL Large Object 的自动提交限制
    @Column(nullable = false, columnDefinition = "TEXT")
    private String exitLogic;

    // 简要情绪状态标签，例如 "恐惧"、"贪婪"
    @Column(length = 50)
    private String emotionalState;

    // AI 打分（0-100）
    private Integer aiAnalysisScore;

    // AI 对本次交易的简短点评 - 使用 TEXT 避免 PostgreSQL Large Object 的自动提交限制
    @Column(columnDefinition = "TEXT")
    private String aiAnalysisComment;

    // 创建时间（平仓时间）
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
