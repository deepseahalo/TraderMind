-- 减仓功能支持：trade_plan 新增 realized_pnl、current_quantity
-- realized_pnl: 累计已实现盈亏（减仓落袋）
-- current_quantity: 当前剩余持仓（区别于 total_quantity 历史总买入量）

ALTER TABLE trade_plan ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(19, 4) DEFAULT 0;
ALTER TABLE trade_plan ADD COLUMN IF NOT EXISTS current_quantity INTEGER;

-- 迁移现有数据：OPEN 计划 current_quantity = total_quantity
UPDATE trade_plan
SET current_quantity = total_quantity,
    realized_pnl = COALESCE(realized_pnl, 0)
WHERE status = 'OPEN' AND current_quantity IS NULL;

-- CLOSED 计划 current_quantity = 0
UPDATE trade_plan
SET current_quantity = 0,
    realized_pnl = COALESCE(realized_pnl, 0)
WHERE status = 'CLOSED' AND current_quantity IS NULL;
