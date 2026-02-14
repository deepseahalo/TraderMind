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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.util.regex.Pattern;

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
     * 注意：async 在独立线程运行，原事务已关闭。需在方法内重新加载实体，避免懒加载时 ResultSet 已关闭
     */
    @Async
    @Transactional
    public void reviewTradeAsync(TradeExecution execution) {
        Long executionId = execution.getId();
        try {
            // 在 async 线程内重新加载（JOIN FETCH plan），避免跨事务访问已关闭的懒加载
            TradeExecution fresh = tradeExecutionRepository.findByIdWithPlan(executionId)
                    .orElseThrow(() -> new IllegalArgumentException("未找到执行记录: " + executionId));
            TradePlan plan = fresh.getPlan();

            String systemPrompt = """
                    你是一个严厉的职业交易教练。对比用户的初始计划和最终执行。
                    分析：
                    1. 是否遵守了止损/止盈？
                    2. 是否有情绪化操作（恐惧/贪婪）？
                    3. 给出 0-100 的评分和简短的犀利点评。
                    只返回 JSON：
                    { "score": int, "comment": string }
                    """;

            String userContent = buildUserContent(plan, fresh);

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

            // AI 可能返回 markdown 代码块包裹的 JSON（```json ... ```），需剥离后再解析
            String cleanJson = stripMarkdownJsonBlock(contentJson);

            JsonNode aiResult = objectMapper.readTree(cleanJson);

            Integer score = aiResult.path("score").asInt();
            String comment = aiResult.path("comment").asText();

            fresh.setAiAnalysisScore(score);
            fresh.setAiAnalysisComment(comment);
            tradeExecutionRepository.save(fresh);

            log.info("AI 交易复盘完成，执行ID: {}, 评分: {}", executionId, score);

        } catch (Exception e) {
            log.error("AI 交易复盘调用失败，执行ID: {}", executionId, e);
        }
    }

    /**
     * 剥离 AI 返回的 markdown 代码块包裹（```json ... ``` 或 ``` ... ```）
     * 大模型常返回带格式的 JSON，直接解析会报 JsonParseException
     */
    private String stripMarkdownJsonBlock(String content) {
        if (content == null) return "";
        String s = content.strip();
        // 匹配 ```json ... ``` 或 ``` ... ```
        var pattern = Pattern.compile("^```(?:json)?\\s*\\n?(.*?)\\n?```\\s*$", Pattern.DOTALL);
        var matcher = pattern.matcher(s);
        if (matcher.matches()) {
            return matcher.group(1).strip();
        }
        return s;
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
