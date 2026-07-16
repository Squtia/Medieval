import { Equipment, EquipmentTemplate, Attributes, CombatStats } from '../models/types';
import { DataStore } from './DataStore';

export class EquipmentGenerator {
  /**
   * 根據模板 ID 隨機生成一件裝備實體
   * @param templateId 裝備模板的 ID (例如 'wpn_iron_sword')
   * @returns 隨機生成的 Equipment 實體，如果模板不存在則回傳 null
   */
  public static generate(templateId: string): Equipment | null {
    const template = DataStore.getEquipmentTemplate(templateId);
    if (!template) return null;

    // 產生專屬 UUID
    const uuid = `eq_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const eq: Equipment = {
      uuid,
      id: template.id,
      name: template.name,
      slot: template.slot,
      icon: template.icon,
      enhancementLevel: 0,
      requirements: { ...template.baseRequirements },
      effects: { ...template.baseEffects },
      combatEffects: { ...template.baseCombatEffects }
    };

    // 根據 ItemLevel 計算隨機點數 (假設 1 ItemLevel = 1~2 點基礎屬性 or 5~10點HP/MP 等)
    // 這裡我們將 ItemLevel 分配到隨機池中的屬性
    if (template.randomPool) {
      const pool = template.randomPool;
      let remainingPoints = template.itemLevel;

      // 隨機分配點數邏輯
      while (remainingPoints > 0) {
        const alloc = Math.min(remainingPoints, Math.floor(Math.random() * 3) + 1); // 每次分配 1~3 點
        remainingPoints -= alloc;

        const isCombatStat = pool.combatStats && pool.combatStats.length > 0 && Math.random() > 0.5;
        
        if (isCombatStat && pool.combatStats) {
          const stat = pool.combatStats[Math.floor(Math.random() * pool.combatStats.length)];
          // 針對不同戰鬥屬性，分配的倍率不同 (例如 HP/MP 倍率較高)
          let multiplier = 1;
          if (stat === 'hp' || stat === 'mp') multiplier = 5;
          
          if (!eq.combatEffects) eq.combatEffects = {};
          eq.combatEffects[stat] = (eq.combatEffects[stat] || 0) + (alloc * multiplier);
        } else if (pool.attributes && pool.attributes.length > 0) {
          const attr = pool.attributes[Math.floor(Math.random() * pool.attributes.length)];
          if (!eq.effects) eq.effects = {};
          eq.effects[attr] = (eq.effects[attr] || 0) + alloc;
        }
      }
    }

    return eq;
  }

  /**
   * 隨機抽取一件與掉落等級相符的裝備
   * @param maxItemLevel 最大裝備等級
   */
  public static dropRandomEquipment(maxItemLevel: number): Equipment | null {
    const allTemplates = Object.values(DataStore.EquipmentDB);
    const validTemplates = allTemplates.filter(t => t.itemLevel <= maxItemLevel);
    
    if (validTemplates.length === 0) return null;
    
    const selectedTemplate = validTemplates[Math.floor(Math.random() * validTemplates.length)];
    return this.generate(selectedTemplate.id);
  }
}
