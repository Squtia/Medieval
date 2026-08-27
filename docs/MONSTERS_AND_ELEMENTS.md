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

## 🎯 攻擊類型與距離規範 (`attackType`)

所有怪物實體均包含明確的 `attackType: 'MELEE' | 'RANGED' | 'MAGIC'` 標籤：
* **`MELEE` (近戰物理)**：絕大多數野獸與魔物（如哥布林、野狼、狂熊、巨魔、石像鬼）。在常規戰鬥中優先攻擊敵方前排；在**守城戰中 100% 受到城門阻隔**，若敵方無前排守軍則無法攻擊中後排，所有傷害強制轉化為對要塞城門的撞擊打擊！
* **`RANGED` (遠程物理)**：如弩手 (`crossbowman`)。可隔著前排與城門直接射擊敵方中後排，守城戰中守軍享有 25% 城垛掩體減傷。
* **`MAGIC` (遠程魔法)**：如薩滿 (`shaman`)、幽魂 (`wraith`)、怨靈 (`specter`)、狂熱者 (`cultist`)。普攻與技能結算目標 MDEF 魔法防禦，可越過城門施法轟擊，守城戰中守軍享有 25% 城垛掩體減傷。

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

## ⚡ 三、元素相剋傷害算式 (`Skill.ts` & `CombatMath.ts`)

戰鬥運算時，全面採用**「攻防分離雙元素」**機制進行相剋運算：

$$\text{元素相剋乘數} = \text{getElementalMultiplier}(\text{攻擊方 atkElement}, \text{防守方 defElement})$$

- **攻擊方元素 (`atkElement`)**：
  - **傭兵**：來自**【主手武器】(`WEAPON.element`)**。例如手持**熾炎大劍🔥**攻擊**雷霆魔物⚡**，觸發火剋雷 **1.25x (125%) 剋制增傷**！
  - **魔物**：來自魔物原生元素屬性（如惡魔犬🔥、冰原狼❄️、死靈魔物🌙）。
- **防守方元素 (`defElement`)**：
  - **傭兵**：來自**【身穿防具】(`ARMOR.element`)**。例如身穿**霜冰鎧甲❄️**抵禦火系怪物攻擊，觸發逆剋防護折減！
  - **魔物**：來自魔物原生元素屬性。

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

---

## 📊 五、怪物數值生成模型與稀有挑戰據點機制

### 1. 怪物戰力分與屬性換算公式 (`MonsterSystem.ts`)
- **屬性預算量綱對齊**：
  $$\text{baseBudget} = \max(15, \lfloor\text{baseDifficulty} \times \text{powerTier} \times \text{raceMult} \times 55\rfloor)$$
  * 以 1 級標準傭兵（約 45~65 戰力）為基準，難度 1 時一隻 1.0 階標準怪戰力約 45~55 點。
  * 據點駐守 1~2 隻標準怪物的總戰力約為 **55~85 點**，精準對齊開局 1 人出征。
- **面板屬性計算**：
  * 生命值 (HP)：$\max(45, \lfloor\text{baseBudget} \times \text{hpRatio} \times 2.8\rfloor)$（確保承受 3~4 輪技能/普攻）
  * 攻擊力 (Damage)：$\max(12, \lfloor\text{baseBudget} \times \text{atkRatio} \times 1.15\rfloor)$（對 1 級傭兵造成 18~24 點實質傷害）
  * 物理防禦 (PDEF)：$\lfloor\text{baseBudget} \times \text{pdefRatio} \times 1.2\rfloor$
  * 魔法防禦 (MDEF)：$\lfloor\text{baseBudget} \times \text{mdefRatio} \times 1.2\rfloor$
  * 出手速度 (Speed)：$\max(4, \lfloor\text{baseBudget} \times 0.12\rfloor)$
- **大一統戰力計分 (`calculatedPowerScore`)**：
  $$\text{Power} = \text{Damage} + \lfloor\frac{\text{PDEF} + \text{MDEF}}{2} \times 0.6\rfloor + \lfloor\text{HP} \times 0.2\rfloor + \lfloor\text{Speed} \times 0.5\rfloor$$
- **戰利品回報標準**：
  * 金幣回報：$\lfloor\text{Power} \times 1.0\rfloor$
  * 經驗值回報：$\lfloor\text{Power} \times 0.25\rfloor$ (升級節奏健康拉長，1 級升 2 級約需 7 場討伐)
- **法系怪攻擊機制 (`isMagicalAttacker`)**：
  * 薩滿、幽魂、怨靈、狂熱者、元素石像、隨軍法師等法系怪物，普通攻擊為 `DamageType.MAGICAL`，結算防守者的 MDEF。

### 2. 8 大戰鬥定位屬性權重分配 (Normalized Stat Profiles)
為了解決魔物數值同質化問題，在總屬性預算 ($\text{baseBudget}$) 鎖死不破壞平衡的前提下，導入 **8 大定位權重比**，依比例換算 HP、ATK、PDEF、MDEF、Speed 與 Evade：

