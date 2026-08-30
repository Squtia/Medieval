import { Faction, MonsterInstance, MonsterRace, ElementType, FactionChampionInstance, CustomCombatGroup, MonsterData } from '../../models/types';
import { MonsterSystem } from '../MonsterSystem';
import monstersJson from '../../data/monsters.json';
import { GameState } from '../../core/GameState';
import { Random } from '../../core/Random';
import { findHeroDef } from '../../data/UniqueAdventurers';

export class FactionArmyGenerator {
  /**
   * 取得陣營的前綴標籤，方便日後設計平衡與增加沉浸感
   */
  public static getFactionTag(factionId: string): string {
    switch (factionId) {
      case 'f_lothgar': return '[洛斯加]';
      case 'f_vormund': return '[沃爾蒙德]';
      case 'f_hurst': return '[神聖教廷]';
      case 'f_bellavia': return '[金流商會]';
      case 'f_dusk': return '[深淵礦業]';
      case 'f_oakhaven': return '[橡木谷]';
      case 'f_blackwood': return '[黑木]';
      default: return '[陣營]';
    }
  }

  /**
   * 取得陣營偏好的元素類型
   */
  public static getFactionElement(factionId: string): ElementType {
    switch (factionId) {
      case 'f_hurst': return Random.next() < 0.7 ? ElementType.HOLY : ElementType.NONE;
      case 'f_lothgar': return ElementType.NONE;
      case 'f_vormund': return Random.next() < 0.2 ? ElementType.ICE : ElementType.NONE;
      case 'f_bellavia': return Random.next() < 0.3 ? ElementType.DARK : ElementType.NONE; // 毒藥暗殺
      case 'f_dusk': return Random.next() < 0.3 ? ElementType.FIRE : ElementType.NONE; // 熔爐
      default: return ElementType.NONE;
    }
  }

  /**
   * 生成派系軍隊 (取代一般野怪)
   * 根據派系特色，混編前排步兵、後排遠程/法系，甚至戰獸
   */
  public static generateArmy(factionId: string, baseDifficulty: number, count: number): MonsterInstance[] {
    const factionTag = this.getFactionTag(factionId);
    const element = this.getFactionElement(factionId);
    const monsterSys = new MonsterSystem();
    const result: MonsterInstance[] = [];

    const exclusiveIds = ['faction_infantry', 'faction_spearman', 'faction_crossbowman', 'faction_knight', 'faction_mage', 'faction_siege_weapon'];
    const factionTemplates = monstersJson.filter((m: any) => exclusiveIds.includes(m.id));
    const beastTemplates = monstersJson.filter((m: any) => m.compatibleRaces.includes('MONSTER') && m.terrains.length > 0);

    for (let i = 0; i < count; i++) {
      let templateStr;
      let race = MonsterRace.HUMAN;

      // 陣營特色兵種邏輯
      if (factionId === 'f_vormund' && Random.next() < 0.2) {
        // 北境沃爾蒙德大公偶爾會混編戰獸
        templateStr = Random.pick(beastTemplates);
        race = MonsterRace.MONSTER;
      } else {
        // 正規軍抽取 (純軍事單位)
        templateStr = Random.pick(factionTemplates);
      }

      if (!templateStr) {
        templateStr = monstersJson[0]; 
      }

      if (templateStr.id === 'faction_siege_weapon') {
         race = MonsterRace.MONSTER; // 器械被視為攻城單位
      }

      const instance = monsterSys.createMonsterInstance(templateStr as any, race, element, baseDifficulty);
      
      // 確保該單位帶有 {洛斯加} 之類的標註
      instance.name = `${factionTag} ${instance.name}`;
      
      // 套用陣營專屬數值加成
      this.applyFactionBuffs(factionId, instance);

      result.push(instance);
    }

    return result;
  }

