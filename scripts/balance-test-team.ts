import { GameState } from '../src/core/GameState';
import { CombatSystem } from '../src/systems/CombatSystem';
import { Adventurer } from '../src/models/Adventurer';
import { EquipmentSlot, FormationRow, MonsterInstance, TerrainType } from '../src/models/types';
import { MonsterSystem } from '../src/systems/MonsterSystem';
import { createSeededRandom, Random } from '../src/core/Random';

const JOB_DEFINITIONS: Record<string, { base: any, growth: any, primaryStat: string }> = {
  '戰士': { base: { str: 10, agi: 5, con: 8, int: 3, spr: 3, luk: 5, charm: 5, command: 5 }, growth: { str: 3, agi: 1, con: 2, int: 0, spr: 0, luk: 1, charm: 0, command: 0 }, primaryStat: 'str' },
  '法師': { base: { str: 3, agi: 5, con: 4, int: 12, spr: 8, luk: 5, charm: 5, command: 5 }, growth: { str: 0, agi: 1, con: 1, int: 3, spr: 2, luk: 1, charm: 0, command: 0 }, primaryStat: 'int' },
  '弓箭手': { base: { str: 6, agi: 10, con: 5, int: 4, spr: 4, luk: 8, charm: 5, command: 5 }, growth: { str: 1, agi: 3, con: 1, int: 1, spr: 1, luk: 2, charm: 0, command: 0 }, primaryStat: 'agi' },
  '盜賊': { base: { str: 7, agi: 12, con: 5, int: 3, spr: 3, luk: 10, charm: 5, command: 5 }, growth: { str: 2, agi: 3, con: 1, int: 0, spr: 0, luk: 2, charm: 0, command: 0 }, primaryStat: 'agi' },
  '騎士': { base: { str: 8, agi: 4, con: 12, int: 3, spr: 6, luk: 5, charm: 5, command: 5 }, growth: { str: 1, agi: 1, con: 3, int: 0, spr: 2, luk: 1, charm: 0, command: 0 }, primaryStat: 'con' },
  '祈禱者': { base: { str: 4, agi: 5, con: 6, int: 8, spr: 12, luk: 5, charm: 5, command: 5 }, growth: { str: 0, agi: 1, con: 1, int: 2, spr: 3, luk: 1, charm: 0, command: 0 }, primaryStat: 'spr' }
};

function calculateLv10Attributes(baseJobName: string, weaponType?: string) {
  const def = JOB_DEFINITIONS[baseJobName] || JOB_DEFINITIONS['戰士'];
  const attrs = { ...def.base };
  for(let i=0; i<9; i++) {
    attrs.str += Math.floor(def.growth.str / 2);
    attrs.agi += Math.floor(def.growth.agi / 2);
    attrs.con += Math.floor(def.growth.con / 2);
    attrs.int += Math.floor(def.growth.int / 2);
    attrs.spr += Math.floor(def.growth.spr / 2);
    attrs.luk += Math.floor(def.growth.luk / 2);
  }
  
  // 依據裝備決定變異職業的屬性點分配 (共18點)
  if (weaponType === 'DUAL_SWORDS') { attrs.str += 9; attrs.int += 9; }
  else if (weaponType === 'SCYTHE') { attrs.str += 18; }
  else if (weaponType === 'MAGIC_BOW') { attrs.agi += 9; attrs.int += 9; }
  else if (weaponType === 'RUNE_SHIELD') { attrs.con += 9; attrs.spr += 9; }
  else if (weaponType === 'MAGIC_RING') { attrs.int += 18; }
  else if (weaponType === 'HAMMER') { attrs.str += 9; attrs.spr += 9; }
  else {
    attrs[def.primaryStat] += 18;
  }
  
  return attrs;
}

