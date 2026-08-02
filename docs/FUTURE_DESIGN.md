# 未來系統擴充與設計藍圖 (Future System Roadmap & Design Specifications)

本文檔為專案未來模組化擴充的 **唯一權威規範與藍圖文件**。後續進行任何系統開發與設計時，**必須優先讀取本文檔與相關模組檔案**，嚴禁偏離本規範或擅自捏造無關設計。

---

## 📌 目錄
1. [陣營敵方單位系統 (Faction Enemy Units for War & Siege)](#1-陣營敵方單位系統)
2. [裝備數據庫與替換技能系統 (Equipment Database & Skill Transfer)](#2-裝備數據庫與替換技能系統)
3. [碎片化敘事、事件與劇情系統 (Lore, Bosses & Story Events)](#3-碎片化敘事事件與劇情系統)
4. [酒館系統設計 (Tavern System & Recruitment)](#4-酒館系統設計)
5. [GAMBIT 戰術與 AI 自主決策系統 (Gambit AI Tactical Chains)](#5-gambit-戰術與-ai-自主決策系統)
6. [爵位天賦與特權系統 (Noble Title Talents & Perks)](#6-爵位天賦與特權系統)
7. [內政與建築深化系統 (Civic & Base Building Expansion)](#7-內政與建築深化系統)

---

## 1. 陣營敵方單位系統 (Faction Enemy Units for War & Siege)

### 🎯 核心定位
用於派系宣戰、攻城戰 (Siege) 與大規模戰爭，與野生魔物/討伐據點分離。陣營部隊以 **全人類單位為主**，搭配 **少數訓化魔物/戰獸**。

### 📋 系統規範與兵種架構
- **人類陣營兵種**：
  - 前排：重甲步兵 (`iron_guard`)、盾牆陣型兵、方旗騎士 (Faction Champions)。
  - 中後排：強盜弩手 (`crossbowman`)、陣營薩滿/神官 (`shaman`)、刺客 (`assassin`)。
- **訓化戰獸 (Tamed Beasts)**：
  - 訓練獵犬/惡魔犬 (`hellhound`)、戰鬥巨熊 (`bear`)，隨陣營軍隊混編。
- **陣營武將 (Faction Champion)**：
  - 引用 [src/models/types.ts](file:///i:/gameproject/Medieval/src/models/types.ts#L290-L311) 的 `FactionChampion` 與 `capturedChampionIds` (俘虜招降處置)。

### 🔗 相關關鍵檔案
- 派系與武將資料：[src/data/FactionData.ts](file:///i:/gameproject/Medieval/src/data/FactionData.ts)
- 攻城與派系擴張邏輯：[src/systems/MapDynamicsSystem.ts](file:///i:/gameproject/Medieval/src/systems/MapDynamicsSystem.ts)
- 戰後俘虜處置視窗：`#modal-prisoner-action` ([src/ui/ModalController.ts](file:///i:/gameproject/Medieval/src/ui/ModalController.ts))
- 兵種護盾戰損計算：[src/systems/CombatSystem.ts](file:///i:/gameproject/Medieval/src/systems/CombatSystem.ts)

---

## 2. 裝備數據庫與替換技能系統 (Equipment Database & Skill Transfer) - ✅ [已完成實裝 (2026-08-02)]

### 🎯 核心定位
深化武具階級、元素附魔、職業限制，並實作 **「裝備賦予/替換技能 (Granted/Replaced Skills)」**、**「裝備重鑄 (Reforging)」** 與 **「元素加工附魔 (Enchantment)」**。

### 📋 系統規範
- **元素屬性 (`element`)**：
  - 武器/裝備帶有 6 大元素 (`NONE`, `FIRE`, `ICE`, `LIGHTNING`, `HOLY`, `DARK`)。
  - 支援 5 大元素附魔石 (熾炎石、霜冰石、疾雷石、聖光石、暗影石) 在鍛造屋進行元素注入與覆蓋。
  - 配合 [src/models/Skill.ts](file:///i:/gameproject/Medieval/src/models/Skill.ts#L40-L80) 的 `getElementalMultiplier` 進行相剋傷害運算 (冰➔火➔雷➔冰、光暗互剋 1.5x)。
- **裝備替換技能 (`grantedSkill`)**：
  - 穿戴特定高階/唯一裝備時（如法杖、戰鐮、聖典、魔戒），自動獲得/替換專屬主動技能。
- **鍛造、重鑄與強化 (Crafting, Reforging & Enhancement)**：
  - 鐵匠鋪提供 4 大獨立分頁：【裝備強化】(修復降階數值膨脹 Bug)、【裝備鍛造】(基礎裝備製作)、【裝備重鑄】(消耗前置裝備 + 特殊素材重鑄 T4 神兵)、【元素加工附魔】(注入元素石)。

### 🔗 相關關鍵檔案
- 裝備與模板型別：[src/models/types.ts](file:///i:/gameproject/Medieval/src/models/types.ts#L470-L506) (`Equipment`, `EquipmentTemplate`)
- 裝備數據庫 (1~3階裝備)：[src/systems/DataStore.ts](file:///i:/gameproject/Medieval/src/systems/DataStore.ts#L77-L150)
- 隨機裝備生成器：[src/systems/EquipmentGenerator.ts](file:///i:/gameproject/Medieval/src/systems/EquipmentGenerator.ts)
- 裝備強化系統：[src/systems/EnhancementSystem.ts](file:///i:/gameproject/Medieval/src/systems/EnhancementSystem.ts)
- 武器店與倉庫 UI：[src/ui/ShopController.ts](file:///i:/gameproject/Medieval/src/ui/ShopController.ts)

---

## 3. 碎片化敘事、事件與劇情系統 (Lore, Bosses & Story Events)

### 🎯 核心定位
透過世界探險、據點調查與隨機事件，傳遞古陸大崩解歷史，並解鎖 **唯一高等神兵**、**史詩 Boss** 與 **故事據點**。

### 📋 系統規範
- **史詩 Boss 據點 (Boss Encounter Nodes)**：
  - 獨立 Boss 單位（如 `young_dragon` 幼年火龍、`frost_dragon` 霜寒古龍、`bandit_king` 山賊王、`grand_inquisitor` 大審判官）。
  - Boss 具備 `DRAGON` / `HUMAN` 史詩霸體與獨立多階段技能。
- **唯一高等武器 (Legendary Artifacts)**：
  - 擊敗特定 Boss 或完成跨區域事件鏈後獲得，具備固定獨特詞綴與全服唯一性。
- **動態解鎖故事據點 (`unlockCondition`)**：
  - 當天數、聲望或爵位達到門檻時，動態解鎖 скрынный 隱藏據點 (`isHidden: false`)。

### 🔗 相關關鍵檔案
- 事件數據庫與抉擇：[src/data/EventData.ts](file:///i:/gameproject/Medieval/src/data/EventData.ts)
- 敘事與文本數據：[src/data/NarrativeData.ts](file:///i:/gameproject/Medieval/src/data/NarrativeData.ts)
- 事件系統引擎：[src/systems/EventSystem.ts](file:///i:/gameproject/Medieval/src/systems/EventSystem.ts)
- 據點解鎖與動態生成：[src/systems/MapDynamicsSystem.ts](file:///i:/gameproject/Medieval/src/systems/MapDynamicsSystem.ts)
- 里程碑系統：[src/systems/MilestoneSystem.ts](file:///i:/gameproject/Medieval/src/systems/MilestoneSystem.ts)

---

## 4. 酒館系統設計 (Tavern System & Recruitment)

### 🎯 核心定位
傭兵招募與交流中心，品質發放與酒館建築等級掛鉤，並提供傳聞與特殊英雄小任務。

### 📋 系統規範
- **品質機率池 (`N` / `R` / `SR` / `SSR`)**：
  - 酒館 1 級：90% N, 10% R。
  - 酒館 3 級解鎖 SR 與 SSR 保底抽取。
- **傭兵生成與屬性分配**：
  - 引用 [src/models/Adventurer.ts](file:///i:/gameproject/Medieval/src/models/Adventurer.ts) 權重分布分配六維總合與性格 ([src/systems/DataStore.ts](file:///i:/gameproject/Medieval/src/systems/DataStore.ts) `TraitDB`)。
- **酒館傳聞 (Rumors & Leads)**：
  - 付費向酒館老爹打聽情報，揭露隱藏討伐據點或高屬性傭兵下落。

### 🔗 相關關鍵檔案
- 酒館招募控制器：[src/ui/RecruitController.ts](file:///i:/gameproject/Medieval/src/ui/RecruitController.ts)
- 英雄生成與養成：[src/systems/HeroSystem.ts](file:///i:/gameproject/Medieval/src/systems/HeroSystem.ts)
- 領地建築與酒館等級：[src/models/Territory.ts](file:///i:/gameproject/Medieval/src/models/Territory.ts)

---

## 5. GAMBIT 戰術與 AI 自主決策系統 (Gambit AI Tactical Chains)

### 🎯 核心定位
提供 If-Then 條件鏈戰術板，讓玩家自訂傭兵在自動戰鬥中的技能觸發順序與優先度。

### 📋 系統規範
- **戰術卡槽與條件鏈 (Gambit Slots)**：
  - 條件範例：`[HP < 30%]` ➔ 施放 `PRAYER_HEAL` (祈禱者治癒)。
  - 條件範例：`[敵方後排]` ➔ 施放 `THIEF_SURPRISE_ATTACK` (盜賊偷襲)。
  - 條件範例：`[目標帶有破甲]` ➔ 施放 `GREATSWORD_WHIRLWIND` (狂戰士旋風斬)。
- **UI 預留槽位**：
  - 傭兵小隊面板第 3 頁籤 `✨ 技能戰術` ([src/ui/ModalController.ts](file:///i:/gameproject/Medieval/src/ui/ModalController.ts)) 已預留 Gambit 戰術卡槽。

### 🔗 相關關鍵檔案
- 技能與 AI 權重評估：[src/models/Skill.ts](file:///i:/gameproject/Medieval/src/models/Skill.ts) (`aiWeight`)
- 自動戰鬥模擬引擎：[src/systems/CombatSystem.ts](file:///i:/gameproject/Medieval/src/systems/CombatSystem.ts)
- 技能戰術 UI 頁籤：[src/ui/ModalController.ts](file:///i:/gameproject/Medieval/src/ui/ModalController.ts)

---

## 6. 爵位天賦與特權系統 (Noble Title Talents & Perks)

### 🎯 核心定位
隨著聲望與皇家好感度晉升爵位 (`COMMONER` ➔ `DUKE`)，解鎖領地全域天賦與特權。

### 📋 系統規範
- **爵位階級與晉升條件**：
  - 引用 [src/models/types.ts](file:///i:/gameproject/Medieval/src/models/types.ts#L76-L84) `TITLE_CONFIG` (平民、騎士、男爵、子爵、伯爵、侯爵、公爵)。
- **天賦解鎖分支 (Noble Perks)**：
  - **軍事天賦**：擴充傭兵名冊上限 (`maxRoster`)、解鎖更高官職槽位 (`OfficeType`).
  - **商業天賦**：擴充商隊派遣上限 (`maxCaravans`)、關稅優惠、多隊探索上限 (`maxExpeditions`).
  - **內政天賦**：每 10 人口稅收加成 (`taxBonusPer10Pop`)、建築升級成本減免.

### 🔗 相關關鍵檔案
- 爵位設定與計算：[src/models/types.ts](file:///i:/gameproject/Medieval/src/models/types.ts#L38-L115)
- 領地數據與聲望管理：[src/models/Territory.ts](file:///i:/gameproject/Medieval/src/models/Territory.ts)
- 外交與皇家晉升大典：[src/ui/DiplomacyController.ts](file:///i:/gameproject/Medieval/src/ui/DiplomacyController.ts)

---

## 7. 內政與建築深化系統 (Civic & Base Building Expansion)

### 🎯 核心定位
領地建築獨立建造與升級，維護糧食/木材/石材/鐵礦資源流，與人口治安度單一真相來源連動。

### 📋 系統規範
- **建築設施解鎖與升級 (Building Upgrades)**：
  - **自宅**：解鎖領地內政管理與代官指派。
  - **酒館**：決定招募品質。
  - **武器店 / 防具店**：決定商店解鎖之武具階級 (1~3階)。
  - **鍛造屋**：解鎖裝備強化與拆解。
- **人口與治安度 Single Source of Truth**：
  - 人口動態加總 `workers` (農夫、伐木工、礦工、步/騎/弓兵)，治安度由 `GameEventType.POPULATION_CHANGED` 動態更新。
- **月底發薪與稅收雙軌制**：
  - 每日結算稅收進帳；每 7 天結算傭兵薪資與維護費。

### 🔗 相關關鍵檔案
- 領地建築與資源：[src/models/Territory.ts](file:///i:/gameproject/Medieval/src/models/Territory.ts)
- 內政與人口計算：[src/systems/SettlementSystem.ts](file:///i:/gameproject/Medieval/src/systems/SettlementSystem.ts)
- 建築建造與升級 UI：[src/ui/FacilityController.ts](file:///i:/gameproject/Medieval/src/ui/FacilityController.ts)
- 街道動態建築繪製：[src/ui/UIManager.ts](file:///i:/gameproject/Medieval/src/ui/UIManager.ts)

---

## 📌 結語與維護規範
未來任何 AI 助理接手專案開發時：
1. **必須讀取本藍圖文件**，恪守各模組規範。
2. 涉及變更時，必須同步更新 [docs/CHANGELOG.md](file:///i:/gameproject/Medieval/docs/CHANGELOG.md)、[docs/ARCHITECTURE.md](file:///i:/gameproject/Medieval/docs/ARCHITECTURE.md) 與 [docs/HANDOVER.md](file:///i:/gameproject/Medieval/docs/HANDOVER.md)。
