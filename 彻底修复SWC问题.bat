@echo off
chcp 65001 >nul
echo ========================================
echo TraderMind - 彻底修复 SWC 问题
echo ========================================
echo.

echo 步骤 1: 强制终止所有 Node.js 进程...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo ✓ 已完成

echo.
echo 步骤 2: 终止占用端口 3000 的进程...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo ✓ 已完成

echo.
echo 步骤 3: 清理 frontend 目录...
cd /d "%~dp0frontend"

if exist "node_modules" (
    echo 正在删除 node_modules...
    rmdir /s /q "node_modules" >nul 2>&1
    echo ✓ 已删除 node_modules
)

if exist ".next" (
    rmdir /s /q ".next" >nul 2>&1
    echo ✓ 已删除 .next
)

if exist "package-lock.json" (
    del /f /q "package-lock.json" >nul 2>&1
    echo ✓ 已删除 package-lock.json
)

echo.
echo 步骤 4: 配置 npm 使用国内镜像...
call npm config set registry https://registry.npmmirror.com >nul 2>&1
echo ✓ 已配置国内镜像

echo.
echo 步骤 5: 清理 npm 缓存...
call npm cache clean --force >nul 2>&1
echo ✓ 已完成

echo.
echo 步骤 6: 重新安装依赖（使用国内镜像）...
echo 预计需要 1-3 分钟...
echo.
call npm install

if errorlevel 1 (
    echo.
    echo ✗ npm install 失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✓ 依赖安装完成！
echo ========================================
echo.
echo 步骤 7: 启动开发服务器...
echo 注意: 如果仍然出现 SWC 错误，next.config.js 已配置禁用 SWC
echo.
call npm run dev

pause
