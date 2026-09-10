# ==============================================================================
# Medieval 專案 - Memory Copilot 雙引擎記憶環境一鍵安裝腳本 (Windows PowerShell)
# 
# 執行方式:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-memory-copilot.ps1
#
# 功能:
# 1. 檢查並安裝 Headroom MCP (Python 3.10+ -> pip install "headroom-ai[mcp]")
# 2. 檢查並安裝 codebase-memory MCP (npm install -g codebase-memory-mcp)
# 3. 自動寫入 Antigravity 全域 MCP 設定檔 (~/.gemini/config/mcp_config.json)
# 4. 同步專案 Skill 至全域目錄 (~/.gemini/config/skills/memory_copilot/)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🛡️  Medieval 專案 - Memory Copilot 一鍵環境配置" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. 檢查與安裝 Headroom MCP
# ------------------------------------------------------------------------------
Write-Host "`n[1/4] 檢查並安裝 Headroom MCP (headroom-ai)..." -ForegroundColor Yellow

$pythonCmd = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
}

if ($pythonCmd) {
    Write-Host "使用 $pythonCmd 安裝 / 升級 headroom-ai[mcp]..." -ForegroundColor Gray
    & $pythonCmd -m pip install --upgrade "headroom-ai[mcp]"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Headroom MCP 安裝成功！" -ForegroundColor Green
    } else {
        Write-Host "⚠ pip 安裝遇到問題，請確認 Python 環境與網路連線。" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "⚠ 未偵測到 Python，請先安裝 Python (3.10+) 後再安裝 Headroom。" -ForegroundColor Red
}

# ------------------------------------------------------------------------------
# 2. 檢查與安裝 codebase-memory MCP
# ------------------------------------------------------------------------------
Write-Host "`n[2/4] 檢查並安裝 codebase-memory MCP..." -ForegroundColor Yellow

if (Get-Command codebase-memory-mcp -ErrorAction SilentlyContinue) {
    Write-Host "✓ codebase-memory-mcp 已存在於系統路徑中。" -ForegroundColor Green
} else {
    Write-Host "正在透過 npm 全域安裝 codebase-memory-mcp..." -ForegroundColor Gray
    if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
        cmd.exe /c "npm.cmd install -g codebase-memory-mcp"
    } elseif (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install -g codebase-memory-mcp
    } else {
        Write-Host "⚠ 未偵測到 npm，請先安裝 Node.js 環境。" -ForegroundColor Red
    }
}

# 執行自動環境註冊
if (Get-Command codebase-memory-mcp.cmd -ErrorAction SilentlyContinue) {
    cmd.exe /c "codebase-memory-mcp.cmd install -y"
} elseif (Get-Command codebase-memory-mcp -ErrorAction SilentlyContinue) {
    codebase-memory-mcp install -y
}

# ------------------------------------------------------------------------------
# 3. 寫入 Antigravity 全域 MCP 設定檔
# ------------------------------------------------------------------------------
Write-Host "`n[3/4] 檢查並寫入 Antigravity MCP 設定檔..." -ForegroundColor Yellow

$geminiConfigDir = "$env:USERPROFILE\.gemini\config"
$mcpConfigFile = "$geminiConfigDir\mcp_config.json"

if (-not (Test-Path $geminiConfigDir)) {
    New-Item -ItemType Directory -Path $geminiConfigDir -Force | Out-Null
}

# 取得可用執行檔路徑
$headroomExe = (Get-Command headroom.exe -ErrorAction SilentlyContinue).Source
if (-not $headroomExe) {
    $headroomExe = (Get-ChildItem -Path "$env:LOCALAPPDATA\Python\*\Scripts\headroom.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName)
}
if (-not $headroomExe) { $headroomExe = "headroom" }

$codebaseExe = (Get-Command codebase-memory-mcp.exe -ErrorAction SilentlyContinue).Source
if (-not $codebaseExe) {
    $codebaseExe = "$env:USERPROFILE\.local\bin\codebase-memory-mcp.exe"
}
if (-not (Test-Path $codebaseExe)) {
    $codebaseExe = (Get-Command codebase-memory-mcp.cmd -ErrorAction SilentlyContinue).Source
}
if (-not $codebaseExe) { $codebaseExe = "codebase-memory-mcp" }

$mcpData = [PSCustomObject]@{
    mcpServers = [PSCustomObject]@{
        headroom = [PSCustomObject]@{
            command = $headroomExe
            args = @("mcp", "serve")
        }
        "codebase-memory" = [PSCustomObject]@{
            command = $codebaseExe
        }
    }
}

$jsonOutput = $mcpData | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($mcpConfigFile, $jsonOutput, [System.Text.Encoding]::UTF8)
Write-Host "✓ 已寫入全域 MCP 配置檔: $mcpConfigFile" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 4. 同步 Skill 到全域技能目錄
# ------------------------------------------------------------------------------
Write-Host "`n[4/4] 部署 memory_copilot 技能..." -ForegroundColor Yellow

$projectSkill = "$PSScriptRoot\..\.agents\skills\memory_copilot\SKILL.md"
$globalSkillDir = "$env:USERPROFILE\.gemini\config\skills\memory_copilot"

if (Test-Path $projectSkill) {
    if (-not (Test-Path $globalSkillDir)) {
        New-Item -ItemType Directory -Path $globalSkillDir -Force | Out-Null
    }
    Copy-Item -Path $projectSkill -Destination "$globalSkillDir\SKILL.md" -Force
    Write-Host "✓ 技能已同步至: $globalSkillDir\SKILL.md" -ForegroundColor Green
} else {
    Write-Host "⚠ 未在專案中找到 SKILL.md ($projectSkill)" -ForegroundColor DarkYellow
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "🎉 Memory Copilot 配置完成！" -ForegroundColor Green
Write-Host "請在 Antigravity 對話中輸入：「/memory_copilot 建立索引」即可開始使用。" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
