import { Skill, SkillCategory, CompositeSkillDefinition } from '../../models/Skill';
import { SKILLS } from '../../data/SkillData';
import { SkillEffectEngine } from './SkillEffectEngine';
import customSkillData from '../../data/CustomSkillData.json';

/**
 * 技能單一真相中樞註冊中心 (SkillRegistry)
 * 統一管理全專案傭兵技能、怪物技能與裝備特技，支援磁碟 JSON、LocalStorage 草稿與動態註冊
 */
export class SkillRegistry {
  private static customSkills: Map<string, Skill> = new Map();
  private static customDefinitions: Map<string, CompositeSkillDefinition> = new Map();
  private static draftsLoaded: boolean = false;

  /**
   * 自 LocalStorage 載入工房草稿技能 (若處於瀏覽器環境)
   */
  public static loadDraftsFromStorage(): void {
    if (this.draftsLoaded) return;
    this.draftsLoaded = true;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('MEDIEVAL_CUSTOM_SKILLS');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((def: CompositeSkillDefinition) => {
              if (def && def.id) {
                this.registerCompositeSkill(def);
              }
            });
          }
        }
      }
    } catch (e) {
      console.warn('[SkillRegistry] 載入 LocalStorage 技能草稿失敗:', e);
    }
  }

  /**
   * 註冊積木複合技能定義 (同時編譯為可執行 Skill 物件)
   */
  public static registerCompositeSkill(def: CompositeSkillDefinition): Skill {
    this.customDefinitions.set(def.id, def);
    const compiled = SkillEffectEngine.compile(def);
    if (!compiled.category) {
      compiled.category = def.category || this.resolveCategory(compiled);
    }
    this.customSkills.set(def.id, compiled);
    return compiled;
  }

  /**
   * 取得積木技能定義 (供 triggerHooks 與工坊讀取)
   */
  public static getSkillDefinition(id: string): CompositeSkillDefinition | undefined {
    this.loadDraftsFromStorage();
    if (this.customDefinitions.has(id)) {
      return this.customDefinitions.get(id);
    }
    const fromJson = (customSkillData as unknown as CompositeSkillDefinition[]).find(d => d.id === id);
    return fromJson;
  }

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
   * 取得指定 ID 技能 (優先查找動態註冊，再查找 LocalStorage 草稿，再查找 CustomSkillData，最後回退靜態資料庫)
   */
  public static getSkill(id: string): Skill | undefined {
    this.loadDraftsFromStorage();
    let skill: Skill | undefined = undefined;
    if (this.customSkills.has(id)) {
      skill = this.customSkills.get(id);
    } else {
      const customDef = (customSkillData as any[]).find(d => d.id === id);
      if (customDef) {
        skill = SkillEffectEngine.compile(customDef);
      } else if (SKILLS[id]) {
        skill = SKILLS[id];
      }
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
    this.loadDraftsFromStorage();
    return this.customSkills.has(id) || (customSkillData as any[]).some(d => d.id === id) || !!SKILLS[id];
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
   * 獲取全專案所有技能清單 (包含靜態、工房積木與動態註冊)
   */
  public static getAllSkills(): Skill[] {
    const map = new Map<string, Skill>();
    Object.values(SKILLS).forEach(s => {
      if (!s.category) s.category = this.resolveCategory(s);
      map.set(s.id, s);
    });
    // 合併積木格式技能（來自工房 CustomSkillData.json）
    (customSkillData as any[]).forEach((def) => {
      if (!map.has(def.id)) {
        const compiled = SkillEffectEngine.compile(def);
        if (!compiled.category) compiled.category = this.resolveCategory(compiled);
        map.set(def.id, compiled);
      }
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
