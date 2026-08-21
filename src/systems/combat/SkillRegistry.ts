import { Skill, SkillCategory } from '../../models/Skill';
import { SKILLS } from '../../data/SkillData';

/**
 * 技能單一真相中樞註冊中心 (SkillRegistry)
 * 統一管理全專案傭兵技能、怪物技能與裝備特技
 */
export class SkillRegistry {
  private static customSkills: Map<string, Skill> = new Map();

  /**
   * 推導技能的分類
   */
  public static resolveCategory(skill: Skill): SkillCategory {
    if (skill.category) return skill.category;

    const id = skill.id;
    if (id.startsWith('SKILL_') || id.startsWith('MONSTER_')) {
      return 'MONSTER';
    }

    const advancedKeywords = [
      'GREATSWORD_WHIRLWIND', 'MAGIC_SWORDSMAN', 'STAFF_METEOR', 'SCYTHE_SOUL_REAP',
      'BOW_SNIPER', 'MAGIC_BOW_SPIRIT', 'ASSASSIN_SHADOW', 'TRICKSTER',
      'PALADIN_AEGIS', 'RUNE_REFLECTION', 'ARCHBISHOP_MASS_HEAL', 'INQUISITOR_JUDGMENT'
    ];

    if (advancedKeywords.some(k => id.includes(k))) {
      return 'HERO_ADVANCED';
    }

    const baseKeywords = ['FIGHTER_', 'MAGE_', 'ARCHER_', 'THIEF_', 'KNIGHT_', 'PRAYER_'];
    if (baseKeywords.some(k => id.startsWith(k))) {
      return 'HERO_BASE';
    }

    return 'EQUIPMENT';
  }

  /**
   * 取得指定 ID 技能 (優先查找動態註冊，回退靜態資料庫)
   */
  public static getSkill(id: string): Skill | undefined {
    let skill: Skill | undefined = undefined;
    if (this.customSkills.has(id)) {
      skill = this.customSkills.get(id);
    } else if (SKILLS[id]) {
      skill = SKILLS[id];
    }
    if (skill && !skill.category) {
      skill.category = this.resolveCategory(skill);
    }
    return skill;
  }

  /**
   * 是否存在該技能
   */
  public static hasSkill(id: string): boolean {
    return this.customSkills.has(id) || !!SKILLS[id];
  }

  /**
   * 註冊或覆寫動態技能
   */
  public static registerSkill(skill: Skill): void {
    if (!skill.category) {
      skill.category = this.resolveCategory(skill);
    }
    this.customSkills.set(skill.id, skill);
  }

  /**
   * 獲取全專案所有技能清單 (包含靜態與動態)
   */
  public static getAllSkills(): Skill[] {
    const map = new Map<string, Skill>();
    Object.values(SKILLS).forEach(s => {
      if (!s.category) s.category = this.resolveCategory(s);
      map.set(s.id, s);
    });
    this.customSkills.forEach((s, id) => {
      if (!s.category) s.category = this.resolveCategory(s);
      map.set(id, s);
    });
    return Array.from(map.values());
  }

  /**
   * 依分類獲取技能
   */
  public static getSkillsByCategory(category: SkillCategory): Skill[] {
    return this.getAllSkills().filter(s => s.category === category);
  }

  /**
   * 獲取所有魔物可用技能
   */
  public static getAllMonsterSkills(): Skill[] {
    return this.getSkillsByCategory('MONSTER');
  }

  /**
   * 獲取所有冒險者技能
   */
  public static getAllHeroSkills(): Skill[] {
    return this.getAllSkills().filter(s => s.category === 'HERO_BASE' || s.category === 'HERO_ADVANCED');
  }
}
