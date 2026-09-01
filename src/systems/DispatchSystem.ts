import { Adventurer } from '../models/Adventurer';
import { DispatchTask, EnemyFeature, TaskType, TradePhase, normalizeTradeTask, SubjugationMode } from '../models/DispatchTask';
import { Territory } from '../models/Territory';
import { AdventurerState, NobleTitle, NodeFeature, getOfficeConfig, TradeTreaty, MapNode } from '../models/types';
import { EquipmentGenerator } from './EquipmentGenerator';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { CombatHistoryRecord } from '../models/Combat';
import { TRADE_GOODS } from './MarketSystem';
import { CombatSystem } from './CombatSystem';
import { ExplorationNarrativeEngine } from './ExplorationNarrativeEngine';
import { NarrativeSystem } from './NarrativeSystem';
import { BountySystem } from './BountySystem';
import { Random } from '../core/Random';
import { getDifficultyModifiers } from '../data/BalanceData';

/**
 * 代表正在執行中的任務
 */
export interface ActiveMission {
  adventurers: Adventurer[];
  task: DispatchTask;
  remainingDays: number; // 剩餘天數
  narrativeJourneyIndex?: number;
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

  public getActiveMissions(): ActiveMission[] {
    return this.activeMissions;
  }

  /**
   * 派遣傭兵小隊執行任務
   */
  public dispatchAdventurers(adventurers: Adventurer[], task: DispatchTask): void {
    if (adventurers.length === 0) {
      console.warn('⚠️ 派遣失敗：沒有選擇任何傭兵。');
      return;
    }

    for (const adv of adventurers) {
      if (adv.currentState !== AdventurerState.IDLE) {
        console.warn(`⚠️ 派遣失敗：傭兵 ${adv.name} 目前無法指派 (狀態: ${adv.currentState})。`);
        return;
      }
    }

    // 戰鬥規則防線：每場戰鬥隊伍最多只能編入 1 位 UR 品質傭兵
    const urCount = adventurers.filter(a => a.quality === 'UR').length;
    if (urCount > 1) {
      console.warn('⚠️ 派遣失敗：隊伍中最多只能編入 1 名 UR 品質傭兵！');
      return;
    }

    if (task.type === TaskType.TRADE) normalizeTradeTask(task);
    const remainingDays = task.requiredDays;

    for (const adv of adventurers) {
      adv.currentState = AdventurerState.DISPATCHED;
      adv.dispatchEndTime = null; 
    }
    
    // Phase 5: 若為攻城戰，發兵時即從庫存與人口中扣除帶領的兵力
    if (task.isWar && task.troopAssignments) {
      for (const t of Object.values(task.troopAssignments)) {
        if (t.type !== 'NONE' && t.count > 0) {
          const typeStr = t.type as import('../models/types').WorkerJob;
          if (this.territory.workers[typeStr] !== undefined) {
             this.territory.workers[typeStr]! -= t.count;
             if (this.territory.workers[typeStr]! < 0) this.territory.workers[typeStr] = 0;
          }
          this.territory.population -= t.count;
          if (this.territory.population < 0) this.territory.population = 0;
        }
      }
    }

    this.activeMissions.push({
      adventurers,
      task,
      remainingDays
    });

    console.log(`🚀 [任務派發] 小隊已出發前往執行「${task.name}」！預計 ${task.requiredDays} 天後完成。`);
    this.publishMissionChange('DISPATCHED', task.type);
  }

