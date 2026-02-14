package com.tradermind.repository;

import com.tradermind.entity.AppSettings;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 应用设置数据访问
 */
public interface AppSettingsRepository extends JpaRepository<AppSettings, Integer> {
}
