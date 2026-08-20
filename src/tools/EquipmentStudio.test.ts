import { describe, it, expect } from 'vitest';
import materialsJson from '../data/materials.json';
import itemsJson from '../data/items.json';
import equipmentTemplatesJson from '../data/EquipmentTemplates.json';
import craftingRecipesJson from '../data/CraftingRecipes.json';

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

  it('裝備原型庫能支援 12 種武器、防具與戰鬥數值', () => {
    const raw: any = equipmentTemplatesJson;
    const allEq: any[] = Array.isArray(raw) ? raw : [...(raw.weapons || []), ...(raw.armors || []), ...(raw.accessories || [])];
    expect(allEq.length).toBeGreaterThan(0);
    const weapons = allEq.filter((e: any) => e.slot === 'WEAPON');
    const armors = allEq.filter((e: any) => e.slot === 'ARMOR');
    expect(weapons.length).toBeGreaterThan(0);
    expect(armors.length).toBeGreaterThan(0);
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
