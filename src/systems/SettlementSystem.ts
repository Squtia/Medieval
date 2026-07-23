import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { WorkerJob, getTaxBonusPer10Pop } from '../models/types';
import { Random } from '../core/Random';

export class SettlementSystem {
  constructor() {
    const eventBus = EventBus.getInstance();
    
    // 監聽天數流逝，進行資源結算
    eventBus.subscribe(GameEventType.DAY_PASSED, (payload) => {
      this.resolveDailyResources();
    });

    // 監聽災難威脅抵達
    eventBus.subscribe(GameEventType.THREAT_ARRIVED, (payload) => {
      const territory = GameState.myTerritory;
      const effectiveSeverity = GameState.threat.prepared ? Math.ceil(payload.severity / 2) : payload.severity;
      const foodLost = Math.min(territory.food, effectiveSeverity * 4);
      territory.food -= foodLost;
      territory.prestige = Math.max(0, territory.prestige - effectiveSeverity);
      console.log(`[SettlementSystem] 警告！據點遭受了 ${payload.threatName} 的襲擊！(嚴重度: ${payload.severity})`);
      console.log(`[內政] ❄️ 災害造成糧食 -${foodLost}、聲望 -${effectiveSeverity}${GameState.threat.prepared ? '（防災準備已降低損失）' : ''}。`);
    });
  }

  private resolveDailyResources() {
    const territory = GameState.myTerritory;
    const workers = territory.workers;
    
    // -- Phase 5: 治安度 (Security System) --
    const effectivePop = Math.max(0, territory.population - 50); // 新手保護：前 50 人不需守衛
    let newSecurity = 100;
    const totalTroops = (workers[WorkerJob.INFANTRY] || 0) + (workers[WorkerJob.CAVALRY] || 0) + (workers[WorkerJob.ARCHER] || 0);
    if (effectivePop > 0) {
      const requiredTroops = effectivePop * 0.1; // 每 10 名有效人口需要 1 名士兵維持治安
      const coverage = totalTroops / requiredTroops;
      newSecurity = Math.floor(Math.min(1, coverage) * 100);
    }
    territory.security = newSecurity;

    let productionMultiplier = 1.0;
    if (territory.security >= 80) productionMultiplier = 1.2;
    else if (territory.security < 30) productionMultiplier = 0.7;

    // 軍事威望 (選項 B)：每 10 名士兵每日產生 1 點聲望
    if (totalTroops >= 10) {
      territory.prestige += Math.floor(totalTroops / 10);
    }
    
    // 1. 產出計算 (套用治安倍率)
    const foodProduced = Math.floor(((workers[WorkerJob.FARMER] || 0) * 3) * productionMultiplier);
    const woodProduced = Math.floor(((workers[WorkerJob.WOODCUTTER] || 0) * 2) * productionMultiplier);
    const stoneProduced = Math.floor(((workers[WorkerJob.MINER] || 0) * 1) * productionMultiplier);
    
    // 礦工有機率挖到鐵礦 (每個礦工獨立 20% 機率)
    let ironProduced = 0;
    const minerCount = workers[WorkerJob.MINER] || 0;
    for (let i = 0; i < minerCount; i++) {
      if (Random.next() < 0.2) {
        ironProduced += 1;
      }
    }
    // 鐵礦也套用倍率
    ironProduced = Math.floor(ironProduced * productionMultiplier);

    // 2. 消耗計算 (總人口每人耗 1 糧，英雄每人耗 1 糧)
    const totalPeople = territory.population + GameState.adventurers.length;
    let foodConsumed = totalPeople * 1;

    // 軍隊消耗額外糧食 (兵力護盾)
    foodConsumed += (workers[WorkerJob.INFANTRY] || 0) * 1;
    foodConsumed += (workers[WorkerJob.ARCHER] || 0) * 1;
    foodConsumed += (workers[WorkerJob.CAVALRY] || 0) * 2; // 騎兵連馬一起吃

    // 3. 結算
    territory.wood += woodProduced;
    territory.stone += stoneProduced;
    territory.iron += ironProduced;
    territory.food += foodProduced - foodConsumed;

    // 每日稅收加成 (依據爵位與人口，並套用治安倍率)
    const taxBonusPer10 = getTaxBonusPer10Pop(territory.title);
    if (taxBonusPer10 > 0 && territory.population >= 10) {
      const baseTax = Math.floor(territory.population / 10) * taxBonusPer10;
      const taxIncome = Math.floor(baseTax * productionMultiplier);
      territory.addGold(taxIncome);
    }

    // 4. 飢荒判定
    if (territory.food < 0) {
      const deficit = Math.abs(territory.food);
      territory.food = 0; // 糧食見底
      
      // 每缺 5 糧食餓死/離開 1 人 (簡化邏輯)
      const starved = Math.ceil(deficit / 5);
      
      if (starved > 0 && territory.population > 0) {
        // 最多只能餓死現有人口
        const actualStarved = Math.min(starved, territory.population);
        territory.population -= actualStarved;
        territory.prestige = Math.max(0, territory.prestige - actualStarved * 2);
        
        // 隨機裁減工人（BUG-03: 加入安全退出護段，防止所有工人為 0 時無限迴圈）
        let removed = 0;
        const jobKeys = [WorkerJob.UNASSIGNED, WorkerJob.FARMER, WorkerJob.WOODCUTTER, WorkerJob.MINER, WorkerJob.INFANTRY, WorkerJob.CAVALRY, WorkerJob.ARCHER];
        let safetyCounter = 0;
        while (removed < actualStarved && safetyCounter < 1000) {
          safetyCounter++;
          // 安全退出：若所有職業工人均為 0，直接結束
          const hasWorkers = jobKeys.some(j => territory.workers[j] > 0);
          if (!hasWorkers) break;

          const randJob = Random.pick(jobKeys);
          if (territory.workers[randJob] > 0) {
            territory.workers[randJob]--;
            removed++;
          }
        }

        EventBus.getInstance().publish({
          type: GameEventType.POPULATION_STARVED,
          payload: { starvedAmount: actualStarved, currentPopulation: territory.population }
        });
        console.log(`[SettlementSystem] 💀 飢荒！糧食不足，${actualStarved} 名流民離開或餓死了。當前總人口：${territory.population}`);
      }
    } else {
      // 領地有餘糧即可吸引流民 (不再需要大於2倍)
      if (territory.food > totalPeople) {
        // 基礎機率 20%，每 100 聲望 +1% (上限 50%)
        const prestigeBonus = Math.floor(territory.prestige / 100) * 0.01;
        const attractChance = Math.min(0.5, 0.2 + prestigeBonus);
        
        if (Random.next() < attractChance) {
          // 收益動態化：增加當前總人口的 5% (最少 1 人)
          const newComers = Math.max(1, Math.floor(territory.population * 0.05));
          territory.population += newComers;
          territory.workers[WorkerJob.UNASSIGNED] += newComers;
          console.log(`[SettlementSystem] 🏕️ 領地繁榮！流民被您的聲望與餘糧吸引而來，總人口增加 ${newComers} 人。`);
        }
      }
    }

    // 發布資源變更事件，讓 UI 更新
    EventBus.getInstance().publish({
      type: GameEventType.RESOURCE_CHANGED,
      payload: { resourceType: 'ALL', amount: 0, currentTotal: 0 }
    });
  }
}
