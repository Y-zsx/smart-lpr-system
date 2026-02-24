# 服务健康检查脚本（需先启动后端，可选启动 AI 服务）
# 用法：在项目根目录执行 .\scripts\smoke-check.ps1

$ErrorActionPreference = "Stop"
$backend = "http://localhost:8000"
$ai = "http://localhost:8001"
$failed = 0

Write-Host "=== Smart LPR 健康检查 ===" -ForegroundColor Cyan

# 1. 后端根路径
try {
    $r = Invoke-WebRequest -Uri $backend -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200 -and $r.Content -match "Backend") {
        Write-Host "[OK] 后端 $backend" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] 后端返回异常: $($r.StatusCode)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "[FAIL] 后端不可达: $_" -ForegroundColor Red
    $failed++
}

# 2. 登录接口
try {
    $body = @{ username = "admin"; password = "admin123" } | ConvertTo-Json
    $r = Invoke-WebRequest -Uri "$backend/api/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
        $json = $r.Content | ConvertFrom-Json
        if ($json.success -and $json.data.token) {
            Write-Host "[OK] 登录接口 /api/auth/login" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] 登录返回无 token" -ForegroundColor Red
            $failed++
        }
    } else {
        Write-Host "[FAIL] 登录返回 $($r.StatusCode)" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "[FAIL] 登录请求失败: $_" -ForegroundColor Red
    $failed++
}

# 3. AI 服务（可选）
try {
    $r = Invoke-WebRequest -Uri "$ai/health" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) {
        Write-Host "[OK] AI 服务 $ai/health" -ForegroundColor Green
    } else {
        Write-Host "[WARN] AI 服务返回 $($r.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[SKIP] AI 服务未启动（识别功能不可用）" -ForegroundColor Yellow
}

Write-Host "=========================" -ForegroundColor Cyan
if ($failed -gt 0) {
    Write-Host "检查未通过: $failed 项失败" -ForegroundColor Red
    exit 1
}
Write-Host "检查通过" -ForegroundColor Green
exit 0
