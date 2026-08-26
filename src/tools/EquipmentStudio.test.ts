import { describe, it, expect } from 'vitest';
import materialsJson from '../data/materials.json';
import itemsJson from '../data/items.json';
import equipmentWeaponsJson from '../data/equipment_weapons.json';
import equipmentArmorsJson from '../data/equipment_armors.json';
import equipmentAccessoriesJson from '../data/equipment_accessories.json';
import craftingRecipesJson from '../data/CraftingRecipes.json';
import { DataStore } from '../systems/DataStore';
import { SkillRegistry } from '../systems/combat/SkillRegistry';
import { EquipmentGenerator } from '../systems/EquipmentGenerator';

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

  it('武器支援 extraSkills 額外特技接口，且可由 SkillRegistry 正確解析', () => {
    const customWeapon = {
      id: 'wpn_test_blade',
      name: '滅世龍炎劍',
      slot: 'WEAPON',
      extraSkills: ['CATACLYSM_FLAME', 'SKILL_FLAME_BURST']
    };

    expect(customWeapon.extraSkills.length).toBe(2);
    for (const skillId of customWeapon.extraSkills) {
      const sk = SkillRegistry.getSkill(skillId);
      expect(sk, `SkillRegistry 應能解析武器技能 ${skillId}`).toBeDefined();
      expect(sk?.name).toBeDefined();
    }
  });

  it('裝備編輯彈窗 HTML 模板包含所有必要的 DOM ID，防止執行期 null 錯誤', () => {
    const fs = require('fs');
    const path = require('path');
    const htmlPath = path.resolve(__dirname, '../templates/equipment-studio.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    const requiredIds = [
      'ee-title', 'ee-id', 'ee-name', 'ee-slot', 'ee-weapon-type', 'ee-tier', 'ee-element',
      'ee-craftable', 'ee-droppable', 'ee-shop-buyable',
      'job-all', 'btn-es-job-preset', 'job-warrior', 'job-mage', 'job-archer', 'job-knight', 'job-rogue', 'job-prayer',
      'ee-str', 'ee-agi', 'ee-con', 'ee-int', 'ee-spr', 'ee-luk',
      'rnd-str', 'rnd-agi', 'rnd-con', 'rnd-int', 'rnd-spr', 'rnd-luk',
      'ee-patk', 'ee-matk', 'ee-pdef', 'ee-mdef', 'ee-hp', 'ee-mp', 'ee-hit', 'ee-crit',
      'affix-sharp', 'affix-arcane', 'affix-deadly', 'affix-pierce', 'affix-vampire', 'affix-stalwart',
      'affix-ironwall', 'affix-antimagic', 'affix-block', 'affix-swift', 'affix-meditation', 'affix-allround',
      'ee-fixed-skill', 'ee-fixed-skill-card', 'ee-fixed-skill-name',
      'btn-es-pick-fixed-skill', 'btn-es-clear-fixed-skill',
      'ee-skill-roll-chance', 'ee-skill-roll-count', 'btn-es-add-pool-skill', 'ee-skill-pool-container',
      'ee-desc', 'ee-flavor', 'ee-icon', 'modal-equipment-editor', 'btn-save-ee', 'btn-cancel-ee',
      'modal-es-skill-picker', 'btn-close-es-skill-picker', 'inp-es-skill-search', 'sel-es-skill-category', 'es-skill-picker-grid'
    ];

    requiredIds.forEach(id => {
      expect(htmlContent.includes(`id="${id}"`), `equipment-studio.html 缺少 id="${id}"`).toBe(true);
    });
  });

  it('EquipmentGenerator 支援 fixedSkill 與 skillPool 的機率隨機擲骰生成', () => {
    const template: any = {
      id: 'wpn_test_pool_sword',
      name: '聖火幻影劍',
      slot: 'WEAPON',
      weaponType: 'GREATSWORD',
      tier: 4,
      itemLevel: 10,
      baseRequirements: {},
      baseEffects: {},
      baseCombatEffects: { patk: 50 },
      fixedSkill: 'FIGHTER_HEAVY_STRIKE',
      skillPool: ['CATACLYSM_FLAME', 'SKILL_FLAME_BURST', 'SKILL_TOXIC_SPRAY'],
      skillRollChance: 100,
      skillRollCount: 1
    };

    const item = EquipmentGenerator.generateFromTemplate(template);
    expect(item).toBeDefined();
    expect(item.extraSkills).toBeDefined();
    // 必定包含固定特技
    expect(item.extraSkills!).toContain('FIGHTER_HEAVY_STRIKE');
    // 總共應有 2 招技能 (1 固定 + 1 隨機)
    expect(item.extraSkills!.length).toBe(2);
    const poolSkill = item.extraSkills!.find((s: string) => s !== 'FIGHTER_HEAVY_STRIKE');
    expect(template.skillPool).toContain(poolSkill);
  });

  it('破敗的傳家寶劍設為全職業通用，法師或弓手也能裝備', () => {
    const heirloom = DataStore.getEquipmentTemplate('wpn_heirloom_sword');
    expect(heirloom).toBeDefined();
    // allowedJobs 包含全部職業，法師、弓箭手、戰士皆可裝備
    expect(heirloom?.allowedJobs).toContain('法師');
    expect(heirloom?.allowedJobs).toContain('弓箭手');
    expect(heirloom?.allowedJobs).toContain('戰士');
    expect(heirloom?.allowedJobs?.length).toBe(6);
  });
});
