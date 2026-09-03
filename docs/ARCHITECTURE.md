# 專案架構 (Architecture)

這份文件概述了回合制傭兵團經營 RPG 的系統架構與設計模式。
為了支撐複雜的「據點發展 x 英雄養成 x 戰略戰鬥 x 生存壓力」多系統複合體，本專案採用**事件驅動架構 (Event-Driven Architecture)** 與 **唯一真實來源 (Single Source of Truth, SSOT)** 設計理念。

## 目錄結構
```text
/
├── .agents/                 # AI 行為準則與客製化設定
├── docs/                    # 開發日誌、交接、未來擴充藍圖與架構手冊
│   ├── ARCHITECTURE.md      # [架構總綱] 系統架構、資料流與設計模式
│   ├── CHANGELOG.md         # [開發日誌] 專案演進與功能更動履歷
│   ├── HANDOVER.md          # [交接文件] 開發進度、已知問題與後續建議
│   ├── CLASS_SYSTEM.md      # [核心手冊] 12大滿等進階/變異職業、武器綁定與技能池
│   ├── ATTRIBUTE_SYSTEM.md  # [核心手冊] 八維屬性模型、物魔雙軌戰鬥公式與大一統戰力
│   ├── FEUDAL_AND_TERRITORY_SYSTEM.md # [核心手冊] 封建爵位、領地規模、繁榮度與內政建築權威規範
│   ├── MONSTERS_AND_ELEMENTS.md # [核心手冊] 64+隻魔物母庫、種族前綴、元素相剋與動態副將接替規範
│   ├── MATERIALS_AND_ITEMS.md   # [核心手冊] 全道具、特產、鍛造素材與五大元素附魔石手冊
│   ├── SKILL_WORKSHOP_SPEC.md   # [核心手冊] 全自訂積木技能工坊規範與效果編譯器設計
│   ├── VFX_COMBAT_PIPELINE_HANDOVER.md # [P0 接手計畫] 特效工房、戰鬥 HIT、共用播放器與技能管線重構
│   ├── FUTURE_DESIGN.md     # [核心藍圖] 未來系統擴充規範與程式碼引用總覽
│   ├── game_system_guide.md # [玩法手冊] 全系統玩法指南與工坊架構概覽
│   ├── STORY_STUDIO_GUIDE.md# 故事條件、英雄連動、討伐據點與測試操作指南
│   ├── CHEATS.md            # 開發測試密技與工坊快捷指令指南
│   ├── NARRATIVE_BIBLE.md   # 世界觀與背景設定聖經
│   ├── NPC_AUTONOMOUS_SYSTEM_DESIGN.md # NPC 自主推演與地緣政治設計手冊
│   └── UI_DISPLAY_CONVENTION.md # UI 呈現規範與通用 Sprite 渲染準則
├── tools/                   # [獨立開發工坊] 僅在 Vite 開發環境運作，不納入正式遊戲 Build
│   ├── story-studio.html    # 獨立故事工坊 (Story Studio) 入口
│   ├── combat-studio.html   # 獨立戰鬥沙盒、怪物資料庫與英雄名冊工坊入口
│   ├── equipment-studio.html# 獨立裝備、素材與配方工坊 (Equipment Studio) 入口
│   ├── skill-workshop.html  # 獨立全自訂積木技能工坊 (Skill Workshop) 入口
│   └── icon-studio.html     # 獨立全圖集圖標工坊 (Icon Studio) 入口
├── src/
│   ├── core/                # 核心驅動引擎
│   │   ├── EventBus.ts      # [核心] 全局事件總線
│   │   ├── GameEvents.ts    # [核心] 事件定義與 Payload 型別
│   │   ├── GameState.ts     # 全局狀態容器與初始化
│   │   ├── GameLoop.ts      # 玩家操作驅動的每日結算流程
│   │   ├── Random.ts        # 可注入、可重現的亂數來源
│   │   ├── Calendar.ts      # 日曆與累計天數換算
│   │   ├── SaveManager.ts   # 存檔/讀檔管理器與版本自動洗鍊同步
│   │   └── SaveMigration.ts # 純函式存檔版本遷移
│   ├── models/              # 核心資料模型 (Data Models, 純粹的資料型別與實體)
│   │   ├── Adventurer.ts    # 英雄資料與隨機品質/性格/屬性
│   │   ├── Narrative.ts     # 故事、節點、條件、效果與執行狀態型別
│   │   ├── Territory.ts     # 領地資料、工作分配與建造設施等級 (Tavern/Forge 等)
│   │   ├── Combat.ts        # 戰鬥實體、行動狀態與戰報資料
│   │   ├── Skill.ts         # 技能介面、積木定義與元素相剋乘數計算
│   │   ├── Gambit.ts        # GAMBIT 戰術 AI 條件與動作型別
│   │   ├── Exploration.ts   # 探索進度與視野迷霧資料
│   │   ├── Road.ts          # 道路網路資料
│   │   ├── DispatchTask.ts  # 派遣任務與商隊實體型別
│   │   ├── FactionProfile.ts# 派系屬性、陣營目標與戰役狀態模型
│   │   ├── AdventureLog.ts  # 冒險歷程日誌型別
│   │   ├── WorldGeneration.ts# 大世界生成配置型別
│   │   └── types.ts         # 全域基礎型別、列舉 (NodeLevel, TitleConfig 等)
│   ├── systems/             # 系統邏輯引擎 (負責監聽與發布事件)
│   │   ├── TownManagementSystem.ts # 據點與內政生產系統
│   │   ├── HeroSystem.ts       # 英雄養成與數值計算
│   │   ├── TavernSystem.ts     # 酒館英雄招募與流動情報
│   │   ├── CombatSystem.ts     # 戰鬥與多波次模擬系統
│   │   ├── combat/             # 戰鬥子系統
│   │   │   ├── SkillRegistry.ts    # [SSOT] 全技能單一真相來源中樞
│   │   │   ├── SkillEffectEngine.ts# [核心] 自訂積木技能效果編譯與執行引擎
│   │   │   ├── PassiveManager.ts   # 戰鬥被動技能管理器
│   │   │   ├── GambitEvaluator.ts  # 戰術條件鏈即時判定器
│   │   │   ├── InteractiveCombatSession.ts # 互動式回合戰鬥會話
│   │   │   ├── LordCommanderSystem.ts # 領主軍師戰術指揮系統
│   │   │   └── OffensiveSiegeSystem.ts # 玩家主動攻城作戰系統
│   │   ├── ThreatSystem.ts     # 生存壓力與災難系統
│   │   ├── DispatchSystem.ts   # 派遣、討伐與商隊貿易結算系統
│   │   ├── RoadSystem.ts       # [核心] 道路樹狀網絡、智慧自然分岔與圖連通度
│   │   ├── MapDynamicsSystem.ts# 地圖動態與派系擴張
│   │   ├── map/                # 地圖動態子系統
│   │   │   ├── FactionSystem.ts    # 派系關係與好感度系統
│   │   │   ├── FactionArmyGenerator.ts # 派系軍隊、代理副將與攻城部隊編制生成
│   │   │   ├── MapEventSystem.ts   # 地圖動態事件生成與觸發
│   │   │   ├── MapNodeSystem.ts    # 世界地圖節點繁榮度與升降級模擬
│   │   │   └── MapUtils.ts         # 地圖工具函數
│   │   ├── faction/            # 派系動態與戰役子系統
│   │   │   ├── FactionCampaignSystem.ts # 派系跨區域宣戰與戰役進程系統
│   │   │   ├── FactionDecisionAI.ts     # 派系 AI 擴張與戰略決策樹
│   │   │   └── FactionEconomyEngine.ts  # 派系資源、兵源與經濟循環引擎
│   │   ├── ExplorationSystem.ts# 地圖探索與視野解鎖系統
│   │   ├── ExplorationNarrativeEngine.ts # 探索與討伐日誌文本引擎
│   │   ├── EventSystem.ts      # 隨機動態事件觸發與選項抉擇系統
│   │   ├── NarrativeSystem.ts  # 跨機制故事條件、線索、日常懸賞與排程執行核心
│   │   ├── NarrativeContentStore.ts # 正式專案故事載入與開發測試資料隔離
│   │   ├── BountySystem.ts     # 懸賞告示板轉接中樞
│   │   ├── MonsterSystem.ts    # 怪物原型、8大定位與能力生成
│   │   ├── MarketSystem.ts     # 市場經濟與特產系統
│   │   ├── MilestoneSystem.ts  # 里程碑進度與獎勵
│   │   ├── EnhancementSystem.ts# 裝備鍛造與強化系統
│   │   ├── EquipmentGenerator.ts# 裝備生成、職業限制推導與 T1~T5 Scaling
│   │   └── DataStore.ts        # 靜態資料庫總管
│   ├── data/                # 靜態與平衡性資料庫 (SSOT)
│   │   ├── BalanceData.ts   # 全域平衡性常數配置
│   │   ├── DifficultyData.ts# 遊戲難度設定與補正參數
│   │   ├── CustomSkillData.json # [SSOT] 全自訂積木技能庫
│   │   ├── monsters.json    # [SSOT] 官方 64+ 隻全魔物母庫
│   │   ├── subjugation_nodes.json # [SSOT] 官方討伐據點資料庫
│   │   ├── equipment_weapons.json # [SSOT] 武器庫
│   │   ├── equipment_armors.json  # [SSOT] 防具庫
│   │   ├── equipment_accessories.json # [SSOT] 飾品庫
│   │   ├── materials.json   # [SSOT] 加工素材與附魔石庫
│   │   ├── items.json       # 消耗道具庫
│   │   ├── CraftingRecipes.json # 鍛造配方庫
│   │   ├── ModificationRecipes.json # 改造配方庫
│   │   ├── SecondHandShopData.json # 二手商店商品池
│   │   ├── UniqueAdventurers.ts # 唯一傳奇英雄 (UR/SSR) 名冊 (支援雙實體綁定)
│   │   ├── StoryData.ts     # 內建故事定義
│   │   ├── custom_stories.json # 故事工坊發布的專案故事內容 (含日常懸賞故事集)
│   │   ├── custom_icon_config.json # 通用圖集配置
│   │   ├── custom_icon_datasets.json # 通用圖庫資料集
│   │   ├── FactionData.ts   # 派系與武將資料
│   │   ├── MapData.ts       # 地圖節點與連線靜態定義
│   │   ├── MapMaskData.ts   # 地圖遮罩多邊形資料
│   │   ├── NarrativeData.ts # 碎片化敘事與事件文本庫
│   │   ├── EventData.ts     # 突發事件池資料
│   │   ├── RumorData.ts     # 酒館傳聞與線索資料
│   │   └── SkillData.ts     # 技能特效與數值資料庫
│   ├── templates/           # [HTML 分頁模板] 防止大型 index.html 誤改
│   │   ├── ui-chrome.html   # top-bar, overlay, tooltip
│   │   ├── views-main.html  # 主選單, 地圖, 野外, 街道視圖與訪客通道
│   │   ├── views-facility.html # 書房, 謁見廳, 酒館, 商店, 鍛造屋
│   │   ├── views-right-panel.html # 右側共用領地面板
│   │   ├── modals-combat-trade.html # 戰鬥 Modal, 貿易跑商 Modal
│   │   ├── modals-game.html # 倉庫, 新遊戲, 載入, 派遣, 俘虜, 系統選單, 事件, 待辦, NPC對話 Modal
│   │   ├── story-editor.html # 僅供獨立故事工坊載入的介面片段
│   │   ├── combat-studio.html# 戰鬥與英雄工坊彈窗介面片段
│   │   ├── skill-workshop.html# 技能工坊介面片段
│   │   └── panels-hud.html  # 左側抽屜面板 (戰鬥紀錄/外交/隊伍) & 右下角史詩圓鈕
│   ├── ui/                  # DOM UI、Phaser Scene、呈現資料與獨立 UI Controllers
│   │   ├── TemplateLoader.ts # [核心] 動態 HTML 模板載入器
│   │   ├── UIManager.ts     # [核心] UI 總協調器與通用刷新
│   │   ├── SceneController.ts # 街道視圖、建築切換與 NPC 訪客通道控制器
│   │   ├── GameFlowController.ts # 遊戲流程控制、日誌與選單
│   │   ├── FacilityController.ts # 建築設施進出、工作分配
│   │   ├── ActionController.ts # 探索、討伐、進貢與據點遷移
│   │   ├── ExplorationController.ts # 地圖探索介面與操作控制
│   │   ├── MapController.ts # 地圖 DOM 操作與節點資訊轉接
│   │   ├── MapPresentation.ts # 地圖純呈現工具函數
│   │   ├── MapScene.ts      # Phaser 3 場景 (Canvas 地圖繪製與動畫)
│   │   ├── PhaserManager.ts # Phaser 引擎生命週期管理
│   │   ├── CombatUIManager.ts # 戰鬥播放舞台與動態受擊動畫管理
│   │   ├── RecruitController.ts # 酒館招募卡片控制
│   │   ├── ShopController.ts # 武器店與防具店介面控制
│   │   ├── TradeController.ts # 跑商路線規劃與單線商隊介面控制
│   │   ├── DiplomacyController.ts # 外交與派系關係面板
│   │   ├── OfficeController.ts # 官職指派與謁見廳控制
│   │   ├── MainMenuController.ts # 主選單與存檔欄位渲染
│   │   ├── ToastManager.ts  # 全域 Toast 通知中樞
│   │   ├── IconSpriteHelper.ts # 通用 Sprite、立體畫框、階級發光角標與直立肖像 (1:1.853) 渲染器 (支援 ?flip 水平鏡像)
│   │   ├── CheatController.ts # 開發環境測試密技
│   │   ├── NarrativeTestController.ts # 僅 DEV + storyTest 載入的遊戲測試面板
│   │   ├── ModalController.ts # [Facade] 彈窗轉接路由中樞
│   │   ├── modals/          # 獨立彈窗面板控制器
│   │   │   ├── DispatchModalController.ts  # 派遣/出征設定面板 (含單一 UR 防呆)
│   │   │   ├── NodeDetailModalController.ts# 節點詳細資訊與圓形選單
│   │   │   ├── PartyModalController.ts     # 傭兵陣容、換裝、自由配點與進階轉職面板
│   │   │   ├── EquipModalController.ts     # 裝備替換面板 (含職業穿戴限制防呆)
│   │   │   ├── EventModalController.ts     # 突發事件抉擇面板
│   │   │   ├── NpcDialogueModalController.ts # 沉浸式多段 NPC 對話與分支結算彈窗
│   │   │   ├── BountyModalController.ts    # 懸賞告示板彈窗 (故事懸賞/日常輪替)
│   │   │   ├── OathCreationController.ts   # 誓約守衛 20 款立繪挑選與創角面板
│   │   │   ├── GambitModalController.ts    # 傭兵 GAMBIT 戰術 AI 配置面板
│   │   │   ├── FactionCampaignModalController.ts # 派系戰役與宣戰佈署面板
│   │   │   ├── TodoModalController.ts      # 待辦事項清單面板
│   │   │   ├── PrisonerModalController.ts  # 戰後俘虜處置面板
│   │   │   ├── AdventureLogModalController.ts # 冒險歷程日誌面板
│   │   │   ├── DailySummaryModal.ts        # 每日結算收支摘要彈窗
│   │   │   └── GameOverModalController.ts  # 遊戲結束面板
│   │   └── components/      # 共用 UI 元件控制器
│   │       ├── AdventurerCard.ts           # 傭兵滿版卡牌渲染邏輯
│   │       ├── ForgeUIController.ts        # 鐵匠鋪 (強化/鍛造/重鑄/附魔) 控制器
│   │       ├── InventoryUIController.ts    # 領主總倉庫 (素材/特產/裝備) 控制器
│   │       ├── ModificationWorkshopController.ts # 裝備改造所控制器
│   │       └── SecondHandShopController.ts # 二手黑市商店控制器
│   ├── tools/               # 開發工坊 TypeScript 控制器
│   │   ├── StoryStudio.ts   # 故事工坊總控制器
│   │   ├── story-studio/    # 故事工坊子模組
│   │   │   ├── StoryStudioForm.ts          # 故事表單編輯器
│   │   │   ├── StoryStudioGraph.ts         # 視覺化節點圖
│   │   │   ├── StoryStudioStore.ts         # 故事資料儲存與快照
│   │   │   ├── StoryStudioHeroPicker.ts    # 全視覺化英雄挑選器
│   │   │   ├── StoryStudioItemPicker.ts    # 全視覺化物品挑選器
│   │   │   ├── StoryStudioSubjugationPicker.ts # 討伐據點挑選器
│   │   │   ├── StoryStudioFactionManager.ts# 派系好感度編輯模組
│   │   │   └── StoryStudioPreview.ts       # 故事預覽引擎
│   │   ├── CombatStudio.ts  # 戰鬥模擬沙盒、討伐據點工坊、怪物/英雄資料庫 (支援雙實體綁定)
│   │   ├── EquipmentStudio.ts # 裝備/素材/道具/配方工坊控制器
│   │   └── SkillWorkshop.ts # 全自訂積木技能工坊控制器 (支援狀態挑選器與磁碟重載)
│   └── main.ts              # 組合根：系統初始化、事件轉接與 Controller 初始化
├── index.html               # 遊戲本體輕量網頁骨架 (~38 行，禁止整塊覆蓋)
└── package.json             # 專案依賴與 Vite 建置配置檔
```

