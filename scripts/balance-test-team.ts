import { GameState } from '../src/core/GameState.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { Adventurer } from '../src/models/Adventurer.js';
import { EquipmentSlot, FormationRow, MonsterInstance, TerrainType } from '../src/models/types.js';

// Helper to create a mock max-level advanced adventurer
function createMaxLevelAdventurer(
  id: string,
  name: string,
  jobName: string,
  weaponType: string,
  row: FormationRow
): Adventurer {
  const adv = new Adventurer(
    id,
    name,
    { id: 'job_test', name: jobName, role: 'DPS', baseAttributes: { str: 10, agi: 10, con: 10, int: 10, spr: 10, luk: 10 } },
    { id: 'trait_test', name: 'None', statMultipliers: {} }
  );
  
  adv.level = 10;
  adv.isAdvanced = true;
  adv.formationRow = row;
  
  // Set extremely high base attributes to ensure they hit hard
  adv.baseAttributes = { str: 50, agi: 50, con: 50, int: 50, spr: 50, luk: 50 };
  
  // Mock high-tier equipment
  adv.equipment = {
    [EquipmentSlot.WEAPON]: {
      id: 'w_test',
      name: 'Legendary Weapon',
      type: 'WEAPON',
      weaponType: weaponType as any,
      stats: { atk: 150, hit: 50, crit: 20 },
      isBroken: false
    } as any,
    [EquipmentSlot.ARMOR]: {
      id: 'a_test',
      name: 'Legendary Armor',
      type: 'ARMOR',
      stats: { def: 100, maxHp: 500, evade: 20 },
      isBroken: false
    } as any
  };
  
  return adv;
}

// 產生標準的菁英怪群
function generateEliteMonsters(): MonsterInstance[] {
  const monsters: MonsterInstance[] = [];
  for (let i = 1; i <= 5; i++) {
    monsters.push({
      id: `elite_orc_${i}`,
      name: `深淵戰神 ${i}號`,
      race: 'ORC',
      terrains: [TerrainType.PLAINS],
      powerTier: 5,
      hp: 2000,
      damage: 100,
      defense: 60,
      evade: 15,
      calculatedPowerScore: 1000
    });
  }
  return monsters;
}

async function runTest() {
  console.log('⚔️  Medieval 5v5 團隊平衡模擬測試開始 ⚔️\n');
  
  // 初始化核心隊員 (Tank & Healer)
  const paladin = createMaxLevelAdventurer('tank_1', '亞瑟 (聖騎士)', '聖騎士', 'SWORD_AND_SHIELD', FormationRow.FRONT);
  const archbishop = createMaxLevelAdventurer('heal_1', '瑪麗亞 (大主教)', '大主教', 'HOLY_BOOK', FormationRow.BACK);
  
  // 建立 DPS 陣容池
  const dpsGroups = {
    'A (極致物理單體)': [
      createMaxLevelAdventurer('dps_A1', '狂戰士', '狂戰士', 'GREATSWORD', FormationRow.FRONT),
      createMaxLevelAdventurer('dps_A2', '神射手', '神射手', 'BOW', FormationRow.BACK),
      createMaxLevelAdventurer('dps_A3', '暗殺者', '暗殺者', 'DAGGERS', FormationRow.MIDDLE)
    ],
    'B (極致魔法群攻)': [
      createMaxLevelAdventurer('dps_B1', '大魔導士', '大魔導士', 'STAFF', FormationRow.BACK),
      createMaxLevelAdventurer('dps_B2', '精靈使', '精靈使', 'MAGIC_BOW', FormationRow.BACK),
      createMaxLevelAdventurer('dps_B3', '異端拷問官', '異端拷問官', 'HAMMER', FormationRow.MIDDLE)
    ],
    'C (混沌特效連鎖)': [
      createMaxLevelAdventurer('dps_C1', '魔劍士', '魔劍士', 'DUAL_SWORDS', FormationRow.FRONT),
      createMaxLevelAdventurer('dps_C2', '詭術師', '詭術師', 'MAGIC_RING', FormationRow.MIDDLE),
      createMaxLevelAdventurer('dps_C3', '死靈法師', '死靈法師', 'SCYTHE', FormationRow.BACK)
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
        if (damageMap[actorName] !== undefined && e.damage) {
          damageMap[actorName] += e.damage;
        }
      });
    }
    
    const winRate = ((wins / ITERATIONS) * 100).toFixed(1);
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
    console.log('\n');
  }
}

runTest().catch(console.error);