  /**
   * 推進遊戲天數
   */
  public updateDays(days: number): void {
    let progressed = false;
    let completedType: TaskType | undefined;
    for (let i = this.activeMissions.length - 1; i >= 0; i--) {
      const mission = this.activeMissions[i];
      const journey = mission.task.narrativeSubjugation?.journeyNodeIds ?? [];
      const journeyIndex = mission.narrativeJourneyIndex ?? 0;
      if (journeyIndex < journey.length) {
        const meta = mission.task.narrativeSubjugation!;
        if (NarrativeSystem.handleSubjugationJourney(meta.storyId, journey[journeyIndex])) {
          mission.narrativeJourneyIndex = journeyIndex + 1;
        }
      }
      mission.remainingDays -= days;
      progressed = true;

      if (mission.remainingDays <= 0) {
        if (mission.task.type === TaskType.TRADE) {
          normalizeTradeTask(mission.task);
          const itinerary = mission.task.tradeItineraryNodeIds || [];
          if (itinerary.length > 0 && mission.task.tradePhase !== TradePhase.RETURNING) {
            this.reachWaypoint(mission);
          } else {
            this.completeMission(mission);
            this.activeMissions.splice(i, 1);
            completedType = mission.task.type;
          }
        } else {
          this.completeMission(mission);
          this.activeMissions.splice(i, 1);
          completedType = mission.task.type;
        }
      }
    }
    if (completedType) this.publishMissionChange('COMPLETED', completedType);
    else if (progressed) this.publishMissionChange('PROGRESSED');
  }

  /**
   * 發薪日結算 (每 7 天觸發)
   */
  public resolvePayday(): void {
    const upkeepMultiplier = getDifficultyModifiers(GameState.worldGeneration?.difficulty).upkeep;
    // 7天份的人口維護費
    const populationUpkeep = Math.floor(this.territory.population * 0.5 * upkeepMultiplier);
    
    // 計算所有傭兵的薪水 (7天份)
    let adventurerWages = 0;
    GameState.adventurers.forEach(adv => {
      if (adv.office) {
        adventurerWages += Math.floor(getOfficeConfig(adv.office).salary * 7 / 30 * upkeepMultiplier);
      } else {
        adventurerWages += Math.ceil(7 * upkeepMultiplier);
      }
    });
    
    // 結算附庸地歲貢
    let totalTribute = 0;
    if (GameState.mapSystem) {
      const vassalNodes = GameState.mapSystem.getNodes().filter(n => n.ownerFactionId === 'player' && !n.isPlayerBase);
      vassalNodes.forEach(node => {
        if (node.governorId) {
          const gov = GameState.adventurers.find(a => a.id === node.governorId);
          if (gov) {
             // 基礎歲貢: 繁榮度的 20%
             let tribute = Math.floor(node.prosperity * 0.20);
             // 代官智力加成
             const attrs = gov.getEffectiveAttributes();
             const intBonus = attrs.int * 2;
             tribute += intBonus;
             totalTribute += tribute;
             console.log(`📜 [代官歲貢] ${gov.name} 從附庸地「${node.name}」徵收了 ${tribute} 金幣歲貢！`);
          }
        } else {
          console.log(`⚠️ [無人治理] 附庸地「${node.name}」由於沒有指派代官，無法徵收歲貢，且治安逐漸下降！`);
        }
      });
    }

    const netIncome = -adventurerWages - this.territory.diplomaticGift - populationUpkeep + totalTribute;
    this.territory.addGold(netIncome);

    if (this.territory.gold < 0) {
      console.log(`⚠️ [赤字警告] 領地陷入財務危機！無法支付維護費！當前負債：${Math.abs(this.territory.gold)} 金幣。`);
      
      // 欠薪懲罰：有機率觸發暫時性懲罰 (自動拔官)
      GameState.adventurers.forEach(adv => {
        if (adv.office && Random.next() < 0.3) {
           console.log(`❌ [欠薪懲罰] 由於領地破產發不出俸祿，${adv.name} 憤而辭去了 ${getOfficeConfig(adv.office).nameCN} 的職位！`);
           adv.office = null;
        }
      });
    }

    if (this.territory.diplomaticGift > 0) {
      this.territory.royalFavor += this.territory.diplomaticGift * (7 / 30) * 0.5;
      this.territory.prestige += this.territory.diplomaticGift * (7 / 30) * 0.2;
    }

    console.log(`📜 [發薪日結算] 人口維護：-${Math.floor(populationUpkeep)} | 傭兵薪資：-${adventurerWages} | 支出總計：${Math.floor(netIncome)} 金幣。`);
  }