  /**
   * 根據所屬陣營，為基礎兵種賦予特色數值加成
   * 讓即便是相同的基礎兵種 (如: 鐵甲衛)，在不同陣營也會有不同表現
   */
  private static applyFactionBuffs(factionId: string, instance: MonsterInstance): void {
    switch (factionId) {
      case 'f_lothgar':
        // 洛斯加王室：重視重裝與陣型，防禦力極高，但速度/閃避偏低
        instance.defense = Math.floor(instance.defense * 1.3);
        instance.hp = Math.floor(instance.hp * 1.1);
        instance.evade = 0;
        break;
      case 'f_vormund':
        // 沃爾蒙德 (熔岩鍛爐)：狂暴與高壓統治，攻擊力極高，捨棄防禦
        instance.damage = Math.floor(instance.damage * 1.4);
        instance.defense = Math.floor(instance.defense * 0.8);
        break;
      case 'f_hurst':
        // 赫斯特 (北境神聖教廷)：狂熱信仰，魔防極高，且自帶部分神聖抗性
        instance.hp = Math.floor(instance.hp * 1.2);
        // 若系統未來有獨立魔防，可在此加成；目前以血量與自帶元素替代
        break;
      case 'f_bellavia':
        // 貝拉維亞 (西境商會)：暗殺與用毒，擁有高閃避與爆發傷害
        instance.evade = Math.min(500, instance.evade + 20);
        instance.damage = Math.floor(instance.damage * 1.2);
        break;
      case 'f_dusk':
        // 達斯克 (赤砂荒漠)：血汗礦工，血量極多但攻擊力較低
        instance.hp = Math.floor(instance.hp * 1.5);
        instance.damage = Math.floor(instance.damage * 0.9);
        break;
    }
  }

  /**
   * 生成攻城/守城戰陣容 (包含傳奇騎士/傭兵 Boss)
   */
  public static generateSiegeEncounter(faction: Faction, baseDifficulty: number, armyCount: number): (MonsterInstance | FactionChampionInstance)[] {
    const army = this.generateArmy(faction.id, baseDifficulty, armyCount);
    
    // 找出尚未被俘虜或陣亡的武將
    if (faction.champions && faction.champions.length > 0) {
      const availableChampions = faction.champions.filter(c => 
        !(faction.capturedChampionIds?.includes(c.id)) && 
        !(faction.defeatedChampionIds?.includes(c.id))
      );

      if (availableChampions.length > 0) {
        // 挑選最高戰力的武將作為主將
        const boss = availableChampions.reduce((prev, current) => (prev.powerTier > current.powerTier) ? prev : current);
        
        // 將 Champion 轉換為戰鬥實體 (FactionChampionInstance extends MonsterInstance conceptually)
        const powerScore = Math.max(50, baseDifficulty * boss.powerTier * 8);
        const bossInstance: any = {
          ...boss,
          id: boss.id,
          name: `[傳奇] ${boss.name}`, // 特殊 Boss 前綴
          race: MonsterRace.HUMAN,
          element: this.getFactionElement(faction.id),
          hp: Math.floor(powerScore * 6),
          damage: Math.floor(powerScore * 0.8),
          defense: Math.floor(powerScore * 2.0),
          evade: 20,
          calculatedPowerScore: powerScore,
          skills: [boss.jobId + '_ULTIMATE'], // 示意：給予特殊大招
          // 為了相容 CombatParticipant，給予基礎怪物的特徵
          baseStats: { patk: Math.floor(powerScore * 0.8), matk: Math.floor(powerScore * 0.8), pdef: Math.floor(powerScore * 2), mdef: Math.floor(powerScore * 2) },
          level: boss.powerTier * 5,
        };

        // 將 Boss 插入陣容中 (作為最後一隻，通常是陣位最後)
        army.push(bossInstance);
      }
    }

    return army;
  }

  /**
   * 根據原怪物定位與陣營，客觀演算法挑選最佳代理副將
   * 規則：同攻擊型態 (MELEE/RANGED/MAGIC) + 人類正規軍 (HUMAN) + 非Boss + powerTier 最高者
   */
  public static getBestSubstituteMonsterId(originalDef?: MonsterData, _factionId?: string): string {
    const targetAttackType = originalDef?.attackType || 'MELEE';
    
    // 1. 優先從人類正規軍中過濾符合攻擊型態之士兵
    const candidates = (monstersJson as MonsterData[]).filter(m => 
      m.race === MonsterRace.HUMAN && 
      !m.isBoss && 
      !m.characterKey && // 代理副將不能也是具名英雄
      m.attackType === targetAttackType
    );

    if (candidates.length > 0) {
      // 依 powerTier 降序排序，取最高戰力者
      candidates.sort((a, b) => (b.powerTier || 0) - (a.powerTier || 0));
      return candidates[0].id;
    }

    // 2. 次選保底：通用人類正規士兵 (不限攻擊型態)
    const fallbackHumans = (monstersJson as MonsterData[]).filter(m => m.race === MonsterRace.HUMAN && !m.isBoss && !m.characterKey);
    if (fallbackHumans.length > 0) {
      fallbackHumans.sort((a, b) => (b.powerTier || 0) - (a.powerTier || 0));
      return fallbackHumans[0].id;
    }

    // 3. 終極保底
    return 'bandit';
  }

