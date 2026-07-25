# 專案架構 (Architecture)

這份文件概述了回合制傭兵團經營 RPG 的系統架構與設計模式。
為了支撐複雜的「據點發展 x 英雄養成 x 戰略戰鬥 x 生存壓力」多系統複合體，本專案採用**事件驅動架構 (Event-Driven Architecture)**。

## 目錄結構
```text
/
├── .agents/                 # AI 行為準則與客製化設定
├── docs/                    # 開發日誌、交接與架構文件
├── src/
│   ├── core/                # 核心驅動引擎
│   │   ├── EventBus.ts      # [核心] 全局事件總線
│   │   ├── GameEvents.ts    # [核心] 事件定義與 Payload 型別
│   │   ├── GameState.ts     # 全局狀態容器與初始化
│   │   ├── GameLoop.ts      # 玩家操作驅動的每日結算流程
│   │   ├── Random.ts        # 可注入、可重現的亂數來源
│   │   ├── Calendar.ts      # 日曆與累計天數換算
│   │   └── SaveMigration.ts # 純函式存檔版本遷移
│   ├── models/              # 核心資料模型 (Data Models, 純粹的資料)
│   │   ├── Adventurer.ts    # 英雄資料與隨機品質/屬性
│   │   ├── Territory.ts     # 領地資料、工作分配與建造設施等級 (Tavern/WeaponShop/ArmorShop/Forge)
│   │   └── ...
│   ├── systems/             # 系統邏輯引擎 (負責監聽與發布事件)
│   │   ├── SettlementSystem.ts # 據點與內政系統
│   │   ├── HeroSystem.ts       # 英雄養成與招募系統
│   │   ├── CombatSystem.ts     # 戰鬥與多波次模擬系統
│   │   ├── ThreatSystem.ts     # 生存壓力與災難系統
│   │   ├── DispatchSystem.ts   # 派遣與任務系統
│   │   ├── MapDynamicsSystem.ts# 地圖動態與派系擴張
│   │   └── DataStore.ts        # 靜態資料庫 (含 1~3 階裝備與價格 DB)
│   ├── ui/                  # DOM UI、Phaser Scene、呈現資料與獨立 UI Controllers
│   │   ├── PhaserManager.ts       # [Lazy Chunk] Phaser 引擎初始化與地圖繪製隔離模組
│   │   ├── ShopController.ts      # [Lazy Chunk] 武器店、防具店與倉庫介面控制
│   │   ├── TradeController.ts     # [Lazy Chunk] 跑商路線規劃與交易介面控制 (備註維護註記)
│   │   ├── RecruitController.ts   # 傭兵酒館招募與動態卡片邏輯
│   │   ├── MainMenuController.ts  # 主選單與存檔欄位渲染
│   │   ├── GameFlowController.ts  # 遊戲流程控制、日誌與選單
│   │   ├── FacilityController.ts  # 建築設施進出、工作分配
│   │   ├── ActionController.ts    # 探索、討伐、進貢與據點遷移
│   │   ├── CheatController.ts     # 開發環境測試密技
│   │   └── ...
│   └── main.ts              # 組合根：系統初始化、事件轉接與 Controller 初始化
├── index.html               # 測試用網頁骨架
└── package.json             # Vite 建置配置檔
```

## 核心設計理念：事件驅動 (Event-Driven)
所有系統之間**互不知道對方存在**，所有跨系統的溝通都必須透過 `EventBus` 進行。

### 資料流向 (Data Flow)
1. **觸發源**：`GameLoop` (時間流逝) 或 `UI` (玩家操作) 呼叫特定的 System 方法或直接發布事件。
2. **事件廣播**：例如 `DispatchSystem` 判定天數增加後，向 `EventBus` 發布 `DAY_PASSED` 事件。
3. **系統響應**：
   - `ThreatSystem` 聽到 `DAY_PASSED` 後推進災難倒數。
   - `SettlementSystem` 聽到 `DAY_PASSED` 後進行資源生產結算。
4. **UI 更新**：`main.ts` 定期呼叫 `UIManager.updateUI()` 或監聽特定狀態改變事件重繪畫面。

