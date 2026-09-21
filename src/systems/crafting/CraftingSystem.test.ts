import { describe, it, expect, beforeEach } from 'vitest';
import { CraftingSystem } from './CraftingSystem';
import { Territory } from '../../models/Territory';
import { Equipment, SiegeEngineType } from '../../models/types';

describe('CraftingSystem 後端製造與鍛造邏輯測試', () => {
  let territory: Territory;

  beforeEach(() => {
    territory = new Territory('測試領地');
    territory.gold = 1000;
    territory.materials = {
      mat_iron_ingot: 50,
      mat_wood_plank: 100,
      mat_stone_brick: 100,
      mat_element_fire: 2
    };
    territory.warehouse = [];
  });

  describe('1. 裝備拆解 (Disassembly)', () => {
    it('應能正確計算武器與防具之拆解素材產出', () => {
      const sword: Equipment = {
        id: 'wpn_test_sword',
        uuid: 'test-sword-uuid',
        name: '鋼鐵長劍',
        slot: 'MAIN_HAND' as any,
        weaponType: 'SWORD' as any,
        tier: 2,
        enhancementLevel: 0,
        requirements: {},
        effects: {}
      };

      const yieldData = CraftingSystem.calculateDisassemblyYield(sword);
      expect(yieldData.mainMatId).toBe('mat_iron_ingot');
      expect(yieldData.mainCount).toBe(4); // tier 2 * 2
      expect(yieldData.bonusCount).toBe(0);
    });

    it('強化等級 >= 3 的裝備拆解應額外返還火元素石', () => {
      const highSword: Equipment = {
        id: 'wpn_test_high_sword',
        uuid: 'high-sword-uuid',
        name: '高階火焰劍',
        slot: 'MAIN_HAND' as any,
        weaponType: 'SWORD' as any,
        tier: 2,
        enhancementLevel: 4,
        requirements: {},
        effects: {}
      };

      const yieldData = CraftingSystem.calculateDisassemblyYield(highSword);
      expect(yieldData.bonusMatId).toBe('mat_element_fire');
      expect(yieldData.bonusCount).toBe(2); // ceil(4 / 2)
    });

    it('執行拆解應自倉庫移除裝備並將材料加入領地庫存', () => {
      const eq: Equipment = {
        id: 'wpn_test_bow',
        uuid: 'test-bow-uuid',
        name: '獵弓',
        slot: 'MAIN_HAND' as any,
        weaponType: 'BOW' as any,
        tier: 2,
        requirements: {},
        effects: {}
      };
      territory.warehouse.push(eq);

      const res = CraftingSystem.disassembleEquipment(territory, 'test-bow-uuid');
      expect(res.success).toBe(true);
      expect(territory.warehouse.length).toBe(0);
      expect(territory.materials['mat_wood_plank']).toBe(103); // 原 100 + floor(2 * 1.5) = 103
    });
  });

  describe('2. 元素附魔 (Enchantment)', () => {
    it('附魔石充足時應成功注入元素並扣除附魔石', () => {
      const eq: Equipment = {
        id: 'wpn_plain_sword',
        uuid: 'plain-sword-uuid',
        name: '無屬性長劍',
        slot: 'MAIN_HAND' as any,
        element: 'PHYSICAL' as any,
        requirements: {},
        effects: {}
      };

      const res = CraftingSystem.enchantEquipment(territory, eq, 'mat_element_fire', 'FIRE');
      expect(res.success).toBe(true);
      expect(eq.element).toBe('FIRE');
      expect(territory.materials['mat_element_fire']).toBe(1); // 2 - 1
    });

    it('附魔石不足時應拒絕注入', () => {
      const eq: Equipment = {
        id: 'wpn_plain_sword',
        uuid: 'plain-sword-uuid',
        name: '無屬性長劍',
        slot: 'MAIN_HAND' as any,
        requirements: {},
        effects: {}
      };

      const res = CraftingSystem.enchantEquipment(territory, eq, 'mat_element_water', 'WATER');
      expect(res.success).toBe(false);
      expect(res.message).toContain('不足');
    });
  });

  describe('3. 攻城器械建造 (Siege Engine)', () => {
    it('物資與金幣充足時應成功打造衝車', () => {
      const res = CraftingSystem.buildSiegeEngine(territory, SiegeEngineType.BATTERING_RAM);
      expect(res.success).toBe(true);
      expect(territory.siegeEngineStock.ram).toBe(1);
    });

    it('金幣不足時應拒絕建造', () => {
      territory.gold = 0;
      const res = CraftingSystem.buildSiegeEngine(territory, SiegeEngineType.BATTERING_RAM);
      expect(res.success).toBe(false);
      expect(res.message).toContain('金幣不足');
    });
  });

  describe('4. 基礎資源與特產交易品冶煉 (Smelting with Trade Goods)', () => {
    it('應支援以領地鐵礦 (territory.iron / tg_iron) 成功冶煉鐵錠', () => {
      territory.gold = 500;
      territory.iron = 300;
      const recipe = {
        targetEquipmentId: 'mat_iron_ingot',
        goldCost: 5,
        requiredMaterials: {
          'tg_iron': 3
        }
      };

      const res = CraftingSystem.executeRecipe(territory, recipe, 2, 'smelt');
      expect(res.success).toBe(true);
      expect(territory.iron).toBe(294); // 300 - 3 * 2
      expect(territory.gold).toBe(490); // 500 - 5 * 2
      expect(territory.materials['mat_iron_ingot']).toBe(52); // 50 + 2
    });

    it('鐵礦不足時應拒絕冶煉並提示具體缺少素材', () => {
      territory.iron = 2;
      const recipe = {
        targetEquipmentId: 'mat_iron_ingot',
        goldCost: 5,
        requiredMaterials: {
          'tg_iron': 3
        }
      };

      const res = CraftingSystem.executeRecipe(territory, recipe, 1, 'smelt');
      expect(res.success).toBe(false);
      expect(res.message).toContain('缺少 tg_iron');
    });
  });
});