---

## 核心設計理念：事件驅動 (Event-Driven)
所有系統之間**互不知道對方存在**，所有跨系統的溝通都必須透過 `EventBus` 進行。

### 資料流向 (Data Flow)
1. **觸發源**：`GameLoop` (時間流逝) 或 `UI` (玩家操作) 呼叫特定的 System 方法或直接發布事件。
2. **事件廣播**：例如 `DispatchSystem` 判定天數增加後，向 `EventBus` 發布 `DAY_PASSED` 事件。
3. **系統響應**：
   - `ThreatSystem` 聽到 `DAY_PASSED` 後推進災難倒數。
   - `TownManagementSystem` 聽到 `DAY_PASSED` 後進行資源生產結算。
   - `NarrativeSystem` 聽到 `DAY_PASSED` 後檢查排程事件並推進故事線。
4. **UI 更新**：`main.ts` 定期呼叫 `UIManager.updateUI()` 或監聽特定狀態改變事件重繪畫面。

### 核心事件列表 (GameEvents)
- `DAY_PASSED`：天數流逝，驅動所有隨時間變化的邏輯 (內政、災難、冷卻結算)。
- `HERO_DIED`：英雄死亡，觸發士氣下降或任務失敗。
- `COMBAT_REQUESTED` & `COMBAT_FINISHED`：非同步戰鬥結算。
- `THREAT_ARRIVED`：災難降臨，由 `ThreatSystem` 判定發出，各系統承受相應後果。
- `NARRATIVE_NODE_TRIGGERED`：故事節點觸發，喚起對話或事件彈窗。

