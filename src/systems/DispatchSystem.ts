import { Adventurer } from '../models/Adventurer';
import { DispatchTask, EnemyFeature, TaskType } from '../models/DispatchTask';
import { Territory } from '../models/Territory';
import { AdventurerState, NobleTitle, NodeFeature } from '../models/types';
import { EquipmentGenerator } from './EquipmentGenerator';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { CombatHistoryRecord } from '../models/Combat';
import { TRADE_GOODS } from './MarketSystem';
import { CombatSystem } from './CombatSystem';

/**
 * 代表正在執行中的任務
 */
export interface ActiveMission {
  adventurers: Adventurer[];
  task: DispatchTask;
  remainingDays: number; // 剩餘天數
}

/**
 * 派遣系統與遊戲核心循環
 */
export class DispatchSystem {
  private territory: Territory;
  private activeMissions: ActiveMission[] = [];

  constructor(territory: Territory) {
    this.territory = territory;
  }

  /**
   * 派遣冒險者小隊執行任務
   */
  public dispatchAdventurers(adventurers: Adventurer[], task: DispatchTask): void {
    if (adventurers.length === 0) {
      console.warn('⚠️ 派遣失敗：沒有選擇任何冒險者。');
      return;
    }

    for (const adv of adventurers) {
      if (adv.currentState !== AdventurerState.IDLE) {
        console.warn(`⚠️ 派遣失敗：冒險者 ${adv.name} 目前無法指派 (狀態: ${adv.currentState})。`);
        return;
      }
    }

    const remainingDays = task.requiredDays;

    for (const adv of adventurers) {
      adv.currentState = AdventurerState.DISPATCHED;
      adv.dispatchEndTime = null; 
    }

    this.activeMissions.push({
      adventurers,
      task,
      remainingDays
    });

    console.log(`🚀 [任務派發] 小隊已出發前往執行「${task.name}」！預計 ${task.requiredDays} 天後完成。`);
  }

  /**
   * 推進遊戲天數
   */
  public updateDays(days: number): void {
    for (let i = this.activeMissions.length - 1; i >= 0; i--) {
      const mission = this.activeMissions[i];
      mission.remainingDays -= days;

      if (mission.remainingDays <= 0) {
        if (mission.task.type === TaskType.TRADE && mission.task.tradeRouteNodeIds && mission.task.tradeRouteNodeIds.length > 0) {
          const isFinished = this.reachWaypoint(mission);
          if (isFinished) {
            this.completeMission(mission);
            this.activeMissions.splice(i, 1);
          }
        } else {
          this.completeMission(mission);
          this.activeMissions.splice(i, 1);
        }
      }
    }
  }

  /**
   * 月底大結算 (內政與外交結算)
   */
  public resolveMonth(): void {
    // ❗ BUG-02 修復：移除重複的 DAY_PASSED 發送（已由 GameLoop 發送）

    // OPT-03: 重設計月底稅收公式（讓內政有意義）
    const baseTax = this.territory.population * 5 * this.territory.taxRate;
    const populationUpkeep = this.territory.population * 2;           // 人口維護費隨人口成長
    const adventurerWages = GameState.adventurers.length * 30;         // 决陽者每月薪資 30 金
    const prestigeLoss = Math.max(0, (this.territory.taxRate - 1) * 2);
    const netIncome = baseTax - adventurerWages - this.territory.diplomaticGift - populationUpkeep;

    this.territory.addGold(netIncome);    // addGold 已允許負值，赤字會真正扣錢
    this.territory.prestige -= prestigeLoss;

    if (netIncome < 0 && this.territory.gold < 0) {
      console.log(`⚠️ [赤字警告] 領地陷入財務危機！無法支付維護費！當前負偉：${Math.abs(this.territory.gold)} 金幣。`);
    }

    if (this.territory.diplomaticGift > 0) {
      this.territory.royalFavor += this.territory.diplomaticGift * 0.5;
      this.territory.prestige += this.territory.diplomaticGift * 0.2;
    }

    console.log(`📜 [月底結算] 收入：${Math.floor(baseTax)}金 | 人口維護：-${Math.floor(populationUpkeep)} | 决陽者薪資：-${adventurerWages} | 凈口：${Math.floor(netIncome)} 金幣。當前聲望：${this.territory.prestige}`);
  }

