import { TerrainType, MonsterData, MonsterRace, MonsterProfile, MonsterInstance, ElementType, MapNode, StrongholdAffix, FormationRow } from '../models/types';
import { SubjugationTemplate } from '../models/Narrative';
import { Random } from '../core/Random';
import monstersJson from '../data/monsters.json';
import nestNamesJson from '../data/nestNames.json';
import { GameState } from '../core/GameState';
import { FactionArmyGenerator } from './map/FactionArmyGenerator';
import { DataStore } from './DataStore';

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

    // 戰力權算 (powerScore 基準：以 powerTier 1.0 在難度 1 基準下對齊約 55 點標準戰力)
    let raceMult = 1.0;
    if (appliedRaceTag === MonsterRace.UNDEAD) raceMult = 1.1;
    else if (appliedRaceTag === MonsterRace.DRAGON) raceMult = 1.5;

    const baseBudget = Math.max(15, Math.round(baseDifficulty * baseMonster.powerTier * raceMult * 55));

    // 根據 8 大戰鬥定位 (Profile) 決定基準屬性權重 (總預算鎖死下正規化分配)
    const profile = baseMonster.profile || (baseMonster.isBoss ? MonsterProfile.BOSS : MonsterProfile.BALANCED);
    let hpW = 40, atkW = 35, pdefW = 16, mdefW = 14, spdW = 10, evaW = 6;

    switch (profile) {
      case MonsterProfile.TANK:
        hpW = 45; atkW = 24; pdefW = 32; mdefW = 16; spdW = 6; evaW = 0; break;
      case MonsterProfile.ASSASSIN:
        hpW = 22; atkW = 44; pdefW = 8; mdefW = 8; spdW = 20; evaW = 16; break;
      case MonsterProfile.MAGE:
        hpW = 25; atkW = 45; pdefW = 8; mdefW = 28; spdW = 10; evaW = 6; break;
      case MonsterProfile.BERSERKER:
        hpW = 34; atkW = 50; pdefW = 10; mdefW = 8; spdW = 12; evaW = 4; break;
      case MonsterProfile.RANGER:
        hpW = 26; atkW = 40; pdefW = 10; mdefW = 12; spdW = 18; evaW = 12; break;
      case MonsterProfile.JUGGERNAUT:
        hpW = 50; atkW = 36; pdefW = 20; mdefW = 16; spdW = 6; evaW = 0; break;
      case MonsterProfile.BOSS:
        hpW = 42; atkW = 38; pdefW = 20; mdefW = 18; spdW = 14; evaW = 8; break;
      case MonsterProfile.BALANCED:
      default:
        hpW = 38; atkW = 34; pdefW = 16; mdefW = 14; spdW = 10; evaW = 6; break;
    }

    // 種族微調 (不死族降低閃避增強生存，龍族強化全能)
    if (appliedRaceTag === MonsterRace.UNDEAD) {
      hpW += 6; pdefW += 4; mdefW += 4; evaW = 0;
    }

    const totalWeight = hpW + atkW + pdefW + mdefW + spdW + evaW;
    const hpRatio = hpW / totalWeight;
    const atkRatio = atkW / totalWeight;
    const pdefRatio = pdefW / totalWeight;
    const mdefRatio = mdefW / totalWeight;
    const spdRatio = spdW / totalWeight;
    const evaRatio = evaW / totalWeight;

    const hp = Math.max(45, Math.floor(baseBudget * hpRatio * 2.8));
    const damage = Math.max(12, Math.floor(baseBudget * atkRatio * 1.15));
    const pdef = Math.floor(baseBudget * pdefRatio * 1.2);
    const mdef = Math.floor(baseBudget * mdefRatio * 1.2);
    const defense = pdef; // 相容舊版欄位
    const speed = Math.max(4, Math.floor(baseBudget * spdRatio * 1.2));
    const evade = Math.min(500, Math.floor(baseBudget * evaRatio * 1.5));

    // 大一統戰力計分公式 (與冒險者完全對齊：有效攻擊 + 平均防禦*0.6 + HP*0.2 + 速度*0.5)
    const effAtk = damage;
    const avgDef = Math.floor((pdef + mdef) / 2);
    const calculatedPowerScore = effAtk + Math.floor(avgDef * 0.6) + Math.floor(hp * 0.2) + Math.floor(speed * 0.5);

    // 技能清單 (直接繼承原型或預設技能)
    const skills = baseMonster.skills ? [...baseMonster.skills] : [];

    return {
      ...baseMonster,
      name: fullName,
      race: appliedRaceTag,
      appliedRaceTag,
      profile,
      element,
      hp,
      maxHp: hp,
      damage,
      defense,
      pdef,
      mdef,
      speed,
      evade,
      calculatedPowerScore,
      skills,
      attackType: baseMonster.attackType || (baseMonster.isMagicalAttacker || profile === MonsterProfile.MAGE ? 'MAGIC' : (baseMonster.id === 'crossbowman' ? 'RANGED' : 'MELEE')),
      isMagicalAttacker: baseMonster.isMagicalAttacker || profile === MonsterProfile.MAGE,
      
      // 動態戰利品配置 (金幣: 戰力 * 1.0, 經驗: 戰力 * 0.25)
      goldReward: Math.floor(calculatedPowerScore * 1.0),
      expReward: Math.floor(calculatedPowerScore * 0.25),
      equipmentDropRate: baseMonster.lootConfig ? baseMonster.lootConfig.equipmentDropRate : Math.min(0.25, calculatedPowerScore * 0.0015) // 上限 25%
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
    isNecroticTheme: boolean = false,
    forcedLeaderId?: string
  ): MonsterInstance[] {
    // 1. 單向隔離與階級過濾 (低難度排除超階精英怪與龍族)
    const maxAllowedTier = baseDifficulty <= 1 ? 1.3 : (baseDifficulty <= 2 ? 1.6 : (baseDifficulty <= 4 ? 2.0 : 3.0));
    let validMonsters = this.monsters.filter(m => m.terrains.includes(terrain) && !m.isBoss && m.powerTier <= maxAllowedTier);
    
    if (baseDifficulty <= 2) {
      // 難度 1~2 排除野生龍族，保留給高難度與精英據點
      const nonDragons = validMonsters.filter(m => m.race !== MonsterRace.DRAGON);
      if (nonDragons.length > 0) validMonsters = nonDragons;
    }

    if (validMonsters.length === 0) {
      validMonsters = this.monsters.filter(m => !m.isBoss && m.powerTier <= maxAllowedTier);
    }
    if (validMonsters.length === 0) {
      validMonsters = this.monsters.filter(m => !m.isBoss);
    }

    if (!isNecroticTheme) {
      // 生靈據點：嚴格過濾排除單一 UNDEAD 怪物
      const livingMonsters = validMonsters.filter(m => m.race !== MonsterRace.UNDEAD || m.compatibleRaces.some(r => r !== MonsterRace.UNDEAD));
      if (livingMonsters.length > 0) validMonsters = livingMonsters;
    }

    // 2. 決定隊長 (若有鎖定主題原型，優先採用)
    let selectedBase = validMonsters[0];
    if (forcedLeaderId) {
      const forced = this.getMonsterById(forcedLeaderId);
      if (forced) selectedBase = forced;
    } else {
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
    }

    const targetScore = Math.max(50, Math.round(baseDifficulty * 55));
    let currentScore = 0;
    const encounter: MonsterInstance[] = [];
    
    // 依據難度與戰力目標動態決定隊伍最大怪物數量 (避免低戰力時 5 打 1 群毆，但允許 2 隻低階雜兵湊足目標戰力)
    let maxEncounterSize = 5;
    if (targetScore <= 80) {
      maxEncounterSize = 2;
    } else if (targetScore <= 160) {
      maxEncounterSize = 2;
    } else if (targetScore <= 320) {
      maxEncounterSize = 3;
    } else if (targetScore <= 550) {
      maxEncounterSize = 4;
    }
    
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
      // 難度越高越容易出現元素變異 (baseDiff 5.0 開始出現，上限 50%)
      const elementMutationChance = Math.max(0, Math.min(0.5, (baseDifficulty - 4.0) * 0.08));
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

    // 4. 混編抽取剩餘隊員 (若有主題原型，優先混編同種族援軍)
    const thematicMonsters = forcedLeaderId 
      ? validMonsters.filter(m => m.race === selectedBase.race || m.compatibleRaces.includes(selectedBase.race))
      : validMonsters;
    const mixPool = thematicMonsters.length > 0 ? thematicMonsters : validMonsters;

    while (currentScore < targetScore * 0.9 && encounter.length < maxEncounterSize) {
      const mixWeights = mixPool.map(m => m.race === MonsterRace.DRAGON ? 0.25 : 1.0);
      const mixTotalWeight = mixWeights.reduce((a, b) => a + b, 0);
      let mixRand = Random.next() * mixTotalWeight;
      let mixedBase = mixPool[0];
      for (let i = 0; i < mixPool.length; i++) {
        mixRand -= mixWeights[i];
        if (mixRand <= 0) {
          mixedBase = mixPool[i];
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
   * 從討伐據點模板中將自訂波次守軍轉換為精確的 MonsterInstance 陣容 (支援九宮格站位與副將自動接替)
   */
  public createInstancesFromTemplateWaves(tpl: SubjugationTemplate): MonsterInstance[] {
    if (!tpl.waves || tpl.waves.length === 0) return [];

    // 取得當前不可用角色名單（已招募為冒險者、被關押在地牢等）
    const allCapturedPrisoners: { id: string; characterKey?: string; boundMonsterId?: string }[] = [];
    
    // 1. 領地自身地牢俘虜 (UniqueHeroDef ID)
    const territoryPrisonerHeroIds = GameState.myTerritory?.dungeonPrisonerHeroIds || [];
    territoryPrisonerHeroIds.forEach(hid => {
      allCapturedPrisoners.push({ id: hid });
    });

    // 2. AI 派系俘虜
    const factions = GameState.mapSystem?.getFactions() || [];
    factions.forEach(f => {
      if (f.capturedChampionIds) {
        f.capturedChampionIds.forEach(cid => {
          const champ = f.champions?.find(c => c.id === cid);
          allCapturedPrisoners.push({
            id: cid,
            characterKey: (champ as any)?.characterKey,
            boundMonsterId: (champ as any)?.boundMonsterId
          });
        });
      }
    });

    const unavailableSet = FactionArmyGenerator.buildUnavailableCharacterSet(
      (GameState.adventurers as any) || [],
      allCapturedPrisoners,
      []
    );

    const encounter: MonsterInstance[] = [];
    const firstWave = tpl.waves[0];
    const waveMonsters = firstWave?.monsters || [];

    for (const mDef of waveMonsters) {
      let monsterId = mDef.monsterId;
      let base = this.getMonsterById(monsterId);
      if (!base) continue;

      let isSubstituted = false;
      const isUnavailable = (
        (base.characterKey && unavailableSet.has(base.characterKey)) ||
        unavailableSet.has(base.id)
      );

      // 檢查副將接替 (若名將已入隊/被俘/在地牢)
      if (isUnavailable) {
        let substituteId = base.substituteMonsterId;
        if (!substituteId || !this.getMonsterById(substituteId)) {
          substituteId = FactionArmyGenerator.getBestSubstituteMonsterId(base);
        }
        const subMonster = this.getMonsterById(substituteId);
        if (subMonster) {
          base = subMonster;
          isSubstituted = true;
        }
      }

      const powerTier = mDef.powerTier || base.powerTier || 1.0;
      const element = base.defaultElement || ElementType.NONE;
      const race = base.race;
      
      const instance = this.createMonsterInstance(base, race, element, powerTier * 3);
      if (isSubstituted && !instance.name.includes('【代理副將】')) {
        instance.name = `【代理副將】${instance.name}`;
      }
      instance.gridR = mDef.gridR;
      instance.gridC = mDef.gridC;
      instance.slotId = mDef.slotId;
      instance.formationRow = mDef.formationRow;
      if (mDef.powerTier) {
        instance.calculatedPowerScore = Math.round((instance.damage || 20) * powerTier * 10);
      }
      encounter.push(instance);
    }

    return encounter;
  }

  /**
   * 為特定地圖據點生成並持久化駐軍資訊 (確保偵查內容與戰鬥 100% 一致，且動態據點擴張時主題不變)
   */
  public generateNodeEncounter(node: MapNode): MonsterInstance[] {
    const isNecroticTheme = node.terrain === TerrainType.RUINS || node.name.includes('墓') || node.name.includes('深淵') || node.name.includes('無光');
    const baseDifficulty = node.baseDifficulty || 10;
    
    let encounter: MonsterInstance[];

    // 1. 優先比對據點工坊自訂模板 (SubjugationNodeDB)
    const allTemplates = DataStore.getSubjugationTemplates();
    const tpl = allTemplates.find(t => 
      t.id === node.id || 
      t.id === node.narrativeSubjugation?.templateId || 
      t.id === node.narrativeSubjugation?.sourceNodeId || 
      t.name === node.name
    );

    if (tpl && tpl.waves && tpl.waves.length > 0) {
      const templateInstances = this.createInstancesFromTemplateWaves(tpl);
      if (templateInstances.length > 0) {
        encounter = templateInstances;
        if (tpl.description) node.description = tpl.description;
        if (tpl.difficulty) node.baseDifficulty = tpl.difficulty;
      } else {
        encounter = this.generateEncounter(node.terrain, baseDifficulty, isNecroticTheme, node.establishedBaseMonsterId);
      }
    } else if (node.ownerFactionId && node.ownerFactionId !== 'player') {
      // 這是陣營的據點，生成陣營正規軍與傳奇 Boss
      const factions = GameState.mapSystem.getFactions();
      const faction = factions.find(f => f.id === node.ownerFactionId);
      if (faction) {
        // 依照難度生成約 4~6 隻單位的部隊
        const armyCount = Math.min(6, Math.max(4, Math.floor(baseDifficulty / 3)));
        encounter = FactionArmyGenerator.generateSiegeEncounter(faction, baseDifficulty, armyCount) as MonsterInstance[];
      } else {
        encounter = this.generateEncounter(node.terrain, baseDifficulty, isNecroticTheme, node.establishedBaseMonsterId);
      }
    } else {
      // 普通野外據點或動態據點
      encounter = this.generateEncounter(node.terrain, baseDifficulty, isNecroticTheme, node.establishedBaseMonsterId);
    }

    // 隨機生成或繼承據點詞綴
    let affix: StrongholdAffix | undefined = node.establishedAffix;
    if (!affix && (node.isEliteLair || Random.next() < 0.25)) {
      const affixes = [StrongholdAffix.MIASMA, StrongholdAffix.VOLCANIC_HEAT, StrongholdAffix.BLIZZARD, StrongholdAffix.FORTIFIED, StrongholdAffix.BERSERK_AURA];
      affix = Random.pick(affixes);
      if (node.isDynamic) {
        node.establishedAffix = affix;
      }
    }

    // 若為挑戰據點，將戰利品與掉落率進行超額強化 (3倍金幣與經驗，保底高裝備掉落率)
    if (node.isEliteLair) {
      encounter.forEach(m => {
        m.goldReward = Math.floor((m.goldReward || 50) * 3.0);
        m.expReward = Math.floor((m.expReward || 20) * 3.0);
        m.equipmentDropRate = Math.max(0.35, (m.equipmentDropRate || 0.1) * 2.5);
      });
    }

    // 首次定型動態據點的主題怪物與名稱
    if (node.isDynamic) {
      if (!node.establishedBaseMonsterId && encounter[0]) {
        node.establishedBaseMonsterId = encounter[0].id;
      }
      if (node.name.startsWith('未知的')) {
        const baseMonster = encounter[0] ? this.getMonsterById(encounter[0].id) : undefined;
        const cleanBaseName = baseMonster ? baseMonster.name : '怪魔';
        const raceTag = encounter[0]?.appliedRaceTag || baseMonster?.race;
        const suffix = this.getNestSuffix(raceTag);
        const elitePrefix = node.isEliteLair ? Random.pick(['💀[凶兆] ', '👑[首領] ', '🔥[極危險] ']) : '';
        node.name = `${elitePrefix}${cleanBaseName}${suffix}`;
      }
    }

    // 更新並持久化於 node.scoutData
    const mainRaces = Array.from(new Set(encounter.map(m => m.appliedRaceTag)));
    const mainElements = Array.from(new Set(encounter.map(m => m.element)));
    const totalPower = Math.round(encounter.reduce((sum, m) => sum + m.calculatedPowerScore, 0));

    node.scoutData = {
      dangerLevel: node.isEliteLair ? '極度危險 (挑戰)' : totalPower > 800 ? '極高' : totalPower > 450 ? '危險' : '普通',
      treasureTier: node.isEliteLair ? '傳奇 (高額保底)' : totalPower > 800 ? '史詩' : totalPower > 450 ? '稀有' : '普通',
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
