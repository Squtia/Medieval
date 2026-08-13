import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { WorkerJob, getTaxBonusPer10Pop, NodeLevel, getOfficeConfig } from '../models/types';
import { Random } from '../core/Random';
import { calculateNodeLevel, getDifficultyModifiers } from '../data/BalanceData';

export class TownManagementSystem {
  constructor() {
    const eventBus = EventBus.getInstance();
    
    // 監聽天數流逝，進行資源結算
    eventBus.subscribe(GameEventType.DAY_PASSED, (payload) => {
      this.resolveDailyResources();
    });

    // 監聽勞工分配與人口變動，即時更新治安度
    eventBus.subscribe(GameEventType.WORKER_ASSIGNED, () => {
      this.updateSecurity();
    });
    eventBus.subscribe(GameEventType.POPULATION_CHANGED, () => {
      this.updateSecurity();
    });

    // 監聽災難威脅抵達
    eventBus.subscribe(GameEventType.THREAT_ARRIVED, (payload) => {
      const territory = GameState.myTerritory;
      const threatName = payload.threatName || '';
      // 判定是否為天災（如暴風雪、旱災、蝗災、瘟疫）
      const isNaturalDisaster = payload.threatType === 'NATURAL_DISASTER';

      let effectiveSeverity = payload.severity;

      if (isNaturalDisaster) {
        // 天災：哨所無法抵擋，僅靠防災準備折半
        effectiveSeverity = GameState.threat.prepared ? Math.ceil(payload.severity / 2) : payload.severity;
        const foodLost = Math.min(territory.food, effectiveSeverity * 4);
        territory.food -= foodLost;
        territory.prestige = Math.max(0, territory.prestige - effectiveSeverity);
        console.log(`[SettlementSystem] ❄️ 天災「${threatName}」襲來！(嚴重度: ${payload.severity})。造成糧食 -${foodLost}、聲望 -${effectiveSeverity}${GameState.threat.prepared ? '（防災準備已降低損失）' : ''}。`);
      } else {
        // 敵意入侵/掠奪事件：連動哨所/衛兵防衛成功率
        const security = (territory.security === null || territory.security === undefined) ? 100 : territory.security;
        const totalTroops = (territory.workers[WorkerJob.INFANTRY] || 0) + (territory.workers[WorkerJob.CAVALRY] || 0) + (territory.workers[WorkerJob.ARCHER] || 0);

        if (security >= 80 || totalTroops > 0) {
          // 哨所/衛兵防衛成功
          const defenseDiscount = Math.min(1.0, (security / 100) * 0.8 + (totalTroops > 0 ? 0.2 : 0));
          effectiveSeverity = Math.floor(payload.severity * (1 - defenseDiscount));
          const foodLost = Math.min(territory.food, effectiveSeverity * 2);
          territory.food -= foodLost;
          territory.prestige = Math.max(0, territory.prestige - effectiveSeverity);

          if (effectiveSeverity === 0) {
            console.log(`[SettlementSystem] 🛡️ 哨所與衛兵防衛嚴密！成功擊退了入侵的「${threatName}」，據點未受任何損失！`);
          } else {
            console.log(`[SettlementSystem] ⚔️ 哨所守衛及時反擊「${threatName}」！大幅降低入侵損失（糧食 -${foodLost}、聲望 -${effectiveSeverity}）。`);
          }
        } else {
          // 無哨所守軍且治安崩潰：掠奪完全成功
          const foodLost = Math.min(territory.food, effectiveSeverity * 4);
          territory.food -= foodLost;
          territory.prestige = Math.max(0, territory.prestige - effectiveSeverity);
          console.log(`[SettlementSystem] ⚠️ 哨所空虛且治安低落！據點遭受「${threatName}」掠奪，損失慘重（糧食 -${foodLost}、聲望 -${effectiveSeverity}）。`);
        }
      }
    });
  }

  public updateSecurity() {
    const territory = GameState.myTerritory;
    const workers = territory.workers;
    let newSecurity = 100;
    const currentNode = GameState.mapSystem.getNodes().find(n => n.id === territory.currentCountryId);
    
    // 基礎守衛需求 (按 NodeLevel)
    let baseGuards = 0;
    if (currentNode) {
      switch (currentNode.nodeLevel) {
        case NodeLevel.CAMP: baseGuards = 2; break;
        case NodeLevel.VILLAGE: baseGuards = 5; break;
        case NodeLevel.TOWN: baseGuards = 15; break;
        case NodeLevel.CAPITAL: baseGuards = 40; break;
        default: baseGuards = 0; break; // WILDERNESS
      }
    }

    const totalTroops = (workers[WorkerJob.INFANTRY] || 0) + (workers[WorkerJob.CAVALRY] || 0) + (workers[WorkerJob.ARCHER] || 0);
    
    // 總需求 = 基礎需求 + 10%人口
    const requiredTroops = baseGuards + Math.floor(territory.population * 0.1);

    if (requiredTroops > 0) {
      const coverage = totalTroops / requiredTroops;
      newSecurity = Math.floor(Math.min(1, coverage) * 100);
    }
    
    territory.security = newSecurity;
  }

