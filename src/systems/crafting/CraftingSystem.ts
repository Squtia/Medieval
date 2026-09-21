import { Territory } from '../../models/Territory';
import { Equipment, SiegeEngineType, SIEGE_ENGINE_CONFIGS } from '../../models/types';
import { EquipmentGenerator } from '../EquipmentGenerator';

export interface DisassemblyYield {
  mainMatId: string;
  mainCount: number;
  bonusMatId?: string;
  bonusCount: number;
}

export interface CraftingResult {
  success: boolean;
  message: string;
  producedEquipments?: Equipment[];
  producedMaterials?: Record<string, number>;
}

export class CraftingSystem {
  /**
   * 計算裝備拆解可獲得的材料與加成
   */
  public static calculateDisassemblyYield(eq: Equipment): DisassemblyYield {
    const tier = eq.tier || 1;
    let mainMatId = 'mat_iron_ingot';
    let mainCount = Math.max(1, tier * 2);

    const wType = eq.weaponType;
    const slot = eq.slot;

    if (wType === 'BOW' || (wType as any) === 'CROSSBOW' || eq.armorType === 'LEATHER') {
      mainMatId = 'mat_wood_plank';
      mainCount = Math.max(1, Math.floor(tier * 1.5));
    } else if (wType === 'STAFF' || wType === 'HOLY_BOOK' || wType === 'MAGIC_RING' || eq.armorType === 'CLOTH') {
      mainMatId = 'mat_cloth';
      mainCount = Math.max(1, Math.floor(tier * 1.5));
    } else if (slot === 'ACCESSORY') {
      mainMatId = 'mat_reforge_scroll';
      mainCount = 1;
    }

    const bonusMatId = (eq.enhancementLevel || 0) >= 3 ? 'mat_element_fire' : 'mat_whetstone';
    const bonusCount = (eq.enhancementLevel || 0) > 0 ? Math.ceil((eq.enhancementLevel || 0) / 2) : 0;

    return {
      mainMatId,
      mainCount,
      bonusMatId: bonusCount > 0 ? bonusMatId : undefined,
      bonusCount
    };
  }

  /**
   * 執行裝備拆解：扣除倉庫裝備、返還素材
   */
  public static disassembleEquipment(territory: Territory, eqUuid?: string): CraftingResult {
    if (!eqUuid) {
      return { success: false, message: '未指定欲拆解的裝備！' };
    }
    const idx = territory.warehouse.findIndex(e => e.uuid === eqUuid);
    if (idx === -1) {
      return { success: false, message: '找不到欲拆解的裝備！' };
    }

    const eq = territory.warehouse[idx];
    if (eq.id === 'wpn_heirloom_sword' || (eq as any).isLocked) {
      return { success: false, message: '家族傳承的佩劍或已鎖定裝備無法被拆解！' };
    }

    const yieldData = this.calculateDisassemblyYield(eq);
    territory.warehouse.splice(idx, 1);

    if (!territory.materials) territory.materials = {};
    territory.materials[yieldData.mainMatId] = (territory.materials[yieldData.mainMatId] || 0) + yieldData.mainCount;

    if (yieldData.bonusCount > 0 && yieldData.bonusMatId) {
      territory.materials[yieldData.bonusMatId] = (territory.materials[yieldData.bonusMatId] || 0) + yieldData.bonusCount;
    }

    return {
      success: true,
      message: `♻️ 拆解成功！已獲得素材。`,
      producedMaterials: {
        [yieldData.mainMatId]: yieldData.mainCount,
        ...(yieldData.bonusMatId && yieldData.bonusCount > 0 ? { [yieldData.bonusMatId]: yieldData.bonusCount } : {})
      }
    };
  }

  /**
   * 執行元素附魔：扣除附魔石、注入元素
   */
  public static enchantEquipment(territory: Territory, eq: Equipment, stoneMatId: string, targetElement: any): CraftingResult {
    if (!territory.materials || (territory.materials[stoneMatId] || 0) < 1) {
      return { success: false, message: '領地庫存之元素附魔石不足！' };
    }

    territory.materials[stoneMatId] -= 1;
    eq.element = targetElement;

    return {
      success: true,
      message: `✨ 附魔成功！【${eq.name}】已成功注入元素！`
    };
  }

  /**
   * 取得領地內指定素材數量（同時支援四大基礎資源 tg_、特產交易品與加工素材）
   */
  public static getMaterialCount(territory: Territory, matId: string): number {
    if (matId === 'tg_timber') return territory.wood || 0;
    if (matId === 'tg_iron') return territory.iron || 0;
    if (matId === 'tg_stone') return territory.stone || 0;
    if (matId === 'tg_wheat') return territory.food || 0;
    if (matId.startsWith('tg_')) {
      return territory.tradeInventory?.[matId] || 0;
    }
    return territory.materials?.[matId] || 0;
  }

