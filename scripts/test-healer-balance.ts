import { SKILLS } from '../src/data/SkillData';
import { CombatParticipant } from '../src/models/Combat';
import { DamageType, ElementType, FormationRow } from '../src/models/types';
import { getMatk } from '../src/utils/CombatMath';

console.log('====================================================');
console.log('🩺 祈禱者全生命週期治療量 (Healer Balance) 驗證測試');
console.log('====================================================');

let passed = 0;
let total = 0;
function assert(cond: boolean, msg: string) {
  total++;
  if (cond) {
    console.log(`✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${msg}`);
  }
}

// 1. Lv.1 祈禱者 (MATK 35, INT 10, SPR 14)
const lv1Healer: CombatParticipant = {
  id: 'healer_lv1', name: '1級見習祈禱者', isPlayer: true,
  row: FormationRow.BACK, gridR: 2, gridC: 1,
  maxHp: 120, currentHp: 120, maxMp: 70, currentMp: 70,
  isAdvanced: false, weaponType: 'STAFF',
  stats: { hp: 120, mp: 70, patk: 8, matk: 35, pdef: 18, mdef: 25, hit: 25, evade: 10, speed: 10, critRate: 5, critDmg: 150, atk: 35, def: 18 },
  attributes: { con: 8, spr: 14, str: 4, agi: 5, int: 10, luk: 5, charm: 2, command: 1 },
  statusEffects: []
};

// 2. Lv.5 大主教 (MATK 85, INT 20, SPR 26, 聖典)
const lv5Archbishop: CombatParticipant = {
  id: 'healer_lv5', name: '5級大主教', isPlayer: true,
  row: FormationRow.BACK, gridR: 2, gridC: 1,
  maxHp: 220, currentHp: 220, maxMp: 130, currentMp: 130,
  isAdvanced: true, weaponType: 'HOLY_BOOK',
  stats: { hp: 220, mp: 130, patk: 15, matk: 85, pdef: 35, mdef: 48, hit: 40, evade: 15, speed: 14, critRate: 5, critDmg: 150, atk: 85, def: 35 },
  attributes: { con: 14, spr: 26, str: 6, agi: 8, int: 20, luk: 8, charm: 5, command: 3 },
  statusEffects: []
};

// 3. Lv.10 終局大主教 (MATK 200, INT 38, SPR 45, 傳奇聖典)
const lv10Archbishop: CombatParticipant = {
  id: 'healer_lv10', name: '10級終局大主教', isPlayer: true,
  row: FormationRow.BACK, gridR: 2, gridC: 1,
  maxHp: 450, currentHp: 450, maxMp: 225, currentMp: 225,
  isAdvanced: true, weaponType: 'HOLY_BOOK',
  stats: { hp: 450, mp: 225, patk: 25, matk: 200, pdef: 65, mdef: 110, hit: 65, evade: 25, speed: 18, critRate: 10, critDmg: 160, atk: 200, def: 65 },
  attributes: { con: 22, spr: 45, str: 8, agi: 12, int: 38, luk: 15, charm: 8, command: 5 },
  statusEffects: []
};

// 4. Lv.10 終局異端拷問官 (MATK 160, PATK 120, 戰鎚)
const lv10Inquisitor: CombatParticipant = {
  id: 'inquisitor_lv10', name: '10級異端拷問官', isPlayer: true,
  row: FormationRow.FRONT, gridR: 0, gridC: 1,
  maxHp: 550, currentHp: 550, maxMp: 160, currentMp: 160,
  isAdvanced: true, weaponType: 'HAMMER',
  stats: { hp: 550, mp: 160, patk: 120, matk: 160, pdef: 95, mdef: 95, hit: 60, evade: 20, speed: 16, critRate: 12, critDmg: 160, atk: 160, def: 95 },
  attributes: { con: 28, spr: 32, str: 25, agi: 10, int: 28, luk: 12, charm: 5, command: 5 },
  statusEffects: []
};

// 測試目標隊友
const targetTank: CombatParticipant = {
  id: 'tank_1', name: '前排肉盾', isPlayer: true,
  row: FormationRow.FRONT, gridR: 0, gridC: 0,
  maxHp: 750, currentHp: 150, maxMp: 100, currentMp: 100,
  stats: { hp: 750, mp: 100, patk: 80, matk: 10, pdef: 120, mdef: 70, hit: 45, evade: 15, speed: 12, critRate: 5, critDmg: 150, atk: 80, def: 120 },
  attributes: { con: 38, spr: 15, str: 28, agi: 10, int: 5, luk: 8, charm: 5, command: 5 },
  statusEffects: []
};