// Helper to create a mock max-level advanced adventurer
function createMaxLevelAdventurer(
  id: string,
  name: string,
  baseJobName: string,
  weaponType: string,
  row: FormationRow
): Adventurer {
  const def = JOB_DEFINITIONS[baseJobName] || JOB_DEFINITIONS['戰士'];
  const adv = new Adventurer(
    id,
    name,
    { name: baseJobName, baseAttributes: def.base, growthRates: def.growth },
    { id: 'trait_test', name: 'None', xpModifier: 1, statMultipliers: {} }
  );
  
  adv.level = 10;
  adv.isAdvanced = true;
  adv.formationRow = row;
  adv.baseAttributes = calculateLv10Attributes(baseJobName, weaponType);
  
  let wAtk = 10, wMatk = 0;
  let wScaling: any = { patk: { str: 'C' } };

  if (weaponType === 'GREATSWORD') { wAtk = 50; wScaling = { patk: { str: 'S' } }; }
  if (weaponType === 'DUAL_SWORDS') { wAtk = 30; wMatk = 20; wScaling = { patk: { str: 'A' }, matk: { int: 'A' } }; }
  if (weaponType === 'STAFF') { wMatk = 50; wScaling = { matk: { int: 'S' } }; }
  if (weaponType === 'SCYTHE') { wAtk = 25; wMatk = 35; wScaling = { matk: { int: 'S' } }; }
  if (weaponType === 'BOW') { wAtk = 40; wScaling = { patk: { agi: 'S' } }; }
  if (weaponType === 'MAGIC_BOW') { wAtk = 20; wMatk = 30; wScaling = { patk: { agi: 'A' }, matk: { int: 'A' } }; }
  if (weaponType === 'DAGGERS') { wAtk = 35; wScaling = { patk: { agi: 'S' } }; }
  if (weaponType === 'MAGIC_RING') { wMatk = 40; wScaling = { matk: { int: 'S' } }; }
  if (weaponType === 'SWORD_AND_SHIELD') { wAtk = 25; wScaling = { patk: { con: 'S' } }; }
  if (weaponType === 'RUNE_SHIELD') { wAtk = 15; wMatk = 25; wScaling = { patk: { con: 'S' }, matk: { spr: 'S' } }; }
  if (weaponType === 'HOLY_BOOK') { wMatk = 45; wScaling = { matk: { spr: 'S' } }; }
  if (weaponType === 'HAMMER') { wAtk = 35; wMatk = 25; wScaling = { patk: { str: 'A' }, matk: { spr: 'A' } }; }

  adv.equipment = {
    [EquipmentSlot.WEAPON]: {
      id: 'w_test',
      name: 'Legendary Weapon',
      slot: EquipmentSlot.WEAPON,
      weaponType: weaponType as any,
      requirements: {},
      effects: {},
      combatEffects: { patk: wAtk, matk: wMatk, hit: 15, critRate: 10, speed: 5 },
      scaling: wScaling,
    } as any,
    [EquipmentSlot.ARMOR]: {
      id: 'a_test',
      name: 'Legendary Armor',
      slot: EquipmentSlot.ARMOR,
      requirements: {},
      effects: {},
      combatEffects: { hp: 150, pdef: 30, mdef: 30, evade: 10, speed: 5 },
    } as any
  };
  
  return adv;
}

let battleCount = 0;

// 產生測試用菁英怪群 (包含極端防禦特化)
function generateEliteMonsters(): MonsterInstance[] {
  const monsterSys = new MonsterSystem();
  const monsters = monsterSys.generateEncounter(TerrainType.PLAINS, 10.0, true);
  
  battleCount++;
  const mode = battleCount % 3;
  
  if (mode === 0) {
    // 物理嘆息之牆：極高物防，極低魔防
    monsters.forEach(m => {
       m.pdef = (m.pdef || m.defense || 10) * 8;
       m.mdef = 5;
       m.name = `[物防] ${m.name}`;
    });
  } else if (mode === 1) {
    // 魔法免疫之盾：極低物防，極高魔防
    monsters.forEach(m => {
       m.pdef = 5;
       m.mdef = (m.mdef || m.defense || 10) * 8;
       m.name = `[魔防] ${m.name}`;
    });
  } else {
    // 均衡怪，血量加倍
    monsters.forEach(m => {
       m.hp = m.hp * 2;
       m.maxHp = m.hp;
       m.name = `[血牛] ${m.name}`;
    });
  }
  return monsters;
}

