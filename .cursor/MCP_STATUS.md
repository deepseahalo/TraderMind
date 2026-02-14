# MCP 配置状态报告

## ✅ 已完成的配置

1. **配置文件已创建**: `.cursor/mcp.json`
2. **配置格式**: 正确（JSON 格式）
3. **npx 可用**: ✅ 已安装 (版本 11.6.2)

## 📋 当前配置

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

## ⚠️ 当前状态

**MCP 资源列表**: 空（需要重启 Cursor 后检查）

## 🔧 下一步操作

### 1. 重启 Cursor IDE（必需）
MCP 配置更改后，**必须完全重启 Cursor IDE** 才能生效：
- 完全关闭 Cursor（不是最小化）
- 重新打开 Cursor
- 等待几秒钟让 MCP 服务器启动

### 2. 验证 MCP 是否工作
重启后，在 Cursor 的 Composer 中尝试：
```
查询 trade_plan 表的结构
```

如果 MCP 正常工作，AI 助手应该能够直接查询数据库。

### 3. 检查 Cursor 输出日志
如果 MCP 不工作，检查 Cursor 的输出日志：
- View > Output
- 选择 "MCP" 或 "Console" 输出
- 查看是否有错误信息

## 🔍 故障排除

### 如果 MCP 仍然不可用：

1. **检查 PostgreSQL 服务**
   ```powershell
   Get-Service -Name postgresql*
   ```

2. **验证数据库连接**
   确保数据库服务正在运行，并且连接信息正确

3. **检查 Cursor 设置**
   - 打开 Cursor Settings (Ctrl+,)
   - 导航到 Features > MCP
   - 查看是否有错误提示

4. **手动测试 MCP 服务器**
   ```powershell
   npx -y @modelcontextprotocol/server-postgres "postgresql://tradermind:tradermind@localhost:5432/tradermind"
   ```

## 📝 注意事项

- MCP 服务器是**只读**的，只能执行 SELECT 查询
- 首次使用可能需要下载 `@modelcontextprotocol/server-postgres` 包
- 如果数据库连接信息更改，需要更新配置并重启 Cursor

## ✅ 验证清单

- [x] 配置文件已创建
- [x] 配置格式正确
- [x] npx 可用
- [ ] Cursor IDE 已重启
- [ ] MCP 资源列表有内容
- [ ] 可以在 Composer 中查询数据库
