---
name: web_token
description: 透過本機 Chrome CDP (9222 埠) 橋接技術，調用使用者已登入的 Gemini Web 版 (gemini.google.com) 或 ChatGPT Web 版 (chatgpt.com) 之高階訂閱額度（如 Gemini Advanced / ChatGPT Plus/Pro）。預設使用 Gemini Web；指定 GPT 時自動切換至 ChatGPT Web。支援全模態功能：文字推理、深度搜尋 (Deep Research)、代碼與文件審查、高畫質生圖 (Imagen 3/4 或 DALL-E 3)；有素材時自動將圖片/文件貼入輸入框作為上下文；多重任務時自動開啟獨立多分頁並行執行，任務完成後即刻關閉分頁釋放資源。當使用者說「web_token」、「web額度」、「網頁版額度」、「用web額度」、「用gpt額度」、「用gemini額度」、「web深度搜索」、「web生圖」、「帶素材問web」時觸發。
---

# 網頁端訂閱額度全模態調用中樞 (Web Token Hub)

本技能為調用本機瀏覽器端已登入之 **高階付費訂閱帳號（Gemini Advanced / ChatGPT Plus/Pro）** 的全模態中樞。透過本機 Chrome CDP (9222 埠) 橋接，打破 API 配額與模型版本限制，直接利用網頁端原生強大功能進行運算。

