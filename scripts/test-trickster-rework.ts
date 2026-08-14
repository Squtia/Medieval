import { CombatParticipant, StatusEffectType, tryApplyStatus } from '../src/models/Combat';
import { PassiveManager } from '../src/systems/combat/PassiveManager';
import { SKILLS } from '../src/data/SkillData';
import { getPatk, getMatk, getEvade, calculateSkillDamage } from '../src/utils/CombatMath';
import { DamageType } from '../src/models/types';

function runTests() {
  console.log('=== 開始測試詭術師技能與被動重構 ===\n');

  // 1. 建立測試詭術師與隊友
  const trickster: CombatParticipant = {
    id: 'trickster_1',
    name: '測試詭術師',
    isPlayer: true,
    row: 'FRONT',
    maxHp: 100,
    currentHp: 100,
    maxMp: 100,
    currentMp: 100,
    stats: { hp: 100, mp: 100, atk: 50, def: 20, hit: 100, evade: 20, speed: 30, patk: 60, matk: 40, pdef: 20, mdef: 20, critRate: 5, critDmg: 150 },
    statusEffects: [],
    baseClass: '盜賊',
    weaponType: 'MAGIC_RING',
    isAdvanced: true,
    skills: ['THIEF_SURPRISE_ATTACK', 'THIEF_POISON_BLADE', 'TRICKSTER_TRICK_MAGIC']
  };

  const ally: CombatParticipant = {
    id: 'ally_1',
    name: '戰士隊友',
    isPlayer: true,
    row: 'FRONT',
    maxHp: 150,
    currentHp: 150,
    stats: { hp: 150, mp: 50, atk: 40, def: 30, hit: 90, evade: 10, speed: 20, patk: 40, matk: 0, pdef: 30, mdef: 10, critRate: 5, critDmg: 150 },
    statusEffects: []
  };

  const enemy: CombatParticipant = {
    id: 'enemy_1',
    name: '測試哥布林',
    isPlayer: false,
    row: 'FRONT',
    maxHp: 200,
    currentHp: 200,
    stats: { hp: 100, mp: 0, atk: 30, def: 10, hit: 100, evade: 10, speed: 25, patk: 30, matk: 0, pdef: 10, mdef: 10, critRate: 5, critDmg: 150 },
    statusEffects: []
  };

  const playerTeamWithAlly = [trickster, ally];
  const playerTeamSolo = [trickster];
  const enemyTeam = [enemy];

  // 測試 1: 有隊友時無敵判定
  console.log('【測試 1】有隊友時無敵狀態判定:');
  const isInvulnWithAlly = PassiveManager.isTricksterInvulnerable(trickster, playerTeamWithAlly);
  console.log(`- 有隊友時無敵: ${isInvulnWithAlly} (預期: true)`);
  if (!isInvulnWithAlly) throw new Error('測試 1 失敗: 有隊友時應為無敵');

  // 測試 2: 命中率修改 (無敵時命中率為 0)
  const hitChanceAgainstInvuln = PassiveManager.getModifiedHitChance(enemy, trickster, 0.8, playerTeamWithAlly);
  console.log(`- 敵方攻擊無敵詭術師命中率: ${hitChanceAgainstInvuln} (預期: 0)`);
  if (hitChanceAgainstInvuln !== 0) throw new Error('測試 2 失敗: 無敵時命中率應為 0');

  // 測試 3: 狀態免疫 (無敵時 tryApplyStatus 免疫負面狀態)
  const applyPoisonEvent = tryApplyStatus(
    trickster,
    { type: StatusEffectType.POISON, duration: 3, value: 5 },
    enemy.name,
    undefined,
    undefined,
    playerTeamWithAlly
  );
  console.log(`- 敵方對無敵詭術師施加中毒: ${applyPoisonEvent.text}`);
  if (trickster.statusEffects.length !== 0) throw new Error('測試 3 失敗: 無敵時應免疫負面狀態');

  // 測試 4: 隊友死亡 / 單人出戰時無敵失效
  console.log('\n【測試 4】單人出戰 / 隊友死亡判定:');
  const isInvulnSolo = PassiveManager.isTricksterInvulnerable(trickster, playerTeamSolo);
  console.log(`- 無隊友時無敵: ${isInvulnSolo} (預期: false)`);
  if (isInvulnSolo) throw new Error('測試 4 失敗: 無隊友時不應無敵');

  // 測試 5: 終極技能【欺詐魔術】分支 A (目標 HP >= 70%)
  console.log('\n【測試 5】終極技能【欺詐魔術】分支 A (目標 HP >= 70%):');
  enemy.currentHp = 200; // 100% HP
  const skill = SKILLS['TRICKSTER_TRICK_MAGIC'];
  const eventsA = skill.execute(trickster, [enemy], enemyTeam, playerTeamWithAlly);
  console.log(`- 技能施放日誌:`);
  eventsA.forEach(e => console.log(`  * ${e.text}`));

  const allyHasEvade = ally.statusEffects.some(s => s.type === StatusEffectType.BUFF_EVADE && s.value === 30);
  const allyHasPatk = ally.statusEffects.some(s => s.type === StatusEffectType.BUFF_PATK && s.value === 10);
  console.log(`- 隊友獲得閃避+30 Buff: ${allyHasEvade}, PATK+10% Buff: ${allyHasPatk}`);
  if (!allyHasEvade || !allyHasPatk) throw new Error('測試 5 失敗: 全隊應獲得閃避+30 與 PATK+10%');

  // 測試 6: 終極技能【欺詐魔術】分支 B (目標 HP < 70%)
  console.log('\n【測試 6】終極技能【欺詐魔術】分支 B (目標 HP < 70%):');
  enemy.maxHp = 200;
  enemy.currentHp = 100; // 50% HP (< 70%)
  trickster.statusEffects = []; // 清除先前 buff
  const eventsB = skill.execute(trickster, [enemy], enemyTeam, playerTeamWithAlly);
  console.log(`- 技能施放日誌:`);
  eventsB.forEach(e => console.log(`  * ${e.text}`));

  const poisonOnEnemy = enemy.statusEffects.find(s => s.type === StatusEffectType.POISON);
  const tricksterPatkBuff = trickster.statusEffects.some(s => s.type === StatusEffectType.BUFF_PATK && s.value === 30);
  const tricksterMatkBuff = trickster.statusEffects.some(s => s.type === StatusEffectType.BUFF_MATK && s.value === 30);
  console.log(`- 目標中毒層數: ${poisonOnEnemy?.stacks} (預期: 5)`);
  console.log(`- 自身獲得 PATK+30%: ${tricksterPatkBuff}, MATK+30%: ${tricksterMatkBuff}`);
  if (poisonOnEnemy?.stacks !== 5 || !tricksterPatkBuff || !tricksterMatkBuff) {
    throw new Error('測試 6 失敗: 目標應有 5 層毒且自身雙攻+30%');
  }

  // 測試 7: Buff 乘算驗證 (CombatMath)
  console.log('\n【測試 7】Buff 屬性乘算:');
  const basePatk = 60;
  const boostedPatk = getPatk(trickster); // 60 * 1.3 = 78
  console.log(`- 原 PATK: ${basePatk} -> Buff 後 PATK: ${boostedPatk} (預期: 78)`);
  if (boostedPatk !== 78) throw new Error('測試 7 失敗: PATK 乘算不符');

  console.log('\n✅ 所有測試全數通過！');
}

runTests();
