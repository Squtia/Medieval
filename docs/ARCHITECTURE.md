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
│   │   ├── RecruitController.ts   # 冒險者酒館招募與動態卡片邏輯
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

- `MapScene` 只負責 Canvas 地圖、相機、節點和動畫；離開 Scene 時必須解除自身監聽並清除 tween。
- `MapController` 負責 DOM 面板、可及性節點清單，以及把 Phaser 的節點點擊轉成 UI 操作。
- `MapPresentation` 放置兩邊共用的純呈現函式，避免 `MapScene` 與 `MapController` 循環依賴。
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
