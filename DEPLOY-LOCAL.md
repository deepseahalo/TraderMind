# TraderMind 本地部署

支持 **局域网** 和 **公网** 访问，仅需暴露 **3000** 端口（前端内置 API 转发）。

## 前置条件

1. **PostgreSQL** 已安装并运行，数据库 `tradermind` 已创建
2. **DeepSeek API Key** 已配置（`backend/application-local.yml` 或环境变量 `DEEPSEEK_API_KEY`）

## 快速启动

```powershell
.\start-local.ps1
```

访问：
- **本机**：http://localhost:3000
- **局域网**：http://你的电脑IP:3000

---

## 公网访问（非局域网）

### 方式一：ngrok（无需改路由器，零配置）

1. 安装 [ngrok](https://ngrok.com/download)，注册并配置 authtoken
2. 先启动后端和前端（`.\start-local.ps1` 或手动启动）
3. 执行：

```powershell
ngrok http 3000
```

4. 使用 ngrok 提供的 `https://xxx.ngrok-free.app` 地址访问，任意网络均可

### 方式二：Cloudflare Tunnel

```powershell
# 安装 cloudflared 后
cloudflared tunnel --url http://localhost:3000
```

### 方式三：路由器端口转发

1. 在路由器中把 3000 端口转发到本机
2. 用公网 IP 或动态 DNS 域名访问，例如：http://你的公网IP:3000

---

## 生产构建后启动

```powershell
cd frontend && npm run build
cd backend  && mvn spring-boot:run   # 终端1
cd frontend && npm run start         # 终端2
```

## 防火墙

只需放行 **3000** 端口（8080 仅本机使用，由 Next 转发）
