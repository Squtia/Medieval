import { GameState } from '../core/GameState';
import { GameLog } from '../ui/GameLog';
import { Adventurer } from '../models/Adventurer';
import { AdventurerState } from '../models/types';
import { NarrativeSystem } from './NarrativeSystem';
import { AcquisitionItem, AcquisitionNotification } from '../ui/AcquisitionNotification';
import { DataStore } from './DataStore';
import { TRADE_GOODS } from './MarketSystem';

export interface BountyQuest {
  id: string;
  name: string;
  desc: string;
  duration: number; // 所需花費的遊戲天數(回合)
  expireDays: number; // 懸賞單掛在牆上多久後過期消失(若未接取)
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  type?: 'NORMAL' | 'BANDIT';
  dispatchedMercId?: string; // 派出的傭兵 ID
  remainingDuration?: number; // 任務執行中的剩餘回合數
  rewards: {
    gold: number;
    exp: number;
    items?: { id: string, amount: number }[];
  };
  narrativeStoryId?: string;
  narrativeNodeId?: string;
  narrativeNodeKey?: string;
  objective?: { type: 'DURATION' | 'SUBJUGATE_NODE'; targetNodeId?: string };
}

export class BountySystem {
  /**
   * 每日回合結算時呼叫
   * 處理生成新懸賞、扣除過期懸賞、推進執行中的懸賞
   */
  public static processDailyTick(gameState: typeof GameState | any) {
    if (!gameState.bounties) {
      gameState.bounties = [];
    }

    // 1. 推進 PENDING 的過期時間與 IN_PROGRESS 的任務時間
    for (let i = gameState.bounties.length - 1; i >= 0; i--) {
      const bounty = gameState.bounties[i];
      if (bounty.status === 'PENDING') {
        bounty.expireDays--;
        if (bounty.expireDays <= 0) {
          // 任務過期，自然移除
          gameState.bounties.splice(i, 1);
        }
      } else if (bounty.status === 'IN_PROGRESS' && bounty.remainingDuration !== undefined) {
        bounty.remainingDuration--;
        if (bounty.remainingDuration <= 0) {
          bounty.status = 'COMPLETED';
          const merc = gameState.adventurers?.find((a: Adventurer) => a.id === bounty.dispatchedMercId);
          if (merc?.currentState === AdventurerState.DISPATCHED) merc.currentState = AdventurerState.IDLE;
          if (bounty.type === 'BANDIT' && gameState.myTerritory) {
            gameState.myTerritory.security = Math.min(100, (gameState.myTerritory.security || 100) + 20);
          }
          GameLog.add(`✅ 委託【${bounty.name}】已完成！請至懸賞欄領取獎勵。`, 'info');
        }
      } else if (bounty.status === 'COMPLETED' && bounty.dispatchedMercId) {
        // 修復舊存檔：過去版本會讓已完成但尚未領獎的傭兵持續卡在派遣狀態。
        const merc = gameState.adventurers?.find((a: Adventurer) => a.id === bounty.dispatchedMercId);
        if (merc?.currentState === AdventurerState.DISPATCHED) merc.currentState = AdventurerState.IDLE;
      }
    }

    // 2. 從故事工坊/NarrativeSystem 動態取得所有符合條件的日常懸賞節點進行隨機補新 (目前總數不超過 10 個)
    const currentCount = gameState.bounties.length;
    if (currentCount < 10) {
      const maxNew = Math.min(3, 10 - currentCount);
      const eligibleRefs = NarrativeSystem.getEligibleRoutineBounties();
      if (eligibleRefs.length > 0) {
        const security = (gameState.myTerritory && gameState.myTerritory.security !== undefined) ? gameState.myTerritory.security : 100;
        const extortionCooldown = (gameState.myTerritory && gameState.myTerritory.extortionCooldown) || 0;
        const banditChance = extortionCooldown > 0 ? 0 : Math.max(0, 1.0 - (security / 100));

        const normalRefs = eligibleRefs.filter(r => r.node.bounty?.type !== 'BANDIT');
        const banditRefs = eligibleRefs.filter(r => r.node.bounty?.type === 'BANDIT');

        const candidatePool = [...eligibleRefs];
        const toPickCount = Math.min(maxNew, candidatePool.length);
        const pickedRefs: typeof eligibleRefs = [];

        for (let i = 0; i < toPickCount; i++) {
          let chosen: typeof eligibleRefs[0] | undefined;
          if (Math.random() < banditChance && banditRefs.length > 0) {
            const availableBandits = banditRefs.filter(r => !pickedRefs.includes(r));
            if (availableBandits.length > 0) {
              chosen = availableBandits[Math.floor(Math.random() * availableBandits.length)];
            }
          }
          if (!chosen) {
            const availableCandidates = candidatePool.filter(r => !pickedRefs.includes(r));
            if (availableCandidates.length > 0) {
              chosen = availableCandidates[Math.floor(Math.random() * availableCandidates.length)];
            }
          }
          if (chosen) {
            pickedRefs.push(chosen);
            const { story, node } = chosen;
            const bountyConfig = node.bounty ?? { duration: 2, expireDays: 4, gold: 30, exp: 20 };
            const key = NarrativeSystem.getNodeKey(story.id, node.id);
            const newBounty: BountyQuest = {
              id: 'BTY_' + Math.random().toString(36).substring(2, 9),
              name: node.title,
              desc: node.description,
              duration: bountyConfig.duration,
              expireDays: bountyConfig.expireDays || (Math.floor(Math.random() * 4) + 3),
              status: 'PENDING',
              type: (bountyConfig.type || 'NORMAL') as 'NORMAL' | 'BANDIT',
              narrativeNodeKey: key,
              narrativeStoryId: story.id,
              narrativeNodeId: node.id,
              objective: bountyConfig.objective,
              rewards: {
                gold: bountyConfig.gold,
                exp: bountyConfig.exp,
                items: bountyConfig.items ? JSON.parse(JSON.stringify(bountyConfig.items)) : undefined
              }
            };
            gameState.bounties.push(newBounty);
          }
        }
      }
    }
  }

