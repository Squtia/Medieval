# 技能工房規格書（可移交執行版）

> 狀態：**待執行** | 更新：2026-08-25
> 此文件可直接交由其他 AI 模型閱讀後開始執行

---

## 零、執行前必讀規範

接手此任務的模型**必須**遵守以下規則（來自 `d:\tryagent\Medieval\.agents\AGENTS.md`）：

1. **繁體中文（台灣語系）**回覆，所有代碼注釋也使用繁體中文
2. **禁止直接動工**，每個 Phase 開始前先以對話確認使用者同意
3. **測試迴圈上限 2 次**，第 3 次失敗必須停下提供替代方案
4. **每完成一個 Phase**，必須同步更新 `docs/CHANGELOG.md` 與 `docs/HANDOVER.md`
5. **測試指令**（Windows 環境，避免 PowerShell 權限問題）：
   - `cmd.exe /c "npm run test"`
   - `cmd.exe /c "npx.cmd tsc --noEmit"`
6. **禁止對 `index.html` 使用 Overwrite:true**，UI 改動請修改對應 template 檔案

---

## 一、已確認的設計決策

| 項目 | 決策 |
|---|---|
| 傭兵技能遷移 | **不遷移**，維持現有硬編碼不動 |
| 怪物技能遷移 | **全部轉換**為積木格式（10 個） |
| Phase 1 驗收標準 | 用積木格式定義 `CATACLYSM_FLAME`、`DRAGON_ROAR`，跑戰鬥沙盒確認可執行 |
| Phase 2 新機制範圍 | **全部實裝**（見第五節清單） |
| 工房介面操作方式 | **純 UI 點選**，使用者不需寫任何代碼 |

---

## 二、專案目錄結構（關鍵路徑）

```
d:\tryagent\Medieval\
├── src\
│   ├── models\
│   │   ├── Skill.ts          ← 技能介面定義（Phase 1 新增積木介面）
│   │   └── Combat.ts         ← StatusEffectType（Phase 1 新增 6 種狀態）
│   ├── data\
│   │   ├── SkillData.ts      ← 1727行，怪物技能區塊在 L1285~L1584
│   │   └── CustomSkillData.json  ← 【全新建立】工房技能儲存檔
│   ├── systems\
│   │   ├── CombatSystem.ts   ← 主戰鬥引擎（Phase 2 新增觸發鉤子）
│   │   └── combat\
│   │       ├── SkillRegistry.ts      ← 修改以合併 CustomSkillData.json
│   │       └── SkillEffectEngine.ts  ← 【全新建立】積木執行引擎
│   ├── templates\
│   │   └── skill-workshop.html  ← 【全新建立】工房 UI 模板
│   └── tools\
│       ├── SkillWorkshop.ts      ← 【全新建立】工房邏輯控制器
│       └── SkillWorkshop.test.ts ← 【全新建立】單元測試
└── docs\
    ├── CHANGELOG.md   ← 每 Phase 完成後更新
    └── HANDOVER.md    ← 每 Phase 完成後更新
```

---

## 三、現有程式碼關鍵摘要

### `src/models/Skill.ts`（現有結構，勿刪除）

```typescript
export enum TargetType {
  SINGLE_ENEMY = 'SINGLE_ENEMY',
  ALL_ENEMIES = 'ALL_ENEMIES',
  FRONT_ENEMIES = 'FRONT_ENEMIES',
  BACK_ENEMY = 'BACK_ENEMY',
  COLUMN = 'COLUMN',
  SELF = 'SELF',
  ALLY_LOWEST_HP = 'ALLY_LOWEST_HP',
  ALL_ALLIES = 'ALL_ALLIES'
}
export type SkillCategory = 'HERO_BASE' | 'HERO_ADVANCED' | 'MONSTER' | 'EQUIPMENT';
export interface Skill {
  id: string; name: string; mpCost: number;
  targetType: TargetType; description: string;
  cooldown?: number; category?: SkillCategory; icon?: string;
  aiWeight?: (caster, skillTargets, allEnemies?, allAllies?) => number;
  execute: (caster, targets, allEnemies?, allAllies?) => CombatEvent[];
}
```

