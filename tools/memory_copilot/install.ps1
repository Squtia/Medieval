# ==============================================================================
# Memory Copilot 一鍵安裝腳本 (Windows PowerShell)
# 功能：
# 1. 自動安裝 Headroom MCP (pip install headroom-ai)
# 2. 自動安裝 codebase-memory MCP (官方安裝指令)
# 3. 自動註冊 MCP 設定檔 (Antigravity / Claude Desktop / Cursor)
# 4. 自動安裝 SKILL.md 到本機技能庫 (~/.gemini/config/skills/memory_copilot/)
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🚀 Memory Copilot 雙引擎記憶系統 - 一鍵安裝啟動中" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. 檢查並安裝 headroom-ai
Write-Host "`n[1/4] 檢查並安裝 Headroom MCP (headroom-ai)..." -ForegroundColor Yellow
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
}

if ($pythonCmd) {
    Write-Host "正在透過 $pythonCmd 安裝 / 更新 headroom-ai..." -ForegroundColor Gray
    & $pythonCmd -m pip install --upgrade headroom-ai
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Headroom MCP 安裝成功！" -ForegroundColor Green
    } else {
        Write-Host "⚠️ pip 安裝 headroom-ai 遇到問題，請確認 Python 環境權限。" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "❌ 未偵測到 Python 環境，請先安裝 Python (3.10+) 後重新執行。" -ForegroundColor Red
}

# 2. 檢查並安裝 codebase-memory-mcp
Write-Host "`n[2/4] 檢查並安裝 codebase-memory-mcp..." -ForegroundColor Yellow
if (Get-Command codebase-memory-mcp -ErrorAction SilentlyContinue) {
    Write-Host "✅ codebase-memory-mcp 已存在於系統路徑中。" -ForegroundColor Green
} else {
    Write-Host "正在下載並執行官方安裝程序..." -ForegroundColor Gray
    try {
        Invoke-Expression (Invoke-RestMethod -Uri "https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1")
        Write-Host "✅ codebase-memory-mcp 安裝完成！" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ 官方 PowerShell 安裝遇到網路問題，嘗試透過 npm / pip 備援安裝..." -ForegroundColor DarkYellow
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            npm install -g codebase-memory-mcp
        } elseif ($pythonCmd) {
            & $pythonCmd -m pip install codebase-memory-mcp
        }
    }
}

# 執行內建的 Agent 自動配置
if (Get-Command codebase-memory-mcp -ErrorAction SilentlyContinue) {
    Write-Host "正在執行 codebase-memory-mcp 自動偵測與註冊..." -ForegroundColor Gray
    codebase-memory-mcp install -y
}

# 3. 註冊 MCP 設定檔 (Antigravity & Claude Desktop)
Write-Host "`n[3/4] 檢查並寫入 MCP 設定檔..." -ForegroundColor Yellow

$mcpConfigs = @(
    "$env:USERPROFILE\.gemini\config\mcp_config.json",
    "$env:USERPROFILE\.gemini\antigravity\mcp_config.json",
    "$env:APPDATA\Claude\claude_desktop_config.json"
)

# 取得可執行檔的完整路徑或命令
$headroomExe = "headroom"
if (Get-Command headroom -ErrorAction SilentlyContinue) {
    $headroomExe = (Get-Command headroom).Source
}
$codebaseExe = "codebase-memory-mcp"
if (Get-Command codebase-memory-mcp -ErrorAction SilentlyContinue) {
    $codebaseExe = (Get-Command codebase-memory-mcp).Source
}

foreach ($cfgPath in $mcpConfigs) {
    $dir = [System.IO.Path]::GetDirectoryName($cfgPath)
    if (Test-Path $dir) {
        Write-Host "正在檢查設定檔: $cfgPath" -ForegroundColor Gray
        $json = @{ mcpServers = @{} }
        if (Test-Path $cfgPath) {
            try {
                $raw = Get-Content $cfgPath -Raw -Encoding UTF8
                if ($raw.Trim()) {
                    $json = $raw | ConvertFrom-Json
                    if (-not $json.mcpServers) {
                        $json | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value (New-Object PSObject)
                    }
                }
            } catch {
                Write-Host "⚠️ 讀取現有設定檔失敗，將建立新物件。" -ForegroundColor DarkYellow
            }
        }

        # 注入 headroom
        $headroomObj = [PSCustomObject]@{
            command = $headroomExe
            args = @("mcp", "serve")
        }
        $json.mcpServers | Add-Member -MemberType NoteProperty -Name "headroom" -Value $headroomObj -Force

        # 注入 codebase-memory
        $codebaseObj = [PSCustomObject]@{
            command = $codebaseExe
        }
        $json.mcpServers | Add-Member -MemberType NoteProperty -Name "codebase-memory" -Value $codebaseObj -Force

        $updatedJson = $json | ConvertTo-Json -Depth 10
        Set-Content -Path $cfgPath -Value $updatedJson -Encoding UTF8
        Write-Host "  -> 已成功將 MCP 伺服器註冊到: $cfgPath" -ForegroundColor Green
    }
}

# 4. 安裝 SKILL.md 到全域技能庫
Write-Host "`n[4/4] 部署 memory_copilot 技能..." -ForegroundColor Yellow
$currentScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $currentScriptDir) { $currentScriptDir = Get-Location }
$sourceSkill = Join-Path $currentScriptDir "SKILL.md"

$targetSkillDirs = @(
    "$env:USERPROFILE\.gemini\config\skills\memory_copilot",
    "$env:USERPROFILE\.gemini\antigravity\skills\memory_copilot"
)

if (Test-Path $sourceSkill) {
    foreach ($targetDir in $targetSkillDirs) {
        $parent = Split-Path -Parent $targetDir
        if (Test-Path $parent) {
            if (-not (Test-Path $targetDir)) {
                New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
            }
            Copy-Item -Path $sourceSkill -Destination (Join-Path $targetDir "SKILL.md") -Force
            Write-Host "✅ 技能已複製至: $(Join-Path $targetDir "SKILL.md")" -ForegroundColor Green
        }
    }
} else {
    Write-Host "⚠️ 找不到同目錄下的 SKILL.md，請確認檔案放置正確。" -ForegroundColor DarkYellow
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "🎉 安裝流程已全數執行完畢！" -ForegroundColor Green
Write-Host "請重新啟動您的 AI 編輯器或對話終端 (Antigravity / Claude / Cursor)。" -ForegroundColor White
Write-Host "在對話中輸入：「記憶導航」即可立即啟用雙引擎記憶！" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
