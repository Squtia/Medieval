import { calendarToTotalDays } from './Calendar';

export const CURRENT_SAVE_SCHEMA_VERSION = 5;

export function migrateSaveData(raw: any): any {
  const data = { ...raw };
  const version = Number(data.schemaVersion || 1);

  if (version < 2) {
    data.totalDays = data.totalDays || calendarToTotalDays(
      data.currentYear || 1,
      data.currentMonth || 1,
      data.currentDay || 1
    );
    data.threat = data.threat || {
      name: '凜冬寒流',
      severity: 5,
      daysRemaining: 10,
      warningIssued: false,
      prepared: false
    };
    data.lastDailySummary = data.lastDailySummary || null;
  }
  
  if (version < 3) {
    if (data.adventurers && Array.isArray(data.adventurers)) {
      data.adventurers.forEach((adv: any) => {
        if (adv.isAdvanced === undefined) {
          adv.isAdvanced = false;
        }
      });
    }
  }

  if (version < 4) {
    if (data.adventurers && Array.isArray(data.adventurers)) {
      data.adventurers.forEach((adv: any) => {
        if (!adv.gambits) {
          adv.gambits = [];
        }
      });
    }
  }

  // Version 5: 清洗並遷移歷史幽靈物品 ID 至標準特產/素材
  if (data.myTerritory) {
    const t = data.myTerritory;
    t.materials = t.materials || {};
    t.tradeInventory = t.tradeInventory || {};

    const legacyMap: Record<string, { target: 'trade' | 'mat'; newId: string }> = {
      RAW_HIDE: { target: 'trade', newId: 'tg_hide' },
      GRAIN: { target: 'trade', newId: 'tg_wheat' },
      MEAT: { target: 'trade', newId: 'tg_meat' },
      COTTON: { target: 'trade', newId: 'tg_cotton' },
      STONE: { target: 'mat', newId: 'mat_stone_brick' },
      IRON_ORE: { target: 'mat', newId: 'mat_iron_ingot' },
      WOOD: { target: 'mat', newId: 'mat_wood_plank' }
    };

    for (const [oldId, mapping] of Object.entries(legacyMap)) {
      if (t.materials[oldId]) {
        const count = t.materials[oldId];
        delete t.materials[oldId];
        if (mapping.target === 'trade') {
          t.tradeInventory[mapping.newId] = (t.tradeInventory[mapping.newId] || 0) + count;
        } else {
          t.materials[mapping.newId] = (t.materials[mapping.newId] || 0) + count;
        }
      }
    }
  }

  data.schemaVersion = CURRENT_SAVE_SCHEMA_VERSION;
  return data;
}
