import { describe, it, expect } from 'vitest';
import { LordCommanderSystem } from './LordCommanderSystem';
import { NobleTitle } from '../../models/types';
import { CombatSystem } from '../CombatSystem';
import { GameState } from '../../core/GameState';
import { Adventurer } from '../../models/Adventurer';
import { DataStore } from '../DataStore';
import { CombatEventType } from '../../models/Combat';

describe('領主親征與軍令指揮中樞系統測試 (LordCommanderSystem Tests)', () => {
  it('1. 領主光環 (Lord\'s Aura) 依爵位正確提供全隊攻防、減傷、暴擊與每回合 MP 恢復', () => {
    // 平民
    const commonerAura = LordCommanderSystem.getLordAura(NobleTitle.COMMONER);
    expect(commonerAura.statBonusPct).toBe(0.10);
    expect(commonerAura.mpRegenPerTurn).toBe(2);
    expect(commonerAura.dmgReductionPct).toBe(0);

    // 騎士
    const knightAura = LordCommanderSystem.getLordAura(NobleTitle.KNIGHT);
    expect(knightAura.dmgReductionPct).toBe(0.05);

    // 男爵
    const baronAura = LordCommanderSystem.getLordAura(NobleTitle.BARON);
    expect(baronAura.statBonusPct).toBe(0.12);
    expect(baronAura.critBonusPct).toBe(5);

    // 公爵
    const dukeAura = LordCommanderSystem.getLordAura(NobleTitle.DUKE);
    expect(dukeAura.statBonusPct).toBe(0.20);
    expect(dukeAura.mpRegenPerTurn).toBe(5);
    expect(dukeAura.dmgReductionPct).toBe(0.15);
    expect(dukeAura.critBonusPct).toBe(15);
  });

  it('2. 步兵【鋼鐵盾牆】軍令計算護盾值與前排格擋加成', () => {
    const emptyWall = LordCommanderSystem.calculateShieldWall(0);
    expect(emptyWall.shieldHp).toBe(0);
    expect(emptyWall.blockChanceBonus).toBe(0);

    const activeWall = LordCommanderSystem.calculateShieldWall(50);
    expect(activeWall.shieldHp).toBe(3000); // 50 * 60
    expect(activeWall.blockChanceBonus).toBe(30);
  });

  it('3. 弓兵【漫天箭雨】與騎兵【破陣衝鋒】計算傷害與控制機率', () => {
    // 弓兵箭雨
    const zeroArchers = LordCommanderSystem.calculateVolleyFire(0);
    expect(zeroArchers).toBe(0);

    const volleyDmg = LordCommanderSystem.calculateVolleyFire(36);
    expect(volleyDmg).toBe(Math.floor(6 * 32)); // 192

    // 騎兵衝鋒
    const zeroCav = LordCommanderSystem.calculateCavalryCharge(0);
    expect(zeroCav.damage).toBe(0);
    expect(zeroCav.stunChance).toBe(0);

    const chargeResult = LordCommanderSystem.calculateCavalryCharge(16);
    expect(chargeResult.damage).toBe(Math.floor(4 * 45)); // 180
    // 全軍鼓舞
    const inspireResult = LordCommanderSystem.calculateInspireRally();
    expect(inspireResult.dmgBonusPct).toBe(15);
    expect(inspireResult.critBonusPct).toBe(10);
  });

  it('4. 戰鬥模擬 (CombatSystem) 在領主親征模式下正確寫入光環事件、回合起訖事件與軍令戰術事件', () => {
    const hero = new Adventurer(
      'adv_hero_1',
      '亞瑟領主',
      DataStore.getRandomJob(),
      DataStore.getRandomRecruitTrait(),
      'SSR',
      'MALE' as any,
      false
    );
    hero.level = 10;
    GameState.adventurers = [hero];

    const report = CombatSystem.simulateCombat(
      [hero.id],
      5,
      '測試戰役',
      undefined,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        isSiege: false,
        isLordCampaign: true,
        lordTitle: NobleTitle.BARON,
        assignedTroops: {
          infantry: 20,
          archer: 15,
          cavalry: 10
        },
        gateHp: 0
      }
    );

    expect(report.isLordCampaign).toBe(true);
    expect(report.lordAura).toBeDefined();
    expect(report.lordAura?.name).toContain('領主威嚴');
    expect(report.commanderTroops?.infantry).toBe(20);

    // 驗證是否有寫入光環啟動事件
    const auraEvent = report.events.find(e => e.type === CombatEventType.LORD_AURA_TRIGGER);
    expect(auraEvent).toBeDefined();
    expect(auraEvent?.text).toContain('領主親征光環啟動');

    // 驗證是否有寫入回合起訖事件 (供回合制指揮暫停)
    const turnStartEvent = report.events.find(e => e.type === CombatEventType.TURN_START);
    expect(turnStartEvent).toBeDefined();
    expect(turnStartEvent?.turn).toBe(1);

    const turnEndEvent = report.events.find(e => e.type === CombatEventType.TURN_END);
    expect(turnEndEvent).toBeDefined();

    // 驗證是否有觸發步兵鋼鐵盾牆事件
    const shieldWallEvent = report.events.find(e => e.type === CombatEventType.COMMANDER_SHIELD_WALL);
    expect(shieldWallEvent).toBeDefined();
    expect(shieldWallEvent?.text).toContain('鋼鐵盾牆');
  });
});
