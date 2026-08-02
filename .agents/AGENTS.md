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
  - 🗺️ 涉及未來系統擴充 ➔ **強制預讀 [docs/FUTURE_DESIGN.md](file:///i:/gameproject/Medieval/docs/FUTURE_DESIGN.md)**
  - ⚖️ 涉及平衡性數據 ➔ **強制預讀 [docs/BALANCE_TEST_REPORT.md](file:///i:/gameproject/Medieval/docs/BALANCE_TEST_REPORT.md)**
- **自動對齊稽核**：所有提案、計畫或代碼變更，必須 100% ผ่าน這 5 大權威文件的交叉比對，確保完全符合專案原創規範後方可交由使用者審閱。
