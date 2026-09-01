import { FactionProfile } from '../../models/FactionProfile';
import { MapNode, NodeLevel } from '../../models/types';
import { MapUtils } from '../map/MapUtils';
import { GameState } from '../../core/GameState';

export type CampaignStatus = 'MARCHING' | 'SIEGING' | 'RETURNING' | 'RESOLVED';
export type CampaignType = 'BORDER_RAID' | 'SIEGE';

export interface FactionCampaign {
  id: string;
  attackerFactionId: string;
  targetFactionId: string;
  originNodeId: string;
  targetNodeId: string;
  type: CampaignType;
  infantry: number;
  archers: number;
  cavalry: number;
  siegeRams: number;
  siegeCatapults: number;
  status: CampaignStatus;
  totalDays: number;
  elapsedDays: number;
  currentPositionRatio: number; // 0 ~ 1 沿道路之行軍進度
  siegeDaysLeft?: number;
  lootResult?: {
    gold: number;
    grain: number;
  };
}

export interface CampaignStepResult {
  campaignId: string;
  event: 'MARCH_ADVANCED' | 'ARRIVED_AT_TARGET' | 'SIEGE_ROUND' | 'CITY_FALLEN' | 'SIEGE_REPELLED' | 'RAID_COMPLETED' | 'RETURNED_HOME';
  message: string;
  isCityFallen?: boolean;
  winnerFactionId?: string;
}

