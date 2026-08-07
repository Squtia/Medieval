import { TerrainType, MonsterData, MonsterRace, MonsterInstance, ElementType, MapNode, StrongholdAffix } from '../models/types';
import { Random } from '../core/Random';
import monstersJson from '../data/monsters.json';

import nestNamesJson from '../data/nestNames.json';

export class MonsterSystem {
  private monsters: MonsterData[] = [];

  constructor() {
    this.monsters = monstersJson as MonsterData[];
  }

  /**
   * 從 nestNames.json 詞庫檔中依據種族隨機抽取據點名稱後綴
   */
  public getNestSuffix(race?: MonsterRace): string {
    if (race && (nestNamesJson.raceSuffixes as any)[race]) {
      const list = (nestNamesJson.raceSuffixes as any)[race] as string[];
      if (list && list.length > 0) return Random.pick(list);
    }
    return Random.pick(nestNamesJson.defaultSuffixes || ['巢穴']);
  }

  /**
   * 取得元素前綴標籤
   */
  private getElementPrefix(element: ElementType): string {
    switch (element) {
      case ElementType.FIRE: return '[火焰的]';
      case ElementType.ICE: return '[冰冷的]';
      case ElementType.LIGHTNING: return '[雷電的]';
      case ElementType.HOLY: return '[聖光的]';
      case ElementType.DARK: return '[黑暗的]';
      default: return '';
    }
  }

  /**
   * 取得種族質變前綴標籤
   * 規則：若單位允許 2 種以上標籤（含 UNDEAD）且抽到 UNDEAD，才冠上 [不死的]；單一允許 UNDEAD 則不冠前綴。
   */
  private getRacePrefix(raceTag: MonsterRace, compatibleRaces: MonsterRace[]): string {
    if (raceTag === MonsterRace.UNDEAD && compatibleRaces.length > 1) {
      return '[不死的]';
    }
    return '';
  }

  /**
   * 實例化單隻怪物，計算其質感名稱、元素、數值與屬性傾向
   */
  public createMonsterInstance(
    baseMonster: MonsterData,
    appliedRaceTag: MonsterRace,
    element: ElementType,
    baseDifficulty: number
  ): MonsterInstance {
    const elemPrefix = this.getElementPrefix(element);
    const racePrefix = this.getRacePrefix(appliedRaceTag, baseMonster.compatibleRaces);
    const fullName = `${elemPrefix}${racePrefix}${baseMonster.name}`;

    // 戰力權算 (powerScore)
    let raceMult = 1.0;
    if (appliedRaceTag === MonsterRace.UNDEAD) raceMult = 1.1;
    else if (appliedRaceTag === MonsterRace.DRAGON) raceMult = 2.0;

    const powerScore = Math.max(10, baseDifficulty * baseMonster.powerTier * raceMult * 6);

    // 根據種族分配數值傾向 (區分物防 pdefRatio 與魔防 mdefRatio)
    let hpRatio = 0.5;
    let atkRatio = 0.3;
    let pdefRatio = 0.15;
    let mdefRatio = 0.15;
    let evaRatio = 0.05;

    switch (appliedRaceTag) {
      case MonsterRace.UNDEAD:
        hpRatio = 0.6; atkRatio = 0.25; pdefRatio = 0.25; mdefRatio = 0.20; evaRatio = 0.0; break; // 高體質高物魔雙防低攻零閃
      case MonsterRace.MONSTER:
        hpRatio = 0.55; atkRatio = 0.35; pdefRatio = 0.14; mdefRatio = 0.08; evaRatio = 0.05; break; // 高攻中血中物防低魔防
      case MonsterRace.HUMAN:
        hpRatio = 0.45; atkRatio = 0.35; pdefRatio = 0.15; mdefRatio = 0.15; evaRatio = 0.1; break;  // 均衡型
      case MonsterRace.DRAGON:
        hpRatio = 0.45; atkRatio = 0.40; pdefRatio = 0.20; mdefRatio = 0.15; evaRatio = 0.05; break;   // 史詩高攻高物防中魔防
    }

    const hp = Math.floor(powerScore * hpRatio * 4.0);
    const damage = Math.floor(powerScore * atkRatio * 0.7);
    const pdef = Math.floor(powerScore * pdefRatio * 1.5);
    const mdef = Math.floor(powerScore * mdefRatio * 1.5);
    const defense = pdef; // 相容舊版欄位
    const evade = Math.min(0.5, powerScore * evaRatio * 0.001);

    return {
      ...baseMonster,
      name: fullName,
      race: appliedRaceTag,
      appliedRaceTag,
      element,
      hp,
      maxHp: hp,
      damage,
      defense,
      pdef,
      mdef,
      evade,
      calculatedPowerScore: powerScore,
      
      // 動態戰利品配置
      goldReward: Math.floor(powerScore * 1.5),
      expReward: Math.floor(powerScore * 1.2),
      equipmentDropRate: baseMonster.lootConfig ? baseMonster.lootConfig.equipmentDropRate : Math.min(0.15, powerScore * 0.001) // 預設 0.1% * score, 上限 15%
    };
  }

