import { Equipment, EquipmentTemplate, Attributes, CombatStats, ScalingTier, EquipmentScaling, ScalingRuleTarget, EquipmentSlot } from '../models/types';
import { DataStore } from './DataStore';
import { Random } from '../core/Random';

export class EquipmentGenerator {
  private static getRandomTier(range: [ScalingTier, ScalingTier]): ScalingTier {
    const tiers: ScalingTier[] = ['S', 'A', 'B', 'C', 'D', 'E'];
    const i1 = tiers.indexOf(range[0]);
    const i2 = tiers.indexOf(range[1]);
    const min = Math.min(i1, i2);
    const max = Math.max(i1, i2);
    const pickedIndex = Random.int(min, max);
    return tiers[pickedIndex];
  }

  private static processScalingRule(rule: ScalingRuleTarget | undefined): Partial<Record<keyof Attributes, ScalingTier>> | undefined {
    if (!rule) return undefined;
    const result: Partial<Record<keyof Attributes, ScalingTier>> = {};
    
    // 1. Guaranteed
    if (rule.guaranteed) {
      for (const [attr, range] of Object.entries(rule.guaranteed)) {
         result[attr as keyof Attributes] = this.getRandomTier(range as [ScalingTier, ScalingTier]);
      }
    }
    
    // 2. Random Pool
    if (rule.randomPool && rule.randomPool.count[1] > 0) {
      const count = Random.int(rule.randomPool.count[0], rule.randomPool.count[1]);
      const shuffled = [...rule.randomPool.possibleAttributes].sort(() => Random.next() - 0.5);
      
      for (let i = 0; i < count && i < shuffled.length; i++) {
        const attr = shuffled[i];
        if (!result[attr]) {
           result[attr] = this.getRandomTier(rule.randomPool.rankRange);
        }
      }
    }
    
    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * 根據模板 ID 隨機生成一件裝備實體
   * @param templateId 裝備模板的 ID (例如 'wpn_iron_sword')
   * @returns 隨機生成的 Equipment 實體，如果模板不存在則回傳 null
   */
  public static generate(templateId: string): Equipment | null {
    const template = DataStore.getEquipmentTemplate(templateId);
    if (!template) return null;

    // 產生專屬 UUID
    const uuid = `eq_${Date.now()}_${Random.int(0, 9999)}`;

    const eq: Equipment = {
      uuid,
      id: template.id,
      name: template.name,
      slot: template.slot,
      weaponType: template.weaponType,
      allowedJobs: template.allowedJobs ? [...template.allowedJobs] : undefined,
      icon: template.icon,
      enhancementLevel: 0,
      requirements: { ...template.baseRequirements },
      effects: { ...template.baseEffects },
      combatEffects: { ...template.baseCombatEffects },
      element: template.element,
      armorType: template.armorType,
      tier: template.tier,
      isVariant: template.isVariant,
      grantedSkill: template.grantedSkill,
      scaling: {}
    };

    // 根據 ItemLevel 計算隨機點數 (原有的固定屬性生成保留)
    if (template.randomPool) {
      const pool = template.randomPool;
      let remainingPoints = template.itemLevel;

      while (remainingPoints > 0) {
        const alloc = Math.min(remainingPoints, Random.int(1, 3));
        remainingPoints -= alloc;

        const isCombatStat = pool.combatStats && pool.combatStats.length > 0 && Random.next() > 0.5;
        
        if (isCombatStat && pool.combatStats) {
          const stat = Random.pick(pool.combatStats);
          let multiplier = 1;
          if (stat === 'hp' || stat === 'mp') multiplier = 5;
          
          if (!eq.combatEffects) eq.combatEffects = {};
          eq.combatEffects[stat] = (eq.combatEffects[stat] || 0) + (alloc * multiplier);
        } else if (pool.attributes && pool.attributes.length > 0) {
          const attr = Random.pick(pool.attributes);
          if (!eq.effects) eq.effects = {};
          eq.effects[attr] = (eq.effects[attr] || 0) + alloc;
        }
      }
    }
    
    // 處理 Scaling Rules (打寶隨機補正倍率)
    if (template.scalingRules) {
       if (template.scalingRules.patk) eq.scaling!.patk = this.processScalingRule(template.scalingRules.patk);
       if (template.scalingRules.matk) eq.scaling!.matk = this.processScalingRule(template.scalingRules.matk);
       if (template.scalingRules.pdef) eq.scaling!.pdef = this.processScalingRule(template.scalingRules.pdef);
       if (template.scalingRules.mdef) eq.scaling!.mdef = this.processScalingRule(template.scalingRules.mdef);
    }

    // 保底默認值處理
    if (template.slot === EquipmentSlot.WEAPON) {
       if (!eq.scaling!.patk || Object.keys(eq.scaling!.patk).length === 0) eq.scaling!.patk = { str: 'E' };
       if (!eq.scaling!.matk || Object.keys(eq.scaling!.matk).length === 0) eq.scaling!.matk = { int: 'E' };
    } else if (template.slot === EquipmentSlot.ARMOR) {
       if (!eq.scaling!.pdef || Object.keys(eq.scaling!.pdef).length === 0) eq.scaling!.pdef = { con: 'E' };
       if (!eq.scaling!.mdef || Object.keys(eq.scaling!.mdef).length === 0) eq.scaling!.mdef = { spr: 'E' };
    }

    // 複製備份基底數值
    eq.baseCombatEffects = JSON.parse(JSON.stringify(eq.combatEffects || {}));

    return eq;
  }

  /**
   * 隨機抽取一件與掉落等級相符的裝備
   * @param maxItemLevel 最大裝備等級
   */
  public static dropRandomEquipment(maxItemLevel: number): Equipment | null {
    const allTemplates = Object.values(DataStore.EquipmentDB);
    const validTemplates = allTemplates.filter(t => t.id !== 'wpn_heirloom_sword' && (t.tier === undefined || t.tier <= 3) && !t.isVariant && t.itemLevel <= maxItemLevel);
    if (validTemplates.length === 0) return null;

    const selectedTemplate = Random.pick(validTemplates);
    return this.generate(selectedTemplate.id);
  }
}