### 核心事件列表 (GameEvents)
- `DAY_PASSED`：天數流逝，驅動所有隨時間變化的邏輯 (內政、災難)。
- `HERO_DIED`：英雄死亡，可能觸發士氣下降或任務失敗。
- `COMBAT_REQUESTED` & `COMBAT_FINISHED`：非同步戰鬥結算。
- `THREAT_ARRIVED`：災難降臨，由 `ThreatSystem` 判定發出，各系統承受相應後果。

## 其他設計原則
- **時間戳記結算**：狀態等待不使用 `setInterval` 的逐秒遞減，而是記錄 `endTime`。
- **單向資料流**：`models` 僅放資料結構，狀態修改一律在 `systems` 內透過事件響應完成。

## Phaser 與 DOM 的責任邊界

- `MapScene` 只負責 Canvas 地圖、相機、節點和動畫；依據 `getNodeTextureKey` 載入與繪製繪寫風 Isometric 3/4 俯視角地圖建築圖案（`node_castle`, `node_village` 等）；離開 Scene 時必須解除自身監聽並清除 tween。
- `MapController` 負責 DOM 面板、可及性節點清單，以及把 Phaser 的節點點擊轉成 UI 操作。
- `MapPresentation` 放置兩邊共用的純呈現函式（`getTerrainEmoji`, `getNodeIcon`, `getNodeTextureKey`），避免 `MapScene` 與 `MapController` 循環依賴。
- `Command Crest Hub` (`#command-crest-container`) 為固定於右下角的控制樞紐，統一收納大圓形「結束本日史詩劍盾按鈕」（帶當前天數標記）、相鄰「切換據點/世界地圖」羅盤圓鈕與左側快捷 Dock（包含獨立 `🛡️ 傭兵小隊 Modal` 與 `⚙️ 系統選單`）。
- Phaser 不直接呼叫系統或 Modal；跨邊界使用 `CustomEvent`。系統也不匯入 UI，遊戲事件由 `main.ts` 轉接到視窗。
- 任務狀態變更由 `MISSIONS_CHANGED` 廣播，`main.ts` 再要求 DOM 與 Phaser 重繪；`GameLoop` 不匯入地圖控制器。
- Scene 內的任務效果、商隊和其他 tween 分別持有 reference，只清理各自資源，禁止以 `killAll()` 處理局部更新。
- 戰鬥節點光效由 `combatBeacons: Map<nodeId, CombatBeacon>` 差異化同步；信標疊在節點圖示上並循環播放插劍，地圖重繪會保留既有 tween，任務完成後才整體淡出並銷毀。

## 行商狀態模型

- `tradeItineraryNodeIds` 是不可變的完整停靠順序，不可用清空陣列代表回程。
- `tradePhase` 明確區分 `OUTBOUND` 與 `RETURNING`，`currentLegIndex` 指向目前路段。
- `normalizeTradeTask` 在派遣與讀檔時將舊版 `tradeRouteNodeIds/currentRouteIndex` 轉為新模型；舊回程任務可從 `tradeInstructions` 重建 itinerary。
- 地圖線段由 `buildTradeRouteSegments` 純函式產生，第一段與回程段皆可單獨測試。

## 可重現性與儲存相容

- 所有遊戲亂數經由 `Random`；測試可注入 `SeededRandomSource`，執行後必須 reset。
- 存檔帶有 `schemaVersion`。讀檔先通過 `migrateSaveData`，再重建 class instance 與系統訂閱。
- 日曆顯示值與 `totalDays` 同時保存；市場等長期模擬以單調遞增的 `totalDays` 為準。

## 品質閘門

本機與 CI 統一執行 `npm run check`：型別檢查、Vitest、production build 與 JS bundle budget。新系統應至少涵蓋成功、失敗及存檔遷移中的相關邊界案例。

## 事件與敘事系統 (Narrative Design)

為了實現「碎片化」與「湧現式」的故事體驗，避免過度依賴死板的線性腳本或外部 JSON 解析，本專案在擴充敘事內容時，推薦採用以下兩種架構理念交錯使用：

### 1. 故事牌組與標籤系統 (Story Deck & Tag System)
- **概念**：類似《Stellaris》的事件池。放棄寫死的事件樹 (Event A -> Event B)，改為讓實體 (領地、傭兵、全域狀態) 帶有「標籤 (Tags)」或「記憶 (Memories)」。
- **運作方式**：系統每回合從事件池中「抽卡」，判斷當前是否存在符合特定標籤組合的情境（例如：`[cursed]` 且 `[low_morale]`）。符合則觸發事件。
- **優勢**：極度適合碎片化敘事，玩家每次遊玩的遭遇順序與故事發展皆可能不同，且擴充事件不需修改舊邏輯，只需定義新標籤。