  /**
   * 扣除領地內指定素材數量（同時支援四大基礎資源 tg_、特產交易品與加工素材）
   */
  public static consumeMaterial(territory: Territory, matId: string, count: number): void {
    if (matId === 'tg_timber') { territory.wood = Math.max(0, (territory.wood || 0) - count); return; }
    if (matId === 'tg_iron') { territory.iron = Math.max(0, (territory.iron || 0) - count); return; }
    if (matId === 'tg_stone') { territory.stone = Math.max(0, (territory.stone || 0) - count); return; }
    if (matId === 'tg_wheat') { territory.food = Math.max(0, (territory.food || 0) - count); return; }
    if (matId.startsWith('tg_')) {
      if (territory.tradeInventory && territory.tradeInventory[matId]) {
        territory.tradeInventory[matId] = Math.max(0, territory.tradeInventory[matId] - count);
      }
      return;
    }
    if (territory.materials && territory.materials[matId]) {
      territory.materials[matId] = Math.max(0, territory.materials[matId] - count);
    }
  }

  /**
   * 執行配方鍛造或礦物冶煉
   */
  public static executeRecipe(
    territory: Territory,
    recipe: any,
    craftAmount: number,
    mode: 'craft' | 'smelt'
  ): CraftingResult {
    if (craftAmount < 1) return { success: false, message: '製作數量不得小於 1' };

    const totalGold = (recipe.goldCost || 0) * craftAmount;
    if (territory.gold < totalGold) {
      return { success: false, message: '金幣不足！' };
    }

    // 檢查前置裝備 (重鑄)
    let baseIndex = -1;
    if (recipe.baseEquipmentId) {
      baseIndex = territory.warehouse.findIndex(eq => eq.id === recipe.baseEquipmentId);
      if (baseIndex === -1) {
        return { success: false, message: '倉庫缺少前置裝備！' };
      }
    }

    // 檢查神兵重鑄圖紙/專屬書
    let tomeToConsume: string | null = null;
    if (recipe.requireTomeId) {
      if (this.getMaterialCount(territory, recipe.requireTomeId) > 0) {
        tomeToConsume = recipe.requireTomeId;
      } else if (this.getMaterialCount(territory, 'mat_reforge_scroll') > 0) {
        tomeToConsume = 'mat_reforge_scroll';
      } else {
        return { success: false, message: '缺少神兵重鑄專屬圖紙或重鑄卷軸！' };
      }
    }

    // 檢查材料充足性
    for (const [matId, reqAmount] of Object.entries(recipe.requiredMaterials || {})) {
      const need = (reqAmount as number) * craftAmount;
      if (this.getMaterialCount(territory, matId) < need) {
        return { success: false, message: `素材不足：缺少 ${matId}` };
      }
    }

    // 實質扣減
    if (baseIndex !== -1) {
      territory.warehouse.splice(baseIndex, 1);
    }

    if (tomeToConsume) {
      this.consumeMaterial(territory, tomeToConsume, 1);
    }

    for (const [matId, reqAmount] of Object.entries(recipe.requiredMaterials || {})) {
      this.consumeMaterial(territory, matId, (reqAmount as number) * craftAmount);
    }

    territory.gold -= totalGold;

    // 產出
    if (mode === 'smelt') {
      if (!territory.materials) territory.materials = {};
      territory.materials[recipe.targetEquipmentId] = (territory.materials[recipe.targetEquipmentId] || 0) + craftAmount;
      return {
        success: true,
        message: `✨ 冶煉成功！獲得素材 x${craftAmount}！`,
        producedMaterials: { [recipe.targetEquipmentId]: craftAmount }
      };
    } else {
      const producedEquipments: Equipment[] = [];
      for (let i = 0; i < craftAmount; i++) {
        const newEq = EquipmentGenerator.generate(recipe.targetEquipmentId);
        if (newEq) {
          territory.warehouse.push(newEq);
          producedEquipments.push(newEq);
        }
      }
      return {
        success: true,
        message: `✨ ${recipe.baseEquipmentId ? '重鑄' : `鍛造 x${craftAmount}`}成功！`,
        producedEquipments
      };
    }
  }

  /**
   * 建造攻城器械
   */
  public static buildSiegeEngine(territory: Territory, engineType: SiegeEngineType): CraftingResult {
    if (!territory.siegeEngineStock) {
      territory.siegeEngineStock = { ram: 0, trebuchet: 0 };
    }

    const currentCount = engineType === SiegeEngineType.BATTERING_RAM
      ? territory.siegeEngineStock.ram
      : territory.siegeEngineStock.trebuchet;

    if (currentCount >= 10) {
      return { success: false, message: '該攻城器械庫存已達上限 (10台)！' };
    }

    const cost = SIEGE_ENGINE_CONFIGS[engineType];
    if (!cost) return { success: false, message: '未知的攻城器械類型！' };

    if (territory.gold < cost.gold) {
      return { success: false, message: '打造攻城軍備金幣不足！' };
    }

    const materials = territory.materials || {};
    for (const [matId, reqCount] of Object.entries(cost.materials)) {
      if ((materials[matId] || 0) < reqCount) {
        return { success: false, message: '打造攻城器械所需材料不足！' };
      }
    }

    // 扣除素材與金幣
    territory.gold -= cost.gold;
    for (const [matId, reqCount] of Object.entries(cost.materials)) {
      materials[matId] -= reqCount;
    }

    if (engineType === SiegeEngineType.BATTERING_RAM) {
      territory.siegeEngineStock.ram++;
      return { success: true, message: '🎉 成功打造 1 台【🪵 撞木衝車】！已存入領地軍備庫存！' };
    } else {
      territory.siegeEngineStock.trebuchet++;
      return { success: true, message: '🎉 成功打造 1 台【🪨 重型投石機】！已存入領地軍備庫存！' };
    }
  }
}
