# TraderMind 本地部署 - 支持局域网访问
# 使用前确保：1) PostgreSQL 已启动  2) 已配置 DEEPSEEK_API_KEY 或 application-local.yml

Write-Host "TraderMind 启动中..." -ForegroundColor Green

# 获取本机 IP，供其他设备访问
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|vmware|vbox" } | Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "127.0.0.1" }

Write-Host ""
Write-Host "本机访问: http://localhost:3000" -ForegroundColor Cyan
Write-Host "局域网访问: http://${ip}:3000" -ForegroundColor Cyan
Write-Host ""

# 启动后端（新窗口）
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host 'Backend starting on 0.0.0.0:8080' -ForegroundColor Yellow; mvn spring-boot:run"

# 等待后端启动
Write-Host "等待后端启动 (15秒)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# 启动前端（新窗口）
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host 'Frontend starting on 0.0.0.0:3000' -ForegroundColor Yellow; npm run dev"

Write-Host ""
Write-Host "两个终端已打开，关闭终端即停止服务" -ForegroundColor Green
Write-Host "手机/其他电脑访问: http://${ip}:3000" -ForegroundColor Yellow
