import { FactionProfile } from '../../models/FactionProfile';
import { MapNode, NodeLevel } from '../../models/types';

export interface DailyEconomySummary {
  factionId: string;
  treasuryChange: number;
  newTreasury: number;
  newGrainDays: number;
  newStability: number;
  isStarving: boolean;
  isBankrupt: boolean;
  logMessages: string[];
}

export class FactionEconomyEngine {
  /**
   * 每日經濟與後備兵力結算步進
   */
  public static stepDailyEconomy(
    factions: FactionProfile[],
    allNodes: MapNode[],
    currentDay: number
  ): DailyEconomySummary[] {
    const nodeMap = new Map<string, MapNode>(allNodes.map(n => [n.id, n]));
    const summaries: DailyEconomySummary[] = [];

    for (const faction of factions) {
      const logs: string[] = [];
      const controlledNodes = (faction.controlledNodes || [])
        .map(id => nodeMap.get(id))
        .filter((n): n is MapNode => Boolean(n));

      // ── 1. 領地稅收與特產關稅產出 ──
      let totalTax = 0;
      let totalTrade = 0;
      let grainHarvest = 0;

      for (const node of controlledNodes) {
        switch (node.nodeLevel) {
          case NodeLevel.CAPITAL:
            totalTax += 85;
            totalTrade += 40;
            grainHarvest += 1;
            break;
          case NodeLevel.TOWN:
            totalTax += 55;
            totalTrade += 25;
            grainHarvest += 1;
            break;
          case NodeLevel.VILLAGE:
            totalTax += 25;
            totalTrade += 10;
            grainHarvest += 2; // 農村主要供應糧食
            break;
          default:
            totalTax += 15;
            totalTrade += 5;
            grainHarvest += 0.5;
            break;
        }
      }

      // 領地安定度加乘 (0.5x ~ 1.25x)
      const stabilityMultiplier = 0.5 + (faction.stabilityIndex / 100) * 0.75;
      totalTax = Math.floor(totalTax * stabilityMultiplier);
      totalTrade = Math.floor(totalTrade * stabilityMultiplier);

      // ── 2. 軍隊糧草與軍餉開銷 ──
      const mil = faction.military;
      const totalSoldiers = mil.infantry + mil.archers + mil.cavalry;
      const dailyMilitaryExpense = Math.ceil(
        (mil.infantry * 0.15) + (mil.archers * 0.2) + (mil.cavalry * 0.35)
      );

      // 每日糧食消耗 (每 80 名士兵消耗 1 天糧食份額)
      const grainConsumption = Math.max(1, Math.ceil(totalSoldiers / 80));
      faction.economy.grainDays = Math.max(0, faction.economy.grainDays - grainConsumption + Math.floor(grainHarvest));

      // 結算國庫金幣
      const netDailyProfit = (totalTax + totalTrade) - dailyMilitaryExpense;
      faction.economy.dailyTaxIncome = totalTax;
      faction.economy.dailyTradeIncome = totalTrade;
      faction.economy.dailyMilitaryExpense = dailyMilitaryExpense;
      faction.economy.netDailyProfit = netDailyProfit;
      faction.economy.treasury = Math.max(0, faction.economy.treasury + netDailyProfit);
      faction.resources = faction.economy.treasury; // 同步相容舊欄位

      // ── 3. 飢荒與破產判定 ──
      const isStarving = faction.economy.grainDays <= 0;
      const isBankrupt = faction.economy.treasury < 500;

      if (isStarving) {
        faction.stabilityIndex = Math.max(10, faction.stabilityIndex - 4);
        // 逃兵機制 (部隊自然縮減 2%)
        mil.infantry = Math.floor(mil.infantry * 0.98);
        mil.archers = Math.floor(mil.archers * 0.98);
        mil.cavalry = Math.floor(mil.cavalry * 0.98);
        logs.push(`⚠️ 【${faction.factionName}】陷入糧荒！民心動盪，發生逃兵潮。`);
      }

      if (isBankrupt) {
        faction.stabilityIndex = Math.max(15, faction.stabilityIndex - 2);
        logs.push(`💸 【${faction.factionName}】國庫見底，軍餉拖欠中。`);
      }

      // ── 4. 後備兵源自然動員補充 ──
      if (mil.manpowerReserve < mil.maxManpower) {
        const recoveryRate = Math.max(1, Math.floor((faction.stabilityIndex / 100) * 5));
        mil.manpowerReserve = Math.min(mil.maxManpower, mil.manpowerReserve + recoveryRate);
      }

      // ── 5. 安定度與厭戰度自適應演變 ──
      const isAtWar = (faction.atWarWith || []).length > 0;
      if (isAtWar) {
        faction.warWeariness = Math.min(100, faction.warWeariness + 0.5);
      } else {
        faction.warWeariness = Math.max(0, faction.warWeariness - 1);
        if (!isStarving && !isBankrupt && faction.economy.treasury > 2500) {
          faction.stabilityIndex = Math.min(100, faction.stabilityIndex + 0.5);
        }
      }

      // ── 6. 停戰保護期與記憶衰減 ──
      if (faction.truceWith) {
        for (const [enemyId, days] of Object.entries(faction.truceWith)) {
          if (days > 1) {
            faction.truceWith[enemyId] = days - 1;
          } else {
            delete faction.truceWith[enemyId];
            logs.push(`🕊️ 【${faction.factionName}】與【${enemyId}】的停戰保護期已屆滿。`);
          }
        }
      }

      if (faction.memoryLedger && faction.memoryLedger.length > 0) {
        faction.memoryLedger = faction.memoryLedger.filter(mem => {
          return (currentDay - mem.timestampDay) <= mem.durationDays;
        });
      }

      summaries.push({
        factionId: faction.id,
        treasuryChange: netDailyProfit,
        newTreasury: faction.economy.treasury,
        newGrainDays: faction.economy.grainDays,
        newStability: Math.round(faction.stabilityIndex),
        isStarving,
        isBankrupt,
        logMessages: logs,
      });
    }

    return summaries;
  }
}