---

## 🛠️ 五大獨立開發工坊架構 (The 5 Developer Studios Ecosystem)

專案提供五套專業的視覺化設計工坊，作為遊戲數據的「單一真相來源產出中樞」：
1. **📖 故事工坊 (`tools/story-studio.html` & `src/tools/StoryStudio.ts`)**：
   * 視覺化編排多線分支劇情、條件引擎、獎勵效果（支援加入英雄 `GRANT_HERO`）與日常懸賞任務。
   * 模組化架構包含 `StoryStudioHeroPicker`、`StoryStudioItemPicker`、`StoryStudioSubjugationPicker` 等全視覺化挑選器。
   * 一鍵將故事發布寫入 `src/data/custom_stories.json`，並自動建立時光機快照 (`story_backups/`)。
2. **⚔️ 戰鬥平衡與討伐工坊 (`tools/combat-studio.html` & `src/tools/CombatStudio.ts`)**：
   * 提供 **戰鬥模擬沙盒** (1場重播 / 100場蒙地卡羅)、**👾 怪物資料庫** (64+ 隻怪物編輯)、**👑 英雄名冊** (支援 3 槽自訂技能、3 格獨立裝備與唯一代碼雙向綁定) 與 **🏰 討伐據點設計工坊** (1~3 波守軍配置)。
   * 資料持久化寫入 `src/data/monsters.json` 與 `src/data/subjugation_nodes.json`。
