# 專案架構 (Architecture)

這份文件概述了回合制傭兵團經營 RPG 的系統架構與設計模式。
為了支撐複雜的「據點發展 x 英雄養成 x 戰略戰鬥 x 生存壓力」多系統複合體，本專案採用**事件驅動架構 (Event-Driven Architecture)**。

## 目錄結構
```text
/
├── .agents/                 # AI 行為準則與客製化設定
├── docs/                    # 開發日誌、交接、未來擴充藍圖與架構文件
│   ├── FEUDAL_AND_TERRITORY_SYSTEM.md # [核心手冊] 封建爵位、領地規模、繁榮度與內政建築權威規範
│   ├── FUTURE_DESIGN.md     # [核心藍圖] 未來系統擴充規範與程式碼引用總覽
│   ├── STORY_STUDIO_GUIDE.md # 故事條件、獎勵、討伐據點與測試操作指南
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
│   │   ├── Narrative.ts     # 故事、節點、條件、效果與執行狀態型別
│   │   ├── Territory.ts     # 領地資料、工作分配與建造設施等級 (Tavern/WeaponShop/ArmorShop/Forge)
│   │   ├── Exploration.ts   # 探索進度與視野迷霧資料
│   │   ├── Road.ts          # 道路網路資料
│   │   └── ...
│   ├── systems/             # 系統邏輯引擎 (負責監聽與發布事件)
│   │   ├── TownManagementSystem.ts # 據點與內政系統
│   │   ├── HeroSystem.ts       # 英雄養成與招募系統
│   │   ├── CombatSystem.ts     # 戰鬥與多波次模擬系統\n│   │   ├── combat/             # 戰鬥子系統\n│   │   │   └── PassiveManager.ts   # 戰鬥被動技能管理器
│   │   ├── ThreatSystem.ts     # 生存壓力與災難系統
│   │   ├── DispatchSystem.ts   # 派遣與任務系統
│   │   ├── RoadSystem.ts       # [核心] 道路樹狀網絡、智慧自然分岔與圖連通度
│   │   ├── MapDynamicsSystem.ts# 地圖動態與派系擴張\n│   │   ├── map/                # 地圖動態子系統\n│   │   │   ├── FactionSystem.ts    # 派系關係與好感度系統\n│   │   │   ├── MapEventSystem.ts   # 地圖事件生成與觸發\n│   │   │   ├── MapNodeSystem.ts    # 世界地圖節點繁榮度與升降級模擬\n│   │   │   └── MapUtils.ts         # 地圖工具函數
│   │   ├── ExplorationSystem.ts# 地圖探索與視野解鎖系統
│   │   ├── EventSystem.ts      # 隨機動態事件觸發與選項抉擇系統
│   │   ├── NarrativeSystem.ts  # 跨機制故事條件、線索、排程與發布內容執行核心
│   │   ├── NarrativeContentStore.ts # 正式專案故事載入與開發測試資料隔離
│   │   ├── MonsterSystem.ts    # 怪物原型、種族質變與能力生成
│   │   ├── MarketSystem.ts     # 市場經濟與特產系統
│   │   ├── MilestoneSystem.ts  # 里程碑進度與獎勵
│   │   ├── EnhancementSystem.ts# 裝備鍛造與強化系統
│   │   ├── EquipmentGenerator.ts# 裝備生成與隨機詞綴
│   │   └── DataStore.ts        # 靜態資料庫總管
│   ├── data/                # 靜態與平衡性資料
│   │   ├── BalanceData.ts   # 全域平衡性常數配置
│   │   ├── DifficultyData.ts# 遊戲難度設定與補正參數
│   │   ├── StoryData.ts     # 內建故事定義與垂直示範
│   │   ├── custom_stories.json # 編排器發布的專案故事內容
│   │   ├── story_backups/      # 故事工坊寫入時建立的最近 20 份快照
│   │   ├── NarrativeData.ts # 敘事文本池與探險事件定義\n│   │   └── SkillData.ts     # 技能與特效資料庫
│   ├── templates/           # [HTML 分頁模板] 防止大型 index.html 誤改
│   │   ├── ui-chrome.html   # top-bar, overlay, tooltip
│   │   ├── views-main.html  # 主選單, 地圖, 野外, 街道視圖
│   │   ├── views-facility.html # 書房, 謁見廳, 酒館, 商店, 鍛造屋
│   │   ├── views-right-panel.html # 右側共用領地面板
│   │   ├── modals-combat-trade.html # 戰鬥 Modal, 貿易跑商 Modal
│   │   ├── modals-game.html # 倉庫, 新遊戲, 載入, 派遣, 俘虜, 系統選單, 事件, 待辦 Modal
│   │   ├── story-editor.html # 僅供獨立故事工坊載入的介面片段
│   │   └── panels-hud.html  # 左側抽屜面板 (戰鬥紀錄/外交/隊伍) & 右下角史詩圓鈕
│   ├── ui/                  # DOM UI、Phaser Scene、呈現資料與獨立 UI Controllers
│   │   ├── TemplateLoader.ts # [核心] 動態 HTML 模板載入器
│   │   ├── NarrativeTestController.ts # 僅 DEV + storyTest 查詢參數載入的遊戲測試面板
│   ├── tools/
│   │   ├── StoryStudio.ts    # 獨立故事內容編輯、驗證、快照與測試啟動器
│   │   └── CombatStudio.ts   # 獨立戰術遭遇、戰鬥平衡模擬、單位創造與數據大盤控制器
├── tools/
│   ├── icon-studio.html      # 獨立圖標工坊
│   ├── story-studio.html     # 獨立故事工坊
│   └── combat-studio.html    # 獨立戰術遭遇與戰鬥平衡工坊入口，不納入正式建置
│   │   ├── modals/          # [Phase 4] 獨立的彈窗面版控制器 (Facade 拆分)
│   │   │   ├── DispatchModalController.ts  # 派遣/出征設定面板
│   │   │   ├── NodeDetailModalController.ts# 節點詳細資訊與圓形選單
│   │   │   ├── PartyModalController.ts     # 傭兵陣容與屬性詳細面板
│   │   │   ├── EquipModalController.ts     # 裝備替換面板
│   │   │   ├── EventModalController.ts     # 突發事件抉擇面板
│   │   │   ├── TodoModalController.ts      # 待辦事項清單
│   │   │   ├── PrisonerModalController.ts  # 戰後俘虜處置
│   │   │   └── CombatHistoryModalController.ts # 戰鬥歷程紀錄
│   │   ├── components/            # 共用 UI 元件
│   │   │   ├── ForgeUIController.ts# 鐵匠舖與倉庫獨立控制器
│   │   │   └── AdventurerCard.ts  # 傭兵卡片渲染邏輯
│   │   ├── PhaserManager.ts       # [Lazy Chunk] Phaser 引擎初始化與地圖繪製隔離模組
│   │   ├── ShopController.ts      # [Lazy Chunk] 武器店與防具店介面控制 (Facade)

│   │   ├── TradeController.ts     # [Lazy Chunk] 跑商路線規劃與交易介面控制 (備註維護註記)
│   │   ├── RecruitController.ts   # 傭兵酒館招募與動態卡片邏輯
│   │   ├── MainMenuController.ts  # 主選單與存檔欄位渲染
│   │   ├── GameFlowController.ts  # 遊戲流程控制、日誌與選單
│   │   ├── FacilityController.ts  # 建築設施進出、工作分配
│   │   ├── ActionController.ts    # 探索、討伐、進貢與據點遷移
│   │   ├── ExplorationController.ts# 地圖探索介面與操作控制 (冒險者挑選與急行確認彈窗)
│   │   ├── CheatController.ts     # 開發環境測試密技
│   │   ├── MapScene.ts            # Phaser 場景，負責 Canvas 繪製與動畫
│   │   └── ModalController.ts     # [Facade] 輕量化轉接路由，動態載入 modals/
│   └── main.ts              # 組合根：系統初始化、事件轉接與 Controller 初始化
├── index.html               # 測試用網頁骨架
└── package.json             # Vite 建置配置檔
```