async function runTest() {
  const nativeMathRandom = Math.random;
  Random.setSource(createSeededRandom('team-balance-v1'));
  Math.random = () => Random.next();

  try {
  console.log('⚔️  Medieval 5v5 團隊平衡模擬測試開始 ⚔️\n');
  
  // 初始化核心隊員 (Tank & Healer)
  const paladin = createMaxLevelAdventurer('tank_1', '亞瑟 (聖騎士)', '騎士', 'SWORD_AND_SHIELD', FormationRow.FRONT);
  const archbishop = createMaxLevelAdventurer('heal_1', '瑪麗亞 (大主教)', '祈禱者', 'HOLY_BOOK', FormationRow.BACK);

  const equippedTankStats = paladin.getCombatStats();
  const tankWithoutArmor = paladin.getCombatStats(EquipmentSlot.ARMOR);
  if (
    equippedTankStats.hp - tankWithoutArmor.hp !== 150 ||
    equippedTankStats.pdef - tankWithoutArmor.pdef !== 30 ||
    equippedTankStats.mdef - tankWithoutArmor.mdef !== 30
  ) {
    throw new Error('測試 fixture 無效：防具 combatEffects 未完整套用。');
  }
  
  // 建立 DPS 陣容池
  const dpsGroups = {
    'A (極致物理單體)': [
      createMaxLevelAdventurer('dps_A1', '狂戰士', '戰士', 'GREATSWORD', FormationRow.FRONT),
      createMaxLevelAdventurer('dps_A2', '神射手', '弓箭手', 'BOW', FormationRow.BACK),
      createMaxLevelAdventurer('dps_A3', '暗殺者', '盜賊', 'DAGGERS', FormationRow.FRONT)
    ],
    'B (極致魔法群攻)': [
      createMaxLevelAdventurer('dps_B1', '大魔導士', '法師', 'STAFF', FormationRow.BACK),
      createMaxLevelAdventurer('dps_B2', '精靈使', '弓箭手', 'MAGIC_BOW', FormationRow.BACK),
      createMaxLevelAdventurer('dps_B3', '異端拷問官', '祈禱者', 'HAMMER', FormationRow.FRONT)
    ],
    'C (混沌特效連鎖)': [
      createMaxLevelAdventurer('dps_C1', '魔劍士', '戰士', 'DUAL_SWORDS', FormationRow.FRONT),
      createMaxLevelAdventurer('dps_C2', '詭術師', '盜賊', 'MAGIC_RING', FormationRow.BACK),
      createMaxLevelAdventurer('dps_C3', '死靈法師', '法師', 'SCYTHE', FormationRow.BACK)
    ]
  };

  const ITERATIONS = 100;
  
  for (const [groupName, dpsMembers] of Object.entries(dpsGroups)) {
    console.log(`=========================================`);
    console.log(`🛡️ 測試陣容：${groupName}`);
    console.log(`=========================================`);
    
    // 組建完整 5 人隊伍並注入 GameState
    const team = [paladin, archbishop, ...dpsMembers];
    GameState.adventurers = team;
    const attackerIds = team.map(a => a.id);
    
    let wins = 0;
    let totalTurns = 0;
    const damageMap: Record<string, number> = {};
    team.forEach(a => damageMap[a.name] = 0);
    
    for (let i = 0; i < ITERATIONS; i++) {
      const enemies = generateEliteMonsters();
      // 模擬戰鬥 (難度不影響 mock enemies)
      const report = CombatSystem.simulateCombat(attackerIds, 10, '', TerrainType.PLAINS, 1, undefined, enemies);
      
      if (report.isVictory) wins++;
      
      // 計算回合數 (透過 START event 的數量除以存活人數粗估，或者以 combat logs 長度做比例)
      // 在新的系統中，沒有明確的 turn count，但我們可以用所有動作事件數量來代替「速度」
      const actionEvents = report.events.filter(e => e.type === 'HIT' || e.type === 'CRIT' || e.type === 'MISS');
      totalTurns += actionEvents.length;
      
      // 計算傷害
      const dmgEvents = report.events.filter(e => (e.type === 'HIT' || e.type === 'CRIT') && team.some(a => a.id === e.actorId));
      dmgEvents.forEach(e => {
        const actorName = e.actorName;
        if (actorName && damageMap[actorName] !== undefined && e.damage) {
          damageMap[actorName] += e.damage;
        }
      });
    }
    
    const numericWinRate = (wins / ITERATIONS) * 100;
    const winRate = numericWinRate.toFixed(1);
    const avgActionPerBattle = (totalTurns / ITERATIONS).toFixed(1);
    
    console.log(`>> 測試結果 (100次模擬):`);
    console.log(`🏆 勝率: ${winRate}%`);
    console.log(`⏱️ 平均行動總次數: ${avgActionPerBattle}`);
    console.log(`⚔️ 場均輸出貢獻:`);
    
    // 依傷害排序輸出
    const sortedDmg = Object.entries(damageMap)
      .map(([name, totalDmg]) => ({ name, avgDmg: totalDmg / ITERATIONS }))
      .sort((a, b) => b.avgDmg - a.avgDmg);
      
    sortedDmg.forEach(({ name, avgDmg }) => {
      console.log(`   - ${name.padEnd(12, ' ')} : ${avgDmg.toFixed(0)} 傷害`);
    });
    if (!Number.isFinite(numericWinRate) || !Number.isFinite(Number(avgActionPerBattle)) || sortedDmg.every(entry => entry.avgDmg <= 0)) {
      throw new Error(`陣容 ${groupName} 產生無效的模擬統計。`);
    }
    console.log('\n');
  }
  } finally {
    Math.random = nativeMathRandom;
    Random.reset();
  }
}

runTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
