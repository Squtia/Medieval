import { AdventurerState, Attributes, Equipment, EquipmentSlot, JobConfig, TraitConfig, CombatStats, FormationRow, OfficeType, WeaponType } from './types';
import { Random } from '../core/Random';

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
  // OPT-02: RESTING 狀態剩餘天數
  public restingDaysLeft: number;

  // 戰鬥陣位
  public formationRow: FormationRow;

  // 軍階官職 (Military Office)
  public office: OfficeType | null;

  public quality: 'N' | 'R' | 'SR' | 'SSR';

  constructor(id: string, name: string, job: JobConfig, trait: TraitConfig, quality: 'N' | 'R' | 'SR' | 'SSR' = 'N') {
    this.id = id;
    this.name = name;
    this.level = 1;
    this.xp = 0;
    this.job = job;
    this.trait = trait;
    this.quality = quality;

    // 1. 根據品質段範圍隨機抽取六維總合（套用加權隨機抽取，讓偏大的極品數值機率遞減）
    let minSum = 35;
    let maxSum = 52;
    switch (quality) {
      case 'N': minSum = 35; maxSum = 52; break;
      case 'R': minSum = 45; maxSum = 65; break;
      case 'SR': minSum = 58; maxSum = 78; break;
      case 'SSR': minSum = 72; maxSum = 95; break;
    }

    // 權重隨機分布抽取 X
    const possibleValues: number[] = [];
    const weights: number[] = [];
    for (let i = minSum; i <= maxSum; i++) {
      possibleValues.push(i);
      weights.push(maxSum - i + 1); // 數值越高，權重越小
    }
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Random.next() * totalWeight;
    let targetSum = minSum;
    for (let i = 0; i < possibleValues.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        targetSum = possibleValues[i];
        break;
      }
    }

    // 2. 依照職業原生的六維比例，將總合按權重分配到六維屬性上
    const keys: (keyof Attributes)[] = ['str', 'agi', 'con', 'int', 'spr', 'luk'];
    const jobWeights = keys.map(k => job.baseAttributes[k] || 1);
    const totalJobWeight = jobWeights.reduce((a, b) => a + b, 0);

    const attrs: any = {};
    let allocatedSum = 0;
    keys.forEach((key, idx) => {
      const val = Math.max(1, Math.round((jobWeights[idx] / totalJobWeight) * targetSum));
      attrs[key] = val;
      allocatedSum += val;
    });

    // 3. 微調使六維總合精確等於 targetSum 且皆 >= 1
    let safety = 0;
    while (allocatedSum !== targetSum && safety < 500) {
      safety++;
      const diff = targetSum - allocatedSum;
      const step = diff > 0 ? 1 : -1;
      const randomKey = Random.pick(keys);
      if (step === -1 && attrs[randomKey] <= 1) continue;

      attrs[randomKey] += step;
      allocatedSum += step;
    }

    // 4. 魅力與統帥根據品質段給予獨立隨機加成
    let chmCmdMin = 1;
    let chmCmdMax = 3;
    switch (quality) {
      case 'N': chmCmdMin = 1; chmCmdMax = 3; break;
      case 'R': chmCmdMin = 2; chmCmdMax = 4; break;
      case 'SR': chmCmdMin = 3; chmCmdMax = 5; break;
      case 'SSR': chmCmdMin = 5; chmCmdMax = 8; break;
    }
    attrs.charm = Random.int(chmCmdMin, chmCmdMax);
    attrs.command = Random.int(chmCmdMin, chmCmdMax);

    this.baseAttributes = attrs as Attributes;
    this.unspentStatPoints = 0;

    this.equipment = {};
    this.currentState = AdventurerState.IDLE;
    this.dispatchEndTime = null;
    this.restingDaysLeft = 0;
    this.office = null;
    
    // 預設戰士、騎士類近戰職業在前排，法師、弓箭手在後排
    if (job.name.includes('戰士') || job.name.includes('騎士') || job.name.includes('守衛') || job.name.includes('刺客')) {
      this.formationRow = FormationRow.FRONT;
    } else {
      this.formationRow = FormationRow.BACK;
    }
  }

  /**
   * 取得傭兵目前的職業名稱 (動態檢定)
   * 根據裝備的武器類型，決定是否轉變為進階變異職業
   */
  public get currentClass(): string {
    const baseClass = this.job.name;
    const weapon = this.equipment[EquipmentSlot.WEAPON];
    const wt = weapon?.weaponType;
    
    switch (baseClass) {
      case '戰士':
        if (wt === WeaponType.DUAL_BLADES) return '魔劍士';
        return baseClass; // 巨劍預設
      case '騎士':
        if (wt === WeaponType.RUNE_SHIELD) return '符文騎士';
        return baseClass; // 劍盾預設
      case '法師':
        if (wt === WeaponType.SCYTHE) return '戰鬥法師';
        return baseClass; // 法杖預設
      case '盜賊':
        if (wt === WeaponType.MAGIC_RING) return '詭術師';
        return baseClass; // 雙匕首預設
      case '祈禱者':
        if (wt === WeaponType.HAMMER) return '異端拷問者';
        return baseClass; // 聖典預設
      case '弓箭手':
        if (wt === WeaponType.MAGIC_BOW) return '精靈使';
        if (wt === WeaponType.BOW) return '神射手';
        return baseClass;
      default:
        return baseClass;
    }
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
   * 判斷該傭兵是否滿足裝備條件
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

  /**
   * 取得跑商特長數據 (Trade Stats)
   * 根據智慧與魅力計算載重量與議價能力
   */
  public getTradeStats(): { maxCargoWeight: number; negotiationBonus: number } {
    const attr = this.getEffectiveAttributes();
    // 魅力加智慧的總和乘上 5 作為基礎載重
    const maxCargoWeight = (attr.charm + attr.int) * 5;
    // BAL-02: 分母改為 100，譲議價加成真正可感知
    const negotiationBonus = Math.min(0.2, (attr.charm + attr.int) / 100); 
    return { maxCargoWeight, negotiationBonus };
  }
}
