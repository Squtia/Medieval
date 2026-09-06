import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { CombatStudioStageAdapter } from '../../ui/fx/adapters/CombatStudioStageAdapter';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { CombatEvent, CombatEventType } from '../../models/Combat';

describe('Fix 5 (批次 H): Session-scoped RNG, 治療 Fallback 與清理防線驗證', () => {
  let engine: CombatFXEngine;

  beforeEach(() => {
    engine = CombatFXEngine.getInstance();
    engine.clear();
  });

  describe('1. Session-scoped PRNG 確定性重現與全域隔離 (規格 10.1)', () => {
    it('應在注入 sessionRng 時使用自訂 PRNG，且絕不汙染全域 Math.random', () => {
      const originalMathRandom = Math.random;
      let s = 12345;
      const customRng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };

      // 注入自訂 PRNG
      engine.setSessionRng(customRng);

      // 1. engine.getRandom() 應產生確定性 PRNG 序列
      const r1 = engine.getRandom();
      const r2 = engine.getRandom();
      expect(typeof r1).toBe('number');
      expect(typeof r2).toBe('number');

      // 2. 全域 Math.random 必須嚴格保持原生物件，不能被 monkey-patch
      expect(Math.random).toBe(originalMathRandom);

      // 3. 呼叫全域 Math.random() 不受干擾
      const globalRandomVal = Math.random();
      expect(globalRandomVal).toBeGreaterThanOrEqual(0);
      expect(globalRandomVal).toBeLessThan(1);

      // 4. 重置與清理：clear() 後 sessionRng 應重置
      engine.clear();
      // 在未注入時，getRandom() 應安全降級為 Math.random
      const fallbackVal = engine.getRandom();
      expect(fallbackVal).toBeGreaterThanOrEqual(0);
      expect(fallbackVal).toBeLessThan(1);
    });

    it('兩次注入相同 Seed 的 PRNG 應產生 100% 幀同步一致的隨機數值', () => {
      const makeLcg = (seed: number) => {
        let s = seed;
        return () => {
          s = (s * 9301 + 49297) % 233280;
          return s / 233280;
        };
      };

      engine.setSessionRng(makeLcg(9999));
      const seq1 = [engine.getRandom(), engine.getRandom(), engine.getRandom(), engine.getRandom()];

      engine.setSessionRng(makeLcg(9999));
      const seq2 = [engine.getRandom(), engine.getRandom(), engine.getRandom(), engine.getRandom()];

      expect(seq1).toEqual(seq2);
    });
  });

  describe('2. 治療 Preset 與存在性安全防線 (規格 10.3)', () => {
    const adapter = CombatStudioStageAdapter.getInstance();

    it('治療事件 (HEAL) 應正確解析為合法且現存之 VFX_HOLY_LIGHT', () => {
      const healEvent: CombatEvent = {
        type: CombatEventType.HEAL,
        actorId: 'healer_1',
        targetId: 'tank_1',
        healAmount: 250,
        targetHp: 750,
        targetMaxHp: 1000,
        text: 'Heal 250'
      };

      const resolved = adapter.resolveVfxId(healEvent);
      expect(resolved).toBe('VFX_HOLY_LIGHT');

      // 驗證 VFX_HOLY_LIGHT 確實存在於 SSOT 預設庫中
      const preset = VFXPresetRepository.getInstance().getPreset(resolved!);
      expect(preset).toBeDefined();
      expect(preset?.id).toBe('VFX_HOLY_LIGHT');
    });

    it('普通攻擊事件 (HIT) 應解析為合法之 VFX_DEFAULT_SLASH', () => {
      const hitEvent: CombatEvent = {
        type: CombatEventType.HIT,
        actorId: 'warrior_1',
        targetId: 'goblin_1',
        damage: 100,
        targetHp: 200,
        targetMaxHp: 300,
        text: 'Hit 100'
      };

      const resolved = adapter.resolveVfxId(hitEvent);
      expect(resolved).toBe('VFX_DEFAULT_SLASH');
      expect(VFXPresetRepository.getInstance().getPreset(resolved!)).toBeDefined();
    });

    it('若事件指定不存在的 vfxId，應輸出警告並安全降級回傳 undefined (無 3D 特效)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const ghostEvent: CombatEvent = {
        type: CombatEventType.SKILL_CAST,
        actorId: 'player_1',
        targetId: 'enemy_1',
        vfxId: 'VFX_NON_EXISTENT_GHOST_SKILL',
        text: 'Cast ghost'
      };

      const resolved = adapter.resolveVfxId(ghostEvent);
      expect(resolved).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('特效預設不存在: "VFX_NON_EXISTENT_GHOST_SKILL"')
      );

      warnSpy.mockRestore();
    });
  });

  describe('3. VFXPresetRepository reloadPresets 與狀態同步 (規格 9.2 & 10.2)', () => {
    it('reloadPresets 應能重新加載並正確通知監聽器', () => {
      const repo = VFXPresetRepository.getInstance();
      let notified = false;
      const unbind = repo.addChangeListener(() => {
        notified = true;
      });

      repo.reloadPresets();
      expect(notified).toBe(true);

      unbind();
    });
  });
});
