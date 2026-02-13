package com.tradermind.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tradermind.entity.TradeExecution;
import com.tradermind.entity.TradePlan;
import com.tradermind.repository.TradeExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;

/**
 * AI 交易教练服务：
 * - 使用 WebClient 调用大模型 API（OpenAI/Dify 兼容）
 * - 要求返回 JSON: { "score": int, "comment": string }
 * - 异步执行，不阻塞用户请求
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIReviewService {

    private final TradeExecutionRepository tradeExecutionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final WebClient webClient = WebClient.builder().build();

    @Value("${ai.api.url:https://api.openai.com/v1/chat/completions}")
    private String aiApiUrl;

    @Value("${ai.api.key:dummy-key}")
    private String aiApiKey;

    @Value("${ai.model:gpt-4.1-mini}")
    private String model;

    /**
     * 平仓后异步复盘，不阻塞用户请求
     * 分析交易是否遵守纪律，是否有情绪化操作
     */
    @Async
    public void reviewTradeAsync(TradeExecution execution) {
        try {
            TradePlan plan = execution.getPlan();

            String systemPrompt = """
                    你是一个严厉的职业交易教练。对比用户的初始计划和最终执行。
                    分析：
                    1. 是否遵守了止损/止盈？
                    2. 是否有情绪化操作（恐惧/贪婪）？
                    3. 给出 0-100 的评分和简短的犀利点评。
                    只返回 JSON：
                    { "score": int, "comment": string }
                    """;

            String userContent = buildUserContent(plan, execution);

            // 构建 OpenAI 风格的请求体
            JsonNode requestBody = objectMapper.createObjectNode()
                    .put("model", model)
                    .set("messages", objectMapper.createArrayNode()
                            .add(objectMapper.createObjectNode()
                                    .put("role", "system")
                                    .put("content", systemPrompt))
                            .add(objectMapper.createObjectNode()
                                    .put("role", "user")
                                    .put("content", userContent))
                    );

            // 异步线程中阻塞获取结果即可
            String responseText = webClient.post()
                    .uri(aiApiUrl)
                    .header("Authorization", "Bearer " + aiApiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody.toString())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = objectMapper.readTree(responseText);
            // 这里以 OpenAI 风格结构为例：choices[0].message.content
            String contentJson = root
                    .path("choices").get(0)
                    .path("message")
                    .path("content")
                    .asText();

            JsonNode aiResult = objectMapper.readTree(contentJson);

            Integer score = aiResult.path("score").asInt();
            String comment = aiResult.path("comment").asText();

            execution.setAiAnalysisScore(score);
            execution.setAiAnalysisComment(comment);
            tradeExecutionRepository.save(execution);

            log.info("AI 交易复盘完成，执行ID: {}, 评分: {}", execution.getId(), score);

        } catch (Exception e) {
            log.error("AI 交易复盘调用失败，执行ID: {}", execution.getId(), e);
        }
    }

    /**
     * 构造给 AI 的用户内容，包含核心价格与逻辑信息
     */
    private String buildUserContent(TradePlan plan, TradeExecution exec) {
        BigDecimal entryPrice = plan.getEntryPrice();
        BigDecimal stopLoss = plan.getStopLoss();
        BigDecimal takeProfit = plan.getTakeProfit();
        BigDecimal exitPrice = exec.getExitPrice();

        return """
                初始计划：
                - 标的：%s
                - 方向：%s
                - 买入价：%s
                - 止损价：%s
                - 止盈价：%s
                - 买入逻辑：%s

                实际执行：
                - 平仓价：%s
                - 卖出逻辑/心态记录：%s
                - 情绪标签：%s
                """.formatted(
                plan.getStockSymbol(),
                plan.getDirection(),
                entryPrice,
                stopLoss,
                takeProfit,
                plan.getEntryLogic(),
                exitPrice,
                exec.getExitLogic(),
                exec.getEmotionalState() != null ? exec.getEmotionalState() : "未填写"
        );
    }
}