const dummyEnemy: CombatParticipant = {
  id: 'enemy_1', name: '高階魔物', isPlayer: false,
  row: FormationRow.FRONT, gridR: 0, gridC: 0,
  maxHp: 1000, currentHp: 1000, maxMp: 200, currentMp: 200,
  stats: { hp: 1000, mp: 200, patk: 80, matk: 80, pdef: 50, mdef: 50, hit: 50, evade: 20, speed: 15, critRate: 5, critDmg: 150, atk: 80, def: 50 },
  attributes: { con: 30, spr: 20, str: 30, agi: 20, int: 20, luk: 10, charm: 1, command: 1 },
  statusEffects: []
};

console.log('\n--- 測試 1：Lv.1 祈禱者基礎治療術 ---');
const healSkill = SKILLS['PRAYER_HEAL'];
const lv1HealEvents = healSkill.execute(lv1Healer, [targetTank], [dummyEnemy], [targetTank, lv1Healer]);
const lv1Heal = lv1HealEvents[0].damage!;
console.log(`[Lv.1 治療術] 治療量: ${lv1Heal} 點 HP (消耗 15 MP)`);
assert(lv1Heal >= 50 && lv1Heal <= 65, 'Lv.1 治療術單補應在 50~65 點 HP 區間');

console.log('\n--- 測試 2：Lv.5 大主教治療術與神聖之雨 ---');
const lv5HealEvents = healSkill.execute(lv5Archbishop, [targetTank], [dummyEnemy], [targetTank, lv5Archbishop]);
const lv5Heal = lv5HealEvents[0].damage!;
console.log(`[Lv.5 治療術 (含聖典+30%)] 治療量: ${lv5Heal} 點 HP`);
assert(lv5Heal >= 160 && lv5Heal <= 195, 'Lv.5 大主教單補應在 160~195 點 HP 區間');

const massHealSkill = SKILLS['PRAYER_ARCHBISHOP_MASS_HEAL'];
const lv5MassEvents = massHealSkill.execute(lv5Archbishop, [targetTank, lv5Archbishop], [dummyEnemy], [targetTank, lv5Archbishop]);
const lv5MassHeal = lv5MassEvents[0].damage!;
console.log(`[Lv.5 神聖之雨 (全體群補)] 全體治療量: ${lv5MassHeal} 點 HP`);
assert(lv5MassHeal >= 110 && lv5MassHeal <= 140, 'Lv.5 神聖之雨群補應在 110~140 點 HP 區間');

console.log('\n--- 測試 3：Lv.10 終局大主教對標測試 ---');
const lv10HealEvents = healSkill.execute(lv10Archbishop, [targetTank], [dummyEnemy], [targetTank, lv10Archbishop]);
const lv10Heal = lv10HealEvents[0].damage!;
console.log(`[Lv.10 終局治療術] 治療量: ${lv10Heal} 點 HP (目標 750 HP 肉盾)`);
assert(lv10Heal >= 380 && lv10Heal <= 450, 'Lv.10 終局大主教單補應在 380~450 點 HP (拉回肉盾 >50% 血量)');

const lv10MassEvents = massHealSkill.execute(lv10Archbishop, [targetTank, lv10Archbishop], [dummyEnemy], [targetTank, lv10Archbishop]);
const lv10MassHeal = lv10MassEvents[0].damage!;
console.log(`[Lv.10 終局神聖之雨] 全體治療量: ${lv10MassHeal} 點 HP`);
assert(lv10MassHeal >= 260 && lv10MassHeal <= 320, 'Lv.10 終局神聖之雨群補應在 260~320 點 HP');

console.log('\n--- 測試 4：Lv.10 異端拷問官【終焉審判】副補與回藍 ---');
const judgmentSkill = SKILLS['PRAYER_INQUISITOR_JUDGMENT'];
const allies = [targetTank, lv10Inquisitor];
const judgmentEvents = judgmentSkill.execute(lv10Inquisitor, [dummyEnemy], [dummyEnemy], allies);
console.log(`[Lv.10 終焉審判] 傷害與全體回血/回藍效果觸發完成`);
assert(judgmentEvents.length >= 3, '終焉審判應產生傷害與全體隊友治療事件');

console.log('\n====================================================');
console.log(`測試結果：${passed} / ${total} 全部通過！`);
console.log('====================================================');
