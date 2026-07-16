import { AdventurerState, Attributes, Equipment, EquipmentSlot, JobConfig, TraitConfig, CombatStats } from './types';

export class Adventurer {
  public id: string;
  public name: string;
  public level: number;
  public xp: number;
  
  public job: JobConfig;
  public trait: TraitConfig;
  
  // 基礎六維與非戰鬥屬性 (未包含性格與裝備加成)
  public baseAttributes: Attributes;
  public unspentStatPoints: number;

  // 已穿戴裝備槽
  public equipment: Partial<Record<EquipmentSlot, Equipment>>;

  // 派遣狀態
  public currentState: AdventurerState;
  public dispatchEndTime: number | null;

  constructor(id: string, name: string, job: JobConfig, trait: TraitConfig) {
    this.id = id;
    this.name = name;
    this.level = 1;
    this.xp = 0;
    this.job = job;
    this.trait = trait;

    // 初始化基礎屬性為職業的 Lv.1 屬性拷貝，並預設魅力與統帥為 1
    this.baseAttributes = { ...job.baseAttributes, charm: 1, command: 1 };
    this.unspentStatPoints = 0;

    this.equipment = {};
    this.currentState = AdventurerState.IDLE;
    this.dispatchEndTime = null;
  }

  /**
   * 計算升級所需的經驗值
   * 公式：(基礎 100 * 當前等級) * 性格倍率
   */
  public getRequiredXP(): number {
    return Math.floor(100 * this.level * this.trait.xpModifier);
  }

  /**
   * 增加經驗值並處理升級邏輯
   */
  public gainXP(amount: number): void {
    this.xp += amount;
    
    // 若經驗值超過升級門檻，則進行升級 (支援一次升多級)
    while (this.xp >= this.getRequiredXP() && this.level < 10) {
      this.xp -= this.getRequiredXP();
      this.levelUp();
    }
    
    // 滿等後經驗值鎖定
    if (this.level >= 10) {
      this.xp = 0;
    }
  }

  /**
   * 升級處理
   * 根據職業的成長係數，微幅增加基礎屬性，並給予 2 點自由屬性點
   */
  private levelUp(): void {
    if (this.level >= 10) return;

    this.level++;
    // 壓縮升級數值，成長率減半 (最少為0)
    this.baseAttributes.str += Math.floor(this.job.growthRates.str / 2);
    this.baseAttributes.agi += Math.floor(this.job.growthRates.agi / 2);
    this.baseAttributes.con += Math.floor(this.job.growthRates.con / 2);
    this.baseAttributes.int += Math.floor(this.job.growthRates.int / 2);
    this.baseAttributes.spr += Math.floor(this.job.growthRates.spr / 2);
    this.baseAttributes.luk += Math.floor(this.job.growthRates.luk / 2);
    
    // 每升一級獲得 2 點自由屬性點
    this.unspentStatPoints += 2;

    console.log(`🎉 ${this.name} 升級到了 Lv.${this.level}！獲得 2 點自由屬性點！`);
  }

  /**
   * 分配自由屬性點
   */
  public allocateStat(statKey: keyof Attributes): boolean {
    if (this.unspentStatPoints <= 0) return false;
    
    this.baseAttributes[statKey] += 1;
    this.unspentStatPoints -= 1;
    console.log(`✨ ${this.name} 消耗了一點自由屬性點，提升了 ${statKey.toUpperCase()}！`);
    return true;
  }

  /**
   * 取得「實際六維屬性」
   * 包含：基礎屬性 + 裝備加成，最後再乘上性格百分比修正
   * @param excludeSlot (選填) 在計算時排除指定槽位的裝備，用於 canEquip 預判
   */
  public getEffectiveAttributes(excludeSlot?: EquipmentSlot): Attributes {
    // 1. 取得基礎屬性拷貝
    const effective: Attributes = { ...this.baseAttributes };

    // 2. 疊加裝備提供的固定加成
    for (const slot of Object.values(EquipmentSlot)) {
      if (excludeSlot === slot) continue; // 排除指定槽位

      const equip = this.equipment[slot as EquipmentSlot];
      if (equip && equip.effects) {
        effective.str += equip.effects.str || 0;
        effective.agi += equip.effects.agi || 0;
        effective.con += equip.effects.con || 0;
        effective.int += equip.effects.int || 0;
        effective.spr += equip.effects.spr || 0;
        effective.luk += equip.effects.luk || 0;
      }
    }

    // 3. 乘上性格的百分比修正 (1 + multiplier)
    const traitMods = this.trait.statMultipliers;
    effective.str = Math.floor(effective.str * (1 + (traitMods.str || 0)));
    effective.agi = Math.floor(effective.agi * (1 + (traitMods.agi || 0)));
    effective.con = Math.floor(effective.con * (1 + (traitMods.con || 0)));
    effective.int = Math.floor(effective.int * (1 + (traitMods.int || 0)));
    effective.spr = Math.floor(effective.spr * (1 + (traitMods.spr || 0)));
    effective.luk = Math.floor(effective.luk * (1 + (traitMods.luk || 0)));
    // charm與command暫不套用性格百分比加成

    return effective;
  }