### 2. 傳聞與調查系統 (Rumors & Investigation)
- **概念**：將被動的彈窗事件實體化為酒館裡的「傳聞」或地圖上的「調查點」。
- **運作方式**：當特定條件滿足時，不直接跳出事件，而是生成一則傳聞。玩家需主動花費資源或指派「派遣任務 (DispatchTask)」去調查。調查結束後，透過帶回的線索道具或全域 Flag 來解鎖後續傳聞。
- **優勢**：賦予玩家高度的主動權，將敘事與核心的「傭兵派遣經營」玩法完美融合。

>### 3. 開發規範 (Development Guidelines)
- 在加入新事件時，**不要**尋找外部 JSON 編輯器工具。請直接在程式碼中撰寫 `GameEvent` 陣列（如 `EventData.ts`），這能保持型別安全並降低維護成本。
- 若事件文字量過大，可將純文字分離為獨立的 TypeScript 常數檔案再引入。
# 專案架構 (Architecture)

這份文件概述了回合制傭兵團經營 RPG 的系統架構與設計模式。
為了支撐複雜的「據點發展 x 英雄養成 x 戰略戰鬥 x 生存壓力」多系統複合體，本專案採用**事件驅動架構 (Event-Driven Architecture)**。

## 目錄結構
```text
/
├── .agents/                 # AI 行為準則與客製化設定
├── docs/                    # 開發日誌、交接與架構文件
├── src/
│   ├── core/                # 核心驅動引擎
│   │   ├── EventBus.ts      # [核心] 全局事件總線
│   │   ├── GameEvents.ts    # [核心] 事件定義與 Payload 型別
│   │   ├── GameState.ts     # 全局狀態容器與初始化
│   │   ├── GameLoop.ts      # 玩家操作驅動的每日結算流程
│   │   ├── Random.ts        # 可注入、可重現的亂數來源
│   │   ├── Calendar.ts      # 日曆與累計天數換算
│   │   └── SaveMigration.ts # 純函式存檔版本遷移
│   ├── models/              # 核心資料模型 (Data Models, 純粹的資料)
│   │   ├── Adventurer.ts    # 英雄資料與隨機品質/屬性
│   │   ├── Territory.ts     # 領地資料、工作分配與建造設施等級 (Tavern/WeaponShop/ArmorShop/Forge)
│   │   └── ...
│   ├── systems/             # 系統邏輯引擎 (負責監聽與發布事件)
│   │   ├── SettlementSystem.ts # 據點與內政系統
│   │   ├── HeroSystem.ts       # 英雄養成與招募系統
│   │   ├── CombatSystem.ts     # 戰鬥與多波次模擬系統
│   │   ├── ThreatSystem.ts     # 生存壓力與災難系統
│   │   ├── DispatchSystem.ts   # 派遣與任務系統
│   │   ├── MapDynamicsSystem.ts# 地圖動態與派系擴張
│   │   └── DataStore.ts        # 靜態資料庫 (含 1~3 階裝備與價格 DB)
│   ├── ui/                  # DOM UI、Phaser Scene、呈現資料與獨立 UI Controllers
│   │   ├── PhaserManager.ts       # [Lazy Chunk] Phaser 引擎初始化與地圖繪製隔離模組
│   │   ├── ShopController.ts      # [Lazy Chunk] 武器店、防具店與倉庫介面控制
│   │   ├── TradeController.ts     # [Lazy Chunk] 跑商路線規劃與交易介面控制 (備註維護註記)
│   │   ├── RecruitController.ts   # 傭兵酒館招募與動態卡片邏輯
│   │   ├── MainMenuController.ts  # 主選單與存檔欄位渲染
│   │   ├── GameFlowController.ts  # 遊戲流程控制、日誌與選單
│   │   ├── FacilityController.ts  # 建築設施進出、工作分配
│   │   ├── ActionController.ts    # 探索、討伐、進貢與據點遷移
│   │   ├── CheatController.ts     # 開發環境測試密技
│   │   └── ...
│   └── main.ts              # 組合根：系統初始化、事件轉接與 Controller 初始化
├── index.html               # 測試用網頁骨架
└── package.json             # Vite 建置配置檔
```

