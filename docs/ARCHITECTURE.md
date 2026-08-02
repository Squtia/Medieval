# 專案架構 (Architecture)

這份文件概述了回合制傭兵團經營 RPG 的系統架構與設計模式。
為了支撐複雜的「據點發展 x 英雄養成 x 戰略戰鬥 x 生存壓力」多系統複合體，本專案採用**事件驅動架構 (Event-Driven Architecture)**。

## 目錄結構
```text
/
├── .agents/                 # AI 行為準則與客製化設定
├── docs/                    # 開發日誌、交接、未來擴充藍圖與架構文件
│   ├── FUTURE_DESIGN.md     # [核心藍圖] 未來 7 大系統擴充規範與程式碼引用總覽
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
│   │   ├── Exploration.ts   # 探索進度與視野迷霧資料
│   │   ├── Road.ts          # 道路網路資料
│   │   └── ...
│   ├── systems/             # 系統邏輯引擎 (負責監聽與發布事件)
│   │   ├── SettlementSystem.ts # 據點與內政系統
│   │   ├── HeroSystem.ts       # 英雄養成與招募系統
│   │   ├── CombatSystem.ts     # 戰鬥與多波次模擬系統
│   │   ├── ThreatSystem.ts     # 生存壓力與災難系統
│   │   ├── DispatchSystem.ts   # 派遣與任務系統
│   │   ├── RoadSystem.ts       # [核心] 道路樹狀網絡、智慧自然分岔 (Node/Curve Branching) 與圖連通度
│   │   ├── MapDynamicsSystem.ts# 地圖動態與派系擴張
│   │   ├── ExplorationSystem.ts# 地圖探索與視野解鎖系統 (支援多隊容量、急行與資源計算)
│   │   └── DataStore.ts        # 靜態資料庫 (含 1~3 階裝備與價格 DB)
│   ├── data/                # 靜態與平衡性資料
│   │   ├── BalanceData.ts   # 全域平衡性常數配置
│   │   └── DifficultyData.ts# 遊戲難度設定與補正參數
│   ├── ui/                  # DOM UI、Phaser Scene、呈現資料與獨立 UI Controllers
│   │   ├── PhaserManager.ts       # [Lazy Chunk] Phaser 引擎初始化與地圖繪製隔離模組
│   │   ├── ShopController.ts      # [Lazy Chunk] 武器店、防具店與倉庫介面控制
│   │   ├── TradeController.ts     # [Lazy Chunk] 跑商路線規劃與交易介面控制 (備註維護註記)
│   │   ├── RecruitController.ts   # 傭兵酒館招募與動態卡片邏輯
│   │   ├── MainMenuController.ts  # 主選單與存檔欄位渲染
│   │   ├── GameFlowController.ts  # 遊戲流程控制、日誌與選單
│   │   ├── FacilityController.ts  # 建築設施進出、工作分配
│   │   ├── ActionController.ts    # 探索、討伐、進貢與據點遷移
│   │   ├── ExplorationController.ts# 地圖探索介面與操作控制 (冒險者挑選與急行確認彈窗)
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
- Phaser 不直接呼叫系統或 Modal；跨邊界使用 CustomEvent。系統也不匯入 UI，遊戲事件由 main.ts 轉接到視窗。

## 據點官職與首都系統 (Node-based Office & Capital System)

本專案摒棄了傳統戰略遊戲中「爵位直接給予全域官職數量」的作法，改採**據點獨立制 (Node-based)**：
- **本地職缺 (Local Slots)**：爵位 (Noble Title) 僅負責解鎖「單一據點可配置的最高職缺數」。
- **派駐關聯 (Stationing)**：傭兵的官職資料不僅記錄其階級，更綁定 `stationedNodeId`。
- **首都與唯一性榮譽 (Capital Tag & Unique Honors)**：透過在 `MapNode` 新增 `isCapital` 標籤，玩家可冊封首都。

## 外交與攻城系統 (Diplomacy & Siege Systems)

- **AI 派系性格與關係 (AI Factions)**：AI 派系具備不同的性格 (`FactionPersonality`)。
- **動態攻城戰 (Dynamic Sieges)**：AI 發動擴張時，若目標為敵對勢力據點，將發起「攻城戰 (`siegeData`)」。

## 怪物原型、種族質變與元素相剋系統 (Monster Archetypes, Race Variants & Elemental Systems)

- **三層模組化怪物架構**：
  - **怪物原型 (`BaseMonsterArchetype`)**：40 種非 Boss 基礎怪物（`monsters.json`），定義基礎名稱、`compatibleRaces` 與 `powerTier`。
  - **種族質變標籤 (`RaceTagModifier`)**：動態冠前綴（如單一相容 `UNDEAD` 直接顯示 `骷髏`，多相容標籤抽到 `UNDEAD` 冠上 `[不死的]哥布林`），並賦予天生數值傾向比重。
  - **元素相剋運算 (`getElementalMultiplier`)**：三元相剋（冰 ➔ 火 ➔ 雷 ➔ 冰 順剋 1.25x/逆剋 0.75x）、光暗互剋 1.5x、光/暗對元素 1.05x/1.10x、火對無屬性 1.05x。玩家武器附帶 `element` 時在傷害計算中自動運算。
- **單向隔離與 100% 偵查一致性**：
  - 生靈據點嚴格排除 `UNDEAD`；亡靈據點以 `UNDEAD` 主體 (70%+)。
  - 偵查成功後將敵軍陣容與情報持久化於 `node.scoutData.garrisonEncounter`，保證偵查顯示、討伐隊伍編制彈窗與戰鬥遭遇敵軍 100% 精確一致。

