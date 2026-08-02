# 怪物名單與元素相剋系統說明文件 (Monsters & Elemental Systems)

本文檔詳細記載中世紀戰術放置 RPG 中的 **40 種基礎怪物名單**、**種族質變前綴規則**、**元素相剋傷害算式**，以及 **討伐據點單向隔離與偵查一致性機制**。

---

## 📚 一、40 種基礎怪物資料庫 (`src/data/monsters.json`)

所有怪物採 **扁平化基礎名稱**（不包含 Boss），依據地形與戰力係數 (`powerTier`: 0.4 ~ 2.5) 配置如下：

| 序號 | 怪物 ID | 基礎名稱 | 預設種族 | 相容種族標籤 (`compatibleRaces`) | 出沒地形 (`terrains`) | 基礎戰力 (`powerTier`) | 預設元素 |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| 1 | `goblin` | 哥布林 | `MONSTER` | `MONSTER`, `UNDEAD` | 森林、平原、荒野 | 0.5 | `NONE` |
| 2 | `wild_wolf` | 野狼 | `MONSTER` | `MONSTER`, `UNDEAD` | 森林、雪山、平原 | 0.6 | `NONE` |
| 3 | `skeleton` | 骷髏 | `UNDEAD` | `UNDEAD` | 遺跡、洞穴、荒野 | 0.7 | `DARK` |
| 4 | `ghoul` | 食屍鬼 | `UNDEAD` | `UNDEAD` | 遺跡、森林 | 1.0 | `DARK` |
| 5 | `bandit` | 流寇 | `HUMAN` | `HUMAN` | 平原、荒野、沙漠 | 0.8 | `NONE` |
| 6 | `spider` | 巨蛛 | `MONSTER` | `MONSTER`, `UNDEAD` | 洞穴、森林、遺跡 | 0.9 | `NONE` |
| 7 | `orc` | 半獸人 | `MONSTER` | `MONSTER`, `UNDEAD` | 森林、荒野 | 1.2 | `NONE` |
| 8 | `lizard` | 毒蜥 | `DRAGON` | `DRAGON`, `UNDEAD` | 沙漠、火山、洞穴 | 1.1 | `NONE` |
| 9 | `crossbowman` | 弩手 | `HUMAN` | `HUMAN` | 平原、荒野、森林 | 1.0 | `NONE` |
| 10 | `shaman` | 薩滿 | `HUMAN` | `HUMAN` | 遺跡、荒野、洞穴 | 1.3 | `NONE` |
| 11 | `golem` | 傀儡 | `MONSTER` | `MONSTER` | 火山、洞穴、遺跡 | 1.8 | `NONE` |
| 12 | `wraith` | 幽魂 | `UNDEAD` | `UNDEAD` | 遺跡、沙漠、洞穴 | 1.4 | `DARK` |
| 13 | `rebel` | 叛軍 | `HUMAN` | `HUMAN` | 遺跡、平原 | 1.7 | `NONE` |
| 14 | `death_knight` | 死靈騎士 | `UNDEAD` | `UNDEAD` | 遺跡、火山 | 2.5 | `DARK` |
| 15 | `assassin` | 刺客 | `HUMAN` | `HUMAN` | 遺跡、沙漠 | 2.0 | `NONE` |
| 16 | `bear` | 狂熊 | `MONSTER` | `MONSTER`, `UNDEAD` | 森林、雪山 | 1.5 | `NONE` |
| 17 | `troll` | 巨魔 | `MONSTER` | `MONSTER`, `UNDEAD` | 洞穴、火山、荒野 | 2.2 | `NONE` |
| 18 | `gargoyle` | 石像鬼 | `MONSTER` | `MONSTER` | 遺跡、洞穴 | 1.6 | `NONE` |
| 19 | `scorpion` | 蠍魔 | `MONSTER` | `MONSTER` | 沙漠、火山 | 1.1 | `NONE` |
| 20 | `bat` | 吸血蝠 | `MONSTER` | `MONSTER`, `UNDEAD` | 洞穴、遺跡 | 0.6 | `NONE` |
| 21 | `harpy` | 鷹身女郎 | `MONSTER` | `MONSTER` | 雪山、平原 | 1.3 | `NONE` |
| 22 | `treant` | 樹精 | `MONSTER` | `MONSTER` | 森林 | 1.4 | `NONE` |
| 23 | `beetle` | 甲蟲 | `MONSTER` | `MONSTER` | 沙漠、洞穴 | 0.7 | `NONE` |
| 24 | `yeti` | 雪怪 | `MONSTER` | `MONSTER` | 雪山 | 1.9 | `NONE` |
| 25 | `naga` | 蛇人 | `MONSTER` | `MONSTER` | 沙漠、遺跡 | 1.5 | `NONE` |
| 26 | `specter` | 怨靈 | `UNDEAD` | `UNDEAD` | 遺跡、雪山 | 1.3 | `DARK` |
| 27 | `hellhound` | 惡魔犬 | `MONSTER` | `MONSTER`, `UNDEAD` | 火山、遺跡 | 1.4 | `FIRE` |
| 28 | `zombie` | 殭屍 | `UNDEAD` | `UNDEAD` | 遺跡、洞穴、荒野 | 0.6 | `DARK` |
| 29 | `wight` | 屍魔 | `UNDEAD` | `UNDEAD` | 遺跡、雪山 | 1.8 | `DARK` |
| 30 | `iron_guard` | 鐵甲衛 | `HUMAN` | `HUMAN` | 遺跡、平原 | 1.9 | `NONE` |
| 31 | `barbarian` | 蠻兵 | `HUMAN` | `HUMAN` | 荒野、雪山 | 1.2 | `NONE` |
| 32 | `minotaur` | 牛頭人 | `MONSTER` | `MONSTER` | 洞穴、遺跡、荒野 | 2.4 | `NONE` |
| 33 | `basilisk` | 蜥蜴王 | `DRAGON` | `DRAGON` | 沙漠、洞穴 | 2.1 | `NONE` |
| 34 | `shadow_blade` | 暗影刃 | `HUMAN` | `HUMAN` | 遺跡、森林 | 1.6 | `DARK` |
| 35 | `cultist` | 狂熱者 | `HUMAN` | `HUMAN` | 遺跡、洞穴 | 1.1 | `NONE` |
| 36 | `elemental_golem` | 元素石像 | `MONSTER` | `MONSTER` | 火山、雪山 | 2.3 | `NONE` |
| 37 | `slime` | 史萊姆 | `MONSTER` | `MONSTER` | 森林、平原、洞穴 | 0.4 | `NONE` |
| 38 | `sand_worm` | 沙蠕蟲 | `MONSTER` | `MONSTER` | 沙漠 | 1.7 | `NONE` |
| 39 | `phantom_warrior` | 幻影武士 | `UNDEAD` | `UNDEAD` | 遺跡 | 2.2 | `DARK` |
| 40 | `frost_wolf` | 冰原狼 | `MONSTER` | `MONSTER` | 雪山 | 1.2 | `ICE` |
| 41 | `drake` | 雙足幼龍 | `DRAGON` | `DRAGON` | 火山、雪山、遺跡 | 1.8 | `FIRE` |
| 42 | `wyvern` | 飛龍 | `DRAGON` | `DRAGON` | 火山、雪山 | 2.3 | `ICE` |
| 43 | `draconic_lizard` | 巨角蜥 | `DRAGON` | `DRAGON`, `UNDEAD` | 沙漠、火山 | 1.4 | `NONE` |
| 44 | `skeleton_drake` | 骨龍獸 | `DRAGON` | `DRAGON`, `UNDEAD` | 遺跡、火山、洞穴 | 2.0 | `DARK` |
| 45 | `hydra_spawn` | 幼九頭蛇 | `DRAGON` | `DRAGON` | 森林、洞穴 | 2.4 | `NONE` |
| 46 | `salamander` | 熔岩蜥 | `DRAGON` | `DRAGON` | 火山 | 1.5 | `FIRE` |
| 47 | `thunder_drake` | 迅雷飛龍 | `DRAGON` | `DRAGON` | 雪山、平原 | 2.2 | `LIGHTNING` |
| 48 | `swamp_drake` | 沼澤毒龍 | `DRAGON` | `DRAGON`, `UNDEAD` | 森林、遺跡 | 1.9 | `NONE` |