## 核心設計理念：事件驅動 (Event-Driven)
所有系統之間**互不知道對方存在**，所有跨系統的溝通都必須透過 `EventBus` 進行。

### 資料流向 (Data Flow)
1. **觸發源**：`GameLoop` (時間流逝) 或 `UI` (玩家操作) 呼叫特定的 System 方法或直接發布事件。
2. **事件廣播**：例如 `DispatchSystem` 判定天數增加後，向 `EventBus` 發布 `DAY_PASSED` 事件。
3. **系統響應**：
   - `ThreatSystem` 聽到 `DAY_PASSED` 後推進災難倒數。
   - `SettlementSystem` 聽到 `DAY_PASSED` 後進行資源生產結算。
4. **UI 更新**：`main.ts` 定期呼叫 `UIManager.updateUI()` 或監聽特定狀態改變事件重繪畫面。

### 核心事件列表 (GameEvents)
- `DAY_PASSED`：天數流逝，驅動所有隨時間變化的邏輯 (內政、災難)。
- `HERO_DIED`：英雄死亡，可能觸發士氣下降或任務失敗。
- `COMBAT_REQUESTED` & `COMBAT_FINISHED`：非同步戰鬥結算。
- `THREAT_ARRIVED`：災難降臨，由 `ThreatSystem` 判定發出，各系統承受相應後果。

## 其他設計原則
- **時間戳記結算**：狀態等待不使用 `setInterval` 的逐秒遞減，而是記錄 `endTime`。
- **單向資料流**：`models` 僅放資料結構，狀態修改一律在 `systems` 內透過事件響應完成。

## Phaser 與 DOM 的責任邊界

- `MapScene` 只負責 Canvas 地圖、相機、節點和動畫；依據 `getNodeTextureKey` 載入與繪製繪寫風 Isometric 3/4 俯視角地圖建築圖案（`node_castle`, `node_village` 等）；離開 Scene 時必須解除自身監聽並清除 tween。
- `MapController` 負責 DOM 面板、可及性節點清單，以及把 Phaser 的節點點擊轉成 UI 操作。
- `MapPresentation` 放置兩邊共用的純呈現函式（`getTerrainEmoji`, `getNodeIcon`, `getNodeTextureKey`），避免 `MapScene` 與 `MapController` 循環依賴。
- `Command Crest Hub` (`#command-crest-container`) 為固定於右下角的控制樞紐，統一收納大圓形「結束本日史詩劍盾按鈕」（帶當前天數標記）、相鄰「切換據點/世界地圖」羅盤圓鈕與左側快捷 Dock（包含獨立 `🛡️ 傭兵小隊 Modal` 與 `⚙️ 系統選單`）。
- Phaser 不直接呼叫系統或 Modal；跨邊界使用 `CustomEvent`。系統也不匯入 UI，遊戲事件由 `main.ts` 轉接到視窗。
- 任務狀態變更由 `MISSIONS_CHANGED` 廣播，`main.ts` 再要求 DOM 與 Phaser 重繪；`GameLoop` 不匯入地圖控制器。
- Scene 內的任務效果、商隊和其他 tween 分別持有 reference，只清理各自資源，禁止以 `killAll()` 處理局部更新。
- 戰鬥節點光效由 `combatBeacons: Map<nodeId, CombatBeacon>` 差異化同步；信標疊在節點圖示上並循環播放插劍，地圖重繪會保留既有 tween，任務完成後才整體淡出並銷毀。

## 行商狀態模型

- `tradeItineraryNodeIds` 是不可變的完整停靠順序，不可用清空陣列代表回程。
- `tradePhase` 明確區分 `OUTBOUND` 與 `RETURNING`，`currentLegIndex` 指向目前路段。
- `normalizeTradeTask` 在派遣與讀檔時將舊版 `tradeRouteNodeIds/currentRouteIndex` 轉為新模型；舊回程任務可從 `tradeInstructions` 重建 itinerary。
- 地圖線段由 `buildTradeRouteSegments` 純函式產生，第一段與回程段皆可單獨測試。

## 可重現性與儲存相容

- 所有遊戲亂數經由 `Random`；測試可注入 `SeededRandomSource`，執行後必須 reset。
- 存檔帶有 `schemaVersion`。讀檔先通過 `migrateSaveData`，再重建 class instance 與系統訂閱。
- 日曆顯示值與 `totalDays` 同時保存；市場等長期模擬以單調遞增的 `totalDays` 為準。

