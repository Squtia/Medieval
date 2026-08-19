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

  it('does not overwrite values already present in a current save, but upgrades schema version', () => {
    const current = { schemaVersion: CURRENT_SAVE_SCHEMA_VERSION, totalDays: 99, threat: { daysRemaining: 2 } };
    expect(migrateSaveData(current)).toEqual(current);
  });

  it('migrates legacy uppercase material IDs to valid trade goods and crafting materials', () => {
    const raw = {
      schemaVersion: 1,
      myTerritory: {
        materials: {
          RAW_HIDE: 3,
          GRAIN: 5,
          STONE: 4,
          mat_iron_ingot: 2
        },
        tradeInventory: {}
      }
    };
    const migrated = migrateSaveData(raw);
    expect(migrated.myTerritory.materials['RAW_HIDE']).toBeUndefined();
    expect(migrated.myTerritory.tradeInventory['tg_hide']).toBe(3);
    expect(migrated.myTerritory.tradeInventory['tg_wheat']).toBe(5);
    expect(migrated.myTerritory.materials['mat_stone_brick']).toBe(4);
    expect(migrated.myTerritory.materials['mat_iron_ingot']).toBe(2);
  });
});