### `src/models/Combat.ts`（現有 StatusEffectType）

現有 15 種狀態：`BLEED, POISON, BURN, STUN, TAUNT, FEAR, ARMOR_BREAK, SHOCK, REGEN_HP, REGEN_MP, BUFF_PATK, BUFF_MATK, BUFF_PDEF, BUFF_DEF, BUFF_EVADE`

---

## 四、Phase 1 規格：積木引擎基礎

### 目標

建立「積木格式技能定義 → 戰鬥引擎可執行」的完整路徑，**完全不修改現有戰鬥引擎邏輯**。

### Step 1-A：在 `src/models/Skill.ts` 末尾追加積木介面

```typescript
// ===== 積木技能系統 (Composite Skill System) =====

export type SkillTrigger =
  | 'ACTIVE'          // 主動施放（預設）
  | 'ON_HIT_TAKEN'    // 受到攻擊後（Phase 2 引擎鉤子）
  | 'ON_KILL'         // 擊殺目標後（Phase 2）
  | 'ON_CRIT'         // 爆擊命中後（Phase 2）
  | 'ON_HP_THRESHOLD' // HP 低於 X% 首次（Phase 2）
  | 'ON_TURN_START'   // 每回合開始（Phase 2）
  | 'ON_MARK_STACK';  // 累積 N 層標記後自動爆發

export interface SkillCost {
  mpCost?: number;
  hpPercent?: number;      // 消耗自身 HP 的 X%
  consumeMarks?: boolean;  // 消耗目標 MARK 層數
}

export type SkillConditionType =
  | 'NONE' | 'TARGET_HP_GTE' | 'TARGET_HP_LT' | 'SELF_HP_LT'
  | 'TARGET_HAS_STATUS' | 'ALLY_EXISTS' | 'NO_ALLY' | 'IS_CRIT';

export interface SkillCondition {
  type: SkillConditionType;
  value?: number;    // 數值門檻（HP%）
  status?: string;   // 目標狀態類型
}

export type SkillEffectType =
  | 'DAMAGE_PHYSICAL' | 'DAMAGE_MAGICAL' | 'DAMAGE_MIXED' | 'DAMAGE_TRUE'
  | 'HEAL' | 'LIFESTEAL' | 'MULTI_HIT'
  | 'APPLY_STATUS' | 'SET_MARK' | 'DETONATE_MARKS'
  | 'APPLY_BARRIER' | 'CHAIN_DAMAGE' | 'EXECUTE'
  | 'DISPEL' | 'STEAL_BUFF' | 'DELAYED_BOMB' | 'MP_DRAIN'
  | 'FORCE_ROW_CHANGE' | 'FIELD_EFFECT'
  | 'BUFF_SELF' | 'BUFF_ALLIES';

export type SkillScaleType =
  | 'FIXED' | 'BY_MARK_STACKS' | 'BY_SELF_LOST_HP'
  | 'BY_KILL_COUNT' | 'BY_ALLY_COUNT' | 'BY_STATUS_COUNT';

export interface EffectBlock {
  trigger: SkillTrigger;
  cost?: SkillCost;
  condition?: SkillCondition;
  effectType: SkillEffectType;
  targetType: TargetType;
  // 傷害/治療
  multiplier?: number;
  element?: string;          // 'FIRE'|'ICE'|'LIGHTNING'|'HOLY'|'DARK'|'NONE'
  physRatio?: number;        // 混合傷害物理比例（0~1）
  hitCount?: number;         // 多段攻擊次數
  lifeStealRate?: number;    // 吸血比例（0~1）
  chainCount?: number;       // 連鎖跳次數
  executeThreshold?: number; // 斬殺 HP 門檻（0~1）
  // 狀態
  statusType?: string;
  statusDuration?: number;
  statusValue?: number;
  statusChance?: number;     // 附加機率（省略=必定）
  // 增益
  buffType?: string;         // StatusEffectType 字串
  buffValue?: number;
  buffDuration?: number;
  // 護盾
  barrierAmount?: number;
  // 延遲炸彈
  delayTurns?: number;
  delayEffect?: EffectBlock;
  // 戰場效果
  fieldType?: string;        // 'FIRE_FIELD'|'HOLY_GROUND'|'CURSE_FIELD'
  fieldDuration?: number;
  // 縮放
  scaleType?: SkillScaleType;
  // 條件分支
  onTrue?: EffectBlock[];
  onFalse?: EffectBlock[];
}

export interface CompositeSkillDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: SkillCategory;
  totalMpCost: number;
  cooldown?: number;
  blocks: EffectBlock[];
}
```

