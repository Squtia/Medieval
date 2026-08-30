import { describe, it, expect } from 'vitest';
import { FactionArmyGenerator } from './FactionArmyGenerator';
import { CustomCombatGroup, CombatGroupRole, MonsterRace } from '../../models/types';
import monstersJson from '../../data/monsters.json';

describe('FactionArmyGenerator - Dynamic Vice-Commander Engine Tests', () => {
  it('1. 正常狀態下，英雄怪物正常生成為原始實體', () => {
    // 取得 bandit 或 iron_guard 作為測試
    const instance = FactionArmyGenerator.resolveTroopMember('bandit', 'f_lothgar');
    expect(instance).toBeDefined();
    expect(instance.name).toContain('流寇');
    expect(instance.name).not.toContain('【代理副將】');
  });

  it('2. 具名英雄若在不可用名單中，且有指定 substituteMonsterId，精確替換為指定副將', () => {
    // 暫時模擬一個帶有 characterKey 與 substituteMonsterId 的定義
    const allDefs: any[] = monstersJson;
    const testHeroMonster = {
      id: 'test_boss_ryan',
      name: '赤焰戰神·雷恩',
      race: MonsterRace.HUMAN,
      compatibleRaces: [MonsterRace.HUMAN],
      terrains: ['PLAINS'],
      powerTier: 2.5,
      attackType: 'MELEE',
      characterKey: 'CHAR_RYAN_TEST',
      substituteMonsterId: 'bandit'
    };
    allDefs.push(testHeroMonster);

    try {
      // 情況 A：未被收編 ➔ 生成雷恩
      const normalInstance = FactionArmyGenerator.resolveTroopMember('test_boss_ryan', 'f_lothgar', new Set());
      expect(normalInstance.name).toContain('赤焰戰神·雷恩');
      expect(normalInstance.name).not.toContain('【代理副將】');

      // 情況 B：已被玩家俘虜/招募 (CHAR_RYAN_TEST 在不可用名單中) ➔ 替換為 bandit (代理副將)
      const unavailable = new Set(['CHAR_RYAN_TEST']);
      const subInstance = FactionArmyGenerator.resolveTroopMember('test_boss_ryan', 'f_lothgar', unavailable);
      expect(subInstance.name).toContain('【代理副將】');
      expect(subInstance.name).toContain('流寇'); // bandit 的名稱
    } finally {
      // 清理測試資料
      const idx = allDefs.findIndex(m => m.id === 'test_boss_ryan');
      if (idx >= 0) allDefs.splice(idx, 1);
    }
  });

  it('3. 具名英雄若未指定 substituteMonsterId，演算法自動依 attackType 挑選最高 powerTier 之人類正規軍', () => {
    const allDefs: any[] = monstersJson;
    const testMageBoss = {
      id: 'test_boss_luna',
      name: '霜語大魔導·露娜',
      race: MonsterRace.HUMAN,
      compatibleRaces: [MonsterRace.HUMAN],
      terrains: ['SNOW_MOUNTAIN'],
      powerTier: 2.5,
      attackType: 'MAGIC',
      characterKey: 'CHAR_LUNA_TEST'
      // 未指定 substituteMonsterId
    };
    allDefs.push(testMageBoss);

    try {
      const unavailable = new Set(['CHAR_LUNA_TEST']);
      const subInstance = FactionArmyGenerator.resolveTroopMember('test_boss_luna', 'f_hurst', unavailable);
      
      expect(subInstance.name).toContain('【代理副將】');
      // 魔法攻擊型態的人類最高階為 faction_mage (皇家宮廷法師, powerTier 1.5)
      expect(subInstance.name).toContain('皇家宮廷法師');
    } finally {
      const idx = allDefs.findIndex(m => m.id === 'test_boss_luna');
      if (idx >= 0) allDefs.splice(idx, 1);
    }
  });

  it('4. instantiateCombatGroup 實體化部隊時，工坊原始藍圖陣列保持唯讀隔離', () => {
    const group: CustomCombatGroup = {
      id: 'group_test_01',
      name: '王國近衛主力軍團',
      description: '測試部隊',
      role: CombatGroupRole.VERSATILE,
      monsterIds: ['bandit', 'wild_wolf']
    };

    const instances = FactionArmyGenerator.instantiateCombatGroup(group, 'f_lothgar');
    expect(instances.length).toBe(2);
    expect(group.monsterIds).toEqual(['bandit', 'wild_wolf']); // 原藍圖 100% 不變
  });
});