> 💡 **註**：`DRAGON` 種族的一般怪物（包含毒蜥、蜥蜴王、飛龍、骨龍獸等共 10 種）在一般遭遇抽取時具備較低出現機率（權重 0.25x vs 一般怪 1.0x），少部分（如毒蜥、巨角蜥、骨龍獸、沼澤毒龍）相容 `UNDEAD` 質變標籤。

---

## 🏷️ 二、命名與前綴組合規則 (`MonsterSystem.ts`)

怪物在遭遇生成時，名稱會根據其 **元素** 與 **抽到的種族質變標籤** 動態組合：

$$\text{最終名稱} = [\text{元素前綴}] + [\text{種族質變前綴}] + \text{基礎名稱}$$

### 1. 種族質變前綴邏輯 (`[不死的]`)
- **單一允許 `UNDEAD` 怪物**（如：骷髏、食屍鬼、殭屍）：`compatibleRaces` 僅有 `['UNDEAD']` ➔ **不冠種族前綴**，直接顯示名稱（例如 `骷髏`）。
- **多種相容種族怪物**（如：哥布林、野狼、巨魔）：`compatibleRaces` 包含 2 種以上標籤，且抽到 `UNDEAD` 時 ➔ 冠上前綴 `[不死的]`（例如 `[不死的]哥布林`）。

