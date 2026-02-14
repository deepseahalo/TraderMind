-- 创建应用设置表，用于存储总资金、单笔风险百分比等可配置参数
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY,
    total_capital NUMERIC(20, 2) NOT NULL DEFAULT 1000000,
    risk_percent NUMERIC(6, 4) NOT NULL DEFAULT 0.01
);

-- 插入默认记录（id=1）
INSERT INTO app_settings (id, total_capital, risk_percent)
VALUES (1, 1000000, 0.01)
ON CONFLICT (id) DO NOTHING;
