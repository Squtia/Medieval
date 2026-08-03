# 酒館系統擴充與沉浸感優化計畫 (Tavern System Expansion Plan)

## 🎯 背景與核心目標 (Background & Goals)
根據 `FUTURE_DESIGN.md` 之規範，為了解決現有酒館僅作為單一「抽卡招募」介面的問題，本計畫將導入多層次的互動與敘事機制，將酒館轉變為遊戲世界觀的「情報與任務中樞」。
為了確保系統穩定與開發節奏，本擴充將分為三個階段 (Phase 1 ~ Phase 3) 逐步實作。

---

## 🧱 階段一：傳聞解鎖與情報系統 (Phase 1: Rumors & Intel)
> [!NOTE] 
> 本階段為優先實作項目，開發成本最低，但能立刻串接地圖探索，建立基礎沉浸感。

### 1. 系統機制與邏輯設計
- **傳聞打聽 (Tavern Rumors)**：玩家可在酒館內花費金幣（暫定 50G，可依酒館等級浮動）向酒館老爹打聽情報。
- **情報池與權重 (`RumorData.ts`)**：
  - **一般閒聊 (60%)**：純世界觀文本補充（例如：「聽說北方的山賊越來越猖狂了...」）。
  - **地圖解鎖 (30%)**：呼叫 `MapDynamicsSystem`，將特定 `isHidden: true` 的隱藏據點改為可見（如：發現隱藏的幼龍巢穴）。
  - **臨時增益 (10%)**：觸發微小增益（例如：獲得老爹請客，下一場戰鬥前排防禦 +5%）。
- **防呆機制**：已解鎖的地圖據點，其對應的傳聞必須從抽取池中剔除，避免玩家花冤枉錢。

### 2. 需修改或新增的檔案 (Proposed Changes)
- **[NEW] `src/data/RumorData.ts`**
  - 建立傳聞的資料結構 (`RumorTemplate`)，包含文本、前置條件 (天數/聲望)、觸發結果函數。
- **[MODIFY] `src/ui/RecruitController.ts`**
  - 新增「打聽情報」按鈕 UI。
  - 實作扣款檢查與傳聞隨機抽取邏輯。
- **[MODIFY] `src/systems/MapDynamicsSystem.ts`**
  - 確認是否有暴露出由 ID 點亮隱藏節點的 API，供傳聞系統呼叫。

---

## 💬 階段二：性格動態報價與招募對話 (Phase 2: Dynamic Traits & Pricing)
> [!TIP]
> 結合英雄本身自帶的 `Trait` (性格)，讓招募過程更像在與活人交涉，深化角色塑造。

### 1. 系統機制與邏輯設計
- **專屬招募台詞**：
  - 每個英雄生成時帶有的性格，對應一句專屬台詞。例如：
    - `GREEDY` (貪婪)：「要我賣命可以，得加錢！」
    - `BRAVE` (勇敢)：「又有怪物要討伐了嗎？算我一個！」
- **動態報價機制**：
  - 在英雄生成定價的最後一環，加入性格補正係數。
  - 貪婪：價格 +15%。
  - 狂熱/忠誠：價格 -10%。
  - 孤僻：不接受招募的機率增加 (或需額外條件)。

### 2. 需修改的檔案 (Proposed Changes)
- **[MODIFY] `src/systems/DataStore.ts` 或對應的 `TraitDB`**
  - 在 `Trait` 屬性中擴充 `recruitmentModifier` (價格浮動倍率) 與 `recruitDialogue` (台詞)。
- **[MODIFY] `src/systems/HeroSystem.ts`**
  - 在 `generateHero()` 的價格計算區塊，套用性格的價格浮動倍率。
- **[MODIFY] `src/ui/components/AdventurerCard.ts`**
  - 擴充卡片 UI，在卡片上方或下方加入小型對話框組件 (Speech Bubble)，顯示該英雄的專屬台詞。

---

## 📜 階段三：懸賞佈告欄與突發事件 (Phase 3: Bounties & Tavern Events)
> [!WARNING]
> 本階段牽涉任務狀態追蹤 (Quest Tracking)，開發量較龐大，建議在基礎經濟系統完全穩固後再行開發。

### 1. 系統機制與邏輯設計
- **懸賞任務板 (Bounty Board)**：
  - 新增獨立 UI 分頁，一次展示 3 個隨機生成的討伐委託。
  - 任務內容與 `MONSTERS_AND_ELEMENTS.md` 聯動，要求擊殺特定屬性或類型的怪物。
  - 設有完成期限 (如：3 天內完成)。
- **酒館突發事件 (Tavern Random Events)**：
  - 玩家每次點開酒館介面，有 5% 機率觸發蓋板事件 (Modal Event)。
  - 例如：傭兵起衝突、流浪神官兜售聖水。由玩家進行選擇 (A/B 選項)，產出不同結果。

### 2. 需修改或新增的檔案 (Proposed Changes)
- **[NEW] `src/systems/QuestSystem.ts`**
  - 建立全域任務管理器，追蹤任務狀態 (未接取/進行中/可回報/已失敗)。
- **[MODIFY] `src/systems/CombatSystem.ts`**
  - 在戰鬥結算時，發送擊殺怪物事件給 `QuestSystem` 進行任務計數。
- **[NEW] `src/ui/QuestController.ts`**
  - 負責渲染懸賞佈告欄介面與任務進度條。

---

## 🔍 驗證與測試計畫 (Verification Plan)
- **階段一驗證**：確保金幣扣除正常，抽到解鎖地圖傳聞時，世界地圖對應的節點立刻變為可見，且存檔後狀態不流失。
- **階段二驗證**：檢查不同性格英雄的招募費用是否確實浮動，且卡片台詞無破圖或文本溢出。
- **階段三驗證**：擊殺怪物數量必須能正確被 `QuestSystem` 捕捉並更新進度，完成任務後金幣正常發放。
