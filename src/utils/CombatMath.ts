import { CombatParticipant, StatusEffectType } from '../models/Combat';
import { DamageType, ElementType } from '../models/types';
import { Random } from '../core/Random';

// 元素相剋運算函式
export function getElementalMultiplier(atkElement?: ElementType, defElement?: ElementType): number {
  const ElementTypes = {
    NONE: 'NONE', FIRE: 'FIRE', ICE: 'ICE', LIGHTNING: 'LIGHTNING', HOLY: 'HOLY', DARK: 'DARK'
  };
  const atk = atkElement || 'NONE';
  const def = defElement || 'NONE';

  if (atk === def) return 1.0;

  // 1. 三元相剋 (冰 ➔ 火 ➔ 雷 ➔ 冰)
  if (atk === ElementTypes.ICE && def === ElementTypes.FIRE) return 1.25;
  if (atk === ElementTypes.FIRE && def === ElementTypes.ICE) return 0.75;

  if (atk === ElementTypes.FIRE && def === ElementTypes.LIGHTNING) return 1.25;
  if (atk === ElementTypes.LIGHTNING && def === ElementTypes.FIRE) return 0.75;

  if (atk === ElementTypes.LIGHTNING && def === ElementTypes.ICE) return 1.25;
  if (atk === ElementTypes.ICE && def === ElementTypes.LIGHTNING) return 0.75;

  // 2. 光與暗互剋 (1.5x)
  if ((atk === ElementTypes.HOLY && def === ElementTypes.DARK) || (atk === ElementTypes.DARK && def === ElementTypes.HOLY)) {
    return 1.5;
  }

  // 3. 光對火/冰/雷 (1.05x 不逆剋)
  if (atk === ElementTypes.HOLY && (def === ElementTypes.FIRE || def === ElementTypes.ICE || def === ElementTypes.LIGHTNING)) {
    return 1.05;
  }

  // 4. 暗對火/冰/雷 (1.10x 不逆剋)
  if (atk === ElementTypes.DARK && (def === ElementTypes.FIRE || def === ElementTypes.ICE || def === ElementTypes.LIGHTNING)) {
    return 1.10;
  }

  // 5. 火對無屬性 (1.05x 不逆剋)
  if (atk === ElementTypes.FIRE && def === ElementTypes.NONE) {
    return 1.05;
  }

  return 1.0;
}

export function getPatk(caster: CombatParticipant): number {
  let base = caster.stats.patk ?? caster.stats.atk ?? 0;
  if (caster.statusEffects && caster.statusEffects.length > 0) {
    const patkBuffs = caster.statusEffects.filter(s => s.type === StatusEffectType.BUFF_PATK);
    const buffPct = patkBuffs.reduce((sum, b) => sum + (b.value || 0), 0);
    if (buffPct > 0) {
      base = Math.floor(base * (1 + buffPct / 100));
    }
  }
  return base;
}

export function getMatk(caster: CombatParticipant): number {
  let base = caster.stats.matk ?? caster.stats.atk ?? 0;
  if (caster.statusEffects && caster.statusEffects.length > 0) {
    const matkBuffs = caster.statusEffects.filter(s => s.type === StatusEffectType.BUFF_MATK);
    const buffPct = matkBuffs.reduce((sum, b) => sum + (b.value || 0), 0);
    if (buffPct > 0) {
      base = Math.floor(base * (1 + buffPct / 100));
    }
  }
  return base;
}

export function getEvade(caster: CombatParticipant): number {
  let base = caster.stats.evade ?? 0;
  if (caster.statusEffects && caster.statusEffects.length > 0) {
    const evadeBuffs = caster.statusEffects.filter(s => s.type === StatusEffectType.BUFF_EVADE);
    const buffVal = evadeBuffs.reduce((sum, b) => sum + (b.value || 0), 0);
    base += buffVal;
  }
  return base;
}

// 通用的傷害計算與防禦減免函式 (給技能使用)
export function calculateSkillDamage(
  caster: CombatParticipant, 
  target: CombatParticipant, 
  baseDmg: number, 
  damageType: DamageType = DamageType.PHYSICAL,
  forcedCrit?: boolean,
  forcedCritChance?: number,
  targetTeam?: CombatParticipant[]
): { damage: number, isCrit: boolean } {
  // 詭術師被動：有隊友在場時無敵，免疫傷害
  if (targetTeam && target.isAdvanced && target.weaponType === 'MAGIC_RING') {
    const aliveAllies = targetTeam.filter(p => p.id !== target.id && p.currentHp > 0);
    if (aliveAllies.length > 0) {
      return { damage: 0, isCrit: false };
    }
  }

  // 從面板讀取爆擊率 (百分比轉小數)，如果沒有則預設 5%
  let critChance = forcedCritChance !== undefined ? forcedCritChance : ((caster.stats.critRate ?? 5) / 100);
  
  const isCrit = forcedCrit || (Random.next() < critChance);
  
  // 1. 面板基礎傷害 (以 PATK/MATK 面板數值為唯一基準，避免雙重屬性二次乘算 Bug)
  let finalBase = baseDmg;
  
  // 從面板讀取爆擊傷害倍率 (百分比轉小數)，如果沒有則預設 1.5 倍 (150%)
  let critMult = (caster.stats.critDmg ?? 150) / 100;
  
  if (isCrit) finalBase *= critMult;

  // 區分物理防禦 (pdef) 與魔法防禦 (mdef)
  let baseTargetDef = target.stats.pdef ?? target.stats.def ?? 0;
  if (damageType === DamageType.MAGICAL) {
    baseTargetDef = target.stats.mdef ?? target.stats.def ?? 0;
  } else if (damageType === DamageType.CHAOS) {
    baseTargetDef = Math.floor(((target.stats.pdef ?? target.stats.def ?? 0) + (target.stats.mdef ?? target.stats.def ?? 0)) / 2);
  }

  let effectiveDef = baseTargetDef;
  
  // 2. 狀態與被動防禦減免
  // 若目標處於破甲，減少 20%
  if (target.statusEffects.some(s => s.type === StatusEffectType.ARMOR_BREAK)) {
    effectiveDef = effectiveDef * 0.8;
  }

  // 狂戰士被動：裝備巨劍且已轉職時，無視 30% 防禦力
  if (caster.isAdvanced && caster.weaponType === 'GREATSWORD') {
    effectiveDef = effectiveDef * 0.70;
  }

  // 3. 最終傷害結算 (護甲公式)
  let dmgReduction = 0;
  if (damageType !== DamageType.CHAOS) {
    dmgReduction = effectiveDef / (effectiveDef + 150);
  }
  let finalDamage = Math.max(1, Math.floor(finalBase * (1 - dmgReduction)));

  // 4. 進階職業被動防禦減免
  if (target.isAdvanced && target.weaponType === 'SWORD_AND_SHIELD') { // 聖騎士
    if (damageType === DamageType.PHYSICAL) finalDamage *= 0.7;
    if (damageType === DamageType.MAGICAL) finalDamage *= 0.9;
  } else if (target.isAdvanced && target.weaponType === 'RUNE_SHIELD') { // 符文騎士
    if (damageType === DamageType.MAGICAL) finalDamage *= 0.7;
    if (damageType === DamageType.PHYSICAL) finalDamage *= 0.9;
  }

  // 5. 元素相剋運算 (根據施放者/武器與目標元素)
  const elemMult = getElementalMultiplier(caster.element, target.element);
  finalDamage = Math.max(1, Math.floor(finalDamage * elemMult));

  finalDamage = Math.floor(finalDamage * (0.9 + Random.next() * 0.2));

  return { damage: finalDamage, isCrit };
}