export class FactionCampaignSystem {
  /**
   * 發起新的軍事行動 (邊境掠奪或要塞圍城)
   */
  public static launchCampaign(
    attacker: FactionProfile,
    targetFactionId: string,
    originNode: MapNode,
    targetNode: MapNode,
    type: CampaignType
  ): FactionCampaign {
    const dist = MapUtils.getDistance(originNode, targetNode);
    const baseDays = Math.max(2, Math.ceil(dist / 12));

    // 攻城器械拖慢行軍速度
    const rams = type === 'SIEGE' ? Math.min(attacker.military.siegeRams, 1) : 0;
    const catapults = type === 'SIEGE' ? Math.min(attacker.military.siegeCatapults, 1) : 0;
    const totalMarchDays = baseDays + rams + catapults;

    // 出征部隊編制 (調集 50% 步兵、40% 弓兵、60% 騎兵)
    const deployedInfantry = Math.floor(attacker.military.infantry * 0.5);
    const deployedArchers = Math.floor(attacker.military.archers * 0.4);
    const deployedCavalry = Math.floor(attacker.military.cavalry * 0.6);

    // 扣除領地常備軍
    attacker.military.infantry -= deployedInfantry;
    attacker.military.archers -= deployedArchers;
    attacker.military.cavalry -= deployedCavalry;
    attacker.military.siegeRams -= rams;
    attacker.military.siegeCatapults -= catapults;

    const campaignId = `camp_${attacker.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    attacker.military.activeCampaignId = campaignId;

    return {
      id: campaignId,
      attackerFactionId: attacker.id,
      targetFactionId,
      originNodeId: originNode.id,
      targetNodeId: targetNode.id,
      type,
      infantry: deployedInfantry,
      archers: deployedArchers,
      cavalry: deployedCavalry,
      siegeRams: rams,
      siegeCatapults: catapults,
      status: 'MARCHING',
      totalDays: totalMarchDays,
      elapsedDays: 0,
      currentPositionRatio: 0,
      siegeDaysLeft: type === 'SIEGE' ? 3 : 0,
    };
  }

  /**
   * 每日推進所有進行中的軍事戰役
   */
  public static stepCampaigns(
    campaigns: FactionCampaign[],
    factions: FactionProfile[],
    allNodes: MapNode[],
    currentDay: number
  ): CampaignStepResult[] {
    const factionMap = new Map<string, FactionProfile>(factions.map(f => [f.id, f]));
    const nodeMap = new Map<string, MapNode>(allNodes.map(n => [n.id, n]));
    const results: CampaignStepResult[] = [];

    for (const camp of campaigns) {
      if (camp.status === 'RESOLVED') continue;

      const attacker = factionMap.get(camp.attackerFactionId);
      const isTargetPlayer = camp.targetFactionId === 'player';
      const defender = !isTargetPlayer ? factionMap.get(camp.targetFactionId) : null;
      const targetNode = nodeMap.get(camp.targetNodeId);

      // 多支軍隊可能同時鎖定同一據點。若途中據點已易主，舊戰役不得再次覆寫所有權。
      if (camp.status !== 'RETURNING' && (!targetNode || (!isTargetPlayer && targetNode.ownerFactionId !== camp.targetFactionId))) {
        camp.status = 'RETURNING';
        camp.elapsedDays = 0;
        camp.currentPositionRatio = 1;
        results.push({
          campaignId: camp.id,
          event: 'SIEGE_REPELLED',
          isCityFallen: false,
          message: `↩️ 【${attacker?.factionName || '遠征軍'}】的目標已易主或不存在，取消攻勢並班師。`,
        });
        continue;
      }

      // ── 1. 行軍階段 (MARCHING) ──
      if (camp.status === 'MARCHING') {
        camp.elapsedDays += 1;
        camp.currentPositionRatio = Math.min(1, camp.elapsedDays / camp.totalDays);

        if (camp.elapsedDays >= camp.totalDays) {
          // 兵臨城下
          if (camp.type === 'BORDER_RAID') {
            let lootedGold = 0;
            let lootedGrain = 0;

            if (isTargetPlayer) {
              // 掠奪玩家資源
              lootedGold = Math.min(300, Math.floor(GameState.myTerritory.gold * 0.15));
              lootedGrain = Math.min(10, Math.floor(GameState.myTerritory.food * 0.2));
              GameState.myTerritory.gold = Math.max(0, GameState.myTerritory.gold - lootedGold);
              GameState.myTerritory.food = Math.max(0, GameState.myTerritory.food - lootedGrain);
              GameState.myTerritory.prestige = Math.max(0, GameState.myTerritory.prestige - 25);
            } else if (defender) {
              lootedGold = Math.min(400, Math.floor(defender.economy.treasury * 0.2));
              lootedGrain = Math.min(15, Math.floor(defender.economy.grainDays * 0.25));
              defender.economy.treasury = Math.max(0, defender.economy.treasury - lootedGold);
              defender.economy.grainDays = Math.max(0, defender.economy.grainDays - lootedGrain);
              defender.stabilityIndex = Math.max(10, defender.stabilityIndex - 8);
              defender.warWeariness = Math.min(100, defender.warWeariness + 5);
            }

            camp.lootResult = { gold: lootedGold, grain: lootedGrain };
            camp.status = 'RETURNING';
            camp.elapsedDays = 0;
            camp.currentPositionRatio = 1;

            results.push({
              campaignId: camp.id,
              event: 'RAID_COMPLETED',
              message: `🔥 【${attacker?.factionName || '敵軍'}】襲擊了【${targetNode?.name || '目標據點'}】，掠奪了 ${lootedGold}G 與物資！`,
            });
          } else {
            // 進入圍城階段
            camp.status = 'SIEGING';
            results.push({
              campaignId: camp.id,
              event: 'ARRIVED_AT_TARGET',
              message: `⚔️ 【${attacker?.factionName || '敵軍'}】主力大軍已兵臨【${targetNode?.name || '目標據點'}】城下，正式展開圍城！`,
            });
          }
        } else {
          results.push({
            campaignId: camp.id,
            event: 'MARCH_ADVANCED',
            message: `🐎 【${attacker?.factionName || '軍團'}】正在前往【${targetNode?.name || '目標據點'}】(進度 ${Math.round(camp.currentPositionRatio * 100)}%)`,
          });
        }
      }

      // ── 2. 圍城階段 (SIEGING) ──
      else if (camp.status === 'SIEGING') {
        camp.siegeDaysLeft = (camp.siegeDaysLeft ?? 1) - 1;

        if (camp.siegeDaysLeft <= 0) {
          if (isTargetPlayer) {
            // 對玩家圍城結算
            camp.status = 'RETURNING';
            camp.elapsedDays = 0;
            camp.currentPositionRatio = 1;
            GameState.myTerritory.prestige = Math.max(0, GameState.myTerritory.prestige - 50);

            results.push({
              campaignId: camp.id,
              event: 'CITY_FALLEN',
              isCityFallen: true,
              winnerFactionId: attacker?.id,
              message: `🚨 您的據點【${targetNode?.name}】承受了【${attacker?.factionName}】的圍攻轟擊，聲望受損！`,
            });
          } else {
            // NPC vs NPC 圍城決戰結算：比對進攻軍力與防守軍力
            const attackPower = camp.infantry * 1.0 + camp.archers * 1.2 + camp.cavalry * 1.5 + (camp.siegeRams * 50) + (camp.siegeCatapults * 80);
            const defInf = defender ? defender.military.infantry : 50;
            const defArc = defender ? defender.military.archers : 30;
            const defensePower = (defInf * 1.2) + (defArc * 1.4); // 守方城防加成

            if (attackPower >= defensePower) {
              // 攻方破城勝利！
              if (targetNode && defender && attacker) {
                targetNode.ownerFactionId = attacker.id;
                defender.controlledNodes = defender.controlledNodes.filter(id => id !== targetNode.id);
                if (!attacker.controlledNodes.includes(targetNode.id)) {
                  attacker.controlledNodes.push(targetNode.id);
                }
                attacker.truceWith[defender.id] = 180;
                defender.truceWith[attacker.id] = 180;
              }

              camp.status = 'RETURNING';
              camp.elapsedDays = 0;
              camp.currentPositionRatio = 1;

              results.push({
                campaignId: camp.id,
                event: 'CITY_FALLEN',
                isCityFallen: true,
                winnerFactionId: attacker?.id,
                message: `🏆 城破！【${attacker?.factionName}】攻克了【${targetNode?.name}】！雙方簽訂 180 天停戰協議。`,
              });
            } else {
              // 守方擊退進攻！
              camp.status = 'RETURNING';
              camp.elapsedDays = 0;
              camp.currentPositionRatio = 1;

              results.push({
                campaignId: camp.id,
                event: 'SIEGE_REPELLED',
                isCityFallen: false,
                winnerFactionId: defender?.id,
                message: `🛡️ 守城大捷！【${defender?.factionName}】在【${targetNode?.name}】重挫了敵方攻城部隊！`,
              });
            }
          }
        } else {
          results.push({
            campaignId: camp.id,
            event: 'SIEGE_ROUND',
            message: `💥 【${targetNode?.name}】城門正承受轟擊，圍城剩餘 ${camp.siegeDaysLeft} 天！`,
          });
        }
      }

      // ── 3. 班師返程階段 (RETURNING) ──
      else if (camp.status === 'RETURNING') {
        camp.elapsedDays += 1;
        camp.currentPositionRatio = Math.max(0, 1 - (camp.elapsedDays / camp.totalDays));

        if (camp.elapsedDays >= camp.totalDays) {
          if (attacker) {
            attacker.military.infantry += camp.infantry;
            attacker.military.archers += camp.archers;
            attacker.military.cavalry += camp.cavalry;
            attacker.military.siegeRams += camp.siegeRams;
            attacker.military.siegeCatapults += camp.siegeCatapults;
            attacker.military.activeCampaignId = null;

            if (camp.lootResult) {
              attacker.economy.treasury += camp.lootResult.gold;
              attacker.economy.grainDays += camp.lootResult.grain;
            }
          }

          camp.status = 'RESOLVED';
          results.push({
            campaignId: camp.id,
            event: 'RETURNED_HOME',
            message: `🏁 【${attacker?.factionName}】遠征軍團已順利班師回朝。`,
          });
        }
      }
    }

    return results;
  }

  /**
   * 執行割地與賠款求和協議 (SEEK_TRUCE)
   */
  public static executeTruce(
    loser: FactionProfile,
    winner: FactionProfile,
    allNodes?: MapNode[]
  ): string {
    const indemnity = Math.min(500, Math.floor(loser.economy.treasury * 0.3));
    loser.economy.treasury = Math.max(0, loser.economy.treasury - indemnity);
    winner.economy.treasury += indemnity;

    loser.truceWith[winner.id] = 180;
    winner.truceWith[loser.id] = 180;
    loser.warWeariness = Math.max(0, loser.warWeariness - 40);

    // 移除交戰狀態
    loser.atWarWith = (loser.atWarWith || []).filter(id => id !== winner.id);
    winner.atWarWith = (winner.atWarWith || []).filter(id => id !== loser.id);

    return `🕊️ 【${loser.factionName}】向【${winner.factionName}】支付了 ${indemnity}G 賠款，雙方正式簽署 180 天停戰協議！`;
  }
}