  private reachWaypoint(mission: ActiveMission): void {
    const { adventurers, task } = mission;
    
    const mapSystem = GameState.mapSystem;
    if (!mapSystem) return;

    normalizeTradeTask(task);
    const itinerary = task.tradeItineraryNodeIds || [];
    const currentLegIndex = task.currentLegIndex ?? 0;
    const currentNodeId = itinerary[currentLegIndex];
    const currentNode = mapSystem.getNodeById(currentNodeId);

    if (!currentNode) {
      task.tradePhase = TradePhase.RETURNING;
      task.currentLegIndex = itinerary.length;
      task.currentRouteIndex = task.currentLegIndex;
      mission.remainingDays = 1;
      return;
    }

    const playerBase = mapSystem.getNodes().find(node => node.isPlayerBase);
    const legOriginNode = currentLegIndex === 0
      ? playerBase
      : mapSystem.getNodeById(itinerary[currentLegIndex - 1]);

    let advNames = adventurers.map(a => a.name).join(', ');
    console.log(`📍 [商隊抵達] 傭兵小隊 (${advNames}) 抵達中途站：${currentNode.name}`);

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
    
    // 商路安全度判定
    if (!currentNode.isScouted) {
      // 兩地沒有全開視野 (即目標據點未偵查)，有 20% 機率遭遇盜匪襲擊
      if (Random.next() < this.getAmbushChance(legOriginNode, currentNode)) {
        console.log(`⚠️ [商路襲擊] 由於通往 ${currentNode.name} 的路途視野未明，商隊遭遇了盜匪襲擊！`);
        let totalPower = 0;
        adventurers.forEach(a => totalPower += a.getEffectiveAttributes().str + a.getEffectiveAttributes().agi);
        
        // 戰鬥力檢定
        if (totalPower < 100) {
          const lostGold = Math.floor((task.caravanGold || 0) * 0.2);
          if (lostGold > 0) {
            task.caravanGold! -= lostGold;
            console.log(`❌ [護衛不力] 傭兵戰力不足，商隊被搶走了 ${lostGold} 金幣！`);
          } else {
            console.log(`❌ [護衛不力] 傭兵戰力不足，但商隊已經沒有金幣可搶了。`);
          }
        } else {
          console.log(`⚔️ [擊退盜匪] 護衛的傭兵英勇奮戰，成功擊退了盜匪，商隊毫髮無傷！`);
        }
      }
    }

    const tradeModifiers = playerBase && GameState.roadSystem
      ? GameState.roadSystem.getTradeModifiers(playerBase, currentNode)
      : { hasRoad: false, buyPriceMultiplier: 1, sellPriceMultiplier: 1 };

    if (task.tradeInstructions && task.caravanCargo && task.caravanGold !== undefined) {
      const instruction = task.tradeInstructions.find(i => i.nodeId === currentNodeId);
      if (instruction) {
          let totalCargoWeight = Object.values(task.caravanCargo).reduce((a,b)=>a+b, 0);
          
          let totalCapacity = 0;
          let totalNegotiation = 0;
          adventurers.forEach(a => {
             const ts = a.getTradeStats();
             totalCapacity += ts.maxCargoWeight;
             totalNegotiation += ts.negotiationBonus;
          });
          totalNegotiation = Math.min(0.20, totalNegotiation);
          
          for (const sellGoodId of instruction.sell) {
              const amountToSell = task.caravanCargo![sellGoodId] || 0;
              if (amountToSell > 0) {
                  const goodRef = TRADE_GOODS.find(g => g.id === sellGoodId);
                  const marketItem = currentNode.marketData?.goods?.find(g => g.goodId === sellGoodId);
                  const baseSellPrice = marketItem ? marketItem.sellPrice : (goodRef?.basePrice || 10);
                  const sellPrice = Math.max(
                    1,
                    Math.round(baseSellPrice * (1 + totalNegotiation) * tradeModifiers.sellPriceMultiplier)
                  );
                  const goldGained = sellPrice * amountToSell;
                  task.caravanGold! += goldGained;
                  task.caravanCargo![sellGoodId] = 0;
                  totalCargoWeight -= amountToSell;
                  
                  const goodName = goodRef ? goodRef.name : sellGoodId;
                  console.log(`💰 [商隊交易] 在 ${currentNode.name} 賣出了 ${amountToSell} 單位 ${goodName}，獲得 ${goldGained} 金幣。`);
              }
          }
          
          if (currentNode.marketData?.goods) {
              for (const buyItem of instruction.buy) {
                  const marketItem = currentNode.marketData.goods.find(g => g.goodId === buyItem.goodId);
                  if (marketItem && marketItem.stock > 0) {
                      const buyPrice = Math.max(
                        1,
                        Math.round(marketItem.buyPrice * (1 - totalNegotiation) * tradeModifiers.buyPriceMultiplier)
                      );
                      const affordableAmount = Math.floor(task.caravanGold / buyPrice);
                      const capacityLeft = totalCapacity - totalCargoWeight;
                      const buyAmount = Math.min(buyItem.maxAmount, marketItem.stock, affordableAmount, capacityLeft);
                      
                      const goodRef = TRADE_GOODS.find(g => g.id === buyItem.goodId);
                      const goodName = goodRef ? goodRef.name : buyItem.goodId;

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
    }

    task.currentLegIndex = currentLegIndex + 1;
    task.currentRouteIndex = task.currentLegIndex;
    if (task.currentLegIndex >= itinerary.length) {
      console.log(`🏁 [商隊返程] 商隊已完成所有停靠站，正在返回領地！`);
      
      const playerNode = mapSystem.getNodes().find(n => n.isPlayerBase);
      let returnDays = 3;
      if (playerNode) {
        returnDays = this.getTravelDays(currentNode, playerNode);
      }
      
      mission.remainingDays = returnDays + weatherPenalty;
      task.tradePhase = TradePhase.RETURNING;
      task.currentLegIndex = itinerary.length;
      task.currentRouteIndex = task.currentLegIndex;
    } else {
      const nextNodeId = itinerary[task.currentLegIndex];
      const nextNode = mapSystem.getNodeById(nextNodeId);
      if (nextNode) {
         mission.remainingDays = this.getTravelDays(currentNode, nextNode) + weatherPenalty;
         console.log(`🐎 [商隊出發] 商隊前往下一站 ${nextNode.name}，預計需要 ${mission.remainingDays} 天。`);
      } else {
         mission.remainingDays = 1;
      }
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
      const mapSystem = GameState.mapSystem;
      if (mapSystem) {
         const itinerary = task.tradeItineraryNodeIds || [];
         if (itinerary.length > 0) {
           const lastNodeId = itinerary[itinerary.length - 1];
           const lastNode = mapSystem.getNodeById(lastNodeId);
           if (lastNode && !lastNode.isScouted) {
             const playerBase = mapSystem.getNodes().find(node => node.isPlayerBase);
             const returnAmbushChance = playerBase
               ? this.getAmbushChance(lastNode, playerBase)
               : 0.2;
             if (Random.next() < returnAmbushChance) {
               console.log(`⚠️ [商路襲擊] 由於通往 ${lastNode.name} 的路途視野未明，商隊在返程時遭遇了盜匪襲擊！`);
               let totalPower = 0;
               adventurers.forEach(a => totalPower += a.getEffectiveAttributes().str + a.getEffectiveAttributes().agi);
               
               if (totalPower < 100) {
                 const lostGold = Math.floor((task.caravanGold || 0) * 0.2);
                 if (lostGold > 0) {
                   task.caravanGold! -= lostGold;
                   console.log(`❌ [護衛不力] 傭兵戰力不足，商隊被搶走了 ${lostGold} 金幣！`);
                 }
               } else {
                 console.log(`⚔️ [擊退盜匪] 護衛的傭兵英勇奮戰，成功擊退了盜匪，商隊毫髮無傷！`);
               }
             }
           }
         }
      }

      this.territory.addGold(task.caravanGold);
      const cashProfit = task.initialCaravanGold === undefined
        ? null
        : task.caravanGold - task.initialCaravanGold;
      let logCargo = '';
      if (task.caravanCargo) {
        for (const [goodId, amount] of Object.entries(task.caravanCargo)) {
          if (amount > 0) {
             if (goodId === 'tg_timber') this.territory.wood = (this.territory.wood || 0) + amount;
             else if (goodId === 'tg_iron') this.territory.iron = (this.territory.iron || 0) + amount;
             else if (goodId === 'tg_stone') this.territory.stone = (this.territory.stone || 0) + amount;
             else if (goodId === 'tg_wheat') this.territory.food = (this.territory.food || 0) + amount;
             else {
               if (!this.territory.tradeInventory) this.territory.tradeInventory = {};
               this.territory.tradeInventory[goodId] = (this.territory.tradeInventory[goodId] || 0) + amount;
             }
             const goodRef = TRADE_GOODS.find(g => g.id === goodId);
             const goodName = goodRef ? goodRef.name : goodId;
             logCargo += `${goodName}x${amount} `;
          }
        }
      }
      const profitText = cashProfit === null
        ? '舊任務未記錄初始本金，無法計算現金損益'
        : `現金損益：${cashProfit >= 0 ? '+' : ''}${cashProfit} 金幣`;
      console.log(`✅ [商隊歸來] 傭兵小隊 (${advNames}) 完成跑商！投入本金：${task.initialCaravanGold ?? '未記錄'}，帶回現金：${task.caravanGold}，${profitText}。帶回貨物：${logCargo || '無'}`);
      
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
          if (goodId === 'tg_timber') this.territory.wood = (this.territory.wood || 0) + amount;
          else if (goodId === 'tg_iron') this.territory.iron = (this.territory.iron || 0) + amount;
          else if (goodId === 'tg_stone') this.territory.stone = (this.territory.stone || 0) + amount;
          else if (goodId === 'tg_wheat') this.territory.food = (this.territory.food || 0) + amount;
          else {
            if (!this.territory.tradeInventory) this.territory.tradeInventory = {};
            this.territory.tradeInventory[goodId] = (this.territory.tradeInventory[goodId] || 0) + amount;
          }
        }
        console.log(`✅ [商隊歸來] 傭兵小隊 (${advNames}) 成功完成「${task.name}」！買入了物資並存入領地倉庫。`);
      }
      
      for (const adv of adventurers) {
        adv.currentState = AdventurerState.IDLE;
        adv.dispatchEndTime = null;
        adv.restingDaysLeft = 0;
      }
      return;
    }

    if (task.type === TaskType.DIPLOMACY) {
      const mapSystem = GameState.mapSystem;
      if (mapSystem && task.targetNodeId) {
        const node = mapSystem.getNodeById(task.targetNodeId);
        if (node && node.ownerFactionId) {
          const faction = mapSystem.getFactions().find(f => f.id === node.ownerFactionId);
          if (faction) {
            // 從 TradeTreaty.NONE 升級為 BASIC
            // (未來可以擴充: 根據使節的交涉能力或攜帶獻金，有機率直接達成 ALLIED 或是失敗)
            if (!faction.tradeTreaty || faction.tradeTreaty === TradeTreaty.NONE) {
              faction.tradeTreaty = TradeTreaty.BASIC;
              console.log(`🤝 [外交成功] 傭兵小隊 (${advNames}) 成功抵達 ${node.name}，並與【${faction.factionName}】簽署了基礎通商條約！現在可以與該勢力進行貿易了。`);
            } else {
              console.log(`🤝 [外交回報] 傭兵小隊 (${advNames}) 抵達 ${node.name}，發現與【${faction.factionName}】的條約已生效，無須重複簽署。`);
            }
          }
        }
      }
      for (const adv of adventurers) {
        adv.gainXP(25); // 外交任務給予固定經驗值
        adv.currentState = AdventurerState.IDLE;
        adv.dispatchEndTime = null;
        adv.restingDaysLeft = 0;
      }
      return;
    }

    // 敘事討伐引擎接管 COMBAT 邏輯
    let isVictory = true;
    if (task.targetNodeId && GameState.mapSystem) {
      const node = GameState.mapSystem.getNodeById(task.targetNodeId);
      if (node) {
        isVictory = ExplorationNarrativeEngine.generateSubjugationLog(adventurers, node, task.baseDifficulty, task.enemyFeature || EnemyFeature.BALANCED, task.formationId, task.gridMap);
      }
      NarrativeSystem.handleSubjugationCompleted(task.targetNodeId, isVictory, task.narrativeSubjugation);
      BountySystem.handleSubjugationCompleted(GameState, task.targetNodeId, isVictory);
    }

    // 解除派遣狀態並處理戰敗休養
    adventurers.forEach(a => {
      a.currentState = isVictory ? AdventurerState.IDLE : AdventurerState.RESTING;
      a.dispatchEndTime = null;
      // 若戰敗，則需休養 4 天
      a.restingDaysLeft = isVictory ? 0 : 4; 
    });
    
    // 發放懸賞金與聲望獎勵
    if (isVictory) {
      if (task.expectedGold && task.expectedGold > 0) {
        this.territory.addGold(task.expectedGold);
      }
      if (task.expectedPrestige && task.expectedPrestige > 0) {
        this.territory.prestige += task.expectedPrestige;
      }
    }

    // 若是攻城戰，則保留攻城的額外邏輯
    if (task.isWar && task.targetNodeId && GameState.mapSystem) {
       const node = GameState.mapSystem.getNodeById(task.targetNodeId);
       if (node) {
          if (isVictory) {
            node.ownerFactionId = 'player';
            node.governorId = undefined; 
            console.log(`✅ [攻城勝利] 成功佔領了 ${node.name}！現在可以指派代官來管理該城鎮。`);
          } else {
            console.log(`❌ [攻城失敗] 佔領 ${node.name} 失敗，部隊已撤退。`);
          }
       }
    }

    // 通知任務列表更新
    EventBus.getInstance().publish({
      type: GameEventType.MISSIONS_CHANGED,
      payload: { reason: 'COMPLETED', missionType: TaskType.COMBAT }
    });
  }

  public getActiveMissionsCount(): number {
    return this.activeMissions.length;
  }

  public loadActiveMissions(rawMissions: any[]): void {
    this.activeMissions = rawMissions.map((raw: any) => {
      // 1. 根據 ID 還原傭兵實體（對應到已加載的 GameState.adventurers）
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
      normalizeTradeTask(task);

      // 3. 還原 ActiveMission 物件
      return {
        adventurers: advs,
        task: task,
        remainingDays: raw.remainingDays,
        narrativeJourneyIndex: raw.narrativeJourneyIndex ?? 0
      };
    });
    this.publishMissionChange('LOADED');
  }

  private getTravelDays(origin: MapNode, target: MapNode): number {
    if (GameState.roadSystem) {
      return GameState.roadSystem.getTravelDays(origin, target).adjustedDays;
    }
    return Math.max(1, Math.ceil(Math.hypot(target.x - origin.x, target.y - origin.y) / 15));
  }

  private getAmbushChance(origin: MapNode | undefined, target: MapNode): number {
    if (!origin || !GameState.roadSystem) return 0.2;
    return GameState.roadSystem.getAmbushChance(origin, target);
  }

  private publishMissionChange(
    reason: 'DISPATCHED' | 'PROGRESSED' | 'COMPLETED' | 'LOADED',
    missionType?: TaskType
  ): void {
    EventBus.getInstance().publish({
      type: GameEventType.MISSIONS_CHANGED,
      payload: { reason, missionType }
    });
  }
}
