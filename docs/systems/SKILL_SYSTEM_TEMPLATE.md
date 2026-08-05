# 技能系統架構與模板 (Skill System Architecture & Template)

為了提升專案的可維護性與閱讀性，技能系統已被模組化為三個核心部分：**資料模型 (Models)**、**核心演算法 (Utils/Math)** 與 **技能庫 (Data/Database)**。

## 📁 系統目錄結構

- `src/models/Skill.ts`: **純資料模型定義**。僅包含 TypeScript `interface` 與 `enum` (例如 `Skill`, `TargetType`, `SkillDisplayInfo`)。這裡**不應該**有任何商業邏輯。
- `src/utils/CombatMath.ts`: **戰鬥演算法工具庫**。包含傷害計算公式 (`calculateSkillDamage`)、面板數據取得 (`getPatk`, `getMatk`) 與元素相剋 (`getElementalMultiplier`)。這裡的函式必須是純函數，方便單元測試。
- `src/data/SkillData.ts`: **具體的技能實作庫**。包含龐大的 `SKILLS` 字典與 `getAdventurerSkillInfo` 等負責組合可用技能清單的方法。

---

## 🛠️ 如何新增一個技能 (Skill Template)

當需要新增一個職業技能時，請至 `src/data/SkillData.ts` 內的 `SKILLS` 物件新增項目，並遵從以下模板：

```typescript
// 於 src/data/SkillData.ts
import { TargetType, Skill } from '../models/Skill';
import { CombatEventType, StatusEffectType, tryApplyStatus } from '../models/Combat';
import { calculateSkillDamage, getPatk, getMatk } from '../utils/CombatMath';
import { DamageType } from '../models/types';

'YOUR_CLASS_NEW_SKILL': {
  id: 'YOUR_CLASS_NEW_SKILL',
  name: '技能名稱',
  mpCost: 15,
  targetType: TargetType.SINGLE_ENEMY, // 參考 TargetType Enum
  description: '消耗 15 MP。造成 150% 物理傷害並有機率附加流血。',
  cooldown: 2, // 選填，冷卻回合數
  
  // AI 權重評估：AI 是否要施放此技能。回傳 0 或負數則絕不施放。
  aiWeight: (caster, targets, allEnemies, allAllies) => {
    const target = targets[0];
    if (target.currentHp / target.maxHp > 0.5) return 150; // 如果目標血多，高機率施放
    return 50;
  },
  
  // 具體執行邏輯：必須回傳 CombatEvent[]
  execute: (caster, targets, allEnemies, allAllies) => {
    const target = targets[0];
    const events: CombatEvent[] = [];
    
    // 1. 計算傷害 (使用 CombatMath 內的共用公式)
    const { damage, isCrit } = calculateSkillDamage(caster, target, getPatk(caster) * 1.5, DamageType.PHYSICAL);
    target.currentHp = Math.max(0, target.currentHp - damage);
    
    // 2. 記錄戰鬥事件
    events.push({
      type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
      actorId: caster.id, actorName: caster.name, 
      targetId: target.id, targetName: target.name,
      damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
      skillName: '技能名稱',
      text: `${caster.name} 施放了技能，造成 ${damage} 點傷害！`
    });
    
    // 3. 處理狀態異常 (使用 tryApplyStatus)
    if (target.currentHp > 0 && Math.random() < 0.3) {
      events.push(tryApplyStatus(
        target, 
        { type: StatusEffectType.BLEED, duration: 2 }, 
        caster.name, 
        '技能名稱', 
        `${target.name} 流血了！`
      ));
    }
    
    return events;
  }
}
```

## ⚠️ 開發注意事項 (Guidelines)

1. **避免將邏輯寫回 `Skill.ts`**：`Skill.ts` 已被限制為純型別宣告，若需要新增計算邏輯，請放入 `CombatMath.ts` 或其他 Utils。
2. **傷害公式統一**：不要在個別的技能 `execute` 裡自創防禦減免公式，一律使用 `calculateSkillDamage` 來確保所有狀態異常與被動（如破甲）都能正常生效。
3. **戰鬥解耦 (進行中)**：未來戰鬥迴圈（Phase 2 重構）可能會轉為事件驅動，所以技能回傳的事件 (`CombatEvent`) 要盡可能詳實，以便畫面正確渲染與成就追蹤。
