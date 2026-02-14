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

    // 入场价格（初始计划价格），使用 BigDecimal 避免精度丢失，供复盘对比
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal entryPrice;

    /** 加权平均成本价：加仓后重新计算，建仓时等于首次成交价 */
    @Column(name = "avg_entry_price", precision = 19, scale = 4)
    private BigDecimal avgEntryPrice;

    /** 历史总买入量：建仓+加仓累计，减仓不清零 */
    @Column(name = "total_quantity")
    private Integer totalQuantity;

    /** 当前剩余持仓数量：减仓后递减，全部平仓时为 0 */
    @Column(name = "current_quantity")
    private Integer currentQuantity;

    /** 累计已实现盈亏（减仓落袋），清仓时由 closePlan 计算 */
    @Column(name = "realized_pnl", precision = 19, scale = 4)
    private BigDecimal realizedPnL;

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

    // 买入逻辑（文字描述）- 使用 TEXT 避免 PostgreSQL Large Object 的自动提交限制
    @Column(nullable = false, columnDefinition = "TEXT")
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
