-- 将 @Lob 生成的 OID (Large Object) 列转换为 TEXT 类型
-- 解决：大型对象无法被使用在自动确认事物交易模式
-- 使用安全函数处理无效/已删除的 OID，避免 lo_get 抛出异常

CREATE OR REPLACE FUNCTION pg_temp.safe_oid_to_text(oid_val oid) RETURNS TEXT AS $$
BEGIN
  IF oid_val IS NULL OR oid_val = 0 THEN
    RETURN NULL;
  END IF;
  RETURN convert_from(lo_get(oid_val), 'UTF8');
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$ LANGUAGE plpgsql;

-- 1. trade_plan.entry_logic
ALTER TABLE trade_plan ADD COLUMN entry_logic_new TEXT;
UPDATE trade_plan SET entry_logic_new = COALESCE(pg_temp.safe_oid_to_text(entry_logic), '');
ALTER TABLE trade_plan DROP COLUMN entry_logic;
ALTER TABLE trade_plan RENAME COLUMN entry_logic_new TO entry_logic;
ALTER TABLE trade_plan ALTER COLUMN entry_logic SET NOT NULL;

-- 2. trade_execution.exit_logic
ALTER TABLE trade_execution ADD COLUMN exit_logic_new TEXT;
UPDATE trade_execution SET exit_logic_new = COALESCE(pg_temp.safe_oid_to_text(exit_logic), '');
ALTER TABLE trade_execution DROP COLUMN exit_logic;
ALTER TABLE trade_execution RENAME COLUMN exit_logic_new TO exit_logic;
ALTER TABLE trade_execution ALTER COLUMN exit_logic SET NOT NULL;

-- 3. trade_execution.ai_analysis_comment (nullable)
ALTER TABLE trade_execution ADD COLUMN ai_analysis_comment_new TEXT;
UPDATE trade_execution SET ai_analysis_comment_new = pg_temp.safe_oid_to_text(ai_analysis_comment) WHERE ai_analysis_comment IS NOT NULL;
ALTER TABLE trade_execution DROP COLUMN ai_analysis_comment;
ALTER TABLE trade_execution RENAME COLUMN ai_analysis_comment_new TO ai_analysis_comment;
