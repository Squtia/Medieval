import { FactionProfile } from '../../models/FactionProfile';
import { MapNode, NodeLevel } from '../../models/types';

/**
 * AI 勢力決策類型
 */
export type FactionDecisionType =
  | 'DEFENSIVE_HOLD'     // 警戒防守 (保命儲備生效)
  | 'SEEK_TRUCE'         // 割地/賠款求和 (戰損或財政崩潰)
  | 'RECOVER_ECONOMY'    // 經商休養 (通商跑商)
  | 'COMMISSION_PLAYER'  // 向玩家發布高額委託 (借刀殺人/救急)
  | 'BORDER_RAID'        // 發動邊境掠奪 (搶糧搶錢)
  | 'LAUNCH_SIEGE';      // 大軍出征圍城 (領主親征/先鋒軍團)

export interface FactionDecision {
  factionId: string;
  type: FactionDecisionType;
  targetFactionId?: string;
  targetNodeId?: string;
  reason: string;
  score: number;
}

export class FactionDecisionAI {
  /**
   * 評估單一勢力在當前世界局勢下的最佳戰略決策
   */
  public static evaluateDecision(
    faction: FactionProfile,
    allFactions: FactionProfile[],
    allNodes: MapNode[]
  ): FactionDecision {
    const nodeMap = new Map<string, MapNode>(allNodes.map(n => [n.id, n]));
    const otherFactions = allFactions.filter(f => f.id !== faction.id);

    // ═════════════════════════════════════════════════════════
    // 🛑 第 1 步：檢查 4 大防崩潰保命煞車 (Circuit Breakers)
    // ═════════════════════════════════════════════════════════

    // 煞車 1：財政或糧草崩潰 ➔ 強制轉入警戒防守
    if (faction.economy.treasury < 1200 || faction.economy.grainDays < 15) {
      // 若極度缺糧，向玩家發布緊急運糧委託
      if (faction.economy.grainDays < 10) {
        return {
          factionId: faction.id,
          type: 'COMMISSION_PLAYER',
          reason: `糧草告急 (僅剩 ${faction.economy.grainDays} 天)，發布緊急重金運糧委託`,
          score: 95,
        };
      }
      return {
        factionId: faction.id,
        type: 'DEFENSIVE_HOLD',
        reason: `國庫緊張 (${faction.economy.treasury}G)，凍結主動攻勢以保衛老巢`,
        score: 90,
      };
    }

    // 煞車 2：厭戰度爆表或前線戰損過重 ➔ 主動尋求妥協求和 (獲取 180 天停戰保護)
    if (faction.warWeariness > 70 && (faction.atWarWith || []).length > 0) {
      const enemyId = faction.atWarWith[0];
      return {
        factionId: faction.id,
        type: 'SEEK_TRUCE',
        targetFactionId: enemyId,
        reason: `厭戰度過高 (${Math.round(faction.warWeariness)})，主動提出停戰與賠款協議`,
        score: 88,
      };
    }

    // 煞車 3：若已在出征任務中 ➔ 保持戰略動作
    if (faction.military.activeCampaignId) {
      return {
        factionId: faction.id,
        type: 'DEFENSIVE_HOLD',
        reason: '主力部隊正在執行戰役任務中',
        score: 85,
      };
    }

    // ═════════════════════════════════════════════════════════
    // 🧠 第 2 步：多維度動機與性格權重評估 (Utility Evaluation)
    // ═════════════════════════════════════════════════════════
    const candidates: FactionDecision[] = [];

    // ── 評估選項 A：經商休養與通商跑商 ──
    const commerceScore = (faction.traits.greed * 0.6) + ((100 - faction.traits.aggression) * 0.4) + (faction.economy.treasury < 4000 ? 25 : 0);
    candidates.push({
      factionId: faction.id,
      type: 'RECOVER_ECONOMY',
      reason: '繁榮商路，擴充國庫儲備',
      score: commerceScore,
    });

    // ── 評估選項 B：向玩家發布懸賞委託 (陰謀家 / 求生) ──
    if (faction.traits.paranoia > 60 || faction.economy.treasury > 5000) {
      const commissionScore = (faction.traits.paranoia * 0.5) + (faction.economy.treasury > 6000 ? 30 : 0);
      candidates.push({
        factionId: faction.id,
        type: 'COMMISSION_PLAYER',
        reason: '以重金委託第三方傭兵團執行秘密作戰',
        score: commissionScore,
      });
    }

    // ── 評估選項 C：對敵對或鄰近勢力發動邊境掠奪或圍城 ──
    for (const targetFaction of otherFactions) {
      // 若在停戰保護期內，嚴格禁止進攻
      if (faction.truceWith && faction.truceWith[targetFaction.id] > 0) {
        continue;
      }

      const relation = (faction.relations && faction.relations[targetFaction.id]) ?? 0;
      const isAtWar = (faction.atWarWith || []).includes(targetFaction.id);
      
      // 計算進攻慾望得分
      let attackScore = (faction.traits.aggression * 0.6) - (relation * 0.4) - (faction.warWeariness * 0.5);
      if (isAtWar) attackScore += 35;
      if (faction.traits.currentDesire === 'EXPAND') attackScore += 20;

      // 目標據點篩選：優先鎖定外圍小鎮或村莊
      const targetNodes = (targetFaction.controlledNodes || [])
        .map(id => nodeMap.get(id))
        .filter((n): n is MapNode => Boolean(n));

      if (targetNodes.length > 0) {
        const vulnerableNode = targetNodes.find(n => n.nodeLevel !== NodeLevel.CAPITAL) || targetNodes[0];
        
        // 兵力充足且有攻城器械時發動圍城，否則發動掠奪
        const isSiegeCapable = faction.military.infantry >= 100 && (faction.military.siegeRams > 0 || faction.military.siegeCatapults > 0);

        candidates.push({
          factionId: faction.id,
          type: isSiegeCapable ? 'LAUNCH_SIEGE' : 'BORDER_RAID',
          targetFactionId: targetFaction.id,
          targetNodeId: vulnerableNode.id,
          reason: isAtWar 
            ? `與【${targetFaction.factionName}】交戰，進攻目標【${vulnerableNode.name}】`
            : `擴張與獲取戰略物資，進逼【${targetFaction.factionName}】轄下【${vulnerableNode.name}】`,
          score: attackScore,
        });
      }
    }

    // 排序選取得分最高之戰略決策
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || {
      factionId: faction.id,
      type: 'RECOVER_ECONOMY',
      reason: '保持常態發展',
      score: 10,
    };
  }
}