  public static getProductionMultiplier(): number {
    const territory = GameState.myTerritory;
    let officeCivicBonus = 0;
    GameState.adventurers.forEach(adv => {
      if (adv.office) {
        const cfg = getOfficeConfig(adv.office);
        if (cfg && cfg.civicBonusPct) {
          officeCivicBonus += cfg.civicBonusPct;
        }
      }
    });

    let productionMultiplier = 1.0 + officeCivicBonus;
    // 統一刪除難度對產量的影響
    if (territory.security >= 80) productionMultiplier *= 1.2;
    else if (territory.security < 30) productionMultiplier *= 0.7;
    
    return productionMultiplier;
  }

  private resolveDailyResources() {
    const territory = GameState.myTerritory;
    const workers = territory.workers;
    
    // -- Phase 5: 治安度 (Security System) --
    this.updateSecurity();
    const totalTroops = (workers[WorkerJob.INFANTRY] || 0) + (workers[WorkerJob.CAVALRY] || 0) + (workers[WorkerJob.ARCHER] || 0);

    const productionMultiplier = TownManagementSystem.getProductionMultiplier();

    // 軍事威望 (選項 B)：每 10 名士兵每日產生 1 點聲望
    if (totalTroops >= 10 && GameState.totalDays % 30 === 0) {
      territory.prestige += Math.min(30, Math.floor(totalTroops / 10));
    }
    
    // 1. 產出計算 (套用治安倍率)
    const farmerCount = workers[WorkerJob.FARMER] || 0;
    const foodProduced = Math.floor((farmerCount * 3) * productionMultiplier);
    
    // 農夫有 30% 機率產出棉麻
    let cottonProduced = 0;
    for (let i = 0; i < farmerCount; i++) {
      if (Random.next() < 0.3) cottonProduced++;
    }
    cottonProduced = Math.floor(cottonProduced * productionMultiplier);

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
    
    // 獵人產出生皮與獸肉
    const hunterCount = workers[WorkerJob.HUNTER] || 0;
    const hideProduced = Math.floor((hunterCount * 1) * productionMultiplier);
    const meatProduced = Math.floor((hunterCount * 1) * productionMultiplier);

    // 2. 消耗計算 (總人口每人耗 1 糧，英雄每人耗 1 糧)
    const totalPeople = territory.population + GameState.adventurers.length;
    let foodConsumed = totalPeople * 1;

    // 軍隊消耗額外糧食 (兵力護盾)
    foodConsumed += (workers[WorkerJob.INFANTRY] || 0) * 1;
    foodConsumed += (workers[WorkerJob.ARCHER] || 0) * 1;
    foodConsumed += (workers[WorkerJob.CAVALRY] || 0) * 2; // 騎兵連馬一起吃

    // 3. 結算基礎資源
    territory.wood += woodProduced;
    territory.stone += stoneProduced;
    territory.iron += ironProduced;
    territory.food += foodProduced - foodConsumed;
    
    // 結算額外貿易品
    if (cottonProduced > 0) territory.tradeInventory['tg_cotton'] = (territory.tradeInventory['tg_cotton'] || 0) + cottonProduced;
    if (hideProduced > 0) territory.tradeInventory['tg_hide'] = (territory.tradeInventory['tg_hide'] || 0) + hideProduced;
    if (meatProduced > 0) territory.tradeInventory['tg_meat'] = (territory.tradeInventory['tg_meat'] || 0) + meatProduced;

    // 每日統一日結稅收 (依據爵位與人口，並套用稅率與治安倍率)
    const baseTaxPer10 = 2 + getTaxBonusPer10Pop(territory.title);
    if (territory.population >= 10) {
      const baseTax = Math.floor(territory.population / 10) * baseTaxPer10 * territory.taxRate;
      const taxIncome = Math.floor(baseTax * productionMultiplier);
      territory.addGold(taxIncome);
    } else {
      // 人口不滿 10 的保底稅收
      const taxIncome = Math.floor(1 * territory.taxRate * productionMultiplier);
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
        // 使用安全的統一裁減邏輯 (飢荒優先扣除閒置人力)
        const actualRemoved = territory.removeWorkers(actualStarved, true);
        territory.prestige = Math.max(0, territory.prestige - actualRemoved * 2);

        EventBus.getInstance().publish({
          type: GameEventType.POPULATION_STARVED,
          payload: { starvedAmount: actualStarved, currentPopulation: territory.population }
        });
        console.log(`[SettlementSystem] 💀 飢荒！糧食不足，${actualStarved} 名流民離開或餓死了。當前總人口：${territory.population}`);
      }
    }
    