  /**
   * 派遣傭兵執行懸賞
   */
  public static acceptBounty(gameState: any, bountyId: string, mercId: string): boolean {
    const bounty = gameState.bounties?.find((b: any) => b.id === bountyId);
    if (!bounty || bounty.status !== 'PENDING') return false;

    const merc = gameState.adventurers.find((a: Adventurer) => a.id === mercId);
    if (!merc || merc.currentState !== AdventurerState.IDLE) return false; // 必須是閒置狀態

    bounty.status = 'IN_PROGRESS';
    bounty.dispatchedMercId = mercId;
    bounty.remainingDuration = bounty.objective?.type === 'SUBJUGATE_NODE' ? undefined : bounty.duration;
    merc.currentState = AdventurerState.DISPATCHED; // 設定傭兵狀態為派遣中

    GameLog.add(`📜 ${merc.name} 接取了委託【${bounty.name}】，預計需要 ${bounty.duration} 回合。`, 'info');
    return true;
  }

  public static handleSubjugationCompleted(gameState: any, nodeId: string, isVictory: boolean): number {
    if (!isVictory || !Array.isArray(gameState.bounties)) return 0;
    let completed = 0;
    for (const bounty of gameState.bounties as BountyQuest[]) {
      if (bounty.status !== 'IN_PROGRESS' || bounty.objective?.type !== 'SUBJUGATE_NODE') continue;
      if (bounty.objective.targetNodeId && bounty.objective.targetNodeId !== nodeId) continue;
      bounty.status = 'COMPLETED';
      const merc = gameState.adventurers?.find((a: Adventurer) => a.id === bounty.dispatchedMercId);
      if (merc?.currentState === AdventurerState.DISPATCHED) merc.currentState = AdventurerState.IDLE;
      GameLog.add(`✅ 已完成據點討伐委託【${bounty.name}】，請至懸賞欄驗收獎勵。`, 'info');
      completed++;
    }
    return completed;
  }

