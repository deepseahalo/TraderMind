-- 修复 trade_execution 表：添加 created_at 列
-- 在 PostgreSQL 中执行：psql -U tradermind -d tradermind -f fix_trade_execution_table.sql

-- 幂等：列不存在时才添加
ALTER TABLE trade_execution ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

-- 为已存在的记录设置默认值
UPDATE trade_execution SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

-- 设置为 NOT NULL 和默认值
ALTER TABLE trade_execution ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE trade_execution ALTER COLUMN created_at SET NOT NULL;
