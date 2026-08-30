import { AdventurerState, Attributes, Equipment, EquipmentSlot, JobConfig, TraitConfig, CombatStats, FormationRow, OfficeType, WeaponType, Gender, SCALING_MULTIPLIERS, ScalingTier, EquipmentScaling } from './types';
import { Random } from '../core/Random';
import { GambitRule } from './Gambit';

export class Adventurer {
  public id: string;
  public name: string;
  public level: number;
  public xp: number;
  
  public job: JobConfig;
  public trait: TraitConfig;
  public gender: Gender;
  
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
  public isAdvanced: boolean;
  public gambits: GambitRule[];

  // 戰鬥陣位
  public formationRow: FormationRow;

  // 軍階官職 (Military Office)
  public office: OfficeType | null;
  public stationedNodeId: string | null; // 被派駐擔任官職的據點 ID
  public locationNodeId: string | null; // 目前實際所在的據點 ID
  public avatarIndex: number; // 0-24, 對應 5x5 的半身像 Spritesheet

  public quality: 'N' | 'R' | 'SR' | 'SSR' | 'UR';
  public isGuardian: boolean = false;
  public customSkills?: string[];
  public avatarIcon?: string;

  // 🏥 持久生命、魔力與傷病狀態 (Persistent Vitals & Injury System)
  public currentHp?: number;
  public currentMp?: number;
  public isWounded: boolean = false;
  public inInfirmaryBed: boolean = false;

