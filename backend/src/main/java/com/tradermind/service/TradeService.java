package com.tradermind.service;

import com.tradermind.domain.TradeDirection;
import com.tradermind.domain.TradeStatus;
import com.tradermind.domain.TransactionType;
import com.tradermind.dto.*;
import com.tradermind.entity.TradeExecution;
import com.tradermind.entity.TradePlan;
import com.tradermind.entity.TradeTransaction;
import com.tradermind.exception.DisciplineException;
import com.tradermind.repository.TradeExecutionRepository;
import com.tradermind.repository.TradePlanRepository;
import com.tradermind.repository.TradeTransactionRepository;
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

    // 最低可接受盈亏比 1.5
    private static final BigDecimal MIN_RR = new BigDecimal("1.5");
    /** A股一手 = 100股，买入股数必须为正100股的整数倍 */
    private static final int MIN_LOT = 100;

    private final TradePlanRepository tradePlanRepository;
    private final AppSettingsService appSettingsService;
    private final TradeExecutionRepository tradeExecutionRepository;
    private final TradeTransactionRepository tradeTransactionRepository;
    private final AIReviewService aiReviewService;
    private final StockMarketService stockMarketService;

    /**
     * 仓位计算器：
     * positionSize = (TotalCapital * 0.01) / |entryPrice - stopLoss|
     * 基于 1% 风险模型，确保单笔交易最大亏损不超过总资金的 1%
     * A股规则：买入股数必须为正100股（一手）的整数倍，不足100股时按100股计
     */
    public int calculatePositionSize(BigDecimal entryPrice, BigDecimal stopLoss) {
        BigDecimal diff = entryPrice.subtract(stopLoss).abs();
        if (diff.compareTo(BigDecimal.ZERO) == 0) {
            throw new IllegalArgumentException("入场价与止损价不能相同，否则风险无限大");
        }
        BigDecimal totalCapital = appSettingsService.getTotalCapital();
        BigDecimal riskPercent = appSettingsService.getRiskPercent();
        BigDecimal riskAmount = totalCapital.multiply(riskPercent);
        // 使用 BigDecimal 向下取整，得到原始仓位
        BigDecimal raw = riskAmount.divide(diff, 0, RoundingMode.DOWN);
        int rawInt = raw.intValueExact();
        // A股：向下取整到 100 的整数倍，最小 100 股（一手）
        int lots = Math.max(1, rawInt / MIN_LOT);
        return lots * MIN_LOT;
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

        // A股纪律：买入股数必须 >= 100 且为 100 的整数倍（一手、两手...）
        if (positionSize < MIN_LOT || positionSize % MIN_LOT != 0) {
            throw new DisciplineException("买入股数必须为正100股（一手）的整数倍，当前为 " + positionSize + " 股");
        }

        TradePlan plan = TradePlan.builder()
                .stockSymbol(request.stockSymbol())
                .direction(request.direction())
                .entryPrice(request.entryPrice())
                .stopLoss(request.stopLoss())
                .takeProfit(request.takeProfit())
                .positionSize(positionSize)
                .riskRewardRatio(rr)
                .entryLogic(request.entryLogic())
                .status(TradeStatus.PENDING)  // 计划阶段，待成交
                .build();

        TradePlan saved = tradePlanRepository.save(plan);
        return toPlanResponse(saved);
    }

    /**
     * 获取所有 PENDING 状态计划（待成交）
     */
    @Transactional(readOnly = true)
    public List<TradePlanResponse> getPendingPlans() {
        return tradePlanRepository.findByStatus(TradeStatus.PENDING)
                .stream()
                .map(this::toPlanResponse)
                .toList();
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
     * 首次建仓：将 PENDING 计划转为 OPEN 持仓
     * - 设置 avgEntryPrice、totalQuantity
     * - 记录 INITIAL_ENTRY 流水
     */
    @Transactional
    public TradePlanResponse executePlan(Long planId, ExecutePlanRequest request) {
        TradePlan plan = tradePlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("未找到交易计划: " + planId));

        if (plan.getStatus() != TradeStatus.PENDING) {
            throw new IllegalStateException("仅 PENDING 状态的计划可执行建仓");
        }

        if (request.quantity() < MIN_LOT || request.quantity() % MIN_LOT != 0) {
            throw new DisciplineException("买入股数必须为正100股（一手）的整数倍");
        }

        plan.setAvgEntryPrice(request.actualPrice());
        plan.setTotalQuantity(request.quantity());
        plan.setCurrentQuantity(request.quantity());
        plan.setRealizedPnL(BigDecimal.ZERO);
        plan.setStatus(TradeStatus.OPEN);
        tradePlanRepository.save(plan);

        TradeTransaction txn = TradeTransaction.builder()
                .plan(plan)
                .type(TransactionType.INITIAL_ENTRY)
                .price(request.actualPrice())
                .quantity(request.quantity())
                .logicSnapshot("首次建仓")
                .build();
        tradeTransactionRepository.save(txn);

        log.info("建仓成功: planId={}, stock={}, price={}, qty={}", planId, plan.getStockSymbol(), request.actualPrice(), request.quantity());
        return toPlanResponse(plan);
    }

    /**
     * 加仓：在 OPEN 持仓上增加数量，重新计算加权平均价
     * NewAvgPrice = ((OldAvgPrice * OldQty) + (AddPrice * AddQty)) / (OldQty + AddQty)
     */
    @Transactional
    public TradePlanResponse addPosition(Long planId, AddPositionRequest request) {
        TradePlan plan = tradePlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("未找到交易计划: " + planId));

        if (plan.getStatus() != TradeStatus.OPEN) {
            throw new IllegalStateException("仅 OPEN 状态的持仓可加仓");
        }

        if (request.addQuantity() < MIN_LOT || request.addQuantity() % MIN_LOT != 0) {
            throw new DisciplineException("加仓股数必须为正100股（一手）的整数倍");
        }

        BigDecimal oldAvg = plan.getAvgEntryPrice();
        int oldQty = plan.getTotalQuantity();
        BigDecimal addPrice = request.addPrice();
        int addQty = request.addQuantity();

        // 加权平均：((OldAvg * OldQty) + (AddPrice * AddQty)) / (OldQty + AddQty)
        BigDecimal totalCost = oldAvg.multiply(BigDecimal.valueOf(oldQty))
                .add(addPrice.multiply(BigDecimal.valueOf(addQty)));
        int newQty = oldQty + addQty;
        BigDecimal newAvg = totalCost.divide(BigDecimal.valueOf(newQty), 4, RoundingMode.HALF_UP);

        plan.setAvgEntryPrice(newAvg);
        plan.setTotalQuantity(newQty);
        plan.setCurrentQuantity(newQty);
        if (plan.getRealizedPnL() == null) {
            plan.setRealizedPnL(BigDecimal.ZERO);
        }
        tradePlanRepository.save(plan);

        TradeTransaction txn = TradeTransaction.builder()
                .plan(plan)
                .type(TransactionType.ADD_POSITION)
                .price(addPrice)
                .quantity(addQty)
                .logicSnapshot(request.addLogic() != null && !request.addLogic().isBlank() ? request.addLogic() : "加仓")
                .build();
        tradeTransactionRepository.save(txn);

        log.info("加仓成功: planId={}, stock={}, newAvg={}, newQty={}", planId, plan.getStockSymbol(), newAvg, newQty);
        return toPlanResponse(plan);
    }

    /**
     * 减仓：在 OPEN 持仓上部分卖出，落袋盈亏，可同步更新剩余仓位的 SL/TP
     * - 校验 exitQuantity <= currentQuantity
     * - ChunkPnL = (exitPrice - avgEntryPrice) * exitQuantity（做多）
     * - realizedPnL += ChunkPnL
     * - currentQuantity -= exitQuantity
     * - avgEntryPrice 保持不变（符合会计准则）
     * - 若 currentQuantity == 0，状态变为 CLOSED，并创建 TradeExecution 触发 AI 分析
     */
    @Transactional
    public TradePlanResponse executePartialExit(Long planId, TrimPositionRequest request) {
        TradePlan plan = tradePlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("未找到交易计划: " + planId));

        if (plan.getStatus() != TradeStatus.OPEN) {
            throw new IllegalStateException("仅 OPEN 状态的持仓可减仓");
        }

        int currentQty = plan.getCurrentQuantity() != null ? plan.getCurrentQuantity() : plan.getTotalQuantity();
        if (currentQty <= 0) {
            throw new IllegalStateException("当前无剩余持仓，无法减仓");
        }

        if (request.exitQuantity() > currentQty) {
            throw new DisciplineException("减仓数量不能大于当前持仓数量（当前 " + currentQty + " 股）");
        }

        if (request.exitQuantity() < MIN_LOT || request.exitQuantity() % MIN_LOT != 0) {
            throw new DisciplineException("卖出股数必须为正100股（一手）的整数倍");
        }

        BigDecimal avgEntry = plan.getAvgEntryPrice();
        if (avgEntry == null) {
            throw new IllegalStateException("持仓均价缺失，无法计算盈亏");
        }

        // 计算本次减仓盈亏（做多：exitPrice - avgEntry）
        BigDecimal priceDiff = request.exitPrice().subtract(avgEntry);
        BigDecimal chunkPnL = priceDiff
                .multiply(BigDecimal.valueOf(request.exitQuantity()))
                .setScale(4, RoundingMode.HALF_UP);

        // 更新 realizedPnL
        BigDecimal prevRealized = plan.getRealizedPnL() != null ? plan.getRealizedPnL() : BigDecimal.ZERO;
        plan.setRealizedPnL(prevRealized.add(chunkPnL));

        // 更新 currentQuantity
        int newCurrentQty = currentQty - request.exitQuantity();
        plan.setCurrentQuantity(newCurrentQty);

        // 可选：更新止损/止盈
        if (request.newStopLoss() != null) {
            plan.setStopLoss(request.newStopLoss());
        }
        if (request.newTakeProfit() != null) {
            plan.setTakeProfit(request.newTakeProfit());
        }

        // 状态流转：若清仓则 CLOSED
        if (newCurrentQty == 0) {
            plan.setStatus(TradeStatus.CLOSED);
        }

        tradePlanRepository.save(plan);

        // 记录 PARTIAL_EXIT 流水
        TradeTransaction txn = TradeTransaction.builder()
                .plan(plan)
                .type(TransactionType.PARTIAL_EXIT)
                .price(request.exitPrice())
                .quantity(request.exitQuantity())
                .logicSnapshot(request.exitLogic())
                .build();
        tradeTransactionRepository.save(txn);

        // 若减仓后清仓，创建 TradeExecution 并触发 AI 分析
        if (newCurrentQty == 0) {
            TradeExecution execution = TradeExecution.builder()
                    .plan(plan)
                    .exitPrice(request.exitPrice())
                    .realizedPnL(plan.getRealizedPnL())
                    .exitLogic(request.exitLogic() + "（减仓清仓）")
                    .build();
            tradeExecutionRepository.save(execution);
            aiReviewService.reviewTradeAsync(execution);
        }

        log.info("减仓成功: planId={}, stock={}, exitQty={}, chunkPnL={}, 剩余={}",
                planId, plan.getStockSymbol(), request.exitQuantity(), chunkPnL, newCurrentQty);
        return toPlanResponse(plan);
    }

    /**
     * 取消计划：将 PENDING 改为 CANCELLED
     */
    @Transactional
    public void cancelPlan(Long planId) {
        TradePlan plan = tradePlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("未找到交易计划: " + planId));

        if (plan.getStatus() != TradeStatus.PENDING) {
            throw new IllegalStateException("仅 PENDING 状态的计划可撤单");
        }

        plan.setStatus(TradeStatus.CANCELLED);
        tradePlanRepository.save(plan);
        log.info("计划已取消: planId={}, stock={}", planId, plan.getStockSymbol());
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
        BigDecimal currentPrice = stockMarketService.getCurrentPrice(plan.getStockSymbol());
        boolean priceValid = currentPrice.compareTo(BigDecimal.ZERO) > 0;
        if (!priceValid) {
            log.debug("无法获取股票 {} 的实时价格，使用持仓均价作为占位符", plan.getStockSymbol());
            currentPrice = plan.getAvgEntryPrice() != null ? plan.getAvgEntryPrice() : plan.getEntryPrice();
        }

        BigDecimal entryPrice = plan.getEntryPrice();
        BigDecimal avgEntry = plan.getAvgEntryPrice() != null ? plan.getAvgEntryPrice() : plan.getEntryPrice();
        BigDecimal stopLoss = plan.getStopLoss();
        Integer totalQty = plan.getTotalQuantity() != null ? plan.getTotalQuantity() : plan.getPositionSize();
        Integer currentQty = plan.getCurrentQuantity() != null ? plan.getCurrentQuantity() : totalQty;
        BigDecimal realizedPnL = plan.getRealizedPnL() != null ? plan.getRealizedPnL() : BigDecimal.ZERO;

        // 持仓盈亏基于当前剩余仓位 currentQuantity
        BigDecimal priceDiff;
        if (plan.getDirection() == TradeDirection.LONG) {
            priceDiff = currentPrice.subtract(avgEntry);
        } else {
            priceDiff = avgEntry.subtract(currentPrice);
        }
        
        BigDecimal pnlAmount = priceDiff
                .multiply(BigDecimal.valueOf(currentQty))
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal pnlPercentage = BigDecimal.ZERO;
        if (avgEntry.compareTo(BigDecimal.ZERO) > 0) {
            pnlPercentage = priceDiff
                    .divide(avgEntry, 4, RoundingMode.HALF_UP)
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

        String riskLevel = "SAFE";
        if (avgEntry.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal riskThreshold = avgEntry.multiply(new BigDecimal("0.02")); // 2%
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
                avgEntry,
                stopLoss,
                plan.getTakeProfit(),
                plan.getPositionSize(),
                totalQty,
                currentQty,
                realizedPnL,
                currentPrice,
                pnlAmount,
                pnlPercentage,
                distanceToSL,
                riskLevel,
                plan.getEntryLogic() != null ? plan.getEntryLogic() : "",
                plan.getRiskRewardRatio()
        );
    }

    /**
     * 平仓逻辑：
     * PnL 基于 avgEntryPrice（持仓均价），非计划价
     * LONG: PnL = (exit - avgEntry) * totalQuantity
     * SHORT: PnL = (avgEntry - exit) * totalQuantity
     * 记录 FULL_EXIT 流水，更新计划状态为 CLOSED
     */
    @Transactional
    public TradeExecutionResponse closePlan(Long planId, CloseTradeRequest request) {
        TradePlan plan = tradePlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("未找到对应的交易计划: " + planId));

        if (plan.getStatus() != TradeStatus.OPEN) {
            throw new IllegalStateException("当前计划不是 OPEN 状态，无法平仓");
        }

        BigDecimal exitPrice = request.exitPrice();
        BigDecimal avgEntry = plan.getAvgEntryPrice();
        int currentQty = plan.getCurrentQuantity() != null ? plan.getCurrentQuantity() : plan.getTotalQuantity();
        if (avgEntry == null || currentQty <= 0) {
            throw new IllegalStateException("持仓数据异常，无法平仓");
        }

        BigDecimal priceDiff;
        if (plan.getDirection() == TradeDirection.LONG) {
            priceDiff = exitPrice.subtract(avgEntry);
        } else {
            priceDiff = avgEntry.subtract(exitPrice);
        }

        // 本次平仓盈亏 = 价差 * 当前剩余持仓
        BigDecimal closePnL = priceDiff
                .multiply(BigDecimal.valueOf(currentQty))
                .setScale(4, RoundingMode.HALF_UP);

        // 累计已实现盈亏（含减仓落袋 + 本次平仓）
        BigDecimal prevRealized = plan.getRealizedPnL() != null ? plan.getRealizedPnL() : BigDecimal.ZERO;
        BigDecimal totalRealizedPnL = prevRealized.add(closePnL);
        plan.setRealizedPnL(totalRealizedPnL);
        plan.setCurrentQuantity(0);

        // 记录清仓流水
        TradeTransaction txn = TradeTransaction.builder()
                .plan(plan)
                .type(TransactionType.FULL_EXIT)
                .price(exitPrice)
                .quantity(currentQty)
                .logicSnapshot(request.exitLogic())
                .build();
        tradeTransactionRepository.save(txn);

        TradeExecution execution = TradeExecution.builder()
                .plan(plan)
                .exitPrice(exitPrice)
                .realizedPnL(totalRealizedPnL)
                .exitLogic(request.exitLogic())
                .emotionalState(request.emotionalState())
                .build();

        TradeExecution savedExec = tradeExecutionRepository.save(execution);

        plan.setStatus(TradeStatus.CLOSED);
        tradePlanRepository.save(plan);

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
     * 为历史交易触发 AI 分析
     * 异步执行，不阻塞请求。适用于平仓时 AI 分析失败或历史数据迁移场景
     *
     * @param executionId 交易执行记录 ID
     */
    @Transactional(readOnly = true)
    public void triggerAiReviewForExecution(Long executionId) {
        TradeExecution execution = tradeExecutionRepository.findById(executionId)
                .orElseThrow(() -> new IllegalArgumentException("未找到执行记录: " + executionId));
        aiReviewService.reviewTradeAsync(execution);
        log.info("已触发历史交易 AI 分析，执行ID: {}", executionId);
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

    /**
     * 获取所有历史交易记录（已平仓的交易）
     * 按平仓时间倒序排列
     * 必须使用 @Transactional：访问 lazy 关联和 TEXT 字段时，PostgreSQL Large Object 需要事务上下文
     */
    @Transactional(readOnly = true)
    public List<TradeHistoryDTO> getTradeHistory() {
        List<TradeExecution> executions = tradeExecutionRepository.findAll();
        
        return executions.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())) // 按平仓时间倒序
                .map(this::toHistoryDTO)
                .collect(Collectors.toList());
    }

    /**
     * 将 TradeExecution 转换为 TradeHistoryDTO
     */
    private TradeHistoryDTO toHistoryDTO(TradeExecution execution) {
        TradePlan plan = execution.getPlan();
        BigDecimal avgEntry = plan.getAvgEntryPrice() != null ? plan.getAvgEntryPrice() : plan.getEntryPrice();
        int totalQty = plan.getTotalQuantity() != null ? plan.getTotalQuantity() : plan.getPositionSize();

        BigDecimal realizedPnLPercent = BigDecimal.ZERO;
        if (avgEntry.compareTo(BigDecimal.ZERO) > 0 && totalQty > 0 && execution.getRealizedPnL() != null) {
            BigDecimal totalCost = avgEntry.multiply(BigDecimal.valueOf(totalQty));
            if (totalCost.compareTo(BigDecimal.ZERO) > 0) {
                realizedPnLPercent = execution.getRealizedPnL()
                        .divide(totalCost, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"));
            }
        }

        String stockName = "";
        StockMarketService.StockInfo stockInfo = stockMarketService.getStockInfo(plan.getStockSymbol());
        if (stockInfo != null) {
            stockName = stockInfo.getName();
        }

        return new TradeHistoryDTO(
                execution.getId(),
                plan.getId(),
                plan.getStockSymbol(),
                stockName,
                plan.getDirection(),
                plan.getEntryPrice(),
                avgEntry,
                execution.getExitPrice(),
                plan.getStopLoss(),
                plan.getTakeProfit(),
                plan.getPositionSize(),
                totalQty,
                execution.getRealizedPnL(),
                realizedPnLPercent,
                plan.getEntryLogic(),
                execution.getExitLogic(),
                execution.getEmotionalState(),
                execution.getAiAnalysisScore(),
                execution.getAiAnalysisComment(),
                plan.getCreatedAt(),
                execution.getCreatedAt()
        );
    }

    private TradePlanResponse toPlanResponse(TradePlan p) {
        String stockName = "";
        StockMarketService.StockInfo stockInfo = stockMarketService.getStockInfo(p.getStockSymbol());
        if (stockInfo != null) {
            stockName = stockInfo.getName();
        }
        return new TradePlanResponse(
                p.getId(),
                p.getStockSymbol(),
                stockName,
                p.getDirection(),
                p.getEntryPrice(),
                p.getAvgEntryPrice(),
                p.getPositionSize(),
                p.getTotalQuantity(),
                p.getCurrentQuantity(),
                p.getRealizedPnL(),
                p.getStopLoss(),
                p.getTakeProfit(),
                p.getRiskRewardRatio(),
                p.getEntryLogic(),
                p.getStatus(),
                p.getCreatedAt()
        );
    }

    /**
     * 获取计划的所有交易流水
     */
    @Transactional(readOnly = true)
    public List<TradeTransactionDTO> getTransactionsByPlanId(Long planId) {
        return tradeTransactionRepository.findByPlanIdOrderByTransactionTimeAsc(planId)
                .stream()
                .map(t -> new TradeTransactionDTO(
                        t.getId(),
                        t.getType(),
                        t.getPrice(),
                        t.getQuantity(),
                        t.getTransactionTime(),
                        t.getLogicSnapshot()
                ))
                .toList();
    }
}
