package com.tradermind.controller;

import com.tradermind.dto.AIChallengeRequest;
import com.tradermind.service.AIChallengeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * AI 相关 REST API 控制器
 * 提供交易前置质询等 AI 能力
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AIController {

    private final AIChallengeService aiChallengeService;

    /**
     * AI 交易前置质询
     * 作为对手盘，指出买入逻辑中可能忽略的风险点
     *
     * @param request 股票代码、当前价格、买入逻辑
     * @return 风险点列表（通常 3 条）
     */
    @PostMapping("/challenge")
    public List<String> challenge(@Valid @RequestBody AIChallengeRequest request) {
        String price = request.currentPrice() != null
                ? request.currentPrice().toPlainString()
                : null;
        return aiChallengeService.challenge(
                request.stockSymbol(),
                price,
                request.logic()
        );
    }
}
