# TraderMind - 交易者之心

专业的投资日志应用，集成 AI 交易教练功能。

## 技术栈

### 后端
- Java 21
- Spring Boot 3.2
- Spring Data JPA
- PostgreSQL
- Lombok
- OpenAI/Dify API 集成

### 前端
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Lucide-React 图标库
- SWR 数据获取

## 项目结构

```
TraderMind/
├── backend/                 # Spring Boot 后端
│   ├── src/main/java/com/tradermind/
│   │   ├── TraderMindApplication.java
│   │   ├── controller/      # REST API 控制器
│   │   ├── service/         # 业务逻辑层
│   │   ├── repository/      # 数据访问层
│   │   ├── entity/          # JPA 实体
│   │   ├── dto/             # 数据传输对象
│   │   ├── domain/          # 领域模型（枚举）
│   │   └── exception/       # 异常处理
│   └── src/main/resources/
│       └── application.yml
│
└── frontend/                 # Next.js 前端
    ├── app/                 # App Router 页面
    ├── components/          # React 组件
    ├── lib/                 # 工具函数和 API 封装
    └── package.json
```

## 核心功能

### 1. 交易计划管理
- 创建交易计划（标的、方向、价格、逻辑）
- 自动计算仓位（基于 1% 风险模型）
- 纪律守门员：盈亏比必须 >= 1.5

### 2. 持仓管理
- 查看当前 OPEN 状态持仓
- 平仓操作（记录卖出价格和心态）

### 3. AI 交易教练
- 平仓后异步分析交易执行
- 评分（0-100）和犀利点评
- 分析是否遵守止损/止盈
- 识别情绪化操作

## 快速开始

### 后端启动

1. 确保 PostgreSQL 已安装并运行
2. 创建数据库：
   ```sql
   CREATE DATABASE tradermind;
   CREATE USER tradermind WITH PASSWORD 'tradermind';
   GRANT ALL PRIVILEGES ON DATABASE tradermind TO tradermind;
   ```

3. 配置 `backend/src/main/resources/application.yml`：
   - 修改数据库连接信息
   - 配置 AI API Key（OpenAI 或 Dify）

4. 启动后端：
   ```bash
   cd backend
   mvn spring-boot:run
   ```

后端将在 `http://localhost:8080` 启动

### 前端启动

1. 安装依赖：
   ```bash
   cd frontend
   npm install
   ```

2. 配置环境变量（可选）：
   创建 `.env.local`：
   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

前端将在 `http://localhost:3000` 启动

## API 接口

### POST /api/plans
创建交易计划

请求体：
```json
{
  "stockSymbol": "AAPL",
  "direction": "LONG",
  "entryPrice": 150.00,
  "stopLoss": 145.00,
  "takeProfit": 160.00,
  "entryLogic": "突破阻力位，技术面看涨"
}
```

### GET /api/plans/active
获取所有 OPEN 状态持仓

### POST /api/plans/{id}/close
平仓接口

请求体：
```json
{
  "exitPrice": 155.00,
  "exitLogic": "达到止盈目标，按计划平仓",
  "emotionalState": "冷静"
}
```

## 核心算法

### 仓位计算
```
positionSize = (TotalCapital * 0.01) / |entryPrice - stopLoss|
```
基于 1% 风险模型，确保单笔交易最大亏损不超过总资金的 1%

### 盈亏比计算
```
RR = |takeProfit - entryPrice| / |entryPrice - stopLoss|
```
纪律要求：RR >= 1.5

### 盈亏计算
- 做多：PnL = (exitPrice - entryPrice) * positionSize
- 做空：PnL = (entryPrice - exitPrice) * positionSize

## 注意事项

1. 所有金额计算使用 `BigDecimal` 避免精度丢失
2. 盈亏比校验在后端强制执行，前端仅作提示
3. AI 分析是异步执行的，不会阻塞平仓请求
4. 生产环境请配置正确的 CORS 策略

## License

MIT
