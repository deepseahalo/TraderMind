package com.tradermind.entity;

import com.tradermind.domain.TransactionType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 交易流水表
 * 记录每次买卖操作：首次建仓、加仓、减仓、清仓
 */
@Entity
@Table(name = "trade_transaction")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradeTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private TradePlan plan;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionType type;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer quantity;

    @CreationTimestamp
    @Column(name = "transaction_time", nullable = false, updatable = false)
    private LocalDateTime transactionTime;

    /** 操作逻辑快照，如："突破加仓"、"止损离场" */
    @Column(name = "logic_snapshot", columnDefinition = "TEXT")
    private String logicSnapshot;
}
