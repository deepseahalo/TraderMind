package com.tradermind.entity;

import com.tradermind.domain.TradeDirection;
import com.tradermind.domain.TradeStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 交易计划实体
 * 记录开仓前的所有计划信息
 */
@Entity
@Table(name = "trade_plan")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradePlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 股票代码 / 标的
    @Column(nullable = false, length = 50)
    private String stockSymbol;

    // 做多 / 做空
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TradeDirection direction;

    // 入场价格，使用 BigDecimal 避免精度丢失
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal entryPrice;

    // 止损价格
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal stopLoss;

    // 止盈价格
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal takeProfit;

    // 仓位大小（股数 / 合约数）
    @Column(nullable = false)
    private Integer positionSize;

    // 预期盈亏比 = |TP - EP| / |EP - SL|
    @Column(precision = 10, scale = 4)
    private BigDecimal riskRewardRatio;

    // 买入逻辑（文字描述）
    @Lob
    @Column(nullable = false)
    private String entryLogic;

    // 当前状态
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TradeStatus status;

    // 创建时间
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