3. **⚡ 全自訂積木技能工坊 (`tools/skill-workshop.html` & `src/tools/SkillWorkshop.ts`)**：
   * 視覺化積木組合架構（`Damage` 傷害、`Heal` 治療、`Status` 狀態賦予、`Buff` 數值增益、`Shield` 護盾等）。
   * 提供全視覺化 **異常與負面狀態 (DEBUFF)** 及 **正面增益 (BUFF)** 挑選器 Modal。
   * 自動計算與標準化 `mpCost` (SSOT)，支援雙向儲存同步（LocalStorage + `CustomSkillData.json`）與一鍵專案磁碟重載 (`🔄 從專案重載`)。
4. **🔨 裝備、素材與配方工坊 (`tools/equipment-studio.html` & `src/tools/EquipmentStudio.ts`)**：
   * 視覺化配置武器、防具、飾品、加工素材、消耗道具與鍛造/改造配方。
   * 支援資產上鎖保護、詞條池挑選、浮動區間配置，並寫入 `equipment_weapons.json` 等資料庫。
5. **🎨 全圖集圖標工坊 (`tools/icon-studio.html`)**：
   * 管理所有 Sprite 精靈切片、圖集命名空間與 Universal Icon 索引對應。
   * 支援全域 `?flip` 水平鏡像語法糖，在不增加素材體積下達成英雄與怪物朝向精確分離。

