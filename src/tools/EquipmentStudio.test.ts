import { describe, it, expect } from 'vitest';
import materialsJson from '../data/materials.json';
import itemsJson from '../data/items.json';
import equipmentWeaponsJson from '../data/equipment_weapons.json';
import equipmentArmorsJson from '../data/equipment_armors.json';
import equipmentAccessoriesJson from '../data/equipment_accessories.json';
import craftingRecipesJson from '../data/CraftingRecipes.json';
import { DataStore } from '../systems/DataStore';

describe('裝備、素材、道具與鍛造工坊核心功能測試 (Equipment Studio Tests)', () => {
  it('素材資料庫包含必要欄位與合法階級 (Tier 1~4)', () => {
    expect(materialsJson.length).toBeGreaterThan(0);
    materialsJson.forEach((mat: any) => {
      expect(mat.id).toBeDefined();
      expect(mat.name).toBeDefined();
      expect(mat.tier).toBeGreaterThanOrEqual(1);
      expect(mat.tier).toBeLessThanOrEqual(4);
    });
  });

  it('一般道具/消耗品資料庫結構合法且包含效果類型', () => {
    expect(itemsJson.length).toBeGreaterThan(0);
    itemsJson.forEach((item: any) => {
      expect(item.id).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.effectType).toBeDefined();
      expect(item.description).toBeDefined();
    });
  });

  it('拆分後之裝備原型庫 (weapons, armors, accessories) 正確儲存且 DataStore 完美載入', () => {
    expect(equipmentWeaponsJson.length).toBeGreaterThan(0);
    expect(equipmentArmorsJson.length).toBeGreaterThan(0);
    expect(Array.isArray(equipmentAccessoriesJson)).toBe(true);

    const greatsword = DataStore.EquipmentDB['wpn_iron_greatsword'];
    expect(greatsword).toBeDefined();
    expect(greatsword.name).toBe('鐵大劍');
    expect(greatsword.slot).toBe('WEAPON');

    const clothRobe = DataStore.EquipmentDB['arm_cloth_robe_t1'];
    expect(clothRobe).toBeDefined();
    expect(clothRobe.name).toBe('粗布長袍');
    expect(clothRobe.slot).toBe('ARMOR');
  });

  it('鍛造配方庫能正確關聯素材與目標裝備', () => {
    expect(craftingRecipesJson.length).toBeGreaterThan(0);
    craftingRecipesJson.forEach((rec: any) => {
      expect(rec.id).toBeDefined();
      expect(rec.targetEquipmentId).toBeDefined();
      expect(rec.requiredMaterials).toBeDefined();
      expect(Object.keys(rec.requiredMaterials).length).toBeGreaterThan(0);
      expect(rec.goldCost).toBeGreaterThan(0);
    });
  });
});
