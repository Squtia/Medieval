---
name: memory_copilot
description: 雙引擎記憶領航員 (Memory Copilot)。專門依據當前開發情境，智慧調度與導航 Headroom (動態上下文/CCR壓縮) 與 codebase-memory (靜態代碼知識圖譜/AST呼叫鏈) 兩大 MCP 伺服器。當使用者說「記憶導航」、「記憶助手」、「MCP怎麼用」、「記憶MCP」、「壓縮上下文」、「分析代碼庫」、「合體記憶」、「上下文太長」或「memory_copilot」時自動觸發。本技能會分析目前任務狀態，主動判斷應「單獨使用 Headroom」、「單獨使用 codebase-memory」或「雙層合體使用」，並主動提供可直接執行的指令與架構落地建議。
license: MIT
metadata:
  version: "1.0"
  author: Antigravity Assistant
---

# 雙引擎記憶領航員 (Memory Copilot)

本技能作為 **Headroom MCP**（動態對話上下文 / CCR 快取壓縮）與 **codebase-memory MCP**（靜態代碼知識圖譜 / AST 呼叫鏈）的智慧中樞與引航指南。

使用者常常在開發過程中忘記有哪些 MCP 工具或不知何時該用何者。本技能的職責是：
1. **依據目前對話與任務階段**，自動給出最佳使用建議。
2. **判斷調度模式**：單獨使用 Headroom、單獨使用 codebase-memory、或雙層合體。
3. **主動發起提醒**：當對話過長、大量日誌產生、或即將進行重大重構時，主動在回覆末端提示可採用的記憶操作。

---

## 觸發詞 (Trigger Phrases)
* 「記憶導航」
* 「記憶助手」
* 「MCP怎麼用」
* 「記憶MCP」
* 「壓縮上下文」
* 「上下文太長」
* 「分析代碼庫」
* 「合體記憶」
* 「memory_copilot」

---

## 1. 雙引擎核心定位與分工原則

| 維度 | Headroom MCP | codebase-memory MCP |
| :--- | :--- | :--- |
| **核心職責** | **動態對話上下文 (Dynamic Session Context)** | **靜態專案知識資產 (Static Code Knowledge)** |
| **處理對象** | 聊天歷史、大型除錯日誌、長篇推理、工具輸出 | 原始碼、AST 語法樹、函式呼叫圖、API 路由、ADR |
| **運作機制** | **CCR (Cache-Compress-Retrieve)**<br/>本地快取全文，對話僅留精簡摘要與 Hash | **Code Graph (LSP + BM25 + Vector)**<br/>將符號與依賴存入 `.codebase-memory/graph.db.zst` |
| **解決痛點** | 對話輪次太多導致 Token 暴增、LLM 遺忘初期細節 | 盲目 grep、翻找數百個檔案找函式、不知道改動影響誰 |
| **核心工具** | `headroom_compress`<br/>`headroom_retrieve`<br/>`headroom_stats` | `index_repository`<br/>`search_graph`<br/>`query_graph`<br/>`get_architecture`<br/>`trace_path` |

---

## 2. 智慧情境判定與模式路由

當使用者呼叫本技能，或 Agent 評估當前對話狀態時，按以下 3 種情境路由：

```
                              [當前需求 / 對話狀態分析]
                                         │
       ┌─────────────────────────────────┼─────────────────────────────────┐
       ▼                                 ▼                                 ▼
【情境 A：對話過長 / 雜訊爆發】   【情境 B：專案探索 / 安全重構】   【情境 C：里程碑達成 / 準備結案】
       │                                 │                                 │
       ▼                                 ▼                                 ▼
[模式 1: 單獨使用 Headroom]     [模式 2: 單獨使用 codebase-memory]     [模式 3: 雙層合體使用]
- 大型編譯/測試日誌瘦身          - 首次接手新專案梳理結構            - 決策沉澱至 ADR / 圖譜
- 長對話精華打包成 Hash          - 語意搜尋實作函式 (免grep)        - 對話歷程打包成 Hash
- 跨 Session 零包袱接續          - 函式呼叫鏈追蹤與衝擊分析          - 新對話秒速無縫喚醒
```

### 模式 1：單獨使用 Headroom (情境 A)
* **適用時機**：
  - 剛執行單元測試或 build，終端機輸出上千行日誌。
  - 對話累積超過 15 輪以上，Prompt Token 達到臨界值。
  - 需要將目前的複雜除錯記錄先「冰凍」，稍後可能查閱。