> [!IMPORTANT]
> **開發工具邊界原則**：所有工坊僅在 Vite 本地開發伺服器運行，具備獨立 HTML 入口，不會打包進正式 Release Build 中，不污染生產環境。

---

## ⚔️ 戰鬥中樞、怪物 8 大定位與動態副將接替架構 (Combat & Skill Architecture)

1. **單一真相來源技能中樞與效果編譯器 (`SkillRegistry.ts` & `SkillEffectEngine.ts`)**：
   * 全域所有傭兵基礎技能、Lv.10 進階職業技能、通用魔物特技與裝備特技，100% 透過 `SkillRegistry` 統一註冊與查詢。
   * 自訂積木技能透過 `SkillEffectEngine` 動態編譯並掛載至戰鬥執行管線，支援多段傷害、異常疊加與數值計算。
2. **雙實體英雄唯一身分綁定與動態副將接替引擎 (`Dynamic Vice-Commander Engine`)**：
   * 英雄實體具備唯一角色代碼 (`characterKey`)，可雙向綁定怪物實體 (`boundMonsterId` / `substituteMonsterId`)。
   * 當英雄被玩家俘虜、招募或陣亡時，敵方部隊與討伐據點自動透過 `resolveTroopMember` 演算法動態生成【代理副將】實體接替出戰，保證據點原始藍圖唯讀隔離且遊戲進程絕不中斷。