  /**
   * 從目前領地的冒險者、俘虜與陣亡名單中，自動構建不可用角色 Set (包含 characterKey, boundMonsterId, heroId)
   */
  public static buildUnavailableCharacterSet(
    adventurers: { id: string; characterKey?: string; boundMonsterId?: string }[] = [],
    prisoners: { id: string; characterKey?: string; boundMonsterId?: string }[] = [],
    deadCharacters: string[] = []
  ): Set<string> {
    const set = new Set<string>(deadCharacters);
    const collect = (list: { id: string; characterKey?: string; boundMonsterId?: string }[]) => {
      for (const item of list) {
        if (item.characterKey) set.add(item.characterKey);
        if (item.boundMonsterId) set.add(item.boundMonsterId);
        if (item.id) {
          set.add(item.id);
          const heroDef = findHeroDef(item.id);
          if (heroDef) {
            if (heroDef.characterKey) set.add(heroDef.characterKey);
            if (heroDef.boundMonsterId) set.add(heroDef.boundMonsterId);
            set.add(heroDef.id);
          }
        }
      }
    };
    collect(adventurers);
    collect(prisoners);
    return set;
  }

  /**
   * 解析並生成部隊單一成員實體 (支援唯一英雄被俘/招募後的動態副將接替)
   * @param monsterId 原始配置的怪物/首領 ID
   * @param factionId 所屬陣營 ID
   * @param unavailableCharacters 已被玩家俘虜、已招募入隊或已死亡的角色 characterKey / boundMonsterId 集合
   * @param baseDifficulty 難度等級
   */
  public static resolveTroopMember(
    monsterId: string,
    factionId: string = 'f_lothgar',
    unavailableCharacters?: Set<string>,
    baseDifficulty: number = 1
  ): MonsterInstance {
    const monsterSys = new MonsterSystem();
    const allDefs = monstersJson as MonsterData[];
    const originalDef = allDefs.find(m => m.id === monsterId);

    // 檢查是否為具名角色且當前不可用 (已被玩家俘虜、招募或陣亡)
    // 支援 1: 透過 characterKey 判定
    // 支援 2: 英雄方直接設定 boundMonsterId (怪物方無需重複設定)
    const isCharacterUnavailable = (
      (originalDef?.characterKey && unavailableCharacters?.has(originalDef.characterKey)) ||
      (originalDef?.id && unavailableCharacters?.has(originalDef.id))
    );

    if (isCharacterUnavailable && originalDef) {
      // 觸發動態副將接替 (Dynamic Vice-Commander Substitution)
      let substituteId = originalDef.substituteMonsterId;
      if (!substituteId || !allDefs.some(m => m.id === substituteId)) {
        substituteId = this.getBestSubstituteMonsterId(originalDef, factionId);
      }

      const subDef = allDefs.find(m => m.id === substituteId) || allDefs[0];
      const element = this.getFactionElement(factionId);
      const instance = monsterSys.createMonsterInstance(subDef, MonsterRace.HUMAN, element, baseDifficulty);
      
      const factionTag = this.getFactionTag(factionId);
      instance.name = `${factionTag} 【代理副將】${instance.name}`;
      this.applyFactionBuffs(factionId, instance);
      return instance;
    }

    // 正常生成原始實體
    const targetDef = originalDef || allDefs[0];
    const race = targetDef.race || MonsterRace.HUMAN;
    const element = targetDef.defaultElement || this.getFactionElement(factionId);
    const instance = monsterSys.createMonsterInstance(targetDef, race, element, baseDifficulty);

    const factionTag = this.getFactionTag(factionId);
    if (!instance.name.startsWith('[')) {
      instance.name = `${factionTag} ${instance.name}`;
    }
    this.applyFactionBuffs(factionId, instance);
    return instance;
  }

  /**
   * 將據點工坊自訂戰鬥團體 (CustomCombatGroup) 實例化為戰鬥怪物實體陣列
   * 保證工坊原始藍圖唯讀隔離，並自動套用動態副將接替引擎
   */
  public static instantiateCombatGroup(
    group: CustomCombatGroup,
    factionId: string = 'f_lothgar',
    unavailableCharacters?: Set<string>,
    baseDifficulty: number = 1
  ): MonsterInstance[] {
    return (group.monsterIds || []).map(id => 
      this.resolveTroopMember(id, factionId, unavailableCharacters, baseDifficulty)
    );
  }
}
