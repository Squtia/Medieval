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
      calculatedPowerScore: powerScore
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

    // 龍族 (DRAGON) 一般怪物具備較低出現機率 (權重 0.25 vs 1.0)
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

    // 2. 決定種族標籤 (遵守單向隔離)
    let appliedRaceTag: MonsterRace = selectedBase.race;
    if (isNecroticTheme) {
      // 亡靈據點：70% 概率套用 UNDEAD (若怪性相容)
      if (selectedBase.compatibleRaces.includes(MonsterRace.UNDEAD) && Random.next() < 0.7) {
        appliedRaceTag = MonsterRace.UNDEAD;
      }
    } else {
      // 生靈據點：若相容有多個，排除 UNDEAD
      const livingRaces = selectedBase.compatibleRaces.filter(r => r !== MonsterRace.UNDEAD);
      appliedRaceTag = livingRaces.length > 0 ? Random.pick(livingRaces) : MonsterRace.MONSTER;
    }

    // 3. 決定元素
    let element = selectedBase.defaultElement || ElementType.NONE;
    if (element === ElementType.NONE && Random.next() < 0.3) {
      // 30% 機率為無屬性怪染上環境元素
      const elements = [ElementType.FIRE, ElementType.ICE, ElementType.LIGHTNING, ElementType.HOLY, ElementType.DARK];
      element = Random.pick(elements);
    }

    // 4. 建立基礎成員實體
    const baseInstance = this.createMonsterInstance(selectedBase, appliedRaceTag, element, baseDifficulty);

    // 5. 決定隊伍數量 (1~5 隻)
    const targetScore = Math.max(10, baseDifficulty * 12);
    const count = Math.max(1, Math.min(5, Math.round(targetScore / baseInstance.calculatedPowerScore)));

    const encounter: MonsterInstance[] = [];
    for (let i = 0; i < count; i++) {
      // 允許小隊內部成員微幅變異元素或種族 (維持隊伍沉浸感)
      encounter.push({ ...baseInstance });
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