## 核心設計理念：事件驅動 (Event-Driven)
所有系統之間**互不知道對方存在**，所有跨系統的溝通都必須透過 `EventBus` 進行。

### 跨機制故事編排

`NarrativeSystem` 位於既有玩法入口之上。故事內容以靜態 `NarrativeStory` 定義，玩家進度則獨立保存在 `NarrativeRuntimeState`。節點只宣告呈現機制、成立條件及結果效果，不保存固定的下一章指標；後續節點可藉由線索 facts、世界狀態、探索紀錄及延遲排程自行取得資格。

首批轉接路徑如下：

- 懸賞板：把合格節點注入 `GameState.bounties`，領取獎勵時完成故事節點。
- 酒館：`TavernSystem.askRumor()` 優先消耗合格的故事傳聞。
- 領地事件：每日結算發布 `NARRATIVE_NODE_TRIGGERED`，沿用事件選項 Modal。
- 探索／討伐：探索發現與討伐結束回報故事核心，再由合格節點呈現後續事件。
- 故事據點：目前透過 `UNLOCK_MAP_NODE` 解鎖既有節點，尚不在執行期生成任意地圖座標。

故事定義與存檔狀態必須分離：修改或發布內容不得重置各存檔進度；新增狀態欄位亦需提供舊存檔預設值。

故事效果為可重複的型別清單，涵蓋 facts、資源獎勵、物品獎勵、排程、解鎖與 `CREATE_SUBJUGATION_NODE`。故事討伐據點以 `story_<storyId>_<nodeId>` 作為穩定 ID，`MapNode.narrativeSubjugation` 保存途中節點、勝敗節點與清除策略；`SaveManager` 既有的 `mapNodes` 序列化會自然保存它。

派遣任務從故事據點複製 `narrativeSubjugation`，`ActiveMission.narrativeJourneyIndex` 確保途中節點依序且只觸發一次；討伐結算產生 `subjugation:<mapNodeId>:victory|defeat` fact，再觸發明確指定的結果節點。通用討伐探索日誌仍由 `ExplorationNarrativeEngine` 處理。

故事內容工具採與圖標工坊相同的開發工具邊界：`tools/story-studio.html` 只在 Vite 開發伺服器使用，透過固定路徑 API 讀寫 `custom_stories.json` 與 `story_backups/`。正式遊戲沒有編輯按鈕，也不匯入 `StoryStudio.ts` 或其 CSS。

遊戲內測試必須同時符合 `import.meta.env.DEV` 與 `?storyTest=<token>`。工坊草稿以 token 綁定暫存於 LocalStorage；一般啟動忽略該暫存。測試控制器將 `currentSaveSlot` 固定為 `null`，只操作當次記憶體狀態，避免污染正式存檔。

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

