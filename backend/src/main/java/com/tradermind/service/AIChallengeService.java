package com.tradermind.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * AI 交易前置质询服务
 * 调用 DeepSeek 作为「对手盘」，无情指出买入逻辑中的风险点
 * 返回格式：JSON list of strings
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIChallengeService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final WebClient webClient = WebClient.builder().build();

    @Value("${ai.api.url:https://api.deepseek.com/v1/chat/completions}")
    private String aiApiUrl;

    @Value("${ai.api.key:dummy-key}")
    private String aiApiKey;

    @Value("${ai.model:deepseek-chat}")
    private String model;

    /**
     * 获取 DeepSeek 对买入逻辑的 3 条风险质询
     *
     * @param stockSymbol 股票代码
     * @param currentPrice 当前价格（可选，用于上下文）
     * @param logic 买入逻辑
     * @return 风险点列表，通常为 3 条
     */
    public List<String> challenge(String stockSymbol, String currentPrice, String logic) {
        String userPrompt = buildPrompt(stockSymbol, currentPrice, logic);

        JsonNode requestBody = objectMapper.createObjectNode()
                .put("model", model)
                .set("messages", objectMapper.createArrayNode()
                        .add(objectMapper.createObjectNode()
                                .put("role", "user")
                                .put("content", userPrompt))
                );

        String responseText = webClient.post()
                .uri(aiApiUrl)
                .header("Authorization", "Bearer " + aiApiKey)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody.toString())
                .retrieve()
                .bodyToMono(String.class)
                .block();

        return parseRisks(responseText);
    }

    /**
     * 构建 DeepSeek 质询 Prompt
     */
    private String buildPrompt(String stockSymbol, String currentPrice, String logic) {
        String priceInfo = (currentPrice != null && !currentPrice.isBlank())
                ? "，当前价格约 " + currentPrice + " 元"
                : "";
        return """
            用户计划买入 [%s]%s，逻辑是: '%s'。
            请作为该用户的'对手盘' (Short Seller)，不仅不要附和，还要**无情地**指出该逻辑中可能忽略的 3 个风险点。
            必须简短、犀利。
            返回格式: 只返回一个 JSON 数组，例如 ["风险点1", "风险点2", "风险点3"]，不要有其他文字。
            """.formatted(stockSymbol, priceInfo, logic);
    }

    /**
     * 解析 AI 返回的 JSON list
     * 兼容 markdown 代码块包裹的 JSON
     */
    private List<String> parseRisks(String responseText) {
        try {
            JsonNode root = objectMapper.readTree(responseText);
            String contentJson = root
                    .path("choices").get(0)
                    .path("message")
                    .path("content")
                    .asText();

            String cleanJson = stripMarkdownJsonBlock(contentJson);
            List<String> risks = objectMapper.readValue(cleanJson, new TypeReference<List<String>>() {});
            return risks != null && !risks.isEmpty() ? risks : fallbackRisks();
        } catch (Exception e) {
            log.warn("解析 AI 质询响应失败，返回默认风险提示", e);
            return fallbackRisks();
        }
    }

    /**
     * 剥离 markdown 代码块包裹（```json ... ``` 或 ``` ... ```）
     */
    private String stripMarkdownJsonBlock(String content) {
        if (content == null) return "[]";
        String s = content.strip();
        var pattern = Pattern.compile("^```(?:json)?\\s*\\n?(.*?)\\n?```\\s*$", Pattern.DOTALL);
        var matcher = pattern.matcher(s);
        if (matcher.matches()) {
            return matcher.group(1).strip();
        }
        return s;
    }

    /**
     * AI 调用失败或解析失败时的默认风险提示
     */
    private List<String> fallbackRisks() {
        return List.of(
                "请再次审视你的买入逻辑是否充分考虑了风险",
                "市场情绪变化可能导致逻辑失效",
                "建议设置好止损并严格执行"
        );
    }
}
