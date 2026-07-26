import { GameState } from '../core/GameState';
import { NodeLevel } from '../models/types';

/**
 * 里程碑定義
 */
interface MilestoneDef {
  id: string;
  label: string;           // 顯示在「今日見聞」的訊息
  check: () => boolean;    // 觸發條件
  reward: () => void;      // 獎勵發放
}

function getPlayerNode() {
  return GameState.mapSystem?.getNodes().find(n => n.isPlayerBase) ||
    (GameState.myTerritory.currentCountryId ? GameState.mapSystem?.getNodeById(GameState.myTerritory.currentCountryId) : null);
}

const MILESTONES: MilestoneDef[] = [
  {
    id: 'first_worker',
    label: '⭐ 領地開始有組織地運作了！工人們各司其職，效率提升。',
    check: () => {
      const w = GameState.myTerritory.workers;
      return (w['FARMER'] || 0) + (w['WOODCUTTER'] || 0) + (w['MINER'] || 0) > 0;
    },
    reward: () => {
      const node = getPlayerNode();
      if (node) node.prosperity += 10;
      console.log('[里程碑] ⭐ 首次分配工人！繁榮度 +10');
      import('../ui/UIManager').then(({ UIManager }) => UIManager.updateUI());
    }
  },
  {
    id: 'first_dispatch',
    label: '🏆 傭兵團完成了第一個任務！名聲開始在四方傳開。',
    check: () => (GameState.lastDailySummary?.missionsCompleted ?? 0) > 0 &&
                  GameState.totalDays > 1,
    reward: () => {
      GameState.myTerritory.prestige += 10;
      console.log('[里程碑] 🏆 首次完成任務！聲望 +10');
      import('../ui/UIManager').then(({ UIManager }) => UIManager.updateUI());
    }
  },
  {
    id: 'first_invasion_repelled',
    label: '⚔️ 領地的守衛讓敵人知難而退！居民們對您的保護感到安心。',
    check: () => false, // 由 GameLoop 的入侵擊退邏輯主動觸發，此處留空
    reward: () => {
      GameState.myTerritory.prestige += 15;
      console.log('[里程碑] ⚔️ 首次擊退入侵！聲望 +15');
      import('../ui/UIManager').then(({ UIManager }) => UIManager.updateUI());
    }
  },
  {
    id: 'pop_15',
    label: '👥 社群開始成形！人口突破 15 人，大家的笑聲讓這裡更有生氣了。',
    check: () => GameState.myTerritory.population >= 15,
    reward: () => {
      GameState.myTerritory.addGold(50);
      const node = getPlayerNode();
      if (node) node.prosperity += 15;
      console.log('[里程碑] 👥 人口達 15 人！金幣 +50，繁榮度 +15');
      import('../ui/UIManager').then(({ UIManager }) => UIManager.updateUI());
    }
  },
  {
    id: 'pop_30',
    label: '🏘️ 人口突破 30 人！這裡已逐漸有了小聚落的氣息。',
    check: () => GameState.myTerritory.population >= 30,
    reward: () => {
      GameState.myTerritory.addGold(100);
      console.log('[里程碑] 🏘️ 人口達 30 人！金幣 +100');
      import('../ui/UIManager').then(({ UIManager }) => UIManager.updateUI());
    }
  },
  {
    id: 'first_building',
    label: '🏗️ 領地有了第一棟永久建築！這是從荒野走向文明的重要一步。',
    check: () => {
      const t = GameState.myTerritory;
      return (t.getBuildingLevel('tavern') + t.getBuildingLevel('defense') +
              t.getBuildingLevel('weapon') + t.getBuildingLevel('armor') +
              t.getBuildingLevel('forge')) > 0;
    },
    reward: () => {
      const node = getPlayerNode();
      if (node) node.prosperity += 20;
      console.log('[里程碑] 🏗️ 第一棟建築！繁榮度 +20');
      import('../ui/UIManager').then(({ UIManager }) => UIManager.updateUI());
    }
  },
  {
    id: 'camp_reached',
    label: '🏕️ 荒野據點正式晉升為營地！數週的努力沒有白費。',
    check: () => {
      const node = getPlayerNode();
      return node ? node.nodeLevel >= NodeLevel.CAMP : false;
    },
    reward: () => {
      GameState.myTerritory.addGold(100);
      console.log('[里程碑] 🏕️ 升級為營地！金幣 +100');
      import('../ui/UIManager').then(({ UIManager }) => UIManager.updateUI());
    }
  },
];

/**
 * MilestoneSystem — 每日由 GameLoop 呼叫
 */
export class MilestoneSystem {
  /**
   * 檢查所有未達成的里程碑，若觸發則發放獎勵並加入 pendingMilestones
   */
  static checkAll(): void {
    for (const m of MILESTONES) {
      // 已達成過的跳過
      if (GameState.milestones.includes(m.id)) continue;

      // 特殊里程碑（需外部主動觸發）跳過
      if (m.id === 'first_invasion_repelled') continue;

      try {
        if (m.check()) {
          GameState.milestones.push(m.id);
          GameState.pendingMilestones.push(m.label);
          m.reward();
        }
      } catch (_) {
        // 靜默忽略檢查錯誤
      }
    }
  }

  /**
   * 主動觸發特定里程碑（供外部使用，如擊退入侵）
   */
  static trigger(milestoneId: string): void {
    if (GameState.milestones.includes(milestoneId)) return;
    const m = MILESTONES.find(x => x.id === milestoneId);
    if (!m) return;
    GameState.milestones.push(m.id);
    GameState.pendingMilestones.push(m.label);
    m.reward();
  }
}
