# PostgreSQL MCP 配置说明

## 已创建的配置

已在 `.cursor/mcp.json` 中配置了 PostgreSQL MCP 服务器，使用项目的数据库连接信息：
- 主机: localhost
- 端口: 5432
- 数据库: tradermind
- 用户名: tradermind
- 密码: tradermind

## 使用方法

### 方法 1：使用项目配置（推荐）

配置文件已创建在 `.cursor/mcp.json`，Cursor 会自动读取。

### 方法 2：通过 Cursor 设置界面

1. 打开 Cursor Settings（`Ctrl+,` 或 `Cmd+,`）
2. 导航到 **Features** > **MCP**
3. 点击 **"+ Add New MCP Server"**
4. 配置如下：
   - **Name**: `postgresql`
   - **Type**: `stdio`
   - **Command**: `npx`
   - **Args**: `["-y", "@modelcontextprotocol/server-postgres"]`
   - **Environment Variables**:
     ```
     POSTGRES_CONNECTION_STRING=postgresql://tradermind:tradermind@localhost:5432/tradermind
     ```

## 功能说明

配置完成后，MCP 服务器将提供以下功能：

1. **数据库架构查询**：可以查询表结构、列信息等
2. **只读查询**：可以执行 SELECT 查询（只读操作）
3. **数据检查**：可以检查数据库中的数据

## 注意事项

- MCP 服务器默认是**只读**的，不会执行写操作
- 确保 PostgreSQL 服务正在运行
- 如果数据库连接信息更改，需要同步更新 `.cursor/mcp.json` 中的配置

## 验证配置

配置完成后，在 Cursor 的 Composer 中询问数据库相关问题，AI 助手将能够直接查询数据库。

例如：
- "查询 trade_plan 表的结构"
- "显示所有交易计划"
- "trade_execution 表有哪些列"
