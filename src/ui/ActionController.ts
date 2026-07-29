import { GameState } from '../core/GameState';
import { UIManager } from './UIManager';
import { ToastManager } from './ToastManager';
import { Random } from '../core/Random';
import { DispatchTask, EnemyFeature, TaskType } from '../models/DispatchTask';
import { NodeLevel, getMaxRosterLimit } from '../models/types';
import { Adventurer } from '../models/Adventurer';
import { NameGenerator } from '../systems/NameGenerator';
import { DataStore } from '../systems/DataStore';
import { enterScene, returnToMap } from './SceneController';
import {
  getCombatPrestigeReward,
  getDifficultyModifiers
} from '../data/BalanceData';

export function initActionController(): void {
  // 野外討伐
  document.getElementById('btn-wild-quest')?.addEventListener('click', () => {
    const node = GameState.currentViewNode;
    if (!node) return;
    const features = Object.values(EnemyFeature);
    const randomFeature = Random.pick(features);
    const difficulty = Math.round(20 * getDifficultyModifiers(GameState.worldGeneration?.difficulty).enemyStrength);
    const prestige = getCombatPrestigeReward(difficulty, false, node.nodeLevel);
    const task = new DispatchTask(`掃蕩${node.name}`, TaskType.COMBAT, 0, difficulty, 200, prestige, 100, randomFeature);
    GameState.system.dispatchAdventurers(GameState.adventurers, task);
    
    let featureMsg = '';
    if (randomFeature === EnemyFeature.HIGH_DEF) featureMsg = ' (情報指出該區域有高防禦的重裝魔物)';
    else if (randomFeature === EnemyFeature.HIGH_EVADE) featureMsg = ' (情報指出該區域有高閃避的敏捷魔物)';
    
    console.log(`🚀 [任務派發] 小隊已出發前往「${node.name}」進行掃蕩！${featureMsg}`);
    UIManager.updateUI();
  });

  // 遷移與建立據點
  document.getElementById('btn-migrate')?.addEventListener('click', () => {
    const node = GameState.currentViewNode;
    if (node && node.nodeLevel > NodeLevel.WILDERNESS) {
      if (GameState.mapSystem.relocateBase(node.id, GameState.myTerritory)) {
        const btnMigrate = document.getElementById('btn-migrate');
        if (btnMigrate) btnMigrate.style.display = 'none';
        enterScene(node);
        UIManager.updateUI();
      }
    }
  });

  document.getElementById('btn-found-settlement')?.addEventListener('click', () => {
    const node = GameState.currentViewNode;
    if (node && node.nodeLevel === NodeLevel.WILDERNESS) {
      if (GameState.mapSystem.foundSettlement(node.id, GameState.myTerritory)) {
        returnToMap();
        enterScene(node);
      }
    }
  });

  // 探索
  document.getElementById('btn-explore')?.addEventListener('click', () => {
    const territory = GameState.myTerritory;
    if (territory.exploredToday >= territory.maxExplorationsPerDay) {
      ToastManager.show(`本回合已探索過周邊（上限：${territory.maxExplorationsPerDay}次），請推進回合後再試！`);
      return;
    }
    const modifiers = getDifficultyModifiers(GameState.worldGeneration?.difficulty);
    const foodCost = 5;
    if (territory.food < foodCost) {
      ToastManager.show(`探索需要 ${foodCost} 糧食作為補給。`);
      return;
    }
    
    territory.exploredToday++;
    territory.exploreCount = (territory.exploreCount || 0) + 1;
    territory.food -= foodCost;
    

    
    // 1. 拔除所有探索產生傭兵的機制 (無論是否為前三次)
    // 玩家現在必須透過「營火/酒館」來招募傭兵
    
    // 2. 繁榮度反比：探索獲得難民勞動力判定
    let foundRefugees = 0;
    const currentNode = GameState.mapSystem.getNodes().find(n => n.id === territory.currentCountryId);
    const currentProsperity = currentNode ? currentNode.prosperity : 0;
    const maxRefugeeChance = 0.10 * modifiers.refugeeChance;
    const penalty = Math.min(0.08, (currentProsperity / 500) * 0.08);
    const findRefugeeChance = Math.max(0.02, maxRefugeeChance - penalty);

    if (territory.refugeeDiscoveryCooldownDays <= 0 && Random.next() < findRefugeeChance) {
      foundRefugees = Random.int(1, 2);
      territory.population += foundRefugees;
      territory.workers['UNASSIGNED'] += foundRefugees;
      territory.refugeeDiscoveryCooldownDays = 10;
    }

    // 3. 結算獎勵
    const goldReward = Math.max(1, Math.round(Random.int(8, 15) * modifiers.explorationReward));
    const woodReward = Math.round(Random.int(0, 2) * modifiers.explorationReward);
    const stoneReward = Math.round(Random.int(0, 1) * modifiers.explorationReward);
    let msg = `🗺️ [探索] 領主巡視周邊，消耗 ${foodCost} 糧食，獲得 ${goldReward} 金幣、${woodReward} 木材與 ${stoneReward} 石材。`;
    territory.addGold(goldReward);
    territory.wood += woodReward;
    territory.stone += stoneReward;

    // 4. 新增：動態探索周邊節點 (30% 機率)
    let spawnedNode = null;
    if (Random.next() < 0.3) {
      const playerNode = GameState.mapSystem.getNodes().find(n => n.id === territory.currentCountryId);
      if (playerNode) {
        spawnedNode = GameState.mapSystem.spawnDynamicNode(playerNode, 10);
      }
    }
    
    if (foundRefugees > 0) {
      msg += ` 並在廢棄營地救出了 ${foundRefugees} 名流民，已加入領地閒置人力！`;
      ToastManager.show(`荒野探索：救出了 ${foundRefugees} 名流民！`);
    }

    if (spawnedNode) {
      msg += `\n⚠️ 【警報】斥候回報在領地周遭發現了「${spawnedNode.name}」，已標記於大陸地圖上！`;
      ToastManager.show(`發現周邊巢穴：${spawnedNode.name}！`, 'warning');
    }
    
    console.log(msg);
    UIManager.updateUI();
  });

  // 進貢與宴會
  document.getElementById('btn-tribute')?.addEventListener('click', () => {
    if (GameState.myTerritory.gold >= 100) {
      GameState.myTerritory.gold -= 100;
      GameState.myTerritory.royalFavor += 10;
      console.log(`🎁 [謁見廳] 您向${GameState.currentViewNode?.name || '皇家'}獻上了 100 金幣，好感度提升了！`);
      UIManager.updateUI();
    }
  });

  document.getElementById('btn-feast')?.addEventListener('click', () => {
    if (GameState.myTerritory.gold >= 300) {
      GameState.myTerritory.gold -= 300;
      GameState.myTerritory.prestige += 50;
      console.log('[系統] 🍷 [謁見廳] 您舉辦了盛大的宴會！消耗 300 金幣，聲望大幅提升！');
      UIManager.updateUI();
    }
  });
}
