import { Adventurer } from '../models/Adventurer';
import { DispatchTask, EnemyFeature, TaskType } from '../models/DispatchTask';
import { Territory } from '../models/Territory';
import { AdventurerState, NobleTitle } from '../models/types';
import { EquipmentGenerator } from './EquipmentGenerator';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';

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
        this.completeMission(mission);
        this.activeMissions.splice(i, 1);
      }
    }
  }

  /**
   * 月底大結算 (內政與外交結算)
   */
  public resolveMonth(): void {
    EventBus.getInstance().publish({
      type: GameEventType.DAY_PASSED,
      payload: { daysPassed: 30, currentTimestamp: Date.now() }
    });

    const baseTax = 100 * this.territory.taxRate;
    const prestigeLoss = Math.max(0, (this.territory.taxRate - 1) * 2); 
    const populationUpkeep = 50; 
    
    const netIncome = baseTax - this.territory.adventurerBudget - this.territory.diplomaticGift - populationUpkeep;
    this.territory.addGold(netIncome);
    this.territory.prestige -= prestigeLoss;

    if (netIncome < 0 && this.territory.gold < 0) {
      console.log(`⚠️ [赤字警告] 領地陷入財務危機！無法支付維護費！`);
    }

    if (this.territory.diplomaticGift > 0) {
      this.territory.royalFavor += this.territory.diplomaticGift * 0.5;
      this.territory.prestige += this.territory.diplomaticGift * 0.2;
    }

    console.log(`📜 [月底結算] 獲得淨稅收 ${netIncome} 金幣。當前好感度：${this.territory.royalFavor} | 當前聲望：${this.territory.prestige}`);
  }

  /**
   * 結算任務邏輯
   */
  private completeMission(mission: ActiveMission): void {
    const { adventurers, task } = mission;
    const advNames = adventurers.map(a => a.name).join(', ');

    // 處理貿易任務
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
        console.log(`✅ [商隊歸來] 冒險者小隊 (${advNames}) 成功完成「${task.name}」！買入了物資並存入領地倉庫。`);
      }
      
      for (const adv of adventurers) {
        adv.currentState = AdventurerState.IDLE;
        adv.dispatchEndTime = null;
      }
      return;
    }

    let totalAtk = 0;
    let totalHit = 0;
    let totalStr = 0;
    let totalHp = 0;
    let totalPower = 0;
    
    adventurers.forEach(adv => {
      const stats = adv.getCombatStats();
      const attr = adv.getEffectiveAttributes();
      totalAtk += stats.atk;
      totalHit += stats.hit;
      totalStr += attr.str;
      totalHp += stats.hp;
      totalPower += adv.power;
    });

    let isSuccess = false;
    let battleLog = '';

    if (task.enemyFeature === EnemyFeature.HIGH_DEF) {
      if (totalAtk > task.minPowerRequired * 1.5) {
         isSuccess = true;
         battleLog = '依靠著強大的攻擊力，隊伍硬生生擊碎了敵人的重甲！';
      } else if (totalHit > task.minPowerRequired * 0.8) {
         isSuccess = true;
         battleLog = '透過精準的命中，隊伍找到了敵人裝甲的弱點！';
      } else {
         battleLog = '敵人的重甲太過堅硬，隊伍的攻擊無法造成有效傷害...';
      }
    } else if (task.enemyFeature === EnemyFeature.HIGH_EVADE) {
      if (totalHit > task.minPowerRequired * 1.2) {
         isSuccess = true;
         battleLog = '依靠著極高的命中率，隊伍精準擊殺了敏捷的敵人！';
      } else if (totalHp > task.minPowerRequired * 5) {
         isSuccess = true;
         battleLog = '隊伍以強大的血量與耐久力耗死了敵人！';
      } else {
         battleLog = '敵人身手太過敏捷，隊伍的攻擊多數落空...';
      }
    } else {
      if (totalAtk + (totalHp / 10) > task.minPowerRequired * 0.8) {
         isSuccess = true;
         battleLog = '隊伍憑藉著穩定的戰力壓制了敵人。';
      } else {
         battleLog = '隊伍的綜合戰力不足，被敵人擊退了。';
      }
    }

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
      
      EventBus.getInstance().publish({
        type: GameEventType.COMBAT_FINISHED,
        payload: { isVictory: true, participants: adventurers.map(a => a.id), lootValue: task.expectedGold, battleLog }
      });
    } else {
      console.log(`❌ [任務失敗] 冒險者小隊 (${advNames}) 討伐「${task.name}」失敗。${battleLog}`);
    }

    for (const adv of adventurers) {
      adv.currentState = AdventurerState.IDLE;
      adv.dispatchEndTime = null;
    }
  }

  public getActiveMissionsCount(): number {
    return this.activeMissions.length;
  }
}