  constructor(id: string, name: string, job: JobConfig, trait: TraitConfig, quality: 'N' | 'R' | 'SR' | 'SSR' | 'UR' = 'N', gender?: Gender, isGuardian: boolean = false) {
    this.id = id;
    this.name = name;
    this.level = 1;
    this.xp = 0;
    this.job = job;
    this.trait = trait;
    this.quality = quality;
    this.isGuardian = isGuardian;
    // 預設隨機分配性別，後續可以透過 Object.assign 被覆蓋 (存檔讀取)
    this.gender = gender ?? (Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE);
    this.avatarIndex = isGuardian ? Math.floor(Math.random() * 5) : Math.floor(Math.random() * 25);

    // 1. 根據品質段範圍隨機抽取六維總合（套用加權隨機抽取，讓偏大的極品數值機率遞減）
    let minSum = 35;
    let maxSum = 52;
    switch (quality) {
      case 'N': minSum = 35; maxSum = 52; break;
      case 'R': minSum = 45; maxSum = 65; break;
      case 'SR': minSum = 58; maxSum = 78; break;
      case 'SSR': minSum = 72; maxSum = 95; break;
      case 'UR': minSum = 90; maxSum = 115; break;
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
    this.isAdvanced = false;
    this.gambits = [];
    this.formationRow = FormationRow.FRONT;
    this.office = null;
    this.stationedNodeId = null;
    this.locationNodeId = null;
    
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
    // 未達 10 等或未開啟轉職開關，皆維持基礎職業
    if (!this.isAdvanced || this.level < 10) return baseClass;

    const weapon = this.equipment[EquipmentSlot.WEAPON];
    const wt = weapon?.weaponType;
    
    switch (baseClass) {
      case '戰士':
        if (wt === WeaponType.DUAL_SWORDS) return '魔劍士';
        if (wt === WeaponType.GREATSWORD) return '狂戰士';
        return baseClass;
      case '騎士':
        if (wt === WeaponType.RUNE_SHIELD) return '符文騎士';
        if (wt === WeaponType.SWORD_AND_SHIELD) return '聖騎士';
        return baseClass;
      case '法師':
        if (wt === WeaponType.SCYTHE) return '死靈法師';
        if (wt === WeaponType.STAFF) return '大魔導士';
        return baseClass;
      case '盜賊':
        if (wt === WeaponType.MAGIC_RING) return '詭術師';
        if (wt === WeaponType.DAGGERS) return '暗殺者';
        return baseClass;
      case '祈禱者':
        if (wt === WeaponType.HAMMER) return '異端拷問者';
        if (wt === WeaponType.HOLY_BOOK) return '大主教';
        return baseClass;
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
    return Math.floor(200 * this.level * this.trait.xpModifier);
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
   * 進行轉職
   * 成功轉職後 isAdvanced 設為 true，並回傳提示訊息
   */
  public advance(): string {
    if (this.level < 10) return "等級未達要求。";
    if (this.isAdvanced) return "已經完成轉職。";
    this.isAdvanced = true;
    return `轉職試煉通過！${this.name} 潛能解放，獲得了進階職業的專屬技能與被動！`;
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
    return true;
  }

  /**
   * 取得「實際六維屬性」
   * 包含：基礎屬性 + 裝備加成，最後再乘上性格百分比修正
   * @param excludeSlot (選填) 在計算時排除指定槽位的裝備，用於 canEquip 預判
   */
  public getEffectiveAttributes(excludeSlot?: EquipmentSlot, tempAllocations?: Partial<Attributes>): Attributes {
    // 1. 取得基礎屬性拷貝
    const effective: Attributes = { ...this.baseAttributes };

    if (tempAllocations) {
      effective.str += tempAllocations.str || 0;
      effective.agi += tempAllocations.agi || 0;
      effective.con += tempAllocations.con || 0;
      effective.int += tempAllocations.int || 0;
      effective.spr += tempAllocations.spr || 0;
      effective.luk += tempAllocations.luk || 0;
      effective.charm += tempAllocations.charm || 0;
      effective.command += tempAllocations.command || 0;
    }

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
    const traitMods = this.trait.statMultipliers || {};
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
   * 計算並取得實際的戰鬥派生屬性 (物魔雙軌制)
   */
  public getCombatStats(excludeSlot?: EquipmentSlot, tempAllocations?: Partial<Attributes>): CombatStats {
    const attr = this.getEffectiveAttributes(excludeSlot, tempAllocations);
    
    // 基礎衍生存活數值
    const baseHp = attr.con * 10;
    const baseMp = attr.spr * 5;
    const baseHit = attr.agi * 2 + attr.luk;
    const baseEvade = attr.agi * 1 + attr.luk;
    const baseSpeed = attr.agi;

    let basePatk = 0;
    let baseMatk = 0;
    let basePdef = 0;
    let baseMdef = 0;

    const getMultiplier = (tier?: ScalingTier): number => {
      if (!tier) return 0;
      return SCALING_MULTIPLIERS[tier] || 0;
    };

    const weapon = this.equipment[EquipmentSlot.WEAPON];
    const armor = this.equipment[EquipmentSlot.ARMOR];

    // 向後相容：處理舊存檔中沒有 scaling 屬性的裝備
    const getFallbackWeaponScaling = (wType?: string): EquipmentScaling => {
      if (wType === 'GREATSWORD') return { patk: { str: 'C' } };
      if (wType === 'DUAL_SWORDS') return { patk: { str: 'C' }, matk: { int: 'C' } };
      if (wType === 'BOW') return { patk: { agi: 'C' } };
      if (wType === 'MAGIC_BOW') return { patk: { agi: 'C' }, matk: { int: 'C' } };
      if (wType === 'DAGGERS') return { patk: { agi: 'C' } };
      if (wType === 'MAGIC_RING') return { matk: { int: 'C' } };
      if (wType === 'STAFF') return { matk: { int: 'C' } };
      if (wType === 'SCYTHE') return { matk: { int: 'C' } };
      if (wType === 'SWORD_AND_SHIELD') return { patk: { con: 'C' } };
      if (wType === 'RUNE_SHIELD') return { patk: { con: 'C' }, matk: { spr: 'C' } };
      if (wType === 'HOLY_BOOK') return { matk: { spr: 'C' } };
      if (wType === 'HAMMER') return { patk: { str: 'C' }, matk: { spr: 'C' } };
      return { patk: { str: 'C' }, matk: { int: 'C' } };
    };

    const getFallbackArmorScaling = (aType?: string): EquipmentScaling => {
      if (aType === 'CLOTH') return { mdef: { spr: 'C' } };
      if (aType === 'LEATHER') return { pdef: { luk: 'C' }, mdef: { luk: 'C' } };
      if (aType === 'HEAVY') return { pdef: { con: 'C' } };
      return { pdef: { con: 'C' }, mdef: { spr: 'C' } };
    };

    // 計算武器屬性補正
    const weaponScaling = weapon?.scaling || getFallbackWeaponScaling(weapon?.weaponType);
    if (weaponScaling.patk) {
       for (const [key, tier] of Object.entries(weaponScaling.patk)) {
          basePatk += attr[key as keyof Attributes] * getMultiplier(tier as ScalingTier);
       }
    }
    if (weaponScaling.matk) {
       for (const [key, tier] of Object.entries(weaponScaling.matk)) {
          baseMatk += attr[key as keyof Attributes] * getMultiplier(tier as ScalingTier);
       }
    }

    // 計算防具屬性補正
    const armorScaling = armor?.scaling || getFallbackArmorScaling(armor?.armorType);
    if (armorScaling.pdef) {
       for (const [key, tier] of Object.entries(armorScaling.pdef)) {
          basePdef += attr[key as keyof Attributes] * getMultiplier(tier as ScalingTier);
       }
    }
    if (armorScaling.mdef) {
       for (const [key, tier] of Object.entries(armorScaling.mdef)) {
          baseMdef += attr[key as keyof Attributes] * getMultiplier(tier as ScalingTier);
       }
    }

    basePatk = Math.floor(basePatk);
    baseMatk = Math.floor(baseMatk);
    basePdef = Math.floor(basePdef);
    baseMdef = Math.floor(baseMdef);

    const weaponType = weapon?.weaponType;

    let critChance = 0.05 + (baseHit / 500);
    let critMult = 1.5;
    if (this.isAdvanced && this.level >= 10) {
      if (weaponType === WeaponType.BOW) {
        critChance += 0.20;
        critMult = 2.0;
      } else if (weaponType === WeaponType.MAGIC_BOW) {
        critChance += 0.25;
      } else if (weaponType === WeaponType.DAGGERS) {
        critChance += 0.10;
      }
    }

    const stats: CombatStats = {
      hp: baseHp,
      mp: baseMp,
      patk: basePatk,
      matk: baseMatk,
      pdef: basePdef,
      mdef: baseMdef,
      hit: baseHit,
      evade: baseEvade,
      speed: baseSpeed,
      critRate: Math.round(critChance * 100),
      critDmg: Math.round(critMult * 100),
      atk: Math.max(basePatk, baseMatk),
      def: basePdef
    };

    // 疊加裝備直接提供的戰鬥屬性加成 (combatEffects)
    for (const slot of Object.values(EquipmentSlot)) {
      if (excludeSlot === slot) continue;
      const equip = this.equipment[slot as EquipmentSlot];
      if (equip && equip.combatEffects) {
        stats.hp += equip.combatEffects.hp || 0;
        stats.mp += equip.combatEffects.mp || 0;
        stats.patk += (equip.combatEffects.patk || 0) + (equip.combatEffects.atk || 0);
        stats.matk += (equip.combatEffects.matk || 0) + (equip.combatEffects.atk || 0);
        stats.pdef += (equip.combatEffects.pdef || 0) + (equip.combatEffects.def || 0);
        stats.mdef += (equip.combatEffects.mdef || 0) + (equip.combatEffects.def || 0);
        stats.hit += equip.combatEffects.hit || 0;
        stats.evade += equip.combatEffects.evade || 0;
        stats.speed += equip.combatEffects.speed || 0;
        stats.critRate += equip.combatEffects.critRate || 0;
      }
    }

    stats.critRate = Math.min(90, stats.critRate);
    stats.atk = Math.max(stats.patk, stats.matk);
    stats.def = stats.pdef;

    // 🩸 重傷 Debuff 懲罰：戰鬥輸出與防禦降低 20%，速度降低 30%
    if (this.isWounded) {
      stats.patk = Math.max(1, Math.floor(stats.patk * 0.8));
      stats.matk = Math.max(1, Math.floor(stats.matk * 0.8));
      stats.pdef = Math.max(1, Math.floor(stats.pdef * 0.8));
      stats.mdef = Math.max(1, Math.floor(stats.mdef * 0.8));
      stats.speed = Math.max(1, Math.floor(stats.speed * 0.7));
      stats.atk = Math.max(stats.patk, stats.matk);
      stats.def = stats.pdef;
    }

    return stats;
  }

  /**
   * 🏥 取得傭兵即時持久 HP (單一真相來源保護)
   */
  public getCurrentHp(): number {
    const max = this.getCombatStats().hp;
    if (this.currentHp === undefined || isNaN(this.currentHp)) {
      this.currentHp = max;
    }
    return Math.max(1, Math.min(this.currentHp, max));
  }

  /**
   * 🔮 取得傭兵即時持久 MP
   */
  public getCurrentMp(): number {
    const max = this.getCombatStats().mp;
    if (this.currentMp === undefined || isNaN(this.currentMp)) {
      this.currentMp = max;
    }
    return Math.max(0, Math.min(this.currentMp, max));
  }

  /**
   * 🩸 設定傭兵即時 HP (血量達 80% 自動痊癒解除重傷)
   */
  public setCurrentHp(val: number): void {
    const max = this.getCombatStats().hp;
    this.currentHp = Math.max(1, Math.min(val, max));
    if (this.currentHp >= Math.floor(max * 0.8) && this.isWounded) {
      this.isWounded = false;
    }
  }

  /**
   * 🔮 設定傭兵即時 MP
   */
  public setCurrentMp(val: number): void {
    const max = this.getCombatStats().mp;
    this.currentMp = Math.max(0, Math.min(val, max));
  }

  /**
   * ✨ 治療與回復生命/魔力
   */
  public heal(hpAmount: number, mpAmount: number = 0): void {
    const maxHp = this.getCombatStats().hp;
    const maxMp = this.getCombatStats().mp;
    const curHp = this.getCurrentHp();
    const curMp = this.getCurrentMp();
    this.setCurrentHp(Math.min(maxHp, curHp + hpAmount));
    this.setCurrentMp(Math.min(maxMp, curMp + mpAmount));
  }

  /**
   * 🩸 戰鬥中陣亡或戰敗，陷入重傷瀕死狀態
   */
  public applyWound(): void {
    this.isWounded = true;
    this.currentHp = 1;
    this.currentMp = 0;
  }

  /**
   * 🛡️ 邊界保護：當裝備更換或升級使得 MaxHP 變動時，防溢出保護
   */
  public validateHpMpLimits(): void {
    const stats = this.getCombatStats();
    if (this.currentHp !== undefined) {
      this.currentHp = Math.min(this.currentHp, stats.hp);
    }
    if (this.currentMp !== undefined) {
      this.currentMp = Math.min(this.currentMp, stats.mp);
    }
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

    // 職業限制檢定
    if (item.allowedJobs && item.allowedJobs.length > 0) {
      if (!item.allowedJobs.includes(this.job.name)) {
        reasons.push(`職業不符 (限 ${item.allowedJobs.join('/')})`);
      }
    }

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
   * 大一統綜合戰力 (客觀反映實戰有效攻擊、防禦、HP、MP 與速度)
   */
  public getPower(tempAllocations?: Partial<Attributes>): number {
    const combatStats = this.getCombatStats(undefined, tempAllocations);
    const effAtk = Math.max(combatStats.patk, combatStats.matk, Math.floor((combatStats.patk + combatStats.matk) / 2));
    const avgDef = Math.floor((combatStats.pdef + combatStats.mdef) / 2);
    
    return effAtk + 
      Math.floor(avgDef * 0.6) + 
      Math.floor(combatStats.hp * 0.2) + 
      Math.floor((combatStats.mp || 0) * 0.1) + 
      Math.floor(combatStats.speed * 0.5);
  }

  public get power(): number {
    return this.getPower();
  }

  /**
   * 取得跑商特長數據 (Trade Stats)
   * 根據智慧與魅力計算載重量與議價能力
   */
  public getTradeStats(): { maxCargoWeight: number; negotiationBonus: number } {
    const attr = this.getEffectiveAttributes();
    // 魅力加智慧的總和乘上 5 作為基礎載重
    const maxCargoWeight = (attr.charm + attr.int) * 5;
    // BAL-02: 魅力與智慧提供 1%~5% 議價特長 (單人上限 5%)
    const negotiationBonus = Math.min(0.05, Number(((attr.charm + attr.int) / 400).toFixed(3))); 
    return { maxCargoWeight, negotiationBonus };
  }
}
