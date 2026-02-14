package com.tradermind.service;

import com.tradermind.dto.AppSettingsDTO;
import com.tradermind.entity.AppSettings;
import com.tradermind.repository.AppSettingsRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * 应用设置服务
 * 管理总资金、单笔风险百分比等可配置参数
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AppSettingsService {

    private static final int SETTINGS_ID = 1;
    private static final BigDecimal DEFAULT_TOTAL_CAPITAL = new BigDecimal("1000000");
    private static final BigDecimal DEFAULT_RISK_PERCENT = new BigDecimal("0.01");

    private final AppSettingsRepository appSettingsRepository;

    /**
     * 应用启动时确保存在默认设置
     */
    @PostConstruct
    @Transactional
    public void ensureDefaults() {
        if (appSettingsRepository.findById(SETTINGS_ID).isEmpty()) {
            AppSettings defaults = AppSettings.builder()
                    .id(SETTINGS_ID)
                    .totalCapital(DEFAULT_TOTAL_CAPITAL)
                    .riskPercent(DEFAULT_RISK_PERCENT)
                    .build();
            appSettingsRepository.save(defaults);
            log.info("初始化默认应用设置: 总资金={}, 单笔风险={}%", DEFAULT_TOTAL_CAPITAL, DEFAULT_RISK_PERCENT.multiply(new BigDecimal("100")));
        }
    }

    /**
     * 获取当前应用设置
     */
    @Transactional(readOnly = true)
    public AppSettingsDTO getSettings() {
        AppSettings settings = appSettingsRepository.findById(SETTINGS_ID)
                .orElseGet(this::createDefaults);
        return new AppSettingsDTO(settings.getTotalCapital(), settings.getRiskPercent());
    }

    /**
     * 更新应用设置
     */
    @Transactional
    public AppSettingsDTO updateSettings(AppSettingsDTO dto) {
        AppSettings settings = appSettingsRepository.findById(SETTINGS_ID)
                .orElseGet(this::createDefaults);
        settings.setTotalCapital(dto.totalCapital());
        settings.setRiskPercent(dto.riskPercent());
        appSettingsRepository.save(settings);
        log.info("更新应用设置: 总资金={}, 单笔风险={}%", dto.totalCapital(), dto.riskPercent().multiply(new BigDecimal("100")));
        return new AppSettingsDTO(settings.getTotalCapital(), settings.getRiskPercent());
    }

    /**
     * 获取总资金（供 TradeService 仓位计算使用）
     */
    @Transactional(readOnly = true)
    public BigDecimal getTotalCapital() {
        return appSettingsRepository.findById(SETTINGS_ID)
                .map(AppSettings::getTotalCapital)
                .orElse(DEFAULT_TOTAL_CAPITAL);
    }

    /**
     * 获取单笔风险百分比（供 TradeService 仓位计算使用）
     */
    @Transactional(readOnly = true)
    public BigDecimal getRiskPercent() {
        return appSettingsRepository.findById(SETTINGS_ID)
                .map(AppSettings::getRiskPercent)
                .orElse(DEFAULT_RISK_PERCENT);
    }

    private AppSettings createDefaults() {
        AppSettings s = AppSettings.builder()
                .id(SETTINGS_ID)
                .totalCapital(DEFAULT_TOTAL_CAPITAL)
                .riskPercent(DEFAULT_RISK_PERCENT)
                .build();
        return appSettingsRepository.save(s);
    }
}
