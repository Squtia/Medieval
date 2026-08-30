# 怪物名單、元素相剋與動態副將系統手冊 (Monsters, Elements & Vice-Commander System)

本文檔詳細記載中世紀戰術放置 RPG 中的 **64+ 隻全魔物母庫**、**種族質變前綴規則**、**元素相剋傷害算式**、**討伐據點單向隔離與偵查一致性機制**，以及 **雙實體英雄綁定與動態副將接替規範**。

---

## 📚 一、64+ 隻全魔物與陣營軍團資料庫 (`src/data/monsters.json`)

所有怪物採 **扁平化基礎名稱**（包含基礎魔物、龍族、Boss 與各大派系正規軍團單位），依據地形與戰力係數 (`powerTier`: 0.4 ~ 3.5) 配置如下：

### 1. 常規魔物、異獸與死靈族 (48 款)
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

### 2. 派系正規軍團單位 (Faction Army Units)
| 序號 | 單位 ID | 單位名稱 | 預設種族 | 攻擊型態 | 基礎戰力 | 歸屬派系 |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| 49 | `f_lothgar_0` | 洛斯加徵召步兵 | `HUMAN` | `MELEE` | 1.0 | 👑 洛斯加中央王室 |
| 50 | `f_lothgar_1` | 洛斯加精銳長弓手 | `HUMAN` | `RANGED` | 1.5 | 👑 洛斯加中央王室 |
| 51 | `f_lothgar_2` | 洛斯加皇家重裝騎士 | `HUMAN` | `MELEE` | 2.4 | 👑 洛斯加中央王室 |
| 52 | `f_lothgar_3` | 洛斯加宮廷隨軍法師 | `HUMAN` | `MAGIC` | 1.8 | 👑 洛斯加中央王室 |
| 53 | `f_lothgar_4` | 洛斯加近衛大劍士 | `HUMAN` | `MELEE` | 2.2 | 👑 洛斯加中央王室 |
| 54 | `f_lothgar_5` | 洛斯加重裝神射弩衛 | `HUMAN` | `RANGED` | 2.0 | 👑 洛斯加中央王室 |

### 3. 史詩 Boss 與唯一首領
| 序號 | Boss ID | 首領名稱 | 預設種族 | 攻擊型態 | 基礎戰力 | 特殊機制與定位 |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| 55 | `boss_bandit_king` | 山賊王·巴洛克 | `HUMAN` | `MELEE` | 2.8 | 帶領 2 波護衛，高爆發劈砍 |
| 56 | `boss_fire_drake` | 狂怒火龍 | `DRAGON` | `MAGIC` | 3.2 | 龍息全體灼燒，霸體減傷 |
| 57 | `boss_lich_king` | 死靈法王 | `UNDEAD` | `MAGIC` | 3.5 | 召喚骷髏大軍，暗黑護盾 |

---

## 🎯 攻擊類型與距離規範 (`attackType`)

所有怪物實體均包含明確的 `attackType: 'MELEE' | 'RANGED' | 'MAGIC'` 標籤：
* **`MELEE` (近戰物理)**：優先攻擊敵方前排；在**守城戰中 100% 受到城門阻隔**，若敵方無前排守軍則無法攻擊中後排，所有傷害強制轉化為對要塞城門的撞擊打擊！
* **`RANGED` (遠程物理)**：如弩手、長弓手。可隔著前排與城門直接射擊敵方中後排，守城戰中守軍享有 25% 城垛掩體減傷。
* **`MAGIC` (遠程魔法)**：如薩滿、隨軍法師、幽魂。普攻與技能結算目標 MDEF 魔法防禦，可越過城門施法轟擊，守城戰中守軍享有 25% 城垛掩體減傷。

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

---

## ⚡ 三、元素相剋傷害算式 (`Skill.ts` & `CombatMath.ts`)

戰鬥運算時，全面採用**「攻防分離雙元素」**機制進行相剋運算：

$$\text{元素相剋乘數} = \text{getElementalMultiplier}(\text{攻擊方 atkElement}, \text{防守方 defElement})$$

- **攻擊方元素 (`atkElement`)**：傭兵來自**【主手武器】(`WEAPON.element`)**；魔物來自原生元素。
- **防守方元素 (`defElement`)**：傭兵來自**【身穿防具】(`ARMOR.element`)**；魔物來自原生元素。

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
- **亡靈據點 (`allowedRaces: [UNDEAD]`)**：以 `UNDEAD` 敵軍為主體 (70%+)，允許混入少量 `HUMAN` 或 `MONSTER`。

