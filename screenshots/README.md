# TraderMind 功能截图（供小红书等使用）

本目录包含 TraderMind 应用的功能长截图，以**移动端视图**（390×844）截取，适合小红书、公众号等平台分享。

## 移动端截图（推荐）

| 文件名 | 内容说明 |
|--------|----------|
| mobile-1-home.png | 首页、当前持仓、持仓卡片、止损止盈进度条 |
| mobile-2-history.png | 历史交易列表、盈亏统计 |
| mobile-3-new-plan.png | 新建交易计划弹窗表单 |
| mobile-4-settings.png | 交易参数设置（总资金、风险百分比） |

## 如何自行补充移动端截图

1. 启动应用：`cd frontend && npm run dev`
2. 在手机上访问同一局域网下的地址（如 `http://电脑IP:3000`），或用 Chrome 开发者工具开启设备模拟（F12 → Toggle device toolbar → 选择 iPhone 14 等）
3. 访问：
   - 首页：http://localhost:3000
   - 历史交易：http://localhost:3000?tab=history
   - 新建计划弹窗：http://localhost:3000?openPlan=1
   - 设置页：http://localhost:3000/settings
4. 使用手机系统长截图功能，或 Chrome 设备模拟下的「Capture full size screenshot」截取完整页面。

## 小红书建议

- 可选取 2–4 张最具代表性的截图拼接成长图
- 配文案示例：「计划你的交易，交易你的计划。TraderMind - 专业交易日志与 AI 交易教练」
- 标签：#交易日志 #投资 #TraderMind #炒股 #AI
