# 開發 Workflow

## 每個功能的完成條件

1. 先把規則寫成純資料或純函式，隨機行為只能使用 `Random`。
2. System 改變 `GameState` 並發布 typed event；UI 不得被 System 直接匯入。
3. Phaser 僅處理地圖呈現與輸入，DOM 僅處理面板；共用呈現邏輯放在 `MapPresentation`。
4. 新增成功、失敗及邊界測試；若改存檔欄位，同步提升 schema 並新增 legacy fixture。
5. 執行 `npm run check`，再用瀏覽器檢查 1280×720 與 720×720 的主選單、地圖、派遣、結束本日和存讀檔流程。
6. 更新 `CHANGELOG.md`；架構或交接資訊有改動時同步更新對應文件。

## 建議分支與 PR 節奏

- 一個 PR 只包含一個玩家可描述的改變，例如「備災系統」或「派遣風險預覽」。
- PR 說明列出：玩家行為、規則變化、存檔影響、UI 截圖、測試結果。
- CI 的 `npm run check` 必須通過；bundle 超過預算時，先拆分依賴或資產再合併。

## 下一輪優先順序

1. [x] P0：為新遊戲→據點→派遣→結束本日→存讀檔加入自動化瀏覽器 smoke test。（已實裝 `npm run test:smoke`）
2. P1：拆分 `main.ts` 的 UI wiring，依據畫面建立 controller，降低單檔耦合。
3. P1：將 Phaser 及低頻建築介面做真正的 lazy chunk，縮短首次載入時間。
4. P2：建立 3／10／30 日 seeded 模擬，監控資源淨值、任務成功率與災害損失。

## 任務與 Phaser 更新規則

- 任務出發、推進、完成或載入時發布 `MISSIONS_CHANGED`，由 UI 組合層刷新地圖。
- 行商完整路線不可變；只能修改 `tradePhase`、`currentLegIndex` 與 `remainingDays`。
- Phaser 局部重繪只能移除該功能持有的 tween／timer，不可呼叫全域 `killAll()` 或 `removeAllEvents()`。
- 一般招募必須使用 `getRandomRecruitTrait()`；`getRandomTrait()` 不可用於玩家取得角色的流程。
