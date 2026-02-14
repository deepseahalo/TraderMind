-- 清理 TraderMind 数据库中的业务数据
-- 不触碰 flyway_schema_history（迁移历史必须保留）
-- 执行方式：psql -U tradermind -d tradermind -f backend/src/main/resources/db/cleanup_data.sql

-- 1. 删除平仓记录（子表，含外键引用 trade_plan）
DELETE FROM trade_execution;

-- 2. 删除交易计划
DELETE FROM trade_plan;

-- 3. 重置自增序列（可选，让新数据从 1 开始）
ALTER SEQUENCE trade_plan_id_seq RESTART WITH 1;
ALTER SEQUENCE trade_execution_id_seq RESTART WITH 1;
