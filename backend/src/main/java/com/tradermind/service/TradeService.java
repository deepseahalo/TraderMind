package com.tradermind.service;

import com.tradermind.domain.TradeDirection;
import com.tradermind.domain.TradeStatus;
import com.tradermind.dto.CloseTradeRequest;
import com.tradermind.dto.CreateTradePlanRequest;
import com.tradermind.dto.TradeDashboardDTO;
import com.tradermind.dto.TradeExecutionResponse;
import com.tradermind.dto.TradePlanResponse;
import com.tradermind.entity.TradeExecution;
import com.tradermind.entity.TradePlan;
import com.tradermind.exception.DisciplineException;
import com.tradermind.repository.TradeExecutionRepository;
import com.tradermind.repository.TradePlanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 交易服务核心业务逻辑
 * - 仓位计算器
 * - 纪律守门员（盈亏比校验）
 * - 平仓逻辑
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TradeService {

    // 默认总资金 1,000,000，使用 BigDecimal 避免精度问题
    private static final BigDecimal TOTAL_CAPITAL = new BigDecimal("1000000");
    // 单笔风险 1%
    private static final BigDecimal RISK_PERCENT = new BigDecimal("0.01");
    // 最低可接受盈亏比 1.5
    private static final BigDecimal MIN_RR = new BigDecimal("1.5");

    private final TradePlanRepository tradePlanRepository;
    private final TradeExecutionRepository tradeExecutionRepository;
    private final AIReviewService aiReviewService;
    private final StockMarketService stockMarketService;

    /**
     * 仓位计算器：
     * positionSize = (TotalCapital * 0.01) / |entryPrice - stopLoss|
     * 基于 1% 风险模型，确保单笔交易最大亏损不超过总资金的 1%
     */
    public int calculatePositionSize(BigDecimal entryPrice, BigDecimal stopLoss) {
        BigDecimal diff = entryPrice.subtract(stopLoss).abs();
        if (diff.compareTo(BigDecimal.ZERO) == 0) {
            throw new IllegalArgumentException("入场价与止损价不能相同，否则风险无限大");
        }
        BigDecimal riskAmount = TOTAL_CAPITAL.multiply(RISK_PERCENT);
        // 使用 BigDecimal 向下取整，返回整数仓位
        BigDecimal positionSize = riskAmount.divide(diff, 0, RoundingMode.DOWN);
        return positionSize.intValueExact();
    }

    /**
     * 盈亏比计算：
     * RR = |TP - EP| / |EP - SL|
     * 盈亏比越高，风险收益比越好
     */
    private BigDecimal calculateRiskRewardRatio(BigDecimal entryPrice, BigDecimal stopLoss, BigDecimal takeProfit) {
        BigDecimal reward = takeProfit.subtract(entryPrice).abs();
        BigDecimal risk = entryPrice.subtract(stopLoss).abs();

        if (risk.compareTo(BigDecimal.ZERO) == 0) {
            throw new IllegalArgumentException("止损距离为 0，无法计算盈亏比");
        }

        // 保留 4 位小数
        return reward.divide(risk, 4, RoundingMode.HALF_UP);
    }

    /**
     * 创建交易计划：
     * - 计算盈亏比 RR
     * - 纪律守门员：RR < 1.5 直接拒绝
     * - A股市场限制：仅支持做多，不支持做空
     * - 使用 1% 风险模型计算仓位
     */
    @Transactional
    public TradePlanResponse createTradePlan(CreateTradePlanRequest request) {
        // A股市场限制：仅支持做多，不支持做空
        if (request.direction() == TradeDirection.SHORT) {
            throw new DisciplineException("A股市场不支持做空操作，仅支持做多（买入）");
        }

        BigDecimal rr = calculateRiskRewardRatio(
                request.entryPrice(),
                request.stopLoss(),
                request.takeProfit()
        );

        // 纪律守门员：盈亏比必须 >= 1.5
        if (rr.compareTo(MIN_RR) < 0) {
            throw new DisciplineException("盈亏比过低 (< 1.5)，不符合交易纪律，拒绝开仓");
        }

        // 如果用户提供了仓位，使用用户提供的；否则自动计算
        int positionSize = request.positionSize() != null && request.positionSize() > 0
                ? request.positionSize()
                : calculatePositionSize(request.entryPrice(), request.stopLoss());

        TradePlan plan = TradePlan.builder()
                .stockSymbol(request.stockSymbol())
                .direction(request.direction())
                .entryPrice(request.entryPrice())
                .stopLoss(request.stopLoss())
                .takeProfit(request.takeProfit())
                .positionSize(positionSize)
                .riskRewardRatio(rr)
                .entryLogic(request.entryLogic())
                .status(TradeStatus.OPEN)
                .build();

        TradePlan saved = tradePlanRepository.save(plan);
        return toPlanResponse(saved);
    }

    /**
     * 获取所有 OPEN 状态持仓（基础版本，不包含实时行情）
     */
    @Transactional(readOnly = true)
    public List<TradePlanResponse> getActivePlans() {
        return tradePlanRepository.findByStatus(TradeStatus.OPEN)
                .stream()
                .map(this::toPlanResponse)
                .toList();
    }

    /**
     * 获取所有 OPEN 状态持仓，包含实时行情数据
     * 结合新浪财经接口获取实时价格，计算当前盈亏
     * 
     * @return 包含实时数据的交易仪表盘DTO列表
     */
    @Transactional(readOnly = true)
    public List<TradeDashboardDTO> getActiveTradesWithMarketData() {
        List<TradePlan> activePlans = tradePlanRepository.findByStatus(TradeStatus.OPEN);
        
        return activePlans.stream()
                .map(this::toDashboardDTO)
                .collect(Collectors.toList());
    }

    /**
     * 将 TradePlan 转换为 TradeDashboardDTO，包含实时行情数据
     * 
     * @param plan 交易计划
     * @return 仪表盘DTO
     */
    private TradeDashboardDTO toDashboardDTO(TradePlan plan) {
        // 获取实时价格
        BigDecimal currentPrice = stockMarketService.getCurrentPrice(plan.getStockSymbol());
        
        // 如果获取实时价格失败（返回 -1），使用开仓价作为占位符
        // 这样前端仍然可以显示持仓信息，只是没有实时价格更新
        boolean priceValid = currentPrice.compareTo(BigDecimal.ZERO) > 0;
        if (!priceValid) {
            log.debug("无法获取股票 {} 的实时价格，使用开仓价作为占位符", plan.getStockSymbol());
            currentPrice = plan.getEntryPrice();
        }

        BigDecimal entryPrice = plan.getEntryPrice();
        BigDecimal stopLoss = plan.getStopLoss();
        Integer positionSize = plan.getPositionSize();

        // 计算当前盈亏金额
        // 做多：PnL = (currentPrice - entryPrice) * positionSize
        // 做空：PnL = (entryPrice - currentPrice) * positionSize
        BigDecimal priceDiff;
        if (plan.getDirection() == TradeDirection.LONG) {
            priceDiff = currentPrice.subtract(entryPrice);
        } else {
            priceDiff = entryPrice.subtract(currentPrice);
        }
        
        BigDecimal pnlAmount = priceDiff
                .multiply(BigDecimal.valueOf(positionSize))
                .setScale(2, RoundingMode.HALF_UP);

        // 计算盈亏百分比
        BigDecimal pnlPercentage = BigDecimal.ZERO;
        if (entryPrice.compareTo(BigDecimal.ZERO) > 0) {
            pnlPercentage = priceDiff
                    .divide(entryPrice, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        // 计算距离止损的价格差
        BigDecimal distanceToSL;
        if (plan.getDirection() == TradeDirection.LONG) {
            // 做多：当前价 - 止损价（负数表示已触发止损）
            distanceToSL = currentPrice.subtract(stopLoss);
        } else {
            // 做空：止损价 - 当前价（负数表示已触发止损）
            distanceToSL = stopLoss.subtract(currentPrice);
        }
        distanceToSL = distanceToSL.setScale(2, RoundingMode.HALF_UP);

        // 判断风险等级
        // 如果距离止损 < 2%（相对于开仓价），标记为 DANGER
        String riskLevel = "SAFE";
        if (entryPrice.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal riskThreshold = entryPrice.multiply(new BigDecimal("0.02")); // 2%
            if (distanceToSL.abs().compareTo(riskThreshold) < 0 && distanceToSL.compareTo(BigDecimal.ZERO) > 0) {
                riskLevel = "DANGER";
            } else if (distanceToSL.compareTo(BigDecimal.ZERO) <= 0) {
                // 已触发止损
                riskLevel = "DANGER";
            }
        }

        // 获取股票中文名称（用于前端展示）
        String stockName = "";
        StockMarketService.StockInfo stockInfo = stockMarketService.getStockInfo(plan.getStockSymbol());
        if (stockInfo != null) {
            stockName = stockInfo.getName();
        }

        return new TradeDashboardDTO(
                plan.getId(),
                plan.getStockSymbol(),
                stockName,
                entryPrice,
                stopLoss,
                plan.getTakeProfit(),
                currentPrice,
                pnlAmount,
                pnlPercentage,
                distanceToSL,
                riskLevel
        );
    }

    /**
     * 平仓逻辑：
     * LONG: PnL = (exit - entry) * position
     * SHORT: PnL = (entry - exit) * position
     * 更新计划状态为 CLOSED，并记录执行
     */
    @Transactional
    public TradeExecutionResponse closePlan(Long planId, CloseTradeRequest request) {
        TradePlan plan = tradePlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("未找到对应的交易计划: " + planId));

        if (plan.getStatus() != TradeStatus.OPEN) {
            throw new IllegalStateException("当前计划不是 OPEN 状态，无法平仓");
        }

        BigDecimal exitPrice = request.exitPrice();
        BigDecimal entryPrice = plan.getEntryPrice();
        BigDecimal priceDiff;

        if (plan.getDirection() == TradeDirection.LONG) {
            // 做多：价格上涨盈利
            priceDiff = exitPrice.subtract(entryPrice);
        } else {
            // 做空：价格下跌盈利
            priceDiff = entryPrice.subtract(exitPrice);
        }

        // 实现盈亏 = 价差 * 仓位
        BigDecimal realizedPnL = priceDiff
                .multiply(BigDecimal.valueOf(plan.getPositionSize()))
                .setScale(4, RoundingMode.HALF_UP);

        TradeExecution execution = TradeExecution.builder()
                .plan(plan)
                .exitPrice(exitPrice)
                .realizedPnL(realizedPnL)
                .exitLogic(request.exitLogic())
                .emotionalState(request.emotionalState())
                .build();

        TradeExecution savedExec = tradeExecutionRepository.save(execution);

        plan.setStatus(TradeStatus.CLOSED);
        tradePlanRepository.save(plan);

        // 异步触发 AI 交易教练分析，不阻塞用户请求
        aiReviewService.reviewTradeAsync(savedExec);

        return new TradeExecutionResponse(
                savedExec.getId(),
                plan.getId(),
                savedExec.getExitPrice(),
                savedExec.getRealizedPnL(),
                savedExec.getAiAnalysisScore(),
                savedExec.getAiAnalysisComment()
        );
    }

    /**
     * 根据股票代码删除交易计划
     */
    @Transactional
    public void deletePlanByStockSymbol(String stockSymbol) {
        List<TradePlan> plans = tradePlanRepository.findAll().stream()
                .filter(p -> p.getStockSymbol().equals(stockSymbol))
                .collect(Collectors.toList());
        
        if (plans.isEmpty()) {
            throw new IllegalArgumentException("未找到股票代码为 " + stockSymbol + " 的交易计划");
        }
        
        tradePlanRepository.deleteAll(plans);
        log.info("删除股票代码 {} 的交易计划，共 {} 条", stockSymbol, plans.size());
    }

    /**
     * 根据 ID 删除交易计划
     */
    @Transactional
    public void deletePlan(Long id) {
        TradePlan plan = tradePlanRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("未找到 ID 为 " + id + " 的交易计划"));
        tradePlanRepository.delete(plan);
        log.info("删除交易计划 ID: {}, 股票代码: {}", id, plan.getStockSymbol());
    }

    private TradePlanResponse toPlanResponse(TradePlan p) {
        return new TradePlanResponse(
                p.getId(),
                p.getStockSymbol(),
                p.getDirection(),
                p.getEntryPrice(),
                p.getStopLoss(),
                p.getTakeProfit(),
                p.getPositionSize(),
                p.getRiskRewardRatio(),
                p.getEntryLogic(),
                p.getStatus(),
                p.getCreatedAt()
        );
    }
}
