-- 为 trade_execution 表添加 created_at 列（幂等，可重复执行）
-- 仅在表存在且列不存在时执行，避免与 Hibernate 启动顺序冲突
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trade_execution')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trade_execution' AND column_name = 'created_at') THEN
    ALTER TABLE trade_execution ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