## 品質閘門

本機與 CI 統一執行 `npm run check`：型別檢查、Vitest、production build 與 JS bundle budget。新系統應至少涵蓋成功、失敗及存檔遷移中的相關邊界案例。

## 事件與敘事系統 (Narrative Design)

為了實現「碎片化」與「湧現式」的故事體驗，避免過度依賴死板的線性腳本或外部 JSON 解析，本專案在擴充敘事內容時，推薦採用以下兩種架構理念交錯使用：

### 1. 故事牌組與標籤系統 (Story Deck & Tag System)
- **概念**：類似《Stellaris》的事件池。放棄寫死的事件樹 (Event A -> Event B)，改為讓實體 (領地、傭兵、全域狀態) 帶有「標籤 (Tags)」或「記憶 (Memories)」。
- **運作方式**：系統每回合從事件池中「抽卡」，判斷當前是否存在符合特定標籤組合的情境（例如：`[cursed]` 且 `[low_morale]`）。符合則觸發事件。
- **優勢**：極度適合碎片化敘事，玩家每次遊玩的遭遇順序與故事發展皆可能不同，且擴充事件不需修改舊邏輯，只需定義新標籤。

### 2. 傳聞與調查系統 (Rumors & Investigation)
- **概念**：將被動的彈窗事件實體化為酒館裡的「傳聞」或地圖上的「調查點」。
- **運作方式**：當特定條件滿足時，不直接跳出事件，而是生成一則傳聞。玩家需主動花費資源或指派「派遣任務 (DispatchTask)」去調查。調查結束後，透過帶回的線索道具或全域 Flag 來解鎖後續傳聞。
- **優勢**：賦予玩家高度的主動權，將敘事與核心的「傭兵派遣經營」玩法完美融合。

>### 3. 開發規範 (Development Guidelines)
- 在加入新事件時，**不要**尋找外部 JSON 編輯器工具。請直接在程式碼中撰寫 `GameEvent` 陣列（如 `EventData.ts`），這能保持型別安全並降低維護成本。
- 若事件文字量過大，可將純文字分離為獨立的 TypeScript 常數檔案再引入。
- 善用 AI 的溝通模板，要求 AI 以特定的 `GameEvent` 結構直接產出故事腳本。

## 據點官職與首都系統 (Node-based Office & Capital System)

本專案摒棄了傳統戰略遊戲中「爵位直接給予全域官職數量」的作法，改採**據點獨立制 (Node-based)**：
- **本地職缺 (Local Slots)**：爵位 (Noble Title) 僅負責解鎖「單一據點可配置的最高職缺數」。例如：公爵在擁有的 A 據點可任命 1 名城主，在 B 據點也可獨立任命另一名城主。
- **派駐關聯 (Stationing)**：傭兵的官職資料不僅記錄其階級，更綁定 `stationedNodeId`，確保邏輯與地圖節點緊密結合。
- **首都與唯一性榮譽 (Capital Tag & Unique Honors)**：透過在 `MapNode` 新增 `isCapital` 標籤，玩家必須行使權力「冊封首都」，方可解鎖全域唯一的最高榮譽（如：方旗騎士）。轉移首都時，系統會自動解任前朝的專屬官員，確保系統簡潔並增添扮演感。

## 外交與攻城系統 (Diplomacy & Siege Systems)

- **AI 派系性格與關係 (AI Factions)**：AI 派系具備不同的性格 (`FactionPersonality`)，並會隨著 `MapDynamicsSystem` 每日/每月動態隨機改變與其他派系及玩家的好感度。關係過低會導致自動宣戰 (`atWarWith`)。
- **動態攻城戰 (Dynamic Sieges)**：AI 發動擴張時，若目標為敵對勢力據點，將改為發起「攻城戰 (`siegeData`)」。攻城戰需耗時數天，每日於 `simulateDailyMapDynamics` 中倒數。倒數結束後，若為玩家據點，則扣除繁榮度並警告；若是 AI 據點則轉移擁有權。
- **獨立 UI 模組**：外交面板透過 `DiplomacyController.ts` 獨立實作，支援贈禮、求和、宣戰等指令。透過右下角 Command Crest Hub 開啟，將複雜的外交操作封裝並透過 `EventBus` 與核心系統互動。
