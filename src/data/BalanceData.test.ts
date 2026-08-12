import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_MODIFIERS,
  PROSPERITY_THRESHOLDS,
  calculateNodeLevel,
  getMonthlyProsperityGain
} from './BalanceData';
import { GameDifficulty } from '../models/WorldGeneration';
import { NodeLevel, NobleTitle, TITLE_CONFIG } from '../models/types';
import { getDifficultyConfig } from './DifficultyData';

describe('balance configuration', () => {
  it('uses one monotonic prosperity curve', () => {
    expect(PROSPERITY_THRESHOLDS).toEqual({
      [NodeLevel.WILDERNESS]: 0,
      [NodeLevel.CAMP]: 40,
      [NodeLevel.VILLAGE]: 200,
      [NodeLevel.TOWN]: 1000,
      [NodeLevel.CAPITAL]: 5000
    });
  });

  it('requires a vassal for capital and respects guaranteed starting levels', () => {
    expect(calculateNodeLevel({ prosperity: 121 }, false)).toBe(NodeLevel.CAMP);
    expect(calculateNodeLevel({ prosperity: 4999 }, true)).toBe(NodeLevel.TOWN);
    expect(calculateNodeLevel({ prosperity: 5000 }, false)).toBe(NodeLevel.TOWN);
    expect(calculateNodeLevel({ prosperity: 5000 }, true)).toBe(NodeLevel.CAPITAL);
    expect(calculateNodeLevel({
      prosperity: 0,
      minimumNodeLevel: NodeLevel.VILLAGE
    }, false)).toBe(NodeLevel.VILLAGE);
  });

  it('gives productive workers diminishing prosperity returns', () => {
    expect(getMonthlyProsperityGain(0, 0)).toBe(8);
    expect(getMonthlyProsperityGain(25, 0)).toBe(41);
    expect(getMonthlyProsperityGain(100, 0)).toBe(88);
    expect(getMonthlyProsperityGain(400, 0)).toBe(88);
    expect(getMonthlyProsperityGain(400, 1000)).toBe(128);
    const villageToTownMonths = Math.ceil(
      (PROSPERITY_THRESHOLDS[NodeLevel.TOWN] - PROSPERITY_THRESHOLDS[NodeLevel.VILLAGE]) /
      getMonthlyProsperityGain(30, 0)
    );
    expect(villageToTownMonths).toBeGreaterThanOrEqual(12);
    expect(villageToTownMonths).toBeLessThanOrEqual(18);
  });

  it('keeps difficulty modifiers ordered across the full campaign', () => {
    expect(DIFFICULTY_MODIFIERS[GameDifficulty.EASY].enemyStrength)
      .toBeLessThan(DIFFICULTY_MODIFIERS[GameDifficulty.NORMAL].enemyStrength);
    expect(DIFFICULTY_MODIFIERS[GameDifficulty.HARD].enemyStrength)
      .toBeLessThan(DIFFICULTY_MODIFIERS[GameDifficulty.EXTREME].enemyStrength);
    expect(DIFFICULTY_MODIFIERS[GameDifficulty.EASY].production)
      .toBeGreaterThan(DIFFICULTY_MODIFIERS[GameDifficulty.NORMAL].production);
    expect(DIFFICULTY_MODIFIERS[GameDifficulty.HARD].explorationReward)
      .toBeGreaterThan(DIFFICULTY_MODIFIERS[GameDifficulty.EXTREME].explorationReward);
  });

  it('uses fixed starting tiers and matching title prestige floors', () => {
    expect(getDifficultyConfig(GameDifficulty.HARD).baseNodeLevels).toEqual([NodeLevel.WILDERNESS]);

    const titleRequirements = Object.fromEntries(
      TITLE_CONFIG.map(config => [config.title, config.reqPrestige])
    );
    expect(titleRequirements[NobleTitle.KNIGHT]).toBe(500);
    expect(titleRequirements[NobleTitle.BARON]).toBe(1500);
    expect(titleRequirements[NobleTitle.DUKE]).toBe(35000);
  });
});
