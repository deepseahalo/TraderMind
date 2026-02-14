package com.tradermind.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * 应用设置实体
 * 单例模式：仅一条记录，存储总资金、单笔风险百分比等可配置参数
 */
@Entity
@Table(name = "app_settings")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppSettings {

    @Id
    @Column(name = "id")
    private Integer id = 1;

    /** 总资金（元），用于仓位计算 */
    @Column(nullable = false, precision = 20, scale = 2)
    private BigDecimal totalCapital;

    /** 单笔风险百分比（如 0.01 表示 1%） */
    @Column(nullable = false, precision = 6, scale = 4)
    private BigDecimal riskPercent;
}