### Step 1-B：在 `src/models/Combat.ts` 的 `StatusEffectType` enum 末尾追加

在 `BUFF_EVADE = 'BUFF_EVADE'` 後追加（注意需在上一行加逗號）：

```typescript
  MARK = 'MARK',               // 標記（可疊加，被引爆技能消耗）
  BARRIER = 'BARRIER',         // 吸傷護盾
  DELAYED_BOMB = 'DELAYED_BOMB', // 延遲炸彈
  FIELD_FIRE = 'FIELD_FIRE',   // 火焰場地
  FIELD_HOLY = 'FIELD_HOLY',   // 聖域
  FIELD_CURSE = 'FIELD_CURSE'  // 詛咒場地
```

### Step 1-C：建立 `src/systems/combat/SkillEffectEngine.ts`

```typescript
import { CompositeSkillDefinition, EffectBlock, Skill, TargetType, SkillCondition } from '../../models/Skill';
import { CombatParticipant, CombatEvent, CombatEventType, StatusEffectType, tryApplyStatus } from '../../models/Combat';
import { DamageType } from '../../models/types';
import { getPatk, getMatk, calculateSkillDamage } from '../../utils/CombatMath';
import { Random } from '../../core/Random';

/**
 * 積木技能解譯 & 執行引擎
 * 將 CompositeSkillDefinition 轉換為 CombatSystem 可呼叫的 Skill 物件
 */
export class SkillEffectEngine {

  /** 將積木定義編譯為可執行的 Skill 物件 */
  public static compile(def: CompositeSkillDefinition): Skill {
    return {
      id: def.id,
      name: def.name,
      mpCost: def.totalMpCost,
      targetType: def.blocks[0]?.targetType ?? TargetType.SINGLE_ENEMY,
      description: def.description,
      cooldown: def.cooldown,
      category: def.category,
      icon: def.icon,
      aiWeight: (_caster, targets) => def.totalMpCost * targets.length,
      execute: (caster, targets, allEnemies, allAllies) => {
        const events: CombatEvent[] = [];
        for (const block of def.blocks) {
          if (block.trigger !== 'ACTIVE') continue; // Phase 2 才處理其他觸發
          events.push(...SkillEffectEngine.executeBlock(block, caster, targets, allEnemies ?? [], allAllies ?? []));
        }
        return events;
      }
    };
  }

  /** 執行單一積木（含條件判斷與分支） */
  public static executeBlock(
    block: EffectBlock,
    caster: CombatParticipant,
    targets: CombatParticipant[],
    allEnemies: CombatParticipant[],
    allAllies: CombatParticipant[]
  ): CombatEvent[] {
    if (block.condition && block.condition.type !== 'NONE') {
      const met = SkillEffectEngine.checkCondition(block.condition, caster, targets, allAllies);
      if (!met) {
        return (block.onFalse ?? []).flatMap(b => SkillEffectEngine.executeBlock(b, caster, targets, allEnemies, allAllies));
      }
      if (block.onTrue) {
        return block.onTrue.flatMap(b => SkillEffectEngine.executeBlock(b, caster, targets, allEnemies, allAllies));
      }
    }
    return SkillEffectEngine.applyEffect(block, caster, targets, allEnemies, allAllies);
  }

  /** 判斷條件是否成立 */
  private static checkCondition(
    cond: SkillCondition,
    caster: CombatParticipant,
    targets: CombatParticipant[],
    allies: CombatParticipant[]
  ): boolean {
    const t = targets[0];
    switch (cond.type) {
      case 'NONE': return true;
      case 'TARGET_HP_GTE': return !!t && (t.currentHp / t.maxHp) >= (cond.value ?? 0.7);
      case 'TARGET_HP_LT':  return !!t && (t.currentHp / t.maxHp) < (cond.value ?? 0.3);
      case 'SELF_HP_LT':    return (caster.currentHp / caster.maxHp) < (cond.value ?? 0.3);
      case 'TARGET_HAS_STATUS': return t?.statusEffects.some(s => s.type === cond.status) ?? false;
      case 'ALLY_EXISTS':   return allies.some(a => a.id !== caster.id && a.currentHp > 0);
      case 'NO_ALLY':       return !allies.some(a => a.id !== caster.id && a.currentHp > 0);
      default: return true;
    }
  }

  /** 執行效果本體 */
  private static applyEffect(
    block: EffectBlock,
    caster: CombatParticipant,
    targets: CombatParticipant[],
    allEnemies: CombatParticipant[],
    _allAllies: CombatParticipant[]
  ): CombatEvent[] {
    const events: CombatEvent[] = [];
    const mult = block.multiplier ?? 1.0;

    switch (block.effectType) {
      case 'DAMAGE_PHYSICAL':
        targets.forEach(target => {
          const { damage, isCrit } = calculateSkillDamage(caster, target, getPatk(caster) * mult, DamageType.PHYSICAL);
          target.currentHp = Math.max(0, target.currentHp - damage);
          events.push({ type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT, actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name, damage, targetHp: target.currentHp, targetMaxHp: target.maxHp, text: `${caster.name} 對 ${target.name} 造成 ${damage} 點物理傷害！` });
        });
        break;

      case 'DAMAGE_MAGICAL':
        targets.forEach(target => {
          const { damage, isCrit } = calculateSkillDamage(caster, target, getMatk(caster) * mult, DamageType.MAGICAL);
          target.currentHp = Math.max(0, target.currentHp - damage);
          events.push({ type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT, actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name, damage, targetHp: target.currentHp, targetMaxHp: target.maxHp, text: `${caster.name} 對 ${target.name} 造成 ${damage} 點魔法傷害！` });
        });
        break;

      case 'DAMAGE_TRUE':
        targets.forEach(target => {
          const damage = Math.floor(target.maxHp * mult);
          target.currentHp = Math.max(0, target.currentHp - damage);
          events.push({ type: CombatEventType.HIT, actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name, damage, targetHp: target.currentHp, targetMaxHp: target.maxHp, text: `${caster.name} 對 ${target.name} 造成 ${damage} 點真實傷害（無視防禦）！` });
        });
        break;

      case 'LIFESTEAL':
        targets.forEach(target => {
          const { damage } = calculateSkillDamage(caster, target, getPatk(caster) * mult, DamageType.PHYSICAL);
          target.currentHp = Math.max(0, target.currentHp - damage);
          const heal = Math.max(1, Math.floor(damage * (block.lifeStealRate ?? 0.5)));
          caster.currentHp = Math.min(caster.maxHp, caster.currentHp + heal);
          events.push({ type: CombatEventType.HIT, actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name, damage, targetHp: target.currentHp, targetMaxHp: target.maxHp, text: `${caster.name} 吸取生命精華對 ${target.name} 造成 ${damage} 點傷害，恢復 ${heal} HP！` });
        });
        break;

      case 'MULTI_HIT': {
        const hitCount = block.hitCount ?? 2;
        targets.forEach(target => {
          for (let i = 0; i < hitCount; i++) {
            const { damage, isCrit } = calculateSkillDamage(caster, target, getPatk(caster) * mult, DamageType.PHYSICAL);
            target.currentHp = Math.max(0, target.currentHp - damage);
            events.push({ type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT, actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name, damage, targetHp: target.currentHp, targetMaxHp: target.maxHp, text: `${caster.name} 第 ${i + 1} 擊命中 ${target.name}，造成 ${damage} 點傷害！` });
          }
        });
        break;
      }

      case 'APPLY_STATUS':
        if (block.statusType) {
          targets.forEach(target => {
            if (block.statusChance === undefined || Random.next() < block.statusChance) {
              events.push(tryApplyStatus(target, { type: block.statusType as StatusEffectType, duration: block.statusDuration ?? 2, value: block.statusValue, stacks: 1 }, caster.name, undefined, undefined, allEnemies));
            }
          });
        }
        break;

      case 'SET_MARK':
        targets.forEach(target => {
          const existing = target.statusEffects.find(s => s.type === StatusEffectType.MARK);
          if (existing) { existing.stacks = (existing.stacks ?? 0) + 1; }
          else { target.statusEffects.push({ type: StatusEffectType.MARK, duration: block.statusDuration ?? 3, stacks: 1, value: block.statusValue ?? 50 }); }
          const stacks = target.statusEffects.find(s => s.type === StatusEffectType.MARK)?.stacks ?? 1;
          events.push({ type: CombatEventType.STATUS_APPLY, actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name, text: `${target.name} 被附加了【烙印】！(${stacks} 層)` });
        });
        break;

      case 'DETONATE_MARKS':
        targets.forEach(target => {
          const mark = target.statusEffects.find(s => s.type === StatusEffectType.MARK);
          if (mark) {
            const stacks = mark.stacks ?? 1;
            const dmgPerStack = Math.floor(getMatk(caster) * mult);
            const total = dmgPerStack * stacks;
            target.currentHp = Math.max(0, target.currentHp - total);
            target.statusEffects = target.statusEffects.filter(s => s.type !== StatusEffectType.MARK);
            events.push({ type: CombatEventType.CRIT, actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name, damage: total, targetHp: target.currentHp, targetMaxHp: target.maxHp, text: `${caster.name} 引爆了 ${stacks} 層【烙印】！對 ${target.name} 造成 ${total} 點爆炸傷害！` });
          }
        });
        break;

      case 'BUFF_SELF':
        if (block.buffType) {
          caster.statusEffects.push({ type: block.buffType as StatusEffectType, duration: block.buffDuration ?? 2, value: block.buffValue ?? 20 });
          events.push({ type: CombatEventType.STATUS_APPLY, actorId: caster.id, actorName: caster.name, targetId: caster.id, targetName: caster.name, text: `${caster.name} 獲得增益效果（${block.buffType} +${block.buffValue ?? 20}%，${block.buffDuration ?? 2}回合）！` });
        }
        break;

      case 'BUFF_ALLIES':
        _allAllies.filter(a => a.currentHp > 0).forEach(ally => {
          if (block.buffType) {
            ally.statusEffects.push({ type: block.buffType as StatusEffectType, duration: block.buffDuration ?? 2, value: block.buffValue ?? 20 });
            events.push({ type: CombatEventType.STATUS_APPLY, actorId: caster.id, actorName: caster.name, targetId: ally.id, targetName: ally.name, text: `${ally.name} 獲得增益效果！` });
          }
        });
        break;

      case 'HEAL':
        targets.forEach(target => {
          const healAmt = Math.floor(getMatk(caster) * mult);
          target.currentHp = Math.min(target.maxHp, target.currentHp + healAmt);
          events.push({ type: CombatEventType.HEAL, actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name, damage: healAmt, targetHp: target.currentHp, targetMaxHp: target.maxHp, healType: 'HP', text: `${caster.name} 治療了 ${target.name}，恢復 ${healAmt} 點 HP！` });
        });
        break;

      // Phase 2 才實裝：APPLY_BARRIER, CHAIN_DAMAGE, EXECUTE, DISPEL, STEAL_BUFF, DELAYED_BOMB, MP_DRAIN, FORCE_ROW_CHANGE, FIELD_EFFECT, DAMAGE_MIXED
      default:
        break;
    }

    return events;
  }
}
```