  /**
   * 計算並取得實際的戰鬥派生屬性
   */
  public getCombatStats(): CombatStats {
    const attr = this.getEffectiveAttributes();
    
    // 基礎公式
    const baseHp = attr.con * 10;
    const baseMp = attr.int * 5;
    const baseAtk = attr.str * 2; // 預設使用力量作為攻擊力基底
    const baseDef = attr.con * 1;
    const baseHit = attr.agi * 2 + attr.luk;
    const baseEvade = attr.agi * 1 + attr.luk;

    const stats: CombatStats = {
      hp: baseHp,
      mp: baseMp,
      atk: baseAtk,
      def: baseDef,
      hit: baseHit,
      evade: baseEvade
    };

    // 疊加裝備直接提供的戰鬥屬性加成 (combatEffects)
    for (const slot of Object.values(EquipmentSlot)) {
      const equip = this.equipment[slot as EquipmentSlot];
      if (equip && equip.combatEffects) {
        stats.hp += equip.combatEffects.hp || 0;
        stats.mp += equip.combatEffects.mp || 0;
        stats.atk += equip.combatEffects.atk || 0;
        stats.def += equip.combatEffects.def || 0;
        stats.hit += equip.combatEffects.hit || 0;
        stats.evade += equip.combatEffects.evade || 0;
      }
    }

    return stats;
  }

  /**
   * 判斷該冒險者是否滿足裝備條件
   * @param item 欲裝備的物品
   * @returns [是否達標, 失敗原因列表]
   */
  public canEquip(item: Equipment): [boolean, string[]] {
    // 取得「排除目前該槽位舊裝備後」的實際屬性
    const currentStats = this.getEffectiveAttributes(item.slot);
    const reasons: string[] = [];
    const reqs = item.requirements;

    if (reqs.str && currentStats.str < reqs.str) reasons.push(`力量不足 (需 ${reqs.str}, 當前 ${currentStats.str})`);
    if (reqs.agi && currentStats.agi < reqs.agi) reasons.push(`敏捷不足 (需 ${reqs.agi}, 當前 ${currentStats.agi})`);
    if (reqs.con && currentStats.con < reqs.con) reasons.push(`體質不足 (需 ${reqs.con}, 當前 ${currentStats.con})`);
    if (reqs.int && currentStats.int < reqs.int) reasons.push(`智慧不足 (需 ${reqs.int}, 當前 ${currentStats.int})`);
    if (reqs.spr && currentStats.spr < reqs.spr) reasons.push(`精神不足 (需 ${reqs.spr}, 當前 ${currentStats.spr})`);
    if (reqs.luk && currentStats.luk < reqs.luk) reasons.push(`幸運不足 (需 ${reqs.luk}, 當前 ${currentStats.luk})`);
    if (reqs.charm && currentStats.charm < reqs.charm) reasons.push(`魅力不足 (需 ${reqs.charm}, 當前 ${currentStats.charm})`);
    if (reqs.command && currentStats.command < reqs.command) reasons.push(`統帥不足 (需 ${reqs.command}, 當前 ${currentStats.command})`);

    return [reasons.length === 0, reasons];
  }

  /**
   * 裝備物品
   * @param item 欲穿戴的裝備
   */
  public equip(item: Equipment): void {
    const [success, reasons] = this.canEquip(item);
    if (!success) {
      throw new Error(`無法裝備【${item.name}】: ${reasons.join(', ')}`);
    }
    
    // 裝備達標，放入對應槽位
    this.equipment[item.slot] = item;
    console.log(`🛡️ ${this.name} 裝備了【${item.name}】！`);
  }

  /**
   * 卸下物品
   * @param slot 欲卸下的裝備槽位
   */
  public unequip(slot: EquipmentSlot): void {
    if (this.equipment[slot]) {
      delete this.equipment[slot];
    }
  }

  /**
   * 為了與舊有派遣系統的 `power` (戰鬥力) 屬性相容
   * 我們實作一個 getter，將六維屬性做最簡單的加總作為綜合戰力
   */
  public get power(): number {
    const eff = this.getEffectiveAttributes();
    return eff.str + eff.agi + eff.con + eff.int + eff.spr + eff.luk;
  }
}