3. **怪物 8 大戰鬥定位 (`Stat Profiles`)**：
   * 在怪物總屬性預算下，以 `TANK` (鐵壁肉盾)、`ASSASSIN` (疾風刺客)、`MAGE` (奧術法師)、`BERSERKER` (嗜血狂戰)、`RANGER` (遠程狙擊)、`JUGGERNAUT` (亡靈泥沼)、`BOSS` (史詩首領)、`BALANCED` (常規均衡) 等權重生成極致差異化面板。
4. **戰前檢查與全域防呆**：
   * **單一 UR 限制**：每支隊伍/每場戰鬥嚴格限制最多 1 位 UR 傭兵出戰。
   * **戰敗休養 CD**：外出討伐戰敗與領地受襲重傷統一為 **4 天休養時間** (`restingDaysLeft = 4`)。
   * **忙碌狀態鎖定**：處於 `DISPATCHED`、`RESTING` 或 `CAPTURED` 的傭兵，換裝、配點、轉職與退休全面受安全阻擋。

---

## 🛡️ 裝備體系、T1~T5 Scaling 與自動同步機制 (Equipment SSOT)

1. **職業專屬裝備限制推導 (`DataStore.getDefaultAllowedJobs`)**：
   * 嚴格依照職業與武器類型綁定（戰弓限弓箭手、巨劍限戰士、法杖限法師、重鎧限戰士騎士等）。
2. **T1~T5 階級補正與主屬性保底 (`EquipmentGenerator.getTierScalingRange`)**：
   * T1 (D~B)、T2 (C~A)、T3 (B~A)、T4/T5 (B~S)。武器依職業保底核心主屬性，隨機抽取 0~2 條副屬性補正。
3. **存檔全自動對齊機制 (`SaveManager.autoSyncAllEquipmentWithTemplates`)**：
   * 讀取存檔時全自動校正裝備名稱、圖標與戰鬥效果，確保工坊數據調整後所有舊存檔立即同步最新屬性。
4. **裝備改造所 (`ModificationWorkshopController.ts`)**：
   * 支援消耗素材洗鍊裝備前綴、隨機詞條與進階屬性。

---

## 🏘️ 街道場景與 NPC 訪客對話系統 (Street Scene & NPC Dialogue)

1. **街道小巷訪客通道 (`SceneController.ts` & `views-main.html`)**：
   * 街道視圖提供紅框訪客列（44px × 82px 尺寸），支援滑鼠拖曳、滑輪滾動與 Floating Tooltip。無訪客時 100% 透明無痕。
