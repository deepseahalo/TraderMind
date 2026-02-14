# MCP 配置检查和测试指南

## 当前配置状态

✅ **配置文件已创建**: `.cursor/mcp.json`

配置内容：
```json
{
  "mcpServers": {
    "postgresql": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://tradermind:tradermind@localhost:5432/tradermind"
      ]
    }
  }
}
```

## 检查步骤

### 1. 验证配置文件位置
- ✅ 配置文件位于: `.cursor/mcp.json`
- ✅ 格式正确（JSON 格式）

### 2. 重启 Cursor IDE
**重要**: MCP 配置更改后需要重启 Cursor IDE 才能生效。

1. 完全关闭 Cursor IDE
2. 重新打开 Cursor IDE
3. 等待几秒钟让 MCP 服务器启动

### 3. 验证 PostgreSQL 服务
确保 PostgreSQL 服务正在运行：
```bash
# Windows PowerShell
Get-Service -Name postgresql*

# 或者检查端口是否监听
netstat -an | findstr :5432
```

### 4. 测试数据库连接
可以使用以下命令测试数据库连接：
```bash
# 如果安装了 psql
psql -h localhost -U tradermind -d tradermind

# 或者使用 Node.js 测试
node -e "const {Client} = require('pg'); const client = new Client({host:'localhost',port:5432,database:'tradermind',user:'tradermind',password:'tradermind'}); client.connect().then(() => console.log('连接成功')).catch(e => console.error('连接失败:', e));"
```

### 5. 在 Cursor 中验证 MCP
重启 Cursor 后，在 Composer 中尝试以下查询：
- "查询 trade_plan 表的结构"
- "显示所有交易计划"
- "trade_execution 表有哪些列"

如果 MCP 正常工作，AI 助手应该能够直接查询数据库。

## 故障排除

### 问题 1: MCP 资源列表为空
**可能原因**:
- Cursor 尚未重启
- MCP 服务器启动失败
- 配置文件格式错误

**解决方案**:
1. 完全重启 Cursor IDE
2. 检查 Cursor 的输出日志（View > Output > MCP）
3. 确认配置文件格式正确

### 问题 2: 数据库连接失败
**可能原因**:
- PostgreSQL 服务未运行
- 连接信息错误
- 防火墙阻止连接

**解决方案**:
1. 检查 PostgreSQL 服务状态
2. 验证连接字符串格式
3. 检查防火墙设置

### 问题 3: npx 命令未找到
**可能原因**:
- Node.js 未安装
- npm/npx 不在 PATH 中

**解决方案**:
1. 安装 Node.js (https://nodejs.org/)
2. 验证 npx 命令: `npx --version`

## 预期行为

配置成功后，你应该能够：
1. 在 Composer 中询问数据库相关问题
2. AI 助手能够查询数据库表结构
3. AI 助手能够执行只读 SQL 查询

## 注意事项

- MCP 服务器默认是**只读**的，不会执行写操作
- 首次使用可能需要下载 `@modelcontextprotocol/server-postgres` 包（npx 会自动处理）
- 如果数据库连接信息更改，需要更新 `.cursor/mcp.json` 并重启 Cursor
