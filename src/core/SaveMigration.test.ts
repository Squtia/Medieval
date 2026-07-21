import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_SCHEMA_VERSION, migrateSaveData } from './SaveMigration';

describe('save migration', () => {
  it('upgrades legacy calendar saves without losing their date', () => {
    const migrated = migrateSaveData({ currentYear: 2, currentMonth: 3, currentDay: 4 });

    expect(migrated.schemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(migrated.totalDays).toBe(424);
    expect(migrated.threat).toMatchObject({ daysRemaining: 10, prepared: false });
    expect(migrated.lastDailySummary).toBeNull();
  });

  it('does not overwrite values already present in a current save', () => {
    const current = { schemaVersion: 2, totalDays: 99, threat: { daysRemaining: 2 } };
    expect(migrateSaveData(current)).toEqual(current);
  });
});
