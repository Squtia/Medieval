import { GameState } from '../core/GameState';
import { GameLog } from '../ui/GameLog';
import { Adventurer } from '../models/Adventurer';
import { AdventurerState } from '../models/types';
import { NarrativeSystem } from './NarrativeSystem';
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
}

export class BountySystem {
  // 日常任務模板
  private static readonly QUEST_TEMPLATES = [
    { name: '找尋走失的貓', desc: '鎮上的老奶奶丟失了她心愛的花貓，希望有人能幫忙找回來。', duration: 1, gold: 20, exp: 10, type: 'NORMAL' },
    { name: '清理下水道老鼠', desc: '酒館老闆抱怨下水道老鼠氾濫，需要有人去清理一下。', duration: 1, gold: 15, exp: 25, items: [{id: 'tg_hide', amount: 1}], type: 'NORMAL' },
    { name: '夜間守望巡邏', desc: '守衛長正在招募夜間巡邏的人手，提防鎮外的流寇。', duration: 2, gold: 30, exp: 40, type: 'BANDIT' },
    { name: '幫忙農夫收割', desc: '收穫季到了，農夫急需人手幫忙收割麥子。', duration: 1, gold: 10, exp: 15, items: [{id: 'tg_wheat', amount: 3}], type: 'NORMAL' },
    { name: '驅趕偷吃穀物的野豬', desc: '一頭野豬頻繁破壞農田，將其驅趕或獵殺。', duration: 2, gold: 25, exp: 35, items: [{id: 'tg_meat', amount: 2}], type: 'NORMAL' },
    { name: '護送商人到鄰鎮', desc: '一名行商需要護衛，保護他平安抵達鄰近城鎮。', duration: 3, gold: 80, exp: 50, type: 'NORMAL' },
    { name: '採集稀有藥草', desc: '藥劑師委託採集生長在森林深處的珍貴藥草。', duration: 2, gold: 20, exp: 30, items: [{id: 'tg_cotton', amount: 2}], type: 'NORMAL' },
    { name: '教訓地痞流氓', desc: '有幾個小混混在收保護費，去給他們一點教訓。', duration: 1, gold: 40, exp: 20, type: 'BANDIT' },
    { name: '修補城牆破損', desc: '城牆有一處缺口需要搬運石料並修補。', duration: 2, gold: 15, exp: 15, items: [{id: 'mat_stone_brick', amount: 3}], type: 'NORMAL' },
    { name: '協助礦工搬運', desc: '礦場近期產量大增，需要體力充沛的人幫忙搬運礦石。', duration: 2, gold: 20, exp: 20, items: [{id: 'mat_iron_ingot', amount: 3}], type: 'NORMAL' },
    { name: '伐木場周邊警戒', desc: '伐木工在森林中感覺被注視，疑似有強盜出沒，請去巡視。', duration: 2, gold: 30, exp: 25, items: [{id: 'mat_wood_plank', amount: 3}], type: 'BANDIT' },
    { name: '尋找遺失的傳家寶', desc: '某位貴族在郊外弄丟了戒指，重金懸賞尋回。', duration: 3, gold: 100, exp: 10, type: 'NORMAL' },
    { name: '捕捉破壞農田的野狼', desc: '一群野狼正在襲擊家畜，需要強者去解決。', duration: 2, gold: 40, exp: 40, items: [{id: 'tg_hide', amount: 2}, {id: 'tg_meat', amount: 1}], type: 'NORMAL' },
    { name: '清理廢棄水井的黏液', desc: '鎮外廢棄的水井長滿了奇怪的史萊姆，去清理乾淨。', duration: 1, gold: 25, exp: 30, type: 'NORMAL' },
    { name: '清剿荒野強盜營地', desc: '有一群強盜在荒野紮營並頻繁襲擊旅人，將其徹底清剿。', duration: 3, gold: 60, exp: 60, type: 'BANDIT' }
  ];

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
          // 任務過期，移除
          if (bounty.type === 'BANDIT') {
            gameState.pendingExtortionEvent = true;
          }
          gameState.bounties.splice(i, 1);
        }
      } else if (bounty.status === 'IN_PROGRESS' && bounty.remainingDuration !== undefined) {
        bounty.remainingDuration--;
        if (bounty.remainingDuration <= 0) {
          bounty.status = 'COMPLETED';
          if (bounty.type === 'BANDIT' && gameState.myTerritory) {
            gameState.myTerritory.security = Math.min(100, (gameState.myTerritory.security || 100) + 20);
          }
          GameLog.add(`✅ 委託【${bounty.name}】已完成！請至懸賞欄領取獎勵。`, 'info');
        }
      }
    }

    // 2. 隨機生成 1~3 個新任務 (前提是目前總數不超過 10 個)
    const currentCount = gameState.bounties.length;
    if (currentCount < 10) {
      const maxNew = Math.min(3, 10 - currentCount);
      const newAmount = Math.floor(Math.random() * maxNew) + 1; // 1 to maxNew
      const security = (gameState.myTerritory && gameState.myTerritory.security !== undefined) ? gameState.myTerritory.security : 100;
      const extortionCooldown = (gameState.myTerritory && gameState.myTerritory.extortionCooldown) || 0;
      const banditChance = extortionCooldown > 0 ? 0 : Math.max(0, 1.0 - (security / 100));

      const normalTemplates = this.QUEST_TEMPLATES.filter(q => q.type !== 'BANDIT');
      const banditTemplates = this.QUEST_TEMPLATES.filter(q => q.type === 'BANDIT');

      for (let i = 0; i < newAmount; i++) {
        let template;
        if (Math.random() < banditChance && banditTemplates.length > 0) {
          template = banditTemplates[Math.floor(Math.random() * banditTemplates.length)];
        } else {
          template = normalTemplates[Math.floor(Math.random() * normalTemplates.length)];
        }
        
        const newBounty: BountyQuest = {
          id: 'BTY_' + Math.random().toString(36).substring(2, 9),
          name: template.name,
          desc: template.desc,
          duration: template.duration,
          expireDays: Math.floor(Math.random() * 4) + 3, // 3~6 天過期
          status: 'PENDING',
          type: template.type as 'NORMAL' | 'BANDIT',
          rewards: {
            gold: template.gold,
            exp: template.exp,
            items: template.items ? JSON.parse(JSON.stringify(template.items)) : undefined
          }
        };
        gameState.bounties.push(newBounty);
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
    bounty.remainingDuration = bounty.duration;
    merc.currentState = AdventurerState.DISPATCHED; // 設定傭兵狀態為派遣中

    GameLog.add(`📜 ${merc.name} 接取了委託【${bounty.name}】，預計需要 ${bounty.duration} 回合。`, 'info');
    return true;
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
      });
    }

    if (merc) {
      merc.gainXP(bounty.rewards.exp);
      merc.currentState = AdventurerState.IDLE;
      rewardText += `，${merc.name} 獲得 ${bounty.rewards.exp} 經驗`;
    }

    GameLog.add(`💰 領取【${bounty.name}】報酬！${rewardText}`, 'info');

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
