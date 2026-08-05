# 戰鬥系統與被動管理器架構 (Combat System & Passive Manager)

為了解決 `CombatSystem.ts` 中的主迴圈被大量「寫死 (Hardcoded)」的職業或武器特例塞滿的問題，我們將戰鬥迴圈中的被動技能解耦，導入了 `PassiveManager` 來管理所有戰鬥事件的掛鉤 (Hooks)。

## 📁 模組化結構

- `src/systems/CombatSystem.ts`: 負責戰鬥的主迴圈 (Turn-based Loop)，控制波次 (Waves)、回合 (Turns)、行動順序與狀態結算。它本身**不包含**任何特定職業的特例邏輯。
- `src/systems/combat/PassiveManager.ts`: 所有的職業專屬被動、武器特例與複雜的觸發效果都收斂於此。透過掛鉤 (Hooks) 在 `CombatSystem` 中的對應階段被呼叫。

---

## 🛠️ 被動掛鉤 (Hooks) 說明與新增範例

目前 `PassiveManager` 提供了以下幾個核心 Hooks，當你需要新增職業被動時，請在對應的方法中加入邏輯，而非直接修改 `CombatSystem.ts`。

### 1. `onCombatStart(participant)`
**觸發時機**：戰鬥開始前，用來初始化一些隱藏數值。
**範例**：
```typescript
if (participant.isAdvanced && participant.weaponType === 'DAGGERS') {
  participant.stats.evade += 9999; // 先發制人：獲得巨額隱藏閃避值
}
```

### 2. `getModifiedHitChance(attacker, defender, baseHitChance)`
**觸發時機**：計算普攻是否命中時。
**範例**：
```typescript
// 大魔導士法杖必中
if (attacker.isAdvanced && attacker.weaponType === 'STAFF') {
  hitChance = 1.0;
}
// 詭術師嘲諷時 100% 迴避
if (defender.isAdvanced && defender.weaponType === 'MAGIC_RING' && defender.statusEffects.some(s => s.type === StatusEffectType.TAUNT)) {
  hitChance = 0.0; 
}
```

### 3. `calculateBasicAttackDamage(attacker, defender)`
**觸發時機**：計算普攻的基礎傷害值與傷害類型 (物理/魔法/混沌)。
**範例**：
```typescript
// 拷問官雙重制裁 (40%物理 / 60%魔法)
if (attacker.isAdvanced && attacker.weaponType === 'HAMMER') {
  // ... 分別計算後相加
}
```

### 4. `onDamageDealt(attacker, totalDamageDealt, events, triggerSource)`
**觸發時機**：攻擊者成功造成傷害後 (包含技能或普攻)。
**範例**：
```typescript
// 死靈法師靈魂虹吸 (造成傷害 20% 吸血)
if (attacker.isAdvanced && attacker.weaponType === 'SCYTHE' && attacker.currentHp > 0) {
  const heal = Math.floor(totalDamageDealt * 0.2);
  attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
  // 加入事件 ...
}
```

### 5. `onAllyTakingDamage(defender, incomingDamage, playerTeam, events)`
**觸發時機**：我方單位即將受到傷害前，可以用來做傷害轉移或護盾吸收。
**範例**：
```typescript
// 死靈法師苦痛分擔 (幫隊友吸收 50% 傷害)
// 返回修改後的 incomingDamage
```

## ⚠️ 開發注意事項

1. **單一職責**：`PassiveManager` 只負責處理修改數值與推送事件 (`events.push`)。不應該在這裡直接呼叫 UI 渲染或修改非戰鬥狀態。
2. **事件追蹤**：如果被動觸發了任何視覺效果或血量變動，**必須**透過傳遞 `events: CombatEvent[]` 陣列推送一個 `CombatEventType`，否則 UI 畫面上將不會顯示該變動，導致玩家困惑。
3. **擴充未來性**：若未來新增的被動無法透過現有 Hooks 達成，請在 `PassiveManager` 中定義新的 Hook (例如 `onDeath`, `onStatusApplied`)，然後在 `CombatSystem.ts` 對應位置呼叫它。
