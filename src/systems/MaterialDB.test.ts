import { describe, it, expect } from 'vitest';
import { DataStore } from './DataStore';

describe('Material & Crafting Recipe DB Integrity', () => {
  it('should load all materials in MaterialDB', () => {
    const materials = Object.values(DataStore.MaterialDB);
    expect(materials.length).toBeGreaterThanOrEqual(24);
  });

  it('should ensure all materials have valid icon set', () => {
    const materials = Object.values(DataStore.MaterialDB);
    materials.forEach(mat => {
      expect(mat.icon).toBeDefined();
    });
  });

  it('should verify every crafting recipe references valid material IDs in MaterialDB', () => {
    const recipes = DataStore.CraftingRecipeDB;
    expect(recipes.length).toBeGreaterThanOrEqual(12);

    recipes.forEach(recipe => {
      expect(recipe.id).toBeDefined();
      expect(recipe.targetEquipmentId).toBeDefined();
      if (recipe.isMaterialRecipe) {
        const mat = DataStore.MaterialDB[recipe.targetEquipmentId];
        expect(mat).toBeDefined();
        expect(mat.id).toBe(recipe.targetEquipmentId);
      } else {
        const targetEq = DataStore.getEquipmentTemplate(recipe.targetEquipmentId);
        expect(targetEq).not.toBeNull();
      }
      if (recipe.baseEquipmentId) {
        const baseEq = DataStore.getEquipmentTemplate(recipe.baseEquipmentId);
        expect(baseEq).not.toBeNull();
      }

      for (const [matId, amount] of Object.entries(recipe.requiredMaterials)) {
        expect(amount).toBeGreaterThan(0);
        const mat = DataStore.MaterialDB[matId];
        expect(mat).toBeDefined();
        expect(mat.id).toBe(matId);
      }
    });
  });
});
