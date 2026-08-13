import { Faction, MonsterInstance, MonsterRace, ElementType, FactionChampionInstance } from '../../models/types';
import { MonsterSystem } from '../MonsterSystem';
import monstersJson from '../../data/monsters.json';
import { GameState } from '../../core/GameState';
import { Random } from '../../core/Random';

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
        // 沃爾蒙德 (北境)：狂暴與高壓統治，攻擊力極高，捨棄防禦
        instance.damage = Math.floor(instance.damage * 1.4);
        instance.defense = Math.floor(instance.defense * 0.8);
        break;
      case 'f_hurst':
        // 赫斯特 (神聖教廷)：狂熱信仰，魔防極高，且自帶部分神聖抗性
        instance.hp = Math.floor(instance.hp * 1.2);
        // 若系統未來有獨立魔防，可在此加成；目前以血量與自帶元素替代
        break;
      case 'f_bellavia':
        // 貝拉維亞 (南境)：暗殺與用毒，擁有高閃避與爆發傷害
        instance.evade = Math.min(500, instance.evade + 20);
        instance.damage = Math.floor(instance.damage * 1.2);
        break;
      case 'f_dusk':
        // 達斯克 (西境)：血汗礦工，血量極多但攻擊力較低
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
}
