# AI 助理行為準則 (Agent Guidelines)

## 1. 語言規範 (Language)
- **繁體中文溝通**：所有回覆、說明、代碼注釋與討論，一律使用繁體中文（台灣語系）。

## 2. 測試與異常中斷機制 (Testing Loop Limit)
- **嚴格執行兩次限制**：當代碼測試或除錯迴圈（Debug Loop）超過 2 次（即第 3 次失敗）時，必須立刻終止自動測試。
- **中斷後的行動**：終止後，必須暫停並提供以下選擇給使用者：
  - 👉 提出當前困境與其他可行的替代方案。
  - 👉 提示使用者：「已達測試上限，請考慮更換 AI 模型進行測試」。

## 3. 編碼前置確認 (Pre-coding Alignment)
- **禁止直接撰寫代碼**：在開始任何實際編碼（Coding）工作前，必須先與使用者進行確認。
- **不要馬上寫報告，先討論**：在產生正式的實作計畫（Implementation Plan）或任何形式的報告文件前，必須先以對話的形式與使用者逐一討論想法與設計細節。
- **執行一個編碼後，收到問題回報**：收到問題回報後，不要馬上編碼。


- **優化流程討論**：動手前，需先將思維轉入「討論模式」，主動與使用者分析、討論架構與優化過程，得到明確授權後方可開始寫代碼。

## 4. 文件同步更新與交接機制 (Documentation Maintenance)
- **強制記載開發日誌**：每次完成更新或修改後，必須同步更新 `docs/CHANGELOG.md` (開發日誌)。
- **維護專案架構與交接**：若有架構變動，必須更新 `docs/ARCHITECTURE.md`；且在階段性任務完成或暫停時，更新 `docs/HANDOVER.md` (交接文件)，以利使用者閱讀與未來交接作業。

