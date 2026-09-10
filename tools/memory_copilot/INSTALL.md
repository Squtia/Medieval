# 雙引擎記憶領航員 (Memory Copilot) - Agent 一鍵安裝與 MCP 配置指南

> 🤖 **給 AI Agent 的執行指示 (Agent Executive Prompt)**：  
> 如果你是正在為使用者配置環境的 AI Agent（如 Claude Code, Antigravity, Cursor, Windsurf 等），請直接閱讀並執行下方 **「一鍵自動安裝指令」** 區塊，即可自動為目前主機安裝雙 MCP 伺服器並掛載本技能。

---

## 目錄
1. [系統簡介與雙引擎架構](#1-系統簡介與雙引擎架構)
2. [🚀 一鍵自動安裝指令 (推薦)](#2--一鍵自動安裝指令-推薦)
3. [手動分步安裝指南](#3-手動分步安裝指南)
4. [MCP 伺服器配置檔設定 (跨客戶端)](#4-mcp-伺服器配置檔設定-跨客戶端)
5. [安裝驗證與功能測試](#5-安裝驗證與功能測試)
6. [技能工作流程與對話指令速查](#6-技能工作流程與對話指令速查)

---

## 1. 系統簡介與雙引擎架構

`memory_copilot` 是一個智慧調度雙層記憶的頂級 Agent 技能，整合了兩大關鍵 MCP：

| 引擎 | MCP 名稱 | 職責定位 | 核心機制 | 解決痛點 |
| :--- | :--- | :--- | :--- | :--- |
| **動態層** | **Headroom MCP** | 對話上下文 / Session 暫存 | **CCR (Cache-Compress-Retrieve)**<br/>快取全文，保留精簡摘要與 Hash | 終端日誌爆量、Token 超標、長對話遺忘早期細節 |
| **靜態層** | **codebase-memory MCP** | 程式碼知識圖譜 / 專案資產 | **AST 語法樹 + 呼叫鏈圖譜**<br/>SQLite 本地極速檢索 (`.codebase-memory/`) | 盲目 grep 浪費 Token、改動牽一髮動全身、難以理清架構 |

---

## 2. 🚀 一鍵自動安裝指令 (推薦)

### 方案 A：Windows (PowerShell) 一鍵安裝

開啟 PowerShell（以一般使用者或系統管理員權限執行）：

```powershell
# 進入本工具目錄並直接執行自動化安裝腳本
cd "Z:\99.Temp\JAY\Ai\小工具\memory_copilot"
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

> **該腳本會自動完成：**
> 1. 透過 pip 自動安裝 / 升級 `headroom-ai`。
> 2. 下載並安裝 `codebase-memory-mcp` 二進位程式。
> 3. 自動呼叫 `codebase-memory-mcp install -y` 偵測註冊各編輯器。
> 4. 自動寫入 Antigravity (`~/.gemini/config/mcp_config.json`) 與 Claude Desktop 設定檔。
> 5. 將 `SKILL.md` 複製至全域技能目錄 (`~/.gemini/config/skills/memory_copilot/`)。

---

### 方案 B：macOS / Linux 一鍵安裝

在終端機中執行：

```bash
cd "Z:/99.Temp/JAY/Ai/小工具/memory_copilot"
bash ./install.sh
```

---

## 3. 手動分步安裝指南

如果環境受限或需要手動客製化安裝，請依序執行以下步驟：

### 步驟 1：安裝 Headroom MCP
Headroom 透過 Python pip 釋出，需 Python 3.10+：
```bash
pip install --upgrade headroom-ai
```
*驗證安裝*：
```bash
headroom --version
headroom doctor
```

### 步驟 2：安裝 codebase-memory MCP
codebase-memory 提供官方單一執行檔與跨平台安裝程序：

* **Windows (PowerShell)**：
  ```powershell
  irm https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 | iex
  codebase-memory-mcp install -y
  ```

* **macOS / Linux**：
  ```bash
  curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
  codebase-memory-mcp install -y
  ```

* **npm 備援方案**：
  ```bash
  npm install -g codebase-memory-mcp
  ```

---

## 4. MCP 伺服器配置檔設定 (跨客戶端)

請依您所使用的 AI Agent 或 IDE，將以下 JSON 內容加入對應的 MCP 設定檔中：

### 標準 MCP JSON 片段
```json
{
  "mcpServers": {
    "headroom": {
      "command": "headroom",
      "args": [
        "mcp",
        "serve"
      ]
    },
    "codebase-memory": {
      "command": "codebase-memory-mcp"
    }
  }
}
```

### 各客戶端設定檔路徑速查：

1. **Google Antigravity / Gemini CLI**：
   - 檔案路徑：`~/.gemini/config/mcp_config.json` 或 `~/.gemini/antigravity/mcp_config.json`
2. **Claude Desktop**：
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
3. **Cursor**：
   - 專案路徑：`.cursor/mcp.json` 或 全域 Cursor Settings -> Features -> MCP
4. **Windsurf**：
   - `~/.codeium/windsurf/mcp_config.json`
5. **Zed**：
   - `~/.config/zed/settings.json`

---

## 5. 安裝驗證與功能測試

完成安裝與設定檔寫入後，請重啟您的 AI 終端或 IDE，並執行以下驗證：

### 1. 終端命令檢查
```bash
# 檢查 Headroom MCP 服務連線
headroom doctor

# 檢查代碼圖譜專案清單
codebase-memory-mcp cli list_projects
```

### 2. 對話功能測試
直接向您的 AI Agent 輸入以下對話指令進行驗證：
* **啟用技能**：「`記憶導航`」或「`/memory_copilot`」
* **測試代碼圖譜**：「`幫我建立目前專案的代碼圖譜索引`」
* **測試動態壓縮**：「`這份 log 太長了，幫我用 Headroom 壓縮存檔只留下重點與 Hash`」

---

## 6. 技能工作流程與對話指令速查

### 三大模式工作流程圖

```
                            [任務情境判定]
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
 【情境 A：對話太長/大量Log】  【情境 B：探索專案/重構代碼】  【情境 C：任務完成/跨對話接續】
       │                           │                           │
  [Headroom CCR 壓縮]        [codebase-memory 圖譜]       [雙層合體封存閉環]
 呼叫 headroom_compress       呼叫 index_repository       1. 決策寫入 ARCHITECTURE.md
 對話瘦身，產出 Hash          呼叫 search_graph / trace   2. 更新代碼圖譜索引
 需要時用 Hash 秒速還原      毫秒級追蹤函式呼叫鏈        3. 對話打包 Hash，新對話無縫接工
```

### 常用對話速查語句
* 「**記憶導航**」：喚起技能並根據目前對話評估最適合的記憶模式。
* 「**幫我用 Headroom 壓縮這段日誌**」：將雜訊日誌壓縮並產生檢索代碼。
* 「**用 Hash [xxxx] 還原剛才的詳細內容**」：調用 `headroom_retrieve` 還原。
* 「**建立目前專案的代碼圖譜索引**」：調用 `index_repository`。
* 「**分析此函式的呼叫路徑與影響範圍**」：調用 `trace_path` 與 `query_graph`。
* 「**合體打包本次對話與代碼進度**」：寫入專案知識並封存動態 Hash，達成零包袱交接。