| 戰鬥定位 (`MonsterProfile`) | 標誌特徵 | 屬性權重配比 (HP / ATK / PDEF / MDEF / SPD / EVA) | 代表怪物 |
| :--- | :--- | :--- | :--- |
| `🛡️ TANK (鐵壁肉盾)` | 超高生命與物防，站前排阻擋 | `45 / 26 / 32 / 16 / 6 / 0` | 傀儡、鐵甲衛、石像鬼 |
| `⚡ ASSASSIN (疾風刺客)` | 極速先手、高爆發、高閃避 | `22 / 44 / 8 / 8 / 20 / 16` | 野狼、刺客、暗影刃、吸血蝠 |
| `🔮 MAGE (奧術法師)` | 高魔法傷害、高魔防 | `25 / 45 / 8 / 28 / 10 / 6` | 薩滿、幽魂、怨靈、狂熱者 |
| `🩸 BERSERKER (嗜血狂戰)` | 極高物傷輸出、中等血量 | `34 / 50 / 10 / 8 / 12 / 4` | 狂熊、半獸人、蠻兵、牛頭人 |
| `🏹 RANGER (遠程狙擊)` | 遠程精準打擊、高命中 | `26 / 40 / 10 / 12 / 18 / 12` | 弩手、鷹身女郎、沙蠕蟲 |
| `💀 JUGGERNAUT (亡靈泥沼)` | 超巨量生命、高堅韌、低速 | `50 / 36 / 20 / 16 / 6 / 0` | 巨魔、雪怪、樹精、食屍鬼 |
| `👑 BOSS (史詩首領)` | 全屬性均衡強化、霸體威壓 | `42 / 38 / 20 / 18 / 14 / 8` | 飛龍、死靈騎士、幼九頭蛇 |
| `⚖️ BALANCED (常規均衡)` | 經典標準平衡配置 | `38 / 34 / 16 / 14 / 10 / 6` | 哥布林、流寇、巨蛛、甲蟲 |

- **種族修正**：
  * `UNDEAD (不死族)`：生命 +6、物防 +4、魔防 +4、閃避歸 0。

---

## 🧠 六、單一真相技能中樞與通用魔物技能 (`SkillRegistry.ts` & `SkillData.ts`)

### 1. 單一真相來源架構 (Single Source of Truth)
- 專案內所有技能（包含傭兵基礎技能、進階職業技能、通用魔物技能與裝備特技）皆由 `SkillRegistry` 統一註冊與管理。
- **分類自動推導**：`HERO_BASE` (傭兵基礎)、`HERO_ADVANCED` (進階轉職)、`MONSTER` (通用魔物)、`EQUIPMENT` (裝備特技)。
- **工坊與遊戲共用**：戰鬥平衡工坊 (`CombatStudio.ts`)、戰鬥系統 (`CombatSystem.ts`) 與魔物創造器自動共享同一個技能庫，無需重複編寫代碼。

### 2. 10 款通用魔物技能 (去個體特定化命名)
所有魔物技能皆採用通用型命名，可靈活掛載於任意怪物原型：

1. 🧪 **【劇毒噴吐】(`SKILL_TOXIC_SPRAY`)**：造成 90% 傷害，並對目標施加 2 回合【中毒】。
2. 🐾 **【撕裂爪擊】(`SKILL_SAVAGE_REND`)**：造成 120% 物理傷害，並附加 3 回合【流血】。
3. 🔨 **【粉碎重擊】(`SKILL_CRUSHING_SLAM`)**：造成 130% 重擊傷害，降低目標 25% 物理防禦。
4. 🩸 **【嗜血打擊】(`SKILL_BLOOD_DRAIN`)**：造成 100% 傷害，並將 50% 傷害轉化為自身 HP。
5. 😱 **【尖嘯震懾】(`SKILL_TERROR_SCREECH`)**：全體震懾，全體敵方攻擊力降低 20% 持續 2 回合。
6. 👤 **【暗影突襲】(`SKILL_SHADOW_ASSAULT`)**：瞬間突進敵方後排，造成 140% 暴擊傷害。
7. 🔥 **【烈焰轟爆】(`SKILL_FLAME_BURST`)**：造成 125% 火焰魔法傷害，並附加【灼燒】。
8. ❄️ **【冰霜吐息】(`SKILL_FROST_BREATH`)**：橫排全體 80% 冰霜傷害，降低目標 30% 速度。
9. 🛡️ **【堅石甲殼】(`SKILL_IRON_DEFENSE`)**：自身防禦力提升 50% 持續 3 回合。
10. 🦁 **【狂暴怒吼】(`SKILL_FRENZY_ROAR`)**：使自身攻擊力提升 35%，但防禦力降低 15%。

---

## 🏰 七、領地近郊生態三階梯據點機制 (`MapEventSystem.ts`)
- **🟢 50% 小型落單威脅 (難度 1)**：1~2 隻初階怪 (戰力 ~55~65)，適合開局 1 人單挑。
- **🟡 35% 中型營地巢穴 (難度 2~3)**：2~3 隻普通怪 (戰力 ~110~160)，適合 2~3 人小隊。
- **🔴 15% 稀有凶煞首領 (難度 3~4, `isEliteLair`)**：
  * **首領駐軍**：高階精英怪/龍族領軍，100% 附加環境詞綴。
  * **專屬冠名**：冠上 `💀[凶兆]`、`👑[首領]`、`🔥[極危險]` 前綴。
  * **超額戰利品**：金幣與經驗值 **3 倍**，裝備掉落率保底 35%，高機率掉落藍紫色裝備或稀有圖紙。
