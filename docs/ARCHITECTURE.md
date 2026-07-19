# 專案架構 (Architecture)

這份文件概述了 Idle RPG 的系統架構與設計模式。
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
│   │   └── GameLoop.ts      # 遊戲主循環計時器
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
│   └── main.ts              # 測試介面進入點與 DOM 事件監聽
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