  /**
   * 根據地形、難度與主題生成整隊討伐遭遇 (支援單向隔離規則)
   * @param terrain 地形
   * @param baseDifficulty 難度基數
   * @param isNecroticTheme 是否為亡靈/邪教主題據點 (若為 false 嚴格排除 UNDEAD)
   */
  public generateEncounter(
    terrain: TerrainType,
    baseDifficulty: number,
    isNecroticTheme: boolean = false
  ): MonsterInstance[] {
    // 1. 單向隔離過濾原型與標籤
    let validMonsters = this.monsters.filter(m => m.terrains.includes(terrain) && !m.isBoss);
    
    if (validMonsters.length === 0) {
      validMonsters = this.monsters.filter(m => !m.isBoss);
    }

    if (!isNecroticTheme) {
      // 生靈據點：嚴格過濾排除單一 UNDEAD 怪物
      const livingMonsters = validMonsters.filter(m => m.race !== MonsterRace.UNDEAD || m.compatibleRaces.some(r => r !== MonsterRace.UNDEAD));
      if (livingMonsters.length > 0) validMonsters = livingMonsters;
    }

    // 2. 決定隊長與總戰力額度
    let selectedBase = validMonsters[0];
    const weights = validMonsters.map(m => m.race === MonsterRace.DRAGON ? 0.25 : 1.0);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Random.next() * totalWeight;
    for (let i = 0; i < validMonsters.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        selectedBase = validMonsters[i];
        break;
      }
    }

    const targetScore = Math.max(10, baseDifficulty * 12);
    let currentScore = 0;
    const encounter: MonsterInstance[] = [];
    
    // 定義抽出種族與元素的輔助函式
    const rollRaceAndElement = (monsterBase: MonsterData) => {
      let appliedRaceTag: MonsterRace = monsterBase.race;
      if (isNecroticTheme) {
        // 亡靈據點：70% 概率套用 UNDEAD (若怪性相容)
        if (monsterBase.compatibleRaces.includes(MonsterRace.UNDEAD) && Random.next() < 0.7) {
          appliedRaceTag = MonsterRace.UNDEAD;
        }
      } else {
        // 生靈據點：若相容有多個，排除 UNDEAD
        const livingRaces = monsterBase.compatibleRaces.filter(r => r !== MonsterRace.UNDEAD);
        appliedRaceTag = livingRaces.length > 0 ? Random.pick(livingRaces) : MonsterRace.MONSTER;
      }

      let element = monsterBase.defaultElement || ElementType.NONE;
      // 初期防呆：難度越高越容易出現元素變異 (baseDiff 2.0 開始出現，上限 40%)
      const elementMutationChance = Math.max(0, Math.min(0.4, (baseDifficulty - 1.5) * 0.15));
      if (element === ElementType.NONE && Random.next() < elementMutationChance) {
        const elements = [ElementType.FIRE, ElementType.ICE, ElementType.LIGHTNING, ElementType.HOLY, ElementType.DARK];
        element = Random.pick(elements);
      }
      return { appliedRaceTag, element };
    };

