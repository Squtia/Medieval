import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { WorkerJob } from '../models/types';
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
    
    // 1. 產出計算
    const foodProduced = (workers[WorkerJob.FARMER] || 0) * 3; // 每個農夫產 3 糧
    const woodProduced = (workers[WorkerJob.WOODCUTTER] || 0) * 2; // 每個伐木工產 2 木
    const stoneProduced = (workers[WorkerJob.MINER] || 0) * 1; // 每個礦工產 1 石
    
    // 礦工有機率挖到鐵礦
    let ironProduced = 0;
    if (workers[WorkerJob.MINER] > 0 && Random.next() < 0.2) {
      ironProduced = 1;
    }

    // 2. 消耗計算 (總人口每人耗 1 糧，英雄每人耗 1 糧)
    const totalPeople = territory.population + GameState.adventurers.length;
    const foodConsumed = totalPeople * 1;

    // 3. 結算
    territory.wood += woodProduced;
    territory.stone += stoneProduced;
    territory.iron += ironProduced;
    territory.food += foodProduced - foodConsumed;

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
        const jobKeys = [WorkerJob.UNASSIGNED, WorkerJob.FARMER, WorkerJob.WOODCUTTER, WorkerJob.MINER];
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
      // 若糧食充足，可以自然吸引流民 (10%機率)
      if (territory.food > totalPeople * 2 && Random.next() < 0.1) {
         territory.population += 1;
         territory.workers[WorkerJob.UNASSIGNED] += 1;
         console.log(`[SettlementSystem] 🏕️ 領地繁榮！流民被吸引而來，總人口增加 1 人。`);
      }
    }

    // 發布資源變更事件，讓 UI 更新
    EventBus.getInstance().publish({
      type: GameEventType.RESOURCE_CHANGED,
      payload: { resourceType: 'ALL', amount: 0, currentTotal: 0 }
    });
  }
}
