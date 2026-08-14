import { monsterSystem } from '../src/systems/MonsterSystem';
import { TerrainType, MonsterRace, ElementType, MapNode, NodeLevel, NodeFeature, WeatherType, FormationRow } from '../src/models/types';
import { PassiveManager } from '../src/systems/combat/PassiveManager';
import { CombatParticipant } from '../src/models/Combat';

console.log('====================================================');
console.log('🧪 怪物數值平衡與稀有挑戰據點機制驗證測試');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${msg}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${msg}`);
  }
}

// 測試 1：怪獸戰力分 (powerScore) 與屬性生成
console.log('\n--- 測試 1：怪物屬性與戰力分檢測 (難度 10 基準) ---');
const goblinBase = monsterSystem.getMonsterById('goblin')!;
const ghoulBase = monsterSystem.getMonsterById('ghoul')!;
const trollBase = monsterSystem.getMonsterById('troll')!;
const shamanBase = monsterSystem.getMonsterById('shaman')!;

const goblin = monsterSystem.createMonsterInstance(goblinBase, MonsterRace.MONSTER, ElementType.NONE, 10);
const ghoul = monsterSystem.createMonsterInstance(ghoulBase, MonsterRace.UNDEAD, ElementType.NONE, 10);
const troll = monsterSystem.createMonsterInstance(trollBase, MonsterRace.MONSTER, ElementType.NONE, 10);
const shaman = monsterSystem.createMonsterInstance(shamanBase, MonsterRace.HUMAN, ElementType.NONE, 10);

console.log(`[哥布林 (0.5階)] 戰力: ${goblin.calculatedPowerScore}, HP: ${goblin.hp}, ATK: ${goblin.damage}, PDEF: ${goblin.pdef}, MDEF: ${goblin.mdef}`);
console.log(`[食屍鬼 (1.0階)] 戰力: ${ghoul.calculatedPowerScore}, HP: ${ghoul.hp}, ATK: ${ghoul.damage}, PDEF: ${ghoul.pdef}, MDEF: ${ghoul.mdef}`);
console.log(`[巨魔 (2.2階)] 戰力: ${troll.calculatedPowerScore}, HP: ${troll.hp}, ATK: ${troll.damage}, PDEF: ${troll.pdef}, MDEF: ${troll.mdef}`);
console.log(`[薩滿 (1.3階法系)] 戰力: ${shaman.calculatedPowerScore}, HP: ${shaman.hp}, ATK: ${shaman.damage}, isMagical: ${shaman.isMagicalAttacker}`);

assert(goblin.calculatedPowerScore === 60, '哥布林(0.5階)戰力應為 60 點');
assert(ghoul.calculatedPowerScore >= 120 && ghoul.calculatedPowerScore <= 140, '食屍鬼(1.0階不死)戰力應約為 132 點');
assert(troll.calculatedPowerScore >= 250, '巨魔(2.2階)戰力應 >= 250 點');
assert(shaman.isMagicalAttacker === true, '薩滿應具備 isMagicalAttacker: true');

// 測試 2：怪物打在傭兵身上的傷害實質威脅檢測
console.log('\n--- 測試 2：怪物打傭兵傷害實測 (傭兵 HP 150, PDEF 30, MDEF 24) ---');

const dummyMercenary: CombatParticipant = {
  id: 'merc_1',
  name: '初階戰士',
  isPlayer: true,
  row: FormationRow.FRONT,
  gridR: 0,
  gridC: 0,
  maxHp: 150,
  currentHp: 150,
  maxMp: 60,
  currentMp: 60,
  stats: {
    hp: 150, mp: 60, patk: 40, matk: 10, pdef: 30, mdef: 24, hit: 35, evade: 15, speed: 12, critRate: 5, critDmg: 150, atk: 40, def: 30
  },
  attributes: { con: 12, spr: 8, str: 14, agi: 10, int: 8, luk: 10, charm: 5, command: 5 },
  statusEffects: []
};

const ghoulAttacker: CombatParticipant = {
  id: 'ghoul_1',
  name: '食屍鬼',
  isPlayer: false,
  row: FormationRow.FRONT,
  gridR: 0,
  gridC: 0,
  maxHp: ghoul.hp,
  currentHp: ghoul.hp,
  maxMp: 50,
  currentMp: 50,
  isMagicalAttacker: false,
  stats: {
    hp: ghoul.hp, mp: 50, patk: ghoul.damage, matk: ghoul.damage, pdef: ghoul.pdef || 10, mdef: ghoul.mdef || 10, hit: 30, evade: ghoul.evade, speed: 10, critRate: 5, critDmg: 150, atk: ghoul.damage, def: ghoul.pdef || 10
  },
  attributes: { con: 10, spr: 10, str: 10, agi: 10, int: 10, luk: 10, charm: 1, command: 1 },
  statusEffects: []
};

const shamanAttacker: CombatParticipant = {
  id: 'shaman_1',
  name: '薩滿',
  isPlayer: false,
  row: FormationRow.BACK,
  gridR: 2,
  gridC: 1,
  maxHp: shaman.hp,
  currentHp: shaman.hp,
  maxMp: 80,
  currentMp: 80,
  isMagicalAttacker: true,
  stats: {
    hp: shaman.hp, mp: 80, patk: shaman.damage, matk: shaman.damage, pdef: shaman.pdef || 10, mdef: shaman.mdef || 10, hit: 30, evade: shaman.evade, speed: 10, critRate: 5, critDmg: 150, atk: shaman.damage, def: shaman.pdef || 10
  },
  attributes: { con: 10, spr: 10, str: 10, agi: 10, int: 10, luk: 10, charm: 1, command: 1 },
  statusEffects: []
};

const physDmg = PassiveManager.calculateBasicAttackDamage(ghoulAttacker, dummyMercenary);
const magDmg = PassiveManager.calculateBasicAttackDamage(shamanAttacker, dummyMercenary);

console.log(`[食屍鬼普攻(物理)] 對 30 防禦傭兵造成: ${physDmg.damage} 點傷害 (舊版僅 7~9 點)`);
console.log(`[薩滿普攻(魔法)] 對 24 魔防傭兵造成: ${magDmg.damage} 點魔法傷害`);

assert(physDmg.damage >= 15 && physDmg.damage <= 30, '食屍鬼物理普攻應造成 15~30 點實質傷害');
assert(magDmg.damage >= 15 && magDmg.damage <= 35, '薩滿魔法普攻應造成 15~35 點實質傷害');

// 測試 3：據點駐軍生成與戰力對稱性
console.log('\n--- 測試 3：據點駐軍生成與戰力對齊檢測 ---');
const normalNode: MapNode = {
  id: 'node_test_1',
  name: '未知的怪物營地',
  description: '測試用據點',
  x: 10, y: 10,
  population: 0,
  prosperity: 0,
  nodeLevel: NodeLevel.WILDERNESS,
  ownerFactionId: null,
  isPlayerBase: false,
  terrain: TerrainType.FOREST,
  feature: NodeFeature.SUBJUGATION,
  isDynamic: true,
  isEliteLair: false,
  baseDifficulty: 10,
  isScouted: false,
  scoutExpiryDate: null,
  currentWeather: WeatherType.CLEAR,
  weatherDuration: 0
};

const encounter = monsterSystem.generateNodeEncounter(normalNode);
const totalPower = normalNode.scoutData?.garrisonPower || 0;
console.log(`[普通據點(難度10)] 駐軍數量: ${encounter.length} 隻, 總戰力: ${totalPower}, 名稱: ${normalNode.name}`);
console.log(`駐軍名單: ${encounter.map(m => `${m.name}(${m.calculatedPowerScore}戰力)`).join('、')}`);

assert(encounter.length >= 3 && encounter.length <= 5, '據點應生成 3~5 隻怪物');
assert(totalPower >= 400 && totalPower <= 750, '普通據點總戰力應在 400~750 區間，對稱 5 人隊伍(625)');

// 測試 4：稀有危險挑戰據點 (isEliteLair) 檢測
console.log('\n--- 測試 4：稀有危險挑戰據點機制實測 ---');
const eliteNode: MapNode = {
  id: 'node_elite_test',
  name: '未知的巢穴',
  description: '挑戰用據點',
  x: 20, y: 20,
  population: 0,
  prosperity: 0,
  nodeLevel: NodeLevel.WILDERNESS,
  ownerFactionId: null,
  isPlayerBase: false,
  terrain: TerrainType.RUINS,
  feature: NodeFeature.SUBJUGATION,
  isDynamic: true,
  isEliteLair: true,
  baseDifficulty: 25,
  isScouted: false,
  scoutExpiryDate: null,
  currentWeather: WeatherType.CLEAR,
  weatherDuration: 0
};

const eliteEncounter = monsterSystem.generateNodeEncounter(eliteNode);
const elitePower = eliteNode.scoutData?.garrisonPower || 0;
console.log(`[挑戰據點(難度25)] 據點名稱: ${eliteNode.name}`);
console.log(`危險等級: ${eliteNode.scoutData?.dangerLevel}, 寶藏等級: ${eliteNode.scoutData?.treasureTier}, 詞綴: ${eliteNode.scoutData?.affix}`);
console.log(`總戰力: ${elitePower}, 掉落率最高: ${Math.max(...eliteEncounter.map(m => m.equipmentDropRate || 0))}`);

assert(eliteNode.name.includes('💀') || eliteNode.name.includes('👑') || eliteNode.name.includes('🔥'), '挑戰據點名稱應包含特殊標記');
assert(eliteNode.scoutData?.affix !== undefined, '挑戰據點 100% 附加詞綴');
assert(eliteNode.scoutData?.dangerLevel?.includes('危險'), '危險度應標註極度危險');
assert(elitePower >= 1000, '挑戰據點總戰力應 >= 1000 點');

console.log('\n====================================================');
console.log(`測試結果：${passedTests} / ${totalTests} 通過`);
console.log('====================================================');
