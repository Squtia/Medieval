import { Adventurer } from '../models/Adventurer';
import { DispatchTask, EnemyFeature } from '../models/DispatchTask';
import { Territory } from '../models/Territory';
import { AdventurerState, NobleTitle } from '../models/types';
import { EquipmentGenerator } from './EquipmentGenerator';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';

/**
 * 代表正在執行中的任務
 */
export interface ActiveMission {
  adventurers: Adventurer[];
  task: DispatchTask;
  dispatchEndTime: number; // 結束的時間戳記 (Epoch毫秒)
}

/**
 * 派遣系統與遊戲核心循環
 */
export class DispatchSystem {
  private territory: Territory;
  private activeMissions: ActiveMission[] = [];
  
  // 紀錄上次內政結算的時間戳記
  private lastTurnResolveTime: number;
  // 每回合的間隔時間 (預設 60 秒)
  private readonly TURN_DURATION_MS = 60000;

  constructor(territory: Territory) {
    this.territory = territory;
    this.lastTurnResolveTime = Date.now(); // 初始化為系統啟動時間
  }

  /**
   * 派遣冒險者小隊執行任務
   * @param adventurers 參與的冒險者小隊
   * @param task 目標任務
   */
  public dispatchAdventurers(adventurers: Adventurer[], task: DispatchTask): void {
    if (adventurers.length === 0) {
      console.warn('⚠️ 派遣失敗：沒有選擇任何冒險者。');
      return;
    }

    // 1. 檢查所有冒險者是否皆為閒置狀態
    for (const adv of adventurers) {
      if (adv.currentState !== AdventurerState.IDLE) {
        console.warn(`⚠️ 派遣失敗：冒險者 ${adv.name} 目前無法指派 (狀態: ${adv.currentState})。`);
        return;
      }
    }

    // 2. 設定結束時間 (當前時間 + 需要的秒數 * 1000轉換為毫秒)
    const now = Date.now();
    const dispatchEndTime = now + (task.requiredTimeSeconds * 1000);

    // 3. 更新冒險者狀態
    for (const adv of adventurers) {
      adv.currentState = AdventurerState.DISPATCHED;
      adv.dispatchEndTime = dispatchEndTime;
    }

    // 4. 將任務加入活躍清單
    this.activeMissions.push({
      adventurers,
      task,
      dispatchEndTime
    });

    console.log(`🚀 [任務派發] 小隊已出發前往執行「${task.name}」！預計 ${task.requiredTimeSeconds} 秒後完成。`);
  }

  /**
   * 遊戲主循環更新
   * 通常由外部 Game Loop 以特定頻率呼叫 (例如每秒一次)
   * @param currentTimestampMs 當前的時間戳記 (Epoch毫秒)
   */
  public update(currentTimestampMs: number = Date.now()): void {
    // === 1. 處理內政回合結算 ===
    const passedTurns = Math.floor((currentTimestampMs - this.lastTurnResolveTime) / this.TURN_DURATION_MS);
    
    if (passedTurns > 0) {
      for (let i = 0; i < passedTurns; i++) {
        this.resolveTurn();
      }
      // 更新上次結算時間
      this.lastTurnResolveTime += passedTurns * this.TURN_DURATION_MS;
    }

    // === 2. 處理派遣任務結算 ===
    // 逆向遍歷陣列，以便在遍歷過程中可以安全地移除元素
    for (let i = this.activeMissions.length - 1; i >= 0; i--) {
      const mission = this.activeMissions[i];

      // 檢查是否時間已經到了
      if (currentTimestampMs >= mission.dispatchEndTime) {
        this.completeMission(mission);
        
        // 從活躍清單中移除已完成的任務
        this.activeMissions.splice(i, 1);
      }
    }
  }

  /**
   * 內政與外交結算 (每 60 秒一回合)
   */
  private resolveTurn(): void {
    // 1. 發布天數流逝事件 (在此我們把一回合當作一天)
    EventBus.getInstance().publish({
      type: GameEventType.DAY_PASSED,
      payload: { daysPassed: 1, currentTimestamp: Date.now() }
    });

    // 2. 內政結算
    const baseTax = 100 * this.territory.taxRate;
    const prestigeLoss = Math.max(0, (this.territory.taxRate - 1) * 2); // 稅率超過 1 時會掉聲望
    
    // 計算淨收入 (稅收 - 預算 - 獻禮)
    const netIncome = baseTax - this.territory.adventurerBudget - this.territory.diplomaticGift;
    this.territory.addGold(netIncome);
    this.territory.prestige -= prestigeLoss;

    // 2. 外交結算
    if (this.territory.diplomaticGift > 0) {
      // 根據獻禮金額增加好感度與聲望
      this.territory.royalFavor += this.territory.diplomaticGift * 0.5;
      this.territory.prestige += this.territory.diplomaticGift * 0.2;
    }

    console.log(`📜 [內政結算] 獲得淨稅收 ${netIncome} 金幣。當前好感度：${this.territory.royalFavor} | 當前聲望：${this.territory.prestige}`);

    // 3. 爵位晉升檢查
    this.checkPromotion();
  }

