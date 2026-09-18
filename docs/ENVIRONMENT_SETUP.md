# 家用與新環境開發配置手冊 (Home & New Environment Setup Guide)

本手冊彙整了本專案目前所引用的 **所有 Skills（技能）**、**安裝的 MCP Servers（模型上下文協議伺服器）** 以及 **專案本體相依環境**。方便您回到家中或在全新電腦上一鍵/快速還原完全相同的開發環境。

---

## 總覽架構圖 (Environment Architecture)

```
[使用者電腦 (Home / Office)]
 ├── 1. 專案本體 (Medieval Workspace: d:\tryagent\Medieval)
 │    ├── Node.js / Vite / TypeScript / Vitest / Phaser / Three.js
 │    └── 專案專屬技能: .agents/skills/memory_copilot/
 │
 ├── 2. Antigravity IDE 內建技能 (Built-in Skills)
 │    ├── agy-customizations (自訂規範與外掛導航)
 │    └── antigravity-guide (Antigravity CLI / IDE 全手冊)
 │
 ├── 3. 全域自訂技能 (Global User Skills: %USERPROFILE%\.gemini\config\skills)
 │    └── web_token (Chrome CDP 9222 網頁版 Gemini/ChatGPT 訂閱額度橋接)
 │
 └── 4. 安裝的 MCP 伺服器 (MCP Servers: %USERPROFILE%\.gemini\antigravity-ide\mcp)
      ├── codebase-memory (靜態代碼知識圖譜 / AST 呼叫鏈 / 向量索引)
      ├── headroom (動態對話上下文 / CCR 快取壓縮)
      └── gemini-web-bridge (網頁版 CDP 控制橋接伺服器)
```

---

## 第一部分：引用的 Skills（技能）清單

目前對話環境中一共有 **4 個主要 Skills**，分佈在三個層級：

### 1. 專案層級技能 (Workspace Skill - 跟隨 Git 倉庫)
* **`memory_copilot`** (雙引擎記憶領航員)
  * **位置**：`d:\tryagent\Medieval\.agents\skills\memory_copilot\SKILL.md`
  * **用途**：智慧調度 `headroom`（動態日誌/對話壓縮）與 `codebase-memory`（靜態圖譜呼叫鏈分析）。
  * **家裡安裝方式**：**免額外安裝**。只要 clone 或複製專案資料夾，`.agents/skills/` 內就自帶此技能。

---

### 2. 全域使用者自訂技能 (Global User Skill)
* **`web_token`** (網頁端訂閱額度調用中樞)
  * **位置**：`C:\Users\<使用者名稱>\.gemini\config\skills\web_token\SKILL.md`
  * **用途**：透過 Chrome 9222 CDP 埠，調用本機已登入的 Gemini Advanced 或 ChatGPT Plus/Pro 高階額度，支援深度搜尋、超長推理、素材多模態審查與高畫質生圖。
  * **家裡安裝方式**：
    1. 複製整個 `%USERPROFILE%\.gemini\config\skills\web_token\` 目錄到家裡電腦相同路徑。
    2. 或依據技能說明，直接從雲端備份包取得：
       - 雲端備份：`[Google Drive]:\我的雲端硬碟\ai\web_token_bridge` 或 `web_token_bridge.zip`。
       - 執行內附的 `install.bat`，會自動將工具與技能代碼佈署至 `%USERPROFILE%\.gemini\`。

---

### 3. IDE 內建技能 (Antigravity Built-in Skills)
* **`agy-customizations`**：說明自訂規則、Skills、MCP 配置的官方引導。
* **`antigravity-guide`**：說明 Antigravity CLI、SDK 與 IDE 操作的官方手冊。
* **家裡安裝方式**：**免手動安裝**。只要在家中電腦安裝好 Antigravity IDE，即自動內建於系統目錄中。

---

## 第二部分：安裝的 MCP 伺服器 (Model Context Protocol)

目前本機一共註冊並安裝了 **3 個 MCP 伺服器**：

| MCP 伺服器名稱 | 核心功能 | 存放設定路徑 | 家用還原方式 |
| :--- | :--- | :--- | :--- |
| **`codebase-memory`** | 專案代碼知識圖譜、AST 語法樹、跨檔案呼叫鏈追蹤 (`search_graph`, `trace_path`, `index_repository`) | `%USERPROFILE%\.gemini\antigravity-ide\mcp\codebase-memory\` | 複製資料夾或在 IDE MCP 設定中新增，首次進入專案後下達 `index_repository` 即可自動掃描建立圖譜資料庫。 |
| **`headroom`** | 動態對話上下文 / CCR 快取壓縮器 (`headroom_compress`, `headroom_retrieve`, `headroom_stats`)，防止上千行終端測試日誌塞爆 Token | `%USERPROFILE%\.gemini\antigravity-ide\mcp\headroom\` | 複製對應 schema 與工具配置檔至 `%USERPROFILE%\.gemini\antigravity-ide\mcp\headroom\`。 |
| **`gemini-web-bridge`** | 提供與 Chrome 9222 遠端偵錯埠通訊之後端橋接服務 (`gemini_web_status`, `gemini_web_generate_image` 等) | `%USERPROFILE%\.gemini\antigravity-ide\mcp\gemini-web-bridge\` | 從雲端備份包 `web_token_bridge.zip` 執行 `install.bat` 自動安裝。 |

---

## 第三部分：專案本體環境安裝指引 (Project Setup)

### 1. 軟體環境必備
1. **Node.js**：建議版本 **v18+** 或 **v20+** LTS。
2. **Git**：用於代碼版本管理。
3. **Chrome 瀏覽器**（若需使用 `web_token` 網頁版額度）。

### 2. 專案套件安裝 (Terminal)
將專案下載或複製至家用電腦後，在專案根目錄開啟終端機（cmd 或 powershell）執行：

```cmd
# 1. 進入專案根目錄
cd d:\tryagent\Medieval

# 2. 安裝所有相依套件 (包括 Three.js, Phaser, Vite, Vitest 等)
npm install
```

### 3. 開發與測試常用指令
```cmd
# 啟動本地開發伺服器 (Vite Dev Server，預設 http://localhost:5173)
npm run dev

# 執行 TypeScript 靜態型別檢查 (驗證 0 錯誤)
npm run typecheck

# 執行單元測試 (Vitest)
# 提醒：請遵循 Rule 14 節約 Token 規範，除錯時建議強制定向測試特定檔案
npx vitest run src/ui/fx/VFXDeterministicPlayback.test.ts

# 執行全量測試 (交付前驗證)
npm test
```

---

## 第四部分：終極懶人家用一鍵還原指南 (One-Click Home Restore)

專案內已將所有自訂 Skills（`memory_copilot`、`web_token`）與 3 大 MCP 伺服器設定（`codebase-memory`、`headroom`、`gemini-web-bridge`）收納進專案倉庫中。

### 🏠 回家後的 2 步極簡操作：
1. **下載或拉取專案代碼**：
   ```cmd
   git pull
   ```
2. **雙擊執行一鍵還原腳本**：
   - 點擊執行：`tools/env-sync/restore_home.bat`
   - （或在終端機執行 `node tools/env-sync/restore_home.js`）
   - **腳本會自動完成**：
     - 自動將 3 大 MCP 設定還原至家裡電腦的 `%USERPROFILE%\.gemini\antigravity-ide\mcp\`。
     - 自動將 `web_token` 技能註冊至家裡電腦的 `%USERPROFILE%\.gemini\config\skills\`。
3. **安裝相依套件**：
   ```cmd
   npm install
   ```
4. **開工**！一切技能與 MCP 即刻無縫就緒！