2. **通用直立肖像渲染器 (`IconSpriteHelper.renderUniversalPortrait`)**：
   * 鎖定真實圖庫長寬比（**`1 : 1.853`**），人物身材、五官與雕花畫框 100% 正確還原，0 壓扁、0 變形。支援 `?flip` 語法糖無痕水平翻轉。
3. **沉浸式多段對話彈窗 (`NpcDialogueModalController.ts`)**：
   * 支援 140px × 260px 超大立繪展位、多段說話者切換（NPC vs 領主/誓約守衛）、負擔能力扣款安全判定與持久化結算監聽。

---

## 📜 懸賞與討伐據點全面故事化架構 (Narrative-Driven Gameplay)

1. **日常懸賞故事化 (`custom_stories.json` & `NarrativeSystem.ts`)**：
   * 官方日常故事集《領地日常與居民委託》（`story_daily_routine`）收錄 15+ 個日常委託。
   * 支援 `repeatable: true` 重複輪替、`cooldownDays` 完成冷卻與故事條件動態過濾。
2. **動態討伐據點生成 (`CREATE_SUBJUGATION_NODE`)**：
   * 透過官方討伐據點庫模板一鍵生成大世界冒險據點，`MapNode.narrativeSubjugation` 追蹤途中事件、戰鬥勝敗 Fact 與結果節點。

---

## 🎨 Phaser 與 DOM 的責任邊界

- `MapScene` 只負責 Canvas 地圖、相機、節點和動畫；依據 `getNodeTextureKey` 載入與繪製 Isometric 3/4 俯視角地圖建築圖案；離開 Scene 時必須解除自身監聽並清除 tween。
- `MapController` 負責 DOM 面板、可及性節點清單，以及把 Phaser 的節點點擊轉成 UI 操作。
- `MapPresentation` 放置兩邊共用的純呈現函式（`getTerrainEmoji`, `getNodeIcon`, `getNodeTextureKey`），避免循環依賴。
- `Command Crest Hub` (`#command-crest-container`) 為固定於右下角的控制樞紐，統一收納「結束本日史詩劍盾按鈕」、羅盤圓鈕與快捷 Dock。
- Phaser 不直接呼叫系統或 Modal；跨邊界使用 CustomEvent。系統也不匯入 UI，遊戲事件由 `main.ts` 轉接到視窗。

---

## 🏰 據點官職與首都系統 (Node-based Office & Capital System)

- **本地職缺 (Local Slots)**：爵位 (Noble Title) 負責解鎖「單一據點可配置的最高職缺數」。
- **派駐關聯 (Stationing)**：傭兵的官職資料不僅記錄其階級，更綁定 `stationedNodeId`。
- **首都與唯一性榮譽 (Capital Tag & Unique Honors)**：透過在 `MapNode` 新增 `isCapital` 標籤，玩家可冊封首都。

---

## ⚔️ 外交與攻城系統 (Diplomacy & Siege Systems)

- **AI 派系性格與關係 (AI Factions)**：AI 派系具備不同的性格 (`FactionPersonality`)。
- **動態攻城戰 (Dynamic Sieges)**：AI 發動擴張時，若目標為敵對勢力據點，將發起攻城戰 (`siegeData`)。

---

## 👾 怪物原型、種族質變與元素相剋系統 (Monster Archetypes & Elements)

- **三層模組化怪物架構**：
  - **怪物原型 (`BaseMonsterArchetype`)**：40+ 種非 Boss 基礎怪物（`monsters.json`），定義基礎名稱、`compatibleRaces` 與 `powerTier`。
  - **種族質變標籤 (`RaceTagModifier`)**：動態冠前綴（如單一相容 `UNDEAD` 顯示 `骷髏`，多相容標籤抽到 `UNDEAD` 冠上 `[不死的]哥布林`）。
  - **元素相剋運算 (`getElementalMultiplier`)**：三元相剋（冰 ➔ 火 ➔ 雷 ➔ 冰 順剋 1.25x/逆剋 0.75x）、光暗互剋 1.5x、光/暗對元素 1.05x/1.10x、火對無屬性 1.05x。
- **單向隔離與 100% 偵查一致性**：
  - 生靈據點排除 `UNDEAD`；亡靈據點以 `UNDEAD` 主體。
  - 偵查成功後持久化儲存於 `node.scoutData.garrisonEncounter`，保證偵查與實戰敵軍 100% 精確一致。
