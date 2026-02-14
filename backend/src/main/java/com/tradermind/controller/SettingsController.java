package com.tradermind.controller;

import com.tradermind.dto.AppSettingsDTO;
import com.tradermind.service.AppSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 应用设置 REST API 控制器
 */
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SettingsController {

    private final AppSettingsService appSettingsService;

    /**
     * 获取当前设置
     */
    @GetMapping
    public AppSettingsDTO getSettings() {
        return appSettingsService.getSettings();
    }

    /**
     * 更新设置
     */
    @PutMapping
    public AppSettingsDTO updateSettings(@Valid @RequestBody AppSettingsDTO dto) {
        return appSettingsService.updateSettings(dto);
    }
}
