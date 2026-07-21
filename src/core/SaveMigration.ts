import { calendarToTotalDays } from './Calendar';

export const CURRENT_SAVE_SCHEMA_VERSION = 2;

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
    data.schemaVersion = CURRENT_SAVE_SCHEMA_VERSION;
  }

  return data;
}
