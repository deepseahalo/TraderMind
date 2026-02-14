-- 为 trade_execution 表添加 created_at 列（幂等，可重复执行）
ALTER TABLE trade_execution ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