### 2. 偵查與戰鬥 100% 一致性 (`node.scoutData.garrisonEncounter`)
- 當斥候成功偵查據點時，`MonsterSystem.generateNodeEncounter(node)` 會生成敵軍小隊並**持久化儲存在 `node.scoutData.garrisonEncounter`** 中。
- 玩家於據點面板查看的敵軍名單、威脅元素與據點詞綴，即為隨後玩家發起討伐時實際對抗的敵軍，保證 100% 精確一致。

---

## 📊 五、怪物數值生成模型與戰鬥定位權重

### 1. 8 大戰鬥定位屬性權重分配 (Normalized Stat Profiles)
| 戰鬥定位 (`MonsterProfile`) | 標誌特徵 | 屬性權重配比 (HP / ATK / PDEF / MDEF / SPD / EVA) | 代表怪物 |
| :--- | :--- | :--- | :--- |
| `🛡️ TANK (鐵壁肉盾)` | 超高生命與物防，站前排阻擋 | `45 / 26 / 32 / 16 / 6 / 0` | 傀儡、鐵甲衛、石像鬼 |
| `⚡ ASSASSIN (疾風刺客)` | 極速先手、高爆發、高閃避 | `22 / 44 / 8 / 8 / 20 / 16` | 野狼、刺客、暗影刃、吸血蝠 |
| `🔮 MAGE (奧術法師)` | 高魔法傷害、高魔防 | `25 / 45 / 8 / 28 / 10 / 6` | 薩滿、幽魂、怨靈、隨軍法師 |
| `🩸 BERSERKER (嗜血狂戰)` | 極高物傷輸出、中等血量 | `34 / 50 / 10 / 8 / 12 / 4` | 狂熊、半獸人、蠻兵、牛頭人 |
| `🏹 RANGER (遠程狙擊)` | 遠程精準打擊、高命中 | `26 / 40 / 10 / 12 / 18 / 12` | 弩手、鷹身女郎、神射弩衛 |
| `💀 JUGGERNAUT (亡靈泥沼)` | 超巨量生命、高堅韌、低速 | `50 / 36 / 20 / 16 / 6 / 0` | 巨魔、雪怪、樹精、食屍鬼 |
| `👑 BOSS (史詩首領)` | 全屬性均衡強化、霸體威壓 | `42 / 38 / 20 / 18 / 14 / 8` | 飛龍、死靈騎士、幼九頭蛇 |
| `⚖️ BALANCED (常規均衡)` | 經典標準平衡配置 | `38 / 34 / 16 / 14 / 10 / 6` | 哥布林、流寇、巨蛛、甲蟲 |

---

## 🔗 六、雙實體英雄綁定與動態副將接替規範 (Dynamic Vice-Commander Engine)

為了解決「名將英雄被玩家招降/俘虜/擊殺後，敵方討伐據點或軍團直接破產甚至出錯」的底層架構難題，專案導入了 **雙實體身分綁定與動態副將接替引擎**：

1. **雙實體唯一身分綁定 (`characterKey`)**：
   - 英雄實體 (`UniqueHeroDef`) 與敵方怪物實體 (`MonsterData`) 皆可配置唯一的 `characterKey`（例如 `char_vanguard_reyn`）。
   - 怪物可透過 `substituteMonsterId` 指定專屬的代理副將範本 ID。
2. **動態副將解析演算法 (`FactionArmyGenerator.resolveTroopMember`)**：
   - 當戰鬥系統實例化部隊 (`instantiateCombatGroup`) 時，即時檢查該成員是否已被玩家收編（存在於 `GameState.myTerritory.adventurers`、已陣亡或正處於俘虜監獄）。
   - **接替順位**：
     - ① 若已收編且配置了 `substituteMonsterId` ➔ 直接調用指定的副將範本。
     - ② 若未指定專屬副將 ➔ 調用 `getBestSubstituteMonsterId` 自動保底演算法：篩選出「**同攻擊型態 (MELEE/RANGED/MAGIC) + 該派系正規人類軍團 + 戰力階級最接近**」的正規軍官。
     - ③ 將生成的代理副將名稱冠以 **`【代理副將】`** 稱號（例如：`【代理副將】洛斯加近衛大劍士`），接替原英雄出征。
3. **部隊藍圖 100% 唯讀隔離**：
   - 據點工坊與資料庫中的原始討伐隊伍藍圖維持 100% 唯讀，副將替換僅在戰鬥實例化時於記憶體動態運算，絕不污染持久化資料。
