# 雙引擎記憶領航員 (Memory Copilot) 小工具包

本套件封裝了 Antigravity / Claude / Cursor 等 AI Agent 專用的「雙引擎記憶領航員」技能，並內含全自動一鍵安裝與 MCP 部署工具。

## 📦 目錄清單與檔案說明

| 檔案名稱 | 說明 |
| :--- | :--- |
| [`SKILL.md`](./SKILL.md) | 雙引擎記憶領航員核心技能定義檔（涵蓋三大情境判定、觸發詞與主動提醒原則）。 |
| [`INSTALL.md`](./INSTALL.md) | **【其他 Agent 必讀】** 一鍵安裝與 MCP 配置說明手冊（支援多客戶端與手動除錯）。 |
| [`install.ps1`](./install.ps1) | Windows PowerShell 一鍵全自動安裝腳本（自動安裝套件、設定 MCP 與部署技能）。 |
| [`install.sh`](./install.sh) | macOS / Linux 一鍵安裝腳本。 |
| [`mcp_snippet.json`](./mcp_snippet.json) | 乾淨可直接複製的 MCP Server JSON 設定區塊。 |

## ⚡ 快速一鍵安裝

### Windows (PowerShell)
```powershell
cd "Z:\99.Temp\JAY\Ai\小工具\memory_copilot"
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### macOS / Linux
```bash
cd "Z:/99.Temp/JAY/Ai/小工具/memory_copilot"
bash ./install.sh
```

詳細安裝細節與手動設定請參閱 [`INSTALL.md`](./INSTALL.md)。