  /**
   * 領取完成的懸賞獎勵
   */
  public static claimReward(gameState: any, bountyId: string): boolean {
    if (!gameState.bounties) return false;
    const bountyIndex = gameState.bounties.findIndex((b: any) => b.id === bountyId);
    if (bountyIndex === -1) return false;

    const bounty = gameState.bounties[bountyIndex];
    if (bounty.status !== 'COMPLETED' || !bounty.dispatchedMercId) return false;

    const merc = gameState.adventurers.find((a: Adventurer) => a.id === bounty.dispatchedMercId);
    const acquisitions: AcquisitionItem[] = [];
    
    // 給予獎勵
    gameState.myTerritory.gold += bounty.rewards.gold;
    let rewardText = `獲得了 ${bounty.rewards.gold} 金幣`;

    if (bounty.rewards.items) {
      bounty.rewards.items.forEach((item: any) => {
        let itemName = item.id;
        if (item.id.startsWith('tg_')) {
          gameState.myTerritory.tradeInventory = gameState.myTerritory.tradeInventory || {};
          gameState.myTerritory.tradeInventory[item.id] = (gameState.myTerritory.tradeInventory[item.id] || 0) + item.amount;
          const tg = TRADE_GOODS.find(g => g.id === item.id);
          if (tg) itemName = tg.name;
        } else {
          gameState.myTerritory.materials = gameState.myTerritory.materials || {};
          gameState.myTerritory.materials[item.id] = (gameState.myTerritory.materials[item.id] || 0) + item.amount;
          const mat = DataStore.MaterialDB[item.id];
          if (mat) itemName = mat.name;
        }
        rewardText += `、${itemName} x${item.amount}`;
        acquisitions.push({ name: itemName, icon: item.id, quantity: item.amount });
      });
    }

    if (merc) {
      merc.gainXP(bounty.rewards.exp);
      merc.currentState = AdventurerState.IDLE;
      rewardText += `，${merc.name} 獲得 ${bounty.rewards.exp} 經驗`;
    }

    GameLog.add(`💰 領取【${bounty.name}】報酬！${rewardText}`, 'info');
    AcquisitionNotification.enqueue(acquisitions);

    if (bounty.narrativeStoryId && bounty.narrativeNodeId) {
      NarrativeSystem.completeNode(bounty.narrativeStoryId, bounty.narrativeNodeId);
    }

    // 移除任務
    gameState.bounties.splice(bountyIndex, 1);
    return true;
  }

  /**
   * ⚡ 一鍵智能派遣所有待接取的懸賞
   * 規則：高難度/高收益優先，自動跳過 HP < 30% 受傷傭兵
   */
  public static autoDispatchAllBounties(gameState: any): { dispatchedCount: number, taskNames: string[] } {
    if (!gameState.bounties || gameState.bounties.length === 0) {
      return { dispatchedCount: 0, taskNames: [] };
    }

    // 1. 取得所有待接取的懸賞，按獎勵金幣與經驗降序排序
    const pendingBounties = gameState.bounties
      .filter((b: BountyQuest) => b.status === 'PENDING')
      .sort((a: BountyQuest, b: BountyQuest) => (b.rewards.gold + b.rewards.exp) - (a.rewards.gold + a.rewards.exp));

    if (pendingBounties.length === 0) {
      return { dispatchedCount: 0, taskNames: [] };
    }

    // 2. 取得所有 IDLE 且健康 (HP >= 30%) 的傭兵
    const availableMercs = (gameState.adventurers || []).filter((adv: Adventurer) => {
      const isIdle = adv.currentState === AdventurerState.IDLE && !adv.office;
      const stats = adv.getCombatStats ? adv.getCombatStats() : (adv as any).stats;
      const maxHp = stats?.hp || (adv as any).maxHp || 100;
      const curHp = (adv as any).currentHp !== undefined ? (adv as any).currentHp : maxHp;
      const hpRatio = curHp / maxHp;
      return isIdle && hpRatio >= 0.3;
    });

    if (availableMercs.length === 0) {
      return { dispatchedCount: 0, taskNames: [] };
    }

    let dispatchedCount = 0;
    const taskNames: string[] = [];

    // 3. 逐一指派傭兵接取懸賞
    for (const bounty of pendingBounties) {
      if (availableMercs.length === 0) break;
      const merc = availableMercs.shift()!;
      const success = this.acceptBounty(gameState, bounty.id, merc.id);
      if (success) {
        dispatchedCount++;
        taskNames.push(bounty.name);
      }
    }

    return { dispatchedCount, taskNames };
  }

  /**
   * 🎁 一鍵領取所有已完成的懸賞獎勵
   */
  public static claimAllCompletedBounties(gameState: any): { completedCount: number, totalGold: number, totalExp: number } {
    if (!gameState.bounties || gameState.bounties.length === 0) {
      return { completedCount: 0, totalGold: 0, totalExp: 0 };
    }

    const completedBounties = gameState.bounties.filter((b: BountyQuest) => b.status === 'COMPLETED');
    if (completedBounties.length === 0) {
      return { completedCount: 0, totalGold: 0, totalExp: 0 };
    }

    let completedCount = 0;
    let totalGold = 0;
    let totalExp = 0;

    // 批次結算
    for (const bounty of completedBounties) {
      totalGold += bounty.rewards.gold;
      totalExp += bounty.rewards.exp;
      const success = this.claimReward(gameState, bounty.id);
      if (success) {
        completedCount++;
      }
    }

    return { completedCount, totalGold, totalExp };
  }
}
