-- 将 CANCELLED 加入 trade_plan.status 的检查约束
-- TradeStatus 枚举新增了 CANCELLED（计划取消/撤单），需同步数据库约束

ALTER TABLE trade_plan DROP CONSTRAINT IF EXISTS trade_plan_status_check;
ALTER TABLE trade_plan ADD CONSTRAINT trade_plan_status_check
  CHECK (status IN ('PENDING', 'OPEN', 'CLOSED', 'CANCELLED'));
