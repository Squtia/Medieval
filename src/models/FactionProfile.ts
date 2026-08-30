import { Faction, FactionType, FactionPersonality, FactionChampion } from './types';

/**
 * 陣營事件記憶項
 */
export interface FactionMemory {
  id: string;
  targetFactionId?: string; // 對象陣營 (若為全域或針對玩家可留空或填 'player')
  isPlayerRelated?: boolean;
  type: 'TRADE_RAIDED' | 'RESCUED_CITY' | 'CHAMPION_EXECUTED' | 'CHAMPION_RELEASED' | 'TREATY_BROKEN' | 'AID_PROVIDED';
  impactScore: number;       // 對好感/仇恨影響值 (-100 ~ +100)
  timestampDay: number;      // 發生時之遊戲日曆累積天數
  durationDays: number;       // 記憶持續天數 (隨時間衰減)
  note: string;              // 歷史事件備註
}

/**
 * 領主性格數值矩陣 (0 ~ 100)
 */
export interface FactionPersonalityTraits {
  aggression: number;        // 好戰度：越高越傾向主動擴張與發動掠奪
  greed: number;             // 貪婪度：越高越在乎稅收、金礦與商路利益
  paranoia: number;          // 猜忌度：越高越不容易信任盟友、越早收縮防守
  honor: number;             // 榮譽度：越高越遵守停戰條約、越看重誓言
  currentDesire: 'EXPAND' | 'PROSPER' | 'AVENGE' | 'SURVIVE'; // 當前戰略核心慾望
}

/**
 * 陣營軍事編制
 */
export interface FactionMilitaryProfile {
  infantry: number;          // 步兵常備軍現役人數 (前排推進/工兵推車)
  archers: number;           // 弓兵常備軍現役人數 (城垛射擊/後排齊射)
  cavalry: number;           // 騎兵常備軍現役人數 (野戰突擊/破城衝鋒)
  manpowerReserve: number;   // 後備兵源池 (戰損後每日動員補充)
  maxManpower: number;       // 後備兵源上限
  siegeRams: number;         // 撞木衝車庫存 (台)
  siegeCatapults: number;    // 重型投石機庫存 (台)
  activeCampaignId: string | null; // 當前出征任務 ID
}

/**
 * 陣營經濟與物資
 */
export interface FactionEconomicProfile {
  treasury: number;          // 國庫金幣 (招募、軍餉、修城、賠款)
  grainDays: number;         // 糧食存量天數 (<15天飢荒，>60天盈餘)
  dailyTaxIncome: number;    // 每日稅收 (領地/附庸)
  dailyTradeIncome: number;  // 每日商貿關稅
  dailyMilitaryExpense: number; // 每日軍餉開銷
  netDailyProfit: number;    // 每日淨盈虧
  activeTradeRoutes: number; // 當前活躍商隊數
  maxTradeRoutes: number;    // 商隊上限
}

/**
 * 完整 AI 陣營擴充檔案 (FactionProfile)
 */
export interface FactionProfile extends Faction {
  economy: FactionEconomicProfile;
  military: FactionMilitaryProfile;
  traits: FactionPersonalityTraits;
  stabilityIndex: number;    // 領地安定度 (0 ~ 100)
  warWeariness: number;      // 厭戰度 (0 ~ 100)
  truceWith: Record<string, number>; // 停戰保護期剩餘天數 (factionId -> days)
  memoryLedger: FactionMemory[];     // 事件記憶帳本
}

/**
 * 根據預設 Faction 升級初始化為完整 FactionProfile
 */
export function createDefaultFactionProfile(faction: Faction): FactionProfile {
  // 依據陣營性格設定預設數值
  let defaultTraits: FactionPersonalityTraits;
  switch (faction.personality) {
    case FactionPersonality.WARMONGER:
      defaultTraits = { aggression: 85, greed: 65, paranoia: 45, honor: 40, currentDesire: 'EXPAND' };
      break;
    case FactionPersonality.SCHEMER:
      defaultTraits = { aggression: 40, greed: 80, paranoia: 85, honor: 25, currentDesire: 'PROSPER' };
      break;
    case FactionPersonality.MERCHANT:
      defaultTraits = { aggression: 30, greed: 85, paranoia: 40, honor: 60, currentDesire: 'PROSPER' };
      break;
    case FactionPersonality.PEACEFUL:
      defaultTraits = { aggression: 20, greed: 35, paranoia: 50, honor: 85, currentDesire: 'SURVIVE' };
      break;
    default:
      defaultTraits = { aggression: 50, greed: 50, paranoia: 50, honor: 50, currentDesire: 'PROSPER' };
      break;
  }

  const baseTreasury = Math.max(1500, faction.resources || 3000);
  const nodeCount = Math.max(1, (faction.controlledNodes || []).length);

  return {
    ...faction,
    economy: {
      treasury: baseTreasury,
      grainDays: 60,
      dailyTaxIncome: nodeCount * 45,
      dailyTradeIncome: nodeCount * 20,
      dailyMilitaryExpense: 40,
      netDailyProfit: (nodeCount * 65) - 40,
      activeTradeRoutes: 1,
      maxTradeRoutes: Math.min(4, nodeCount + 1),
    },
    military: {
      infantry: nodeCount * 40 + 60,
      archers: nodeCount * 20 + 30,
      cavalry: nodeCount * 10 + 15,
      manpowerReserve: nodeCount * 80,
      maxManpower: nodeCount * 150,
      siegeRams: 1,
      siegeCatapults: nodeCount > 2 ? 1 : 0,
      activeCampaignId: null,
    },
    traits: defaultTraits,
    stabilityIndex: 75,
    warWeariness: 0,
    truceWith: {},
    memoryLedger: [],
  };
}