### 2. 元素前綴邏輯
- `FIRE` ➔ `[火焰的]`
- `ICE` ➔ `[冰冷的]`
- `LIGHTNING` ➔ `[雷電的]`
- `HOLY` ➔ `[聖光的]`
- `DARK` ➔ `[黑暗的]`
- `NONE` ➔ 無前綴

### 3. 組合範例
- 哥布林 (`compatibleRaces: ['MONSTER', 'UNDEAD']`) 抽到 `UNDEAD` 與 `DARK` ➔ **`[黑暗的][不死的]哥布林`**
- 骷髏 (`compatibleRaces: ['UNDEAD']`) 抽到 `FIRE` ➔ **`[火焰的]骷髏`**
- 冰原狼 預設 `ICE` ➔ **`[冰冷的]冰原狼`**

---

## ⚡ 三、元素相剋傷害算式 (`Skill.ts`)

戰鬥運算時，攻擊方單位/武器元素與受擊方怪物元素的傷害乘數 `elemMult` 規範如下：

```ts
export function getElementalMultiplier(atkElement?: ElementType, defElement?: ElementType): number
```

### 1. 三元循環相剋 (順剋 1.25x / 逆剋 0.75x)
- ❄️ **冰** ➔ 🔥 **火** (冰攻擊火 = **1.25x** 順剋，火攻擊冰 = **0.75x** 逆剋)
- 🔥 **火** ➔ ⚡ **雷** (火攻擊雷 = **1.25x** 順剋，雷攻擊火 = **0.75x** 逆剋)
- ⚡ **雷** ➔ ❄️ **冰** (雷攻擊冰 = **1.25x** 順剋，冰攻擊雷 = **0.75x** 逆剋)

### 2. 光與暗相剋 (1.5x / 不逆剋)
- ☀️ **光 (`HOLY`)** ↔️ 🌑 **暗 (`DARK`)**：互相剋制，造成 **1.5x** 巨額傷害。
- ☀️ **光 (`HOLY`)** ➔ 🔥火 / ❄️冰 / ⚡雷：造成 **1.05x** 傷害（不逆剋）。
- 🌑 **暗 (`DARK`)** ➔ 🔥火 / ❄️冰 / ⚡雷：造成 **1.10x** 傷害（不逆剋）。

### 3. 火對無屬性 (1.05x)
- 🔥 **火 (`FIRE`)** ➔ ⚪ **無屬性 (`NONE`)**：造成 **1.05x** 傷害（不逆剋）。

---

## 🛡️ 四、討伐據點單向隔離與偵查一致性機制

### 1. 單向隔離法則 (Asymmetric Spawning)
- **常規生靈據點**：敵軍標籤僅允許 `MONSTER` / `HUMAN`，**嚴格排除 `UNDEAD`**，不會突兀冒出殭屍。
- **亡靈據點 (`allowedRaces: [UNDEAD]`)**：以 `UNDEAD` 敵軍為主體 (70%+)，允許混入少量 `HUMAN` (如死靈法師) 或 `MONSTER` (如墓穴巨蛛)。

### 2. 偵查與戰鬥 100% 一致性 (`node.scoutData.garrisonEncounter`)
- 當斥候成功偵查據點時，`MonsterSystem.generateNodeEncounter(node)` 會生成敵軍小隊並**持久化儲存在 `node.scoutData.garrisonEncounter`** 中。
- 玩家於據點面板查看的敵軍名單、威脅元素與據點詞綴（如 `MIASMA` 瘴氣、`BLIZZARD` 暴風雪），即為隨後玩家發起討伐時實際對抗的敵軍，保證 100% 精確一致。