    // 3. 優先加入隊長
    const leaderTags = rollRaceAndElement(selectedBase);
    const leaderInstance = this.createMonsterInstance(selectedBase, leaderTags.appliedRaceTag, leaderTags.element, baseDifficulty);
    encounter.push(leaderInstance);
    currentScore += leaderInstance.calculatedPowerScore;

    // 4. 混編抽取剩餘隊員 (最多 5 隻)
    while (currentScore < targetScore * 0.9 && encounter.length < 5) {
      // 隨機抽取一個符合過濾條件的怪物
      const mixWeights = validMonsters.map(m => m.race === MonsterRace.DRAGON ? 0.25 : 1.0);
      const mixTotalWeight = mixWeights.reduce((a, b) => a + b, 0);
      let mixRand = Random.next() * mixTotalWeight;
      let mixedBase = validMonsters[0];
      for (let i = 0; i < validMonsters.length; i++) {
        mixRand -= mixWeights[i];
        if (mixRand <= 0) {
          mixedBase = validMonsters[i];
          break;
        }
      }

      const mixTags = rollRaceAndElement(mixedBase);
      const mixInstance = this.createMonsterInstance(mixedBase, mixTags.appliedRaceTag, mixTags.element, baseDifficulty);
      encounter.push(mixInstance);
      currentScore += mixInstance.calculatedPowerScore;
    }

    return encounter;
  }

  /**
   * 為特定地圖據點生成並持久化駐軍資訊 (確保偵查內容與戰鬥 100% 一致)
   */
  public generateNodeEncounter(node: MapNode): MonsterInstance[] {
    const isNecroticTheme = node.terrain === TerrainType.RUINS || node.name.includes('墓') || node.name.includes('深淵') || node.name.includes('無光');
    const baseDifficulty = node.baseDifficulty || 1.5;
    
    const encounter = this.generateEncounter(node.terrain, baseDifficulty, isNecroticTheme);

    // 隨機生成據點詞綴 (20% 機率)
    let affix: StrongholdAffix | undefined = undefined;
    if (Random.next() < 0.25) {
      const affixes = [StrongholdAffix.MIASMA, StrongholdAffix.VOLCANIC_HEAT, StrongholdAffix.BLIZZARD, StrongholdAffix.FORTIFIED, StrongholdAffix.BERSERK_AURA];
      affix = Random.pick(affixes);
    }

    // 若為動態探索出的據點，從 nestNames.json 詞庫檔隨機抽取後綴組合據點名稱 (例如：哥布林營地、飛龍巨巢、骷髏古墓、流寇山寨)
    if (node.isDynamic || node.name.startsWith('未知的')) {
      const baseMonster = encounter[0] ? this.getMonsterById(encounter[0].id) : undefined;
      const cleanBaseName = baseMonster ? baseMonster.name : '怪魔';
      const raceTag = encounter[0]?.appliedRaceTag || baseMonster?.race;
      const suffix = this.getNestSuffix(raceTag);
      node.name = `${cleanBaseName}${suffix}`;
    }

    // 更新並持久化於 node.scoutData
    const mainRaces = Array.from(new Set(encounter.map(m => m.appliedRaceTag)));
    const mainElements = Array.from(new Set(encounter.map(m => m.element)));
    const totalPower = Math.round(encounter.reduce((sum, m) => sum + m.calculatedPowerScore, 0));

    node.scoutData = {
      dangerLevel: totalPower > 150 ? '極高' : totalPower > 80 ? '危險' : '普通',
      treasureTier: totalPower > 150 ? '史詩' : totalPower > 80 ? '稀有' : '普通',
      garrisonPower: totalPower,
      garrisonEncounter: encounter,
      mainRaces,
      mainElements,
      affix
    };

    return encounter;
  }

  public getMonsterById(id: string): MonsterData | undefined {
    return this.monsters.find(m => m.id === id);
  }
}

// 單例模式導出
export const monsterSystem = new MonsterSystem();