  /**
   * 檢查爵位晉升
   */
  private checkPromotion(): void {
    const { prestige, gold, title } = this.territory;

    // 檢查公爵
    if (title !== NobleTitle.DUKE && prestige >= 5000 && gold >= 10000) {
      this.territory.title = NobleTitle.DUKE;
      console.log(`🎉 [爵位晉升] 恭喜！領地「${this.territory.name}」已晉升為【公爵】！`);
      return;
    }

    // 檢查伯爵
    if (title !== NobleTitle.DUKE && title !== NobleTitle.COUNT && prestige >= 1000 && gold >= 3000) {
      this.territory.title = NobleTitle.COUNT;
      console.log(`🎉 [爵位晉升] 恭喜！領地「${this.territory.name}」已晉升為【伯爵】！`);
      return;
    }

    // 檢查男爵
    if (title === NobleTitle.COMMONER || title === NobleTitle.KNIGHT) {
      if (prestige >= 300 && gold >= 1000) {
        this.territory.title = NobleTitle.BARON;
        console.log(`🎉 [爵位晉升] 恭喜！您獲得了領地與封號，晉升為【男爵】！`);
        return;
      }
    }

    // 檢查騎士
    if (title === NobleTitle.COMMONER && prestige >= 50 && gold >= 200) {
      this.territory.title = NobleTitle.KNIGHT;
      console.log(`🎉 [爵位晉升] 恭喜！您的武勇受到認可，晉升為【騎士】！`);
      return;
    }
  }

  /**
   * 結算任務邏輯
   */
  private completeMission(mission: ActiveMission): void {
    const { adventurers, task } = mission;

    // 1. 計算小隊的總合屬性
    let totalAtk = 0;
    let totalHit = 0;
    let totalStr = 0;
    let totalHp = 0;
    let totalPower = 0; // 保留供參考
    
    adventurers.forEach(adv => {
      const stats = adv.getCombatStats();
      const attr = adv.getEffectiveAttributes();
      totalAtk += stats.atk;
      totalHit += stats.hit;
      totalStr += attr.str;
      totalHp += stats.hp;
      totalPower += adv.power;
    });

    // 2. 判斷是否成功 (屬性對抗邏輯)
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
    } else { // BALANCED
      if (totalAtk + (totalHp / 10) > task.minPowerRequired * 0.8) {
         isSuccess = true;
         battleLog = '隊伍憑藉著穩定的戰力壓制了敵人。';
      } else {
         battleLog = '隊伍的綜合戰力不足，被敵人擊退了。';
      }
    }

    // 把冒險者名稱串起來方便顯示日誌
    const advNames = adventurers.map(a => a.name).join(', ');

    if (isSuccess) {
      // 成功：給予領地獎勵
      this.territory.addGold(task.expectedGold);
      this.territory.prestige += task.expectedPrestige;
      
      let dropMsg = '';
      // 依據難度決定掉落機率 (例如基礎難度就是掉落機率百分比)
      if (Math.random() * 100 <= task.baseDifficulty) {
        // 假設任務難度 / 2 作為最高裝備等級限制
        const maxLevel = Math.max(5, Math.floor(task.baseDifficulty / 2));
        const droppedEq = EquipmentGenerator.dropRandomEquipment(maxLevel);
        if (droppedEq) {
          this.territory.addEquipmentToWarehouse(droppedEq);
          dropMsg = `並在戰利品中發現了【${droppedEq.name}】！`;
        }
      }

      console.log(`✅ [任務完成] 冒險者小隊 (${advNames}) 成功討伐「${task.name}」！${battleLog} 帶回 ${task.expectedGold} 金幣與 ${task.expectedPrestige} 聲望。${dropMsg}`);
      
      // 發布戰鬥勝利事件
      EventBus.getInstance().publish({
        type: GameEventType.COMBAT_FINISHED,
        payload: { isVictory: true, participants: adventurers.map(a => a.id), lootValue: task.expectedGold, battleLog }
      });
    } else {
      // 失敗：不給予獎勵，這裡可以擴展冒險者受傷的邏輯
      console.log(`❌ [任務失敗] 冒險者小隊 (${advNames}) 討伐「${task.name}」失敗。${battleLog}`);
    }

    // 3. 將冒險者狀態重置為閒置
    for (const adv of adventurers) {
      adv.currentState = AdventurerState.IDLE;
      adv.dispatchEndTime = null;
    }
  }

  /**
   * 取得目前正在執行中的任務數量
   */
  public getActiveMissionsCount(): number {
    return this.activeMissions.length;
  }
}
