import { GameState } from '../core/GameState';
import { GameLog } from '../ui/GameLog';
import { Adventurer } from '../models/Adventurer';
import { AdventurerState } from '../models/types';

export interface BountyQuest {
  id: string;
  name: string;
  desc: string;
  duration: number; // 所需花費的遊戲天數(回合)
  expireDays: number; // 懸賞單掛在牆上多久後過期消失(若未接取)
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dispatchedMercId?: string; // 派出的傭兵 ID
  remainingDuration?: number; // 任務執行中的剩餘回合數
  rewards: {
    gold: number;
    exp: number;
    items?: { id: string, amount: number }[];
  };
}

export class BountySystem {
  // 15 種日常任務模板
  private static readonly QUEST_TEMPLATES = [
    { name: '找尋走失的貓', desc: '鎮上的老奶奶丟失了她心愛的花貓，希望有人能幫忙找回來。', duration: 1, gold: 20, exp: 10 },
    { name: '清理下水道老鼠', desc: '酒館老闆抱怨下水道老鼠氾濫，需要有人去清理一下。', duration: 1, gold: 15, exp: 25, items: [{id: 'RAW_HIDE', amount: 1}] },
    { name: '夜間守望巡邏', desc: '守衛長正在招募夜間巡邏的人手，確保城鎮安寧。', duration: 2, gold: 30, exp: 40 },
    { name: '幫忙農夫收割', desc: '收穫季到了，農夫急需人手幫忙收割麥子。', duration: 1, gold: 10, exp: 15, items: [{id: 'GRAIN', amount: 3}] },
    { name: '驅趕偷吃穀物的野豬', desc: '一頭野豬頻繁破壞農田，將其驅趕或獵殺。', duration: 2, gold: 25, exp: 35, items: [{id: 'MEAT', amount: 2}] },
    { name: '護送商人到鄰鎮', desc: '一名行商需要護衛，保護他平安抵達鄰近城鎮。', duration: 3, gold: 80, exp: 50 },
    { name: '採集稀有藥草', desc: '藥劑師委託採集生長在森林深處的珍貴藥草。', duration: 2, gold: 20, exp: 30, items: [{id: 'COTTON', amount: 2}] },
    { name: '教訓地痞流氓', desc: '市場有幾個小混混在收保護費，去給他們一點教訓。', duration: 1, gold: 40, exp: 20 },
    { name: '修補城牆破損', desc: '城牆有一處缺口需要搬運石料並修補。', duration: 2, gold: 15, exp: 15, items: [{id: 'STONE', amount: 3}] },
    { name: '協助礦工搬運', desc: '礦場近期產量大增，需要體力充沛的人幫忙搬運礦石。', duration: 2, gold: 20, exp: 20, items: [{id: 'IRON_ORE', amount: 3}] },
    { name: '伐木場周邊警戒', desc: '伐木工在森林中感覺被注視，請去周邊巡視一圈。', duration: 2, gold: 30, exp: 25, items: [{id: 'WOOD', amount: 3}] },
    { name: '尋找遺失的傳家寶', desc: '某位貴族在郊外弄丟了戒指，重金懸賞尋回。', duration: 3, gold: 100, exp: 10 },
    { name: '捕捉破壞農田的野狼', desc: '一群野狼正在襲擊家畜，需要強者去解決。', duration: 2, gold: 40, exp: 40, items: [{id: 'RAW_HIDE', amount: 2}, {id: 'MEAT', amount: 1}] },
    { name: '清理廢棄水井的黏液', desc: '鎮外廢棄的水井長滿了奇怪的史萊姆，去清理乾淨。', duration: 1, gold: 25, exp: 30 },
    { name: '保護商隊免受哥布林騷擾', desc: '有商隊通報路線上有哥布林出沒，隨行保護他們。', duration: 3, gold: 60, exp: 60 }
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
          gameState.bounties.splice(i, 1);
        }
      } else if (bounty.status === 'IN_PROGRESS' && bounty.remainingDuration !== undefined) {
        bounty.remainingDuration--;
        if (bounty.remainingDuration <= 0) {
          bounty.status = 'COMPLETED';
          GameLog.add(`✅ 委託【${bounty.name}】已完成！請至懸賞欄領取獎勵。`, 'info');
        }
      }
    }

    // 2. 隨機生成 1~3 個新任務 (前提是目前總數不超過 10 個)
    const currentCount = gameState.bounties.length;
    if (currentCount < 10) {
      const maxNew = Math.min(3, 10 - currentCount);
      const newAmount = Math.floor(Math.random() * maxNew) + 1; // 1 to maxNew
      for (let i = 0; i < newAmount; i++) {
        const template = this.QUEST_TEMPLATES[Math.floor(Math.random() * this.QUEST_TEMPLATES.length)];
        const newBounty: BountyQuest = {
          id: 'BTY_' + Math.random().toString(36).substring(2, 9),
          name: template.name,
          desc: template.desc,
          duration: template.duration,
          expireDays: Math.floor(Math.random() * 4) + 3, // 3~6 天過期
          status: 'PENDING',
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
        gameState.myTerritory.materials = gameState.myTerritory.materials || {};
        gameState.myTerritory.materials[item.id] = (gameState.myTerritory.materials[item.id] || 0) + item.amount;
        // 簡單翻譯
        const names: Record<string, string> = { 'RAW_HIDE': '獸皮', 'GRAIN': '穀物', 'MEAT': '肉類', 'COTTON': '棉花', 'STONE': '石材', 'IRON_ORE': '鐵礦', 'WOOD': '木材' };
        const itemName = names[item.id] || item.id;
        rewardText += `、${itemName} x${item.amount}`;
      });
    }

    if (merc) {
      merc.gainXP(bounty.rewards.exp);
      merc.currentState = AdventurerState.IDLE;
      rewardText += `，${merc.name} 獲得 ${bounty.rewards.exp} 經驗`;
    }

    GameLog.add(`💰 領取【${bounty.name}】報酬！${rewardText}`, 'info');

    // 移除任務
    gameState.bounties.splice(bountyIndex, 1);
    return true;
  }
}
