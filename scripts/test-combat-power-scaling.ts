import { Adventurer } from '../src/models/Adventurer';
import { DataStore } from '../src/systems/DataStore';
import { monsterSystem } from '../src/systems/MonsterSystem';
import { TerrainType, MonsterRace, ElementType } from '../src/models/types';
import { CombatSystem } from '../src/systems/CombatSystem';
import { GameState } from '../src/core/GameState';
import { createSeededRandom, Random } from '../src/core/Random';

function runTests() {
  const nativeMathRandom = Math.random;
  Random.setSource(createSeededRandom('combat-power-scaling-v1'));
  Math.random = () => Random.next();

  try {
  console.log('🧪 === [開始戰力大一統與數值對標驗證] ===\n');

  // 1. 測試 1 級各職業基礎戰力
  console.log('📊 1. 測試 1 級傭兵基礎戰力分佈：');
  const warrior = new Adventurer('adv_1', '戰士亞瑟', DataStore.JobDB.WARRIOR, DataStore.TraitDB.BRAVE, 'N');
  const mage = new Adventurer('adv_2', '法師梅林', DataStore.JobDB.MAGE, DataStore.TraitDB.SCHOLAR, 'N');
  const rogue = new Adventurer('adv_3', '盜賊洛基', DataStore.JobDB.ROGUE, DataStore.TraitDB.AGILE, 'N');
  
  console.log(`- 1 級戰士戰力: ${warrior.power} (HP: ${warrior.getCombatStats().hp}, PATK: ${warrior.getCombatStats().patk}, PDEF: ${warrior.getCombatStats().pdef})`);
  console.log(`- 1 級法師戰力: ${mage.power} (HP: ${mage.getCombatStats().hp}, MATK: ${mage.getCombatStats().matk}, MP: ${mage.getCombatStats().mp})`);
  console.log(`- 1 級盜賊戰力: ${rogue.power} (HP: ${rogue.getCombatStats().hp}, PATK: ${rogue.getCombatStats().patk}, SPD: ${rogue.getCombatStats().speed})`);

  if (warrior.power >= 40 && warrior.power <= 75) {
    console.log('✅ 1 級傭兵基礎戰力落於合理的 40~75 區間！');
  } else {
    throw new Error(`❌ 1 級戰士戰力異常: ${warrior.power}`);
  }

  // 2. 測試難度 1 級單隻怪物戰力與攻防生成
  console.log('\n🐺 2. 測試難度 1 級怪物屬性生成：');
  const wolfData = monsterSystem.getMonsterById('wild_wolf')!;
  const wolfInstance = monsterSystem.createMonsterInstance(wolfData, MonsterRace.MONSTER, ElementType.NONE, 1);
  console.log(`- 0.6 階野狼 (powerTier 0.6): 戰力 = ${wolfInstance.calculatedPowerScore}`);
  console.log(`  HP: ${wolfInstance.hp}, ATK: ${wolfInstance.damage}, PDEF: ${wolfInstance.pdef}, MDEF: ${wolfInstance.mdef}, SPD: ${wolfInstance.speed}`);
  console.log(`  擊殺掉落: ${wolfInstance.goldReward} 金幣, ${wolfInstance.expReward} EXP`);

  const ghoulData = monsterSystem.getMonsterById('ghoul')!;
  const ghoulInstance = monsterSystem.createMonsterInstance(ghoulData, MonsterRace.UNDEAD, ElementType.DARK, 1);
  console.log(`- 1.0 階食屍鬼 (powerTier 1.0): 戰力 = ${ghoulInstance.calculatedPowerScore}`);
  console.log(`  HP: ${ghoulInstance.hp}, ATK: ${ghoulInstance.damage}, PDEF: ${ghoulInstance.pdef}, MDEF: ${ghoulInstance.mdef}, SPD: ${ghoulInstance.speed}`);

  if (wolfInstance.hp >= 45 && wolfInstance.damage >= 12 && wolfInstance.calculatedPowerScore >= 20 && ghoulInstance.calculatedPowerScore >= 40) {
    console.log('✅ 怪物攻防血量扎實，0.6 階雜兵約 25 戰力、1.0 階標準怪約 45~55 戰力，完美對標！');
  } else {
    throw new Error(`❌ 怪物屬性異常: 野狼 Power ${wolfInstance.calculatedPowerScore}, 食屍鬼 Power ${ghoulInstance.calculatedPowerScore}`);
  }

  // 3. 測試 1 級難度遭遇生成 (Encounter)
  console.log('\n🌲 3. 測試難度 1 級整體遭遇生成：');
  const diff1Encounter = monsterSystem.generateEncounter(TerrainType.FOREST, 1, false);
  const totalPowerDiff1 = diff1Encounter.reduce((sum, m) => sum + m.calculatedPowerScore, 0);
  console.log(`- 難度 1 遭遇怪物數量: ${diff1Encounter.length} 隻, 總戰力 = ${totalPowerDiff1}`);
  diff1Encounter.forEach(m => console.log(`  * ${m.name}: 戰力 ${m.calculatedPowerScore}, HP ${m.hp}, ATK ${m.damage}`));

  if (diff1Encounter.length <= 2 && totalPowerDiff1 >= 30 && totalPowerDiff1 <= 85) {
    console.log('✅ 難度 1 遭遇怪物數量 1~2 隻，總戰力約 35~85，精準適合開局 1 人出征！');
  } else {
    throw new Error(`❌ 難度 1 遭遇異常: 數量 ${diff1Encounter.length}, 總戰力 ${totalPowerDiff1}`);
  }

  // 4. 測試難度 2 級遭遇生成
  console.log('\n🏕️ 4. 測試難度 2 級整體遭遇生成：');
  const diff2Encounter = monsterSystem.generateEncounter(TerrainType.PLAINS, 2, false);
  const totalPowerDiff2 = diff2Encounter.reduce((sum, m) => sum + m.calculatedPowerScore, 0);
  console.log(`- 難度 2 遭遇怪物數量: ${diff2Encounter.length} 隻, 總戰力 = ${totalPowerDiff2}`);

  if (diff2Encounter.length >= 1 && totalPowerDiff2 >= 70 && totalPowerDiff2 <= 170) {
    console.log('✅ 難度 2 遭遇總戰力約 70~170，適合 2~3 人小隊！');
  } else {
    throw new Error(`❌ 難度 2 遭遇異常: 數量 ${diff2Encounter.length}, 總戰力 ${totalPowerDiff2}`);
  }

  // 5. 驗證戰鬥生命週期；勝敗屬於量測結果，不冒充通過條件。
  console.log('\n⚔️ 5. 測試 1v1 戰鬥生命週期 (戰士單挑難度 1 遭遇)：');
  GameState.adventurers = [warrior];
  const combatReport = CombatSystem.simulateCombat([warrior.id], 1, '', TerrainType.FOREST, 1, undefined, diff1Encounter);
  console.log(`- 戰鬥結果: ${combatReport.isVictory ? '🏆 勝利' : '❌ 戰敗'}`);
  console.log(`- 總戰鬥事件數: ${combatReport.events.length}`);
  console.log(`- 戰利品: ${combatReport.totalEarnedGold} 金幣, ${combatReport.totalEarnedExp} EXP`);

  if (combatReport.events.length >= 2 && combatReport.participants.includes(warrior.id)) {
    console.log('✅ 戰鬥生命週期完整；勝敗已如實列為量測結果。');
  } else {
    throw new Error('❌ 戰鬥未正常觸發交鋒');
  }

  console.log('\n🎉 === [全部戰力結構與生命週期檢查通過] ===\n');
  } finally {
    Math.random = nativeMathRandom;
    Random.reset();
  }
}

runTests();
