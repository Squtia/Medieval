import { calendarToTotalDays } from './Calendar';

export const CURRENT_SAVE_SCHEMA_VERSION = 4;

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

  data.schemaVersion = CURRENT_SAVE_SCHEMA_VERSION;
  return data;
}