* **推薦使用者輸入語句**：
  > 「這份日誌/對話太長了，幫我用 Headroom 壓縮存檔，只留下關鍵報錯重點與 Hash。」
* **Agent 執行動作**：
  1. 呼叫 `headroom_compress(content=...)`。
  2. 回傳壓縮精簡摘要與對應的 `hash=...`。
  3. 提示使用者：「未來需要看完整細節時，直接說『用 hash=... 還原細節』即可」。

---

### 模式 2：單獨使用 codebase-memory (情境 B)
* **適用時機**：
  - 進入新的專案目錄或工作區。
  - 需要尋找特定業務邏輯實作（如「找付款驗證的路由」），但不確定檔名。
  - 準備修改共用函式，需要做「Surgical Changes」影響範圍評估。
* **推薦使用者輸入語句**：
  > 「幫我用 codebase-memory 索引這個專案，並分析整體模組架構。」
  > 「在代碼圖譜中搜尋所有跟『使用者認證』相關的函式與呼叫路徑。」
* **Agent 執行動作**：
  1. 呼叫 `index_repository(repo_path="...", mode="full")`（若未索引）。
  2. 呼叫 `get_architecture` 或 `search_graph` 進行語意導航。
  3. 若需視覺化，主動引導搭配 `/archify` 生成架構圖。

---

### 模式 3：雙層合體使用 (Two-Tier Memory) (情境 C)
* **適用時機**：
  - 一個完整功能或架構重構剛討論並驗證完畢。
  - 準備結束當前 Session，打算開新對話接續後續工作。
  - 希望將「思考與決策結果」永久保留給專案，但「討論雜訊過程」丟進快取。
* **推薦使用者輸入語句**：
  > 「請幫我把這次對話的架構決策沉澱至專案 ADR，並用 codebase-memory 更新索引；同時把完整對話脈絡用 Headroom 壓縮打包成一組 Hash。」
* **Agent 執行動作**：
  1. **沉澱資產**：將架構結論寫入專案 `ARCHITECTURE.md` 或呼叫 `manage_adr` 記錄。
  2. **圖譜入庫**：呼叫 `index_repository`，更新專案圖譜資料庫。
  3. **動態打包**：呼叫 `headroom_compress`，將本次對話進度壓成 Hash。
  4. **交付指示**：告知使用者：「*下次開全新對話時，只需輸入『讀取 Headroom hash=xxxx，並以當前代碼圖譜接續』即可秒速接工。*」

---

## 3. Agent 主動引導與提醒規則 (Proactive Nudges)

當本技能掛載時，Agent 在日常對話中應具備以下「主動洞察」行為（符合 Harmonized Next Steps 規範）：

1. **偵測到巨大輸出時**：
   - 當終端指令輸出超過 100 行或讀取巨大 JSON/Log 時，在回覆末端主動提示：
     > 「💡 **上下文優化提醒**：終端日誌較長，隨時可告訴我『*用 Headroom 壓縮剛才的 log*』釋放 Token。」
2. **偵測到未索引的專案代碼搜尋時**：
   - 當使用者在大型專案要求「找某某功能在哪裡」且專案尚未建立圖譜時，主動提示：
     > 「💡 **代碼圖譜提醒**：目前為本機 grep 搜尋，可輸入『*為專案建立 codebase-memory 索引*』以獲得毫秒級語意搜尋與呼叫鏈追蹤。」
3. **對話告一段落或任務完成時**：
   - 在交付成果或 Walkthrough 後，主動提示：
     > 「💡 **進度封存建議**：本任務已驗證完成，可說『*合體打包本次進度*』將決策寫入圖譜並用 Headroom 生成接續 Hash。」

---

## 4. 常用速查指令卡 (Cheat Sheet)

```bash
# 終端機常用查詢
headroom savings       # 查看累計節省 Token 與費用
headroom dashboard     # 開啟本機瀏覽器視覺化節省圖表
headroom doctor        # 檢查 MCP 與代理服務狀態

# 對話語句速查
「幫我用 Headroom 壓縮這段日誌」           -> 觸發 headroom_compress
「用 Hash 還原剛才的詳細內容」              -> 觸發 headroom_retrieve
「建立目前專案的代碼圖譜索引」              -> 觸發 index_repository
「分析模組依賴與呼叫鏈」                   -> 觸發 query_graph / trace_path
「合體打包本次對話與代碼進度」              -> 觸發 雙層記憶閉環
```
