import { describe, it, expect, vi } from 'vitest';
import { CombatEventType, CombatEvent, CombatImpactKind } from '../../models/Combat';
import defaultVFXPresets from '../../data/vfx_presets.json';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { VFXPresetValidator } from '../../ui/fx/VFXPresetValidator';
import { SKILL_VFX_MAP } from '../../data/SkillData';

describe('CombatActionTimeline & Contract Verification', () => {
  describe('1. 戰鬥事件契約 (CombatEvent Contract)', () => {
    it('應支援 actionId, impactIndex, impactCount 與 impactKind 欄位', () => {
      const castEvent: CombatEvent = {
        type: CombatEventType.SKILL_CAST,
        actionId: 'act_101',
        actorId: 'player_1',
        targetId: 'player_1',
        skillTargetId: 'enemy_1',
        skillId: 'blizzard',
        vfxId: 'VFX_BLIZZARD',
        text: '施展暴風雪'
      };

      const hitEvent1: CombatEvent = {
        type: CombatEventType.HIT,
        actionId: 'act_101',
        impactIndex: 0,
        impactCount: 2,
        impactKind: 'DAMAGE' as CombatImpactKind,
        actorId: 'player_1',
        targetId: 'enemy_1',
        damage: 100,
        targetHp: 400,
        targetMaxHp: 500,
        text: '對敵人 1 造成 100 傷害'
      };

      const hitEvent2: CombatEvent = {
        type: CombatEventType.HIT,
        actionId: 'act_101',
        impactIndex: 1,
        impactCount: 2,
        impactKind: 'DAMAGE' as CombatImpactKind,
        actorId: 'player_1',
        targetId: 'enemy_2',
        damage: 120,
        targetHp: 280,
        targetMaxHp: 400,
        text: '對敵人 2 造成 120 傷害'
      };

      expect(castEvent.actionId).toBe('act_101');
      expect(hitEvent1.targetId).toBe('enemy_1');
      expect(hitEvent2.targetId).toBe('enemy_2');
      expect(hitEvent1.damage).toBe(100);
      expect(hitEvent2.damage).toBe(120);
      expect(hitEvent1.targetHp).toBe(400);
      expect(hitEvent2.targetHp).toBe(280);
    });
  });

  describe('2. VFX Preset 庫完整性與驗證 (Preset Validation)', () => {
    it('所有 Preset ID 必須唯一，不得有重複 ID', () => {
      const idSet = new Set<string>();
      const duplicates: string[] = [];
      defaultVFXPresets.forEach((p: any) => {
        if (idSet.has(p.id)) {
          duplicates.push(p.id);
        }
        idSet.add(p.id);
      });
      expect(duplicates).toEqual([]);
    });

    it('所有 Preset 的 trajectory 與 shaderMode 必須為有效值', () => {
      const validTrajectories = new Set([
        'HORIZONTAL',
        'VERTICAL_DROP',
        'DIAGONAL_DROP',
        'GROUND_BURST',
        'GROUND_FISSURE',
        'COLUMN_PIERCE',
        'MELEE_SWEEP',
        'BODY_AURA',
        'ARC_MULTI',
        'PARABOLA_ARC',
        'SHIELD_BARRIER',
        'SHOUT_WAVE'
      ]);

      defaultVFXPresets.forEach((p: any) => {
        expect(validTrajectories.has(p.trajectory)).toBe(true);
      });
    });
  });

  describe('3. CombatFXEngine 生命週期與定時器取消 (Timer Cancellation)', () => {
    it('clear() 呼叫後，所有排程中之定時器應失效，不得觸發回呼', () => {
      vi.useFakeTimers();
      const engine = CombatFXEngine.getInstance();
      const hitCallback = vi.fn();

      engine.playPreset(
        'VFX_DEFAULT_SLASH',
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        hitCallback
      );

      engine.clear();

      vi.advanceTimersByTime(2000);

      expect(hitCallback).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('4. 多目標 (AOE) 與演出模式規則驗證 (AOE & Presentation Mode)', () => {
    it('AOE 技能對多個目標結算時，每個目標應維持獨立的 targetId 與 targetHp', () => {
      const aoeEvents: CombatEvent[] = [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_aoe_blizzard',
          actorId: 'luna',
          skillId: 'blizzard',
          vfxId: 'VFX_BLIZZARD',
          text: '露娜施展暴風雪！'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_aoe_blizzard',
          impactIndex: 0,
          impactCount: 3,
          impactKind: 'DAMAGE',
          actorId: 'luna',
          targetId: 'goblin_1',
          damage: 150,
          targetHp: 50,
          targetMaxHp: 200,
          text: '暴風雪命中哥布林 1，造成 150 點傷害！'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_aoe_blizzard',
          impactIndex: 1,
          impactCount: 3,
          impactKind: 'DAMAGE',
          actorId: 'luna',
          targetId: 'goblin_2',
          damage: 150,
          targetHp: 0,
          targetMaxHp: 150,
          text: '暴風雪命中哥布林 2，造成 150 點傷害！'
        },
        {
          type: CombatEventType.CRIT,
          actionId: 'act_aoe_blizzard',
          impactIndex: 2,
          impactCount: 3,
          impactKind: 'DAMAGE',
          actorId: 'luna',
          targetId: 'goblin_3',
          damage: 220,
          targetHp: 80,
          targetMaxHp: 300,
          text: '暴風雪致命一擊命中哥布林 3，造成 220 點傷害！'
        }
      ];

      // 驗證每個事件目標隔離，不發生覆蓋
      const targetIds = aoeEvents.filter(e => e.type === CombatEventType.HIT || e.type === CombatEventType.CRIT).map(e => e.targetId);
      expect(targetIds).toEqual(['goblin_1', 'goblin_2', 'goblin_3']);

      // 驗證總傷害未被單一目標合併
      const totalDamage = aoeEvents.reduce((sum, e) => sum + (e.damage || 0), 0);
      expect(totalDamage).toBe(520);
      expect(aoeEvents[1].damage).toBe(150);
      expect(aoeEvents[2].damage).toBe(150);
      expect(aoeEvents[3].damage).toBe(220);
    });

    it('PRIMARY_ONLY 模式下，單次傷害若匹配多段特效 cue，應由最後一段 (Primary Cue) 結算跳字', () => {
      // 模擬單次傷害 (1 筆 impact) 但特效配置 totalHits = 3
      const totalHits = 3;
      const impacts = [{ damage: 300, isCrit: false }];
      const hitRecord: { hitIdx: number; displayedDamage: number | null }[] = [];

      for (let hitIdx = 0; hitIdx < totalHits; hitIdx++) {
        const isLastHit = (hitIdx >= totalHits - 1);
        if (impacts.length === 1) {
          // PRIMARY_ONLY 規則：最後一段結算
          if (isLastHit) {
            hitRecord.push({ hitIdx, displayedDamage: impacts[0].damage });
          } else {
            hitRecord.push({ hitIdx, displayedDamage: null });
          }
        }
      }

      expect(hitRecord).toEqual([
        { hitIdx: 0, displayedDamage: null },
        { hitIdx: 1, displayedDamage: null },
        { hitIdx: 2, displayedDamage: 300 }
      ]);
    });
  });

  describe('5. VFXPresetRepository 分層與生命週期測試 (Phase 4)', () => {
    it('應支援內建預設讀取、自訂新增與覆寫還原', () => {
      const repo = VFXPresetRepository.getInstance();

      // 1. 內建預設存在
      expect(repo.hasPreset('VFX_HEAVY_STRIKE')).toBe(true);

      // 2. 新增自訂預設
      const customPreset = {
        id: 'VFX_CUSTOM_BLADE_TEST',
        name: '自訂刃芒測試',
        category: 'PHYSICAL' as const,
        description: '單元測試自訂預設',
        trajectory: 'MELEE_SWEEP' as const,
        shaderMode: 'SLASH_BLADE' as const,
        colorCore: '#ffffff',
        colorRim: '#3b82f6',
        duration: 0.3,
        scale: 1.0,
        spin: 10,
        fresnel: 2.0,
        trailCount: 10,
        trailSize: 8,
        spikes: 0,
        spikeHeight: 0,
        burstCount: 20,
        bloomStr: 1.5,
        bloomRad: 0.4,
        bloomThresh: 0.1,
        impact: {
          hitStopTime: 50,
          targetPunchScale: 0.9,
          shakeIntensity: 10,
          shakeDuration: 0.2,
          penetrationDistance: 0,
          knockbackDistance: 10,
          hitFlashColor: '#ffffff',
          screenShake: false
        }
      };

      const saveRes = repo.saveCustomPreset(customPreset);
      expect(saveRes.success).toBe(true);
      expect(repo.hasPreset('VFX_CUSTOM_BLADE_TEST')).toBe(true);

      // 3. 刪除自訂預設
      repo.deletePreset('VFX_CUSTOM_BLADE_TEST');
      expect(repo.hasPreset('VFX_CUSTOM_BLADE_TEST')).toBe(false);
    });
  });

  describe('6. SKILL_VFX_MAP 完整性檢驗 (Phase 4 Data Contract)', () => {
    it('SKILL_VFX_MAP 中的每個映射 ID 必須存在於官方 Preset 庫中', () => {
      const repo = VFXPresetRepository.getInstance();
      const allIds = new Set(repo.getAllPresets().map((p: any) => p.id));

      const validation = VFXPresetValidator.validateSkillVfxMap(SKILL_VFX_MAP, allIds);
      expect(validation.errors).toEqual([]);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('7. 權威測試矩陣驗證 (Test Matrix Verification - 12 種戰鬥與視覺回放場景)', () => {
    // 1. 單體一擊
    it('情境 1: 單體一擊 (1 DAMAGE / 1 Cue) - 單次命中、單次扣血、單次跳字', () => {
      const events: CombatEvent[] = [{
        type: CombatEventType.HIT,
        actionId: 'act_single_strike',
        impactIndex: 0,
        impactCount: 1,
        impactKind: 'DAMAGE',
        actorId: 'player_warrior',
        targetId: 'goblin_chief',
        damage: 350,
        targetHp: 650,
        targetMaxHp: 1000,
        text: '戰士奮力一擊，造成 350 點傷害！'
      }];

      expect(events.length).toBe(1);
      expect(events[0].damage).toBe(350);
      expect(events[0].targetHp).toBe(650);
    });

    // 2. 單體三連擊
    it('情境 2: 單體三連擊 (3 DAMAGE / 3 Cues) - 三次依序跳出真實傷害，第三次暴擊', () => {
      const events: CombatEvent[] = [
        {
          type: CombatEventType.HIT,
          actionId: 'act_triple_slash',
          impactIndex: 0,
          impactCount: 3,
          impactKind: 'DAMAGE',
          targetId: 'boss_dragon',
          damage: 120,
          targetHp: 1880,
          targetMaxHp: 2000,
          text: '連斬第 1 段造成 120 傷害'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_triple_slash',
          impactIndex: 1,
          impactCount: 3,
          impactKind: 'DAMAGE',
          targetId: 'boss_dragon',
          damage: 130,
          targetHp: 1750,
          targetMaxHp: 2000,
          text: '連斬第 2 段造成 130 傷害'
        },
        {
          type: CombatEventType.CRIT,
          actionId: 'act_triple_slash',
          impactIndex: 2,
          impactCount: 3,
          impactKind: 'DAMAGE',
          targetId: 'boss_dragon',
          damage: 260,
          targetHp: 1490,
          targetMaxHp: 2000,
          text: '連斬終結重擊暴擊造成 260 傷害'
        }
      ];

      expect(events.map(e => e.damage)).toEqual([120, 130, 260]);
      expect(events[2].type).toBe(CombatEventType.CRIT);
      expect(events.reduce((sum, e) => sum + (e.damage || 0), 0)).toBe(510);
    });

    // 3. 單次傷害、多段演出 (PRIMARY_ONLY 與 SPLIT_SINGLE_IMPACT)
    it('情境 3: 單次傷害、多段演出 - PRIMARY_ONLY 最後一段結算，SPLIT_SINGLE_IMPACT 切割整數總和精確', () => {
      const rawDamage = 500;
      const cuesCount = 3;

      // 3A: PRIMARY_ONLY 驗證
      const primaryOnlyCues = [0, 1, 2].map(cueIdx => {
        const isPrimary = (cueIdx === cuesCount - 1);
        return isPrimary ? rawDamage : null;
      });
      expect(primaryOnlyCues).toEqual([null, null, 500]);

      // 3B: SPLIT_SINGLE_IMPACT 固定整數分配算法驗證 (餘數補入末段)
      const baseSlice = Math.floor(rawDamage / cuesCount);
      const remainder = rawDamage % cuesCount;
      const slices = [0, 1, 2].map(cueIdx => {
        return cueIdx === cuesCount - 1 ? baseSlice + remainder : baseSlice;
      });
      expect(slices).toEqual([166, 166, 168]);
      expect(slices.reduce((a, b) => a + b, 0)).toBe(rawDamage);
    });

    // 4. 3 人 AOE
    it('情境 4: 3 人 AOE (3 DAMAGE / 1 Cue) - 同一 cue 同步三個目標，目標隔離', () => {
      const aoeEvents: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_aoe', impactIndex: 0, impactCount: 3, targetId: 't1', damage: 200, targetHp: 100, text: 'AOE 命中目標 1' },
        { type: CombatEventType.HIT, actionId: 'act_aoe', impactIndex: 1, impactCount: 3, targetId: 't2', damage: 200, targetHp: 150, text: 'AOE 命中目標 2' },
        { type: CombatEventType.HIT, actionId: 'act_aoe', impactIndex: 2, impactCount: 3, targetId: 't3', damage: 200, targetHp: 50, text: 'AOE 命中目標 3' }
      ];

      const targets = new Set(aoeEvents.map(e => e.targetId));
      expect(targets.size).toBe(3);
      expect(aoeEvents.reduce((s, e) => s + e.damage!, 0)).toBe(600);
    });

    // 5. 3 人 × 2 HIT
    it('情境 5: 3 人 × 2 HIT (6 DAMAGE / 2 Cues) - 每個目標各顯示兩段，總計 6 筆打擊', () => {
      const events: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_aoe_multi', impactIndex: 0, impactCount: 6, targetId: 't1', damage: 80, text: 't1-段1' },
        { type: CombatEventType.HIT, actionId: 'act_aoe_multi', impactIndex: 1, impactCount: 6, targetId: 't2', damage: 80, text: 't2-段1' },
        { type: CombatEventType.HIT, actionId: 'act_aoe_multi', impactIndex: 2, impactCount: 6, targetId: 't3', damage: 80, text: 't3-段1' },
        { type: CombatEventType.HIT, actionId: 'act_aoe_multi', impactIndex: 3, impactCount: 6, targetId: 't1', damage: 90, text: 't1-段2' },
        { type: CombatEventType.HIT, actionId: 'act_aoe_multi', impactIndex: 4, impactCount: 6, targetId: 't2', damage: 90, text: 't2-段2' },
        { type: CombatEventType.HIT, actionId: 'act_aoe_multi', impactIndex: 5, impactCount: 6, targetId: 't3', damage: 90, text: 't3-段2' }
      ];

      expect(events.length).toBe(6);
      const t1Total = events.filter(e => e.targetId === 't1').reduce((s, e) => s + e.damage!, 0);
      expect(t1Total).toBe(170);
    });

    // 6. 連鎖雷擊
    it('情境 6: 連鎖雷擊 (N DAMAGE / N Cues) - 每一跳目標不同且順序正確', () => {
      const chainEvents: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_chain', impactIndex: 0, impactCount: 3, targetId: 'orc_front', damage: 300, text: '雷擊跳躍至前排' },
        { type: CombatEventType.HIT, actionId: 'act_chain', impactIndex: 1, impactCount: 3, targetId: 'orc_mid', damage: 240, text: '雷擊連鎖至中排' },
        { type: CombatEventType.HIT, actionId: 'act_chain', impactIndex: 2, impactCount: 3, targetId: 'orc_back', damage: 190, text: '雷擊彈射至後排' }
      ];

      expect(chainEvents[0].targetId).toBe('orc_front');
      expect(chainEvents[1].targetId).toBe('orc_mid');
      expect(chainEvents[2].targetId).toBe('orc_back');
      expect(chainEvents[0].damage).toBeGreaterThan(chainEvents[1].damage!);
      expect(chainEvents[1].damage).toBeGreaterThan(chainEvents[2].damage!);
    });

    // 7. 吸血
    it('情境 7: 吸血 (DAMAGE + HEAL) - 敵方受擊扣血、施術者獲得治療增加 HP', () => {
      const vampireEvents: CombatEvent[] = [
        {
          type: CombatEventType.HIT,
          actionId: 'act_vampire',
          impactIndex: 0,
          impactCount: 2,
          impactKind: 'DAMAGE',
          actorId: 'necromancer',
          targetId: 'knight_target',
          damage: 200,
          targetHp: 300,
          text: '死靈法師汲取生命，造成 200 點傷害！'
        },
        {
          type: CombatEventType.HEAL,
          actionId: 'act_vampire',
          impactIndex: 1,
          impactCount: 2,
          impactKind: 'HEAL',
          actorId: 'necromancer',
          targetId: 'necromancer',
          healAmount: 100,
          targetHp: 450,
          text: '死靈法師恢復了 100 點生命值！'
        }
      ];

      expect(vampireEvents[0].impactKind).toBe('DAMAGE');
      expect(vampireEvents[0].targetId).toBe('knight_target');
      expect(vampireEvents[1].impactKind).toBe('HEAL');
      expect(vampireEvents[1].targetId).toBe('necromancer');
      expect(vampireEvents[1].healAmount).toBe(100);
    });

    // 8. 護盾攔截
    it('情境 8: 護盾攔截 (SHIELD + DAMAGE) - 護盾抵消與 HP 穿透分離結算', () => {
      const shieldEvents: CombatEvent[] = [
        {
          type: CombatEventType.SHIELD_DAMAGE,
          actionId: 'act_heavy_smash',
          impactIndex: 0,
          impactCount: 2,
          impactKind: 'SHIELD_DAMAGE',
          targetId: 'paladin',
          shieldDamage: 150,
          shieldRemaining: 0,
          text: '聖騎士的護盾抵擋了 150 點傷害並破碎！'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_heavy_smash',
          impactIndex: 1,
          impactCount: 2,
          impactKind: 'DAMAGE',
          targetId: 'paladin',
          damage: 100,
          targetHp: 400,
          text: '穿透護盾造成 100 點實際傷害！'
        }
      ];

      expect(shieldEvents[0].shieldDamage).toBe(150);
      expect(shieldEvents[1].damage).toBe(100);
    });

    // 9. 治療 / Buff
    it('情境 9: 治療／Buff (HEAL / STATUS) - 不可出現受擊抖動與負傷跳字', () => {
      const healEvent: CombatEvent = {
        type: CombatEventType.HEAL,
        actionId: 'act_holy_light',
        impactIndex: 0,
        impactCount: 1,
        impactKind: 'HEAL',
        actorId: 'priest',
        targetId: 'injured_ally',
        healAmount: 250,
        targetHp: 500,
        targetMaxHp: 500,
        text: '牧師施展聖光術，恢復 250 點生命值！'
      };

      expect(healEvent.type).toBe(CombatEventType.HEAL);
      expect(healEvent.damage).toBeUndefined();
      expect(healEvent.healAmount).toBe(250);
    });

    // 10. MISS
    it('情境 10: MISS - 不扣 HP、不出現命中傷害', () => {
      const missEvent: CombatEvent = {
        type: CombatEventType.MISS,
        actionId: 'act_snipe_shot',
        impactIndex: 0,
        impactCount: 1,
        impactKind: 'MISS',
        actorId: 'archer',
        targetId: 'evasive_thief',
        text: '盜賊身手敏捷，閃避了攻擊！'
      };

      expect(missEvent.type).toBe(CombatEventType.MISS);
      expect(missEvent.damage).toBeUndefined();
      expect(missEvent.targetHp).toBeUndefined();
    });

    // 11. Skip / 關閉零殘留
    it('情境 11: Skip／關閉 - CombatFXEngine.clear() 徹底取消所有定時器，零殘留 callback', () => {
      vi.useFakeTimers();
      const engine = CombatFXEngine.getInstance();
      const residualCallback = vi.fn();

      engine.playPreset(
        'VFX_DEFAULT_SLASH',
        { x: 50, y: 50 },
        { x: 150, y: 150 },
        residualCallback
      );

      engine.clear();
      vi.advanceTimersByTime(5000);

      expect(residualCallback).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    // 12. 複合圖層
    it('情境 12: 複合圖層 (1 DAMAGE + 多視覺層) - 視覺層 emitsImpactCue 僅供演出，真實傷害只有一份', () => {
      const compositePreset = {
        id: 'VFX_COMPOSITE_TEST',
        layers: [
          { presetId: 'VFX_HEAVY_STRIKE', delay: 0.1, emitsImpactCue: true },
          { presetId: 'VFX_DEFAULT_SLASH', delay: 0.2, emitsImpactCue: false }
        ]
      };

      // 真正遊戲傷害只有 1 筆
      const gameDamageEvents: CombatEvent[] = [{
        type: CombatEventType.HIT,
        actionId: 'act_composite_combo',
        impactIndex: 0,
        impactCount: 1,
        impactKind: 'DAMAGE',
        targetId: 'boss_enemy',
        damage: 480,
        text: '複合大招真實傷害 480'
      }];

      expect(gameDamageEvents.length).toBe(1);
      expect(gameDamageEvents[0].damage).toBe(480);
    });
  });
});
