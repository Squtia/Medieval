import { BountySystem, BountyQuest } from '../src/systems/BountySystem';
import { Territory } from '../src/models/Territory';
import { Adventurer } from '../src/models/Adventurer';
import { AdventurerState } from '../src/models/types';
import { GameState } from '../src/core/GameState';
import { DataStore } from '../src/systems/DataStore';

console.log('====================================================');
console.log('📜 酒館懸賞欄：一鍵智能派遣與一鍵領取獎勵驗證測試');
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

// 建立模擬領地
const territory = new Territory();
territory.gold = 500;
GameState.myTerritory = territory;

// 建立模擬傭兵
const trait = { name: '忠誠', description: '', effect: {} };
const adv1 = new Adventurer('adv_1', '蘭斯洛特', DataStore.JobDB['WARRIOR'] || DataStore.getRandomJob(), trait, 'SSR');
(adv1 as any).currentHp = 300;

const adv2 = new Adventurer('adv_2', '崔斯坦', DataStore.JobDB['RANGER'] || DataStore.getRandomJob(), trait, 'SSR');
(adv2 as any).currentHp = 250;

const advInjured = new Adventurer('adv_3', '重傷新兵', DataStore.JobDB['WARRIOR'] || DataStore.getRandomJob(), trait, 'N');
(advInjured as any).currentHp = 20; // 殘血受傷 (< 30%)

GameState.adventurers = [adv1, adv2, advInjured];

// 建立懸賞單
const b1: BountyQuest = {
  id: 'b_1', name: '找尋遺失的名畫', desc: '', duration: 2, expireDays: 3, status: 'PENDING',
  rewards: { gold: 120, exp: 50 }
};
const b2: BountyQuest = {
  id: 'b_2', name: '幫忙拔草', desc: '', duration: 1, expireDays: 2, status: 'PENDING',
  rewards: { gold: 15, exp: 10 }
};
const b3: BountyQuest = {
  id: 'b_3', name: '清理礦坑哥布林', desc: '', duration: 3, expireDays: 4, status: 'PENDING',
  rewards: { gold: 200, exp: 80, items: [{ id: 'IRON_ORE', amount: 5 }] }
};

GameState.bounties = [b1, b2, b3];

console.log('\n--- 測試 1：懸賞欄一鍵智能派遣 (高收益優先 + 受傷跳過) ---');
const dispatchRes = BountySystem.autoDispatchAllBounties(GameState);
console.log(`派出委託數: ${dispatchRes.dispatchedCount}, 任務: ${dispatchRes.taskNames.join(', ')}`);

assert(dispatchRes.dispatchedCount === 2, '應派出 2 位健康傭兵接單');
assert(dispatchRes.taskNames[0] === '清理礦坑哥布林', '第 1 順位應為最高收益的清理礦坑哥布林 (200G)');
assert(dispatchRes.taskNames[1] === '找尋遺失的名畫', '第 2 順位應為次高收益的找尋遺失的名畫 (120G)');
assert(advInjured.currentState === AdventurerState.IDLE, '受傷新兵 (HP < 30%) 應被自動保護跳過');
assert(adv1.currentState === AdventurerState.DISPATCHED, '健康傭兵 1 應已出發執行委託');
assert(adv2.currentState === AdventurerState.DISPATCHED, '健康傭兵 2 應已出發執行委託');

console.log('\n--- 測試 2：懸賞欄一鍵領取全部獎勵 ---');
// 模擬委託完成
GameState.bounties.forEach(b => {
  if (b.status === 'IN_PROGRESS') {
    b.status = 'COMPLETED';
  }
});

const claimRes = BountySystem.claimAllCompletedBounties(GameState);
console.log(`結算委託數: ${claimRes.completedCount}, 金幣: ${claimRes.totalGold}, 經驗: ${claimRes.totalExp}`);

assert(claimRes.completedCount === 2, '應成功結算 2 項已完成委託');
assert(claimRes.totalGold === 320, '應獲得總共 320 金幣');
assert(territory.gold === 820, '領地總金幣應增至 820');
assert(territory.materials['IRON_ORE'] === 5, '領地倉庫應收到 5 份鐵礦');
assert(adv1.currentState === AdventurerState.IDLE, '傭兵 1 結算後應恢復閒置狀態');
assert(adv2.currentState === AdventurerState.IDLE, '傭兵 2 結算後應恢復閒置狀態');

console.log('\n====================================================');
console.log(`測試結果：${passed} / ${total} 全部通過！`);
console.log('====================================================');
