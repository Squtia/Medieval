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