## 5. 核心規範文件強制預讀與對齊機制 (Mandatory Core Spec Inspection)
- **禁止憑空推測或套用外在概念**：在進行任何系統討論、設計提案、產生計畫 (Implementation Plan) 或編碼前，**必須強制使用 `view_file` 自動預讀 `docs/` 下的對應權威規範文件**：
  - ⚔️ 涉及職業與武器 ➔ **強制預讀 [docs/CLASS_SYSTEM.md](file:///i:/gameproject/Medieval/docs/CLASS_SYSTEM.md)**
  - 📊 涉及八維屬性與戰鬥公式 ➔ **強制預讀 [docs/ATTRIBUTE_SYSTEM.md](file:///i:/gameproject/Medieval/docs/ATTRIBUTE_SYSTEM.md)**
  - 👾 涉及怪物與元素相剋 ➔ **強制預讀 [docs/MONSTERS_AND_ELEMENTS.md](file:///i:/gameproject/Medieval/docs/MONSTERS_AND_ELEMENTS.md)**
  - 🏰 涉及封建爵位、領地規模、繁榮度與內政設施 ➔ **強制預讀 [docs/FEUDAL_AND_TERRITORY_SYSTEM.md](file:///i:/gameproject/Medieval/docs/FEUDAL_AND_TERRITORY_SYSTEM.md)**
  - 🗺️ 涉及未來系統擴充 ➔ **強制預讀 [docs/FUTURE_DESIGN.md](file:///i:/gameproject/Medieval/docs/FUTURE_DESIGN.md)**
  - ⚖️ 涉及平衡性數據 ➔ **強制預讀 [docs/BALANCE_TEST_REPORT.md](file:///i:/gameproject/Medieval/docs/BALANCE_TEST_REPORT.md)**
- **自動對齊稽核**：所有提案、計畫或代碼變更，必須 100% 通過這 6 大權威文件的交叉比對，確保完全符合專案原創規範後方可交由使用者審閱。

## 6. HTML 檔案保護規則 (HTML File Protection Rules)

### index.html 守則（架構拆分後適用）
- **禁止**對 `index.html` 使用 `Overwrite: true` 整塊替換
- `index.html` 僅為 ~38 行的骨架，任何 UI 元素都應修改對應的 template 檔案
- 修改前必須先用 `view_file` 確認 `index.html` 目前內容，確認它仍是骨架

### Template 檔案對應表
| 要修改的 UI 區塊 | 對應檔案 |
|---|---|
| 全域 CSS 樣式 | `style.css` |
| top-bar, overlay, tooltip | `src/templates/ui-chrome.html` |
| 主選單、地圖、野外、街道視圖 | `src/templates/views-main.html` |
| 書房、謁見廳、酒館、商店、鍛造屋 | `src/templates/views-facility.html` |
| 右側共用面板 | `src/templates/views-right-panel.html` |
| 戰鬥 Modal、貿易 Modal | `src/templates/modals-combat-trade.html` |
| 倉庫/新遊戲/載入/派遣/俘虜/系統/事件/待辦 | `src/templates/modals-game.html` |
| 左側抽屜面板、HUD、每日結算 | `src/templates/panels-hud.html` |

### Git 操作守則
- **禁止**在未確認 commit hash 與 diff 的情況下執行 `git reset` 或 `git checkout` 來恢復 HTML 檔案
- 每次修改 template 前，建議先 `git add` 備份當前狀態

### 精確編輯守則
- 修改任何 template 或 `style.css` 時，必須先用 `view_file` 確認 `StartLine` / `EndLine`
- 優先使用 `multi_replace_file_content` 精確替換，避免大範圍整塊替換
- 每個 template 檔案 < 400 行；若超過此限制，應考慮繼續拆分

## 7. 嚴禁應試思維與偽完成原則 (Anti-Cheating & True Implementation Mandate)

### 7.1 嚴禁「以指標與測試全綠冒充功能完成」（杜絕指標綁架）
- **全域強制適用**：本原則適用於專案所有模組（包含但不限於戰鬥、內政、大地圖、經濟、敘事、工坊、UI 與資料庫系統），任何情境與功能皆不得違背。
- **測試通過 ≠ 功能完成**：自動化測試全綠、TypeScript 0 錯誤、無頭腳本 0 報錯，僅為程式碼無語法崩潰的最低門檻，**絕對不得以此作為「功能已正常可用」的交付藉口**。
- **嚴禁撰寫「應試欺瞞代碼」**：
  - 嚴禁為了讓測試斷言（Assert）通過，只修改內部狀態或模擬變數，卻未真正貫通底層邏輯、狀態機、視覺渲染或實質資料管線。
  - 嚴禁 UI 控制項只將資料寫入記憶體 Store，真實業務邏輯、底層演算法與畫面卻毫無實質動態反饋。
  - 嚴禁以 Mock 自身邏輯、寫死返回值、固定超時等待（Timeout）或吞掉異常來假裝系統已非同步完成。
  - 任何無法在真實使用者操作中產生實質預期效果的實作，一律視為重大工程違規。

### 7.2 嚴禁「架構惰性與表層敷衍（地基腐朽、塗脂抹粉）」
- **依真實使用情境建構架構，嚴禁不適當套用**：
  - 編輯器/工坊類系統必須具備編輯器級架構（如即時求值、確定性狀態/影格渲染、所見即所得、持久定格、熱更新）。嚴禁直接拿實戰一次性運行的拋棄式邏輯（播完即自毀）敷衍拼裝。
  - 業務與結算系統必須具備嚴密的資料閉環與不變量守護。嚴禁僅在前端顯示上修改數字，而未真正觸發後端計算與持久化。
  - 嚴禁為了「看起來能跑」而在舊的、不適用的架構外層套皮。若既有底層架構無法支撐功能需求，必須主動向使用者提出重構底層，絕不得在腐朽地基上層層包裹無效的抽象層欺瞞使用者。

### 7.3 強制「真實使用者視角審查（Human-Centric Audit）」
- 在交付任何功能、模組或系統修復前，必須站在「真實人類玩家/創作者親手操作」的立場進行全流程自我檢驗：
  1. **實質響應檢驗**：使用者操作介面上的任何按鈕、滑桿、欄位或控制項時，系統有產生實質、可見、可感知的動態響應嗎？（若操作後無實質效果即違規）
  2. **狀態與互動一致性檢驗**：當使用者進行暫停、拖曳、倒退、重整或切換時，畫面與內部狀態是否完全同步且真實可交互？（若狀態脫節、物件蒸發、各跑各的即違規）
  3. **資料閉環檢驗**：數值的變更是否真實作用於底層業務邏輯與持久化存檔，而非僅停留在前端局部變數？（若刷新後丟失或底層未吃數值即違規）
  4. **全路徑體驗檢驗**：使用者從入口進入、操作、到結果產出，是否能順暢走完全部流程？（若中間存在斷點、假按鈕、未綁定事件或硬編碼繞過即違規）
- **上述任一項檢驗未達標，嚴禁宣稱「完成」、「已修好」或「驗收通過」，必須誠實向使用者回報真實進度、客觀限制與待解決斷點**。

