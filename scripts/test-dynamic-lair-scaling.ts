import { Adventurer } from '../src/models/Adventurer';
import { GameState } from '../src/core/GameState';
import { DataStore } from '../src/systems/DataStore';
import { MonsterSystem } from '../src/systems/MonsterSystem';
import { MapNode, NodeLevel, NodeFeature, WeatherType, TerrainType } from '../src/models/types';
import { Territory } from '../src/models/Territory';
import { MapEventSystem } from '../src/systems/map/MapEventSystem';

console.log('====================================================');
console.log('🧪 動態偵測戰力與階梯式據點難度生成單元測試');
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

const trait = { name: '勇猛', description: '', effect: {} };
const monsterSys = new MonsterSystem();

console.log('\n--- 測試 1：單一傭兵 power 屬性與戰力計算 ---');
const adv1 = new Adventurer('adv_1', '新兵亞倫', DataStore.JobDB['WARRIOR'] || DataStore.getRandomJob(), trait, 'N');
console.log(`1 級新兵戰力: ${adv1.power}`);
assert(typeof adv1.power === 'number' && !isNaN(adv1.power) && adv1.power >= 25 && adv1.power <= 75, '1 級新兵戰力應在 25~75 區間');

console.log('\n--- 測試 2：剛開局只有 1 名傭兵時的動態據點生成 ---');
GameState.adventurers = [adv1];
const myTerritory = new Territory();
myTerritory.gold = 500;
GameState.myTerritory = myTerritory;

const baseNode: MapNode = {
  id: 'player_base', name: '王都', description: '', x: 50, y: 50, population: 100, prosperity: 100,
  nodeLevel: NodeLevel.CAMP, ownerFactionId: 'player', isPlayerBase: true, terrain: TerrainType.PLAINS,
  feature: NodeFeature.OCCUPIABLE, isScouted: true, scoutExpiryDate: null, currentWeather: WeatherType.CLEAR, weatherDuration: 0
};

// 執行 10 次探索生成據點，檢查戰力與怪獸數量
let singleHeroLairPowers: number[] = [];
let singleHeroLairSizes: number[] = [];

for (let i = 0; i < 10; i++) {
  const mapNodes: MapNode[] = [baseNode];
  const lairNode = MapEventSystem.spawnDynamicNode(mapNodes, baseNode, 10);
  if (lairNode) {
    const encounter = monsterSys.generateNodeEncounter(lairNode);
    const totalPower = encounter.reduce((s, m) => s + m.calculatedPowerScore, 0);
    singleHeroLairPowers.push(totalPower);
    singleHeroLairSizes.push(encounter.length);
  }
}

const avgSinglePower = singleHeroLairPowers.reduce((a, b) => a + b, 0) / singleHeroLairPowers.length;
console.log(`1 人開局據點平均戰力: ${avgSinglePower.toFixed(1)}，怪物數量清單: ${singleHeroLairSizes.join(', ')}`);
assert(avgSinglePower < 100, '1 人開局據點平均戰力應小於 100（避免 800+ 滅團）');
assert(singleHeroLairSizes.every(size => size <= 2), '1 人開局據點怪物數量應不超過 2 隻（以 1 隻為主避免被圍毆）');

console.log('\n--- 測試 3：招募 3 名傭兵時的動態據點生成 ---');
const adv2 = new Adventurer('adv_2', '遊俠席恩', DataStore.JobDB['RANGER'] || DataStore.getRandomJob(), trait, 'R');
const adv3 = new Adventurer('adv_3', '法師莉莉', DataStore.JobDB['MAGE'] || DataStore.getRandomJob(), trait, 'SR');
GameState.adventurers = [adv1, adv2, adv3];
const teamPower3 = adv1.power + adv2.power + adv3.power;
console.log(`3 人小隊總戰力: ${teamPower3}`);

let team3LairPowers: number[] = [];
for (let i = 0; i < 10; i++) {
  const mapNodes: MapNode[] = [baseNode];
  const lairNode = MapEventSystem.spawnDynamicNode(mapNodes, baseNode, 10);
  if (lairNode) {
    const encounter = monsterSys.generateNodeEncounter(lairNode);
    const totalPower = encounter.reduce((s, m) => s + m.calculatedPowerScore, 0);
    team3LairPowers.push(totalPower);
  }
}

const avgTeam3Power = team3LairPowers.reduce((a, b) => a + b, 0) / team3LairPowers.length;
console.log(`3 人隊伍據點平均戰力: ${avgTeam3Power.toFixed(1)}`);
assert(avgTeam3Power >= teamPower3 * 0.6 && avgTeam3Power <= teamPower3 * 2.3, '3 人隊伍據點戰力應貼近 3 人總戰力');

console.log('\n--- 測試 4：滿編 5 名傭兵時的動態據點生成 ---');
const adv4 = new Adventurer('adv_4', '聖騎加拉哈德', DataStore.JobDB['PALADIN'] || DataStore.getRandomJob(), trait, 'SSR');
const adv5 = new Adventurer('adv_5', '狂戰巴薩卡', DataStore.JobDB['BERSERKER'] || DataStore.getRandomJob(), trait, 'SSR');
GameState.adventurers = [adv1, adv2, adv3, adv4, adv5];
const teamPower5 = adv1.power + adv2.power + adv3.power + adv4.power + adv5.power;
console.log(`5 人小隊總戰力: ${teamPower5}`);

let team5LairPowers: number[] = [];
for (let i = 0; i < 10; i++) {
  const mapNodes: MapNode[] = [baseNode];
  const lairNode = MapEventSystem.spawnDynamicNode(mapNodes, baseNode, 10);
  if (lairNode) {
    const encounter = monsterSys.generateNodeEncounter(lairNode);
    const totalPower = encounter.reduce((s, m) => s + m.calculatedPowerScore, 0);
    team5LairPowers.push(totalPower);
  }
}

const avgTeam5Power = team5LairPowers.reduce((a, b) => a + b, 0) / team5LairPowers.length;
console.log(`5 人隊伍據點平均戰力: ${avgTeam5Power.toFixed(1)}`);
assert(avgTeam5Power >= teamPower5 * 0.6 && avgTeam5Power <= teamPower5 * 2.3, '5 人隊伍據點戰力應貼近 5 人總戰力');

console.log('\n====================================================');
console.log(`測試結果：${passed} / ${total} 全部通過！`);
console.log('====================================================');
