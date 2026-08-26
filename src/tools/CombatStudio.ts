import { Adventurer } from '../models/Adventurer';
import { CombatEvent, CombatEventType, CombatReport } from '../models/Combat';
import { ElementType, Equipment, EquipmentSlot, FormationRow, Gender, JobConfig, MonsterData, MonsterInstance, MonsterProfile, MonsterRace, TerrainType, TraitConfig, WeaponType } from '../models/types';
import { SubjugationTemplate, SubjugationWave, SubjugationWaveMonster } from '../models/Narrative';
import { MonsterSystem } from '../systems/MonsterSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { GameState } from '../core/GameState';
import monstersJson from '../data/monsters.json';
import defaultCustomDatasets from '../data/custom_icon_datasets.json';
import subjugationNodesJson from '../data/subjugation_nodes.json';
import { renderUniversalIcon } from '../ui/IconSpriteHelper';
import { UNIQUE_HEROES, UniqueHeroDef } from '../data/UniqueAdventurers';
import { SkillRegistry } from '../systems/combat/SkillRegistry';
import { DataStore } from '../systems/DataStore';
import '../styles/combat-studio.css';

// 工具函式
const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;
const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));

type Quality = 'N' | 'R' | 'SR' | 'SSR' | 'UR';

interface AllocatedStats {
  str: number;
  agi: number;
  con: number;
  int: number;
  spr: number;
  luk: number;
}

interface PlayerUnitConfig {
  id: string;
  name: string;
  level: number;
  quality: Quality;
  jobName: string;
  isAdvanced: boolean;
  weaponType: WeaponType;
  weaponElement: ElementType;
  weaponTier: number;
  weaponEnhance: number;
  armorTier: number;
  armorEnhance: number;
  accessoryType: string;
  weaponTemplateId?: string;
  armorTemplateId?: string;
  accessoryId?: string;
  isUnique?: boolean;
  formationRow: FormationRow | 'MIDDLE';
  avatarIcon?: string;
  gender?: Gender;
  isGuardian?: boolean;
  avatarIndex?: number;
  allocatedStats: AllocatedStats;
}

interface EnemyUnitConfig {
  monsterId: string;
  name: string;
  difficulty: number;
  element: ElementType;
  isUndead: boolean;
  formationRow: FormationRow;
  affix?: string;
  avatarIcon?: string;
  profile?: MonsterProfile;
  skills?: string[];
}

interface CustomStrongholdConfig {
  id: string;
  name: string;
  terrain: TerrainType;
  difficulty: number;
  faction: string;
  desc?: string;
  garrisonWaves: EnemyUnitConfig[][];
}

class CombatStudioController {
  private monstersDb: MonsterData[] = [];
  private monsterSystem = new MonsterSystem();
  private customStrongholds: Record<string, CustomStrongholdConfig> = {};
  private iconDatasets: Record<string, any> = defaultCustomDatasets;
  private currentIconPickerTab: string = 'monsters';
  private iconPickerCallback: ((icon: string) => void) | null = null;

  // 工坊分頁狀態
  private currentStudioTab: 'battle' | 'heroes' | 'monsters' | 'strongholds' = 'battle';
  private monsterSearchQuery: string = '';
  private monsterFilterRace: string = 'ALL';
  private monsterFilterTerrain: string = 'ALL';
  private monsterFilterBoss: string = 'ALL';
  private editingMonsterId: string | null = null;

  // 討伐據點工坊狀態
  private strongholdsDb: SubjugationTemplate[] = [];
  private strongholdSearchQuery: string = '';
  private strongholdFilterTerrain: string = 'ALL';
  private editingStrongholdId: string | null = null;
  private currentPickerWaveIdx: number = 0;
  private currentPickerTargetSlot: string | null = null;

  // 英雄工坊狀態
  private customHeroesDb: UniqueHeroDef[] = [];
  private heroSearchQuery: string = '';
  private heroFilterQuality: string = 'ALL';
  private heroFilterJob: string = 'ALL';
  private editingHeroId: string | null = null;
  private activePickingSlotIdx: number = 0;

  // 我方隊伍狀態
  private playerTeam: PlayerUnitConfig[] = [];
  // 敵方多波次隊伍狀態 (每一波為一個 EnemyUnitConfig[])
  private enemyWaves: EnemyUnitConfig[][] = [[]];
  private currentWaveIdx = 0;

  // 當前裝備編輯中的傭兵索引
  private activeEditingPlayerIdx = 0;

  // 怪物技能自訂狀態
  private activeEditingMonsterWaveIdx = 0;
  private activeEditingMonsterIdx = 0;
  private tempMonsterSkills: string[] = [];

  // 討伐據點怪物進階配置狀態
  private currentConfiguringWaveIdx = 0;
  private currentConfiguringMonsterIdx = 0;
  private tempShMonsterSkills: string[] = [];
  // 當前更換頭像中的對象 ('creator' 或 敵方陣容 index 或 傭兵 index)
  private activeIconPickerTarget: 'creator' | { type: 'enemy'; idx: number } | { type: 'player'; idx: number } = 'creator';

  // 戰鬥播放器狀態
  private currentReport: CombatReport | null = null;
  private currentEventIndex = 0;
  private isPlaying = false;
  private playSpeed = 1; // 1x, 2x, 5x
  private playTimer: any = null;

  // 實例化狀態 (對應當前回合 HP/MP)
  private arenaHpMp: Record<string, { hp: number; maxHp: number; mp: number; maxMp: number; name: string; avatar: string }> = {};

  public async init(): Promise<void> {
    await this.loadTemplate();
    await this.loadMonsters();
    await this.loadIconDatasets();
    this.loadCustomHeroes();
    await this.loadStrongholds();
    this.initDefaultPlayerTeam('balanced');
    this.initDefaultEnemyWaves('node_1');
    this.bindEvents();
    this.bindStrongholdEvents();
    this.render();
  }

