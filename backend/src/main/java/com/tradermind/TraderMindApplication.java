package com.tradermind;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * TraderMind 主启动类
 * 启用异步支持，用于 AI 交易教练的异步分析
 */
@SpringBootApplication
@EnableAsync
public class TraderMindApplication {

    public static void main(String[] args) {
        SpringApplication.run(TraderMindApplication.class, args);
    }
}
