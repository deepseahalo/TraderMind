-- 交易生命周期重构：计划/执行分离 + 加仓支持
-- 1. trade_plan 新增 avg_entry_price、total_quantity
-- 2. 创建 trade_transaction 交易流水表
-- 3. 现有 OPEN 计划迁移：avg_entry_price=entry_price, total_quantity=position_size

-- 1. trade_plan 新增字段
ALTER TABLE trade_plan ADD COLUMN IF NOT EXISTS avg_entry_price NUMERIC(19, 4);
ALTER TABLE trade_plan ADD COLUMN IF NOT EXISTS total_quantity INTEGER;

-- 2. 迁移现有 OPEN 计划：视为已建仓
UPDATE trade_plan
SET avg_entry_price = entry_price,
    total_quantity = position_size
WHERE status = 'OPEN' AND (avg_entry_price IS NULL OR total_quantity IS NULL);

-- 3. 创建交易流水表
CREATE TABLE IF NOT EXISTS trade_transaction (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES trade_plan(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    price NUMERIC(19, 4) NOT NULL,
    quantity INTEGER NOT NULL,
    transaction_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logic_snapshot TEXT,
    CONSTRAINT chk_txn_type CHECK (type IN ('INITIAL_ENTRY', 'ADD_POSITION', 'PARTIAL_EXIT', 'FULL_EXIT'))
);

CREATE INDEX IF NOT EXISTS idx_trade_transaction_plan_id ON trade_transaction(plan_id);
CREATE INDEX IF NOT EXISTS idx_trade_transaction_time ON trade_transaction(transaction_time);

-- 4. 为已迁移的 OPEN 计划补充 INITIAL_ENTRY 流水（历史数据兼容）
INSERT INTO trade_transaction (plan_id, type, price, quantity, logic_snapshot)
SELECT id, 'INITIAL_ENTRY', entry_price, position_size, '历史数据迁移'
FROM trade_plan
WHERE status = 'OPEN' AND avg_entry_price IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM trade_transaction t WHERE t.plan_id = trade_plan.id);