  private async loadStrongholds(): Promise<void> {
    // 1. 優先從 localStorage 還原自訂據點庫 (保證使用者自訂據點永不被覆蓋)
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('MEDIEVAL_CUSTOM_STRONGHOLDS_V2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.strongholdsDb = parsed;
            if (!this.editingStrongholdId || !this.strongholdsDb.some(s => s.id === this.editingStrongholdId)) {
              this.editingStrongholdId = this.strongholdsDb[0].id;
            }
            return;
          }
        } catch {}
      }
    }

    // 2. 次選 fetch 後端 API (若有提供)
    try {
      const response = await fetch('/api/get-subjugation-nodes');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          this.strongholdsDb = data;
          if (!this.editingStrongholdId || !this.strongholdsDb.some(s => s.id === this.editingStrongholdId)) {
            this.editingStrongholdId = this.strongholdsDb[0].id;
          }
          this.saveStrongholdsToStorage();
          return;
        }
      }
    } catch {}

    // 3. 首次進入且無本地存檔時使用預設範本
    this.strongholdsDb = clone(subjugationNodesJson) as SubjugationTemplate[];
    if (this.strongholdsDb.length > 0 && !this.editingStrongholdId) {
      this.editingStrongholdId = this.strongholdsDb[0].id;
    }
    this.saveStrongholdsToStorage();
  }

  private saveStrongholdsToStorage(): void {
    localStorage.setItem('MEDIEVAL_CUSTOM_STRONGHOLDS_V2', JSON.stringify(this.strongholdsDb));
  }

  private loadCustomHeroes(): void {
    const saved = localStorage.getItem('MEDIEVAL_CUSTOM_HEROES');
    if (saved) {
      try {
        this.customHeroesDb = JSON.parse(saved);
      } catch {}
    }
  }

  private saveCustomHeroesToStorage(): void {
    localStorage.setItem('MEDIEVAL_CUSTOM_HEROES', JSON.stringify(this.customHeroesDb));
  }

  private getAllHeroes(): UniqueHeroDef[] {
    const list: UniqueHeroDef[] = [];
    // 1. 預設唯一英雄 (若 customHeroesDb 內有覆蓋版本，優先讀取自訂儲存庫)
    Object.values(UNIQUE_HEROES).forEach(h => {
      const customOverride = this.customHeroesDb.find(c => c.id === h.id);
      if (customOverride) {
        list.push(customOverride);
      } else {
        list.push(h);
      }
    });
    // 2. 自訂英雄 (全新建立的角色)
    this.customHeroesDb.forEach(h => {
      if (!list.some(item => item.id === h.id)) list.push(h);
    });
    // 3. 當前存檔誓約守衛 (若有)
    const playerGuardian = GameState.adventurers?.find(a => a.isGuardian);
    if (playerGuardian && !list.some(item => item.id === 'save_guardian_hero')) {
      const gWeapon = playerGuardian.equipment[EquipmentSlot.WEAPON];
      const gArmor = playerGuardian.equipment[EquipmentSlot.ARMOR];
      const gAcc = playerGuardian.equipment[EquipmentSlot.ACCESSORY];
      list.push({
        id: 'save_guardian_hero',
        name: playerGuardian.name,
        title: '【我的誓約騎士】',
        quality: playerGuardian.quality as any,
        jobKey: 'KNIGHT',
        traitKey: 'GUARDIAN',
        gender: playerGuardian.gender,
        isGuardian: true,
        avatarIndex: playerGuardian.avatarIndex,
        level: playerGuardian.level,
        biography: '目前領地存檔中的專屬誓約守衛，隨領主一同征戰四方。',
        customAttributes: {
          str: playerGuardian.baseAttributes.str,
          agi: playerGuardian.baseAttributes.agi,
          con: playerGuardian.baseAttributes.con,
          int: playerGuardian.baseAttributes.int,
          spr: playerGuardian.baseAttributes.spr,
          luk: playerGuardian.baseAttributes.luk,
          charm: playerGuardian.baseAttributes.charm,
          command: playerGuardian.baseAttributes.command
        },
        equipment: {
          weaponTemplateId: gWeapon ? gWeapon.id : 'wpn_royal_paladin_sword',
          weaponEnhance: gWeapon?.enhancementLevel || 7,
          weaponElement: gWeapon?.element || ElementType.HOLY,
          armorTemplateId: gArmor ? gArmor.id : 'arm_heavy_t4',
          armorEnhance: gArmor?.enhancementLevel || 7,
          accessoryId: gAcc ? gAcc.id : 'acc_holy_cross'
        }
      });
    }
    return list;
  }

  private async loadIconDatasets(): Promise<void> {
    try {
      const response = await fetch('/api/get-icon-studio-data');
      if (response.ok) {
        const data = await response.json();
        if (data.customDatasets && Object.keys(data.customDatasets).length > 0) {
          this.iconDatasets = data.customDatasets;
        }
      }
    } catch {
      this.iconDatasets = defaultCustomDatasets;
    }
  }

  private async loadTemplate(): Promise<void> {
    const response = await fetch(`${import.meta.env.BASE_URL}src/templates/combat-studio.html?t=${Date.now()}`);
    if (!response.ok) throw new Error('無法載入戰鬥平衡工坊介面');
    byId('combat-studio-root').innerHTML = await response.text();
  }

  private async loadMonsters(): Promise<void> {
    try {
      const response = await fetch('/api/get-monster-definitions');
      if (response.ok) {
        this.monstersDb = await response.json();
      } else {
        this.monstersDb = clone(monstersJson) as MonsterData[];
      }
    } catch {
      this.monstersDb = clone(monstersJson) as MonsterData[];
    }
  }

  // ── 品質資質基準值 ──
  private getQualityBasePoints(quality: Quality): number {
    switch (quality) {
      case 'N': return 40;
      case 'R': return 55;
      case 'SR': return 70;
      case 'SSR': return 88;
      case 'UR': return 110;
      default: return 50;
    }
  }

  // ── 依職業權重分配基準六維 ──
  private getJobBaseAttributes(jobName: string, quality: Quality): { str: number; agi: number; con: number; int: number; spr: number; luk: number } {
    const total = this.getQualityBasePoints(quality);
    let weights = { str: 2, agi: 2, con: 2, int: 2, spr: 2, luk: 1 };

    if (jobName.includes('法師') || jobName.includes('魔導') || jobName.includes('死靈')) {
      weights = { str: 1, agi: 2, con: 2, int: 5, spr: 3, luk: 1 };
    } else if (jobName.includes('弓') || jobName.includes('神射') || jobName.includes('暗殺')) {
      weights = { str: 2, agi: 5, con: 2, int: 1, spr: 1, luk: 3 };
    } else if (jobName.includes('騎士') || jobName.includes('聖騎') || jobName.includes('符文')) {
      weights = { str: 3, agi: 1, con: 5, int: 1, spr: 3, luk: 1 };
    } else if (jobName.includes('祈禱') || jobName.includes('主教') || jobName.includes('拷問')) {
      weights = { str: 2, agi: 1, con: 2, int: 2, spr: 5, luk: 2 };
    } else {
      // 戰士 / 狂戰士 / 魔劍士
      weights = { str: 5, agi: 2, con: 4, int: 1, spr: 1, luk: 1 };
    }

    const wSum = Object.values(weights).reduce((a, b) => a + b, 0);
    return {
      str: Math.max(1, Math.round((weights.str / wSum) * total)),
      agi: Math.max(1, Math.round((weights.agi / wSum) * total)),
      con: Math.max(1, Math.round((weights.con / wSum) * total)),
      int: Math.max(1, Math.round((weights.int / wSum) * total)),
      spr: Math.max(1, Math.round((weights.spr / wSum) * total)),
      luk: Math.max(1, Math.round((weights.luk / wSum) * total)),
    };
  }

  // ── 預設隊伍配置 ──
  private initDefaultPlayerTeam(preset: string): void {
    if (preset === 'custom') {
      const saved = localStorage.getItem('MEDIEVAL_CUSTOM_TEST_TEAM');
      if (saved) {
        try {
          this.playerTeam = JSON.parse(saved);
          return;
        } catch {}
      }
    }

    if (preset === 'melee_rush') {
      this.playerTeam = [
        { id: 'p1', name: '狂戰雷恩', level: 10, quality: 'UR', jobName: '狂戰士', isAdvanced: true, weaponType: WeaponType.GREATSWORD, weaponElement: ElementType.NONE, weaponTier: 4, weaponEnhance: 5, armorTier: 4, armorEnhance: 5, accessoryType: 'BADGE_CRIT', formationRow: FormationRow.FRONT, allocatedStats: { str: 25, agi: 5, con: 15, int: 0, spr: 0, luk: 0 } },
        { id: 'p2', name: '魔劍士亞倫', level: 10, quality: 'SSR', jobName: '魔劍士', isAdvanced: true, weaponType: WeaponType.DUAL_SWORDS, weaponElement: ElementType.FIRE, weaponTier: 4, weaponEnhance: 5, armorTier: 3, armorEnhance: 4, accessoryType: 'RING_HP', formationRow: FormationRow.FRONT, allocatedStats: { str: 15, agi: 10, con: 10, int: 10, spr: 0, luk: 0 } },
        { id: 'p3', name: '聖騎羅蘭', level: 10, quality: 'UR', jobName: '聖騎士', isAdvanced: true, weaponType: WeaponType.SWORD_AND_SHIELD, weaponElement: ElementType.HOLY, weaponTier: 4, weaponEnhance: 5, armorTier: 4, armorEnhance: 5, accessoryType: 'CROSS_HOLY', formationRow: FormationRow.FRONT, allocatedStats: { str: 10, agi: 5, con: 25, int: 0, spr: 5, luk: 0 } },
        { id: 'p4', name: '影刃艾拉', level: 10, quality: 'SR', jobName: '暗殺者', isAdvanced: true, weaponType: WeaponType.DAGGERS, weaponElement: ElementType.DARK, weaponTier: 4, weaponEnhance: 5, armorTier: 3, armorEnhance: 3, accessoryType: 'AMULET_AGI', formationRow: 'MIDDLE', allocatedStats: { str: 5, agi: 25, con: 5, int: 0, spr: 0, luk: 10 } },
        { id: 'p5', name: '審判官托馬斯', level: 10, quality: 'SR', jobName: '異端拷問官', isAdvanced: true, weaponType: WeaponType.HAMMER, weaponElement: ElementType.HOLY, weaponTier: 4, weaponEnhance: 5, armorTier: 4, armorEnhance: 4, accessoryType: 'RING_HP', formationRow: 'MIDDLE', allocatedStats: { str: 15, agi: 0, con: 10, int: 0, spr: 20, luk: 0 } },
      ];
    } else if (preset === 'mage_burst') {
      this.playerTeam = [
        { id: 'p1', name: '聖騎羅蘭', level: 10, quality: 'SSR', jobName: '聖騎士', isAdvanced: true, weaponType: WeaponType.SWORD_AND_SHIELD, weaponElement: ElementType.HOLY, weaponTier: 4, weaponEnhance: 5, armorTier: 4, armorEnhance: 5, accessoryType: 'RING_HP', formationRow: FormationRow.FRONT, allocatedStats: { str: 5, agi: 5, con: 30, int: 0, spr: 5, luk: 0 } },
        { id: 'p2', name: '符文騎士凱恩', level: 10, quality: 'SR', jobName: '符文騎士', isAdvanced: true, weaponType: WeaponType.RUNE_SHIELD, weaponElement: ElementType.ICE, weaponTier: 4, weaponEnhance: 4, armorTier: 4, armorEnhance: 4, accessoryType: 'CROSS_HOLY', formationRow: FormationRow.FRONT, allocatedStats: { str: 5, agi: 0, con: 20, int: 5, spr: 15, luk: 0 } },
        { id: 'p3', name: '熾炎大魔導索爾', level: 10, quality: 'UR', jobName: '大魔導士', isAdvanced: true, weaponType: WeaponType.STAFF, weaponElement: ElementType.FIRE, weaponTier: 4, weaponEnhance: 7, armorTier: 3, armorEnhance: 3, accessoryType: 'RING_MP', formationRow: FormationRow.BACK, allocatedStats: { str: 0, agi: 5, con: 5, int: 30, spr: 5, luk: 0 } },
        { id: 'p4', name: '極冰大魔導露娜', level: 10, quality: 'UR', jobName: '大魔導士', isAdvanced: true, weaponType: WeaponType.STAFF, weaponElement: ElementType.ICE, weaponTier: 4, weaponEnhance: 6, armorTier: 3, armorEnhance: 3, accessoryType: 'RING_MP', formationRow: FormationRow.BACK, allocatedStats: { str: 0, agi: 5, con: 5, int: 30, spr: 5, luk: 0 } },
        { id: 'p5', name: '大主教塞西莉亞', level: 10, quality: 'SSR', jobName: '大主教', isAdvanced: true, weaponType: WeaponType.HOLY_BOOK, weaponElement: ElementType.HOLY, weaponTier: 4, weaponEnhance: 5, armorTier: 3, armorEnhance: 3, accessoryType: 'CROSS_HOLY', formationRow: FormationRow.BACK, allocatedStats: { str: 0, agi: 0, con: 10, int: 5, spr: 30, luk: 0 } },
      ];
    } else if (preset === 'chaos_reap') {
      this.playerTeam = [
        { id: 'p1', name: '死靈術士維克多', level: 10, quality: 'UR', jobName: '死靈法師', isAdvanced: true, weaponType: WeaponType.SCYTHE, weaponElement: ElementType.DARK, weaponTier: 4, weaponEnhance: 6, armorTier: 3, armorEnhance: 4, accessoryType: 'RING_HP', formationRow: FormationRow.FRONT, allocatedStats: { str: 10, agi: 0, con: 15, int: 20, spr: 0, luk: 0 } },
        { id: 'p2', name: '詭術師洛基', level: 10, quality: 'SSR', jobName: '詭術師', isAdvanced: true, weaponType: WeaponType.MAGIC_RING, weaponElement: ElementType.DARK, weaponTier: 4, weaponEnhance: 5, armorTier: 3, armorEnhance: 3, accessoryType: 'AMULET_AGI', formationRow: 'MIDDLE', allocatedStats: { str: 0, agi: 15, con: 5, int: 15, spr: 0, luk: 10 } },
        { id: 'p3', name: '精靈使愛麗絲', level: 10, quality: 'SSR', jobName: '精靈使', isAdvanced: true, weaponType: WeaponType.MAGIC_BOW, weaponElement: ElementType.LIGHTNING, weaponTier: 4, weaponEnhance: 6, armorTier: 3, armorEnhance: 3, accessoryType: 'RING_MP', formationRow: FormationRow.BACK, allocatedStats: { str: 0, agi: 15, con: 5, int: 20, spr: 5, luk: 0 } },
        { id: 'p4', name: '符文騎士凱恩', level: 10, quality: 'SR', jobName: '符文騎士', isAdvanced: true, weaponType: WeaponType.RUNE_SHIELD, weaponElement: ElementType.ICE, weaponTier: 4, weaponEnhance: 5, armorTier: 4, armorEnhance: 5, accessoryType: 'RING_HP', formationRow: FormationRow.FRONT, allocatedStats: { str: 5, agi: 0, con: 25, int: 5, spr: 10, luk: 0 } },
        { id: 'p5', name: '審判官托馬斯', level: 10, quality: 'SR', jobName: '異端拷問官', isAdvanced: true, weaponType: WeaponType.HAMMER, weaponElement: ElementType.FIRE, weaponTier: 4, weaponEnhance: 5, armorTier: 4, armorEnhance: 4, accessoryType: 'BADGE_CRIT', formationRow: 'MIDDLE', allocatedStats: { str: 20, agi: 0, con: 10, int: 0, spr: 15, luk: 0 } },
      ];
    } else {
      // 標準五行隊 (預設)
      this.playerTeam = [
        { id: 'p1', name: '戰士亞瑟', level: 5, quality: 'R', jobName: '戰士', isAdvanced: false, weaponType: WeaponType.GREATSWORD, weaponElement: ElementType.NONE, weaponTier: 2, weaponEnhance: 3, armorTier: 2, armorEnhance: 2, accessoryType: 'RING_HP', formationRow: FormationRow.FRONT, allocatedStats: { str: 10, agi: 2, con: 8, int: 0, spr: 0, luk: 0 } },
        { id: 'p2', name: '騎士高文', level: 5, quality: 'SR', jobName: '騎士', isAdvanced: false, weaponType: WeaponType.SWORD_AND_SHIELD, weaponElement: ElementType.NONE, weaponTier: 2, weaponEnhance: 3, armorTier: 2, armorEnhance: 3, accessoryType: 'RING_HP', formationRow: FormationRow.FRONT, allocatedStats: { str: 4, agi: 2, con: 14, int: 0, spr: 0, luk: 0 } },
        { id: 'p3', name: '法師梅林', level: 5, quality: 'R', jobName: '法師', isAdvanced: false, weaponType: WeaponType.STAFF, weaponElement: ElementType.FIRE, weaponTier: 2, weaponEnhance: 3, armorTier: 2, armorEnhance: 1, accessoryType: 'RING_MP', formationRow: FormationRow.BACK, allocatedStats: { str: 0, agi: 2, con: 3, int: 12, spr: 3, luk: 0 } },
        { id: 'p4', name: '弓手羅賓', level: 5, quality: 'N', jobName: '弓箭手', isAdvanced: false, weaponType: WeaponType.BOW, weaponElement: ElementType.NONE, weaponTier: 2, weaponEnhance: 2, armorTier: 2, armorEnhance: 1, accessoryType: 'BADGE_CRIT', formationRow: FormationRow.BACK, allocatedStats: { str: 2, agi: 12, con: 2, int: 0, spr: 0, luk: 4 } },
        { id: 'p5', name: '祈禱者瑪麗', level: 5, quality: 'R', jobName: '祈禱者', isAdvanced: false, weaponType: WeaponType.HOLY_BOOK, weaponElement: ElementType.HOLY, weaponTier: 2, weaponEnhance: 2, armorTier: 2, armorEnhance: 2, accessoryType: 'CROSS_HOLY', formationRow: FormationRow.BACK, allocatedStats: { str: 0, agi: 0, con: 4, int: 4, spr: 12, luk: 0 } },
      ];
    }
  }

  // ── 預設敵方多波次遭遇 ──
  private initDefaultEnemyWaves(stronghold: string): void {
    if (stronghold === 'custom') {
      // 保持當前自訂隊伍
      return;
    }

    const foundSh = this.strongholdsDb.find(s => s.id === stronghold);
    if (foundSh) {
      this.loadStrongholdToBattleSandbox(foundSh, false);
      return;
    }

    if (this.customStrongholds[stronghold]) {
      const sh = this.customStrongholds[stronghold];
      this.enemyWaves = clone(sh.garrisonWaves);
      this.currentWaveIdx = 0;
      return;
    }

    const diff = Number(byId<HTMLInputElement>('cs-enemy-diff-slider')?.value || 2);
    if (stronghold === 'node_5') {
      // 熔火巨龍巢 (標準 3 波：小怪 ➔ 精英 ➔ 骨龍 Boss 壓軸！)
      this.enemyWaves = [
        [
          { monsterId: 'lizard', name: '烈焰毒蜥', difficulty: diff, element: ElementType.FIRE, isUndead: false, avatarIcon: this.getMonsterAvatar('lizard', '烈焰毒蜥'), formationRow: FormationRow.FRONT },
          { monsterId: 'scorpion', name: '火尾蠍', difficulty: diff, element: ElementType.FIRE, isUndead: false, avatarIcon: this.getMonsterAvatar('scorpion', '火尾蠍'), formationRow: FormationRow.FRONT }
        ],
        [
          { monsterId: 'golem', name: '熔岩傀儡', difficulty: diff + 1, element: ElementType.FIRE, isUndead: false, avatarIcon: this.getMonsterAvatar('golem', '熔岩傀儡'), formationRow: FormationRow.FRONT },
          { monsterId: 'drake', name: '雙足幼龍', difficulty: diff + 1, element: ElementType.FIRE, isUndead: false, avatarIcon: this.getMonsterAvatar('drake', '雙足幼龍'), formationRow: FormationRow.FRONT }
        ],
        [
          { monsterId: 'golem', name: '熔岩傀儡', difficulty: diff + 1, element: ElementType.FIRE, isUndead: false, avatarIcon: this.getMonsterAvatar('golem', '熔岩傀儡'), formationRow: FormationRow.FRONT },
          { monsterId: 'skeleton_drake', name: '骨龍獸', difficulty: diff + 2, element: ElementType.DARK, isUndead: true, avatarIcon: this.getMonsterAvatar('skeleton_drake', '骨龍獸'), affix: '👑[首領]', formationRow: FormationRow.BACK }
        ]
      ];
    } else if (stronghold === 'faction_siege') {
      // 洛斯加攻城戰 (3 波：先鋒 ➔ 皇家騎士 ➔ 總指揮官)
      this.enemyWaves = [
        [
          { monsterId: 'faction_infantry', name: '[洛斯加] 前鋒步兵', difficulty: diff, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('faction_infantry', '前鋒步兵'), formationRow: FormationRow.FRONT },
          { monsterId: 'faction_crossbowman', name: '[洛斯加] 軍團弩手', difficulty: diff, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('faction_crossbowman', '軍團弩手'), formationRow: FormationRow.BACK }
        ],
        [
          { monsterId: 'faction_knight', name: '[洛斯加] 皇家騎士', difficulty: diff + 1, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('faction_knight', '皇家騎士'), formationRow: FormationRow.FRONT },
          { monsterId: 'faction_siege_weapon', name: '[洛斯加] 攻城重弩砲', difficulty: diff + 1, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('faction_siege_weapon', '攻城重弩砲'), formationRow: FormationRow.BACK }
        ],
        [
          { monsterId: 'faction_knight', name: '[洛斯加] 禁衛騎士', difficulty: diff + 2, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('faction_knight', '禁衛騎士'), formationRow: FormationRow.FRONT },
          { monsterId: 'faction_knight', name: '[洛斯加] 軍團大將軍', difficulty: diff + 3, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('faction_knight', '軍團大將軍'), affix: '👑[總帥]', formationRow: FormationRow.FRONT }
        ]
      ];
    } else {
      // 標準 1~2 波
      this.enemyWaves = [
        [
          { monsterId: 'slime', name: '史萊姆', difficulty: diff, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('slime', '史萊姆'), formationRow: FormationRow.FRONT },
          { monsterId: 'goblin', name: '哥布林', difficulty: diff, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('goblin', '哥布林'), formationRow: FormationRow.FRONT }
        ],
        [
          { monsterId: 'orc', name: '半獸人隊長', difficulty: diff + 1, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar('orc', '半獸人隊長'), affix: '👑[頭目]', formationRow: FormationRow.FRONT }
        ]
      ];
    }
    this.currentWaveIdx = 0;
  }

  // ── 建立戰鬥參與者 (Adventurer / MonsterInstance) ──
  private buildAdventurers(): Adventurer[] {
    const advList: Adventurer[] = [];
    this.playerTeam.forEach((cfg, idx) => {
      const baseAttr = this.getJobBaseAttributes(cfg.jobName, cfg.quality);
      const defaultJob: JobConfig = {
        name: cfg.jobName,
        baseAttributes: { ...baseAttr, charm: 10, command: 10 },
        growthRates: { str: 2, agi: 2, con: 2, int: 2, spr: 2, luk: 2, charm: 1, command: 1 }
      };
      const defaultTrait: TraitConfig = {
        name: '普通',
        xpModifier: 1.0,
        statMultipliers: {}
      };

      const appliedQuality = cfg.quality === 'UR' ? 'SSR' : cfg.quality;
      const adv = new Adventurer(`adv_${idx}_${cfg.id}`, cfg.name, defaultJob, defaultTrait, appliedQuality);
      adv.level = cfg.level;
      adv.isAdvanced = cfg.isAdvanced;
      adv.formationRow = (cfg.formationRow === 'MIDDLE' ? FormationRow.FRONT : cfg.formationRow);

      // 套用真實六維基準 + 等級成長 + 自訂自由配點
      adv.baseAttributes.str = baseAttr.str + (cfg.level - 1) * 2 + cfg.allocatedStats.str;
      adv.baseAttributes.agi = baseAttr.agi + (cfg.level - 1) * 2 + cfg.allocatedStats.agi;
      adv.baseAttributes.con = baseAttr.con + (cfg.level - 1) * 2 + cfg.allocatedStats.con;
      adv.baseAttributes.int = baseAttr.int + (cfg.level - 1) * 2 + cfg.allocatedStats.int;
      adv.baseAttributes.spr = baseAttr.spr + (cfg.level - 1) * 2 + cfg.allocatedStats.spr;
      adv.baseAttributes.luk = baseAttr.luk + (cfg.level - 1) * 2 + cfg.allocatedStats.luk;

      // 裝備配置與標準 (A) 級屬性補正 (Scaling) 計算
      const scaling = this.calculateWeaponScalingBonus(cfg.weaponType, adv.baseAttributes);
      const baseWpnAtk = cfg.weaponTier * 15 + cfg.weaponEnhance * 4;

      const weaponTpl: Equipment = {
        id: `wpn_${cfg.id}`,
        name: `${cfg.weaponElement !== ElementType.NONE ? '[' + cfg.weaponElement + ']' : ''}${cfg.weaponType}`,
        slot: EquipmentSlot.WEAPON,
        tier: cfg.weaponTier,
        requirements: {},
        effects: {},
        combatEffects: {
          atk: baseWpnAtk + Math.max(scaling.patkBonus, scaling.matkBonus),
          patk: baseWpnAtk + scaling.patkBonus,
          matk: baseWpnAtk + scaling.matkBonus,
          def: scaling.defBonus
        },
        enhancementLevel: cfg.weaponEnhance,
        weaponType: cfg.weaponType,
        element: cfg.weaponElement
      };

      const armorTpl: Equipment = {
        id: `arm_${cfg.id}`,
        name: '防具',
        slot: EquipmentSlot.ARMOR,
        tier: cfg.armorTier,
        requirements: {},
        effects: {},
        combatEffects: { def: cfg.armorTier * 10 + cfg.armorEnhance * 3, pdef: cfg.armorTier * 10, mdef: cfg.armorTier * 10, hp: cfg.armorTier * 30 },
        enhancementLevel: cfg.armorEnhance,
        element: ElementType.NONE
      };

      let accCombatEffects: any = {};
      if (cfg.accessoryType === 'RING_HP') accCombatEffects = { hp: 60 };
      else if (cfg.accessoryType === 'RING_MP') accCombatEffects = { mp: 30 };
      else if (cfg.accessoryType === 'BADGE_CRIT') accCombatEffects = { crit: 10 };
      else if (cfg.accessoryType === 'AMULET_AGI') accCombatEffects = { hit: 15, evade: 15 };
      else if (cfg.accessoryType === 'CROSS_HOLY') accCombatEffects = { spr: 20 };

      const accessoryTpl: Equipment | undefined = cfg.accessoryType !== 'NONE' ? {
        id: `acc_${cfg.id}`,
        name: cfg.accessoryType,
        slot: EquipmentSlot.ACCESSORY,
        tier: 2,
        requirements: {},
        effects: {},
        combatEffects: accCombatEffects,
        element: ElementType.NONE
      } : undefined;

      adv.equipment = {
        [EquipmentSlot.WEAPON]: weaponTpl,
        [EquipmentSlot.ARMOR]: armorTpl,
        [EquipmentSlot.ACCESSORY]: accessoryTpl
      };

      advList.push(adv);
    });
    return advList;
  }

  /**
   * 計算戰鬥沙盒中純色與複合武器的標準 (A) 級屬性補正 (總補正倍率 1.2x)
   * 遵守 docs/CLASS_SYSTEM.md 權威規範
   */
  private calculateWeaponScalingBonus(weaponType: WeaponType, attr: { str: number; agi: number; con: number; int: number; spr: number }): { patkBonus: number; matkBonus: number; defBonus: number } {
    let patkBonus = 0;
    let matkBonus = 0;
    let defBonus = 0;

    switch (weaponType) {
      // 純物理單屬性 (1.2x STR / AGI)
      case WeaponType.GREATSWORD:
        patkBonus = Math.floor(attr.str * 1.2);
        break;
      case WeaponType.BOW:
      case WeaponType.DAGGERS:
        patkBonus = Math.floor(attr.agi * 1.2);
        break;

      // 純魔法單屬性 (1.2x INT / SPR)
      case WeaponType.STAFF:
        matkBonus = Math.floor(attr.int * 1.2);
        break;
      case WeaponType.HOLY_BOOK:
        matkBonus = Math.floor(attr.spr * 1.2);
        break;

      // 坦克單屬性 (0.6x STR + 0.6x CON)
      case WeaponType.SWORD_AND_SHIELD:
        patkBonus = Math.floor(attr.str * 0.6);
        defBonus = Math.floor(attr.con * 0.6);
        break;

      // 複合雙屬性武器 (各 0.6x，合計 1.2x 標準 A 級補正)
      case WeaponType.DUAL_SWORDS: // 魔劍士: STR (0.6) + INT (0.6)
        patkBonus = Math.floor(attr.str * 0.6);
        matkBonus = Math.floor(attr.int * 0.6);
        break;
      case WeaponType.MAGIC_BOW: // 精靈使: AGI (0.6) + INT (0.6)
        patkBonus = Math.floor(attr.agi * 0.6);
        matkBonus = Math.floor(attr.int * 0.6);
        break;
      case WeaponType.SCYTHE: // 死靈法師: STR (0.6) + INT (0.6)
        patkBonus = Math.floor(attr.str * 0.6);
        matkBonus = Math.floor(attr.int * 0.6);
        break;
      case WeaponType.HAMMER: // 異端拷問官: STR (0.6) + SPR (0.6)
        patkBonus = Math.floor(attr.str * 0.6);
        matkBonus = Math.floor(attr.spr * 0.6);
        break;
      case WeaponType.MAGIC_RING: // 詭術師: AGI (0.6) + INT (0.6)
        patkBonus = Math.floor(attr.agi * 0.6);
        matkBonus = Math.floor(attr.int * 0.6);
        break;
      case WeaponType.RUNE_SHIELD: // 符文騎士: CON (0.6) + SPR (0.6)
        defBonus = Math.floor(attr.con * 0.6 + attr.spr * 0.6);
        matkBonus = Math.floor(attr.spr * 0.6);
        break;

      default:
        patkBonus = Math.floor(attr.str * 0.8);
        matkBonus = Math.floor(attr.int * 0.8);
        break;
    }

    return { patkBonus, matkBonus, defBonus };
  }

  private buildMonstersForWaves(): MonsterInstance[][] {
    return this.enemyWaves.map(wave => {
      const instances: MonsterInstance[] = [];
      wave.forEach(cfg => {
        const baseMonster = this.monstersDb.find(m => m.id === cfg.monsterId) || this.monstersDb[0] || (monstersJson[0] as any);
        const appliedRace = cfg.isUndead ? MonsterRace.UNDEAD : (baseMonster.race || MonsterRace.MONSTER);
        const monsterDef = {
          ...baseMonster,
          profile: cfg.profile || baseMonster.profile || MonsterProfile.BALANCED,
          skills: cfg.skills || baseMonster.skills || []
        };
        const inst = this.monsterSystem.createMonsterInstance(monsterDef, appliedRace, cfg.element, cfg.difficulty);
        if (cfg.affix) {
          inst.name = `${cfg.affix}${inst.name}`;
        }
        instances.push(inst);
      });
      return instances;
    });
  }

  // ── 畫面渲染 ──
  private render(): void {
    this.renderStrongholdScenarioDropdown();
    if (this.currentStudioTab === 'heroes') {
      this.renderHeroDatabase();
      return;
    }
    if (this.currentStudioTab === 'monsters') {
      this.renderMonsterDatabase();
      return;
    }
    if (this.currentStudioTab === 'strongholds') {
      this.renderStrongholdStudio();
      return;
    }
    this.renderPlayerList();
    this.renderWaveTabs();
    this.renderEnemyList();
    this.renderArenaInitial();
    this.updateStrongholdGarrisonOptions();
  }

  // ── 四分頁模式切換 ──
  private switchStudioTab(tab: 'battle' | 'heroes' | 'monsters' | 'strongholds'): void {
    this.currentStudioTab = tab;
    const btnBattle = byId('btn-studio-tab-battle');
    const btnHeroes = byId('btn-studio-tab-heroes');
    const btnMonsters = byId('btn-studio-tab-monsters');
    const btnStrongholds = byId('btn-studio-tab-strongholds');
    const viewBattle = byId('cs-view-battle');
    const viewHeroes = byId('cs-view-heroes');
    const viewMonsters = byId('cs-view-monsters');
    const viewStrongholds = byId('cs-view-strongholds');

    btnBattle?.classList.toggle('active', tab === 'battle');
    btnHeroes?.classList.toggle('active', tab === 'heroes');
    btnMonsters?.classList.toggle('active', tab === 'monsters');
    btnStrongholds?.classList.toggle('active', tab === 'strongholds');

    if (viewBattle) viewBattle.style.display = tab === 'battle' ? 'grid' : 'none';
    if (viewHeroes) viewHeroes.style.display = tab === 'heroes' ? 'flex' : 'none';
    if (viewMonsters) viewMonsters.style.display = tab === 'monsters' ? 'flex' : 'none';
    if (viewStrongholds) viewStrongholds.style.display = tab === 'strongholds' ? 'flex' : 'none';

    this.render();
  }

  // ── 英雄資料庫全景卡片渲染 ──
  private renderHeroDatabase(): void {
    const grid = byId('cs-hero-db-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const allHeroes = this.getAllHeroes();
    const filtered = allHeroes.filter(h => {
      if (this.heroSearchQuery) {
        const q = this.heroSearchQuery;
        const matchName = h.name.toLowerCase().includes(q);
        const matchTitle = h.title.toLowerCase().includes(q);
        const matchJob = h.jobKey.toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchJob) return false;
      }
      if (this.heroFilterQuality !== 'ALL' && h.quality !== this.heroFilterQuality) return false;
      if (this.heroFilterJob !== 'ALL' && h.jobKey !== this.heroFilterJob) return false;
      return true;
    });

    const badge = byId('cs-hero-count-badge');
    if (badge) badge.textContent = `共 ${filtered.length} 位英雄`;

    filtered.forEach(h => {
      const card = document.createElement('div');
      card.className = 'cs-hero-card';
      card.style.borderColor = h.quality === 'UR' ? 'rgba(239, 68, 68, 0.4)' : h.quality === 'SSR' ? 'rgba(245, 158, 11, 0.4)' : 'var(--cs-panel-border)';

      const attrSum = h.customAttributes.str + h.customAttributes.agi + h.customAttributes.con + h.customAttributes.int + h.customAttributes.spr + h.customAttributes.luk;
      const qColor = h.quality === 'UR' ? '#ef4444' : h.quality === 'SSR' ? '#f59e0b' : h.quality === 'SR' ? '#a855f7' : '#3b82f6';
      const heroAvatar = h.avatarIcon || (h.isGuardian ? (h.gender === Gender.FEMALE ? 'guardian_f_0' : 'guardian_m_1') : (h.id.includes('reyn') ? 'heroes:reyn' : (h.id.includes('luna') ? 'heroes:luna' : this.getJobEmoji(this.mapJobKeyToName(h.jobKey, true)))));

      card.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <div class="cs-monster-avatar-box" title="點擊切換英雄圖標" data-avatar-hero-id="${h.id}" style="width: 56px; height: 56px; min-width: 56px; border-radius: 6px; background: #131720; border: 1.5px solid ${qColor}; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer;">
            ${renderUniversalIcon(heroAvatar, 44)}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold; color: ${qColor}; font-size: 0.95rem;">${h.title} ${h.name}</span>
              <span style="background: ${qColor}22; color: ${qColor}; border: 1px solid ${qColor}; padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: bold;">${h.quality}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--cs-text-muted); margin-top: 2px;">
              Lv.${h.level} ${this.mapJobKeyToName(h.jobKey, true)} · ${h.gender === Gender.FEMALE ? '女性' : '男性'} · 六維總合: <strong style="color: #fff;">${attrSum}</strong>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; background: #0f131a; padding: 6px; border-radius: 4px; text-align: center; font-size: 0.7rem; margin-top: 4px;">
          <div><span style="color: var(--cs-text-muted);">力量</span><br><strong>${h.customAttributes.str}</strong></div>
          <div><span style="color: var(--cs-text-muted);">敏捷</span><br><strong>${h.customAttributes.agi}</strong></div>
          <div><span style="color: var(--cs-text-muted);">體質</span><br><strong>${h.customAttributes.con}</strong></div>
          <div><span style="color: var(--cs-text-muted);">智慧</span><br><strong>${h.customAttributes.int}</strong></div>
          <div><span style="color: var(--cs-text-muted);">精神</span><br><strong>${h.customAttributes.spr}</strong></div>
          <div><span style="color: var(--cs-text-muted);">幸運</span><br><strong>${h.customAttributes.luk}</strong></div>
        </div>

        <div style="font-size: 0.72rem; color: var(--cs-text-muted); line-height: 1.4; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; margin-top: 4px;">
          📖 ${h.biography || '暫無傳記描述。'}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
          <div style="font-size: 0.72rem; color: var(--cs-gold);">
            ⚔️ 裝備: T4+${h.equipment.weaponEnhance} [${h.equipment.weaponElement || '無'}]
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="cs-btn cs-btn-sm cs-btn-gold" data-apply-hero-id="${h.id}">⚔️ 套用陣容</button>
            <button class="cs-btn cs-btn-sm" data-edit-hero-id="${h.id}">✏️ 編輯</button>
            ${h.id.startsWith('custom_') ? `<button class="cs-btn cs-btn-sm cs-btn-danger" data-del-hero-id="${h.id}">🗑️</button>` : ''}
          </div>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  // ── 怪物資料庫全景卡片渲染 ──
  private renderMonsterDatabase(): void {
    const grid = byId('cs-monster-db-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = this.monstersDb.filter(m => {
      if (this.monsterSearchQuery) {
        const q = this.monsterSearchQuery;
        const matchName = m.name.toLowerCase().includes(q);
        const matchId = m.id.toLowerCase().includes(q);
        const matchElem = (m.defaultElement || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchElem) return false;
      }
      if (this.monsterFilterRace !== 'ALL') {
        const matchPrimary = m.race === this.monsterFilterRace;
        const matchComp = m.compatibleRaces && m.compatibleRaces.includes(this.monsterFilterRace as any);
        if (!matchPrimary && !matchComp) return false;
      }
      if (this.monsterFilterTerrain !== 'ALL') {
        if (!m.terrains || !m.terrains.includes(this.monsterFilterTerrain as any)) return false;
      }
      if (this.monsterFilterBoss === 'BOSS') {
        if (!m.isBoss && (m.powerTier || 1) < 2.5) return false;
      } else if (this.monsterFilterBoss === 'NORMAL') {
        if (m.isBoss || (m.powerTier || 1) >= 2.5) return false;
      }
      return true;
    });

    const badge = byId('cs-monster-count-badge');
    if (badge) badge.textContent = `共 ${filtered.length} 隻怪物`;

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = `cs-monster-card ${m.isBoss ? 'is-boss' : ''}`;
      const elemText = m.defaultElement && m.defaultElement !== ElementType.NONE ? `[${m.defaultElement}]` : '';
      const avatar = m.avatarIcon || `icons_monsters:${m.id}`;

      card.innerHTML = `
        <div class="cs-monster-avatar-box" title="點擊切換圖標" data-avatar-monster-id="${m.id}">
          ${renderUniversalIcon(avatar, 42)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; color: ${m.isBoss ? 'var(--cs-gold)' : '#fff'}; font-size: 0.95rem;">${m.name}</span>
            <span style="font-size: 0.72rem; color: var(--cs-text-muted);">${m.id}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--cs-text-muted); margin-top: 2px;">
            ${m.race} · ${elemText || '無屬性'} · 強度: <strong>${m.powerTier || 1.0}x</strong>
          </div>
          <div style="font-size: 0.72rem; color: var(--cs-gold); margin-top: 4px;">
            地形: ${(m.terrains || []).join(', ')}
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 4px; margin-top: 8px;">
            <button class="cs-btn cs-btn-sm" data-edit-monster-id="${m.id}">✏️ 編輯</button>
            <button class="cs-btn cs-btn-sm cs-btn-danger" data-del-monster-id="${m.id}">🗑️</button>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  // ── 開啟怪物新增/編輯彈窗 ──
  private openMonsterCreator(monsterId?: string): void {
    this.editingMonsterId = monsterId || null;
    const modal = byId('modal-monster-creator');
    if (!modal) return;

    const titleEl = modal.querySelector('.cs-modal-title');
    const idInput = byId<HTMLInputElement>('mc-id');
    const nameInput = byId<HTMLInputElement>('mc-name');
    const raceSelect = byId<HTMLSelectElement>('mc-race');
    const elementSelect = byId<HTMLSelectElement>('mc-element');
    const powerTierInput = byId<HTMLInputElement>('mc-powertier');
    const attackTypeSelect = byId<HTMLSelectElement>('mc-attack-type');
    const avatarPreview = byId('mc-avatar-preview');

    if (monsterId) {
      const m = this.monstersDb.find(item => item.id === monsterId);
      if (!m) return;
      if (titleEl) titleEl.textContent = `✏️ 編輯怪物單位【${m.name}】`;
      if (idInput) { idInput.value = m.id; idInput.disabled = true; }
      if (nameInput) nameInput.value = m.name;
      if (raceSelect) raceSelect.value = m.race || 'MONSTER';
      if (elementSelect) elementSelect.value = m.defaultElement || 'NONE';
      if (powerTierInput) powerTierInput.value = String(m.powerTier || 1.0);
      if (attackTypeSelect) attackTypeSelect.value = m.isMagicalAttacker ? 'magical' : 'physical';

      const iconVal = m.avatarIcon || `icons_monsters:${m.id}`;
      if (avatarPreview) {
        avatarPreview.innerHTML = renderUniversalIcon(iconVal, 40);
        avatarPreview.dataset.iconVal = iconVal;
      }

      document.querySelectorAll<HTMLInputElement>('input[name="mc-terrain"]').forEach(cb => {
        cb.checked = (m.terrains || []).includes(cb.value as any);
      });
    } else {
      if (titleEl) titleEl.textContent = '👾 創造全新敵方單位 / 史詩 Boss';
      if (idInput) { idInput.value = ''; idInput.disabled = false; }
      if (nameInput) nameInput.value = '';
      if (raceSelect) raceSelect.value = 'MONSTER';
      if (elementSelect) elementSelect.value = 'NONE';
      if (powerTierInput) powerTierInput.value = '1.0';
      if (attackTypeSelect) attackTypeSelect.value = 'physical';

      if (avatarPreview) {
        avatarPreview.innerHTML = '👾';
        avatarPreview.dataset.iconVal = 'icons_monsters:goblin';
      }

      document.querySelectorAll<HTMLInputElement>('input[name="mc-terrain"]').forEach(cb => {
        cb.checked = cb.value === 'PLAINS' || cb.value === 'FOREST';
      });
    }

    modal.style.display = 'flex';
  }

  // ── 一鍵永久寫入專案磁碟 (monsters.json & subjugation_nodes.json) ──
  private async saveMonstersToDisk(): Promise<void> {
    try {
      const resMon = await fetch('/api/save-monster-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monsters: this.monstersDb, note: '在戰鬥工坊中儲存' })
      });
      const resSh = await fetch('/api/save-subjugation-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strongholds: this.strongholdsDb, note: '在戰鬥工坊中儲存' })
      });

      if (resMon.ok && resSh.ok) {
        const dataMon = await resMon.json();
        const dataSh = await resSh.json();
        alert(`💾 成功永久寫入專案磁碟！\n- 👾 怪物庫：共 ${dataMon.total} 隻單位\n- 🏰 討伐據點庫：共 ${dataSh.total} 處據點`);
      } else {
        alert('寫入磁碟失敗，請確認 Vite 開發伺服器正常運行中');
      }
    } catch (err: any) {
      alert(`寫入失敗: ${err.message}`);
    }
  }

  // ══════════════════════════════════════════
  // 🏰 討伐據點設計工坊 (Subjugation Node Studio)
  // ══════════════════════════════════════════

  private getActiveStronghold(): SubjugationTemplate | null {
    if (!this.editingStrongholdId && this.strongholdsDb.length > 0) {
      this.editingStrongholdId = this.strongholdsDb[0].id;
    }
    return this.strongholdsDb.find(s => s.id === this.editingStrongholdId) || this.strongholdsDb[0] || null;
  }

  public renderStrongholdScenarioDropdown(): void {
    const sel = byId<HTMLSelectElement>('cs-stronghold-select');
    if (!sel) return;
    const curVal = sel.value;
    sel.innerHTML = `
      <option value="custom">-- 自訂怪物小隊 --</option>
      <optgroup label="🏰 官方與自訂討伐據點庫">
        ${this.strongholdsDb.map(s => `<option value="${s.id}">🏰 ${s.name} (Lv.${s.difficulty} - ${s.terrain})</option>`).join('')}
      </optgroup>
      <optgroup label="⚔️ 特殊戰術情境">
        <option value="node_5">熔火巨龍巢 (難度 8 - 火山/骨龍Boss)</option>
        <option value="faction_siege">洛斯加正規軍攻城部隊 (難度 5)</option>
        <option value="church_crusade">神聖教廷裁決遠征軍 (難度 6)</option>
      </optgroup>
    `;
    if (curVal && (curVal === 'custom' || this.strongholdsDb.some(s => s.id === curVal) || ['node_5', 'faction_siege', 'church_crusade'].includes(curVal))) {
      sel.value = curVal;
    }
  }

  private renderStrongholdStudio(): void {
    this.renderStrongholdScenarioDropdown();
    this.renderStrongholdList();
    this.renderStrongholdForm();
    this.renderStrongholdAnalytics();
  }

  private renderStrongholdList(): void {
    const listEl = byId('sh-list-container');
    const countEl = byId('sh-count');
    if (!listEl) return;
    listEl.innerHTML = '';

    const q = this.strongholdSearchQuery.toLowerCase();
    const filtered = this.strongholdsDb.filter(s => {
      if (q && !s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
      if (this.strongholdFilterTerrain !== 'ALL' && s.terrain !== this.strongholdFilterTerrain) return false;
      return true;
    });

    if (countEl) countEl.textContent = String(filtered.length);

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="color: var(--cs-text-muted); font-size: 0.78rem; padding: 12px; text-align: center;">查無符合條件的討伐據點</div>';
      return;
    }

    filtered.forEach(s => {
      const isSelected = s.id === this.editingStrongholdId;
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 10px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 10px;
        background: ${isSelected ? 'rgba(234, 179, 8, 0.12)' : '#141822'};
        border: 1.5px solid ${isSelected ? 'var(--cs-gold)' : 'var(--cs-panel-border)'};
        transition: all 0.15s ease;
      `;
      const waveCount = s.waves?.length || 0;
      const totalMonsters = (s.waves || []).reduce((sum, w) => sum + (w.monsters?.length || 0), 0);

      card.innerHTML = `
        <div style="width: 40px; height: 40px; min-width: 40px; border-radius: 6px; background: #0e121a; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center;">
          ${renderUniversalIcon(s.icon || 'icons_buildings:icons_buildings_3', 34)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; font-size: 0.85rem; color: ${isSelected ? 'var(--cs-gold-light)' : '#f8fafc'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.name}</span>
            <span class="cs-badge" style="font-size: 0.68rem; color: var(--cs-orange); background: rgba(249,115,22,0.15); flex-shrink: 0;">Lv.${s.difficulty}</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--cs-text-muted); margin-top: 2px; display: flex; justify-content: space-between;">
            <span>${s.terrain}</span>
            <span>⚔️ ${waveCount} 波 (${totalMonsters} 隻)</span>
          </div>
        </div>
      `;

      card.onclick = () => {
        this.editingStrongholdId = s.id;
        this.renderStrongholdStudio();
      };

      listEl.appendChild(card);
    });
  }

  private renderStrongholdForm(): void {
    const sh = this.getActiveStronghold();
    if (!sh) return;

    const badgeEl = byId('sh-edit-badge');
    const titleEl = byId('sh-edit-title');
    if (badgeEl) badgeEl.textContent = sh.id;
    if (titleEl) titleEl.textContent = sh.name;

    const idInput = byId<HTMLInputElement>('sh-id');
    const nameInput = byId<HTMLInputElement>('sh-name');
    const terrainSelect = byId<HTMLSelectElement>('sh-terrain');
    const diffSlider = byId<HTMLInputElement>('sh-difficulty');
    const diffDisplay = byId('sh-diff-display');
    const iconInput = byId<HTMLInputElement>('sh-icon');
    const scoutingCheckbox = byId<HTMLInputElement>('sh-requires-scouting');
    const removeCheckbox = byId<HTMLInputElement>('sh-remove-on-victory');
    const secretCheckbox = byId<HTMLInputElement>('sh-is-world-secret');
    const fogRumorInput = byId<HTMLInputElement>('sh-fog-rumor');
    const revealRumorInput = byId<HTMLInputElement>('sh-reveal-rumor');
    const descTextarea = byId<HTMLTextAreaElement>('sh-description');

    const goldInput = byId<HTMLInputElement>('sh-reward-gold');
    const expInput = byId<HTMLInputElement>('sh-reward-exp');
    const prestigeInput = byId<HTMLInputElement>('sh-reward-prestige');

    if (idInput) idInput.value = sh.id;
    if (nameInput) nameInput.value = sh.name;
    if (terrainSelect) terrainSelect.value = sh.terrain || 'RUINS';
    if (diffSlider) diffSlider.value = String(sh.difficulty || 2);
    if (diffDisplay) diffDisplay.textContent = `Lv.${sh.difficulty || 2}`;
    if (iconInput) iconInput.value = sh.icon || 'icons_buildings:icons_buildings_3';
    const iconPreview = byId('sh-icon-preview');
    if (iconPreview) iconPreview.innerHTML = renderUniversalIcon(sh.icon || 'icons_buildings:icons_buildings_3', 32);
    if (scoutingCheckbox) scoutingCheckbox.checked = !!sh.requiresScouting;
    if (removeCheckbox) removeCheckbox.checked = sh.removeOnVictory !== false;
    if (secretCheckbox) secretCheckbox.checked = !!sh.isWorldSecret;
    if (fogRumorInput) fogRumorInput.value = sh.fogRumor || '';
    if (revealRumorInput) revealRumorInput.value = sh.revealRumor || '';
    if (descTextarea) descTextarea.value = sh.description || '';

    if (goldInput) goldInput.value = String(sh.rewards?.gold ?? 100);
    if (expInput) expInput.value = String(sh.rewards?.exp ?? 120);
    if (prestigeInput) prestigeInput.value = String(sh.rewards?.prestige ?? 15);

    // 隨行敵方軍團配置
    const legionEnableCheckbox = byId<HTMLInputElement>('sh-enemy-legion-enable');
    const legionInputsDiv = byId('sh-enemy-legion-inputs');
    const enemyInfInput = byId<HTMLInputElement>('sh-enemy-infantry');
    const enemyArcInput = byId<HTMLInputElement>('sh-enemy-archer');
    const enemyCavInput = byId<HTMLInputElement>('sh-enemy-cavalry');

    const isLegionEnabled = !!sh.enemyLegion?.enabled;
    if (legionEnableCheckbox) legionEnableCheckbox.checked = isLegionEnabled;
    if (legionInputsDiv) legionInputsDiv.style.display = isLegionEnabled ? 'grid' : 'none';
    if (enemyInfInput) enemyInfInput.value = String(sh.enemyLegion?.infantry ?? 0);
    if (enemyArcInput) enemyArcInput.value = String(sh.enemyLegion?.archer ?? 0);
    if (enemyCavInput) enemyCavInput.value = String(sh.enemyLegion?.cavalry ?? 0);

    this.renderStrongholdWaves(sh);
  }

  private renderStrongholdWaves(sh: SubjugationTemplate): void {
    const container = byId('sh-waves-container');
    if (!container) return;
    container.innerHTML = '';

    if (!sh.waves || sh.waves.length === 0) {
      sh.waves = [
        { name: '第 1 波：前哨守軍', monsters: [{ monsterId: 'goblin', powerTier: 1.0, gridR: 0, gridC: 1, slotId: '0_1', formationRow: FormationRow.FRONT }] }
      ];
    }

    sh.waves.forEach((w, wIdx) => {
      const isBoss = wIdx === sh.waves!.length - 1 && sh.waves!.length > 1;
      const waveCard = document.createElement('div');
      waveCard.style.cssText = 'background: #0f131a; padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;';

      waveCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.06); padding-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: bold; font-size: 0.82rem; color: ${isBoss ? 'var(--cs-gold)' : '#93c5fd'};">${isBoss ? '👑' : '🚩'} ${w.name || `第 ${wIdx + 1} 波`}</span>
            <span class="cs-badge" style="font-size: 0.68rem; color: var(--cs-text-muted);">${w.monsters?.length || 0}/9 隻</span>
          </div>
          <div style="display: flex; gap: 4px;">
            <button class="cs-btn cs-btn-sm cs-btn-gold" data-sh-add-monster="${wIdx}">＋ 增派怪物</button>
            ${sh.waves!.length > 1 ? `<button class="cs-btn cs-btn-sm cs-btn-danger" data-sh-del-wave="${wIdx}" title="刪除此波">🗑️</button>` : ''}
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
          <!-- 3x3 怪物戰術九宮格 (左側) -->
          <div style="background: rgba(0,0,0,0.45); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; padding: 0 2px;">
              <span>⚔️ 3×3 敵軍陣型布陣</span>
              <span>前排 ➔ 中排 ➔ 後排</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 76px); grid-template-rows: repeat(3, 76px); gap: 5px;" id="sh-grid-${wIdx}">
              <!-- 9 個九宮格槽位 -->
            </div>
          </div>

          <!-- 怪物卡片詳細列表 (右側) -->
          <div style="flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 6px;" id="sh-wave-monsters-${wIdx}">
            <!-- 怪物卡片 -->
          </div>
        </div>
      `;

      // 1. 渲染 3x3 九宮格槽位
      const gridEl = waveCard.querySelector(`#sh-grid-${wIdx}`);
      if (gridEl) {
        // 構建 slot 映射表
        const slotMonsterMap: Record<string, { mRef: SubjugationWaveMonster; mIdx: number }> = {};
        (w.monsters || []).forEach((mRef, mIdx) => {
          let sId = mRef.slotId;
          if (!sId) {
            const r = mRef.gridR !== undefined ? mRef.gridR : (mRef.formationRow === FormationRow.BACK ? 2 : 0);
            const c = mRef.gridC !== undefined ? mRef.gridC : (mIdx % 3);
            sId = `${r}_${c}`;
            mRef.gridR = r;
            mRef.gridC = c;
            mRef.slotId = sId;
          }
          slotMonsterMap[sId] = { mRef, mIdx };
        });

        // 渲染 3 行 3 列 (r: 0前排, 1中排, 2後排；c: 0上路, 1中路, 2下路)
        for (let c = 0; c < 3; c++) {
          for (let r = 0; r < 3; r++) {
            const slotId = `${r}_${c}`;
            const slotData = slotMonsterMap[slotId];
            const slotBox = document.createElement('div');
            slotBox.style.cssText = 'border-radius: 5px; border: 1px dashed rgba(255,255,255,0.15); display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; background: #121620; cursor: pointer; transition: all 0.2s; overflow: hidden;';

            if (slotData) {
              const { mRef, mIdx } = slotData;
              const mon = this.monstersDb.find(m => m.id === mRef.monsterId);
              const mName = mon?.name || mRef.monsterId;
              const mAvatar = mon?.avatarIcon || this.getMonsterAvatar(mRef.monsterId, mName);
              const tier = mRef.powerTier || mon?.powerTier || 1.0;

              slotBox.style.border = '1px solid rgba(239, 68, 68, 0.6)';
              slotBox.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(0, 0, 0, 0.5))';

              slotBox.innerHTML = `
                <div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
                  ${renderUniversalIcon(mAvatar, 32)}
                </div>
                <div style="font-size: 0.65rem; font-weight: bold; color: #fff; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;">${mName}</div>
                <div style="font-size: 0.58rem; color: #f59e0b;">${tier}x</div>
                <button type="button" data-sh-del-monster="${wIdx},${mIdx}" style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.8); color: #fff; border: none; border-radius: 50%; width: 14px; height: 14px; font-size: 9px; line-height: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="移除怪物">✕</button>
              `;

              slotBox.onclick = (e) => {
                if ((e.target as HTMLElement).tagName === 'BUTTON') return;
                this.openSubjugationMonsterConfig(wIdx, mIdx);
              };
            } else {
              // 空槽位
              slotBox.innerHTML = `
                <span style="font-size: 1rem; color: rgba(255,255,255,0.2);">＋</span>
                <span style="font-size: 0.6rem; color: rgba(255,255,255,0.3);">${r === 0 ? '前' : (r === 1 ? '中' : '後')}${c === 0 ? '上' : (c === 1 ? '中' : '下')}</span>
              `;
              slotBox.onmouseenter = () => { slotBox.style.borderColor = 'var(--cs-gold)'; slotBox.style.background = 'rgba(234,179,8,0.1)'; };
              slotBox.onmouseleave = () => { slotBox.style.borderColor = 'rgba(255,255,255,0.15)'; slotBox.style.background = '#121620'; };
              slotBox.onclick = () => {
                this.openSubjugationMonsterPicker(wIdx, slotId);
              };
            }

            gridEl.appendChild(slotBox);
          }
        }
      }

      // 2. 渲染右側詳細設定列表
      const monstersList = waveCard.querySelector(`#sh-wave-monsters-${wIdx}`);
      if (monstersList) {
        if (!w.monsters || w.monsters.length === 0) {
          monstersList.innerHTML = '<span style="color: var(--cs-text-muted); font-size: 0.72rem; padding: 8px;">目前無怪物，點擊左側九宮格或「增派怪物」加入</span>';
        } else {
          w.monsters.forEach((mRef, mIdx) => {
            const mon = this.monstersDb.find(m => m.id === mRef.monsterId);
            const mName = mon?.name || mRef.monsterId;
            const mAvatar = mon?.avatarIcon || this.getMonsterAvatar(mRef.monsterId, mName);
            const mCard = document.createElement('div');
            mCard.style.cssText = 'background: #141822; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--cs-panel-border); display: flex; align-items: center; justify-content: space-between; gap: 6px;';

            const profileBadge = mRef.profile && (mRef.profile as any) !== 'DEFAULT'
              ? `<span class="cs-badge" style="font-size: 0.62rem; background: rgba(59,130,246,0.18); color: #60a5fa; padding: 1px 4px;">${mRef.profile}</span>`
              : '';
            const rLabel = mRef.gridR === 0 ? '前排' : (mRef.gridR === 1 ? '中排' : '後排');
            const cLabel = mRef.gridC === 0 ? '上' : (mRef.gridC === 1 ? '中' : '下');
            const slotBadge = `<span class="cs-badge" style="font-size: 0.62rem; background: rgba(34,197,94,0.18); color: #4ade80; padding: 1px 4px;">${rLabel}-${cLabel} (${mRef.slotId || `${mRef.gridR || 0}_${mRef.gridC || 0}`})</span>`;

            const skillBadge = mRef.skills && mRef.skills.length > 0
              ? `<span class="cs-badge" style="font-size: 0.62rem; background: rgba(234,179,8,0.18); color: #fde047; padding: 1px 4px;">✨${mRef.skills.length}技</span>`
              : '';
            const affixText = mRef.affix ? `<span style="font-size: 0.68rem; color: #f59e0b; font-weight: bold;">${mRef.affix}</span> ` : '';

            mCard.innerHTML = `
              <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
                <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 4px; background: #0c1017; display: flex; align-items: center; justify-content: center;">
                  ${renderUniversalIcon(mAvatar, 28)}
                </div>
                <div style="min-width: 0; flex: 1;">
                  <div style="font-weight: bold; font-size: 0.78rem; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${affixText}${mName}</div>
                  <div style="font-size: 0.66rem; color: var(--cs-text-muted); display: flex; gap: 4px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
                    <span>強化: <b>${mRef.powerTier || mon?.powerTier || 1.0}x</b></span>
                    ${slotBadge}
                    ${profileBadge}
                    ${skillBadge}
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 4px;">
                <button class="cs-btn cs-btn-sm cs-btn-secondary" style="padding: 1px 6px; font-size: 0.65rem;" data-sh-config-monster="${wIdx},${mIdx}" title="配置強化倍率、定位與技能">⚙️</button>
                <button class="cs-btn cs-btn-sm cs-btn-danger" style="padding: 1px 4px; font-size: 0.65rem;" data-sh-del-monster="${wIdx},${mIdx}" title="刪除此怪">✕</button>
              </div>
            `;
            monstersList.appendChild(mCard);
          });
        }
      }

      container.appendChild(waveCard);
    });
  }

  private renderStrongholdAnalytics(): void {
    const sh = this.getActiveStronghold();
    if (!sh) return;

    let totalPower = 0;
    (sh.waves || []).forEach((w, wIdx) => {
      (w.monsters || []).forEach(mRef => {
        const mon = this.monstersDb.find(m => m.id === mRef.monsterId);
        const tier = mRef.powerTier || mon?.powerTier || 1.0;
        const profileMult = mRef.profile === MonsterProfile.BOSS ? 1.5 : (mRef.profile === MonsterProfile.TANK || mRef.profile === MonsterProfile.BERSERKER ? 1.2 : 1.0);
        const skillBonus = (mRef.skills?.length || 0) * 15;
        const diffMultiplier = 1 + (sh.difficulty || 2) * 0.2 + wIdx * 0.15;
        totalPower += Math.round(tier * 40 * profileMult * diffMultiplier) + skillBonus;
      });
    });

    const powerEl = byId('sh-kpi-power');
    const recEl = byId('sh-kpi-rec');
    if (powerEl) powerEl.textContent = `⚔️ ${totalPower}`;

    let recText = '1~2 人 Lv.1~3 小隊';
    if (sh.difficulty >= 6 || totalPower >= 450) recText = '5 人滿編 Lv.8~10 (神裝/UR隊)';
    else if (sh.difficulty >= 4 || totalPower >= 280) recText = '4~5 人 Lv.5~7 精英小隊';
    else if (sh.difficulty >= 2 || totalPower >= 140) recText = '3~4 人 Lv.3~5 標準小隊';

    if (recEl) recEl.textContent = recText;
  }

  private openSubjugationMonsterConfig(waveIdx: number, monsterIdx: number): void {
    this.currentConfiguringWaveIdx = waveIdx;
    this.currentConfiguringMonsterIdx = monsterIdx;
    const sh = this.getActiveStronghold();
    const mRef = sh?.waves?.[waveIdx]?.monsters?.[monsterIdx];
    if (!mRef) return;

    const mon = this.monstersDb.find(m => m.id === mRef.monsterId);
    const mName = mon?.name || mRef.monsterId;
    const mAvatar = mon?.avatarIcon || this.getMonsterAvatar(mRef.monsterId, mName);

    const avatarEl = byId('sh-mc-avatar');
    const titleEl = byId('sh-mc-title');
    if (avatarEl) avatarEl.innerHTML = renderUniversalIcon(mAvatar, 30);
    if (titleEl) titleEl.textContent = `${mName} (第 ${waveIdx + 1} 波)`;

    const powerInput = byId<HTMLInputElement>('sh-mc-power-tier');
    const profileSelect = byId<HTMLSelectElement>('sh-mc-profile');
    const formationSelect = byId<HTMLSelectElement>('sh-mc-formation');
    const elementSelect = byId<HTMLSelectElement>('sh-mc-element');
    const affixInput = byId<HTMLInputElement>('sh-mc-affix');
    const searchInput = byId<HTMLInputElement>('sh-mc-skill-search');

    if (powerInput) powerInput.value = String(mRef.powerTier ?? mon?.powerTier ?? 1.0);
    if (profileSelect) profileSelect.value = mRef.profile || 'DEFAULT';

    const currentSlot = mRef.slotId || `${mRef.gridR || 0}_${mRef.gridC || 0}`;
    if (formationSelect) formationSelect.value = currentSlot;

    if (elementSelect) elementSelect.value = mRef.element || mon?.defaultElement || 'NONE';
    if (affixInput) affixInput.value = mRef.affix || '';
    if (searchInput) searchInput.value = '';

    this.tempShMonsterSkills = [...(mRef.skills || mon?.skills || [])];
    this.renderShMonsterCurrentSkills();
    this.renderShMonsterSkillLibrary('');

    byId('modal-sh-monster-config').style.display = 'flex';
  }

  private renderShMonsterCurrentSkills(): void {
    const listEl = byId('sh-mc-current-skills-list');
    const countEl = byId('sh-mc-current-count');
    if (countEl) countEl.textContent = String(this.tempShMonsterSkills.length);
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.tempShMonsterSkills.length === 0) {
      listEl.innerHTML = '<span style="color: var(--cs-text-muted); font-size: 0.75rem;">尚未裝備任何特技 (僅能普攻)</span>';
      return;
    }

    this.tempShMonsterSkills.forEach((skId, sIdx) => {
      const sk = SkillRegistry.getSkill(skId);
      const tag = document.createElement('div');
      tag.className = 'cs-badge';
      tag.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 0.75rem; background: rgba(59,130,246,0.2); border: 1px solid #3b82f6; color: #93c5fd; border-radius: 4px;';
      tag.innerHTML = `
        <span title="${sk?.description || ''}">✨ ${sk?.name || skId} (MP: ${sk?.mpCost || 0})</span>
        <button type="button" class="cs-btn cs-btn-danger cs-btn-sm" style="padding: 0 4px; font-size: 0.65rem; line-height: 14px; margin-left: 2px;" data-sh-remove-m-skill="${sIdx}" title="移除特技">✕</button>
      `;
      listEl.appendChild(tag);
    });
  }

  private renderShMonsterSkillLibrary(searchQuery: string = ''): void {
    const listEl = byId('sh-mc-skill-library-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const allSkills = SkillRegistry.getAllSkills();
    const q = searchQuery.toLowerCase();
    const filtered = allSkills.filter(s => {
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="color: var(--cs-text-muted); padding: 12px; text-align: center; font-size: 0.75rem;">查無符合條件的特技</div>';
      return;
    }

    filtered.forEach(sk => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: #131720; border: 1px solid var(--cs-panel-border); border-radius: 5px; gap: 8px;';

      const isEquipped = this.tempShMonsterSkills.includes(sk.id);
      const isFull = this.tempShMonsterSkills.length >= 4;

      item.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: bold; color: var(--cs-gold-light); font-size: 0.8rem;">✨ ${sk.name}</span>
            <span class="cs-badge" style="font-size: 0.65rem; color: #60a5fa; background: rgba(59,130,246,0.15);">💧 MP ${sk.mpCost || 0}</span>
            <span class="cs-badge" style="font-size: 0.65rem; color: var(--cs-text-muted);">${sk.category || '通用'}</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--cs-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sk.description || ''}">
            ${sk.description || ''}
          </div>
        </div>
        <button type="button" class="cs-btn cs-btn-sm ${isEquipped ? '' : 'cs-btn-primary'}" style="padding: 2px 8px; font-size: 0.72rem; flex-shrink: 0;" data-sh-add-m-skill="${sk.id}" ${isEquipped || isFull ? 'disabled' : ''}>
          ${isEquipped ? '已裝備' : isFull ? '已滿4招' : '＋ 加入'}
        </button>
      `;

      listEl.appendChild(item);
    });
  }

  private saveSubjugationMonsterConfig(): void {
    const sh = this.getActiveStronghold();
    const mRef = sh?.waves?.[this.currentConfiguringWaveIdx]?.monsters?.[this.currentConfiguringMonsterIdx];
    if (!mRef) return;

    const powerVal = Number(byId<HTMLInputElement>('sh-mc-power-tier')?.value || 1.0);
    const profileVal = byId<HTMLSelectElement>('sh-mc-profile')?.value;
    const formationSlotVal = byId<HTMLSelectElement>('sh-mc-formation')?.value || '0_0';
    const elementVal = byId<HTMLSelectElement>('sh-mc-element')?.value as any;
    const affixVal = byId<HTMLInputElement>('sh-mc-affix')?.value.trim();

    const [rStr, cStr] = formationSlotVal.split('_');
    const gridR = parseInt(rStr, 10) || 0;
    const gridC = parseInt(cStr, 10) || 0;

    mRef.powerTier = Math.max(0.1, powerVal);
    mRef.profile = profileVal && profileVal !== 'DEFAULT' ? (profileVal as any) : undefined;
    mRef.gridR = gridR;
    mRef.gridC = gridC;
    mRef.slotId = formationSlotVal;
    mRef.formationRow = gridR === 0 ? FormationRow.FRONT : (gridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
    mRef.element = elementVal && elementVal !== 'NONE' ? elementVal : undefined;
    mRef.affix = affixVal || undefined;
    mRef.skills = this.tempShMonsterSkills.length > 0 ? [...this.tempShMonsterSkills] : undefined;

    this.saveStrongholdsToStorage();
    byId('modal-sh-monster-config').style.display = 'none';
    this.renderStrongholdForm();
    this.renderStrongholdAnalytics();
  }

  private openSubjugationMonsterPicker(waveIdx: number, targetSlot?: string): void {
    this.currentPickerWaveIdx = waveIdx;
    this.currentPickerTargetSlot = targetSlot || null;
    const titleEl = byId('sh-picker-wave-title');
    if (titleEl) titleEl.textContent = `第 ${waveIdx + 1} 波${targetSlot ? ` (${targetSlot.replace('_', '行 ')}列)` : ''}`;

    const searchInput = byId<HTMLInputElement>('sh-monster-picker-search');
    const raceSelect = byId<HTMLSelectElement>('sh-monster-picker-race');
    if (searchInput) searchInput.value = '';
    if (raceSelect) raceSelect.value = 'ALL';

    this.renderSubjugationMonsterPickerList(waveIdx, '', 'ALL');
    byId('modal-sh-monster-picker').style.display = 'flex';
  }

  private renderSubjugationMonsterPickerList(waveIdx: number, query: string, raceFilter: string): void {
    const grid = byId('sh-monster-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const q = query.toLowerCase();
    const filtered = this.monstersDb.filter(m => {
      if (q && !m.name.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) return false;
      if (raceFilter !== 'ALL' && m.race !== raceFilter) return false;
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: span 2; color: var(--cs-text-muted); font-size: 0.78rem; padding: 12px; text-align: center;">查無符合的怪物</div>';
      return;
    }

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.style.cssText = 'background: #141822; padding: 6px 10px; border-radius: 5px; border: 1px solid var(--cs-panel-border); display: flex; align-items: center; justify-content: space-between; cursor: pointer; gap: 8px;';
      const mAvatar = m.avatarIcon || this.getMonsterAvatar(m.id, m.name);

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 4px; background: #0c1017; display: flex; align-items: center; justify-content: center;">
            ${renderUniversalIcon(mAvatar, 28)}
          </div>
          <div style="min-width: 0;">
            <div style="font-weight: bold; font-size: 0.8rem; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.name}</div>
            <div style="font-size: 0.68rem; color: var(--cs-text-muted);">${m.race} · 係數: ${m.powerTier || 1.0}x</div>
          </div>
        </div>
        <button class="cs-btn cs-btn-sm cs-btn-gold" style="padding: 2px 8px; font-size: 0.72rem; flex-shrink: 0;">＋ 選用</button>
      `;

      card.onclick = () => {
        const sh = this.getActiveStronghold();
        if (sh && sh.waves && sh.waves[waveIdx]) {
          if (!sh.waves[waveIdx].monsters) sh.waves[waveIdx].monsters = [];
          if (sh.waves[waveIdx].monsters.length >= 9) {
            alert('單一波次最多支援 9 隻守軍 (填滿 3×3 九宮格)！');
            return;
          }

          let gridR = 0;
          let gridC = 0;
          let slotId = '0_0';
          let formationRow = FormationRow.FRONT;

          if (this.currentPickerTargetSlot) {
            slotId = this.currentPickerTargetSlot;
            const [rStr, cStr] = slotId.split('_');
            gridR = parseInt(rStr, 10) || 0;
            gridC = parseInt(cStr, 10) || 0;
            formationRow = gridR === 0 ? FormationRow.FRONT : (gridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
          } else {
            const occupied = new Set((sh.waves[waveIdx].monsters || []).map(item => item.slotId || `${item.gridR || 0}_${item.gridC || 0}`));
            let found = false;
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                const sKey = `${r}_${c}`;
                if (!occupied.has(sKey)) {
                  gridR = r;
                  gridC = c;
                  slotId = sKey;
                  formationRow = r === 0 ? FormationRow.FRONT : (r === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
                  found = true;
                  break;
                }
              }
              if (found) break;
            }
          }

          sh.waves[waveIdx].monsters.push({
            monsterId: m.id,
            powerTier: m.powerTier || 1.0,
            gridR,
            gridC,
            slotId,
            formationRow
          });

          this.saveStrongholdsToStorage();
          this.renderStrongholdStudio();
          byId('modal-sh-monster-picker').style.display = 'none';
        }
      };

      grid.appendChild(card);
    });
  }

  private loadStrongholdToBattleSandbox(sh: SubjugationTemplate, showAlert: boolean = true): void {
    if (!sh || !sh.waves || sh.waves.length === 0) return;

    this.enemyWaves = [];
    sh.waves.forEach((w, wIdx) => {
      const isBossWave = wIdx === sh.waves!.length - 1 && sh.waves!.length > 1;
      const waveUnits: EnemyUnitConfig[] = [];

      (w.monsters || []).forEach((mRef, mIdx) => {
        const mon = this.monstersDb.find(m => m.id === mRef.monsterId);
        const mName = mon?.name || mRef.monsterId;
        const isBoss = isBossWave && mIdx === w.monsters.length - 1;
        const diffMultiplier = mRef.powerTier || mon?.powerTier || 1.0;
        const finalDiff = Math.max(1, Math.round(((sh.difficulty || 2) + wIdx) * diffMultiplier));
        waveUnits.push({
          monsterId: mRef.monsterId,
          name: mName,
          difficulty: finalDiff,
          element: mRef.element || mon?.defaultElement || ElementType.NONE,
          isUndead: mon?.race === MonsterRace.UNDEAD,
          avatarIcon: mon?.avatarIcon || this.getMonsterAvatar(mRef.monsterId, mName),
          affix: mRef.affix || (isBoss ? '👑[守將]' : undefined),
          formationRow: mRef.formationRow || (mIdx < 2 ? FormationRow.FRONT : FormationRow.BACK),
          profile: mRef.profile && (mRef.profile as any) !== 'DEFAULT' ? mRef.profile : mon?.profile,
          skills: mRef.skills && mRef.skills.length > 0 ? [...mRef.skills] : (mon?.skills ? [...mon.skills] : undefined)
        });
      });

      if (waveUnits.length > 0) this.enemyWaves.push(waveUnits);
    });

    if (this.enemyWaves.length === 0) {
      this.enemyWaves = [[
        { monsterId: 'goblin', name: '哥布林', difficulty: sh.difficulty || 2, element: ElementType.NONE, isUndead: false, avatarIcon: '👺', formationRow: FormationRow.FRONT }
      ]];
    }

    this.currentWaveIdx = 0;
    const diffSlider = byId<HTMLInputElement>('cs-enemy-diff-slider');
    const diffVal = byId('cs-enemy-diff-val');
    if (diffSlider && diffVal) {
      diffSlider.value = String(sh.difficulty || 2);
      diffVal.textContent = `Lv.${sh.difficulty || 2}`;
    }

    const strongholdSelect = byId<HTMLSelectElement>('cs-stronghold-select');
    if (strongholdSelect) {
      strongholdSelect.value = sh.id;
    }

    if (showAlert) {
      this.switchStudioTab('battle');
      alert(`⚡ 已成功將據點【${sh.name}】的 ${this.enemyWaves.length} 波守軍陣容載入至戰鬥沙盒！`);
    } else {
      this.render();
    }
  }

  private createNewStronghold(): void {
    const nextIdx = this.strongholdsDb.length + 1;
    const newSh: SubjugationTemplate = {
      id: `custom_stronghold_${Date.now()}`,
      name: `新討伐據點 ${nextIdx}`,
      description: '描述此據點的敵方勢力與地理環境...',
      terrain: 'RUINS',
      icon: 'icons_buildings:icons_buildings_3',
      difficulty: 2,
      requiresScouting: false,
      removeOnVictory: true,
      waves: [
        {
          name: '第 1 波：先鋒部隊',
          monsters: [
            { monsterId: 'goblin', powerTier: 0.8 },
            { monsterId: 'wild_wolf', powerTier: 0.8 }
          ]
        },
        {
          name: '第 2 波：據點首領',
          monsters: [
            { monsterId: 'orc', powerTier: 1.5 }
          ]
        }
      ],
      rewards: {
        gold: 100,
        exp: 120,
        prestige: 15
      }
    };

    this.strongholdsDb.unshift(newSh);
    this.editingStrongholdId = newSh.id;
    this.saveStrongholdsToStorage();
    this.renderStrongholdStudio();
  }

  private duplicateCurrentStronghold(): void {
    const cur = this.getActiveStronghold();
    if (!cur) return;
    const dup = clone(cur) as SubjugationTemplate;
    dup.id = `${cur.id}_copy_${Date.now().toString().slice(-4)}`;
    dup.name = `${cur.name} (副本)`;
    this.strongholdsDb.unshift(dup);
    this.editingStrongholdId = dup.id;
    this.saveStrongholdsToStorage();
    this.renderStrongholdStudio();
  }

  private deleteCurrentStronghold(): void {
    const cur = this.getActiveStronghold();
    if (!cur) return;
    if (confirm(`確定要刪除據點【${cur.name}】嗎？`)) {
      this.strongholdsDb = this.strongholdsDb.filter(s => s.id !== cur.id);
      this.editingStrongholdId = this.strongholdsDb[0]?.id || null;
      this.saveStrongholdsToStorage();
      this.renderStrongholdStudio();
    }
  }

  private bindStrongholdEvents(): void {
    byId('btn-studio-tab-strongholds')?.addEventListener('click', () => this.switchStudioTab('strongholds'));
    byId('btn-sh-reload-disk')?.addEventListener('click', async () => {
      await this.loadStrongholds();
      this.renderStrongholdStudio();
      alert('🔄 已成功從專案磁碟重新載入最新討伐據點！');
    });
    byId('btn-sh-save-disk')?.addEventListener('click', () => this.saveMonstersToDisk());
    byId('btn-sh-add')?.addEventListener('click', () => this.createNewStronghold());
    byId('btn-sh-duplicate')?.addEventListener('click', () => this.duplicateCurrentStronghold());
    byId('btn-sh-delete')?.addEventListener('click', () => this.deleteCurrentStronghold());

    const handleIconPick = () => {
      this.openIconPicker(newIcon => {
        const sh = this.getActiveStronghold();
        if (!sh) return;
        sh.icon = newIcon;
        const iconInput = byId<HTMLInputElement>('sh-icon');
        if (iconInput) iconInput.value = newIcon;
        const iconPreview = byId('sh-icon-preview');
        if (iconPreview) iconPreview.innerHTML = renderUniversalIcon(newIcon, 32);
        this.saveStrongholdsToStorage();
        this.renderStrongholdList();
      });
    };
    byId('btn-sh-select-icon')?.addEventListener('click', handleIconPick);
    byId('sh-icon-preview')?.addEventListener('click', handleIconPick);

    byId<HTMLInputElement>('sh-search')?.addEventListener('input', e => {
      this.strongholdSearchQuery = (e.target as HTMLInputElement).value;
      this.renderStrongholdList();
    });

    byId<HTMLSelectElement>('sh-filter-terrain')?.addEventListener('change', e => {
      this.strongholdFilterTerrain = (e.target as HTMLSelectElement).value;
      this.renderStrongholdList();
    });

    byId('btn-sh-load-to-battle')?.addEventListener('click', () => {
      const sh = this.getActiveStronghold();
      if (sh) this.loadStrongholdToBattleSandbox(sh);
    });

    byId('btn-sh-add-wave')?.addEventListener('click', () => {
      const sh = this.getActiveStronghold();
      if (sh) {
        if (!sh.waves) sh.waves = [];
        if (sh.waves.length >= 5) {
          alert('最多支援 5 波敵軍！');
          return;
        }
        sh.waves.push({
          name: `第 ${sh.waves.length + 1} 波`,
          monsters: [{ monsterId: 'goblin', powerTier: 1.0 }]
        });
        this.saveStrongholdsToStorage();
        this.renderStrongholdStudio();
      }
    });

    // 據點欄位即時綁定
    const syncField = () => {
      const sh = this.getActiveStronghold();
      if (!sh) return;

      const idVal = byId<HTMLInputElement>('sh-id')?.value.trim();
      const nameVal = byId<HTMLInputElement>('sh-name')?.value.trim();
      const terrainVal = byId<HTMLSelectElement>('sh-terrain')?.value as any;
      const diffVal = Number(byId<HTMLInputElement>('sh-difficulty')?.value || 2);
      const iconVal = byId<HTMLInputElement>('sh-icon')?.value.trim();
      const scoutingVal = byId<HTMLInputElement>('sh-requires-scouting')?.checked;
      const removeVal = byId<HTMLInputElement>('sh-remove-on-victory')?.checked;
      const secretVal = byId<HTMLInputElement>('sh-is-world-secret')?.checked;
      const fogRumorVal = byId<HTMLInputElement>('sh-fog-rumor')?.value.trim();
      const revealRumorVal = byId<HTMLInputElement>('sh-reveal-rumor')?.value.trim();
      const descVal = byId<HTMLTextAreaElement>('sh-description')?.value;

      const goldVal = Number(byId<HTMLInputElement>('sh-reward-gold')?.value || 0);
      const expVal = Number(byId<HTMLInputElement>('sh-reward-exp')?.value || 0);
      const prestigeVal = Number(byId<HTMLInputElement>('sh-reward-prestige')?.value || 0);

      const legionEnableVal = byId<HTMLInputElement>('sh-enemy-legion-enable')?.checked || false;
      const enemyInfVal = Math.max(0, Number(byId<HTMLInputElement>('sh-enemy-infantry')?.value || 0));
      const enemyArcVal = Math.max(0, Number(byId<HTMLInputElement>('sh-enemy-archer')?.value || 0));
      const enemyCavVal = Math.max(0, Number(byId<HTMLInputElement>('sh-enemy-cavalry')?.value || 0));

      const legionInputsDiv = byId('sh-enemy-legion-inputs');
      if (legionInputsDiv) legionInputsDiv.style.display = legionEnableVal ? 'grid' : 'none';

      if (idVal) sh.id = idVal;
      if (nameVal) sh.name = nameVal;
      if (terrainVal) sh.terrain = terrainVal;
      sh.difficulty = diffVal;
      if (iconVal) sh.icon = iconVal;
      sh.requiresScouting = scoutingVal;
      sh.removeOnVictory = removeVal;
      sh.isWorldSecret = secretVal;
      sh.fogRumor = fogRumorVal || undefined;
      sh.revealRumor = revealRumorVal || undefined;
      sh.description = descVal;

      sh.enemyLegion = {
        enabled: legionEnableVal,
        infantry: enemyInfVal,
        archer: enemyArcVal,
        cavalry: enemyCavVal
      };

      sh.rewards = {
        gold: goldVal,
        exp: expVal,
        prestige: prestigeVal
      };

      byId('sh-diff-display').textContent = `Lv.${diffVal}`;
      byId('sh-edit-badge').textContent = sh.id;
      byId('sh-edit-title').textContent = sh.name;

      this.saveStrongholdsToStorage();
      this.renderStrongholdList();
      this.renderStrongholdAnalytics();
    };

    ['sh-id', 'sh-name', 'sh-terrain', 'sh-difficulty', 'sh-icon', 'sh-requires-scouting', 'sh-remove-on-victory', 'sh-is-world-secret', 'sh-fog-rumor', 'sh-reveal-rumor', 'sh-description', 'sh-reward-gold', 'sh-reward-exp', 'sh-reward-prestige', 'sh-enemy-legion-enable', 'sh-enemy-infantry', 'sh-enemy-archer', 'sh-enemy-cavalry']
      .forEach(id => {
        const el = byId(id);
        if (el) {
          el.addEventListener('input', syncField);
          el.addEventListener('change', syncField);
        }
      });

    // 波次卡片事件委派 (增派怪物 / 刪除波次 / 刪除怪物)
    document.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      if (target.dataset.shAddMonster !== undefined) {
        const wIdx = Number(target.dataset.shAddMonster);
        this.openSubjugationMonsterPicker(wIdx);
      }
      if (target.dataset.shDelWave !== undefined) {
        const wIdx = Number(target.dataset.shDelWave);
        const sh = this.getActiveStronghold();
        if (sh && sh.waves && sh.waves.length > 1) {
          sh.waves.splice(wIdx, 1);
          this.saveStrongholdsToStorage();
          this.renderStrongholdStudio();
        }
      }
      if (target.dataset.shConfigMonster !== undefined) {
        const [wIdxStr, mIdxStr] = target.dataset.shConfigMonster.split(',');
        this.openSubjugationMonsterConfig(Number(wIdxStr), Number(mIdxStr));
      }
      if (target.dataset.shDelMonster !== undefined) {
        const [wIdxStr, mIdxStr] = target.dataset.shDelMonster.split(',');
        const wIdx = Number(wIdxStr);
        const mIdx = Number(mIdxStr);
        const sh = this.getActiveStronghold();
        if (sh && sh.waves && sh.waves[wIdx] && sh.waves[wIdx].monsters) {
          sh.waves[wIdx].monsters.splice(mIdx, 1);
          this.saveStrongholdsToStorage();
          this.renderStrongholdStudio();
        }
      }
    });

    // 怪物挑選彈窗事件
    byId('btn-close-sh-monster-picker')?.addEventListener('click', () => byId('modal-sh-monster-picker').style.display = 'none');
    byId('btn-close-sh-monster-picker-footer')?.addEventListener('click', () => byId('modal-sh-monster-picker').style.display = 'none');
    byId<HTMLInputElement>('sh-monster-picker-search')?.addEventListener('input', e => {
      const q = (e.target as HTMLInputElement).value;
      const race = byId<HTMLSelectElement>('sh-monster-picker-race')?.value || 'ALL';
      this.renderSubjugationMonsterPickerList(this.currentPickerWaveIdx, q, race);
    });
    byId<HTMLSelectElement>('sh-monster-picker-race')?.addEventListener('change', e => {
      const race = (e.target as HTMLSelectElement).value;
      const q = byId<HTMLInputElement>('sh-monster-picker-search')?.value || '';
      this.renderSubjugationMonsterPickerList(this.currentPickerWaveIdx, q, race);
    });

    // 據點守軍怪物進階配置彈窗事件
    byId('btn-close-sh-monster-config')?.addEventListener('click', () => byId('modal-sh-monster-config').style.display = 'none');
    byId('btn-close-sh-monster-config-footer')?.addEventListener('click', () => byId('modal-sh-monster-config').style.display = 'none');
    byId('btn-save-sh-monster-config')?.addEventListener('click', () => this.saveSubjugationMonsterConfig());

    // 據點守軍特技搜尋即時過濾
    byId<HTMLInputElement>('sh-mc-skill-search')?.addEventListener('input', e => {
      const q = (e.target as HTMLInputElement).value;
      this.renderShMonsterSkillLibrary(q);
    });

    // 據點守軍特技加入與移除委派
    byId('modal-sh-monster-config')?.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const addBtn = target.closest('[data-sh-add-m-skill]') as HTMLElement | null;
      if (addBtn && addBtn.dataset.shAddMSkill) {
        const skId = addBtn.dataset.shAddMSkill;
        if (!this.tempShMonsterSkills.includes(skId) && this.tempShMonsterSkills.length < 4) {
          this.tempShMonsterSkills.push(skId);
          const q = byId<HTMLInputElement>('sh-mc-skill-search')?.value || '';
          this.renderShMonsterCurrentSkills();
          this.renderShMonsterSkillLibrary(q);
        }
      }

      const rmBtn = target.closest('[data-sh-remove-m-skill]') as HTMLElement | null;
      if (rmBtn && rmBtn.dataset.shRemoveMSkill !== undefined) {
        const sIdx = Number(rmBtn.dataset.shRemoveMSkill);
        this.tempShMonsterSkills.splice(sIdx, 1);
        const q = byId<HTMLInputElement>('sh-mc-skill-search')?.value || '';
        this.renderShMonsterCurrentSkills();
        this.renderShMonsterSkillLibrary(q);
      }
    });
  }

  private mapJobKeyToName(jobKey: string, isAdvanced: boolean): string {
    const map: Record<string, { base: string; adv: string }> = {
      WARRIOR: { base: '戰士', adv: '狂戰士' },
      KNIGHT: { base: '騎士', adv: '聖騎士' },
      MAGE: { base: '法師', adv: '大魔導士' },
      ARCHER: { base: '弓箭手', adv: '神射手' },
      THIEF: { base: '盜賊', adv: '暗殺者' },
      PRAYER: { base: '祈禱者', adv: '大主教' }
    };
    const info = map[jobKey] || { base: '戰士', adv: '狂戰士' };
    return isAdvanced ? info.adv : info.base;
  }

  private applyHeroToPlayerSlot(hero: UniqueHeroDef, slotIdx: number): void {
    if (slotIdx < 0 || slotIdx >= this.playerTeam.length) {
      if (this.playerTeam.length < 5) slotIdx = this.playerTeam.length;
      else slotIdx = 0;
    }

    if (hero.quality === 'UR') {
      const existingUr = this.playerTeam.find((m, i) => i !== slotIdx && m.quality === 'UR');
      if (existingUr) {
        alert(`⚠️ 隊伍中最多只能編入 1 位 UR 品質傭兵！(目前隊伍中已有 ${existingUr.name})`);
        return;
      }
    }

    const jobName = this.mapJobKeyToName(hero.jobKey, true);
    const weaponTypeMap: Record<string, WeaponType> = {
      WARRIOR: WeaponType.GREATSWORD,
      KNIGHT: WeaponType.SWORD_AND_SHIELD,
      MAGE: WeaponType.STAFF,
      ARCHER: WeaponType.BOW,
      THIEF: WeaponType.DAGGERS,
      PRAYER: WeaponType.HOLY_BOOK
    };

    const wpnType = weaponTypeMap[hero.jobKey] || WeaponType.GREATSWORD;

    const heroAvatar = hero.avatarIcon || (hero.isGuardian ? (hero.gender === Gender.FEMALE ? 'guardian_f_0' : 'guardian_m_1') : (hero.id.includes('reyn') ? 'heroes:reyn' : (hero.id.includes('luna') ? 'heroes:luna' : this.getJobEmoji(jobName))));

    this.playerTeam[slotIdx] = {
      id: `p_${hero.id}_${Date.now()}`,
      name: `${hero.title}${hero.name}`,
      level: hero.level,
      quality: hero.quality,
      jobName: jobName,
      isAdvanced: true,
      isUnique: !hero.isGuardian,
      avatarIcon: heroAvatar,
      weaponType: wpnType,
      weaponElement: hero.equipment.weaponElement || ElementType.NONE,
      weaponTier: 4,
      weaponEnhance: hero.equipment.weaponEnhance,
      weaponTemplateId: hero.equipment.weaponTemplateId,
      armorTier: 4,
      armorEnhance: hero.equipment.armorEnhance,
      armorTemplateId: hero.equipment.armorTemplateId,
      accessoryType: hero.equipment.accessoryId,
      accessoryId: hero.equipment.accessoryId,
      formationRow: slotIdx === 0 ? FormationRow.FRONT : FormationRow.FRONT,
      gender: hero.gender,
      isGuardian: hero.isGuardian,
      avatarIndex: hero.avatarIndex,
      allocatedStats: {
        str: hero.customAttributes.str,
        agi: hero.customAttributes.agi,
        con: hero.customAttributes.con,
        int: hero.customAttributes.int,
        spr: hero.customAttributes.spr,
        luk: hero.customAttributes.luk
      }
    };

    this.render();
  }

  // ── 英雄挑選器彈窗邏輯 ──
  private openHeroPicker(slotIdx: number): void {
    this.activePickingSlotIdx = slotIdx;
    const titleEl = byId('hero-picker-slot-title');
    if (titleEl) titleEl.textContent = `${slotIdx + 1} 號位`;
    const searchInput = byId<HTMLInputElement>('cs-picker-search');
    if (searchInput) searchInput.value = '';
    this.renderHeroPickerList('');
    const modal = byId('modal-hero-picker');
    if (modal) modal.style.display = 'flex';
  }

  private renderHeroPickerList(filterQuery: string = ''): void {
    const listEl = byId('cs-hero-picker-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const allHeroes = this.getAllHeroes();
    const q = filterQuery.toLowerCase();
    const filtered = allHeroes.filter(h => {
      if (!q) return true;
      return h.name.toLowerCase().includes(q) || h.title.toLowerCase().includes(q) || h.jobKey.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; color: var(--cs-text-muted); padding: 20px;">無符合條件的英雄</div>';
      return;
    }

    filtered.forEach(h => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: #131720; border: 1px solid var(--cs-panel-border); padding: 8px 12px; border-radius: 6px; gap: 10px;';
      
      const qColor = h.quality === 'UR' ? '#ef4444' : h.quality === 'SSR' ? '#f59e0b' : h.quality === 'SR' ? '#a855f7' : '#3b82f6';
      const attrSum = h.customAttributes.str + h.customAttributes.agi + h.customAttributes.con + h.customAttributes.int + h.customAttributes.spr + h.customAttributes.luk;
      const heroAvatar = h.avatarIcon || (h.isGuardian ? (h.gender === Gender.FEMALE ? 'guardian_f_0' : 'guardian_m_1') : (h.id.includes('reyn') ? 'heroes:reyn' : (h.id.includes('luna') ? 'heroes:luna' : this.getJobEmoji(this.mapJobKeyToName(h.jobKey, true)))));

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 44px; height: 44px; border-radius: 4px; background: #0f131a; border: 1.5px solid ${qColor}; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${renderUniversalIcon(heroAvatar, 36)}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: bold; color: ${qColor}; font-size: 0.85rem;">${h.title} ${h.name}</span>
              <span style="background: ${qColor}22; color: ${qColor}; border: 1px solid ${qColor}; padding: 0 4px; border-radius: 3px; font-size: 0.68rem; font-weight: bold;">${h.quality}</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--cs-text-muted); margin-top: 2px;">
              Lv.${h.level} ${this.mapJobKeyToName(h.jobKey, true)} · 總屬性: ${attrSum} · ⚔️ T4+${h.equipment.weaponEnhance}
            </div>
          </div>
        </div>
        <button class="cs-btn cs-btn-sm cs-btn-gold" data-pick-this-hero="${h.id}">選用此英雄</button>
      `;

      listEl.appendChild(item);
    });
  }

  private readonly GUARDIAN_AVATARS_MALE = [
    '滄桑老兵隊長 (1/10)',
    '銀髮雄獅騎士 (2/10)',
    '忠誠青年侍從 (3/10)',
    '金紋重甲將軍 (4/10)',
    '神秘兜帽遊俠 (5/10)',
    '狂怒戰斧勇士 (6/10)',
    '莊嚴黑袍神官 (7/10)',
    '堅毅歷戰傭兵 (8/10)',
    '森林長弓獵手 (9/10)',
    '全罩重裝步兵 (10/10)'
  ];

  private readonly GUARDIAN_AVATARS_FEMALE = [
    '金髮璀璨聖騎 (1/10)',
    '聖潔修道神官 (2/10)',
    '颯爽赤髮劍士 (3/10)',
    '短髮英姿女騎 (4/10)',
    '暗影兜帽俠女 (5/10)',
    '紫袍秘術法師 (6/10)',
    '宮廷貴族女爵 (7/10)',
    '夜行黑皮刺客 (8/10)',
    '雙辮長弓射手 (9/10)',
    '重裝板金女戰 (10/10)'
  ];

  // ── 英雄創造器彈窗邏輯 ──
  private openHeroCreator(heroDef?: UniqueHeroDef): void {
    const modal = byId('modal-hero-creator');
    if (!modal) return;

    const titleEl = byId('hero-creator-title');
    const editIdInput = byId<HTMLInputElement>('hc-edit-id');
    const titleInput = byId<HTMLInputElement>('hc-title');
    const nameInput = byId<HTMLInputElement>('hc-name');
    const qualitySelect = byId<HTMLSelectElement>('hc-quality');
    const genderSelect = byId<HTMLSelectElement>('hc-gender');
    const jobSelect = byId<HTMLSelectElement>('hc-job');
    const isAdvSelect = byId<HTMLSelectElement>('hc-is-advanced');
    const isGuardianSelect = byId<HTMLSelectElement>('hc-is-guardian');
    const avatarSelect = byId<HTMLSelectElement>('hc-avatar-select');
    const traitSelect = byId<HTMLSelectElement>('hc-trait');

    const strInput = byId<HTMLInputElement>('hc-str');
    const agiInput = byId<HTMLInputElement>('hc-agi');
    const conInput = byId<HTMLInputElement>('hc-con');
    const intInput = byId<HTMLInputElement>('hc-int');
    const sprInput = byId<HTMLInputElement>('hc-spr');
    const lukInput = byId<HTMLInputElement>('hc-luk');
    const totalStatsEl = byId('hc-total-stats');

    const wpnElementSelect = byId<HTMLSelectElement>('hc-weapon-element');
    const wpnEnhanceInput = byId<HTMLInputElement>('hc-weapon-enhance');
    const armEnhanceInput = byId<HTMLInputElement>('hc-armor-enhance');
    const bioTextarea = byId<HTMLTextAreaElement>('hc-biography');

    const avatarPreview = byId('hc-avatar-preview');
    const customIconInput = byId<HTMLInputElement>('hc-avatar-icon-custom');

    // 六維屬性總計即時連動
    const updateTotalStats = () => {
      const total = (Number(strInput?.value) || 0) + (Number(agiInput?.value) || 0) + (Number(conInput?.value) || 0) +
                    (Number(intInput?.value) || 0) + (Number(sprInput?.value) || 0) + (Number(lukInput?.value) || 0);
      if (totalStatsEl) totalStatsEl.textContent = String(total);
    };
    [strInput, agiInput, conInput, intInput, sprInput, lukInput].forEach(ipt => {
      if (ipt) ipt.oninput = updateTotalStats;
    });

    // 肖像選單動態更新器
    const updateAvatarSelectOptions = (selectedIdx: number = 0) => {
      if (!avatarSelect) return;
      avatarSelect.innerHTML = '';
      const isG = isGuardianSelect?.value === 'true';
      const isFem = genderSelect?.value === Gender.FEMALE;

      if (isG) {
        const list = isFem ? this.GUARDIAN_AVATARS_FEMALE : this.GUARDIAN_AVATARS_MALE;
        list.forEach((name, idx) => {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = name;
          if (idx === selectedIdx) opt.selected = true;
          avatarSelect.appendChild(opt);
        });
      } else {
        for (let i = 0; i < 25; i++) {
          const opt = document.createElement('option');
          opt.value = String(i);
          opt.textContent = `傭兵立繪 #${i + 1}`;
          if (i === selectedIdx) opt.selected = true;
          avatarSelect.appendChild(opt);
        }
      }
    };

    const applySelectedAvatar = () => {
      const isG = isGuardianSelect?.value === 'true';
      const isFem = genderSelect?.value === Gender.FEMALE;
      const idx = Number(avatarSelect?.value) || 0;
      let iconCode = '';

      if (isG) {
        iconCode = `guardian_${isFem ? 'f' : 'm'}_${idx}`;
      } else {
        iconCode = isFem ? `female_${idx}` : `male_${idx}`;
      }

      if (avatarPreview) {
        avatarPreview.innerHTML = renderUniversalIcon(iconCode, 44);
        avatarPreview.dataset.iconVal = iconCode;
      }
      if (customIconInput) customIconInput.value = iconCode;
    };

    if (isGuardianSelect) {
      isGuardianSelect.onchange = () => {
        updateAvatarSelectOptions(0);
        applySelectedAvatar();
      };
    }
    if (genderSelect) {
      genderSelect.onchange = () => {
        updateAvatarSelectOptions(0);
        applySelectedAvatar();
      };
    }
    if (avatarSelect) {
      avatarSelect.onchange = applySelectedAvatar;
    }

    if (avatarPreview) {
      avatarPreview.onclick = () => {
        this.openIconPicker(ic => {
          avatarPreview.innerHTML = renderUniversalIcon(ic, 44);
          avatarPreview.dataset.iconVal = ic;
          if (customIconInput) customIconInput.value = ic;
        });
      };
    }
    if (customIconInput) {
      customIconInput.oninput = () => {
        const val = customIconInput.value.trim();
        if (val && avatarPreview) {
          avatarPreview.innerHTML = renderUniversalIcon(val, 44);
          avatarPreview.dataset.iconVal = val;
        }
      };
    }

    if (heroDef) {
      if (titleEl) titleEl.textContent = `✏️ 編輯英雄【${heroDef.name}】`;
      if (editIdInput) editIdInput.value = heroDef.id;
      if (titleInput) titleInput.value = heroDef.title;
      if (nameInput) nameInput.value = heroDef.name;
      if (qualitySelect) qualitySelect.value = heroDef.quality;
      if (genderSelect) genderSelect.value = heroDef.gender;
      if (jobSelect) jobSelect.value = heroDef.jobKey;
      if (isAdvSelect) isAdvSelect.value = 'true';
      if (isGuardianSelect) isGuardianSelect.value = String(heroDef.isGuardian);
      if (traitSelect) traitSelect.value = heroDef.traitKey || (heroDef.isGuardian ? 'GUARDIAN_LOYAL' : 'BRAVE');

      updateAvatarSelectOptions(heroDef.avatarIndex || 0);

      const curIcon = heroDef.avatarIcon || (heroDef.isGuardian ? (heroDef.gender === Gender.FEMALE ? 'guardian_f_0' : 'guardian_m_1') : (heroDef.id.includes('reyn') ? 'heroes:reyn' : (heroDef.id.includes('luna') ? 'heroes:luna' : 'heroes:reyn')));
      if (avatarPreview) {
        avatarPreview.innerHTML = renderUniversalIcon(curIcon, 44);
        avatarPreview.dataset.iconVal = curIcon;
      }
      if (customIconInput) customIconInput.value = heroDef.avatarIcon || curIcon;

      if (strInput) strInput.value = String(heroDef.customAttributes.str);
      if (agiInput) agiInput.value = String(heroDef.customAttributes.agi);
      if (conInput) conInput.value = String(heroDef.customAttributes.con);
      if (intInput) intInput.value = String(heroDef.customAttributes.int);
      if (sprInput) sprInput.value = String(heroDef.customAttributes.spr);
      if (lukInput) lukInput.value = String(heroDef.customAttributes.luk);

      if (wpnElementSelect) wpnElementSelect.value = heroDef.equipment.weaponElement || 'NONE';
      if (wpnEnhanceInput) wpnEnhanceInput.value = String(heroDef.equipment.weaponEnhance);
      if (armEnhanceInput) armEnhanceInput.value = String(heroDef.equipment.armorEnhance);
      if (bioTextarea) bioTextarea.value = heroDef.biography;
    } else {
      if (titleEl) titleEl.textContent = '👑 創造全新自訂英雄';
      if (editIdInput) editIdInput.value = `custom_hero_${Date.now()}`;
      if (titleInput) titleInput.value = '【傳奇勇士】';
      if (nameInput) nameInput.value = '';
      if (qualitySelect) qualitySelect.value = 'SSR';
      if (genderSelect) genderSelect.value = Gender.MALE;
      if (jobSelect) jobSelect.value = 'WARRIOR';
      if (isAdvSelect) isAdvSelect.value = 'true';
      if (isGuardianSelect) isGuardianSelect.value = 'false';
      if (traitSelect) traitSelect.value = 'BRAVE';

      updateAvatarSelectOptions(0);

      const curIcon = 'heroes:reyn';
      if (avatarPreview) {
        avatarPreview.innerHTML = renderUniversalIcon(curIcon, 44);
        avatarPreview.dataset.iconVal = curIcon;
      }
      if (customIconInput) customIconInput.value = '';

      if (strInput) strInput.value = '25';
      if (agiInput) agiInput.value = '15';
      if (conInput) conInput.value = '20';
      if (intInput) intInput.value = '5';
      if (sprInput) sprInput.value = '10';
      if (lukInput) lukInput.value = '5';

      if (wpnElementSelect) wpnElementSelect.value = 'NONE';
      if (wpnEnhanceInput) wpnEnhanceInput.value = '7';
      if (armEnhanceInput) armEnhanceInput.value = '7';
      if (bioTextarea) bioTextarea.value = '';
    }

    updateTotalStats();
    modal.style.display = 'flex';
  }

  private saveHeroCreator(): void {
    const editIdInput = byId<HTMLInputElement>('hc-edit-id');
    const titleInput = byId<HTMLInputElement>('hc-title');
    const nameInput = byId<HTMLInputElement>('hc-name');
    const qualitySelect = byId<HTMLSelectElement>('hc-quality');
    const genderSelect = byId<HTMLSelectElement>('hc-gender');
    const jobSelect = byId<HTMLSelectElement>('hc-job');
    const isGuardianSelect = byId<HTMLSelectElement>('hc-is-guardian');
    const avatarSelect = byId<HTMLSelectElement>('hc-avatar-select');
    const traitSelect = byId<HTMLSelectElement>('hc-trait');
    const customIconInput = byId<HTMLInputElement>('hc-avatar-icon-custom');
    const avatarPreview = byId('hc-avatar-preview');

    const strInput = byId<HTMLInputElement>('hc-str');
    const agiInput = byId<HTMLInputElement>('hc-agi');
    const conInput = byId<HTMLInputElement>('hc-con');
    const intInput = byId<HTMLInputElement>('hc-int');
    const sprInput = byId<HTMLInputElement>('hc-spr');
    const lukInput = byId<HTMLInputElement>('hc-luk');

    const wpnElementSelect = byId<HTMLSelectElement>('hc-weapon-element');
    const wpnEnhanceInput = byId<HTMLInputElement>('hc-weapon-enhance');
    const armEnhanceInput = byId<HTMLInputElement>('hc-armor-enhance');
    const bioTextarea = byId<HTMLTextAreaElement>('hc-biography');

    const id = editIdInput ? editIdInput.value.trim() : `custom_hero_${Date.now()}`;
    const name = nameInput ? nameInput.value.trim() : '';
    const title = titleInput ? titleInput.value.trim() : '';
    const avatarIcon = customIconInput?.value.trim() || avatarPreview?.dataset?.iconVal || undefined;

    if (!name) {
      alert('請填寫英雄名稱！');
      return;
    }

    const jobKey = jobSelect ? jobSelect.value : 'WARRIOR';
    const isGuardian = isGuardianSelect?.value === 'true';
    const weaponMap: Record<string, string> = {
      WARRIOR: 'wpn_meteoric_greatsword',
      KNIGHT: isGuardian ? 'wpn_royal_paladin_sword' : 'wpn_royal_paladin_sword',
      MAGE: 'wpn_archmage_staff',
      ARCHER: 'wpn_composite_bow',
      THIEF: 'wpn_daggers_t4',
      PRAYER: 'wpn_holybook_t4'
    };

    const heroDef: UniqueHeroDef = {
      id,
      name,
      title,
      quality: (qualitySelect?.value as any) || 'SSR',
      jobKey,
      traitKey: traitSelect?.value || (isGuardian ? 'GUARDIAN_LOYAL' : 'BRAVE'),
      gender: (genderSelect?.value as any) || Gender.MALE,
      isGuardian,
      avatarIndex: Number(avatarSelect?.value) || 0,
      avatarIcon,
      level: 10,
      biography: bioTextarea?.value || '',
      customAttributes: {
        str: Number(strInput?.value) || 10,
        agi: Number(agiInput?.value) || 10,
        con: Number(conInput?.value) || 10,
        int: Number(intInput?.value) || 10,
        spr: Number(sprInput?.value) || 10,
        luk: Number(lukInput?.value) || 10,
        charm: isGuardian ? 15 : 10,
        command: isGuardian ? 15 : 10
      },
      equipment: {
        weaponTemplateId: weaponMap[jobKey] || 'wpn_meteoric_greatsword',
        weaponEnhance: Number(wpnEnhanceInput?.value) || 7,
        weaponElement: (wpnElementSelect?.value as any) || ElementType.NONE,
        armorTemplateId: 'arm_heavy_t4',
        armorEnhance: Number(armEnhanceInput?.value) || 7,
        accessoryId: isGuardian ? 'acc_guardian_shield' : 'acc_berserk_badge'
      }
    };

    // 存入自訂英雄庫
    const existingIdx = this.customHeroesDb.findIndex(item => item.id === id);
    if (existingIdx >= 0) {
      this.customHeroesDb[existingIdx] = heroDef;
    } else {
      this.customHeroesDb.push(heroDef);
    }

    this.saveCustomHeroesToStorage();
    byId('modal-hero-creator').style.display = 'none';
    this.renderHeroDatabase();
    alert(`🎉 已成功儲存英雄【${title} ${name}】！`);
  }

  private renderWaveTabs(): void {
    const container = byId('cs-wave-tabs-container');
    if (!container) return;
    container.innerHTML = '';

    this.enemyWaves.forEach((w, idx) => {
      const btn = document.createElement('button');
      btn.className = `cs-tab-btn cs-wave-btn ${idx === this.currentWaveIdx ? 'active' : ''}`;
      btn.style.cssText = 'padding: 2px 8px; font-size: 0.72rem;';
      const isBossWave = idx === this.enemyWaves.length - 1 && this.enemyWaves.length > 1;
      btn.textContent = `${isBossWave ? '👑' : '🚩'} 第 ${idx + 1} 波 (${w.length}隻)`;
      btn.onclick = () => {
        this.currentWaveIdx = idx;
        this.render();
      };
      container.appendChild(btn);
    });
  }

  private renderPlayerList(): void {
    const list = byId('cs-player-list');
    list.innerHTML = '';
    byId('cs-player-count').textContent = String(this.playerTeam.length);

    this.playerTeam.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'cs-unit-card';
      const elemBadge = p.weaponElement !== ElementType.NONE ? `<span style="color: var(--cs-gold); font-size: 0.72rem;">[${p.weaponElement}]</span>` : '';
      const accText = p.accessoryType && p.accessoryType !== 'NONE' ? `💍 ${this.getAccessoryShortName(p.accessoryType)}` : '💍 (無飾品)';
      
      const maxStatPoints = (p.level - 1) * 5;
      const curAllocated = Object.values(p.allocatedStats).reduce((a, b) => a + b, 0);
      const unspent = Math.max(0, maxStatPoints - curAllocated);

      // 計算真實資質 + 加點後的戰鬥數值
      const baseAttr = this.getJobBaseAttributes(p.jobName, p.quality);
      const totalStr = baseAttr.str + (p.level - 1) * 2 + p.allocatedStats.str;
      const totalAgi = baseAttr.agi + (p.level - 1) * 2 + p.allocatedStats.agi;
      const totalCon = baseAttr.con + (p.level - 1) * 2 + p.allocatedStats.con;
      const totalInt = baseAttr.int + (p.level - 1) * 2 + p.allocatedStats.int;
      const totalSpr = baseAttr.spr + (p.level - 1) * 2 + p.allocatedStats.spr;
      const totalLuk = baseAttr.luk + (p.level - 1) * 2 + p.allocatedStats.luk;

      const hp = totalCon * 10 + p.armorTier * 30 + p.armorEnhance * 5 + (p.accessoryType === 'RING_HP' ? 60 : 0);
      const mp = totalSpr * 5 + (p.accessoryType === 'RING_MP' ? 30 : 0);
      const patk = totalStr * 2 + p.weaponTier * 15 + p.weaponEnhance * 4;
      const matk = totalInt * 2 + p.weaponTier * 15 + p.weaponEnhance * 4;
      const pdef = totalCon + Math.floor(totalStr * 0.5) + p.armorTier * 10 + p.armorEnhance * 3;
      const mdef = totalCon + Math.floor(totalSpr * 0.5) + p.armorTier * 10 + p.armorEnhance * 3;
      const hit = totalAgi * 2 + totalLuk + (p.accessoryType === 'AMULET_AGI' ? 15 : 0);
      const evade = totalAgi + totalLuk + (p.accessoryType === 'AMULET_AGI' ? 15 : 0);
      const crit = Math.min(100, 5 + Math.floor(hit / 5) + (p.accessoryType === 'BADGE_CRIT' ? 10 : 0));
      const powerScore = Math.max(patk, matk) + Math.floor((pdef + mdef) * 0.3) + Math.floor(hp * 0.2);

      const isUniqueHero = p.isUnique && !p.isGuardian;

      const qualityHtml = isUniqueHero
        ? `<span class="cs-badge" style="padding: 1px 6px; font-size: 0.72rem; font-weight: bold; color: ${p.quality === 'UR' ? '#ff4d4f' : '#f59e0b'}; border: 1px solid ${p.quality === 'UR' ? '#ff4d4f' : '#f59e0b'}; background: ${p.quality === 'UR' ? 'rgba(255,77,79,0.15)' : 'rgba(245,158,11,0.15)'};">👑 ${p.quality}</span>`
        : `
          <select class="cs-select" data-p-idx="${idx}" data-field="quality" style="padding: 0px 4px; font-size: 0.72rem; font-weight: bold; color: ${p.quality === 'UR' ? '#ff4d4f' : 'var(--cs-gold)'};">
            <option value="N" ${p.quality === 'N' ? 'selected' : ''}>N</option>
            <option value="R" ${p.quality === 'R' ? 'selected' : ''}>R</option>
            <option value="SR" ${p.quality === 'SR' ? 'selected' : ''}>SR</option>
            <option value="SSR" ${p.quality === 'SSR' ? 'selected' : ''}>SSR</option>
            <option value="UR" ${p.quality === 'UR' ? 'selected' : ''}>👑 UR (神話)</option>
          </select>
        `;

      const jobHtml = isUniqueHero
        ? `<span style="font-weight: bold; color: var(--cs-gold); font-size: 0.78rem;">${p.jobName}</span>`
        : `
          <select class="cs-select" data-p-idx="${idx}" data-field="jobChange" style="padding: 1px 2px; font-size: 0.72rem; max-width: 95px;">
            <optgroup label="基礎職業">
              <option value="戰士" ${p.jobName === '戰士' ? 'selected' : ''}>戰士</option>
              <option value="法師" ${p.jobName === '法師' ? 'selected' : ''}>法師</option>
              <option value="弓箭手" ${p.jobName === '弓箭手' ? 'selected' : ''}>弓箭手</option>
              <option value="騎士" ${p.jobName === '騎士' ? 'selected' : ''}>騎士</option>
              <option value="盜賊" ${p.jobName === '盜賊' ? 'selected' : ''}>盜賊</option>
              <option value="祈禱者" ${p.jobName === '祈禱者' ? 'selected' : ''}>祈禱者</option>
            </optgroup>
            <optgroup label="🌟 進階職業">
              <option value="狂戰士" ${p.jobName === '狂戰士' ? 'selected' : ''}>狂戰士</option>
              <option value="魔劍士" ${p.jobName === '魔劍士' ? 'selected' : ''}>魔劍士</option>
              <option value="大魔導士" ${p.jobName === '大魔導士' ? 'selected' : ''}>大魔導士</option>
              <option value="死靈法師" ${p.jobName === '死靈法師' ? 'selected' : ''}>死靈法師</option>
              <option value="神射手" ${p.jobName === '神射手' ? 'selected' : ''}>神射手</option>
              <option value="精靈使" ${p.jobName === '精靈使' ? 'selected' : ''}>精靈使</option>
              <option value="聖騎士" ${p.jobName === '聖騎士' ? 'selected' : ''}>聖騎士</option>
              <option value="符文騎士" ${p.jobName === '符文騎士' ? 'selected' : ''}>符文騎士</option>
              <option value="暗殺者" ${p.jobName === '暗殺者' ? 'selected' : ''}>暗殺者</option>
              <option value="詭術師" ${p.jobName === '詭術師' ? 'selected' : ''}>詭術師</option>
              <option value="大主教" ${p.jobName === '大主教' ? 'selected' : ''}>大主教</option>
              <option value="異端拷問官" ${p.jobName === '異端拷問官' ? 'selected' : ''}>異端拷問官</option>
            </optgroup>
          </select>
        `;

      const wTpl = p.weaponTemplateId ? DataStore.EquipmentDB[p.weaponTemplateId] : null;
      const aTpl = p.armorTemplateId ? DataStore.EquipmentDB[p.armorTemplateId] : null;
      const accTpl = p.accessoryId ? DataStore.EquipmentDB[p.accessoryId] : (p.accessoryType && p.accessoryType !== 'NONE' ? DataStore.EquipmentDB[p.accessoryType] : null);

      const wName = wTpl ? wTpl.name : `T${p.weaponTier} ${p.weaponType}`;
      const aName = aTpl ? aTpl.name : `T${p.armorTier} 防具`;
      const accName = accTpl ? accTpl.name : (p.accessoryType && p.accessoryType !== 'NONE' ? this.getAccessoryShortName(p.accessoryType) : '無飾品');

      const wTooltip = wTpl ? `${wTpl.name} (+${p.weaponEnhance}) - 攻+${(wTpl.baseCombatEffects?.atk || p.weaponTier * 15)} ${(wTpl as any).description || (wTpl as any).flavorLore || ''}` : `T${p.weaponTier}+${p.weaponEnhance} ${p.weaponType}`;
      const aTooltip = aTpl ? `${aTpl.name} (+${p.armorEnhance}) - 防+${(aTpl.baseCombatEffects?.def || p.armorTier * 10)} ${(aTpl as any).description || (aTpl as any).flavorLore || ''}` : `T${p.armorTier}+${p.armorEnhance} 防具`;
      const accTooltip = accTpl ? `${accTpl.name} - ${(accTpl as any).description || (accTpl as any).flavorLore || JSON.stringify(accTpl.baseCombatEffects || {})}` : accName;

      card.innerHTML = `
        <div class="cs-unit-header">
          <div class="cs-unit-avatar" title="點擊更換冒險者頭像" data-change-p-avatar="${idx}" style="cursor: pointer;">${renderUniversalIcon(p.avatarIcon || this.getJobEmoji(p.jobName), 36)}</div>
          <div class="cs-unit-info">
            <div class="cs-unit-name">
              <input type="text" class="cs-input" value="${p.name}" style="padding: 1px 4px; font-size: 0.8rem; width: 85px;" data-p-idx="${idx}" data-field="name">
              ${qualityHtml}
            </div>
            <div class="cs-unit-sub">
              <span>Lv.${p.level}</span>
              ${jobHtml}
              <span>(${p.formationRow === FormationRow.FRONT ? '前排' : p.formationRow === 'MIDDLE' ? '中排' : '後排'})</span>
            </div>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="cs-btn cs-btn-gold cs-btn-sm" style="padding: 2px 6px; font-size: 0.72rem;" data-pick-hero="${idx}" title="從英雄庫選擇套用">👤 選英雄</button>
            <button class="cs-btn cs-btn-danger cs-btn-sm" style="padding: 2px 6px;" data-remove-p="${idx}">✕</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; font-size: 0.75rem; margin-top: 4px;">
          <div>
            <label class="cs-label">等級 (1~10)</label>
            <input type="number" class="cs-input" min="1" max="10" value="${p.level}" data-p-idx="${idx}" data-field="level" style="width: 100%; padding: 2px 4px;">
          </div>
          <div>
            <label class="cs-label">站位</label>
            <select class="cs-select" data-p-idx="${idx}" data-field="formationRow" style="width: 100%; padding: 2px 2px;">
              <option value="${FormationRow.FRONT}" ${p.formationRow === FormationRow.FRONT ? 'selected' : ''}>前排</option>
              <option value="MIDDLE" ${p.formationRow === 'MIDDLE' ? 'selected' : ''}>中排</option>
              <option value="${FormationRow.BACK}" ${p.formationRow === FormationRow.BACK ? 'selected' : ''}>後排</option>
            </select>
          </div>
          <div>
            <label class="cs-label">戰鬥力評分</label>
            <div style="font-weight: bold; color: var(--cs-orange); font-size: 0.8rem; line-height: 24px;">⚔️ ${powerScore}</div>
          </div>
        </div>

        <!-- 3 槽位裝備欄 (全品項名稱 + Tooltip) -->
        <div class="cs-equip-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-top: 4px;">
          <div class="cs-equip-slot has-item" title="${wTooltip}" data-open-equip="${idx}">
            <span style="font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">⚔️ ${wName}+${p.weaponEnhance} ${elemBadge}</span>
          </div>
          <div class="cs-equip-slot has-item" title="${aTooltip}" data-open-equip="${idx}">
            <span style="font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🛡️ ${aName}+${p.armorEnhance}</span>
          </div>
          <div class="cs-equip-slot has-item" title="${accTooltip}" data-open-equip="${idx}">
            <span style="font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">💍 ${accName}</span>
          </div>
        </div>

        <!-- 📊 即時戰鬥與六維自由配點面板 -->
        <div style="margin-top: 6px; padding: 6px; background: #0c1017; border: 1px solid var(--cs-panel-border); border-radius: 4px; font-size: 0.72rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: bold; color: var(--cs-gold-light);">📊 六維屬性 & 配點 (剩餘: <b style="color: var(--cs-orange);">${unspent}</b> 點)</span>
            <div style="display: flex; gap: 4px;">
              <button class="cs-btn cs-btn-sm" style="padding: 0px 4px; font-size: 0.68rem;" data-auto-alloc="${idx}">⚡推薦</button>
              <button class="cs-btn cs-btn-sm" style="padding: 0px 4px; font-size: 0.68rem;" data-reset-alloc="${idx}">↺重置</button>
            </div>
          </div>

          <!-- 六維加點列 -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; color: var(--cs-text-main); margin-bottom: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; background: #13171e; padding: 2px 4px; border-radius: 3px;">
              <span>力 ${totalStr}</span>
              <span>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},str,-1">－</button>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},str,1">＋</button>
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: #13171e; padding: 2px 4px; border-radius: 3px;">
              <span>敏 ${totalAgi}</span>
              <span>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},agi,-1">－</button>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},agi,1">＋</button>
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: #13171e; padding: 2px 4px; border-radius: 3px;">
              <span>體 ${totalCon}</span>
              <span>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},con,-1">－</button>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},con,1">＋</button>
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: #13171e; padding: 2px 4px; border-radius: 3px;">
              <span>智 ${totalInt}</span>
              <span>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},int,-1">－</button>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},int,1">＋</button>
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: #13171e; padding: 2px 4px; border-radius: 3px;">
              <span>精 ${totalSpr}</span>
              <span>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},spr,-1">－</button>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},spr,1">＋</button>
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: #13171e; padding: 2px 4px; border-radius: 3px;">
              <span>幸 ${totalLuk}</span>
              <span>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},luk,-1">－</button>
                <button class="cs-btn cs-btn-sm" style="padding: 0px 3px; font-size: 0.65rem;" data-stat-mod="${idx},luk,1">＋</button>
              </span>
            </div>
          </div>

          <!-- 實戰衍生數值 -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; color: var(--cs-text-muted); font-size: 0.68rem; text-align: center; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 3px;">
            <div>❤️ HP <b>${hp}</b></div>
            <div>💧 MP <b>${mp}</b></div>
            <div>⚔️ 物攻 <b>${patk}</b></div>
            <div>🔮 魔攻 <b>${matk}</b></div>
            <div>🛡️ 物防 <b>${pdef}</b></div>
            <div>✨ 魔防 <b>${mdef}</b></div>
            <div>🎯 命中 <b>${hit}</b></div>
            <div>💥 暴擊 <b>${crit}%</b></div>
          </div>
        </div>
      `;

      list.appendChild(card);
    });

    if (this.playerTeam.length < 5) {
      const addBtn = document.createElement('button');
      addBtn.className = 'cs-btn';
      addBtn.style.width = '100%';
      addBtn.style.justifyContent = 'center';
      addBtn.textContent = '＋ 新增冒險者';
      addBtn.onclick = () => {
        this.playerTeam.push({
          id: `p_${Date.now()}`,
          name: `傭兵 ${this.playerTeam.length + 1}`,
          level: 5,
          quality: 'R',
          jobName: '戰士',
          isAdvanced: false,
          weaponType: WeaponType.GREATSWORD,
          weaponElement: ElementType.NONE,
          weaponTier: 2,
          weaponEnhance: 2,
          armorTier: 2,
          armorEnhance: 2,
          accessoryType: 'RING_HP',
          formationRow: FormationRow.FRONT,
          allocatedStats: { str: 10, agi: 2, con: 8, int: 0, spr: 0, luk: 0 }
        });
        this.render();
      };
      list.appendChild(addBtn);
    }
  }

  private renderEnemyList(): void {
    const list = byId('cs-enemy-list');
    list.innerHTML = '';
    const currentWave = this.enemyWaves[this.currentWaveIdx] || [];
    byId('cs-enemy-count').textContent = String(currentWave.length);

    currentWave.forEach((e, idx) => {
      const card = document.createElement('div');
      card.className = 'cs-unit-card';
      const elemText = e.element !== ElementType.NONE ? `[${e.element}]` : '';
      const avatar = e.avatarIcon || this.getMonsterAvatar(e.monsterId, e.name);

      const baseMonster = this.monstersDb.find(m => m.id === e.monsterId) || this.monstersDb[0] || (monstersJson[0] as any);
      const appliedRace = e.isUndead ? MonsterRace.UNDEAD : (baseMonster.race || MonsterRace.MONSTER);
      const curProfile = (e.profile || baseMonster.profile || MonsterProfile.BALANCED) as MonsterProfile;
      const curSkills = (e.skills || baseMonster.skills || []);

      const monsterDef = {
        ...baseMonster,
        profile: curProfile,
        skills: curSkills
      };
      const inst = this.monsterSystem.createMonsterInstance(monsterDef, appliedRace, e.element, e.difficulty);

      const profileNameMap: Record<string, string> = {
        BALANCED: '⚖️ 常規均衡',
        TANK: '🛡️ 鐵壁肉盾',
        ASSASSIN: '⚡ 疾風刺客',
        MAGE: '🔮 奧術法師',
        BERSERKER: '🩸 嗜血狂戰',
        RANGER: '🏹 遠程狙擊',
        JUGGERNAUT: '💀 亡靈泥沼',
        BOSS: '👑 史詩首領'
      };

      const profileOptions = Object.entries(profileNameMap).map(([k, label]) =>
        `<option value="${k}" ${k === curProfile ? 'selected' : ''}>${label}</option>`
      ).join('');

      card.innerHTML = `
        <div class="cs-unit-header">
          <div class="cs-unit-avatar" title="點擊直接挑選此怪物頭像" data-change-e-avatar="${idx}" style="cursor: pointer;">${renderUniversalIcon(avatar, 36)}</div>
          <div class="cs-unit-info">
            <div class="cs-unit-name">
              <span>${e.affix || ''}${e.name}</span>
              <span class="cs-badge" style="color: var(--cs-red);">Lv.${e.difficulty}</span>
            </div>
            <div class="cs-unit-sub">
              <span>${elemText}</span>
              <span>${e.isUndead ? '💀不死' : '生靈'}</span>
              <span>(${e.formationRow === FormationRow.FRONT ? '前排' : '後排'})</span>
            </div>
          </div>
          <button class="cs-btn cs-btn-danger cs-btn-sm" style="padding: 2px 6px;" data-remove-e="${idx}">✕</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 0.75rem; margin-top: 4px;">
          <div>
            <label class="cs-label">切換原型</label>
            <select class="cs-select" data-e-idx="${idx}" data-field="monsterId" style="width: 100%; padding: 2px 4px;">
              ${this.monstersDb.map(m => `<option value="${m.id}" ${m.id === e.monsterId ? 'selected' : ''}>${m.name} (${m.race})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="cs-label">戰鬥定位</label>
            <select class="cs-select" data-e-idx="${idx}" data-field="profile" style="width: 100%; padding: 2px 4px;">
              ${profileOptions}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 0.75rem; margin-top: 4px;">
          <div>
            <label class="cs-label">元素屬性</label>
            <select class="cs-select" data-e-idx="${idx}" data-field="element" style="width: 100%; padding: 2px 4px;">
              <option value="NONE" ${e.element === ElementType.NONE ? 'selected' : ''}>無屬性</option>
              <option value="FIRE" ${e.element === ElementType.FIRE ? 'selected' : ''}>🔥火</option>
              <option value="ICE" ${e.element === ElementType.ICE ? 'selected' : ''}>❄️冰</option>
              <option value="LIGHTNING" ${e.element === ElementType.LIGHTNING ? 'selected' : ''}>⚡雷</option>
              <option value="HOLY" ${e.element === ElementType.HOLY ? 'selected' : ''}>☀️光</option>
              <option value="DARK" ${e.element === ElementType.DARK ? 'selected' : ''}>🌑暗</option>
            </select>
          </div>
          <div>
            <label class="cs-label">站位</label>
            <select class="cs-select" data-e-idx="${idx}" data-field="formationRow" style="width: 100%; padding: 2px 4px;">
              <option value="${FormationRow.FRONT}" ${e.formationRow === FormationRow.FRONT ? 'selected' : ''}>前排</option>
              <option value="${FormationRow.BACK}" ${e.formationRow === FormationRow.BACK ? 'selected' : ''}>後排</option>
            </select>
          </div>
        </div>

        <!-- 技能欄位標籤與配置按鈕 -->
        <div style="margin-top: 4px; padding: 3px 6px; background: #0e131b; border: 1px solid var(--cs-panel-border); border-radius: 4px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
          <span class="cs-label" style="margin-bottom: 0; font-size: 0.68rem;">技能:</span>
          ${curSkills.length > 0 ? curSkills.map(skId => {
            const sk = SkillRegistry.getSkill(skId);
            return `<span class="cs-badge" style="background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); font-size: 0.65rem;" title="${sk?.description || ''}">✨ ${sk?.name || skId}</span>`;
          }).join('') : '<span style="font-size: 0.68rem; color: var(--cs-text-muted);">無特技 (普攻)</span>'}
          <button class="cs-btn cs-btn-sm cs-btn-gold" style="padding: 1px 6px; font-size: 0.65rem; margin-left: auto;" data-edit-e-skills="${idx}" title="點擊自訂與挑選此怪物的特技">⚙️ 配置</button>
        </div>

        <!-- 👾 怪物真實數值面板 -->
        <div style="margin-top: 6px; padding: 4px 6px; background: #0c1017; border: 1px solid var(--cs-panel-border); border-radius: 4px; font-size: 0.68rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; text-align: center;">
          <div>❤️ HP <b>${inst.hp}</b></div>
          <div>⚔️ 攻擊 <b>${inst.damage}</b></div>
          <div>🛡️ 物防 <b>${inst.pdef || inst.defense}</b></div>
          <div>✨ 魔防 <b>${inst.mdef || inst.defense}</b></div>
          <div>⚡ 速度 <b>${inst.speed}</b></div>
          <div>💨 閃避 <b>${inst.evade}</b></div>
          <div style="grid-column: span 2; color: var(--cs-orange); font-weight: bold;">🏆 戰力評分 <b>${inst.calculatedPowerScore || (inst.hp + inst.damage * 3)}</b></div>
        </div>
      `;

      list.appendChild(card);
    });

    if (currentWave.length < 5) {
      const addBtn = document.createElement('button');
      addBtn.className = 'cs-btn';
      addBtn.style.width = '100%';
      addBtn.style.justifyContent = 'center';
      addBtn.textContent = `＋ 新增第 ${this.currentWaveIdx + 1} 波敵方單位`;
      addBtn.onclick = () => {
        const diff = Number(byId<HTMLInputElement>('cs-enemy-diff-slider')?.value || 2);
        currentWave.push({
          monsterId: 'goblin',
          name: '哥布林',
          difficulty: diff,
          element: ElementType.NONE,
          isUndead: false,
          avatarIcon: this.getMonsterAvatar('goblin', '哥布林'),
          formationRow: FormationRow.FRONT
        });
        this.render();
      };
      list.appendChild(addBtn);
    }
  }

  private renderArenaInitial(): void {
    const leftContainer = byId('cs-arena-left');
    if (!leftContainer) return;
    leftContainer.innerHTML = '';
    this.arenaHpMp = {};

    this.playerTeam.forEach(p => {
      const id = `arena_${p.id}`;
      const baseAttr = this.getJobBaseAttributes(p.jobName, p.quality);
      const totalCon = baseAttr.con + (p.level - 1) * 2 + p.allocatedStats.con;
      const maxHp = totalCon * 10 + p.armorTier * 30 + (p.accessoryType === 'RING_HP' ? 60 : 0);
      const totalSpr = baseAttr.spr + (p.level - 1) * 2 + p.allocatedStats.spr;
      const maxMp = totalSpr * 5 + (p.accessoryType === 'RING_MP' ? 30 : 0);
      const avatar = p.avatarIcon || this.getJobEmoji(p.jobName);
      this.arenaHpMp[p.id] = { hp: maxHp, maxHp, mp: maxMp, maxMp, name: p.name, avatar };

      const card = document.createElement('div');
      card.className = 'cs-arena-card player-side';
      card.id = id;
      card.innerHTML = `
        <div style="margin-right: 6px; display: flex; align-items: center;">${renderUniversalIcon(avatar, 26)}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <span style="font-size: 0.76rem; font-weight: bold; color: var(--cs-gold-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;">${p.name}</span>
            <span style="font-size: 0.66rem; color: #a1a1aa; font-family: monospace;" id="hp_txt_${p.id}">${maxHp}/${maxHp}</span>
          </div>
          <div class="cs-bars">
            <div class="cs-bar-wrap"><div class="cs-hp-fill" id="hp_${p.id}" style="width: 100%;"></div></div>
            <div class="cs-bar-wrap"><div class="cs-mp-fill" id="mp_${p.id}" style="width: 100%;"></div></div>
          </div>
        </div>
      `;
      leftContainer.appendChild(card);
    });

    this.renderArenaWave(1);
    byId('cs-arena-round').textContent = 'Wave 1';
  }

  private renderArenaWave(waveNum: number): void {
    const rightContainer = byId('cs-arena-right');
    if (!rightContainer) return;
    rightContainer.innerHTML = '';

    const activeWave = this.enemyWaves[waveNum - 1] || this.enemyWaves[0] || [];
    activeWave.forEach((e, idx) => {
      const eid = `enemy_${waveNum}_${idx}`;
      const baseMonster = this.monstersDb.find(m => m.id === e.monsterId) || this.monstersDb[0] || (monstersJson[0] as any);
      const appliedRace = e.isUndead ? MonsterRace.UNDEAD : (baseMonster.race || MonsterRace.MONSTER);
      const inst = this.monsterSystem.createMonsterInstance(baseMonster, appliedRace, e.element, e.difficulty);
      const maxHp = inst.hp;
      const maxMp = 50;
      const avatar = e.avatarIcon || this.getMonsterAvatar(e.monsterId, e.name);
      this.arenaHpMp[eid] = { hp: maxHp, maxHp, mp: maxMp, maxMp, name: e.name, avatar };

      const card = document.createElement('div');
      card.className = 'cs-arena-card enemy-side';
      card.id = `arena_${eid}`;
      card.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <span style="font-size: 0.66rem; color: #a1a1aa; font-family: monospace;" id="hp_txt_${eid}">${maxHp}/${maxHp}</span>
            <span style="font-size: 0.76rem; font-weight: bold; color: #fca5a5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; text-align: right;">${e.name}</span>
          </div>
          <div class="cs-bars">
            <div class="cs-bar-wrap"><div class="cs-hp-fill" id="hp_${eid}" style="width: 100%;"></div></div>
            <div class="cs-bar-wrap"><div class="cs-mp-fill" id="mp_${eid}" style="width: 100%;"></div></div>
          </div>
        </div>
        <div style="margin-left: 6px; display: flex; align-items: center;">${renderUniversalIcon(avatar, 26)}</div>
      `;
      rightContainer.appendChild(card);
    });
  }

  // ── 戰鬥模擬核心 ──
  private runSingleBattle(): void {
    this.stopPlayback();
    const adventurers = this.buildAdventurers();
    const monsterWaves = this.buildMonstersForWaves();

    GameState.adventurers = adventurers;
    const attackerIds = adventurers.map(a => a.id);

    const report = CombatSystem.simulateCombat(
      attackerIds,
      1,
      '',
      TerrainType.PLAINS,
      monsterWaves.length,
      undefined,
      monsterWaves[0],
      undefined,
      undefined,
      undefined,
      monsterWaves
    );

    this.currentReport = report;
    this.currentEventIndex = 0;
    this.renderArenaInitial();

    const logBox = byId('cs-combat-log');
    logBox.innerHTML = '';
    const startMsg = document.createElement('div');
    startMsg.className = 'cs-log-entry';
    startMsg.textContent = `⚔️ 多波次戰鬥開始！共 ${monsterWaves.length} 波敵軍！我方 [${adventurers.map(a=>a.name).join(', ')}]`;
    logBox.appendChild(startMsg);

    this.isPlaying = true;
    byId('btn-play-pause').textContent = '⏸ 暫停';
    this.stepPlayback();
  }

  private stepPlayback(): void {
    if (!this.isPlaying || !this.currentReport) return;

    if (this.currentEventIndex >= this.currentReport.events.length) {
      this.finishPlayback();
      return;
    }

    const ev = this.currentReport.events[this.currentEventIndex];
    this.applyEventToUi(ev);
    this.currentEventIndex++;

    const delay = Math.max(100, 600 / this.playSpeed);
    this.playTimer = setTimeout(() => this.stepPlayback(), delay);
  }

  private applyEventToUi(ev: CombatEvent): void {
    const logBox = byId('cs-combat-log');
    const row = document.createElement('div');
    row.className = 'cs-log-entry';

    if (ev.type === CombatEventType.CRIT) row.classList.add('crit');
    if (ev.type === CombatEventType.HEAL) row.classList.add('heal');
    if (ev.type === CombatEventType.STATUS_APPLY) row.classList.add('status');

    row.textContent = ev.text;
    logBox.appendChild(row);
    logBox.scrollTop = logBox.scrollHeight;

    // 波次切換
    if (ev.type === CombatEventType.WAVE_START && ev.wave) {
      this.renderArenaWave(ev.wave);
      byId('cs-arena-round').textContent = `Wave ${ev.wave}`;
      return;
    }

    // 回合數顯示 (解析日誌中的回合資訊)
    const roundMatch = ev.text.match(/── 第 (\d+) 回合 ──/);
    if (roundMatch) {
      byId('cs-arena-round').textContent = `R${roundMatch[1]}`;
    }

    // 更新目標血條 (HP)
    if (ev.targetId && ev.targetHp !== undefined && ev.targetMaxHp) {
      const cleanId = ev.targetId.replace(/^adv_\d+_/, '');
      const hpBar = document.getElementById(`hp_${ev.targetId}`) || document.getElementById(`hp_${cleanId}`);
      const hpTxt = document.getElementById(`hp_txt_${ev.targetId}`) || document.getElementById(`hp_txt_${cleanId}`);
      if (hpBar) {
        const curHp = Math.max(0, ev.targetHp);
        const pct = Math.max(0, Math.min(100, (curHp / ev.targetMaxHp) * 100));
        hpBar.style.width = `${pct}%`;
        if (hpTxt) hpTxt.textContent = `${curHp}/${ev.targetMaxHp}`;
        
        const card = hpBar.closest('.cs-arena-card') as HTMLElement;
        if (card) {
          if (ev.damage && ev.damage > 0) {
            card.classList.remove('cs-hit-shake');
            void card.offsetWidth;
            card.classList.add('cs-hit-shake');
          }
          if (curHp <= 0) {
            card.classList.add('dead');
          }
        }
      }
    }

    // 更新目標/行動者魔力條 (MP)
    if (ev.targetId && ev.targetMp !== undefined && ev.targetMaxMp) {
      const cleanId = ev.targetId.replace(/^adv_\d+_/, '');
      const mpBar = document.getElementById(`mp_${ev.targetId}`) || document.getElementById(`mp_${cleanId}`);
      const mpTxt = document.getElementById(`mp_txt_${ev.targetId}`) || document.getElementById(`mp_txt_${cleanId}`);
      if (mpBar) {
        const curMp = Math.max(0, ev.targetMp);
        const pct = Math.max(0, Math.min(100, (curMp / ev.targetMaxMp) * 100));
        mpBar.style.width = `${pct}%`;
        if (mpTxt) mpTxt.textContent = `${curMp}/${ev.targetMaxMp}`;
      }
    }
  }

  private finishPlayback(): void {
    this.stopPlayback();
    if (!this.currentReport) return;
    const badge = byId('cs-battle-result-badge');
    if (this.currentReport.isVictory) {
      badge.textContent = '🏆 勝利 (VICTORY)';
      badge.style.color = 'var(--cs-green)';
    } else {
      badge.textContent = '💀 戰敗 (DEFEAT)';
      badge.style.color = 'var(--cs-red)';
    }
  }

  private stopPlayback(): void {
    this.isPlaying = false;
    if (this.playTimer) clearTimeout(this.playTimer);
    byId('btn-play-pause').textContent = '▶ 繼續';
  }

  // ── 蒙地卡羅 100 場極速模擬 ──
  private runMonteCarlo(): void {
    this.stopPlayback();
    const adventurers = this.buildAdventurers();
    const monsterWaves = this.buildMonstersForWaves();
    GameState.adventurers = adventurers;
    const attackerIds = adventurers.map(a => a.id);

    let wins = 0;
    let totalRounds = 0;
    let totalDmgDone = 0;
    let totalDmgTaken = 0;

    const damageByActor: Record<string, number> = {};
    const takenByActor: Record<string, number> = {};
    const healByActor: Record<string, number> = {};

    adventurers.forEach(a => {
      damageByActor[a.name] = 0;
      takenByActor[a.name] = 0;
      healByActor[a.name] = 0;
    });

    const RUN_COUNT = 100;

    for (let i = 0; i < RUN_COUNT; i++) {
      const rep = CombatSystem.simulateCombat(
        attackerIds,
        1,
        '',
        TerrainType.PLAINS,
        monsterWaves.length,
        undefined,
        monsterWaves[0],
        undefined,
        undefined,
        undefined,
        clone(monsterWaves)
      );

      if (rep.isVictory) wins++;
      totalRounds += Math.max(1, Math.floor(rep.events.length / 4));

      rep.events.forEach(ev => {
        if (ev.damage && ev.damage > 0) {
          if (ev.actorName && damageByActor[ev.actorName] !== undefined) {
            damageByActor[ev.actorName] += ev.damage;
            totalDmgDone += ev.damage;
          }
          if (ev.targetName && takenByActor[ev.targetName] !== undefined) {
            takenByActor[ev.targetName] += ev.damage;
            totalDmgTaken += ev.damage;
          }
        }
        if (ev.type === CombatEventType.HEAL && ev.damage && ev.damage > 0) {
          if (ev.actorName && healByActor[ev.actorName] !== undefined) {
            healByActor[ev.actorName] += ev.damage;
          }
        }
      });
    }

    byId('kpi-win-rate').textContent = `${Math.round((wins / RUN_COUNT) * 100)}%`;
    byId('kpi-avg-rounds').textContent = (totalRounds / RUN_COUNT).toFixed(1);
    byId('kpi-total-dmg').textContent = Math.round(totalDmgDone / RUN_COUNT).toLocaleString();
    byId('kpi-total-taken').textContent = Math.round(totalDmgTaken / RUN_COUNT).toLocaleString();

    this.renderChart('chart-dps-list', damageByActor, RUN_COUNT);
    this.renderChart('chart-taken-list', takenByActor, RUN_COUNT);
    this.renderChart('chart-heal-list', healByActor, RUN_COUNT);

    this.switchTab('monte');
  }

  private renderChart(containerId: string, data: Record<string, number>, runs: number): void {
    const box = byId(containerId);
    box.innerHTML = '';
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const maxVal = sorted[0]?.[1] || 1;

    sorted.forEach(([name, val]) => {
      const avg = Math.round(val / runs);
      const pct = Math.max(2, Math.min(100, (val / maxVal) * 100));
      const row = document.createElement('div');
      row.className = 'cs-chart-row';
      row.innerHTML = `
        <span class="cs-chart-label" title="${name}">${name}</span>
        <div class="cs-chart-bar-bg">
          <div class="cs-chart-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <span class="cs-chart-val">${avg}</span>
      `;
      box.appendChild(row);
    });
  }

  private switchTab(tab: 'visual' | 'monte'): void {
    if (tab === 'visual') {
      byId('tab-btn-visual').classList.add('active');
      byId('tab-btn-monte').classList.remove('active');
      byId('cs-visual-view').style.display = 'flex';
      byId('cs-monte-view').style.display = 'none';
    } else {
      byId('tab-btn-monte').classList.add('active');
      byId('tab-btn-visual').classList.remove('active');
      byId('cs-monte-view').style.display = 'flex';
      byId('cs-visual-view').style.display = 'none';
    }
  }

  // ── 裝備自訂彈窗 ──
  private openEquipmentEditor(idx: number): void {
    this.activeEditingPlayerIdx = idx;
    const p = this.playerTeam[idx];
    if (!p) return;

    byId('eq-editor-unit-name').textContent = p.name;

    const allEq = Object.values(DataStore.EquipmentDB);
    const weapons = allEq.filter(e => e.slot === EquipmentSlot.WEAPON);
    const armors = allEq.filter(e => e.slot === EquipmentSlot.ARMOR);
    const accessories = allEq.filter(e => e.slot === EquipmentSlot.ACCESSORY);

    // 1. 填充武器選單
    const weaponSelect = byId<HTMLSelectElement>('eq-weapon-template');
    if (weaponSelect) {
      const jobGroups: Record<string, typeof weapons> = {
        '⚔️ 戰士 / 狂戰士 / 魔劍士': weapons.filter(w => w.weaponType === WeaponType.GREATSWORD || w.weaponType === WeaponType.DUAL_SWORDS),
        '🔮 法師 / 大魔導士 / 死靈法師': weapons.filter(w => w.weaponType === WeaponType.STAFF || w.weaponType === WeaponType.SCYTHE),
        '🏹 弓手 / 神射手 / 精靈使': weapons.filter(w => w.weaponType === WeaponType.BOW || w.weaponType === WeaponType.MAGIC_BOW),
        '🛡️ 騎士 / 聖騎士 / 符文騎士': weapons.filter(w => w.weaponType === WeaponType.SWORD_AND_SHIELD || w.weaponType === WeaponType.RUNE_SHIELD || (w.weaponType as any) === 'SHIELD'),
        '🗡️ 盜賊 / 暗殺者 / 詭術師': weapons.filter(w => w.weaponType === WeaponType.DAGGERS || w.weaponType === WeaponType.MAGIC_RING),
        '📖 祈禱者 / 大主教 / 異端拷問官': weapons.filter(w => w.weaponType === WeaponType.HOLY_BOOK || w.weaponType === WeaponType.HAMMER)
      };

      let wHtml = '';
      Object.entries(jobGroups).forEach(([groupName, list]) => {
        if (list.length > 0) {
          wHtml += `<optgroup label="${groupName}">`;
          list.forEach(w => {
            const isSel = p.weaponTemplateId ? p.weaponTemplateId === w.id : (p.weaponType === w.weaponType && p.weaponTier === (w.tier || 1));
            wHtml += `<option value="${w.id}" ${isSel ? 'selected' : ''}>[T${w.tier || 1}] ${w.name} (${w.weaponType})</option>`;
          });
          wHtml += `</optgroup>`;
        }
      });
      weaponSelect.innerHTML = wHtml;
      weaponSelect.onchange = () => this.refreshEquipmentPreview();
    }

    // 2. 填充防具選單
    const armorSelect = byId<HTMLSelectElement>('eq-armor-template');
    if (armorSelect) {
      const heavy = armors.filter(a => a.id.includes('heavy') || (a.name && a.name.includes('重')));
      const leather = armors.filter(a => a.id.includes('leather') || (a.name && a.name.includes('皮')));
      const cloth = armors.filter(a => a.id.includes('cloth') || (a.name && (a.name.includes('布') || a.name.includes('袍'))));
      const otherArmors = armors.filter(a => !heavy.includes(a) && !leather.includes(a) && !cloth.includes(a));

      let aHtml = '';
      if (heavy.length > 0) {
        aHtml += `<optgroup label="🛡️ 重鎧 (HEAVY)">`;
        heavy.forEach(a => {
          const isSel = p.armorTemplateId ? p.armorTemplateId === a.id : (p.armorTier === (a.tier || 1));
          aHtml += `<option value="${a.id}" ${isSel ? 'selected' : ''}>[T${a.tier || 1}] ${a.name}</option>`;
        });
        aHtml += `</optgroup>`;
      }
      if (leather.length > 0) {
        aHtml += `<optgroup label="🏹 輕甲/皮甲 (LEATHER)">`;
        leather.forEach(a => {
          const isSel = p.armorTemplateId ? p.armorTemplateId === a.id : false;
          aHtml += `<option value="${a.id}" ${isSel ? 'selected' : ''}>[T${a.tier || 1}] ${a.name}</option>`;
        });
        aHtml += `</optgroup>`;
      }
      if (cloth.length > 0) {
        aHtml += `<optgroup label="🔮 法袍/布甲 (CLOTH)">`;
        cloth.forEach(a => {
          const isSel = p.armorTemplateId ? p.armorTemplateId === a.id : false;
          aHtml += `<option value="${a.id}" ${isSel ? 'selected' : ''}>[T${a.tier || 1}] ${a.name}</option>`;
        });
        aHtml += `</optgroup>`;
      }
      if (otherArmors.length > 0) {
        aHtml += `<optgroup label="✨ 特殊防具">`;
        otherArmors.forEach(a => {
          const isSel = p.armorTemplateId ? p.armorTemplateId === a.id : false;
          aHtml += `<option value="${a.id}" ${isSel ? 'selected' : ''}>[T${a.tier || 1}] ${a.name}</option>`;
        });
        aHtml += `</optgroup>`;
      }
      armorSelect.innerHTML = aHtml;
      armorSelect.onchange = () => this.refreshEquipmentPreview();
    }

    // 3. 填充飾品選單
    const accSelect = byId<HTMLSelectElement>('eq-accessory-template');
    if (accSelect) {
      let accHtml = '<option value="NONE">無飾品</option>';
      accessories.forEach(acc => {
        const isSel = p.accessoryId === acc.id || p.accessoryType === acc.id;
        accHtml += `<option value="${acc.id}" ${isSel ? 'selected' : ''}>[T${acc.tier || 2}] ${acc.name}</option>`;
      });
      accSelect.innerHTML = accHtml;
      accSelect.onchange = () => this.refreshEquipmentPreview();
    }

    // 設定數值
    (byId('eq-weapon-element') as HTMLSelectElement).value = p.weaponElement || ElementType.NONE;
    (byId('eq-weapon-enhance') as HTMLInputElement).value = String(p.weaponEnhance || 0);
    (byId('eq-armor-enhance') as HTMLInputElement).value = String(p.armorEnhance || 0);

    // 觸發預覽刷新
    this.refreshEquipmentPreview();

    byId('modal-equipment-editor').style.display = 'flex';
  }

  private refreshEquipmentPreview(): void {
    const wId = (byId('eq-weapon-template') as HTMLSelectElement)?.value;
    const aId = (byId('eq-armor-template') as HTMLSelectElement)?.value;
    const accId = (byId('eq-accessory-template') as HTMLSelectElement)?.value;

    const wTpl = DataStore.EquipmentDB[wId];
    if (wTpl) {
      byId('eq-weapon-icon-preview').innerHTML = renderUniversalIcon(wTpl.icon || wTpl.weaponType || 'GREATSWORD', 44);
      byId('eq-weapon-tier-badge').textContent = `T${wTpl.tier || 1} ${wTpl.weaponType || ''}`;
      const atk = (wTpl.baseCombatEffects?.atk || (wTpl.tier || 1) * 15);
      const desc = (wTpl as any).description || (wTpl as any).flavorLore || `基礎攻擊力 +${atk}`;
      byId('eq-weapon-desc').textContent = `📊 基礎攻 +${atk} | 類型: ${wTpl.weaponType || '通用'} | 📜 ${desc}`;
    }

    const aTpl = DataStore.EquipmentDB[aId];
    if (aTpl) {
      byId('eq-armor-icon-preview').innerHTML = renderUniversalIcon(aTpl.icon || (aTpl.id.includes('heavy') ? 'HEAVY_T3' : 'CLOTH_T3'), 44);
      byId('eq-armor-tier-badge').textContent = `T${aTpl.tier || 1} 防具`;
      const def = aTpl.baseCombatEffects?.def || (aTpl.tier || 1) * 10;
      const hp = aTpl.baseCombatEffects?.hp || (aTpl.tier || 1) * 30;
      const desc = (aTpl as any).description || (aTpl as any).flavorLore || `基礎防禦 +${def}, 生命 +${hp}`;
      byId('eq-armor-desc').textContent = `📊 基礎防 +${def} · HP +${hp} | 📜 ${desc}`;
    }

    const accTpl = DataStore.EquipmentDB[accId];
    if (accTpl) {
      byId('eq-accessory-icon-preview').innerHTML = renderUniversalIcon(accTpl.icon || accTpl.id, 44);
      byId('eq-accessory-tier-badge').textContent = `T${accTpl.tier || 2} 飾品`;
      const eff = accTpl.baseCombatEffects ? JSON.stringify(accTpl.baseCombatEffects).replace(/[{"}]/g, '').replace(/:/g, '+') : '特殊加成';
      const desc = (accTpl as any).description || (accTpl as any).flavorLore || eff;
      byId('eq-accessory-desc').textContent = `📊 效果: ${eff} | 📜 ${desc}`;
    } else {
      byId('eq-accessory-icon-preview').innerHTML = '💍';
      byId('eq-accessory-tier-badge').textContent = '無飾品';
      byId('eq-accessory-desc').textContent = '未穿戴飾品';
    }
  }

  // ── 👾 怪物技能自訂器 ──
  private openMonsterSkillsEditor(waveIdx: number, idx: number): void {
    this.activeEditingMonsterWaveIdx = waveIdx;
    this.activeEditingMonsterIdx = idx;
    const curWave = this.enemyWaves[waveIdx];
    if (!curWave || !curWave[idx]) return;

    const monUnit = curWave[idx];
    const baseMonster = this.monstersDb.find(m => m.id === monUnit.monsterId);
    this.tempMonsterSkills = [...(monUnit.skills || baseMonster?.skills || [])];

    const titleEl = byId('ms-editor-unit-name');
    if (titleEl) titleEl.textContent = `${monUnit.affix || ''}${monUnit.name} (第 ${waveIdx + 1} 波)`;

    this.renderCurrentMonsterSkills();
    this.renderMonsterSkillLibrary('');

    const searchInput = byId<HTMLInputElement>('ms-skill-search');
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = () => this.renderMonsterSkillLibrary(searchInput.value.trim());
    }

    const modal = byId('modal-monster-skills');
    if (modal) modal.style.display = 'flex';
  }

  private renderCurrentMonsterSkills(): void {
    const listEl = byId('ms-current-skills-list');
    const countEl = byId('ms-current-count');
    if (countEl) countEl.textContent = String(this.tempMonsterSkills.length);
    if (!listEl) return;
    listEl.innerHTML = '';

    if (this.tempMonsterSkills.length === 0) {
      listEl.innerHTML = '<span style="color: var(--cs-text-muted); font-size: 0.75rem;">尚未裝備任何特技 (僅能普攻)</span>';
      return;
    }

    this.tempMonsterSkills.forEach((skId, sIdx) => {
      const sk = SkillRegistry.getSkill(skId);
      const tag = document.createElement('div');
      tag.className = 'cs-badge';
      tag.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; font-size: 0.75rem; background: rgba(59,130,246,0.2); border: 1px solid #3b82f6; color: #93c5fd; border-radius: 4px;';
      tag.innerHTML = `
        <span title="${sk?.description || ''}">✨ ${sk?.name || skId} (MP: ${sk?.mpCost || 0})</span>
        <button class="cs-btn cs-btn-danger cs-btn-sm" style="padding: 0 4px; font-size: 0.65rem; line-height: 14px; margin-left: 2px;" data-remove-m-skill="${sIdx}" title="移除特技">✕</button>
      `;
      listEl.appendChild(tag);
    });
  }

  private renderMonsterSkillLibrary(searchQuery: string = ''): void {
    const listEl = byId('ms-skill-library-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const allSkills = SkillRegistry.getAllSkills();
    const q = searchQuery.toLowerCase();
    const filtered = allSkills.filter(s => {
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="color: var(--cs-text-muted); padding: 12px; text-align: center; font-size: 0.75rem;">查無符合條件的技能</div>';
      return;
    }

    filtered.forEach(sk => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: #131720; border: 1px solid var(--cs-panel-border); border-radius: 5px; gap: 8px;';
      
      const isEquipped = this.tempMonsterSkills.includes(sk.id);
      const isFull = this.tempMonsterSkills.length >= 4;

      item.innerHTML = `
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: bold; color: var(--cs-gold-light); font-size: 0.8rem;">✨ ${sk.name}</span>
            <span class="cs-badge" style="font-size: 0.65rem; color: #60a5fa; background: rgba(59,130,246,0.15);">💧 MP ${sk.mpCost || 0}</span>
            <span class="cs-badge" style="font-size: 0.65rem; color: var(--cs-text-muted);">${sk.category || '通用'}</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--cs-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sk.description || ''}">
            ${sk.description || ''}
          </div>
        </div>
        <button class="cs-btn cs-btn-sm ${isEquipped ? '' : 'cs-btn-primary'}" style="padding: 2px 8px; font-size: 0.72rem; flex-shrink: 0;" data-add-m-skill="${sk.id}" ${isEquipped || isFull ? 'disabled' : ''}>
          ${isEquipped ? '已裝備' : isFull ? '已滿4招' : '＋ 加入'}
        </button>
      `;

      listEl.appendChild(item);
    });
  }

  private saveMonsterSkillsEditor(): void {
    const curWave = this.enemyWaves[this.activeEditingMonsterWaveIdx];
    if (curWave && curWave[this.activeEditingMonsterIdx]) {
      curWave[this.activeEditingMonsterIdx].skills = [...this.tempMonsterSkills];
    }
    const modal = byId('modal-monster-skills');
    if (modal) modal.style.display = 'none';
    this.render();
  }

  // ── 據點守軍選單更新 ──
  private updateStrongholdGarrisonOptions(): void {
    const selects = [byId('sd-g1'), byId('sd-g2'), byId('sd-g3'), byId('sd-g4')] as HTMLSelectElement[];
    const optionsHtml = this.monstersDb.map(m => `<option value="${m.id}">${m.name} (${m.race})</option>`).join('');
    selects.forEach((sel, idx) => {
      if (sel) {
        sel.innerHTML = optionsHtml;
        if (this.monstersDb[idx]) sel.value = this.monstersDb[idx].id;
      }
    });
  }

  // ── 🎲 隨機生態遭遇生成 ──
  private generateRandomEcosystemEncounter(): void {
    const diff = Number(byId<HTMLInputElement>('cs-enemy-diff-slider')?.value || 2);
    const terrains = [TerrainType.PLAINS, TerrainType.FOREST, TerrainType.DESERT, TerrainType.SNOW_MOUNTAIN, TerrainType.RUINS];
    const pickedTerrain = terrains[Math.floor(Math.random() * terrains.length)];

    const eligible = this.monstersDb.filter(m => !m.terrains || m.terrains.includes(pickedTerrain));
    const pool = eligible.length > 0 ? eligible : this.monstersDb;

    const waveCount = Math.floor(Math.random() * 2) + 2; // 2~3 波
    this.enemyWaves = [];

    for (let w = 0; w < waveCount; w++) {
      const isLast = w === waveCount - 1;
      const count = isLast ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 2) + 1;
      const waveUnits: EnemyUnitConfig[] = [];

      for (let i = 0; i < count; i++) {
        const mon = pool[Math.floor(Math.random() * pool.length)] || this.monstersDb[0];
        const isBoss = isLast && i === count - 1;
        waveUnits.push({
          monsterId: mon.id,
          name: mon.name,
          difficulty: diff + w,
          element: mon.defaultElement || ElementType.NONE,
          isUndead: mon.race === MonsterRace.UNDEAD,
          avatarIcon: this.getMonsterAvatar(mon.id, mon.name),
          affix: isBoss ? '👑[頭目]' : undefined,
          formationRow: i < 2 ? FormationRow.FRONT : FormationRow.BACK
        });
      }
      this.enemyWaves.push(waveUnits);
    }

    this.currentWaveIdx = 0;
    alert(`🎲 已為您隨機生成【${pickedTerrain}】地形之 ${waveCount} 波生態討伐遭遇！`);
    this.render();
  }

  // ── 事件綁定 ──
  private bindEvents(): void {
    byId('tab-btn-visual').onclick = () => this.switchTab('visual');
    byId('tab-btn-monte').onclick = () => this.switchTab('monte');

    byId('btn-run-combat').onclick = () => {
      this.switchTab('visual');
      this.runSingleBattle();
    };

    byId('btn-run-monte-carlo').onclick = () => {
      this.runMonteCarlo();
    };

    byId('btn-play-pause').onclick = () => {
      this.isPlaying = !this.isPlaying;
      byId('btn-play-pause').textContent = this.isPlaying ? '⏸ 暫停' : '▶ 繼續';
      if (this.isPlaying) this.stepPlayback();
    };

    byId('btn-speed-toggle').onclick = () => {
      if (this.playSpeed === 1) this.playSpeed = 2;
      else if (this.playSpeed === 2) this.playSpeed = 5;
      else this.playSpeed = 1;
      byId('btn-speed-toggle').textContent = `⏩ 速度: ${this.playSpeed}x`;
    };

    byId('btn-skip-all').onclick = () => {
      if (!this.currentReport) return;
      while (this.currentEventIndex < this.currentReport.events.length) {
        this.applyEventToUi(this.currentReport.events[this.currentEventIndex]);
        this.currentEventIndex++;
      }
      this.finishPlayback();
    };

    // 波次管理
    byId('btn-add-wave').onclick = () => {
      if (this.enemyWaves.length >= 5) {
        alert('最多支援 5 波敵軍！');
        return;
      }
      const diff = Number(byId<HTMLInputElement>('cs-enemy-diff-slider')?.value || 2);
      this.enemyWaves.push([
        { monsterId: 'goblin', name: '哥布林先鋒', difficulty: diff, element: ElementType.NONE, isUndead: false, avatarIcon: '👺', formationRow: FormationRow.FRONT }
      ]);
      this.currentWaveIdx = this.enemyWaves.length - 1;
      this.render();
    };

    byId('btn-del-wave').onclick = () => {
      if (this.enemyWaves.length <= 1) {
        alert('至少需保留 1 波敵軍！');
        return;
      }
      this.enemyWaves.splice(this.currentWaveIdx, 1);
      this.currentWaveIdx = Math.max(0, this.currentWaveIdx - 1);
      this.render();
    };

    byId('btn-random-encounter').onclick = () => this.generateRandomEcosystemEncounter();

    // 預設切換
    byId('cs-player-preset-select').onchange = (e) => {
      const val = (e.target as HTMLSelectElement).value;
      this.initDefaultPlayerTeam(val);
      this.render();
    };

    byId('btn-save-player-preset').onclick = () => {
      localStorage.setItem('MEDIEVAL_CUSTOM_TEST_TEAM', JSON.stringify(this.playerTeam));
      alert('已成功將當前隊伍儲存為自訂預設！');
    };

    // 據點切換
    byId('cs-stronghold-select').onchange = (e) => {
      const val = (e.target as HTMLSelectElement).value;
      this.initDefaultEnemyWaves(val);
      this.render();
    };

    byId('cs-enemy-diff-slider').oninput = (e) => {
      const val = (e.target as HTMLInputElement).value;
      byId('cs-enemy-diff-val').textContent = `Lv.${val}`;
      this.enemyWaves.forEach(w => w.forEach(en => en.difficulty = Number(val)));
      this.renderEnemyList();
    };

    // 快速外連
    byId('btn-open-skill-workshop').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/skill-workshop.html`, '_blank');
    byId('btn-open-equipment-studio').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/equipment-studio.html`, '_blank');
    byId('btn-open-icon-studio').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/icon-studio.html`, '_blank');
    byId('btn-open-story-studio').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/story-studio.html`, '_blank');

    // 據點設計器彈窗
    byId('btn-open-stronghold-designer').onclick = () => {
      this.updateStrongholdGarrisonOptions();
      byId('modal-stronghold-designer').style.display = 'flex';
    };
    byId('btn-close-stronghold-designer').onclick = () => byId('modal-stronghold-designer').style.display = 'none';
    byId('btn-cancel-stronghold').onclick = () => byId('modal-stronghold-designer').style.display = 'none';

    byId('btn-save-stronghold').onclick = () => {
      const id = (byId('sd-id') as HTMLInputElement).value.trim();
      const name = (byId('sd-name') as HTMLInputElement).value.trim();
      const diff = Number((byId('sd-diff') as HTMLInputElement).value) || 3;
      const terrain = (byId('sd-terrain') as HTMLSelectElement).value as TerrainType;
      const faction = (byId('sd-faction') as HTMLSelectElement).value;

      if (!id || !name) {
        alert('請填寫據點代號與名稱');
        return;
      }

      const g1 = (byId('sd-g1') as HTMLSelectElement).value;
      const g2 = (byId('sd-g2') as HTMLSelectElement).value;
      const g3 = (byId('sd-g3') as HTMLSelectElement).value;
      const g4 = (byId('sd-g4') as HTMLSelectElement).value;

      // 建立 2 波守軍：第 1 波小怪，第 2 波 Boss 守將
      const garrisonWaves: EnemyUnitConfig[][] = [
        [
          { monsterId: g1, name: this.getMonsterName(g1), difficulty: diff, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar(g1, this.getMonsterName(g1)), formationRow: FormationRow.FRONT },
          { monsterId: g2, name: this.getMonsterName(g2), difficulty: diff, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar(g2, this.getMonsterName(g2)), formationRow: FormationRow.FRONT }
        ],
        [
          { monsterId: g3, name: this.getMonsterName(g3), difficulty: diff, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar(g3, this.getMonsterName(g3)), formationRow: FormationRow.FRONT },
          { monsterId: g4, name: this.getMonsterName(g4), difficulty: diff + 1, element: ElementType.NONE, isUndead: false, avatarIcon: this.getMonsterAvatar(g4, this.getMonsterName(g4)), affix: '👑[守將]', formationRow: FormationRow.BACK }
        ]
      ];

      this.customStrongholds[id] = {
        id,
        name,
        terrain,
        difficulty: diff,
        faction,
        garrisonWaves
      };

      const sel = byId<HTMLSelectElement>('cs-stronghold-select');
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `🏰 [自訂] ${name} (難度 ${diff} - ${terrain})`;
      opt.selected = true;
      sel.appendChild(opt);

      this.enemyWaves = clone(garrisonWaves);
      this.currentWaveIdx = 0;
      byId('modal-stronghold-designer').style.display = 'none';
      alert(`已成功設計自訂據點【${name}】！已加入據點情境並配置 2 波守軍。`);
      this.render();
    };

    // 裝備自訂彈窗事件
    byId('btn-close-equipment-editor').onclick = () => byId('modal-equipment-editor').style.display = 'none';
    byId('btn-cancel-equipment').onclick = () => byId('modal-equipment-editor').style.display = 'none';
    byId('btn-save-equipment').onclick = () => {
      const p = this.playerTeam[this.activeEditingPlayerIdx];
      if (!p) return;

      const wId = (byId('eq-weapon-template') as HTMLSelectElement).value;
      const aId = (byId('eq-armor-template') as HTMLSelectElement).value;
      const accId = (byId('eq-accessory-template') as HTMLSelectElement).value;

      const wTpl = DataStore.EquipmentDB[wId];
      if (wTpl) {
        p.weaponTemplateId = wId;
        p.weaponType = wTpl.weaponType || WeaponType.GREATSWORD;
        p.weaponTier = wTpl.tier || 1;
      }
      p.weaponElement = (byId('eq-weapon-element') as HTMLSelectElement).value as ElementType;
      p.weaponEnhance = Number((byId('eq-weapon-enhance') as HTMLInputElement).value) || 0;

      const aTpl = DataStore.EquipmentDB[aId];
      if (aTpl) {
        p.armorTemplateId = aId;
        p.armorTier = aTpl.tier || 1;
      }
      p.armorEnhance = Number((byId('eq-armor-enhance') as HTMLInputElement).value) || 0;

      p.accessoryId = accId !== 'NONE' ? accId : undefined;
      p.accessoryType = accId;

      byId('modal-equipment-editor').style.display = 'none';
      this.render();
    };

    // 怪物特技自訂彈窗事件
    const btnCloseMSkills = byId('btn-close-monster-skills');
    if (btnCloseMSkills) btnCloseMSkills.onclick = () => byId('modal-monster-skills').style.display = 'none';
    const btnCancelMSkills = byId('btn-cancel-monster-skills');
    if (btnCancelMSkills) btnCancelMSkills.onclick = () => byId('modal-monster-skills').style.display = 'none';
    const btnSaveMSkills = byId('btn-save-monster-skills');
    if (btnSaveMSkills) btnSaveMSkills.onclick = () => this.saveMonsterSkillsEditor();

    // 全圖集通用圖標選擇器按鈕與綁定
    byId('mc-avatar-preview').onclick = () => {
      this.openIconPicker(ic => {
        byId('mc-avatar-preview').innerHTML = renderUniversalIcon(ic, 40);
        byId('mc-avatar-preview').dataset.iconVal = ic;
      });
    };

    byId('btn-close-icon-picker').onclick = () => byId('modal-icon-picker').style.display = 'none';
    byId('btn-close-icon-picker-footer').onclick = () => byId('modal-icon-picker').style.display = 'none';
    byId('btn-quick-open-icon-studio').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/icon-studio.html`, '_blank');

    byId('btn-apply-custom-icon').onclick = () => {
      const input = byId<HTMLInputElement>('icon-picker-custom-input');
      const val = input ? input.value.trim() : '';
      if (val && this.iconPickerCallback) {
        this.iconPickerCallback(val);
        byId('modal-icon-picker').style.display = 'none';
      }
    };

    // 怪物創造彈窗
    const btnOpenMonsterCreator = byId('btn-open-monster-creator');
    if (btnOpenMonsterCreator) {
      btnOpenMonsterCreator.onclick = () => {
        byId('modal-monster-creator').style.display = 'flex';
      };
    }
    const btnCloseMonsterCreator = byId('btn-close-monster-creator');
    if (btnCloseMonsterCreator) btnCloseMonsterCreator.onclick = () => byId('modal-monster-creator').style.display = 'none';
    const btnCancelMonsterCreator = byId('btn-cancel-monster-creator');
    if (btnCancelMonsterCreator) btnCancelMonsterCreator.onclick = () => byId('modal-monster-creator').style.display = 'none';

    byId('btn-save-monster-item').onclick = () => {
      const id = (byId('mc-id') as HTMLInputElement).value.trim();
      const name = (byId('mc-name') as HTMLInputElement).value.trim();
      if (!id || !name) {
        alert('請填寫單位 ID 與名稱');
        return;
      }
      const newMonster: MonsterData = {
        id,
        name,
        race: (byId('mc-race') as HTMLSelectElement).value as any,
        defaultElement: (byId('mc-element') as HTMLSelectElement).value as any,
        powerTier: Number((byId('mc-powertier') as HTMLInputElement).value) || 1.0,
        isMagicalAttacker: (byId('mc-attack-type') as HTMLSelectElement).value === 'magical',
        compatibleRaces: [((byId('mc-race') as HTMLSelectElement).value as any)],
        terrains: [TerrainType.PLAINS, TerrainType.FOREST]
      };
      if ((byId('mc-comp-undead') as HTMLInputElement).checked) {
        newMonster.compatibleRaces.push(MonsterRace.UNDEAD);
      }
      this.monstersDb.push(newMonster);
      byId('modal-monster-creator').style.display = 'none';
      alert(`已成功建立新單位 [${name}]！已加入本機資料庫。`);
      this.renderEnemyList();
    };

    // 磁碟持久化 (怪物庫 + 討伐據點庫同步寫入專案硬碟)
    byId('btn-save-monsters').onclick = () => this.saveMonstersToDisk();

    // 時光機歷史快照
    byId('btn-history-backups').onclick = async () => {
      try {
        const res = await fetch('/api/list-monster-backups');
        if (res.ok) {
          const data = await res.json();
          const list = byId('mc-backups-list');
          list.innerHTML = '';
          if (data.backups.length === 0) {
            list.innerHTML = '<div style="color: var(--cs-text-muted);">尚無歷史快照。每次點擊「寫入專案硬碟」皆會自動生成。</div>';
          } else {
            data.backups.forEach((b: any) => {
              const item = document.createElement('div');
              item.style.cssText = 'padding: 8px; background: #0d1117; border: 1px solid var(--cs-panel-border); border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
              item.innerHTML = `
                <div>
                  <div style="font-weight: bold; font-size: 0.82rem; color: var(--cs-gold-light);">${b.filename}</div>
                  <div style="font-size: 0.72rem; color: var(--cs-text-muted);">${b.timestamp} · ${b.note || ''}</div>
                </div>
                <button class="cs-btn cs-btn-sm" data-restore-snap="${b.filename}">↩ 還原此版本</button>
              `;
              list.appendChild(item);
            });
          }
          byId('modal-history-backups').style.display = 'flex';
        }
      } catch {}
    };

    byId('btn-close-backups').onclick = () => byId('modal-history-backups').style.display = 'none';
    byId('btn-close-backups-footer').onclick = () => byId('modal-history-backups').style.display = 'none';

    // 冒險者與怪物卡片事件委託
    document.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.pIdx !== undefined && target.dataset.field) {
        const idx = Number(target.dataset.pIdx);
        const field = target.dataset.field;
        const val = (target as HTMLInputElement).value;
        if (field === 'name') this.playerTeam[idx].name = val;
        if (field === 'level') this.playerTeam[idx].level = Math.max(1, Math.min(10, Number(val)));
      }
    });

    document.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.pIdx !== undefined && target.dataset.field) {
        const idx = Number(target.dataset.pIdx);
        const field = target.dataset.field;
        const val = (target as HTMLSelectElement).value;
        if (field === 'jobChange') {
          this.applyJobChange(idx, val);
        }
        if (field === 'formationRow') this.playerTeam[idx].formationRow = val as any;
        if (field === 'quality') {
          if (val === 'UR') {
            const existingUr = this.playerTeam.find((m, i) => i !== idx && m.quality === 'UR');
            if (existingUr) {
              alert(`⚠️ 隊伍中最多只能編入 1 位 UR 品質傭兵！(目前隊伍中已有 ${existingUr.name})`);
              this.render();
              return;
            }
          }
          this.playerTeam[idx].quality = val as any;
        }
        this.render();
      }

      if (target.dataset.eIdx !== undefined && target.dataset.field) {
        const idx = Number(target.dataset.eIdx);
        const field = target.dataset.field;
        const val = (target as HTMLSelectElement).value;
        const curWave = this.enemyWaves[this.currentWaveIdx];
        if (curWave && curWave[idx]) {
          if (field === 'monsterId') {
            curWave[idx].monsterId = val;
            const mon = this.monstersDb.find(m => m.id === val);
            if (mon) {
              curWave[idx].name = mon.name;
              curWave[idx].avatarIcon = this.getMonsterAvatar(mon.id, mon.name);
              curWave[idx].profile = mon.profile || MonsterProfile.BALANCED;
              curWave[idx].skills = mon.skills || [];
            }
          }
          if (field === 'element') curWave[idx].element = val as any;
          if (field === 'profile') curWave[idx].profile = val as any;
          if (field === 'formationRow') curWave[idx].formationRow = val as any;
        }
        this.render();
      }
    });

    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.removeP !== undefined) {
        const idx = Number(target.dataset.removeP);
        this.playerTeam.splice(idx, 1);
        this.render();
      }
      if (target.dataset.removeE !== undefined) {
        const idx = Number(target.dataset.removeE);
        const curWave = this.enemyWaves[this.currentWaveIdx];
        if (curWave) {
          curWave.splice(idx, 1);
          this.render();
        }
      }
      if (target.dataset.openEquip !== undefined || target.closest('[data-open-equip]')) {
        const el = (target.dataset.openEquip !== undefined ? target : target.closest('[data-open-equip]')) as HTMLElement;
        const idx = Number(el.dataset.openEquip);
        this.openEquipmentEditor(idx);
      }
      if (target.dataset.editESkills !== undefined || target.closest('[data-edit-e-skills]')) {
        const el = (target.dataset.editESkills !== undefined ? target : target.closest('[data-edit-e-skills]')) as HTMLElement;
        const idx = Number(el.dataset.editESkills);
        this.openMonsterSkillsEditor(this.currentWaveIdx, idx);
      }
      if (target.dataset.removeMSkill !== undefined) {
        const sIdx = Number(target.dataset.removeMSkill);
        this.tempMonsterSkills.splice(sIdx, 1);
        this.renderCurrentMonsterSkills();
        this.renderMonsterSkillLibrary(byId<HTMLInputElement>('ms-skill-search')?.value.trim() || '');
      }
      if (target.dataset.addMSkill !== undefined) {
        const skId = target.dataset.addMSkill;
        if (this.tempMonsterSkills.length < 4 && !this.tempMonsterSkills.includes(skId)) {
          this.tempMonsterSkills.push(skId);
          this.renderCurrentMonsterSkills();
          this.renderMonsterSkillLibrary(byId<HTMLInputElement>('ms-skill-search')?.value.trim() || '');
        }
      }
      if (target.dataset.changeEAvatar !== undefined || target.closest('[data-change-e-avatar]')) {
        const el = (target.dataset.changeEAvatar !== undefined ? target : target.closest('[data-change-e-avatar]')) as HTMLElement;
        const idx = Number(el.dataset.changeEAvatar);
        const curWave = this.enemyWaves[this.currentWaveIdx];
        if (curWave && curWave[idx]) {
          this.openIconPicker(ic => {
            curWave[idx].avatarIcon = ic;
            this.render();
          });
        }
      }

      if (target.dataset.changePAvatar !== undefined || target.closest('[data-change-p-avatar]')) {
        const el = (target.dataset.changePAvatar !== undefined ? target : target.closest('[data-change-p-avatar]')) as HTMLElement;
        const idx = Number(el.dataset.changePAvatar);
        if (this.playerTeam[idx]) {
          this.openIconPicker(ic => {
            this.playerTeam[idx].avatarIcon = ic;
            this.render();
          });
        }
      }
      if (target.dataset.statMod) {
        const [pIdxStr, statKey, deltaStr] = target.dataset.statMod.split(',');
        const pIdx = Number(pIdxStr);
        const delta = Number(deltaStr);
        const p = this.playerTeam[pIdx];
        if (p) {
          const maxPoints = (p.level - 1) * 5;
          const currentTotal = Object.values(p.allocatedStats).reduce((a, b) => a + b, 0);
          const currentVal = (p.allocatedStats as any)[statKey] || 0;
          if (delta > 0 && currentTotal < maxPoints) {
            (p.allocatedStats as any)[statKey] = currentVal + 1;
            this.render();
          } else if (delta < 0 && currentVal > 0) {
            (p.allocatedStats as any)[statKey] = currentVal - 1;
            this.render();
          }
        }
      }
      if (target.dataset.autoAlloc !== undefined) {
        const pIdx = Number(target.dataset.autoAlloc);
        const p = this.playerTeam[pIdx];
        if (p) {
          const totalPoints = (p.level - 1) * 5;
          p.allocatedStats = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
          if (p.jobName.includes('法師') || p.jobName.includes('魔導') || p.jobName.includes('死靈')) {
            p.allocatedStats.int = Math.floor(totalPoints * 0.7);
            p.allocatedStats.con = Math.floor(totalPoints * 0.2);
            p.allocatedStats.spr = totalPoints - p.allocatedStats.int - p.allocatedStats.con;
          } else if (p.jobName.includes('弓') || p.jobName.includes('暗殺')) {
            p.allocatedStats.agi = Math.floor(totalPoints * 0.7);
            p.allocatedStats.str = Math.floor(totalPoints * 0.2);
            p.allocatedStats.luk = totalPoints - p.allocatedStats.agi - p.allocatedStats.str;
          } else if (p.jobName.includes('騎士') || p.jobName.includes('聖騎')) {
            p.allocatedStats.con = Math.floor(totalPoints * 0.6);
            p.allocatedStats.str = Math.floor(totalPoints * 0.3);
            p.allocatedStats.spr = totalPoints - p.allocatedStats.con - p.allocatedStats.str;
          } else {
            p.allocatedStats.str = Math.floor(totalPoints * 0.6);
            p.allocatedStats.con = Math.floor(totalPoints * 0.3);
            p.allocatedStats.agi = totalPoints - p.allocatedStats.str - p.allocatedStats.con;
          }
          this.render();
        }
      }
      if (target.dataset.resetAlloc !== undefined) {
        const pIdx = Number(target.dataset.resetAlloc);
        const p = this.playerTeam[pIdx];
        if (p) {
          p.allocatedStats = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
          this.render();
        }
      }
      if (target.dataset.restoreSnap) {
        const filename = target.dataset.restoreSnap;
        if (confirm(`確定要還原至歷史快照 ${filename} 嗎？`)) {
          const res = await fetch('/api/restore-monster-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
          });
          if (res.ok) {
            const data = await res.json();
            this.monstersDb = data.monsters;
            byId('modal-history-backups').style.display = 'none';
            alert('已成功還原快照！');
            this.render();
          }
        }
      }

      // ── 英雄挑選與工坊按鈕委派 ──
      const pickBtn = (target.dataset.pickHero !== undefined ? target : target.closest('[data-pick-hero]')) as HTMLElement;
      if (pickBtn && pickBtn.dataset.pickHero !== undefined) {
        const idx = Number(pickBtn.dataset.pickHero);
        this.openHeroPicker(idx);
        return;
      }
      const applyHeroBtn = (target.dataset.applyHeroId !== undefined ? target : target.closest('[data-apply-hero-id]')) as HTMLElement;
      if (applyHeroBtn && applyHeroBtn.dataset.applyHeroId) {
        const hero = this.getAllHeroes().find(h => h.id === applyHeroBtn.dataset.applyHeroId);
        if (hero) {
          this.applyHeroToPlayerSlot(hero, 0);
          this.switchStudioTab('battle');
        }
        return;
      }
      
      if (target.dataset.avatarMonsterId !== undefined || target.closest('[data-avatar-monster-id]')) {
        const el = (target.dataset.avatarMonsterId !== undefined ? target : target.closest('[data-avatar-monster-id]')) as HTMLElement;
        const monId = el.dataset.avatarMonsterId;
        const mon = this.monstersDb.find(m => m.id === monId);
        if (mon) {
          this.openIconPicker(ic => {
            mon.avatarIcon = ic;
            this.renderMonsterDatabase();
          });
        }
      }
      if (target.dataset.avatarHeroId !== undefined || target.closest('[data-avatar-hero-id]')) {
        const el = (target.dataset.avatarHeroId !== undefined ? target : target.closest('[data-avatar-hero-id]')) as HTMLElement;
        const heroId = el.dataset.avatarHeroId;
        const hero = this.getAllHeroes().find(h => h.id === heroId);
        if (hero) {
          this.openIconPicker(ic => {
            hero.avatarIcon = ic;
            const cIdx = this.customHeroesDb.findIndex(h => h.id === heroId);
            if (cIdx >= 0) {
              this.customHeroesDb[cIdx].avatarIcon = ic;
            } else {
              this.customHeroesDb.push({ ...hero, avatarIcon: ic });
            }
            this.saveCustomHeroesToStorage();
            this.renderHeroDatabase();
          });
        }
      }
      const editHeroBtn = (target.dataset.editHeroId !== undefined ? target : target.closest('[data-edit-hero-id]')) as HTMLElement;
      if (editHeroBtn && editHeroBtn.dataset.editHeroId) {
        const hero = this.getAllHeroes().find(h => h.id === editHeroBtn.dataset.editHeroId);
        if (hero) this.openHeroCreator(hero);
        return;
      }
      const delHeroBtn = (target.dataset.delHeroId !== undefined ? target : target.closest('[data-del-hero-id]')) as HTMLElement;
      if (delHeroBtn && delHeroBtn.dataset.delHeroId) {
        if (confirm('確定要刪除此自訂英雄嗎？')) {
          this.customHeroesDb = this.customHeroesDb.filter(h => h.id !== delHeroBtn.dataset.delHeroId);
          this.saveCustomHeroesToStorage();
          this.renderHeroDatabase();
        }
        return;
      }
      const pickThisHeroBtn = (target.dataset.pickThisHero !== undefined ? target : target.closest('[data-pick-this-hero]')) as HTMLElement;
      if (pickThisHeroBtn && pickThisHeroBtn.dataset.pickThisHero) {
        const hero = this.getAllHeroes().find(h => h.id === pickThisHeroBtn.dataset.pickThisHero);
        if (hero) {
          this.applyHeroToPlayerSlot(hero, this.activePickingSlotIdx);
          byId('modal-hero-picker').style.display = 'none';
        }
        return;
      }
    });

    // ── 分頁切換 (戰鬥模擬沙盒 vs 英雄設計工坊 vs 怪物資料庫) ──
    byId('btn-studio-tab-battle').onclick = () => this.switchStudioTab('battle');
    byId('btn-studio-tab-heroes').onclick = () => this.switchStudioTab('heroes');
    byId('btn-studio-tab-monsters').onclick = () => this.switchStudioTab('monsters');

    // ── 英雄工坊搜尋與過濾事件 ──
    byId<HTMLInputElement>('cs-hero-search')?.addEventListener('input', (e) => {
      this.heroSearchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.renderHeroDatabase();
    });
    byId<HTMLSelectElement>('cs-hero-filter-quality')?.addEventListener('change', (e) => {
      this.heroFilterQuality = (e.target as HTMLSelectElement).value;
      this.renderHeroDatabase();
    });
    byId<HTMLSelectElement>('cs-hero-filter-job')?.addEventListener('change', (e) => {
      this.heroFilterJob = (e.target as HTMLSelectElement).value;
      this.renderHeroDatabase();
    });
    byId('btn-create-hero').onclick = () => this.openHeroCreator();

    // ── 英雄創造/編輯彈窗按鈕 ──
    byId('btn-close-hero-creator').onclick = () => byId('modal-hero-creator').style.display = 'none';
    byId('btn-cancel-hero-creator').onclick = () => byId('modal-hero-creator').style.display = 'none';
    byId('btn-save-hero-creator').onclick = () => this.saveHeroCreator();

    // ── 英雄快速選擇器彈窗按鈕 ──
    byId('btn-close-hero-picker').onclick = () => byId('modal-hero-picker').style.display = 'none';
    byId('btn-close-hero-picker-footer').onclick = () => byId('modal-hero-picker').style.display = 'none';
    byId<HTMLInputElement>('cs-picker-search')?.addEventListener('input', (e) => {
      this.renderHeroPickerList((e.target as HTMLInputElement).value.trim().toLowerCase());
    });

    // ── 怪物資料庫搜尋與過濾事件 ──
    byId<HTMLInputElement>('cs-monster-search')?.addEventListener('input', (e) => {
      this.monsterSearchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.renderMonsterDatabase();
    });
    byId<HTMLSelectElement>('cs-monster-filter-race')?.addEventListener('change', (e) => {
      this.monsterFilterRace = (e.target as HTMLSelectElement).value;
      this.renderMonsterDatabase();
    });
    byId<HTMLSelectElement>('cs-monster-filter-terrain')?.addEventListener('change', (e) => {
      this.monsterFilterTerrain = (e.target as HTMLSelectElement).value;
      this.renderMonsterDatabase();
    });
    byId<HTMLSelectElement>('cs-monster-filter-boss')?.addEventListener('change', (e) => {
      this.monsterFilterBoss = (e.target as HTMLSelectElement).value;
      this.renderMonsterDatabase();
    });

    // ── 怪物資料庫新增與寫入按鈕 ──
    byId('btn-db-create-monster').onclick = () => this.openMonsterCreator();
    byId('btn-db-save-monsters').onclick = () => this.saveMonstersToDisk();

    // ── 怪物卡片委派 ──
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const avatarBox = (target.dataset.avatarMonsterId !== undefined ? target : target.closest('[data-avatar-monster-id]')) as HTMLElement;
      if (avatarBox && avatarBox.dataset.avatarMonsterId) {
        const mon = this.monstersDb.find(m => m.id === avatarBox.dataset.avatarMonsterId);
        if (mon) {
          this.openIconPicker(newIcon => {
            mon.avatarIcon = newIcon;
            this.renderMonsterDatabase();
          });
        }
        return;
      }
      const editMonBtn = (target.dataset.editMonsterId !== undefined ? target : target.closest('[data-edit-monster-id]')) as HTMLElement;
      if (editMonBtn && editMonBtn.dataset.editMonsterId) {
        this.openMonsterCreator(editMonBtn.dataset.editMonsterId);
        return;
      }
      const delMonBtn = (target.dataset.delMonsterId !== undefined ? target : target.closest('[data-del-monster-id]')) as HTMLElement;
      if (delMonBtn && delMonBtn.dataset.delMonsterId) {
        const monId = delMonBtn.dataset.delMonsterId;
        const mon = this.monstersDb.find(m => m.id === monId);
        if (mon && confirm(`確定要刪除怪物【${mon.name}】嗎？`)) {
          this.monstersDb = this.monstersDb.filter(m => m.id !== monId);
          this.renderMonsterDatabase();
        }
        return;
      }
    });
  }

  private applyJobChange(idx: number, job: string): void {
    const p = this.playerTeam[idx];
    if (!p) return;
    p.jobName = job;

    if (job === '狂戰士') { p.isAdvanced = true; p.weaponType = WeaponType.GREATSWORD; }
    else if (job === '魔劍士') { p.isAdvanced = true; p.weaponType = WeaponType.DUAL_SWORDS; }
    else if (job === '大魔導士') { p.isAdvanced = true; p.weaponType = WeaponType.STAFF; }
    else if (job === '死靈法師') { p.isAdvanced = true; p.weaponType = WeaponType.SCYTHE; }
    else if (job === '神射手') { p.isAdvanced = true; p.weaponType = WeaponType.BOW; }
    else if (job === '精靈使') { p.isAdvanced = true; p.weaponType = WeaponType.MAGIC_BOW; }
    else if (job === '聖騎士') { p.isAdvanced = true; p.weaponType = WeaponType.SWORD_AND_SHIELD; }
    else if (job === '符文騎士') { p.isAdvanced = true; p.weaponType = WeaponType.RUNE_SHIELD; }
    else if (job === '暗殺者') { p.isAdvanced = true; p.weaponType = WeaponType.DAGGERS; }
    else if (job === '詭術師') { p.isAdvanced = true; p.weaponType = WeaponType.MAGIC_RING; }
    else if (job === '大主教') { p.isAdvanced = true; p.weaponType = WeaponType.HOLY_BOOK; }
    else if (job === '異端拷問官') { p.isAdvanced = true; p.weaponType = WeaponType.HAMMER; }
    else {
      p.isAdvanced = false;
      if (job === '戰士') p.weaponType = WeaponType.GREATSWORD;
      if (job === '法師') p.weaponType = WeaponType.STAFF;
      if (job === '弓箭手') p.weaponType = WeaponType.BOW;
      if (job === '騎士') p.weaponType = WeaponType.SWORD_AND_SHIELD;
      if (job === '盜賊') p.weaponType = WeaponType.DAGGERS;
      if (job === '祈禱者') p.weaponType = WeaponType.HOLY_BOOK;
    }
  }

  private getMonsterName(id: string): string {
    return this.monstersDb.find(m => m.id === id)?.name || id;
  }

  private getMonsterAvatar(monsterId: string, fallbackName?: string): string {
    const mon = this.monstersDb.find(m => m.id === monsterId);
    if (mon && mon.avatarIcon) return mon.avatarIcon;
    if (mon && (mon as any).icon) return (mon as any).icon;
    if (fallbackName) return this.getMonsterEmoji(fallbackName);
    return '👾';
  }

  private getMonsterEmoji(name: string): string {
    if (name.includes('狼')) return '🐺';
    if (name.includes('蛛')) return '🕷️';
    if (name.includes('蜥') || name.includes('蛇')) return '🦎';
    if (name.includes('蠍')) return '🦂';
    if (name.includes('骷髏') || name.includes('屍') || name.includes('死靈')) return '💀';
    if (name.includes('龍')) return '🐉';
    if (name.includes('鬼') || name.includes('靈')) return '👻';
    if (name.includes('哥布林')) return '👺';
    if (name.includes('獸人')) return '👹';
    if (name.includes('騎士') || name.includes('兵')) return '💂';
    if (name.includes('官') || name.includes('神官') || name.includes('法')) return '🧙';
    return '👾';
  }

  private getAccessoryShortName(type: string): string {
    if (type === 'RING_HP') return '生命戒';
    if (type === 'RING_MP') return '魔力鏈';
    if (type === 'BADGE_CRIT') return '暴擊徽';
    if (type === 'AMULET_AGI') return '疾風符';
    if (type === 'CROSS_HOLY') return '聖十字';
    return type;
  }

  private getJobEmoji(job: string): string {
    if (job.includes('戰士') || job.includes('狂戰') || job.includes('魔劍')) return '⚔️';
    if (job.includes('法師') || job.includes('魔導') || job.includes('死靈')) return '🔮';
    if (job.includes('弓') || job.includes('神射') || job.includes('精靈')) return '🏹';
    if (job.includes('騎士') || job.includes('聖騎') || job.includes('符文')) return '🛡️';
    if (job.includes('盜賊') || job.includes('暗殺') || job.includes('詭術')) return '🗡️';
    if (job.includes('祈禱') || job.includes('主教') || job.includes('拷問')) return '📖';
    return '👤';
  }

  // ── 🖼️ 全圖集通用圖標選擇器 (Universal Icon Picker) ──
  private openIconPicker(callback: (icon: string) => void): void {
    this.iconPickerCallback = callback;
    const tabsContainer = byId('icon-picker-tabs');
    const customInput = byId<HTMLInputElement>('icon-picker-custom-input');

    if (tabsContainer) tabsContainer.innerHTML = '';
    if (customInput) customInput.value = '';

    const datasets = this.iconDatasets || {};
    const catKeys = Object.keys(datasets);

    // 動態標籤清單：所有圖集 + Emoji
    const allTabs = [
      ...catKeys.map(k => ({ key: k, title: datasets[k]?.title || k })),
      { key: 'emoji', title: '😀 常用 Emoji' }
    ];

    if (!this.currentIconPickerTab || !allTabs.some(t => t.key === this.currentIconPickerTab)) {
      this.currentIconPickerTab = allTabs[0]?.key || 'monsters';
    }

    if (tabsContainer) {
      allTabs.forEach(tab => {
        const tabBtn = document.createElement('button');
        tabBtn.className = `cs-icon-picker-tab ${tab.key === this.currentIconPickerTab ? 'active' : ''}`;
        tabBtn.textContent = tab.title;
        tabBtn.onclick = () => {
          this.currentIconPickerTab = tab.key;
          tabsContainer.querySelectorAll('.cs-icon-picker-tab').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
          this.renderIconPickerItems(tab.key);
        };
        tabsContainer.appendChild(tabBtn);
      });
    }

    this.renderIconPickerItems(this.currentIconPickerTab);
    byId('modal-icon-picker').style.display = 'flex';
  }

  private renderIconPickerItems(tabKey: string): void {
    const grid = byId('icon-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (tabKey === 'emoji') {
      const candidates = [
        '👾', '🐺', '🕷️', '🦎', '🦂', '💀', '🧟', '👻', '🐉', '🐲', '👹', '👺',
        '💂', '🤺', '🏹', '🧙', '🧙‍♂️', '🧝', '🦇', '🐀', '🐗', '🐍', '🦀', '🦁',
        '🗿', '⚙️', '🔥', '🛡️', '⚔️', '🔮', '✨', '🗡️', '🪄', '🩸', '💧', '⚡'
      ];
      candidates.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'cs-icon-picker-item';
        item.innerHTML = `<div style="font-size: 1.8rem; line-height: 1.2;">${emoji}</div>`;
        item.onclick = () => {
          if (this.iconPickerCallback) this.iconPickerCallback(emoji);
          byId('modal-icon-picker').style.display = 'none';
        };
        grid.appendChild(item);
      });
      return;
    }

    const catData = this.iconDatasets[tabKey];
    if (!catData || !catData.items) return;

    catData.items.forEach((it: any) => {
      const fullId = `${tabKey}:${it.id}`;
      const item = document.createElement('div');
      item.className = 'cs-icon-picker-item';
      item.innerHTML = `
        ${renderUniversalIcon(fullId, 44)}
        <div class="cs-icon-picker-item-label">${it.name || it.id}</div>
      `;
      item.onclick = () => {
        if (this.iconPickerCallback) this.iconPickerCallback(fullId);
        byId('modal-icon-picker').style.display = 'none';
      };
      grid.appendChild(item);
    });
  }
}

// 啟動工坊
window.addEventListener('DOMContentLoaded', () => {
  const controller = new CombatStudioController();
  controller.init();
});