    // 4. 自然人口動態 (Realistic Demographics)
    const currentPop = territory.population;
    if (currentPop > 0) {
      // 4.1 生育 (Births) - 每日 0.15%
      const expectedBirths = currentPop * 0.0015;
      let births = Math.floor(expectedBirths);
      if (Random.next() < (expectedBirths - births)) births++;
      
      if (births > 0) {
        territory.workers[WorkerJob.UNASSIGNED] = (territory.workers[WorkerJob.UNASSIGNED] || 0) + births;
        EventBus.getInstance().publish({
          type: GameEventType.POPULATION_CHANGED,
          payload: { delta: births, currentPopulation: territory.population, reason: 'BIRTH' }
        });
        console.log(`[SettlementSystem] 🍼 領地迎來了 ${births} 名新生兒。`);
      }

      // 4.2 老死與疾病 (Deaths & Disease)
      const baseDeathRate = 0.0010;
      const crowdPenalty = Math.floor(currentPop / 1000) * 0.0002;
      const deathRate = baseDeathRate + crowdPenalty;
      const expectedDeaths = currentPop * deathRate;
      let deaths = Math.floor(expectedDeaths);
      if (Random.next() < (expectedDeaths - deaths)) deaths++;
      
      deaths = Math.min(deaths, territory.population);
      if (deaths > 0) {
        const actualDeaths = territory.removeWorkers(deaths, true);
        if (actualDeaths > 0) {
          EventBus.getInstance().publish({
            type: GameEventType.POPULATION_CHANGED,
            payload: { delta: -actualDeaths, currentPopulation: territory.population, reason: 'DEATH' }
          });
          console.log(`[SettlementSystem] 💀 ${actualDeaths} 名領民因年邁或染病而過世了。`);
        }
      }
      
      // 4.3 外移 (Emigration)
      const security = (territory.security === undefined || territory.security === null) ? 100 : territory.security;
      if (security < 40) {
        const emigrateRate = (40 - security) * 0.0005;
        const expectedEmigrants = territory.population * emigrateRate;
        let emigrants = Math.floor(expectedEmigrants);
        if (Random.next() < (expectedEmigrants - emigrants)) emigrants++;
        
        emigrants = Math.min(emigrants, territory.population);
        if (emigrants > 0) {
          const actualEmigrants = territory.removeWorkers(emigrants, true);
          if (actualEmigrants > 0) {
            EventBus.getInstance().publish({
              type: GameEventType.POPULATION_CHANGED,
              payload: { delta: -actualEmigrants, currentPopulation: territory.population, reason: 'EMIGRATION' }
            });
            console.log(`[SettlementSystem] 🚶 由於治安惡化，${actualEmigrants} 名領民對領主失去信心，打包離開了領地。`);
          }
        }
      }
      
      // 4.4 外部移民 (Immigration)
      if (territory.food > totalPeople && security >= 50) {
        const prestigeBonus = Math.floor(territory.prestige / 100) * 0.01;
        const attractChance = Math.min(0.5, 0.2 + prestigeBonus);
        
        if (Random.next() < attractChance) {
          const bonusPop = Math.floor(territory.prestige / 1000);
          const newComers = Random.int(1, 3 + bonusPop);
          
          territory.workers[WorkerJob.UNASSIGNED] = (territory.workers[WorkerJob.UNASSIGNED] || 0) + newComers;
          EventBus.getInstance().publish({
            type: GameEventType.POPULATION_CHANGED,
            payload: { delta: newComers, currentPopulation: territory.population, reason: 'IMMIGRATION' }
          });
          console.log(`[SettlementSystem] 🏕️ 領地繁榮且治安良好！流民被您的聲望吸引而來，人口增加 ${newComers} 人。`);
        }
      }
    }
    
    // 5. 附庸地每月繁榮度成長
    if (GameState.mapSystem) {
      const vassalNodes = GameState.mapSystem.getNodes().filter(n => n.ownerFactionId === 'player' && !n.isPlayerBase);
      vassalNodes.forEach(node => {
        if (node.governorId) {
          const gov = GameState.adventurers.find(a => a.id === node.governorId);
          if (gov) {
            // 代官的魅力與智力會帶動當地的繁榮度成長
            const attrs = gov.getEffectiveAttributes();
            const growth = Math.max(1, Math.floor((attrs.int + attrs.charm) / 10));
            node.prosperity += growth;
            console.log(`[SettlementSystem] 🏰 附庸地成長：在代官 ${gov.name} 的治理下，「${node.name}」的繁榮度增加了 ${growth} 點！`);
            
            const vassalNodesCount = GameState.mapSystem.getNodes().filter(n => n.ownerFactionId === 'player' && !n.isPlayerBase).length;
            const computedLevel = calculateNodeLevel(node, vassalNodesCount > 0);

            if (node.nodeLevel !== computedLevel) {
               const isUpgrade = computedLevel > node.nodeLevel;
               node.nodeLevel = computedLevel;
               if (isUpgrade) {
                 console.log(`[SettlementSystem] 🎉 升級！「${node.name}」的規模擴張了！`);
               } else {
                 console.log(`[SettlementSystem] ⚠️ 衰退！「${node.name}」的規模縮小了！`);
               }
            }
          }
        }
      });
    }

    // 發布資源變更事件，讓 UI 更新
    EventBus.getInstance().publish({
      type: GameEventType.RESOURCE_CHANGED,
      payload: { resourceType: 'ALL', amount: 0, currentTotal: 0 }
    });
  }
}
