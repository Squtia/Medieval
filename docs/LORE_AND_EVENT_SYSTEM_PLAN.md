# 碎片化敘事與事件劇情系統擴充計畫 (Lore, Bosses & Story Events Plan)

## 🎯 背景與核心目標
根據 `FUTURE_DESIGN.md` 第 3 項規範，為提升遊戲世界觀的沉浸感與事件完整性，本計畫旨在透過「碎片化敘事」、「隨機探險事件」以及「史詩 Boss 戰」來豐富玩家的探索體驗。
考量到開發規模，本擴充同樣將分為三個階段 (Phase 1 ~ Phase 3) 逐步推進。

---

## 🧱 階段一：碎片化敘事與地圖隨機事件 (Phase 1: Fragmented Lore & Random Events)
> [!NOTE] 
> 以最低的開發成本，在現有的據點探索中加入文字隨機事件，透過「碎片化的歷史文本」補足古陸大崩解的世界觀。

### 1. 系統機制與邏輯設計
- **探險隨機事件**：玩家派遣部隊探索 (Explore) 地圖據點時，有一定機率觸發「文字抉擇事件」。
  - 例如：在廢墟中發現一座古老的石碑。
  - **選項 A**：仔細解讀 (需要隊伍中有法師) ➔ 獲得古陸歷史敘事文本 + 少量經驗值。
  - **選項 B**：破壞石碑尋找寶物 ➔ 獲得隨機裝備，但有機率受到詛咒 (全隊扣血)。
- **文本資料庫**：建立專屬的世界觀敘事資料庫，將歷史分為多個碎片，玩家收集後可在未來的「圖鑑/日誌」中拼湊出完整故事。

### 2. 需修改或新增的檔案
- **[NEW] `src/data/NarrativeData.ts`**
  - 建立事件與敘事文本池，定義觸發條件與分支結果。
- **[MODIFY] `src/systems/EventSystem.ts`**
  - 擴充事件引擎，支援在探險結束後蓋板彈出文字抉擇 UI (`#modal-event`)。

---

## ⚔️ 階段二：史詩 Boss 與多階段戰鬥 (Phase 2: Epic Bosses & Multi-stage Combat)
> [!TIP]
> 實裝藍圖中規劃的史詩 Boss（如幼年火龍、山賊王），為戰鬥系統加入終局挑戰 (End-game Content)。

### 1. 系統機制與邏輯設計
- **史詩霸體 (Epic Super Armor)**：
  - 新增專屬 Buff（如 `DRAGON_ARMOR`），Boss 免疫暈眩等硬控場，且自帶 30% 最終傷害減免。
- **多階段技能 (Phase Skills)**：
  - Boss 具備血量檢測機制（例如 HP < 50% 時，強制觸發「龍息怒吼」，對全體造成高額魔法傷害並附加燃燒）。
- **故事據點解鎖**：
  - 透過天數或爵位進度（串接 `MilestoneSystem`），動態解鎖 Boss 據點，並伴隨全域廣播提示。

### 2. 需修改的檔案
- **[MODIFY] `src/data/FactionData.ts` 或 `MonsterData.ts`**
  - 新增 Boss 級敵方單位的數值模板與專屬技能設定。
- **[MODIFY] `src/systems/CombatSystem.ts`**
  - 在戰鬥主迴圈中，加入血量閾值檢測，以觸發 Boss 的多階段強制技能。
- **[MODIFY] `src/systems/MapDynamicsSystem.ts`**
  - 實作動態解鎖 Boss 據點的邏輯。

---

## 👑 階段三：唯一神器與跨區域任務鏈 (Phase 3: Legendary Artifacts & Event Chains)
> [!WARNING]
> 本階段牽涉裝備詞綴系統的擴充與長線任務追蹤，需與「裝備數據庫 (DataStore)」深度連動。

### 1. 系統機制與邏輯設計
- **唯一高等武器 (Legendary Artifacts)**：
  - 擊敗史詩 Boss 後必定掉落全服唯一的專屬神兵（例如：擊敗霜寒古龍獲得「絕對零度法杖」）。
  - 神器不僅數值強大，還具備「替換/賦予技能 (`grantedSkill`)」，穿戴後可使用特殊大招。
- **跨區域任務鏈 (Event Chains)**：
  - 將多個獨立事件串聯。例如：據點 A 獲得「生鏽的鑰匙」➔ 據點 B 發現「上鎖的地下陵墓」➔ 解鎖據點 C 的 Boss 戰。

### 2. 需修改或新增的檔案
- **[MODIFY] `src/systems/DataStore.ts` & `EquipmentGenerator.ts`**
  - 擴充裝備庫，加入 `T4` 級別的神器模板，設定 `isUnique: true` 與 `grantedSkill` 綁定。
- **[MODIFY] `src/models/types.ts`**
  - 在 `Equipment` 型別中擴充專屬技能屬性。

---

## 🔍 驗證與測試計畫
- **階段一驗證**：確保探險結束後能正確跳出事件彈窗，選項扣除或給予的資源正確無誤，且文本不發生破圖。
- **階段二驗證**：測試 Boss 霸體是否成功免疫控制，血量低於 50% 時是否能正確插隊施放多階段技能。
- **階段三驗證**：確認擊敗 Boss 後神器確實掉落且具備唯一性（不會重複掉落），穿戴後戰鬥面板能正確替換為專屬技能。