  private reachWaypoint(mission: ActiveMission): boolean {
    const { adventurers, task } = mission;
    
    const mapSystem = GameState.mapSystem;
    if (!mapSystem) return true;

    if (task.currentRouteIndex === undefined) task.currentRouteIndex = 0;
    const currentNodeId = task.tradeRouteNodeIds![task.currentRouteIndex!];
    const currentNode = mapSystem.getNodeById(currentNodeId);

    if (!currentNode) return true;

    let advNames = adventurers.map(a => a.name).join(', ');
    console.log(`📍 [商隊抵達] 冒險者小隊 (${advNames}) 抵達中途站：${currentNode.name}`);

    let weatherPenalty = 0;
    if (currentNode.currentWeather === 'SNOW' || currentNode.currentWeather === 'SANDSTORM') {
      let totalInt = 0, totalLuk = 0;
      adventurers.forEach(a => {
         const eff = a.getEffectiveAttributes();
         totalInt += eff.int;
         totalLuk += eff.luk;
      });
      if (totalInt + totalLuk < 50) {
         weatherPenalty = 2;
         console.log(`⚠️ [遭遇惡劣天氣] 由於在 ${currentNode.name} 遭遇惡劣天氣，商隊受到阻礙，將延遲 2 天抵達下一站！`);
      } else {
         console.log(`🌤️ [化險為夷] 儘管天氣惡劣，商隊依靠高智慧與幸運順利度過了危機！`);
      }
    }

    if (task.tradeInstructions && task.caravanCargo && task.caravanGold !== undefined) {
      const instruction = task.tradeInstructions.find(i => i.nodeId === currentNodeId);
      if (instruction && currentNode.marketData) {
         let totalCargoWeight = Object.values(task.caravanCargo).reduce((a,b)=>a+b, 0);
         
         let totalCapacity = 0;
         let totalNegotiation = 0;
         adventurers.forEach(a => {
            const ts = a.getTradeStats();
            totalCapacity += ts.maxCargoWeight;
            totalNegotiation += ts.negotiationBonus;
         });
         
         for (const sellGoodId of instruction.sell) {
             const amountToSell = task.caravanCargo![sellGoodId] || 0;
             if (amountToSell > 0) {
                 const marketItem = currentNode.marketData.goods.find(g => g.goodId === sellGoodId);
                 if (marketItem) {
                     const sellPrice = Math.max(1, Math.floor(marketItem.sellPrice * (1 + totalNegotiation)));
                     const goldGained = sellPrice * amountToSell;
                     task.caravanGold! += goldGained;
                     task.caravanCargo![sellGoodId] = 0;
                     totalCargoWeight -= amountToSell;
                     
                     const goodRef = TRADE_GOODS.find(g => g.id === sellGoodId);
                     const goodName = goodRef ? `${goodRef.icon || '📦'} ${goodRef.name}` : sellGoodId;
                     console.log(`💰 [商隊交易] 在 ${currentNode.name} 賣出了 ${amountToSell} 單位 ${goodName}，獲得 ${goldGained} 金幣。`);
                 }
             }
         }
         
         for (const buyItem of instruction.buy) {
             const marketItem = currentNode.marketData.goods.find(g => g.goodId === buyItem.goodId);
             if (marketItem && marketItem.stock > 0) {
                 const buyPrice = Math.max(1, Math.floor(marketItem.buyPrice * (1 - totalNegotiation)));
                 const affordableAmount = Math.floor(task.caravanGold / buyPrice);
                 const capacityLeft = totalCapacity - totalCargoWeight;
                 const buyAmount = Math.min(buyItem.maxAmount, marketItem.stock, affordableAmount, capacityLeft);
                 
                 const goodRef = TRADE_GOODS.find(g => g.id === buyItem.goodId);
                 const goodName = goodRef ? `${goodRef.icon || '📦'} ${goodRef.name}` : buyItem.goodId;

                 if (buyAmount > 0) {
                     task.caravanGold! -= buyPrice * buyAmount;
                     task.caravanCargo![buyItem.goodId] = (task.caravanCargo![buyItem.goodId] || 0) + buyAmount;
                     totalCargoWeight += buyAmount;
                     marketItem.stock -= buyAmount;
                     console.log(`🛒 [商隊交易] 在 ${currentNode.name} 買入了 ${buyAmount} 單位 ${goodName}，花費 ${buyPrice * buyAmount} 金幣。`);
                 } else {
                     if (affordableAmount <= 0) console.log(`❌ [商隊交易] 在 ${currentNode.name} 資金不足，無法購買 ${goodName}。`);
                     else if (capacityLeft <= 0) console.log(`📦 [商隊交易] 在 ${currentNode.name} 馬車已滿，無法裝載 ${goodName}。`);
                 }
             }
         }
      }
    }

    task.currentRouteIndex!++;
    if (task.currentRouteIndex! >= task.tradeRouteNodeIds!.length) {
      console.log(`🏁 [商隊返程] 商隊已完成所有停靠站，正在返回領地！`);
      
      const playerNode = mapSystem.getNodes().find(n => n.isPlayerBase);
      let returnDays = 3;
      if (playerNode) {
        const dist = Math.sqrt(Math.pow(currentNode.x - playerNode.x, 2) + Math.pow(currentNode.y - playerNode.y, 2));
        returnDays = Math.max(1, Math.ceil(dist / 15));
      }
      
      mission.remainingDays = returnDays + weatherPenalty;
      task.tradeRouteNodeIds = []; // 標記為返程
      return false; 
    } else {
      const nextNodeId = task.tradeRouteNodeIds![task.currentRouteIndex!];
      const nextNode = mapSystem.getNodeById(nextNodeId);
      if (nextNode) {
         const dist = Math.sqrt(Math.pow(currentNode.x - nextNode.x, 2) + Math.pow(currentNode.y - nextNode.y, 2));
         mission.remainingDays = Math.max(1, Math.ceil(dist / 15)) + weatherPenalty;
         console.log(`🐎 [商隊出發] 商隊前往下一站 ${nextNode.name}，預計需要 ${mission.remainingDays} 天。`);
      } else {
         mission.remainingDays = 1;
      }
      return false;
    }
  }

