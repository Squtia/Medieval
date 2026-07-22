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

export function initActionController(): void {
  // 野外討伐
  document.getElementById('btn-wild-quest')?.addEventListener('click', () => {
    const node = GameState.currentViewNode;
    if (!node) return;
    const features = Object.values(EnemyFeature);
    const randomFeature = Random.pick(features);
    const task = new DispatchTask(`掃蕩${node.name}`, TaskType.COMBAT, 0, 20, 200, 20, 100, randomFeature);
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
    
    territory.exploredToday++;
    territory.exploreCount = (territory.exploreCount || 0) + 1;
    
    let recruitedAdv: Adventurer | null = null;
    let qLabel = '';
    
    // 1. 判斷首 3 次保底與機率
    if (!territory.hasRecruitedFromFirstExplorations && territory.exploreCount <= 3) {
      // 初始 3 次內探索，若是第 3 次且尚未招募過，則必定成功招募 (品質固定為 N)
      // 或者是前 2 次以 20% 機率成功招募
      const forceRecruit = territory.exploreCount === 3;
      const luckyRecruit = Random.next() < 0.20;
      
      if (forceRecruit || luckyRecruit) {
        recruitedAdv = new Adventurer(`adv_explore_${Date.now()}`, NameGenerator.generateFullName(), DataStore.getRandomJob(), DataStore.getRandomRecruitTrait(), 'N');
        territory.hasRecruitedFromFirstExplorations = true;
        qLabel = 'N 普通';
      }
    } else {
      // 已經保底過或超過 3 次後，每次探索有 10% 機率招募！
      const maxRoster = getMaxRosterLimit(territory.title);
      if (Random.next() < 0.10 && GameState.adventurers.length < maxRoster) {
        // 隨機抽取品質：N極大、R低、SR極低、SSR最低
        let q: 'N' | 'R' | 'SR' | 'SSR' = 'N';
        const randQ = Random.next() * 100;
        if (randQ < 0.2) { q = 'SSR'; qLabel = 'SSR 傳奇'; }
        else if (randQ < 3.0) { q = 'SR'; qLabel = 'SR 史詩'; }
        else if (randQ < 10.0) { q = 'R'; qLabel = 'R 精英'; }
        else { q = 'N'; qLabel = 'N 普通'; }
        
        recruitedAdv = new Adventurer(`adv_explore_${Date.now()}`, NameGenerator.generateFullName(), DataStore.getRandomJob(), DataStore.getRandomRecruitTrait(), q);
      }
    }
    
    // 2. 繁榮度反比：探索獲得難民勞動力判定
    let foundRefugees = 0;
    const currentNode = GameState.mapSystem.getNodes().find(n => n.id === territory.currentCountryId);
    const currentProsperity = currentNode ? currentNode.prosperity : 0;
    const maxRefugeeChance = 0.30;
    const penalty = Math.min(0.25, (currentProsperity / 500) * 0.25);
    const findRefugeeChance = Math.max(0.05, maxRefugeeChance - penalty);

    if (Random.next() < findRefugeeChance) {
      foundRefugees = Random.int(1, 3);
      territory.population += foundRefugees;
      territory.workers['UNASSIGNED'] += foundRefugees;
    }

    // 3. 結算獎勵
    let msg = '🗺️ [探索] 領主親自巡視周邊，獲得了 20 金幣與少量物資！';
    territory.addGold(20);
    territory.wood += 2;
    territory.stone += 1;
    
    if (recruitedAdv) {
      GameState.adventurers.push(recruitedAdv);
      msg = `🗺️ [探索] 領主親自巡視周邊，獲得了 20 金幣，並幸運地遇到一位流浪冒險者【${recruitedAdv.name}】(${qLabel}) 願意效忠您！已加入隊伍。`;
      ToastManager.show(`招募到了冒險者【${recruitedAdv.name}】！`);
    } else if (foundRefugees > 0) {
      msg = `🗺️ [探索] 領主巡視周邊，獲得了 20 金幣與物資，並在廢棄營地救出了 ${foundRefugees} 名流民，已加入領地閒置人力！`;
      ToastManager.show(`荒野探索：救出了 ${foundRefugees} 名流民！`);
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