### Step 1-D：建立 `src/data/CustomSkillData.json`

```json
[]
```

### Step 1-E：修改 `src/systems/combat/SkillRegistry.ts`

在現有 `import` 區塊末尾新增：

```typescript
import { SkillEffectEngine } from './SkillEffectEngine';
import customSkillData from '../../data/CustomSkillData.json';
```

在 `getAllSkills()` 方法中，在 `this.customSkills.forEach(...)` 之後新增：

```typescript
// 合併積木格式技能（來自工房 CustomSkillData.json）
(customSkillData as any[]).forEach((def) => {
  if (!map.has(def.id)) {
    const compiled = SkillEffectEngine.compile(def);
    if (!compiled.category) compiled.category = this.resolveCategory(compiled);
    map.set(def.id, compiled);
  }
});
```

### Step 1-F：Phase 1 驗收 — 在 `CustomSkillData.json` 寫入兩個測試技能

```json
[
  {
    "id": "CATACLYSM_FLAME",
    "name": "末日焰炎",
    "icon": "🔥",
    "description": "消耗 30 MP。對全體敵人釋放末日烈焰，造成 180% 火屬性魔法傷害，並附加【燃燒】3 回合。",
    "category": "MONSTER",
    "totalMpCost": 30,
    "cooldown": 3,
    "blocks": [
      { "trigger": "ACTIVE", "effectType": "DAMAGE_MAGICAL", "targetType": "ALL_ENEMIES", "multiplier": 1.8, "element": "FIRE", "scaleType": "FIXED" },
      { "trigger": "ACTIVE", "effectType": "APPLY_STATUS", "targetType": "ALL_ENEMIES", "statusType": "BURN", "statusDuration": 3, "statusValue": 20 }
    ]
  },
  {
    "id": "DRAGON_ROAR",
    "name": "龍吟咆哮",
    "icon": "🐉",
    "description": "消耗 25 MP。對全體敵人造成 60% 魔法傷害，40% 機率附加【暈眩】1 回合，自身攻擊力提升 40%（2 回合）。",
    "category": "MONSTER",
    "totalMpCost": 25,
    "cooldown": 3,
    "blocks": [
      { "trigger": "ACTIVE", "effectType": "DAMAGE_MAGICAL", "targetType": "ALL_ENEMIES", "multiplier": 0.6, "scaleType": "FIXED" },
      { "trigger": "ACTIVE", "effectType": "APPLY_STATUS", "targetType": "ALL_ENEMIES", "statusType": "STUN", "statusDuration": 1, "statusChance": 0.4 },
      { "trigger": "ACTIVE", "effectType": "BUFF_SELF", "targetType": "SELF", "buffType": "BUFF_PATK", "buffValue": 40, "buffDuration": 2 }
    ]
  }
]
```

