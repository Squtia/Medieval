import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../core/GameState';
import { Territory } from '../models/Territory';
import { Adventurer } from '../models/Adventurer';
import { JobConfig, TraitConfig, Gender, WorkerJob } from '../models/types';
import { ChurchSystem } from './ChurchSystem';
import { TownManagementSystem } from './TownManagementSystem';
import { CombatSystem } from './CombatSystem';

describe('⛪ 教會醫療所、持久 HP/MP 與傷病急救全鏈路測試 (Church & Persistent Health Tests)', () => {
  let territory: Territory;
  let warrior: Adventurer;
  let cleric: Adventurer;

  const mockJob: JobConfig = {
    name: '戰士',
    baseAttributes: { str: 15, agi: 10, con: 14, int: 5, spr: 5, luk: 5, charm: 5, command: 5 },
    growthRates: { str: 3, agi: 1, con: 2, int: 0, spr: 0, luk: 1, charm: 0, command: 0 }
  };

  const prayerJob: JobConfig = {
    name: '祈禱者',
    baseAttributes: { str: 5, agi: 8, con: 10, int: 12, spr: 15, luk: 5, charm: 8, command: 5 },
    growthRates: { str: 0, agi: 1, con: 1, int: 2, spr: 3, luk: 1, charm: 1, command: 0 }
  };

  const mockTrait: TraitConfig = {
    id: 'brave',
    name: '勇敢',
    xpModifier: 1.0,
    statMultipliers: { str: 0.1 }
  };

  beforeEach(() => {
    territory = new Territory('測試領地');
    GameState.myTerritory = territory;
    GameState.retiredAdventurers = [];
    GameState.totalDays = 1;

    warrior = new Adventurer('adv_warrior', '亞瑟', mockJob, mockTrait, 'R', Gender.MALE);
    cleric = new Adventurer('adv_cleric', '艾蓮娜', prayerJob, mockTrait, 'R', Gender.FEMALE);
    GameState.adventurers = [warrior, cleric];
  });

  it('1. 冒險者持久 HP/MP 存取與單一真相來源保護', () => {
    const stats = warrior.getCombatStats();
    expect(warrior.getCurrentHp()).toBe(stats.hp);
    expect(warrior.getCurrentMp()).toBe(stats.mp);

    // 受到傷害
    warrior.setCurrentHp(50);
    expect(warrior.getCurrentHp()).toBe(50);

    // 防溢出測試 (治療 1000 點)
    warrior.heal(1000, 100);
    expect(warrior.getCurrentHp()).toBe(stats.hp);
    expect(warrior.getCurrentMp()).toBe(stats.mp);
  });

  it('2. 重傷瀕死 (applyWound) 機制與屬性懲罰', () => {
    const originalStats = warrior.getCombatStats();
    expect(warrior.isWounded).toBe(false);

    // 戰敗陣亡
    warrior.applyWound();
    expect(warrior.isWounded).toBe(true);
    expect(warrior.getCurrentHp()).toBe(1);
    expect(warrior.getCurrentMp()).toBe(0);

    // 檢查屬性懲罰 (-20% 攻防, -30% 速度)
    const woundedStats = warrior.getCombatStats();
    expect(woundedStats.patk).toBe(Math.max(1, Math.floor(originalStats.patk * 0.8)));
    expect(woundedStats.pdef).toBe(Math.max(1, Math.floor(originalStats.pdef * 0.8)));
    expect(woundedStats.speed).toBe(Math.max(1, Math.floor(originalStats.speed * 0.7)));

    // 治療至 79% (未達 80%) ➔ 重傷依然存在
    warrior.setCurrentHp(Math.floor(originalStats.hp * 0.75));
    expect(warrior.isWounded).toBe(true);

    // 治療至 80% 以上 ➔ 自動痊癒
    warrior.setCurrentHp(Math.floor(originalStats.hp * 0.85));
    expect(warrior.isWounded).toBe(false);
  });

  it('3. 教會擴建與病床打造上限階梯', () => {
    territory.gold = 5000;
    territory.wood = 2000;
    territory.stone = 1000;
    territory.materials = { 'mat_wood_plank': 200, 'mat_leather': 100 };

    // Lv.0 無法造床
    expect(territory.getMaxInfirmaryBeds()).toBe(0);
    const res0 = ChurchSystem.buildBed(territory);
    expect(res0.success).toBe(false);

    // 升級至 Lv.1 祈禱處 ➔ 贈送 1 床，上限 4 床
    const upRes1 = ChurchSystem.upgradeChurch(territory);
    expect(upRes1.success).toBe(true);
    expect(territory.churchLevel).toBe(1);
    expect(territory.getMaxInfirmaryBeds()).toBe(4);
    expect(territory.infirmaryBeds.length).toBe(1);

    // 打造至上限 (造 3 床，共 4 床)
    ChurchSystem.buildBed(territory);
    ChurchSystem.buildBed(territory);
    ChurchSystem.buildBed(territory);
    expect(territory.infirmaryBeds.length).toBe(4);

    // 超出上限阻斷
    const overRes = ChurchSystem.buildBed(territory);
    expect(overRes.success).toBe(false);
  });

  it('4. 傷員指派病床與過夜休養自然回血加成', () => {
    territory.churchLevel = 1; // 基礎自然回血 15%
    territory.infirmaryBeds = [{ id: 'bed_1', isOccupied: false }];

    warrior.setCurrentHp(10);
    cleric.setCurrentHp(10);

    // 將 warrior 指派躺床 (額外 +10%，共 25%)
    ChurchSystem.assignPatient('bed_1', warrior.id, territory);
    expect(warrior.inInfirmaryBed).toBe(true);
    expect(cleric.inInfirmaryBed).toBe(false);

    // 推進過夜
    TownManagementSystem.resolveDailyResources();

    // warrior 回血率應明顯高於未躺床的 cleric
    const warriorHpGained = warrior.getCurrentHp() - 10;
    const clericHpGained = cleric.getCurrentHp() - 10;

    const warriorMax = warrior.getCombatStats().hp;
    const clericMax = cleric.getCombatStats().hp;

    const warriorRate = warriorHpGained / warriorMax;
    const clericRate = clericHpGained / clericMax;

    expect(warriorRate).toBeGreaterThan(clericRate);
  });

  it('5. 伐木工副產藥草、熬製生命藥水與病床急救全閉環', () => {
    territory.wood = 500;
    territory.materials = { 'tg_Medicinal_herbs': 120 }; // 120 株藥草
    territory.infirmaryBeds = [{ id: 'bed_1', adventurerId: warrior.id, isOccupied: true }];
    warrior.inInfirmaryBed = true;
    warrior.applyWound(); // 重傷 1 HP

    // 熬製 2 瓶藥水 (消耗 100 藥草)
    const brewRes = ChurchSystem.brewHealingPotion(2, territory);
    expect(brewRes.success).toBe(true);
    expect(territory.materials['tg_Medicinal_herbs']).toBe(20);
    expect(territory.materials['item_healing_potion_s']).toBe(2);

    // 使用 1 瓶藥水急救
    const treatRes = ChurchSystem.treatWithPotion(warrior.id, territory, 'bed_1');
    expect(treatRes.success).toBe(true);
    expect(territory.materials['item_healing_potion_s']).toBe(1);
    expect(warrior.getCurrentHp()).toBeGreaterThan(1);
  });

  it('6. 退休祈禱者提供全領地被動自然回血與藥水加成', () => {
    // 退休 2 位祈禱者
    const retiredCleric1 = new Adventurer('ret_1', '老修女瑪麗', prayerJob, mockTrait, 'R');
    const retiredCleric2 = new Adventurer('ret_2', '老神官約翰', prayerJob, mockTrait, 'R');
    GameState.retiredAdventurers = [retiredCleric1, retiredCleric2];

    const bonus = ChurchSystem.getRetiredPrayersBonus();
    expect(bonus.prayerCount).toBe(2);
    expect(bonus.recoveryBonusPct).toBe(0.01); // +1%
    expect(bonus.potionBonusPct).toBe(0.01); // +1%
  });
});
