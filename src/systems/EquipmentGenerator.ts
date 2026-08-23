import { Equipment, EquipmentTemplate, Attributes, CombatStats, ScalingTier, EquipmentScaling, ScalingRuleTarget, EquipmentSlot, ScalingRules } from '../models/types';
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
   * 取得指定階級的屬性補正範圍
   * T1: D ~ B
   * T2: C ~ A
   * T3: B ~ A
   * T4、T5: B ~ S
   */
  public static getTierScalingRange(tier: number = 1): [ScalingTier, ScalingTier] {
    switch (tier) {
      case 1:
        return ['D', 'B'];
      case 2:
        return ['C', 'A'];
      case 3:
        return ['B', 'A'];
      case 4:
      case 5:
      default:
        return ['B', 'S'];
    }
  }

  /**
   * 根據裝備部位、武器類型、防具類型與階級，產生專屬的預設 Scaling 規則
   */
  public static getDefaultScalingRules(slot: EquipmentSlot, weaponType?: string, armorType?: string, tier: number = 1): ScalingRules {
    const range = this.getTierScalingRange(tier);
    const subRankMax = range[1]; // 副屬性上限與主屬性上限一致，下限保底為 E

    if (slot === EquipmentSlot.WEAPON) {
      const wType = (weaponType || '').toUpperCase();
      switch (wType) {
        case 'GREATSWORD':
          return {
            patk: {
              guaranteed: { str: range },
              randomPool: { possibleAttributes: ['con', 'agi', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'BOW':
          return {
            patk: {
              guaranteed: { agi: range },
              randomPool: { possibleAttributes: ['str', 'con', 'luk', 'int'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'DAGGERS':
          return {
            patk: {
              guaranteed: { agi: range },
              randomPool: { possibleAttributes: ['str', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'STAFF':
          return {
            matk: {
              guaranteed: { int: range },
              randomPool: { possibleAttributes: ['spr', 'agi', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'MAGIC_RING':
          return {
            matk: {
              guaranteed: { int: range },
              randomPool: { possibleAttributes: ['agi', 'spr', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'HOLY_BOOK':
          return {
            matk: {
              guaranteed: { spr: range },
              randomPool: { possibleAttributes: ['int', 'con', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'DUAL_SWORDS':
          return {
            patk: { guaranteed: { str: range } },
            matk: { guaranteed: { int: range } },
            pdef: {
              randomPool: { possibleAttributes: ['agi', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'MAGIC_BOW':
          return {
            patk: { guaranteed: { agi: range } },
            matk: { guaranteed: { int: range } },
            pdef: {
              randomPool: { possibleAttributes: ['luk', 'spr'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'SWORD_AND_SHIELD':
          return {
            patk: { guaranteed: { str: range } },
            pdef: { guaranteed: { con: range } },
            mdef: {
              randomPool: { possibleAttributes: ['luk', 'spr'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'RUNE_SHIELD':
          return {
            patk: { guaranteed: { con: range } },
            matk: { guaranteed: { spr: range } },
            pdef: {
              randomPool: { possibleAttributes: ['int', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'SCYTHE':
          return {
            patk: { guaranteed: { str: range } },
            matk: { guaranteed: { int: range } },
            mdef: {
              randomPool: { possibleAttributes: ['con', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        case 'HAMMER':
          return {
            patk: { guaranteed: { str: range } },
            matk: { guaranteed: { spr: range } },
            pdef: {
              randomPool: { possibleAttributes: ['con', 'luk'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
        default:
          return {
            patk: {
              guaranteed: { str: range },
              randomPool: { possibleAttributes: ['con', 'agi', 'luk', 'int', 'spr'], rankRange: ['E', subRankMax], count: [0, 2] }
            }
          };
      }
    } else if (slot === EquipmentSlot.ARMOR) {
      const aType = (armorType || '').toUpperCase();
      switch (aType) {
        case 'CLOTH':
          return {
            mdef: {
              guaranteed: { spr: range },
              randomPool: { possibleAttributes: ['int', 'luk'], rankRange: ['E', subRankMax], count: [0, 1] }
            }
          };
        case 'LEATHER':
          return {
            pdef: { guaranteed: { luk: range } },
            mdef: {
              guaranteed: { agi: range },
              randomPool: { possibleAttributes: ['con', 'str'], rankRange: ['E', subRankMax], count: [0, 1] }
            }
          };
        case 'HEAVY':
        default:
          return {
            pdef: {
              guaranteed: { con: range },
              randomPool: { possibleAttributes: ['str', 'spr'], rankRange: ['E', subRankMax], count: [0, 1] }
            }
          };
      }
    }

    return {};
  }

  /**
   * 為裝備生成或重新洗鍊 Scaling 屬性
   */
  public static generateEquipmentScaling(template: { slot: EquipmentSlot; weaponType?: string; armorType?: string; tier?: number; scalingRules?: ScalingRules }): EquipmentScaling {
    const rules = template.scalingRules || this.getDefaultScalingRules(template.slot, template.weaponType, template.armorType, template.tier || 1);
    const scaling: EquipmentScaling = {};

    if (rules.patk) scaling.patk = this.processScalingRule(rules.patk);
    if (rules.matk) scaling.matk = this.processScalingRule(rules.matk);
    if (rules.pdef) scaling.pdef = this.processScalingRule(rules.pdef);
    if (rules.mdef) scaling.mdef = this.processScalingRule(rules.mdef);

    return scaling;
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
      extraSkills: template.extraSkills ? [...template.extraSkills] : undefined,
      skillTriggerChances: template.skillTriggerChances ? [...template.skillTriggerChances] : undefined,
      affixPool: template.affixPool ? [...template.affixPool] : undefined,
      craftable: template.craftable,
      droppable: template.droppable,
      shopBuyable: template.shopBuyable,
      scaling: {}
    };

    // 🌟 若模板定義了浮動戰鬥數值區間 (combatStatRanges)，在此區間內隨機 Roll 點
    if (template.combatStatRanges) {
      if (!eq.combatEffects) eq.combatEffects = {};
      for (const [stat, range] of Object.entries(template.combatStatRanges)) {
        if (range && range.length === 2 && range[0] <= range[1]) {
          const rolled = Random.int(range[0], range[1]);
          eq.combatEffects[stat as keyof CombatStats] = rolled;
        }
      }
    }

    // 根據 ItemLevel 計算隨機點數 (原有的固定屬性生成保留)
    if (template.randomPool) {
      const pool = template.randomPool;
      let remainingPoints = template.itemLevel || 1;

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
    eq.scaling = this.generateEquipmentScaling(template);

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
    const validTemplates = allTemplates.filter(t => t.id !== 'wpn_heirloom_sword' && t.droppable !== false && (t.tier === undefined || t.tier <= 3) && !t.isVariant && (t.itemLevel || 1) <= maxItemLevel);
    if (validTemplates.length === 0) return null;

    const selectedTemplate = Random.pick(validTemplates);
    return this.generate(selectedTemplate.id);
  }

  /**
   * 依部位與階級篩選隨機生成裝備
   */
  public static generateByFilter(slot?: string, tier?: number | string): Equipment | null {
    const allTemplates = Object.values(DataStore.EquipmentDB);
    const valid = allTemplates.filter(t => {
      if (t.id === 'wpn_heirloom_sword') return false;
      if (slot && slot !== 'ANY') {
        const slotUpper = slot.toUpperCase();
        if (t.slot.toUpperCase() !== slotUpper) return false;
      }
      if (tier && tier !== 'ANY') {
        const targetTier = Number(tier);
        if (t.tier !== targetTier) return false;
      }
      return true;
    });
    if (valid.length === 0) return null;
    const picked = Random.pick(valid);
    return this.generate(picked.id);
  }
}