驗收方式：開啟戰鬥工坊，將太古滅世黑龍（`ancient_black_dragon`）加入沙盒，執行戰鬥，確認戰鬥日誌出現「末日焰炎」與「龍吟咆哮」的施放文字。

---

## 五、現有怪物技能積木對應表（Phase 1 遷移）

> 傭兵技能**不遷移**

| 技能 ID | 名稱 | 積木格式 |
|---|---|---|
| `SKILL_TOXIC_SPRAY` | 劇毒噴吐 | DAMAGE_MAGICAL 100% 前排 + APPLY_STATUS POISON duration:2 value:10 |
| `SKILL_SAVAGE_REND` | 撕裂爪擊 | DAMAGE_PHYSICAL 140% 單體 + APPLY_STATUS BLEED duration:2 value:12 |
| `SKILL_CRUSHING_SLAM` | 粉碎重擊 | DAMAGE_PHYSICAL 150% 單體 + APPLY_STATUS ARMOR_BREAK duration:2 |
| `SKILL_BLOOD_DRAIN` | 嗜血打擊 | LIFESTEAL 120% lifeStealRate:0.5 單體 |
| `SKILL_TERROR_SCREECH` | 尖嘯震懾 | DAMAGE_MAGICAL 60% 全體 + APPLY_STATUS STUN duration:1 chance:0.3 |
| `SKILL_SHADOW_ASSAULT` | 暗影突襲 | DAMAGE_PHYSICAL 195% 後排（130%×1.5必暴係數） |
| `SKILL_FLAME_BURST` | 烈焰轟爆 | DAMAGE_MAGICAL 120% 火 前排 + APPLY_STATUS BURN duration:2 value:15 |
| `SKILL_FROST_BREATH` | 冰霜吐息 | DAMAGE_MAGICAL 110% 冰 前排 |
| `SKILL_IRON_DEFENSE` | 堅石甲殼 | BUFF_SELF BUFF_DEF value:40 duration:2 自身 |
| `SKILL_FRENZY_ROAR` | 狂暴怒吼 | BUFF_SELF BUFF_PATK value:30 duration:2 自身 |

