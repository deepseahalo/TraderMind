# PostgreSQL MCP Configuration Check Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL MCP Configuration Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check config file
Write-Host "1. Checking MCP config file..." -ForegroundColor Yellow
$mcpConfigPath = ".\.cursor\mcp.json"
if (Test-Path $mcpConfigPath) {
    Write-Host "   [OK] Config file exists: $mcpConfigPath" -ForegroundColor Green
    try {
        $config = Get-Content $mcpConfigPath -Raw | ConvertFrom-Json
        Write-Host "   [OK] JSON format is valid" -ForegroundColor Green
        $serverName = $config.mcpServers.PSObject.Properties.Name
        Write-Host "   - Server name: $serverName" -ForegroundColor Gray
    } catch {
        Write-Host "   [ERROR] Invalid JSON format: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   [ERROR] Config file not found: $mcpConfigPath" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Check Node.js and npx
Write-Host "2. Checking Node.js and npx..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "   [OK] Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Node.js not installed or not in PATH" -ForegroundColor Red
    exit 1
}

try {
    $npxVersion = npx --version 2>&1
    Write-Host "   [OK] npx version: $npxVersion" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] npx not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. Check PostgreSQL service
Write-Host "3. Checking PostgreSQL service..." -ForegroundColor Yellow
$pgServices = Get-Service | Where-Object { $_.Name -like "*postgresql*" -or $_.DisplayName -like "*PostgreSQL*" }
if ($pgServices) {
    foreach ($service in $pgServices) {
        $status = if ($service.Status -eq "Running") { "[OK]" } else { "[STOPPED]" }
        $color = if ($service.Status -eq "Running") { "Green" } else { "Red" }
        Write-Host "   $status $($service.DisplayName): $($service.Status)" -ForegroundColor $color
    }
} else {
    Write-Host "   [WARN] PostgreSQL service not found (may be running differently)" -ForegroundColor Yellow
}

# Check port 5432
Write-Host ""
Write-Host "   Checking port 5432..." -ForegroundColor Gray
$port5432 = netstat -an | Select-String ":5432"
if ($port5432) {
    Write-Host "   [OK] Port 5432 is listening" -ForegroundColor Green
} else {
    Write-Host "   [ERROR] Port 5432 is not listening (PostgreSQL may not be running)" -ForegroundColor Red
}

Write-Host ""

# 4. MCP Config Summary
Write-Host "4. MCP Configuration Summary..." -ForegroundColor Yellow
Write-Host "   Config file: $mcpConfigPath" -ForegroundColor Gray
Write-Host "   Server name: postgresql" -ForegroundColor Gray
Write-Host "   Command: npx" -ForegroundColor Gray
Write-Host "   Package: @modelcontextprotocol/server-postgres" -ForegroundColor Gray
Write-Host "   Database: tradermind@localhost:5432" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Check Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Important Notes:" -ForegroundColor Yellow
Write-Host "1. If this is the first time configuring, please RESTART Cursor IDE completely" -ForegroundColor White
Write-Host "2. After restart, try querying database in Composer" -ForegroundColor White
Write-Host "3. Example: 'query trade_plan table structure'" -ForegroundColor White
Write-Host "4. If still not working, check Cursor output logs (View > Output > MCP)" -ForegroundColor White
Write-Host ""