  /**
   * 結算任務邏輯
   */
  private completeMission(mission: ActiveMission): void {
    const { adventurers, task } = mission;
    const advNames = adventurers.map(a => a.name).join(', ');

    // 處理新版多節點貿易任務完成
    if (task.type === TaskType.TRADE && task.caravanGold !== undefined) {
      this.territory.addGold(task.caravanGold);
      let logCargo = '';
      if (task.caravanCargo) {
        for (const [goodId, amount] of Object.entries(task.caravanCargo)) {
          if (amount > 0) {
             this.territory.tradeInventory[goodId] = (this.territory.tradeInventory[goodId] || 0) + amount;
             const goodRef = TRADE_GOODS.find(g => g.id === goodId);
             const goodName = goodRef ? `${goodRef.icon || '📦'}${goodRef.name}` : goodId;
             logCargo += `${goodName}x${amount} `;
          }
        }
      }
      console.log(`✅ [商隊歸來] 决陽者小隊 (${advNames}) 完成了跑商任務！帶回了 ${task.caravanGold} 金幣。貨物遷回：${logCargo || '無（本金已全投入買貨）'}`);
      
      for (const adv of adventurers) {
        adv.currentState = AdventurerState.IDLE;
        adv.dispatchEndTime = null;
        adv.restingDaysLeft = 0;
      }
      return;
    }

    // 處理舊版單點貿易任務 (保留相容)
    if (task.type === TaskType.TRADE) {
      if (task.tradeBuyList && task.tradeBuyList.length > 0) {
        for (const buyItem of task.tradeBuyList) {
          const goodId = buyItem.goodId;
          const amount = buyItem.amount;
          if (this.territory.tradeInventory[goodId]) {
            this.territory.tradeInventory[goodId] += amount;
          } else {
            this.territory.tradeInventory[goodId] = amount;
          }
        }
        console.log(`✅ [商隊歸來] 决陽者小隊 (${advNames}) 成功完成「${task.name}」！買入了物資並存入領地倉庫。`);
      }
      
      for (const adv of adventurers) {
        adv.currentState = AdventurerState.IDLE;
        adv.dispatchEndTime = null;
        adv.restingDaysLeft = 0;
      }
      return;
    }

    // DEP-01: 探索任務獨立結算邏輯
    if (task.type === TaskType.EXPLORE) {
      const mapSystem = GameState.mapSystem;
      // 探索成功：自動完成目標節點的偵查（不消耗金幣）
      if (mapSystem && task.targetNodeId) {
        const node = mapSystem.getNodeById(task.targetNodeId);
        if (node && !node.isScouted) {
          node.isScouted = true;
          node.scoutExpiryDate = GameState.totalDays + 30;
          let danger = '未知';
          let treasure = '無';
          if (node.feature === NodeFeature.MONSTER_NEST) { danger = '極度危险'; treasure = '史詩寶藏'; }
          else if (node.feature === NodeFeature.SUBJUGATION) { danger = '中等危险'; treasure = '稀有素材'; }
          node.scoutData = { dangerLevel: danger, treasureTier: treasure };
          console.log(`📍 [探索成功] 小隊的探查勘很應詳細側查了「${node.name}」！情報有效期 30 天。`);
        }
      }
      // 探索回報：隨機少量資源 + 少量聲望
      const woodGain = Math.floor(Math.random() * 5) + 2;
      const stoneGain = Math.floor(Math.random() * 3) + 1;
      const xpReward = task.expectedPrestige;
      this.territory.wood += woodGain;
      this.territory.stone += stoneGain;
      this.territory.prestige += task.expectedPrestige;
      console.log(`✅ [探索完成] 决陽者小隊 (${advNames}) 探索歸來！獲得木材+${woodGain}、石材+${stoneGain}、聲望+${task.expectedPrestige}。`);
      for (const adv of adventurers) {
        adv.gainXP(xpReward);
        adv.currentState = AdventurerState.IDLE;
        adv.dispatchEndTime = null;
        adv.restingDaysLeft = 0;
      }
      EventBus.getInstance().publish({
        type: GameEventType.COMBAT_FINISHED,
        payload: { isVictory: true, participants: adventurers.map(a => a.id), lootValue: xpReward, battleLog: '探索完成' }
      });
      return;
    }

    const waveCount = task.subjugationMode === 'PROGRESS' ? (task.totalWaves || 3) : 1;
    
    const finalReport = CombatSystem.simulateCombat(
      adventurers.map(a => a.id),
      task.baseDifficulty,
      task.enemyFeature,
      undefined, // terrain 暫時缺省
      waveCount
    );
    
    const isSuccess = finalReport.isVictory;
    let battleLog = finalReport.battleLog;

    if (isSuccess) {
      this.territory.addGold(task.expectedGold);
      let gainedPrestige = task.expectedPrestige;
      
      let expBonusStr = '';
      if (GameState.restedExpPool > 0) {
         const bonus = Math.min(GameState.restedExpPool, gainedPrestige);
         GameState.restedExpPool -= bonus;
         gainedPrestige += bonus;
         expBonusStr = ` (其中包含 💤${bonus} 點休息加成)`;
      }

      this.territory.prestige += gainedPrestige;
      
      let dropMsg = '';
      if (Math.random() * 100 <= task.baseDifficulty) {
        const maxLevel = Math.max(5, Math.floor(task.baseDifficulty / 2));
        const droppedEq = EquipmentGenerator.dropRandomEquipment(maxLevel);
        if (droppedEq) {
          this.territory.addEquipmentToWarehouse(droppedEq);
          dropMsg = `並在戰利品中發現了【${droppedEq.name}】！`;
        }
      }

      console.log(`✅ [任務完成] 冒險者小隊 (${advNames}) 成功討伐「${task.name}」！${battleLog} 帶回 ${task.expectedGold} 金幣與 ${gainedPrestige} 聲望${expBonusStr}。${dropMsg}`);

      finalReport.lootValue = gainedPrestige; // 將最終獎勵補入 report 供 UI 顯示
      
      const record: CombatHistoryRecord = {
        id: `combat_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        day: GameState.totalDays,
        nodeName: task.name + (task.subjugationMode === 'PROGRESS' ? ' (進度討伐)' : ''),
        report: finalReport
      };
      this.territory.addCombatRecord(record);
      this.territory.cleanupCombatHistory(GameState.totalDays, 3);

      EventBus.getInstance().publish({
        type: GameEventType.COMBAT_FINISHED,
        payload: { isVictory: true, participants: adventurers.map(a => a.id), lootValue: gainedPrestige, battleLog, report: finalReport }
      });

      // 勝利後立即設為閒置
      for (const adv of adventurers) {
        adv.currentState = AdventurerState.IDLE;
        adv.dispatchEndTime = null;
        adv.restingDaysLeft = 0;
      }
    } else {
      console.log(`❌ [任務失敗] 冒險者小隊 (${advNames}) 討伐「${task.name}」失敗。${battleLog}`);

      // OPT-02: 失敗後進入 RESTING，難度越高休息越久
      const restDays = Math.max(1, Math.ceil(task.baseDifficulty / 20));
      for (const adv of adventurers) {
        adv.currentState = AdventurerState.RESTING;
        adv.restingDaysLeft = restDays;
        adv.dispatchEndTime = null;
      }
      finalReport.lootValue = 0;

      const record: CombatHistoryRecord = {
        id: `combat_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        day: GameState.totalDays,
        nodeName: task.name + (task.subjugationMode === 'PROGRESS' ? ' (進度討伐)' : ''),
        report: finalReport
      };
      this.territory.addCombatRecord(record);
      this.territory.cleanupCombatHistory(GameState.totalDays, 3);

      EventBus.getInstance().publish({
        type: GameEventType.COMBAT_FINISHED,
        payload: { isVictory: false, participants: adventurers.map(a => a.id), lootValue: 0, battleLog, report: finalReport }
      });
      console.log(`🩹 [休養中] 小隊需要休養 ${restDays} 天才能再次出動。`);
    }
  }

  public getActiveMissionsCount(): number {
    return this.activeMissions.length;
  }

  public getActiveMissions(): ActiveMission[] {
    return this.activeMissions;
  }

  public loadActiveMissions(rawMissions: any[]): void {
    this.activeMissions = rawMissions.map((raw: any) => {
      // 1. 根據 ID 還原冒險者實體（對應到已加載的 GameState.adventurers）
      const advs: Adventurer[] = [];
      (raw.adventurers || []).forEach((advRaw: any) => {
        const found = GameState.adventurers.find(a => a.id === advRaw.id);
        if (found) advs.push(found);
      });

      // 2. 還原 DispatchTask
      const tData = raw.task;
      const task = new DispatchTask(
        tData.name,
        tData.type,
        tData.requiredDays,
        tData.baseDifficulty,
        tData.expectedGold,
        tData.expectedPrestige,
        tData.minPowerRequired,
        tData.enemyFeature
      );
      Object.assign(task, tData);

      // 3. 還原 ActiveMission 物件
      return {
        adventurers: advs,
        task: task,
        remainingDays: raw.remainingDays
      };
    });
  }
}