遷移方式：將 `SkillData.ts` 中的這 10 個技能改成呼叫 `SkillEffectEngine.compile()` 的包裝（或直接移入 `CustomSkillData.json`，在 `SkillData.ts` 中刪除對應硬編碼）。

---

## 六、Phase 2 規格：新機制積木 × 引擎鉤子（概要）

> Phase 2 在 Phase 1 驗收通過後，與使用者確認後才開始。

### 需在 `CombatSystem.ts` 新增的 5 個觸發鉤子

| 鉤子 | 插入位置 | 說明 |
|---|---|---|
| `onHitTakenHook` | 普攻 HIT 事件發出後 | 受攻擊時觸發 |
| `onKillHook` | `processDeaths()` 確認擊殺後 | 擊殺目標後觸發 |
| `onCritHook` | `CombatEventType.CRIT` 事件發出後 | 爆擊命中後追加 |
| `onHpThresholdHook` | `processStatusEffects()` 後 HP 檢查 | HP 首次低於 X% 觸發 |
| `onTurnStartHook` | 每位行動者的回合開始 | 每回合自動觸發 |

### 需在 `SkillEffectEngine.ts` 補充的效果積木

`APPLY_BARRIER`、`CHAIN_DAMAGE`、`EXECUTE`、`DISPEL`、`STEAL_BUFF`、`DELAYED_BOMB`、`MP_DRAIN`、`FORCE_ROW_CHANGE`、`FIELD_EFFECT`、`DAMAGE_MIXED`

---

## 七、Phase 3 規格：技能工房 UI（概要）

> Phase 3 在 Phase 2 驗收通過後才開始。

新建 `src/templates/skill-workshop.html`（延續故事工坊/戰鬥工坊設計風格）：

- 左側：技能清單（讀取 `CustomSkillData.json`）
- 右側：積木配置編輯器
  - 基本資訊（ID、名稱、圖示、MP 消耗、冷卻回合）
  - 效果積木區（可新增多個 EffectBlock，拖曳排序）
    - WHEN / IF / WHAT / SCALE 四維下拉選單
    - 依選擇動態顯示對應參數輸入框
  - 操作：💾 儲存技能 / ⚡ 戰鬥沙盒測試

新建 `src/tools/SkillWorkshop.ts`：讀取/渲染/儲存 `CustomSkillData.json`。

---

## 八、每個 Phase 的測試驗收指令

```
cmd.exe /c "npx.cmd tsc --noEmit"   → 期望 0 錯誤
cmd.exe /c "npm run test"            → 期望全數 PASS
```