共用啟動腳本（9222 埠，同一個 Chrome Profile）：
- Gemini Web：[launch_gemini_chrome.bat](file:///C:/Users/Allen.Ko/.gemini/config/tools/gemini-web-bridge/scripts/launch_gemini_chrome.bat)
- ChatGPT Web：[launch_chatgpt_chrome.bat](file:///C:/Users/Allen.Ko/.gemini/config/tools/gemini-web-bridge/scripts/launch_chatgpt_chrome.bat)

> [!IMPORTANT]
> **自製工具與離線包取得指引 (Offline Package)**：
> 本技能依賴的底層 MCP 服務 (`gemini-web-bridge`) 與啟動批次檔為專屬自製開發工具，網路上無法公開下載。
> 若切換新電腦或更新技能後發現缺少 MCP 服務或啟動 bat 檔案，請直接至雲端硬碟備份包取得：
> - **雲端備份路徑**：`[Google Drive]:\我的雲端硬碟\ai\web_token_bridge` 或 `web_token_bridge.zip`
> - 內建一鍵安裝腳本 `install.bat`，解壓或執行後即可一鍵自動部署工具代碼至 `%USERPROFILE%\.gemini\` 並完成相依套件安裝。

---

## 🧭 技能職責邊界與分流 (Clear Skill Boundaries)

| 任務類型 | 首選技能 | 責任範疇 |
| :--- | :--- | :--- |
| **3D 建模三視圖 / 拆件參考圖** | [`three-view-generator`](file:///C:/Users/Allen.Ko/.gemini/config/skills/three-view-generator/SKILL.md) | 遵循 5 級權威順序、Component Manifest 拆件清單、正/側/背正交規範、3D 體積深度與 13 項品管驗收。 |
| **調用付費網頁訂閱額度** | **`web_token` (本技能)** | 消耗瀏覽器登入之 Gemini Advanced / ChatGPT Plus 額度，執行深度搜尋 (Deep Research)、超長文本推理、全尺寸生圖、帶素材多模態審查與多任務並行。 |

> [!NOTE]
> 若使用者目標是「製作模型三視圖、拆件參考」，一律交由 `three-view-generator` 處理；若目標是「用網頁版額度算圖、做深度研究、帶素材問網頁版」，則調用 `web_token`。

---

## 🔀 雙引擎平台路由 (Platform Routing)

1. **預設平台（Gemini Web）**：
   - 預設調用 `https://gemini.google.com/app`。
   - 享有 Gemini Advanced / Ultra / 2.0 Pro 的超長上下文窗口、Deep Research (深入研究)、Imagen 3/4 高畫質生圖與 Canvas 功能。
   - 觸發詞：`web額度`、`網頁版額度`、`用web額度`、`用gemini額度`、`web深度搜索`、`web生圖`、`帶素材問web`、`web_token`。

2. **切換平台（ChatGPT Web）**：
   - 當使用者明確指示使用 GPT、ChatGPT 帳號時自動切換：
   - 調用 `https://chatgpt.com`，使用 ChatGPT Plus/Pro 額度（o1 / o3-mini 深度思考、Deep Research、DALL-E 3、進階語意分析）。
   - 觸發詞：`用GPT額度`、`用chatgpt額度`、`GPT深度搜索`、`用GPT生圖`、`chatgpt網頁版`。

---

## 🛡️ 核心鐵律 (Core Principles)

### 鐵律一：單一 Chrome 視窗共用 (Single Shared Browser)
- 雙平台一律共用本機 **9222 埠**：
  ```cmd
  C:\Users\Allen.Ko\.gemini\config\tools\gemini-web-bridge\scripts\launch_gemini_chrome.bat
  ```
- 絕不另啟第二個瀏覽器進程或不同 Profile，免除多開視窗與重複登入困擾。

### 鐵律二：有素材必帶過去 (Multimodal Asset Transfer)
- 當使用者提供本地素材（圖片、設定稿、截圖、PDF 文件、代碼檔案）時，**必須將素材實體傳遞至網頁輸入框中**：
  1. 圖片/截圖：透過 PowerShell `Set-Clipboard -LiteralPath` 複製至剪貼簿，於輸入框聚焦後發送 `Control+V`，強制等待預覽載入完成。
  2. 文件/代碼：透過原生檔案上傳選擇器（`setInputFiles`）或結構化貼入輸入框。
- 絕不可只用文字口述要求模型憑空想像素材內容。

### 鐵律三：全模態全功能，不拘泥於生圖 (Omni-Modal Capability)
- 支援四大功能面向：
  - **`deep_research`**：觸發深度搜尋/調研，自動檢索網頁並彙整產出數千至上萬字的研究分析報告。
  - **`chat` / `reasoning`**：調用高階模型進行架構推演、程式碼重構、長篇文本閱讀與深度邏輯分析。
  - **`image`**：調用官方生圖引擎（Imagen 3 或 DALL-E 3），以官方全尺寸下載按鈕獲取原圖，並完成本機校驗落盤。
  - **`multimodal`**：帶素材進行精準以圖生圖、視覺瑕疵分析或設計品管。

### 鐵律四：多重任務獨立分頁並行 (Multi-Tab Concurrency)
- 當使用者一次提出多個任務時（如「同時調研 3 個技術方案」、「同時生成 4 種概念變體」），**嚴禁單分頁排隊等待**。
- 一律為每個任務開啟全新獨立分頁（`context.newPage()`），並行發送、並行等待。

### 鐵律五：任務完成立即關閉分頁 (Mandatory Tab Cleanup)
- 產物擷取完成（文字已擷取、報告已存檔、或圖片已通過驗證落盤）後，**必須立即調用 `page.close()` 關閉該分頁**。
- 嚴格杜絕殘留分頁堆積導致 Chrome 記憶體膨脹或凍結。

### 鐵律六：精準優先，機械語言協議 (Precision Machine Prompting Protocol)
- **發出 Prompt 零語言包袱**：發送給 Gemini Web 或 ChatGPT Web 的提示詞**完全不強制使用中文**，可直接採用全球前沿大模型理解度最高、權重分配最清晰的**高密度英文、結構化 XML 標籤（如 `<task_directive>`, `<context>`, `<constraints>`, `<output_spec>`）、YAML 或虛擬程式碼**。
- **最大化模型推理與檢索精度**：利用結構化標籤明確約束「角色定錨」、「任務目標」、「排除雜訊」、「驗證依據」，徹底消除自然語言敘述的歧義與幻覺。
- **目標輸出語言鎖定**：Prompt 本身使用高密度機械語言/英文以極限釋放模型的算力與工具調用精確度；而在 `<output_spec>` 中明確指定 `<language>Traditional Chinese (繁體中文)</language>`，以確保產出符合使用者的閱讀需求。
- **標準機械語言 Prompt 範本**：
  ```xml
  <task_directive mode="AUTONOMOUS_INVESTIGATION">
    <role>Principal Systems Architect & Technology Analyst</role>
    <objective>Exhaustive investigation into WebGPU architecture state in 2026</objective>
    <requirements>
      - Cross-reference primary sources, official engine roadmaps (Three.js, Babylon.js), and W3C specs
      - Isolate low-level bottlenecks (WGSL shader compilation, memory barriers, mobile thermal throttling)
      - Filter commercial marketing; synthesize raw architectural reality and benchmark data
    </requirements>
    <output_spec>
      - Format: Comprehensive technical report with structured Markdown and architectural diff tables
      - Language: Traditional Chinese (繁體中文)
    </output_spec>
  </task_directive>
  ```

### 鐵律七：預設啟用「延伸思考」模式 (Default Extended Thinking)
- **預設最高思維深度**：在進行文字推理、代碼審查、架構規劃或深度搜尋時，`web_token` **預設一律將思考程度設定為「延伸 (Extended Thinking)」**，以獲得最嚴密、最深入的長鏈思考推理 (CoT)。
- **Gemini Web 自動點選切換**：腳本在開啟 Gemini 分頁後，會自動檢測模式選單（`bard-mode-menu-button`）；若目前非「延伸」模式，自動點開選單切換至「**延伸思考 | 解決複雜問題**」（Flash 延伸 / Pro 延伸），全程零人工介入。
- **ChatGPT Web 自動對齊**：調用 ChatGPT 時，預設使用具備深入思考能力的推理模型（o1 / o3-mini），並於提示詞協議中鎖定高強度推理約束。
- **自適應 Chrome 喚起**：若本機 9222 埠尚未連線，執行器將自動在背景觸發啟動批次檔並進行連線輪詢重試，無需使用者手動點擊。

---

## 🛠️ 執行腳本與使用方式 (Execution Reference)

執行腳本根目錄：`C:\Users\Allen.Ko\.gemini\config\tools\gemini-web-bridge\`

### 1. 通用執行器 `run_web_token.mjs`

支援 CLI 直接派發各類任務：

#### A. 深度搜尋 (Deep Research)
調用 Gemini 或 ChatGPT 網頁版深度研究功能，抓取完整研究報告：
```powershell
node scripts/run_web_token.mjs --provider gemini --mode deep_research --prompt "深度調研 2026 最新 Web 3D 渲染引擎架構演進"
```

#### B. 帶素材提問 / 代碼分析 (Chat with Assets)
自動將素材圖/檔案透過剪貼簿貼入輸入框：
```powershell
node scripts/run_web_token.mjs --provider gemini --mode chat --prompt "分析這張架構圖中的潛在瓶頸與改良建議" --assets "C:\path\to\architecture.png"
```

#### C. 高畫質生圖 / 以圖生圖 (Image Generation)
```powershell
node scripts/run_web_token.mjs --provider gemini --mode image --prompt "A futuristic floating cyberpunk city at dusk, 8k, photorealistic" --output "C:\path\to\output.png"
```
若為以圖生圖，加上 `--assets` 帶入參考圖：
```powershell
node scripts/run_web_token.mjs --provider chatgpt --mode image --prompt "維持附圖畫風，將角色變換為冬季雪地服裝" --assets "C:\path\to\character.png"
```

#### D. 多重任務多分頁並行 (Multi-Tab Parallel Batch)
傳入包含多項任務的 JSON 檔或字串，系統將同步開多個分頁並行作業，各自分別關閉：
```powershell
node scripts/run_web_token.mjs --tasks "C:\path\to\tasks.json"
```

---

## 🔄 標準執行流程 (SOP 5 階段)

```
[使用者指示：深度搜索/帶素材問答/生圖/長文]
      │
      ▼
【階段 1：環境檢查】（檢查 9222 埠，若未啟動則提示執行 launch_gemini_chrome.bat）
      │
      ▼
【階段 2：引擎與模態判定】（預設 Gemini Web；特別指定 GPT 則切換 ChatGPT；判定 chat / deep_research / image）
      │
      ▼
【階段 3：素材裝載與多頁派發】（若有素材，自動注入剪貼簿/附件；多任務並行開立獨立分頁）
      │
      ▼
【階段 4：即時監控與產物擷取】（等待串流完成，擷取完整 Markdown 報告或下載無損原圖）
      │
      ▼
【階段 5：即刻關閉分頁與交付】（調用 page.close() 釋放資源，回傳文字內容或檔案路徑）
```
