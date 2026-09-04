import { Adventurer } from '../models/Adventurer';
import { CombatEvent, CombatEventType, CombatReport } from '../models/Combat';
import { CombatGroupRole, AttackerInterfaceConfig, DefenderInterfaceConfig, ElementType, Equipment, EquipmentSlot, FormationRow, Gender, JobConfig, MonsterData, MonsterInstance, MonsterProfile, MonsterRace, TerrainType, TraitConfig, WeaponType } from '../models/types';
import { SubjugationTemplate, SubjugationWave, SubjugationWaveMonster } from '../models/Narrative';
import { MonsterSystem } from '../systems/MonsterSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { GameState } from '../core/GameState';
import monstersJson from '../data/monsters.json';
import defaultCustomDatasets from '../data/custom_icon_datasets.json';
import subjugationNodesJson from '../data/subjugation_nodes.json';
import materialsJson from '../data/materials.json';
import { renderUniversalIcon, renderEquipIcon } from '../ui/IconSpriteHelper';
import { UNIQUE_HEROES, UniqueHeroDef } from '../data/UniqueAdventurers';
import { SkillRegistry } from '../systems/combat/SkillRegistry';
import { DataStore } from '../systems/DataStore';
import { FormationDB } from '../systems/FormationDB';
import { EquipmentGenerator } from '../systems/EquipmentGenerator';
import { SKILLS } from '../data/SkillData';
import equipmentWeaponsJson from '../data/equipment_weapons.json';
import equipmentArmorsJson from '../data/equipment_armors.json';
import equipmentAccessoriesJson from '../data/equipment_accessories.json';
import customSkillsJson from '../data/CustomSkillData.json';
import { VFXPresetRepository } from '../ui/fx/VFXPresetRepository';
import { CombatStudioStageAdapter } from '../ui/fx/adapters/CombatStudioStageAdapter';
import '../styles/combat-studio.css';

// 工具函式
const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;
const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));
const MONSTER_WORKSHOP_DRAFT_KEY = 'MEDIEVAL_CUSTOM_MONSTERS_V1';

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
  skills?: string[];
  heroOriginalLevel?: number;
  customBaseAttributes?: AllocatedStats;
  allocatedStats: AllocatedStats;
}

interface EnemyUnitConfig {
  monsterId: string;
  name: string;
  difficulty: number;
  element: ElementType;
  isUndead: boolean;
  formationRow: FormationRow;
  gridR?: number;
  gridC?: number;
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
  private strongholdFilterFaction: string = 'ALL';
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

  // 英雄自訂技能與挑選器狀態
  private readonly DEFAULT_JOB_SKILLS: Record<string, [string, string, string]> = {
    WARRIOR: ['FIGHTER_HEAVY_STRIKE', 'FIGHTER_ARMOR_BREAK', 'GREATSWORD_WHIRLWIND'],
    KNIGHT: ['KNIGHT_SHIELD_BASH', 'KNIGHT_TAUNT', 'KNIGHT_PALADIN_AEGIS'],
    MAGE: ['MAGE_ARCANE_MISSILES', 'MAGE_STATIC_FIELD', 'STAFF_METEOR'],
    ARCHER: ['ARCHER_PIERCING_SHOT', 'ARCHER_AIMED_SHOT', 'SNIPER_FATAL_SNIPE'],
    THIEF: ['THIEF_SURPRISE_ATTACK', 'THIEF_POISON_BLADE', 'ASSASSIN_SHADOW_ASSASSINATION'],
    PRAYER: ['PRAYER_HEAL', 'PRAYER_HOLY_LIGHT', 'PRAYER_ARCHBISHOP_MASS_HEAL']
  };
  private currentHeroEditingSkills: string[] = ['FIGHTER_HEAVY_STRIKE', 'FIGHTER_ARMOR_BREAK', 'GREATSWORD_WHIRLWIND'];
  private activeHeroSkillSlotIndex: number = 0;
  private currentSkillPickerTab: string = 'ALL';
  private skillPickerSearchQuery: string = '';

  // 3x3 九宮格戰術佈陣與陣型狀態
  private playerGridMap: Record<string, string> = {}; // 'r_c' -> 'p1' (0_0 .. 2_2)
  private selectedFormationId: string = 'DEFAULT';
  private draggedPlayerUnitId: string | null = null;
  private dragSourceSlot: string | null = null;

  // 我方隊伍狀態
  private playerTeam: PlayerUnitConfig[] = [];
  // 敵方多波次隊伍狀態 (每一波為一個 EnemyUnitConfig[])
  private enemyWaves: EnemyUnitConfig[][] = [[]];
  private currentWaveIdx = 0;

  // 當前裝備編輯中的傭兵索引
  private activeEditingPlayerIdx = 0;

  // 英雄工坊裝備挑選器狀態
  private activeHeroEquipSlotType: 'WEAPON' | 'ARMOR' | 'ACCESSORY' = 'WEAPON';
  private equipPickerSearchQuery: string = '';
  private equipPickerTierFilter: string = 'ALL';

  // 怪物技能自訂狀態
  private activeEditingMonsterWaveIdx = 0;
  private activeEditingMonsterIdx = 0;
  private tempMonsterSkills: string[] = [];
  private monsterDraftRevision = 0;

  // 討伐據點怪物進階配置狀態
  private currentConfiguringWaveIdx = 0;
  private currentConfiguringMonsterIdx = 0;
  private tempShMonsterSkills: string[] = [];
  // 討伐據點九宮格拖曳狀態
  private draggedShMonster: { waveIdx: number; monsterIdx: number; slotId: string } | null = null;
  // 當前更換頭像中的對象 ('creator' 或 敵方陣容 index 或 傭兵 index)
  private activeIconPickerTarget: 'creator' | { type: 'enemy'; idx: number } | { type: 'player'; idx: number } = 'creator';
  private isIconPickerFlipped: boolean = false;

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

  private async loadStrongholds(forceReloadFromDisk: boolean = false): Promise<void> {
    const diskDefaults = clone(subjugationNodesJson) as SubjugationTemplate[];
    
    // 如果強制從硬碟載入，則直接以磁碟完整 24+ 處據點覆蓋
    if (forceReloadFromDisk) {
      this.strongholdsDb = diskDefaults;
      this.strongholdsDb.forEach(sh => this.normalizeStrongholdWaves(sh));
      if (!this.editingStrongholdId || !this.strongholdsDb.some(s => s.id === this.editingStrongholdId)) {
        this.editingStrongholdId = this.strongholdsDb[0]?.id || null;
      }
      this.saveStrongholdsToStorage();
      return;
    }

    // 讀取 localStorage 既有暫存
    let savedList: SubjugationTemplate[] = [];
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('MEDIEVAL_CUSTOM_STRONGHOLDS_V2');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            savedList = parsed;
          }
        } catch {}
      }
    }

    // 智慧合併：以磁碟 24 處據點為基底，合併使用者修改內容與額外自創據點
    const mergedDb: SubjugationTemplate[] = [];
    const savedMap = new Map<string, SubjugationTemplate>();
    savedList.forEach(s => savedMap.set(s.id, s));

    diskDefaults.forEach(diskSh => {
      if (savedMap.has(diskSh.id)) {
        const userSaved = savedMap.get(diskSh.id)!;
        mergedDb.push({
          ...diskSh,
          ...userSaved,
          allowTroops: userSaved.allowTroops !== undefined ? userSaved.allowTroops : diskSh.allowTroops,
          worldGenMode: userSaved.worldGenMode || diskSh.worldGenMode,
          factionId: userSaved.factionId !== undefined ? userSaved.factionId : diskSh.factionId,
          nodeLevel: userSaved.nodeLevel !== undefined ? userSaved.nodeLevel : diskSh.nodeLevel
        });
        savedMap.delete(diskSh.id);
      } else {
        mergedDb.push(diskSh);
      }
    });

    // 將使用者自創的新據點追加進清單
    savedMap.forEach(customSh => {
      mergedDb.push(customSh);
    });

    this.strongholdsDb = mergedDb;
    this.strongholdsDb.forEach(sh => this.normalizeStrongholdWaves(sh));
    if (!this.editingStrongholdId || !this.strongholdsDb.some(s => s.id === this.editingStrongholdId)) {
      this.editingStrongholdId = this.strongholdsDb[0]?.id || null;
    }
    this.saveStrongholdsToStorage();
  }

  /**
   * 🛡️ 正規化據點波次怪物的 3×3 九宮格座標，徹底消除 slot 重複覆蓋與衝突
   */
  public normalizeStrongholdWaves(sh: SubjugationTemplate): boolean {
    if (!sh || !sh.waves) return false;
    let modified = false;

    sh.waves.forEach((w) => {
      if (!w.monsters || w.monsters.length === 0) return;

      const occupiedSlots = new Set<string>();
      const monstersToReassign: SubjugationWaveMonster[] = [];

      // 1. 先檢驗現有座標，保留第一個合法且唯一的座標
      w.monsters.forEach((mRef) => {
        let sId = mRef.slotId;
        if (!sId && mRef.gridR !== undefined && mRef.gridC !== undefined) {
          sId = `${mRef.gridR}_${mRef.gridC}`;
        }

        if (sId && /^[0-2]_[0-2]$/.test(sId) && !occupiedSlots.has(sId)) {
          occupiedSlots.add(sId);
          mRef.slotId = sId;
          const [rStr, cStr] = sId.split('_');
          mRef.gridR = parseInt(rStr, 10);
          mRef.gridC = parseInt(cStr, 10);
          mRef.formationRow = mRef.gridR === 0 ? FormationRow.FRONT : (mRef.gridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
        } else {
          // 座標重複或未設定，加入重新分配清單
          monstersToReassign.push(mRef);
        }
      });

      // 2. 為需要重新分配的怪物尋找第一個可用的空槽位
      if (monstersToReassign.length > 0) {
        modified = true;
        for (const mRef of monstersToReassign) {
          let assigned = false;
          // 優先順序：前排 (0_0, 0_1, 0_2) -> 中排 (1_0, 1_1, 1_2) -> 後排 (2_0, 2_1, 2_2)
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              const testKey = `${r}_${c}`;
              if (!occupiedSlots.has(testKey)) {
                occupiedSlots.add(testKey);
                mRef.gridR = r;
                mRef.gridC = c;
                mRef.slotId = testKey;
                mRef.formationRow = r === 0 ? FormationRow.FRONT : (r === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
                assigned = true;
                break;
              }
            }
            if (assigned) break;
          }
        }
      }
    });

    return modified;
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

  private async saveCustomHeroesToStorage(): Promise<boolean> {
    localStorage.setItem('MEDIEVAL_CUSTOM_HEROES', JSON.stringify(this.customHeroesDb));
    try {
      const allHeroes = this.getAllHeroes().filter(h => h.id !== 'save_guardian_hero');
      const response = await fetch('/api/save-hero-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allHeroes)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return true;
    } catch (err) {
      console.error('英雄已保存為本機草稿，但寫入專案磁碟失敗:', err);
      return false;
    }
  }

  private getAllHeroes(): UniqueHeroDef[] {
    const map = new Map<string, UniqueHeroDef>();

    // 1. 預設唯一英雄 (SSOT)
    Object.values(UNIQUE_HEROES).forEach(h => {
      map.set(h.id, h);
    });

    // 2. 自訂英雄庫 (同 ID 覆蓋，新 ID 新增)
    this.customHeroesDb.forEach(h => {
      map.set(h.id, h);
    });

    // 3. 當前存檔誓約守衛 (若有)
    const playerGuardian = GameState.adventurers?.find(a => a.isGuardian);
    if (playerGuardian) {
      const gWeapon = playerGuardian.equipment[EquipmentSlot.WEAPON];
      const gArmor = playerGuardian.equipment[EquipmentSlot.ARMOR];
      const gAcc = playerGuardian.equipment[EquipmentSlot.ACCESSORY];
      map.set('save_guardian_hero', {
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
    return Array.from(map.values());
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
      const saved = localStorage.getItem(MONSTER_WORKSHOP_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.monstersDb = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn('讀取怪物工坊草稿失敗:', err);
    }

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

  private saveMonsterDraft(): void {
    try {
      this.monsterDraftRevision += 1;
      localStorage.setItem(MONSTER_WORKSHOP_DRAFT_KEY, JSON.stringify(this.monstersDb));
    } catch (err) {
      console.warn('寫入怪物工坊草稿失敗:', err);
    }
  }

  private clearMonsterDraft(): void {
    try {
      localStorage.removeItem(MONSTER_WORKSHOP_DRAFT_KEY);
    } catch (err) {
      console.warn('清除怪物工坊草稿失敗:', err);
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

  // ── 依職業計算每級自然成長六維 (每級約 6 點，與遊戲本體 Adventurer.ts 對齊) ──
  private getJobNaturalGrowth(jobName: string, level: number): { str: number; agi: number; con: number; int: number; spr: number; luk: number } {
    const lvlGain = Math.max(0, level - 1);
    let perLvl = { str: 2, agi: 1, con: 2, int: 0, spr: 0, luk: 1 }; // 預設戰士系
    if (jobName.includes('法師') || jobName.includes('魔導') || jobName.includes('死靈')) {
      perLvl = { str: 0, agi: 1, con: 1, int: 2, spr: 2, luk: 0 };
    } else if (jobName.includes('弓') || jobName.includes('神射') || jobName.includes('暗殺')) {
      perLvl = { str: 1, agi: 2, con: 1, int: 0, spr: 0, luk: 2 };
    } else if (jobName.includes('騎士') || jobName.includes('聖騎') || jobName.includes('符文')) {
      perLvl = { str: 1, agi: 0, con: 3, int: 0, spr: 1, luk: 1 };
    } else if (jobName.includes('祈禱') || jobName.includes('主教') || jobName.includes('拷問')) {
      perLvl = { str: 0, agi: 0, con: 1, int: 1, spr: 3, luk: 1 };
    }
    return {
      str: perLvl.str * lvlGain,
      agi: perLvl.agi * lvlGain,
      con: perLvl.con * lvlGain,
      int: perLvl.int * lvlGain,
      spr: perLvl.spr * lvlGain,
      luk: perLvl.luk * lvlGain
    };
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
          { monsterId: 'lothgar_court_mage', name: '[洛斯加] 皇家宮廷法師', difficulty: diff + 1, element: ElementType.FIRE, isUndead: false, avatarIcon: this.getMonsterAvatar('lothgar_court_mage', '皇家宮廷法師'), formationRow: FormationRow.BACK }
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

      // 套用真實六維：自訂英雄以專屬出廠屬性為基準（支援等級差動態自然成長），普通傭兵以職業基準 + 等級自然成長
      if (cfg.customBaseAttributes) {
        let hStr = cfg.customBaseAttributes.str;
        let hAgi = cfg.customBaseAttributes.agi;
        let hCon = cfg.customBaseAttributes.con;
        let hInt = cfg.customBaseAttributes.int;
        let hSpr = cfg.customBaseAttributes.spr;
        let hLuk = cfg.customBaseAttributes.luk;

        const origLvl = cfg.heroOriginalLevel || 1;
        if (cfg.level > origLvl) {
          const deltaGrowth = this.getJobNaturalGrowth(cfg.jobName, 1 + (cfg.level - origLvl));
          hStr += deltaGrowth.str;
          hAgi += deltaGrowth.agi;
          hCon += deltaGrowth.con;
          hInt += deltaGrowth.int;
          hSpr += deltaGrowth.spr;
          hLuk += deltaGrowth.luk;
        } else if (cfg.level < origLvl) {
          const deltaLoss = this.getJobNaturalGrowth(cfg.jobName, 1 + (origLvl - cfg.level));
          hStr = Math.max(1, hStr - deltaLoss.str);
          hAgi = Math.max(1, hAgi - deltaLoss.agi);
          hCon = Math.max(1, hCon - deltaLoss.con);
          hInt = Math.max(1, hInt - deltaLoss.int);
          hSpr = Math.max(1, hSpr - deltaLoss.spr);
          hLuk = Math.max(1, hLuk - deltaLoss.luk);
        }

        adv.baseAttributes.str = hStr + cfg.allocatedStats.str;
        adv.baseAttributes.agi = hAgi + cfg.allocatedStats.agi;
        adv.baseAttributes.con = hCon + cfg.allocatedStats.con;
        adv.baseAttributes.int = hInt + cfg.allocatedStats.int;
        adv.baseAttributes.spr = hSpr + cfg.allocatedStats.spr;
        adv.baseAttributes.luk = hLuk + cfg.allocatedStats.luk;
      } else {
        const growth = this.getJobNaturalGrowth(cfg.jobName, cfg.level);
        adv.baseAttributes.str = baseAttr.str + growth.str + cfg.allocatedStats.str;
        adv.baseAttributes.agi = baseAttr.agi + growth.agi + cfg.allocatedStats.agi;
        adv.baseAttributes.con = baseAttr.con + growth.con + cfg.allocatedStats.con;
        adv.baseAttributes.int = baseAttr.int + growth.int + cfg.allocatedStats.int;
        adv.baseAttributes.spr = baseAttr.spr + growth.spr + cfg.allocatedStats.spr;
        adv.baseAttributes.luk = baseAttr.luk + growth.luk + cfg.allocatedStats.luk;
      }

      // 裝備配置：100% 直連 DataStore.EquipmentDB 真實裝備資料庫
      let weaponTpl: Equipment;
      const realWeaponTemplate = cfg.weaponTemplateId ? DataStore.EquipmentDB[cfg.weaponTemplateId] : null;
      if (realWeaponTemplate) {
        weaponTpl = EquipmentGenerator.generateFromTemplate(realWeaponTemplate);
        if (cfg.weaponEnhance) weaponTpl.enhancementLevel = cfg.weaponEnhance;
        if (cfg.weaponElement && cfg.weaponElement !== ElementType.NONE) weaponTpl.element = cfg.weaponElement;
      } else {
        // Fallback 基準武器：帶入標準武器補正 (Scaling)
        const baseWpnAtk = cfg.weaponTier * 15 + cfg.weaponEnhance * 4;
        const defaultScaling = EquipmentGenerator.generateEquipmentScaling({
          slot: EquipmentSlot.WEAPON,
          weaponType: cfg.weaponType,
          tier: cfg.weaponTier
        });
        weaponTpl = {
          id: `wpn_${cfg.id}`,
          name: `${cfg.weaponElement !== ElementType.NONE ? '[' + cfg.weaponElement + ']' : ''}${cfg.weaponType}`,
          slot: EquipmentSlot.WEAPON,
          tier: cfg.weaponTier,
          requirements: {},
          effects: {},
          combatEffects: {
            atk: baseWpnAtk,
            patk: baseWpnAtk,
            matk: baseWpnAtk
          },
          scaling: defaultScaling,
          enhancementLevel: cfg.weaponEnhance,
          weaponType: cfg.weaponType,
          element: cfg.weaponElement
        };
      }

      let armorTpl: Equipment;
      const realArmorTemplate = cfg.armorTemplateId ? DataStore.EquipmentDB[cfg.armorTemplateId] : null;
      if (realArmorTemplate) {
        armorTpl = EquipmentGenerator.generateFromTemplate(realArmorTemplate);
        if (cfg.armorEnhance) armorTpl.enhancementLevel = cfg.armorEnhance;
      } else {
        const baseDef = cfg.armorTier * 10 + cfg.armorEnhance * 3;
        const baseHp = cfg.armorTier * 30;
        armorTpl = {
          id: `arm_${cfg.id}`,
          name: '防具',
          slot: EquipmentSlot.ARMOR,
          tier: cfg.armorTier,
          requirements: {},
          effects: {},
          combatEffects: {
            pdef: baseDef,
            mdef: baseDef,
            hp: baseHp
          },
          enhancementLevel: cfg.armorEnhance,
          element: ElementType.NONE
        };
      }

      let accessoryTpl: Equipment | undefined = undefined;
      const realAccTemplate = cfg.accessoryId ? DataStore.EquipmentDB[cfg.accessoryId] : (cfg.accessoryType && cfg.accessoryType !== 'NONE' ? DataStore.EquipmentDB[cfg.accessoryType] : null);
      if (realAccTemplate) {
        accessoryTpl = EquipmentGenerator.generateFromTemplate(realAccTemplate);
      } else if (cfg.accessoryType && cfg.accessoryType !== 'NONE') {
        let accCombatEffects: any = {};
        if (cfg.accessoryType === 'RING_HP') accCombatEffects = { hp: 60 };
        else if (cfg.accessoryType === 'RING_MP') accCombatEffects = { mp: 30 };
        else if (cfg.accessoryType === 'BADGE_CRIT') accCombatEffects = { critRate: 10 };
        else if (cfg.accessoryType === 'AMULET_AGI') accCombatEffects = { hit: 15, evade: 15 };
        else if (cfg.accessoryType === 'CROSS_HOLY') accCombatEffects = { mdef: 15, hp: 40 };

        accessoryTpl = {
          id: `acc_${cfg.id}`,
          name: cfg.accessoryType,
          slot: EquipmentSlot.ACCESSORY,
          tier: 2,
          requirements: {},
          effects: {},
          combatEffects: accCombatEffects,
          element: ElementType.NONE
        };
      }

      adv.equipment = {
        [EquipmentSlot.WEAPON]: weaponTpl,
        [EquipmentSlot.ARMOR]: armorTpl,
        [EquipmentSlot.ACCESSORY]: accessoryTpl
      };

      // ✅ 技能解析：未滿 10 等或未轉職嚴格只能使用前 2 招基礎技能，滿等 10 級且轉職才解鎖第 3 招終極大招
      if (cfg.skills && cfg.skills.length > 0) {
        if (!adv.isAdvanced || adv.level < 10) {
          adv.customSkills = cfg.skills.slice(0, 2);
        } else {
          adv.customSkills = [...cfg.skills];
        }
      }

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
        inst.gridR = cfg.gridR;
        inst.gridC = cfg.gridC;
        if (cfg.formationRow) inst.formationRow = cfg.formationRow;
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
    this.renderFormationSelector();
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
            ${(() => {
              const wId = h.equipment?.weaponTemplateId;
              const wTpl = wId ? DataStore.EquipmentDB[wId] : null;
              const wName = wTpl ? wTpl.name : (wId || '無武器');
              const enhance = (h.equipment?.weaponEnhance ?? 0) > 0 ? `+${h.equipment.weaponEnhance}` : '+0';
              const elem = h.equipment?.weaponElement && h.equipment.weaponElement !== ElementType.NONE ? ` [${h.equipment.weaponElement}]` : '';
              return `⚔️ 裝備: ${wName} ${enhance}${elem}`;
            })()}
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
    const charKeyInput = byId<HTMLInputElement>('mc-character-key');
    const subIdInput = byId<HTMLInputElement>('mc-substitute-id');
    const captureRateInput = byId<HTMLInputElement>('mc-capture-rate');
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
      if (charKeyInput) charKeyInput.value = m.characterKey || '';
      if (subIdInput) subIdInput.value = m.substituteMonsterId || '';
      if (captureRateInput) captureRateInput.value = (m.captureRate !== undefined && m.captureRate !== null) ? String(m.captureRate) : '';
      if (raceSelect) raceSelect.value = m.race || 'MONSTER';
      if (elementSelect) elementSelect.value = m.defaultElement || 'NONE';
      if (powerTierInput) powerTierInput.value = String(m.powerTier || 1.0);
      if (attackTypeSelect) attackTypeSelect.value = m.attackType || (m.isMagicalAttacker ? 'MAGIC' : (m.id === 'crossbowman' ? 'RANGED' : 'MELEE'));

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
      if (charKeyInput) charKeyInput.value = '';
      if (subIdInput) subIdInput.value = '';
      if (captureRateInput) captureRateInput.value = '';
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
    this.saveMonsterDraft();
    const savingRevision = this.monsterDraftRevision;
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
        if (this.monsterDraftRevision === savingRevision) this.clearMonsterDraft();
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
        <option value="faction_siege">👑 洛斯加中央王室攻城部隊 (難度 5)</option>
        <option value="church_crusade">❄️ 北境 赫斯特神聖遠征軍 (難度 6)</option>
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
      if (this.strongholdFilterFaction !== 'ALL') {
        if (this.strongholdFilterFaction === 'NEUTRAL') {
          if (s.factionId && s.factionId !== 'NEUTRAL') return false;
        } else {
          if (s.factionId !== this.strongholdFilterFaction) return false;
        }
      }
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
      const allowTroopsBadge = s.allowTroops !== false
        ? '<span style="color: #38bdf8; background: rgba(56,189,248,0.15); padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">🛡️可帶兵</span>'
        : '<span style="color: #a78bfa; background: rgba(167,139,250,0.15); padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">⚔️純傭兵</span>';

      card.innerHTML = `
        <div style="width: 40px; height: 40px; min-width: 40px; border-radius: 6px; background: #0e121a; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center;">
          ${renderUniversalIcon(s.icon || 'icons_buildings:icons_buildings_3', 34)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; font-size: 0.85rem; color: ${isSelected ? 'var(--cs-gold-light)' : '#f8fafc'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.name}</span>
            <span class="cs-badge" style="font-size: 0.68rem; color: var(--cs-orange); background: rgba(249,115,22,0.15); flex-shrink: 0;">Lv.${s.difficulty}</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--cs-text-muted); margin-top: 2px; display: flex; justify-content: space-between; align-items: center;">
            <span>${s.terrain}</span>
            <div style="display: flex; gap: 4px; align-items: center;">
              ${allowTroopsBadge}
              <span>⚔️ ${waveCount}波 (${totalMonsters}隻)</span>
            </div>
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
    const factionSelect = byId<HTMLSelectElement>('sh-faction');
    const nodeLevelSelect = byId<HTMLSelectElement>('sh-node-level');
    const terrainSelect = byId<HTMLSelectElement>('sh-terrain');
    const diffSlider = byId<HTMLInputElement>('sh-difficulty');
    const diffDisplay = byId('sh-diff-display');
    const worldGenSelect = byId<HTMLSelectElement>('sh-world-gen-mode');
    const iconInput = byId<HTMLInputElement>('sh-icon');
    const allowTroopsCheckbox = byId<HTMLInputElement>('sh-allow-troops');
    const scoutingCheckbox = byId<HTMLInputElement>('sh-requires-scouting');
    const removeCheckbox = byId<HTMLInputElement>('sh-remove-on-victory');
    const fogRumorInput = byId<HTMLInputElement>('sh-fog-rumor');
    const revealRumorInput = byId<HTMLInputElement>('sh-reveal-rumor');
    const descTextarea = byId<HTMLTextAreaElement>('sh-description');

    const goldInput = byId<HTMLInputElement>('sh-reward-gold');
    const expInput = byId<HTMLInputElement>('sh-reward-exp');
    const prestigeInput = byId<HTMLInputElement>('sh-reward-prestige');

    if (idInput) idInput.value = sh.id;
    if (nameInput) nameInput.value = sh.name;
    if (factionSelect) factionSelect.value = sh.factionId || 'NEUTRAL';
    if (nodeLevelSelect) nodeLevelSelect.value = String(sh.nodeLevel ?? 0);
    if (terrainSelect) terrainSelect.value = sh.terrain || 'RUINS';
    if (diffSlider) diffSlider.value = String(sh.difficulty || 2);
    if (diffDisplay) diffDisplay.textContent = `Lv.${sh.difficulty || 2}`;
    if (worldGenSelect) worldGenSelect.value = sh.worldGenMode || (sh.isWorldSecret ? 'WORLD_SECRET' : 'PERMANENT_VISIBLE');
    if (iconInput) iconInput.value = sh.icon || 'icons_buildings:icons_buildings_3';
    const iconPreview = byId('sh-icon-preview');
    if (iconPreview) iconPreview.innerHTML = renderUniversalIcon(sh.icon || 'icons_buildings:icons_buildings_3', 32);
    if (allowTroopsCheckbox) allowTroopsCheckbox.checked = sh.allowTroops !== false;
    if (scoutingCheckbox) scoutingCheckbox.checked = !!sh.requiresScouting;
    if (removeCheckbox) removeCheckbox.checked = sh.removeOnVictory !== false;
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

    // 🏰 攻守戰役陣營接口與可控條件 (Siege Role & Engine Interface)
    const combatRoleSelect = byId<HTMLSelectElement>('sh-combat-role');
    const defPanel = byId('sh-defender-interface-panel');
    const atkPanel = byId('sh-attacker-interface-panel');

    const curRole = (sh as any).combatRole || CombatGroupRole.VERSATILE;
    if (combatRoleSelect) combatRoleSelect.value = curRole;

    if (defPanel) defPanel.style.display = (curRole === CombatGroupRole.VERSATILE || curRole === CombatGroupRole.DEFENDER_ONLY) ? 'flex' : 'none';
    if (atkPanel) atkPanel.style.display = (curRole === CombatGroupRole.VERSATILE || curRole === CombatGroupRole.ATTACKER_ONLY) ? 'flex' : 'none';

    // 防守方控制項
    const gateHpInput = byId<HTMLInputElement>('sh-gate-hp');
    const towerCountInput = byId<HTMLInputElement>('sh-watchtower-count');
    const towerDmgInput = byId<HTMLInputElement>('sh-watchtower-dmg');
    const rampartBonusInput = byId<HTMLInputElement>('sh-rampart-bonus');

    const defCfg = (sh as any).defenderConfig || { gateMaxHp: 3000, watchtowerCount: 1, watchtowerDmg: 50, rampartArrowBonusPct: 15 };
    if (gateHpInput) gateHpInput.value = String(defCfg.gateMaxHp ?? 3000);
    if (towerCountInput) towerCountInput.value = String(defCfg.watchtowerCount ?? 1);
    if (towerDmgInput) towerDmgInput.value = String(defCfg.watchtowerDmg ?? 50);
    if (rampartBonusInput) rampartBonusInput.value = String(defCfg.rampartArrowBonusPct ?? 15);

    // 進攻方控制項
    const ramCountInput = byId<HTMLInputElement>('sh-ram-count');
    const trebCountInput = byId<HTMLInputElement>('sh-treb-count');
    const stanceSelect = byId<HTMLSelectElement>('sh-tactical-stance');

    const atkCfg = (sh as any).attackerConfig || { ramCount: 1, trebuchetCount: 1, tacticalStance: 'GATE_FOCUS' };
    if (ramCountInput) ramCountInput.value = String(atkCfg.ramCount ?? 1);
    if (trebCountInput) trebCountInput.value = String(atkCfg.trebuchetCount ?? 1);
    if (stanceSelect) stanceSelect.value = atkCfg.tacticalStance || 'GATE_FOCUS';

    // 📦 市場貿易產銷配置（簡潔膠囊 + 彈窗挑選）
    const renderTradeBadges = (
      containerId: string,
      goodsIds: string[],
      key: 'producedGoods' | 'demandedGoods',
      badgeColor: string
    ) => {
      const container = byId(containerId);
      if (!container) return;
      container.innerHTML = '';

      if (!goodsIds || goodsIds.length === 0) {
        container.innerHTML = `<span style="font-size: 0.72rem; color: #64748b; font-style: italic;">（未指定特產，點擊上方按鈕挑選）</span>`;
        return;
      }

      goodsIds.forEach(id => {
        const mat = materialsJson.find(m => m.id === id);
        if (!mat) return;
        const badge = document.createElement('div');
        badge.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(255,255,255,0.06);
          border: 1px solid ${badgeColor};
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.74rem;
          color: #e2e8f0;
        `;
        badge.innerHTML = `
          <span>${renderUniversalIcon(mat.icon, 14)}</span>
          <span style="font-weight: 500;">${mat.name}</span>
          <span style="cursor: pointer; color: #ef4444; font-weight: bold; margin-left: 2px;" title="移除此物資">✕</span>
        `;
        const delBtn = badge.querySelector('span:last-child') as HTMLElement;
        delBtn.onclick = (e) => {
          e.stopPropagation();
          sh[key] = (sh[key] || []).filter(gId => gId !== id);
          this.saveStrongholdsToStorage();
          renderTradeBadges(containerId, sh[key] || [], key, badgeColor);
        };
        container.appendChild(badge);
      });
    };

    renderTradeBadges('sh-produced-goods-badges', sh.producedGoods || [], 'producedGoods', '#4ade80');
    renderTradeBadges('sh-demanded-goods-badges', sh.demandedGoods || [], 'demandedGoods', '#f59e0b');

    const btnPickProd = byId('btn-pick-produced-goods');
    if (btnPickProd) {
      btnPickProd.onclick = () => {
        this.openMaterialPicker(
          `🛒 選擇【${sh.name}】盛產／可買物資 (低價批發)`,
          sh.producedGoods || [],
          (newSelected) => {
            sh.producedGoods = newSelected;
            this.saveStrongholdsToStorage();
            renderTradeBadges('sh-produced-goods-badges', sh.producedGoods, 'producedGoods', '#4ade80');
          }
        );
      };
    }

    const btnPickDem = byId('btn-pick-demanded-goods');
    if (btnPickDem) {
      btnPickDem.onclick = () => {
        this.openMaterialPicker(
          `💰 選擇【${sh.name}】短缺／需求物資 (高價收購)`,
          sh.demandedGoods || [],
          (newSelected) => {
            sh.demandedGoods = newSelected;
            this.saveStrongholdsToStorage();
            renderTradeBadges('sh-demanded-goods-badges', sh.demandedGoods, 'demandedGoods', '#f59e0b');
          }
        );
      };
    }

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

      // 0. 渲染前確保本據點波次座標無重疊衝突
      this.normalizeStrongholdWaves(sh);

      // 1. 渲染 3x3 九宮格槽位
      const gridEl = waveCard.querySelector(`#sh-grid-${wIdx}`);
      if (gridEl) {
        // 構建 slot 映射表
        const slotMonsterMap: Record<string, { mRef: SubjugationWaveMonster; mIdx: number }> = {};
        (w.monsters || []).forEach((mRef, mIdx) => {
          const sId = mRef.slotId || `${mRef.gridR || 0}_${mRef.gridC || 0}`;
          slotMonsterMap[sId] = { mRef, mIdx };
        });

        // 渲染 3 行 3 列 (r: 0前排, 1中排, 2後排；c: 0上路, 1中路, 2下路)
        for (let c = 0; c < 3; c++) {
          for (let r = 0; r < 3; r++) {
            const slotId = `${r}_${c}`;
            const slotData = slotMonsterMap[slotId];
            const slotBox = document.createElement('div');
            slotBox.style.cssText = 'border-radius: 5px; border: 1px dashed rgba(255,255,255,0.15); display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; background: #121620; cursor: pointer; transition: all 0.2s; overflow: hidden; user-select: none;';
            slotBox.dataset.shSlot = slotId;
            slotBox.dataset.shWave = String(wIdx);

            if (slotData) {
              const { mRef, mIdx } = slotData;
              const mon = this.monstersDb.find(m => m.id === mRef.monsterId);
              const mName = mon?.name || mRef.monsterId;
              const mAvatar = mon?.avatarIcon || this.getMonsterAvatar(mRef.monsterId, mName);
              const tier = mRef.powerTier || mon?.powerTier || 1.0;

              slotBox.style.border = '1px solid rgba(239, 68, 68, 0.6)';
              slotBox.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(0, 0, 0, 0.5))';
              slotBox.setAttribute('draggable', 'true');
              slotBox.style.cursor = 'grab';

              slotBox.innerHTML = `
                <div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                  ${renderUniversalIcon(mAvatar, 32)}
                </div>
                <div style="font-size: 0.65rem; font-weight: bold; color: #fff; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; pointer-events: none;">${mName}</div>
                <div style="font-size: 0.58rem; color: #f59e0b; pointer-events: none;">${tier}x</div>
                <button type="button" data-sh-del-monster="${wIdx},${mIdx}" style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.8); color: #fff; border: none; border-radius: 50%; width: 14px; height: 14px; font-size: 9px; line-height: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 5;" title="移除怪物">✕</button>
              `;

              // 拖曳開始
              slotBox.ondragstart = (e) => {
                this.draggedShMonster = { waveIdx: wIdx, monsterIdx: mIdx, slotId };
                slotBox.style.opacity = '0.4';
                slotBox.style.cursor = 'grabbing';
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', slotId);
                }
              };

              slotBox.ondragend = () => {
                slotBox.style.opacity = '1';
                slotBox.style.cursor = 'grab';
                this.draggedShMonster = null;
              };

              slotBox.onclick = (e) => {
                if ((e.target as HTMLElement).tagName === 'BUTTON') return;
                this.openSubjugationMonsterConfig(wIdx, mIdx);
              };
            } else {
              // 空槽位
              slotBox.innerHTML = `
                <span style="font-size: 1rem; color: rgba(255,255,255,0.2); pointer-events: none;">＋</span>
                <span style="font-size: 0.6rem; color: rgba(255,255,255,0.3); pointer-events: none;">${r === 0 ? '前' : (r === 1 ? '中' : '後')}${c === 0 ? '上' : (c === 1 ? '中' : '下')}</span>
              `;
              slotBox.onmouseenter = () => { slotBox.style.borderColor = 'var(--cs-gold)'; slotBox.style.background = 'rgba(234,179,8,0.1)'; };
              slotBox.onmouseleave = () => { slotBox.style.borderColor = 'rgba(255,255,255,0.15)'; slotBox.style.background = '#121620'; };
              slotBox.onclick = () => {
                this.openSubjugationMonsterPicker(wIdx, slotId);
              };
            }

            // 拖曳放置目標處理 (所有槽位皆可接收 drop)
            slotBox.ondragover = (e) => {
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            };

            slotBox.ondragenter = (e) => {
              e.preventDefault();
              slotBox.style.borderColor = '#f59e0b';
              slotBox.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.5)';
              slotBox.style.transform = 'scale(1.04)';
            };

            slotBox.ondragleave = () => {
              slotBox.style.borderColor = slotData ? 'rgba(239, 68, 68, 0.6)' : 'rgba(255,255,255,0.15)';
              slotBox.style.boxShadow = 'none';
              slotBox.style.transform = 'scale(1)';
            };

            slotBox.ondrop = (e) => {
              e.preventDefault();
              slotBox.style.boxShadow = 'none';
              slotBox.style.transform = 'scale(1)';

              const src = this.draggedShMonster;
              if (!src || src.waveIdx !== wIdx) return;
              if (src.slotId === slotId) return;

              const activeSh = this.getActiveStronghold();
              const curMonsters = activeSh?.waves?.[wIdx]?.monsters;
              if (!curMonsters || !curMonsters[src.monsterIdx]) return;

              const srcMonster = curMonsters[src.monsterIdx];
              const targetMonster = curMonsters.find(m => (m.slotId || `${m.gridR}_${m.gridC}`) === slotId);

              const [tgtR, tgtC] = slotId.split('_').map(Number);

              if (targetMonster) {
                // 🔄 兩隻怪物站位雙向互換 (Swap)
                const [srcR, srcC] = src.slotId.split('_').map(Number);
                srcMonster.slotId = slotId;
                srcMonster.gridR = tgtR;
                srcMonster.gridC = tgtC;
                srcMonster.formationRow = tgtR === 0 ? FormationRow.FRONT : (tgtR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);

                targetMonster.slotId = src.slotId;
                targetMonster.gridR = srcR;
                targetMonster.gridC = srcC;
                targetMonster.formationRow = srcR === 0 ? FormationRow.FRONT : (srcR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
              } else {
                // ➡️ 移動至空槽位
                srcMonster.slotId = slotId;
                srcMonster.gridR = tgtR;
                srcMonster.gridC = tgtC;
                srcMonster.formationRow = tgtR === 0 ? FormationRow.FRONT : (tgtR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
              }

              this.draggedShMonster = null;
              this.saveStrongholdsToStorage();
              this.renderStrongholdForm();
              this.renderStrongholdAnalytics();
            };

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
            mCard.style.cssText = 'background: #141822; padding: 6px 8px; border-radius: 4px; border: 1px solid var(--cs-panel-border); display: flex; align-items: center; justify-content: space-between; gap: 6px; cursor: grab; user-select: none; transition: all 0.2s;';
            mCard.setAttribute('draggable', 'true');

            mCard.ondragstart = (e) => {
              this.draggedShMonster = { waveIdx: wIdx, monsterIdx: mIdx, slotId: mRef.slotId || `${mRef.gridR || 0}_${mRef.gridC || 0}` };
              mCard.style.opacity = '0.5';
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', mRef.slotId || '');
              }
            };
            mCard.ondragend = () => {
              mCard.style.opacity = '1';
              this.draggedShMonster = null;
            };

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
                <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 4px; background: #0c1017; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                  ${renderUniversalIcon(mAvatar, 28)}
                </div>
                <div style="min-width: 0; flex: 1; pointer-events: none;">
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

    const oldSlot = mRef.slotId || `${mRef.gridR || 0}_${mRef.gridC || 0}`;
    const [rStr, cStr] = formationSlotVal.split('_');
    const gridR = parseInt(rStr, 10) || 0;
    const gridC = parseInt(cStr, 10) || 0;

    // 若選取的新站位已被同波次的其他怪物佔用，自動將對方互換 (Swap) 至當前怪物的舊站位
    if (formationSlotVal !== oldSlot) {
      const curMonsters = sh?.waves?.[this.currentConfiguringWaveIdx]?.monsters || [];
      const occupiedOther = curMonsters.find((m, idx) => idx !== this.currentConfiguringMonsterIdx && (m.slotId || `${m.gridR}_${m.gridC}`) === formationSlotVal);
      if (occupiedOther) {
        const [oldR, oldC] = oldSlot.split('_').map(Number);
        occupiedOther.slotId = oldSlot;
        occupiedOther.gridR = oldR;
        occupiedOther.gridC = oldC;
        occupiedOther.formationRow = oldR === 0 ? FormationRow.FRONT : (oldR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
      }
    }

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
        let finalGridR = mRef.gridR;
        let finalGridC = mRef.gridC;
        if (finalGridR === undefined && mRef.slotId) {
          finalGridR = parseInt(mRef.slotId.split('_')[0], 10);
          finalGridC = parseInt(mRef.slotId.split('_')[1], 10);
        }

        waveUnits.push({
          monsterId: mRef.monsterId,
          name: mName,
          difficulty: finalDiff,
          element: mRef.element || mon?.defaultElement || ElementType.NONE,
          isUndead: mon?.race === MonsterRace.UNDEAD,
          avatarIcon: mon?.avatarIcon || this.getMonsterAvatar(mRef.monsterId, mName),
          affix: mRef.affix || (isBoss ? '👑[守將]' : undefined),
          formationRow: mRef.formationRow || (finalGridR === 0 ? FormationRow.FRONT : (finalGridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK)),
          gridR: finalGridR,
          gridC: finalGridC,
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
      worldGenMode: 'PERMANENT_VISIBLE',
      isWorldSecret: false,
      allowTroops: true,
      factionId: 'NEUTRAL',
      nodeLevel: 0,
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
      await this.loadStrongholds(true);
      this.renderStrongholdStudio();
      alert(`🔄 已成功從專案磁碟重新載入最新 ${this.strongholdsDb.length} 處討伐與攻城據點！`);
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

    byId<HTMLSelectElement>('sh-filter-faction')?.addEventListener('change', e => {
      this.strongholdFilterFaction = (e.target as HTMLSelectElement).value;
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
      const factionVal = byId<HTMLSelectElement>('sh-faction')?.value || undefined;
      const nodeLevelVal = Number(byId<HTMLSelectElement>('sh-node-level')?.value || 0);
      const terrainVal = byId<HTMLSelectElement>('sh-terrain')?.value as any;
      const diffVal = Number(byId<HTMLInputElement>('sh-difficulty')?.value || 2);
      const worldGenModeVal = (byId<HTMLSelectElement>('sh-world-gen-mode')?.value || 'PERMANENT_VISIBLE') as any;
      const iconVal = byId<HTMLInputElement>('sh-icon')?.value.trim();
      const allowTroopsVal = byId<HTMLInputElement>('sh-allow-troops')?.checked !== false;
      const scoutingVal = byId<HTMLInputElement>('sh-requires-scouting')?.checked;
      const removeVal = byId<HTMLInputElement>('sh-remove-on-victory')?.checked;
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
      sh.factionId = factionVal === 'NEUTRAL' ? undefined : factionVal;
      sh.nodeLevel = nodeLevelVal as any;
      if (terrainVal) sh.terrain = terrainVal;
      sh.difficulty = diffVal;
      sh.worldGenMode = worldGenModeVal;
      sh.isWorldSecret = worldGenModeVal === 'WORLD_SECRET';
      if (iconVal) sh.icon = iconVal;
      sh.allowTroops = allowTroopsVal;
      sh.requiresScouting = scoutingVal;
      sh.removeOnVictory = removeVal;
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

      // 🏰 攻守戰役陣營角色與接口配置同步
      const combatRoleVal = (byId<HTMLSelectElement>('sh-combat-role')?.value as CombatGroupRole) || CombatGroupRole.VERSATILE;
      const defPanel = byId('sh-defender-interface-panel');
      const atkPanel = byId('sh-attacker-interface-panel');
      if (defPanel) defPanel.style.display = (combatRoleVal === CombatGroupRole.VERSATILE || combatRoleVal === CombatGroupRole.DEFENDER_ONLY) ? 'flex' : 'none';
      if (atkPanel) atkPanel.style.display = (combatRoleVal === CombatGroupRole.VERSATILE || combatRoleVal === CombatGroupRole.ATTACKER_ONLY) ? 'flex' : 'none';

      (sh as any).combatRole = combatRoleVal;
      (sh as any).defenderConfig = {
        gateMaxHp: Number(byId<HTMLInputElement>('sh-gate-hp')?.value || 3000),
        watchtowerCount: Number(byId<HTMLInputElement>('sh-watchtower-count')?.value || 1),
        watchtowerDmg: Number(byId<HTMLInputElement>('sh-watchtower-dmg')?.value || 50),
        rampartArrowBonusPct: Number(byId<HTMLInputElement>('sh-rampart-bonus')?.value || 15)
      };
      (sh as any).attackerConfig = {
        ramCount: Number(byId<HTMLInputElement>('sh-ram-count')?.value || 1),
        trebuchetCount: Number(byId<HTMLInputElement>('sh-treb-count')?.value || 1),
        tacticalStance: byId<HTMLSelectElement>('sh-tactical-stance')?.value || 'GATE_FOCUS'
      };

      byId('sh-diff-display').textContent = `Lv.${diffVal}`;
      byId('sh-edit-badge').textContent = sh.id;
      byId('sh-edit-title').textContent = sh.name;

      this.saveStrongholdsToStorage();
      this.renderStrongholdList();
      this.renderStrongholdAnalytics();
    };

    ['sh-id', 'sh-name', 'sh-faction', 'sh-node-level', 'sh-terrain', 'sh-difficulty', 'sh-world-gen-mode', 'sh-icon', 'sh-allow-troops', 'sh-requires-scouting', 'sh-remove-on-victory', 'sh-fog-rumor', 'sh-reveal-rumor', 'sh-description', 'sh-reward-gold', 'sh-reward-exp', 'sh-reward-prestige', 'sh-enemy-legion-enable', 'sh-enemy-infantry', 'sh-enemy-archer', 'sh-enemy-cavalry', 'sh-combat-role', 'sh-gate-hp', 'sh-watchtower-count', 'sh-watchtower-dmg', 'sh-rampart-bonus', 'sh-ram-count', 'sh-treb-count', 'sh-tactical-stance']
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

    const isAdv = hero.level >= 10 ? (hero.isAdvanced !== false) : false;

    this.playerTeam[slotIdx] = {
      id: `p_${hero.id}_${Date.now()}`,
      name: `${hero.title}${hero.name}`,
      level: hero.level,
      quality: hero.quality,
      jobName: jobName,
      isAdvanced: isAdv,
      isUnique: !hero.isGuardian,
      avatarIcon: heroAvatar,
      weaponType: wpnType,
      weaponElement: hero.equipment.weaponElement || ElementType.NONE,
      weaponTier: 4,
      weaponEnhance: hero.equipment.weaponEnhance ?? 0,
      weaponTemplateId: hero.equipment.weaponTemplateId,
      armorTier: 4,
      armorEnhance: hero.equipment.armorEnhance ?? 0,
      armorTemplateId: hero.equipment.armorTemplateId,
      accessoryType: hero.equipment.accessoryId || 'NONE',
      accessoryId: hero.equipment.accessoryId,
      formationRow: slotIdx === 0 ? FormationRow.FRONT : FormationRow.FRONT,
      gender: hero.gender,
      isGuardian: hero.isGuardian,
      avatarIndex: hero.avatarIndex,
      skills: hero.customSkills ? [...hero.customSkills] : undefined,
      heroOriginalLevel: hero.level,
      customBaseAttributes: {
        str: hero.customAttributes.str,
        agi: hero.customAttributes.agi,
        con: hero.customAttributes.con,
        int: hero.customAttributes.int,
        spr: hero.customAttributes.spr,
        luk: hero.customAttributes.luk
      },
      allocatedStats: {
        str: 0,
        agi: 0,
        con: 0,
        int: 0,
        spr: 0,
        luk: 0
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

  // ── 取得技能工坊自訂技能 (優先 LocalStorage，次選專案磁碟 JSON) ──
  private getCustomSkillList(): any[] {
    try {
      const raw = localStorage.getItem('MEDIEVAL_CUSTOM_COMPOSITE_SKILLS');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    if (Array.isArray(customSkillsJson)) {
      return customSkillsJson;
    }
    return [];
  }

  private getCustomSkillById(id: string): any {
    return this.getCustomSkillList().find(s => s.id === id);
  }

  // ── 渲染英雄編輯器中的 3 個技能卡槽 (簡短 ICON + Tooltip 說明) ──
  private renderHeroSkillSlots(): void {
    const slotTitles = ['基礎技能 1', '基礎技能 2', '進階終極技能'];
    for (let i = 0; i < 3; i++) {
      const skillId = this.currentHeroEditingSkills[i];
      const sk = (SKILLS as Record<string, any>)[skillId] || this.getCustomSkillById(skillId);
      const slotEl = byId(`hc-skill-slot-${i}`);
      const iconEl = byId(`hc-skill-icon-${i}`);
      const nameEl = byId(`hc-skill-name-${i}`);
      const mpEl = byId(`hc-skill-mp-${i}`);

      if (sk) {
        if (iconEl) {
          if (sk.icon && sk.icon.includes(':')) {
            iconEl.innerHTML = renderUniversalIcon(sk.icon, 28);
          } else if (sk.icon) {
            iconEl.textContent = sk.icon;
          } else {
            iconEl.textContent = i === 2 ? '🌀' : (i === 1 ? '💥' : '🗡️');
          }
        }
        if (nameEl) nameEl.textContent = sk.name || skillId;
        const mpVal = sk.mpCost ?? sk.totalMpCost ?? sk.cost?.mpCost ?? 0;
        if (mpEl) mpEl.textContent = `${mpVal} MP`;
        if (slotEl) {
          slotEl.title = `【${sk.name || skillId}】 (${slotTitles[i]})\n消耗 MP: ${mpVal}\n說明: ${sk.description || '無詳細說明'}\n(點擊開啟技能庫更換)`;
        }
      } else {
        if (iconEl) iconEl.textContent = '❓';
        if (nameEl) nameEl.textContent = skillId || '(無技能)';
        if (mpEl) mpEl.textContent = '0 MP';
        if (slotEl) slotEl.title = `${slotTitles[i]} · 點擊設定技能`;
      }
    }
  }

  // ── 打開全視覺化技能挑選器 ──
  private openHeroSkillPicker(slotIdx: number): void {
    this.activeHeroSkillSlotIndex = slotIdx;
    const modal = byId('modal-hc-skill-picker');
    if (!modal) return;

    const titles = ['基礎技能 1', '基礎技能 2', '進階終極技能'];
    const titleEl = byId('hc-skill-picker-target-slot-title');
    if (titleEl) titleEl.textContent = titles[slotIdx] || `技能槽 ${slotIdx + 1}`;

    const searchInput = byId<HTMLInputElement>('inp-hc-skill-search');
    if (searchInput) {
      searchInput.value = '';
      this.skillPickerSearchQuery = '';
    }

    this.currentSkillPickerTab = 'ALL';
    const tabsContainer = byId('hc-skill-picker-tabs');
    if (tabsContainer) {
      tabsContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.skillTab === 'ALL');
        btn.classList.toggle('cs-btn-gold', btn.dataset.skillTab === 'ALL');
      });
    }

    this.renderHeroSkillPickerGrid();
    modal.style.display = 'flex';
  }

  // ── 渲染技能挑選器網格卡片 ──
  private renderHeroSkillPickerGrid(): void {
    const grid = byId('hc-skill-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const allSkillsList: { id: string; name: string; mpCost: number; description: string; icon?: string; jobCategory: string }[] = [];

    // 1. 官方全職業技能
    Object.entries(SKILLS as Record<string, any>).forEach(([id, sk]) => {
      let cat = 'OTHER';
      if (id.startsWith('FIGHTER_') || id.startsWith('GREATSWORD_') || id.startsWith('MAGIC_SWORDSMAN_')) cat = 'WARRIOR';
      else if (id.startsWith('KNIGHT_')) cat = 'KNIGHT';
      else if (id.startsWith('MAGE_') || id.startsWith('STAFF_') || id.startsWith('SCYTHE_')) cat = 'MAGE';
      else if (id.startsWith('ARCHER_') || id.startsWith('SNIPER_') || id.startsWith('SPIRIT_ARCHER_')) cat = 'ARCHER';
      else if (id.startsWith('THIEF_') || id.startsWith('ASSASSIN_') || id.startsWith('TRICKSTER_')) cat = 'THIEF';
      else if (id.startsWith('PRAYER_')) cat = 'PRAYER';

      allSkillsList.push({
        id,
        name: sk.name || id,
        mpCost: sk.mpCost ?? 0,
        description: sk.description || '',
        icon: sk.icon,
        jobCategory: cat
      });
    });

    // 2. 技能工坊自訂技能
    this.getCustomSkillList().forEach((cSk: any) => {
      allSkillsList.push({
        id: cSk.id,
        name: cSk.name || cSk.id,
        mpCost: cSk.mpCost ?? cSk.totalMpCost ?? (cSk.cost?.mpCost ?? 0),
        description: cSk.description || '工坊創作技能',
        icon: cSk.icon,
        jobCategory: 'CUSTOM'
      });
    });

    // 依 Tab 與搜尋過濾
    const q = this.skillPickerSearchQuery.toLowerCase();
    const filtered = allSkillsList.filter(sk => {
      if (this.currentSkillPickerTab !== 'ALL' && sk.jobCategory !== this.currentSkillPickerTab) {
        return false;
      }
      if (!q) return true;
      return sk.name.toLowerCase().includes(q) || sk.description.toLowerCase().includes(q) || sk.id.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--cs-text-muted); padding: 30px;">無符合條件的技能</div>';
      return;
    }

    filtered.forEach(sk => {
      const isSelected = this.currentHeroEditingSkills[this.activeHeroSkillSlotIndex] === sk.id;
      const card = document.createElement('div');
      card.style.cssText = `background: ${isSelected ? '#1c2538' : '#141822'}; border: 1px solid ${isSelected ? 'var(--cs-gold)' : 'var(--cs-panel-border)'}; border-radius: 6px; padding: 10px; cursor: pointer; transition: all 0.15s; display: flex; gap: 10px; align-items: flex-start;`;

      let iconHtml = '✨';
      if (sk.icon && sk.icon.includes(':')) {
        iconHtml = renderUniversalIcon(sk.icon, 36);
      } else if (sk.icon) {
        iconHtml = `<div style="font-size: 1.8rem; line-height: 1;">${sk.icon}</div>`;
      } else {
        iconHtml = `<div style="font-size: 1.8rem; line-height: 1;">⚡</div>`;
      }

      card.innerHTML = `
        <div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: #0d1117; border-radius: 4px; flex-shrink: 0;">
          ${iconHtml}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; font-size: 0.84rem; color: ${isSelected ? 'var(--cs-gold-light)' : '#f8fafc'};">${sk.name}</span>
            <span class="cs-badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; font-size: 0.7rem;">${sk.mpCost} MP</span>
          </div>
          <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px; line-height: 1.35;">${sk.description}</div>
        </div>
      `;

      card.onmouseenter = () => { if (!isSelected) card.style.borderColor = 'rgba(245, 158, 11, 0.6)'; };
      card.onmouseleave = () => { if (!isSelected) card.style.borderColor = 'var(--cs-panel-border)'; };
      card.onclick = () => {
        this.currentHeroEditingSkills[this.activeHeroSkillSlotIndex] = sk.id;
        this.renderHeroSkillSlots();
        byId('modal-hc-skill-picker').style.display = 'none';
      };

      grid.appendChild(card);
    });
  }

  // ── 更新英雄編輯器三格裝備視覺化卡片顯示 ──
  private updateHeroCreatorEquipmentDisplays(): void {
    const wId = byId<HTMLInputElement>('hc-wpn-template')?.value || '';
    const aId = byId<HTMLInputElement>('hc-arm-template')?.value || '';
    const accId = byId<HTMLInputElement>('hc-acc-template')?.value || '';

    const wItem = (equipmentWeaponsJson as any[]).find(i => i.id === wId);
    const aItem = (equipmentArmorsJson as any[]).find(i => i.id === aId);
    const accItem = (equipmentAccessoriesJson as any[]).find(i => i.id === accId);

    // 武器槽位
    const wIconEl = byId('hc-wpn-icon-preview');
    const wNameEl = byId('hc-wpn-name-display');
    const wBadgeEl = byId('hc-wpn-type-badge');
    const wSlotCard = byId('hc-wpn-slot-card');
    if (wItem) {
      if (wIconEl) wIconEl.innerHTML = renderEquipIcon(wItem, 36);
      if (wNameEl) wNameEl.textContent = `[T${wItem.tier || 1}] ${wItem.name}`;
      if (wBadgeEl) wBadgeEl.textContent = `T${wItem.tier || 1} ${wItem.weaponType}`;
      const patk = wItem.combatEffects?.patk ?? wItem.pAtk ?? 0;
      const matk = wItem.combatEffects?.matk ?? wItem.mAtk ?? 0;
      if (wSlotCard) wSlotCard.title = `【${wItem.name}】(T${wItem.tier || 1})\n物攻: +${patk} 魔攻: +${matk}\n(點擊開啟武器庫挑選)`;
    } else {
      if (wIconEl) wIconEl.innerHTML = '<span style="font-size: 1.5rem;">⚔️</span>';
      if (wNameEl) wNameEl.textContent = '(空手 / 無武器)';
      if (wBadgeEl) wBadgeEl.textContent = 'WEAPON';
      if (wSlotCard) wSlotCard.title = '未穿戴主手武器 (點擊開啟武器庫挑選)';
    }

    // 防具槽位
    const aIconEl = byId('hc-arm-icon-preview');
    const aNameEl = byId('hc-arm-name-display');
    const aBadgeEl = byId('hc-arm-type-badge');
    const aSlotCard = byId('hc-arm-slot-card');
    if (aItem) {
      if (aIconEl) aIconEl.innerHTML = renderEquipIcon(aItem, 36);
      if (aNameEl) aNameEl.textContent = `[T${aItem.tier || 1}] ${aItem.name}`;
      if (aBadgeEl) aBadgeEl.textContent = `T${aItem.tier || 1} ${aItem.armorType || 'ARMOR'}`;
      const pdef = aItem.combatEffects?.pdef ?? aItem.pDef ?? 0;
      const mdef = aItem.combatEffects?.mdef ?? aItem.mDef ?? 0;
      if (aSlotCard) aSlotCard.title = `【${aItem.name}】(T${aItem.tier || 1})\n物防: +${pdef} 魔防: +${mdef}\n(點擊開啟防具庫挑選)`;
    } else {
      if (aIconEl) aIconEl.innerHTML = '<span style="font-size: 1.5rem;">🛡️</span>';
      if (aNameEl) aNameEl.textContent = '(無防具)';
      if (aBadgeEl) aBadgeEl.textContent = 'ARMOR';
      if (aSlotCard) aSlotCard.title = '未穿戴身體防具 (點擊開啟防具庫挑選)';
    }

    // 飾品槽位
    const accIconEl = byId('hc-acc-icon-preview');
    const accNameEl = byId('hc-acc-name-display');
    const accSlotCard = byId('hc-acc-slot-card');
    if (accItem) {
      if (accIconEl) accIconEl.innerHTML = renderEquipIcon(accItem, 36);
      if (accNameEl) accNameEl.textContent = `${accItem.name}`;
      if (accSlotCard) accSlotCard.title = `【${accItem.name}】\n${accItem.description || '專屬飾品'}\n(點擊開啟飾品庫挑選)`;
    } else {
      if (accIconEl) accIconEl.innerHTML = '<span style="font-size: 1.5rem;">💍</span>';
      if (accNameEl) accNameEl.textContent = '(無飾品)';
      if (accSlotCard) accSlotCard.title = '未配戴飾品 (點擊開啟飾品庫挑選)';
    }
  }

  public static readonly JOB_ALLOWED_WEAPON_TYPES: Record<string, string[]> = {
    WARRIOR: ['GREATSWORD', 'DUAL_SWORDS'],
    KNIGHT: ['SWORD_AND_SHIELD', 'RUNE_SHIELD'],
    MAGE: ['STAFF', 'SCYTHE'],
    ARCHER: ['BOW', 'MAGIC_BOW'],
    THIEF: ['DAGGERS', 'MAGIC_RING'],
    PRAYER: ['HOLY_BOOK', 'HAMMER']
  };

  public static readonly JOB_ALLOWED_ARMOR_TYPES: Record<string, string[]> = {
    WARRIOR: ['HEAVY', 'PLATE'],
    KNIGHT: ['HEAVY', 'PLATE'],
    MAGE: ['CLOTH', 'ROBE'],
    ARCHER: ['LEATHER', 'LIGHT', 'MEDIUM'],
    THIEF: ['LEATHER', 'LIGHT', 'MEDIUM'],
    PRAYER: ['CLOTH', 'ROBE']
  };

  public static readonly JOB_DEFAULT_EQUIPMENT: Record<string, { weapon: string; armor: string; accessory: string }> = {
    WARRIOR: { weapon: 'wpn_T1_greatsword_0001', armor: 'arm_heavy_t1', accessory: 'acc_ring_hp' },
    KNIGHT: { weapon: 'wpn_T1_sword_shield_0001', armor: 'arm_heavy_t1', accessory: 'acc_ring_hp' },
    MAGE: { weapon: 'wpn_T1_staff_0001', armor: 'arm_cloth_t1', accessory: 'acc_ring_mp' },
    ARCHER: { weapon: 'wpn_T1_bow_0001', armor: 'arm_leather_t1', accessory: 'acc_badge_crit' },
    THIEF: { weapon: 'wpn_T1_daggers_0001', armor: 'arm_leather_t1', accessory: 'acc_amulet_agi' },
    PRAYER: { weapon: 'wpn_T1_holy_book_0001', armor: 'arm_cloth_t1', accessory: 'acc_cross_holy' }
  };

  // ── 打開全視覺化裝備挑選器 (Hero Equipment Picker) ──
  private openHeroEquipmentPicker(slotType: 'WEAPON' | 'ARMOR' | 'ACCESSORY'): void {
    this.activeHeroEquipSlotType = slotType;
    const modal = byId('modal-hc-equip-picker');
    if (!modal) return;

    const curJob = byId<HTMLSelectElement>('hc-job')?.value || 'WARRIOR';
    const jobNames: Record<string, string> = {
      WARRIOR: '⚔️ 戰士',
      KNIGHT: '🛡️ 騎士',
      MAGE: '🔮 法師',
      ARCHER: '🏹 弓箭手',
      THIEF: '🗡️ 盜賊',
      PRAYER: '📖 祈禱者'
    };
    const curJobName = jobNames[curJob] || curJob;

    const titleEl = byId('hc-equip-picker-title');
    if (titleEl) {
      titleEl.textContent = slotType === 'WEAPON' 
        ? `⚔️ 挑選主手武器 (${curJobName} 專用裝備庫)` 
        : (slotType === 'ARMOR' ? `🛡️ 挑選身體防具 (${curJobName} 專用防具庫)` : '💍 挑選專屬飾品 (全視覺化飾品庫)');
    }

    const searchInput = byId<HTMLInputElement>('inp-hc-equip-search');
    if (searchInput) {
      searchInput.value = '';
      this.equipPickerSearchQuery = '';
    }

    this.equipPickerTierFilter = 'ALL';
    const tabsContainer = byId('hc-equip-picker-tabs');
    if (tabsContainer) {
      tabsContainer.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.equipTier === 'ALL');
        btn.classList.toggle('cs-btn-gold', btn.dataset.equipTier === 'ALL');
      });
    }

    this.renderHeroEquipmentPickerGrid();
    modal.style.display = 'flex';
  }

  // ── 渲染裝備挑選器網格卡片 ──
  private renderHeroEquipmentPickerGrid(): void {
    const grid = byId('hc-equip-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const slotType = this.activeHeroEquipSlotType;
    let sourceList: any[] = [];
    let curEquippedId = '';

    if (slotType === 'WEAPON') {
      sourceList = equipmentWeaponsJson as any[];
      curEquippedId = byId<HTMLInputElement>('hc-wpn-template')?.value || '';
    } else if (slotType === 'ARMOR') {
      sourceList = equipmentArmorsJson as any[];
      curEquippedId = byId<HTMLInputElement>('hc-arm-template')?.value || '';
    } else {
      sourceList = equipmentAccessoriesJson as any[];
      curEquippedId = byId<HTMLInputElement>('hc-acc-template')?.value || '';
    }

    const curJob = byId<HTMLSelectElement>('hc-job')?.value || 'WARRIOR';
    const allowedWeapons = CombatStudioController.JOB_ALLOWED_WEAPON_TYPES[curJob] || [];
    const allowedArmors = CombatStudioController.JOB_ALLOWED_ARMOR_TYPES[curJob] || [];

    const q = this.equipPickerSearchQuery.toLowerCase();
    const filtered = sourceList.filter(item => {
      // 職業限制防呆過濾
      if (slotType === 'WEAPON' && item.weaponType) {
        if (!allowedWeapons.includes(item.weaponType.toUpperCase())) return false;
      }
      if (slotType === 'ARMOR' && item.armorType) {
        if (!allowedArmors.includes(item.armorType.toUpperCase())) return false;
      }

      if (this.equipPickerTierFilter !== 'ALL') {
        const t = String(item.tier || 1);
        if (t !== this.equipPickerTierFilter) return false;
      }
      if (!q) return true;
      const matchName = (item.name || '').toLowerCase().includes(q);
      const matchId = (item.id || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchType = (item.weaponType || item.armorType || '').toLowerCase().includes(q);
      return matchName || matchId || matchDesc || matchType;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--cs-text-muted); padding: 40px;">無符合該職業與條件的裝備品項</div>';
      return;
    }

    filtered.forEach(item => {
      const isSelected = curEquippedId === item.id;
      const tier = item.tier || 1;
      const tierColor = tier === 4 ? '#ef4444' : (tier === 3 ? '#f59e0b' : (tier === 2 ? '#3b82f6' : '#94a3b8'));
      const card = document.createElement('div');
      card.style.cssText = `
        background: ${isSelected ? '#1c2538' : '#141822'};
        border: 1.5px solid ${isSelected ? 'var(--cs-gold)' : 'var(--cs-panel-border)'};
        border-radius: 6px;
        padding: 8px 10px;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        gap: 10px;
        align-items: center;
        box-shadow: ${isSelected ? '0 0 10px rgba(245, 158, 11, 0.3)' : 'none'};
      `;

      let statInfo = '';
      if (slotType === 'WEAPON') {
        const patk = item.combatEffects?.patk ?? item.pAtk ?? 0;
        const matk = item.combatEffects?.matk ?? item.mAtk ?? 0;
        statInfo = `物攻 +${patk} · 魔攻 +${matk}`;
      } else if (slotType === 'ARMOR') {
        const pdef = item.combatEffects?.pdef ?? item.pDef ?? 0;
        const mdef = item.combatEffects?.mdef ?? item.mDef ?? 0;
        statInfo = `物防 +${pdef} · 魔防 +${mdef}`;
      } else {
        const effs: string[] = [];
        if (item.baseEffects) {
          Object.entries(item.baseEffects).forEach(([k, v]) => effs.push(`${k.toUpperCase()} +${v}`));
        }
        if (item.combatEffects) {
          if (item.combatEffects.patk) effs.push(`物攻 +${item.combatEffects.patk}`);
          if (item.combatEffects.matk) effs.push(`魔攻 +${item.combatEffects.matk}`);
          if (item.combatEffects.pdef) effs.push(`物防 +${item.combatEffects.pdef}`);
          if (item.combatEffects.mdef) effs.push(`魔防 +${item.combatEffects.mdef}`);
          if (item.combatEffects.hp) effs.push(`生命 +${item.combatEffects.hp}`);
          if (item.combatEffects.mp) effs.push(`法力 +${item.combatEffects.mp}`);
        }
        statInfo = effs.length > 0 ? effs.join(' · ') : (item.description || '專屬飾品');
      }

      card.innerHTML = `
        <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          ${renderEquipIcon(item, 40)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <span style="font-weight: bold; font-size: 0.82rem; color: ${isSelected ? 'var(--cs-gold-light)' : '#f8fafc'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</span>
            <span class="cs-badge" style="background: ${tierColor}22; color: ${tierColor}; border: 1px solid ${tierColor}; font-size: 0.65rem; padding: 0 4px;">T${tier}</span>
          </div>
          <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${statInfo}</div>
        </div>
        ${isSelected ? '<span style="color: #4ade80; font-weight: bold; font-size: 0.85rem;">✓</span>' : ''}
      `;

      card.onmouseenter = () => { if (!isSelected) card.style.borderColor = 'rgba(245, 158, 11, 0.6)'; };
      card.onmouseleave = () => { if (!isSelected) card.style.borderColor = 'var(--cs-panel-border)'; };
      card.onclick = () => {
        if (slotType === 'WEAPON') {
          const wInput = byId<HTMLInputElement>('hc-wpn-template');
          if (wInput) wInput.value = item.id;
        } else if (slotType === 'ARMOR') {
          const aInput = byId<HTMLInputElement>('hc-arm-template');
          if (aInput) aInput.value = item.id;
        } else {
          const accInput = byId<HTMLInputElement>('hc-acc-template');
          if (accInput) accInput.value = item.id;
        }
        this.updateHeroCreatorEquipmentDisplays();
        byId('modal-hc-equip-picker').style.display = 'none';
      };

      grid.appendChild(card);
    });
  }

  // ── 英雄創造器彈窗邏輯 ──
  private openHeroCreator(heroDef?: UniqueHeroDef): void {
    const modal = byId('modal-hero-creator');
    if (!modal) return;

    const titleEl = byId('hero-creator-title');
    const editIdInput = byId<HTMLInputElement>('hc-edit-id');
    const titleInput = byId<HTMLInputElement>('hc-title');
    const nameInput = byId<HTMLInputElement>('hc-name');
    const charKeyInput = byId<HTMLInputElement>('hc-character-key');
    const boundMonsterInput = byId<HTMLInputElement>('hc-bound-monster-id');
    const captureRateInput = byId<HTMLInputElement>('hc-capture-rate');
    const qualitySelect = byId<HTMLSelectElement>('hc-quality');
    const genderSelect = byId<HTMLSelectElement>('hc-gender');
    const jobSelect = byId<HTMLSelectElement>('hc-job');
    const levelInput = byId<HTMLInputElement>('hc-level');
    const isAdvSelect = byId<HTMLSelectElement>('hc-is-advanced');
    const isAdvHint = byId('hc-is-advanced-hint');
    const traitSelect = byId<HTMLSelectElement>('hc-trait');

    const strInput = byId<HTMLInputElement>('hc-str');
    const agiInput = byId<HTMLInputElement>('hc-agi');
    const conInput = byId<HTMLInputElement>('hc-con');
    const intInput = byId<HTMLInputElement>('hc-int');
    const sprInput = byId<HTMLInputElement>('hc-spr');
    const lukInput = byId<HTMLInputElement>('hc-luk');
    const totalStatsEl = byId('hc-total-stats');
    const diffHintEl = byId('hc-stats-diff-hint');

    const wpnTemplateInput = byId<HTMLInputElement>('hc-wpn-template');
    const wpnElementSelect = byId<HTMLSelectElement>('hc-weapon-element');
    const wpnEnhanceInput = byId<HTMLInputElement>('hc-weapon-enhance');
    const armTemplateInput = byId<HTMLInputElement>('hc-arm-template');
    const armEnhanceInput = byId<HTMLInputElement>('hc-armor-enhance');
    const accTemplateInput = byId<HTMLInputElement>('hc-acc-template');
    const bioTextarea = byId<HTMLTextAreaElement>('hc-biography');

    const avatarPreview = byId('hc-avatar-preview');
    const customIconInput = byId<HTMLInputElement>('hc-avatar-icon-custom');

    // 六維屬性總計即時連動與各品級在當前等級的動態標準高亮
    const updateTotalStats = () => {
      const str = Number(strInput?.value) || 0;
      const agi = Number(agiInput?.value) || 0;
      const con = Number(conInput?.value) || 0;
      const int = Number(intInput?.value) || 0;
      const spr = Number(sprInput?.value) || 0;
      const luk = Number(lukInput?.value) || 0;
      const total = str + agi + con + int + spr + luk;
      if (totalStatsEl) totalStatsEl.textContent = String(total);

      const lvl = Math.max(1, Math.min(10, parseInt(levelInput?.value || '10', 10) || 10));
      const q = qualitySelect?.value || 'SSR';
      const baseStdPoints: Record<string, number> = { N: 45, R: 60, SR: 72, SSR: 88, UR: 110 };
      const levelGrowth = (lvl - 1) * 6;
      const targetStd = (baseStdPoints[q] || 88) + levelGrowth;

      ['n', 'r', 'sr', 'ssr', 'ur'].forEach(k => {
        const el = byId(`ref-q-${k}`);
        if (el) {
          const uKey = k.toUpperCase();
          const curVal = (baseStdPoints[uKey] || 45) + levelGrowth;
          el.textContent = `${uKey}:${curVal}`;
          const isCur = uKey === q;
          el.style.fontWeight = isCur ? 'bold' : 'normal';
          el.style.textDecoration = isCur ? 'underline' : 'none';
          el.style.padding = isCur ? '1px 4px' : '0';
          el.style.background = isCur ? 'rgba(255, 255, 255, 0.15)' : 'transparent';
          el.style.borderRadius = '3px';
        }
      });

      if (diffHintEl) {
        const diff = total - targetStd;
        if (diff === 0) {
          diffHintEl.textContent = `(✅ 符合 Lv.${lvl} ${q} 標準 ${targetStd} 點)`;
          diffHintEl.style.color = '#10b981';
        } else if (diff > 0) {
          diffHintEl.textContent = `(+${diff} 高於 Lv.${lvl} ${q} 標準 ${targetStd} 點)`;
          diffHintEl.style.color = '#f59e0b';
        } else {
          diffHintEl.textContent = `(${diff} 低於 Lv.${lvl} ${q} 標準 ${targetStd} 點)`;
          diffHintEl.style.color = '#ef4444';
        }
      }
    };

    // 一鍵自動依職業與等級填入標準六維
    const autoFillBtn = byId('btn-hc-auto-fill-stats');
    if (autoFillBtn) {
      autoFillBtn.onclick = () => {
        const lvl = Math.max(1, Math.min(10, parseInt(levelInput?.value || '10', 10) || 10));
        const q = (qualitySelect?.value || 'SSR') as Quality;
        const jobKey = jobSelect?.value || 'WARRIOR';
        const jobNameMap: Record<string, string> = {
          WARRIOR: '戰士',
          KNIGHT: '騎士',
          MAGE: '法師',
          ARCHER: '弓箭手',
          THIEF: '盜賊',
          PRAYER: '祈禱者'
        };
        const jName = jobNameMap[jobKey] || '戰士';
        const base = this.getJobBaseAttributes(jName, q);
        const growth = this.getJobNaturalGrowth(jName, lvl);
        if (strInput) strInput.value = String(base.str + growth.str);
        if (agiInput) agiInput.value = String(base.agi + growth.agi);
        if (conInput) conInput.value = String(base.con + growth.con);
        if (intInput) intInput.value = String(base.int + growth.int);
        if (sprInput) sprInput.value = String(base.spr + growth.spr);
        if (lukInput) lukInput.value = String(base.luk + growth.luk);
        updateTotalStats();
      };
    }

    [strInput, agiInput, conInput, intInput, sprInput, lukInput].forEach(ipt => {
      if (ipt) ipt.oninput = updateTotalStats;
    });
    if (qualitySelect) qualitySelect.onchange = updateTotalStats;

    // 等級與進階狀態連動防呆
    const updateLevelAndAdvancement = () => {
      const lvl = Math.max(1, Math.min(10, parseInt(levelInput?.value || '10', 10) || 10));
      if (levelInput) levelInput.value = String(lvl);

      if (lvl < 10) {
        if (isAdvSelect) {
          isAdvSelect.value = 'false';
          isAdvSelect.disabled = true;
          isAdvSelect.style.opacity = '0.5';
        }
        if (isAdvHint) isAdvHint.style.display = 'block';
      } else {
        if (isAdvSelect) {
          isAdvSelect.disabled = false;
          isAdvSelect.style.opacity = '1';
        }
        if (isAdvHint) isAdvHint.style.display = 'none';
      }
    };
    if (levelInput) {
      levelInput.oninput = updateLevelAndAdvancement;
      levelInput.onchange = updateLevelAndAdvancement;
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

    // 職業變更時自動連動預設 3 招技能與職業裝備相容性防呆校驗
    if (jobSelect) {
      jobSelect.onchange = () => {
        const curJob = jobSelect.value;
        const defaultSkills = this.DEFAULT_JOB_SKILLS[curJob] || this.DEFAULT_JOB_SKILLS.WARRIOR;
        this.currentHeroEditingSkills = [...defaultSkills];
        this.renderHeroSkillSlots();

        // 職業裝備防呆：若當前已配備的武器/防具與新職業不相容，自動修正為該職業的標準裝備
        const allowedWpns = CombatStudioController.JOB_ALLOWED_WEAPON_TYPES[curJob] || [];
        const allowedArms = CombatStudioController.JOB_ALLOWED_ARMOR_TYPES[curJob] || [];
        const defaultEq = CombatStudioController.JOB_DEFAULT_EQUIPMENT[curJob] || CombatStudioController.JOB_DEFAULT_EQUIPMENT.WARRIOR;

        const curWpnId = wpnTemplateInput?.value || '';
        const curWpnDef = (equipmentWeaponsJson as any[]).find(w => w.id === curWpnId);
        if (curWpnDef && curWpnDef.weaponType && !allowedWpns.includes(curWpnDef.weaponType.toUpperCase())) {
          if (wpnTemplateInput) wpnTemplateInput.value = defaultEq.weapon;
        }

        const curArmId = armTemplateInput?.value || '';
        const curArmDef = (equipmentArmorsJson as any[]).find(a => a.id === curArmId);
        if (curArmDef && curArmDef.armorType && !allowedArms.includes(curArmDef.armorType.toUpperCase())) {
          if (armTemplateInput) armTemplateInput.value = defaultEq.armor;
        }

        this.updateHeroCreatorEquipmentDisplays();
      };
    }

    if (heroDef) {
      if (titleEl) titleEl.textContent = `✏️ 編輯英雄【${heroDef.name}】`;
      if (editIdInput) editIdInput.value = heroDef.id;
      if (titleInput) titleInput.value = heroDef.title;
      if (nameInput) nameInput.value = heroDef.name;
      if (charKeyInput) charKeyInput.value = heroDef.characterKey || '';
      if (boundMonsterInput) boundMonsterInput.value = heroDef.boundMonsterId || '';
      if (captureRateInput) captureRateInput.value = (heroDef.captureRate !== undefined && heroDef.captureRate !== null) ? String(heroDef.captureRate) : '';
      if (qualitySelect) qualitySelect.value = heroDef.quality;
      if (genderSelect) genderSelect.value = heroDef.gender;
      if (jobSelect) jobSelect.value = heroDef.jobKey;
      if (levelInput) levelInput.value = String(heroDef.level || 10);
      if (isAdvSelect) isAdvSelect.value = (heroDef.isAdvanced !== false && (heroDef.level || 10) >= 10) ? 'true' : 'false';
      if (traitSelect) traitSelect.value = heroDef.traitKey || 'BRAVE';

      // 技能
      if (heroDef.customSkills && heroDef.customSkills.length > 0) {
        this.currentHeroEditingSkills = [...heroDef.customSkills];
      } else {
        const defaultSkills = this.DEFAULT_JOB_SKILLS[heroDef.jobKey] || this.DEFAULT_JOB_SKILLS.WARRIOR;
        this.currentHeroEditingSkills = [...defaultSkills];
      }
      this.renderHeroSkillSlots();

      const curIcon = heroDef.avatarIcon || (heroDef.id.includes('reyn') ? 'heroes:reyn' : (heroDef.id.includes('luna') ? 'heroes:luna' : (heroDef.gender === Gender.FEMALE ? 'avatars_female:female_0' : 'avatars_male:male_0')));
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

      if (wpnTemplateInput) wpnTemplateInput.value = heroDef.equipment.weaponTemplateId || '';
      if (wpnElementSelect) wpnElementSelect.value = heroDef.equipment.weaponElement || 'NONE';
      if (wpnEnhanceInput) wpnEnhanceInput.value = String(heroDef.equipment.weaponEnhance ?? 0);
      if (armTemplateInput) armTemplateInput.value = heroDef.equipment.armorTemplateId || '';
      if (armEnhanceInput) armEnhanceInput.value = String(heroDef.equipment.armorEnhance ?? 0);
      if (accTemplateInput) accTemplateInput.value = heroDef.equipment.accessoryId || '';
      if (bioTextarea) bioTextarea.value = heroDef.biography;
    } else {
      if (titleEl) titleEl.textContent = '👑 創造全新自訂英雄';
      if (editIdInput) editIdInput.value = `custom_hero_${Date.now()}`;
      if (titleInput) titleInput.value = '【傳奇勇士】';
      if (nameInput) nameInput.value = '';
      if (charKeyInput) charKeyInput.value = '';
      if (boundMonsterInput) boundMonsterInput.value = '';
      if (captureRateInput) captureRateInput.value = '';
      if (qualitySelect) qualitySelect.value = 'SSR';
      if (genderSelect) genderSelect.value = Gender.MALE;
      if (jobSelect) jobSelect.value = 'WARRIOR';
      if (levelInput) levelInput.value = '10';
      if (isAdvSelect) isAdvSelect.value = 'true';
      if (traitSelect) traitSelect.value = 'BRAVE';

      // 技能預設
      this.currentHeroEditingSkills = [...this.DEFAULT_JOB_SKILLS.WARRIOR];
      this.renderHeroSkillSlots();

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

      if (wpnTemplateInput) wpnTemplateInput.value = 'wpn_meteoric_greatsword';
      if (wpnElementSelect) wpnElementSelect.value = 'NONE';
      if (wpnEnhanceInput) wpnEnhanceInput.value = '7';
      if (armTemplateInput) armTemplateInput.value = 'arm_heavy_t4';
      if (armEnhanceInput) armEnhanceInput.value = '7';
      if (accTemplateInput) accTemplateInput.value = '';
      if (bioTextarea) bioTextarea.value = '';
    }

    updateLevelAndAdvancement();
    this.updateHeroCreatorEquipmentDisplays();
    updateTotalStats();
    modal.style.display = 'flex';
  }

  private async saveHeroCreator(): Promise<void> {
    const editIdInput = byId<HTMLInputElement>('hc-edit-id');
    const titleInput = byId<HTMLInputElement>('hc-title');
    const nameInput = byId<HTMLInputElement>('hc-name');
    const charKeyInput = byId<HTMLInputElement>('hc-character-key');
    const boundMonsterInput = byId<HTMLInputElement>('hc-bound-monster-id');
    const qualitySelect = byId<HTMLSelectElement>('hc-quality');
    const genderSelect = byId<HTMLSelectElement>('hc-gender');
    const jobSelect = byId<HTMLSelectElement>('hc-job');
    const levelInput = byId<HTMLInputElement>('hc-level');
    const isAdvSelect = byId<HTMLSelectElement>('hc-is-advanced');
    const traitSelect = byId<HTMLSelectElement>('hc-trait');
    const customIconInput = byId<HTMLInputElement>('hc-avatar-icon-custom');
    const avatarPreview = byId('hc-avatar-preview');

    const strInput = byId<HTMLInputElement>('hc-str');
    const agiInput = byId<HTMLInputElement>('hc-agi');
    const conInput = byId<HTMLInputElement>('hc-con');
    const intInput = byId<HTMLInputElement>('hc-int');
    const sprInput = byId<HTMLInputElement>('hc-spr');
    const lukInput = byId<HTMLInputElement>('hc-luk');

    const wpnTemplateInput = byId<HTMLInputElement>('hc-wpn-template');
    const wpnElementSelect = byId<HTMLSelectElement>('hc-weapon-element');
    const wpnEnhanceInput = byId<HTMLInputElement>('hc-weapon-enhance');
    const armTemplateInput = byId<HTMLInputElement>('hc-arm-template');
    const armEnhanceInput = byId<HTMLInputElement>('hc-armor-enhance');
    const accTemplateInput = byId<HTMLInputElement>('hc-acc-template');
    const bioTextarea = byId<HTMLTextAreaElement>('hc-biography');

    const id = editIdInput ? editIdInput.value.trim() : `custom_hero_${Date.now()}`;
    const name = nameInput ? nameInput.value.trim() : '';
    const title = titleInput ? titleInput.value.trim() : '';
    const characterKey = charKeyInput ? charKeyInput.value.trim() || undefined : undefined;
    const boundMonsterId = boundMonsterInput ? boundMonsterInput.value.trim() || undefined : undefined;
    const rawCaptureRate = (byId('hc-capture-rate') as HTMLInputElement)?.value?.trim();
    const captureRate = rawCaptureRate !== '' && !isNaN(Number(rawCaptureRate)) ? Number(rawCaptureRate) : undefined;
    const avatarIcon = customIconInput?.value.trim() || avatarPreview?.dataset?.iconVal || undefined;

    if (!name) {
      alert('請填寫英雄名稱！');
      return;
    }

    const jobKey = jobSelect ? jobSelect.value : 'WARRIOR';
    const traitKey = traitSelect ? traitSelect.value : 'BRAVE';
    const isGuardian = traitKey.startsWith('GUARDIAN_');
    const level = Math.max(1, Math.min(10, Number(levelInput?.value) || 10));
    const isAdvanced = level >= 10 ? (isAdvSelect?.value === 'true') : false;

    const heroDef: UniqueHeroDef = {
      id,
      name,
      title,
      quality: (qualitySelect?.value as any) || 'SSR',
      jobKey,
      traitKey,
      gender: (genderSelect?.value as any) || Gender.MALE,
      isGuardian,
      avatarIndex: 0,
      avatarIcon,
      characterKey,
      boundMonsterId,
      captureRate,
      level,
      isAdvanced,
      customSkills: [...this.currentHeroEditingSkills],
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
        weaponTemplateId: wpnTemplateInput?.value || undefined,
        weaponEnhance: Number(wpnEnhanceInput?.value) || 0,
        weaponElement: (wpnElementSelect?.value as any) || ElementType.NONE,
        armorTemplateId: armTemplateInput?.value || undefined,
        armorEnhance: Number(armEnhanceInput?.value) || 0,
        accessoryId: accTemplateInput?.value || undefined
      }
    };

    // 存入自訂英雄庫
    const existingIdx = this.customHeroesDb.findIndex(item => item.id === id);
    if (existingIdx >= 0) {
      this.customHeroesDb[existingIdx] = heroDef;
    } else {
      this.customHeroesDb.push(heroDef);
    }

    const savedToDisk = await this.saveCustomHeroesToStorage();
    byId('modal-hero-creator').style.display = 'none';
    this.renderHeroDatabase();
    if (savedToDisk) {
      alert(`🎉 已成功儲存英雄【${title} ${name}】至專案磁碟！`);
    } else {
      alert(`⚠️ 英雄【${title} ${name}】已保存為本機草稿，但專案磁碟寫入失敗。`);
    }
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
      card.draggable = true;
      card.style.cursor = 'grab';
      card.ondragstart = (e) => {
        this.draggedPlayerUnitId = p.id;
        this.dragSourceSlot = null;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', p.id);
        }
      };
      const elemBadge = p.weaponElement !== ElementType.NONE ? `<span style="color: var(--cs-gold); font-size: 0.72rem;">[${p.weaponElement}]</span>` : '';
      const accText = p.accessoryType && p.accessoryType !== 'NONE' ? `💍 ${this.getAccessoryShortName(p.accessoryType)}` : '💍 (無飾品)';
      
      const maxStatPoints = (p.level - 1) * 2; // ✅ 每升 1 級給 2 點自由配點 (與遊戲專案完全對齊)
      const curAllocated = Object.values(p.allocatedStats).reduce((a, b) => a + b, 0);
      const unspent = Math.max(0, maxStatPoints - curAllocated);

      // 計算基礎六維與配點後的戰鬥數值
      let baseStr = 0, baseAgi = 0, baseCon = 0, baseInt = 0, baseSpr = 0, baseLuk = 0;
      if (p.customBaseAttributes) {
        let hStr = p.customBaseAttributes.str;
        let hAgi = p.customBaseAttributes.agi;
        let hCon = p.customBaseAttributes.con;
        let hInt = p.customBaseAttributes.int;
        let hSpr = p.customBaseAttributes.spr;
        let hLuk = p.customBaseAttributes.luk;

        const origLvl = p.heroOriginalLevel || 1;
        if (p.level > origLvl) {
          const deltaGrowth = this.getJobNaturalGrowth(p.jobName, 1 + (p.level - origLvl));
          hStr += deltaGrowth.str;
          hAgi += deltaGrowth.agi;
          hCon += deltaGrowth.con;
          hInt += deltaGrowth.int;
          hSpr += deltaGrowth.spr;
          hLuk += deltaGrowth.luk;
        } else if (p.level < origLvl) {
          const deltaLoss = this.getJobNaturalGrowth(p.jobName, 1 + (origLvl - p.level));
          hStr = Math.max(1, hStr - deltaLoss.str);
          hAgi = Math.max(1, hAgi - deltaLoss.agi);
          hCon = Math.max(1, hCon - deltaLoss.con);
          hInt = Math.max(1, hInt - deltaLoss.int);
          hSpr = Math.max(1, hSpr - deltaLoss.spr);
          hLuk = Math.max(1, hLuk - deltaLoss.luk);
        }

        baseStr = hStr;
        baseAgi = hAgi;
        baseCon = hCon;
        baseInt = hInt;
        baseSpr = hSpr;
        baseLuk = hLuk;
      } else {
        const baseAttr = this.getJobBaseAttributes(p.jobName, p.quality);
        const growth = this.getJobNaturalGrowth(p.jobName, p.level);
        baseStr = baseAttr.str + growth.str;
        baseAgi = baseAttr.agi + growth.agi;
        baseCon = baseAttr.con + growth.con;
        baseInt = baseAttr.int + growth.int;
        baseSpr = baseAttr.spr + growth.spr;
        baseLuk = baseAttr.luk + growth.luk;
      }

      const totalStr = baseStr + p.allocatedStats.str;
      const totalAgi = baseAgi + p.allocatedStats.agi;
      const totalCon = baseCon + p.allocatedStats.con;
      const totalInt = baseInt + p.allocatedStats.int;
      const totalSpr = baseSpr + p.allocatedStats.spr;
      const totalLuk = baseLuk + p.allocatedStats.luk;

      const wTpl = p.weaponTemplateId ? DataStore.EquipmentDB[p.weaponTemplateId] : null;
      const wBonus = wTpl?.baseCombatEffects?.atk ?? (p.weaponTier * 15 + p.weaponEnhance * 4);
      const aTpl = p.armorTemplateId ? DataStore.EquipmentDB[p.armorTemplateId] : null;
      const aBonus = aTpl?.baseCombatEffects?.def ?? (p.armorTier * 10 + p.armorEnhance * 3);

      const hp = totalCon * 10 + p.armorTier * 30 + p.armorEnhance * 5 + (p.accessoryType === 'RING_HP' ? 60 : 0);
      const mp = totalSpr * 5 + (p.accessoryType === 'RING_MP' ? 30 : 0);

      let patk = totalStr * 2 + wBonus;
      let matk = totalInt * 2 + wBonus;

      const jn = p.jobName;
      const wt = p.weaponType;

      if (wt === WeaponType.BOW || wt === WeaponType.DAGGERS || jn.includes('弓') || jn.includes('神射') || jn.includes('暗殺') || jn.includes('盜賊')) {
        patk = Math.floor(totalAgi * 1.6 + totalStr * 0.4) + wBonus;
        matk = Math.floor(totalInt * 1.2 + totalSpr * 0.8) + wBonus;
      } else if (wt === WeaponType.SWORD_AND_SHIELD || wt === WeaponType.RUNE_SHIELD || jn.includes('騎士') || jn.includes('聖騎')) {
        patk = Math.floor(totalCon * 1.4 + totalStr * 0.6) + wBonus;
        matk = Math.floor(totalSpr * 1.4 + totalInt * 0.6) + wBonus;
      } else if (wt === WeaponType.HOLY_BOOK || wt === WeaponType.HAMMER || jn.includes('祈禱') || jn.includes('主教') || jn.includes('拷問')) {
        matk = Math.floor(totalSpr * 1.6 + totalInt * 0.4) + wBonus;
        patk = Math.floor(totalStr * 1.2 + totalSpr * 0.8) + wBonus;
      } else if (wt === WeaponType.STAFF || wt === WeaponType.SCYTHE || jn.includes('法師') || jn.includes('魔導') || jn.includes('死靈')) {
        matk = totalInt * 2 + wBonus;
        patk = Math.floor(totalStr * 1.2 + totalInt * 0.8) + wBonus;
      } else if (wt === WeaponType.MAGIC_RING || jn.includes('詭術')) {
        matk = Math.floor(totalInt * 1.6 + totalAgi * 0.4) + wBonus;
        patk = Math.floor(totalAgi * 1.4 + totalStr * 0.6) + wBonus;
      } else if (wt === WeaponType.MAGIC_BOW || jn.includes('精靈使')) {
        patk = Math.floor(totalAgi * 1.4 + totalInt * 0.6) + wBonus;
        matk = Math.floor(totalInt * 1.4 + totalAgi * 0.6) + wBonus;
      } else {
        // 戰士 / 狂戰士 / 魔劍士
        patk = totalStr * 2 + wBonus;
        matk = Math.floor(totalInt * 1.4 + totalStr * 0.6) + wBonus;
      }

      const pdef = totalCon + Math.floor(totalStr * 0.5) + aBonus;
      const mdef = totalCon + Math.floor(totalSpr * 0.5) + aBonus;
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

  // ── 🛡️ 陣型系統與 3x3 九宮格戰術佈陣 ──
  private ensurePlayerGridMap(): void {
    const teamIds = new Set(this.playerTeam.map(p => p.id));
    // 清理已不在隊伍中的無效 ID
    for (const [slot, id] of Object.entries(this.playerGridMap)) {
      if (!teamIds.has(id)) {
        delete this.playerGridMap[slot];
      }
    }

    const existingMappedIds = new Set<string>(Object.values(this.playerGridMap));
    const unplacedUnits = this.playerTeam.filter(p => !existingMappedIds.has(p.id));

    // 自動安排未入座隊員至合適的空位
    unplacedUnits.forEach(p => {
      let preferredRows = [0, 1, 2];
      if (p.formationRow === FormationRow.FRONT) preferredRows = [0, 1, 2];
      else if (p.formationRow === 'MIDDLE') preferredRows = [1, 0, 2];
      else if (p.formationRow === FormationRow.BACK) preferredRows = [2, 1, 0];

      let placed = false;
      for (const r of preferredRows) {
        for (const c of [1, 0, 2]) { // 優先中路，再左右
          const slotKey = `${r}_${c}`;
          if (!this.playerGridMap[slotKey]) {
            this.playerGridMap[slotKey] = p.id;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    });
  }

  private renderFormationSelector(): void {
    const select = byId<HTMLSelectElement>('cs-formation-select');
    if (!select) return;

    if (!select.dataset.bound) {
      select.dataset.bound = 'true';
      select.innerHTML = '';
      Object.values(FormationDB.Formations).forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `${f.icon} ${f.name}`;
        if (f.id === this.selectedFormationId) opt.selected = true;
        select.appendChild(opt);
      });

      select.onchange = () => {
        this.selectedFormationId = select.value;
        this.render();
      };
    }

    this.updateFormationBadge();
  }

  private updateFormationBadge(): void {
    const badge = byId('cs-formation-status-badge');
    const desc = byId('cs-formation-desc');
    const activeFormation = FormationDB.getFormation(this.selectedFormationId);

    if (desc && activeFormation) {
      desc.textContent = activeFormation.description;
    }

    if (badge && activeFormation) {
      if (activeFormation.id === 'DEFAULT') {
        badge.className = 'cs-formation-badge';
        badge.textContent = '🏳️ 自由陣型 (無特殊加成)';
      } else {
        const isActive = FormationDB.isFormationActive(this.playerGridMap, this.selectedFormationId);
        if (isActive) {
          badge.className = 'cs-formation-badge active';
          badge.textContent = `✅ ${activeFormation.name} (已激活加成)`;
        } else {
          badge.className = 'cs-formation-badge inactive';
          badge.textContent = `⚠️ ${activeFormation.name} (未滿足站位需求)`;
        }
      }
    }
  }

  private renderArenaInitial(): void {
    const playerGridContainer = byId('cs-player-3x3-grid');
    if (!playerGridContainer) return;
    playerGridContainer.innerHTML = '';
    this.arenaHpMp = {};
    this.ensurePlayerGridMap();

    const arenaEl = document.querySelector('.cs-arena') as HTMLElement;
    if (arenaEl) {
      CombatStudioStageAdapter.getInstance().mount(arenaEl);
      CombatStudioStageAdapter.getInstance().clear();
    }

    const activeFormation = FormationDB.getFormation(this.selectedFormationId);
    const isFormationActive = FormationDB.isFormationActive(this.playerGridMap, this.selectedFormationId);

    // 我方 3x3 棋盤：視圖由左至右分別為 後排(vc=0, r=2) ➔ 中排(vc=1, r=1) ➔ 前排(vc=2, r=0)
    for (let vr = 0; vr < 3; vr++) {
      for (let vc = 0; vc < 3; vc++) {
        const r = 2 - vc;
        const c = vr;
        const slotId = `${r}_${c}`;
        const pId = this.playerGridMap[slotId];
        const p = pId ? this.playerTeam.find(u => u.id === pId) : null;

        const isRequired = activeFormation.requiredSlots.some(s => s.row === r && s.col === c);

        const slot = document.createElement('div');
        slot.className = 'cs-grid-slot';
        slot.dataset.slotId = slotId;

        if (isRequired) {
          slot.classList.add(isFormationActive ? 'active-formation' : 'required');
        }

        // 標註底層座標標籤
        const rowName = r === 0 ? '前排' : r === 1 ? '中排' : '後排';
        const colName = c === 0 ? '上' : c === 1 ? '中' : '下';
        const slotLabel = document.createElement('span');
        slotLabel.className = 'cs-grid-slot-label';
        slotLabel.textContent = `${rowName}${colName}`;
        slot.appendChild(slotLabel);

        // 拖曳事件綁定
        slot.ondragover = (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          slot.classList.add('drag-over');
        };
        slot.ondragleave = () => {
          slot.classList.remove('drag-over');
        };
        slot.ondrop = (e) => {
          e.preventDefault();
          slot.classList.remove('drag-over');
          if (this.draggedPlayerUnitId) {
            const targetSlotId = slotId;
            const sourceSlot = this.dragSourceSlot;
            const existingUnitIdInTarget = this.playerGridMap[targetSlotId];

            if (sourceSlot) {
              // 棋盤內部格子互相對調或移動
              if (existingUnitIdInTarget) {
                this.playerGridMap[sourceSlot] = existingUnitIdInTarget;
              } else {
                delete this.playerGridMap[sourceSlot];
              }
              this.playerGridMap[targetSlotId] = this.draggedPlayerUnitId;
            } else {
              // 從左側備選名單拖入
              for (const [k, v] of Object.entries(this.playerGridMap)) {
                if (v === this.draggedPlayerUnitId) delete this.playerGridMap[k];
              }
              this.playerGridMap[targetSlotId] = this.draggedPlayerUnitId;
            }

            this.draggedPlayerUnitId = null;
            this.dragSourceSlot = null;
            this.render();
          }
        };

        if (p) {
          const id = `arena_${p.id}`;
          let baseCon = 0, baseSpr = 0;
          if (p.customBaseAttributes) {
            let hCon = p.customBaseAttributes.con;
            let hSpr = p.customBaseAttributes.spr;
            const origLvl = p.heroOriginalLevel || 1;
            if (p.level > origLvl) {
              const deltaGrowth = this.getJobNaturalGrowth(p.jobName, 1 + (p.level - origLvl));
              hCon += deltaGrowth.con;
              hSpr += deltaGrowth.spr;
            } else if (p.level < origLvl) {
              const deltaLoss = this.getJobNaturalGrowth(p.jobName, 1 + (origLvl - p.level));
              hCon = Math.max(1, hCon - deltaLoss.con);
              hSpr = Math.max(1, hSpr - deltaLoss.spr);
            }
            baseCon = hCon;
            baseSpr = hSpr;
          } else {
            const baseAttr = this.getJobBaseAttributes(p.jobName, p.quality);
            const growth = this.getJobNaturalGrowth(p.jobName, p.level);
            baseCon = baseAttr.con + growth.con;
            baseSpr = baseAttr.spr + growth.spr;
          }
          const totalCon = baseCon + p.allocatedStats.con;
          const maxHp = totalCon * 10 + p.armorTier * 30 + (p.accessoryType === 'RING_HP' ? 60 : 0);
          const totalSpr = baseSpr + p.allocatedStats.spr;
          const maxMp = totalSpr * 5 + (p.accessoryType === 'RING_MP' ? 30 : 0);
          const avatar = p.avatarIcon || this.getJobEmoji(p.jobName);
          this.arenaHpMp[p.id] = { hp: maxHp, maxHp, mp: maxMp, maxMp, name: p.name, avatar };

          const card = document.createElement('div');
          card.className = 'cs-arena-card player-side';
          card.id = id;
          card.draggable = true;
          card.style.width = '100%';
          card.style.height = '100%';
          card.style.cursor = 'grab';

          card.ondragstart = (e) => {
            this.draggedPlayerUnitId = p.id;
            this.dragSourceSlot = slotId;
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', p.id);
            }
          };

          // ❌ 移出陣位按鈕
          const removeBtn = document.createElement('div');
          removeBtn.className = 'cs-slot-remove-btn';
          removeBtn.innerHTML = '×';
          removeBtn.title = '移出陣位';
          removeBtn.onclick = (e) => {
            e.stopPropagation();
            delete this.playerGridMap[slotId];
            this.render();
          };

          card.innerHTML = `
            <div class="cs-arena-name-row">
              <span class="cs-arena-name-text" style="color: var(--cs-gold-light);" title="${p.name}">${p.name}</span>
              <span style="font-size: 0.6rem; color: #a1a1aa; font-family: monospace;" id="hp_txt_${p.id}">${maxHp}</span>
            </div>
            <div class="cs-arena-avatar-box">
              ${renderUniversalIcon(avatar, 38)}
            </div>
            <div class="cs-bars" style="width: 100%;">
              <div class="cs-bar-wrap" style="height: 4px;"><div class="cs-hp-fill" id="hp_${p.id}" style="width: 100%;"></div></div>
              <div class="cs-bar-wrap" style="height: 3px;"><div class="cs-mp-fill" id="mp_${p.id}" style="width: 100%;"></div></div>
            </div>
          `;
          card.appendChild(removeBtn);
          slot.appendChild(card);
        }

        playerGridContainer.appendChild(slot);
      }
    }

    this.renderArenaWave(1);
    byId('cs-arena-round').textContent = 'Wave 1';
    this.updateFormationBadge();
  }

  private renderArenaWave(waveNum: number): void {
    const enemyGridContainer = byId('cs-enemy-3x3-grid');
    if (!enemyGridContainer) return;
    enemyGridContainer.innerHTML = '';

    const activeWave = this.enemyWaves[waveNum - 1] || this.enemyWaves[0] || [];

    // 建立怪物九宮格位置映射
    const monsterGridMap: Record<string, { e: EnemyUnitConfig; idx: number }> = {};
    const unplacedEnemies: { e: EnemyUnitConfig; idx: number }[] = [];

    activeWave.forEach((e, idx) => {
      if (e.gridR !== undefined && e.gridC !== undefined) {
        monsterGridMap[`${e.gridR}_${e.gridC}`] = { e, idx };
      } else {
        unplacedEnemies.push({ e, idx });
      }
    });

    // 自動安排未具備九宮格座標的怪物 (前排 ➔ 中排 ➔ 後排)
    unplacedEnemies.forEach(item => {
      let placed = false;
      for (const r of [0, 1, 2]) {
        for (const c of [1, 0, 2]) {
          const key = `${r}_${c}`;
          if (!monsterGridMap[key]) {
            monsterGridMap[key] = item;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    });

    // 敵方 3x3 棋盤：視圖由左至右分別為 前排(vc=0, r=0) ➔ 中排(vc=1, r=1) ➔ 後排(vc=2, r=2)
    for (let vr = 0; vr < 3; vr++) {
      for (let vc = 0; vc < 3; vc++) {
        const r = vc;
        const c = vr;
        const slotId = `${r}_${c}`;
        const mItem = monsterGridMap[slotId];

        const slot = document.createElement('div');
        slot.className = 'cs-grid-slot';
        slot.dataset.slotId = slotId;

        const rowName = r === 0 ? '前排' : r === 1 ? '中排' : '後排';
        const colName = c === 0 ? '上' : c === 1 ? '中' : '下';
        const slotLabel = document.createElement('span');
        slotLabel.className = 'cs-grid-slot-label';
        slotLabel.textContent = `${rowName}${colName}`;
        slot.appendChild(slotLabel);

        if (mItem) {
          const { e, idx } = mItem;
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
          card.style.width = '100%';
          card.style.height = '100%';

          card.innerHTML = `
            <div class="cs-arena-name-row">
              <span class="cs-arena-name-text" style="color: #fca5a5;" title="${e.name}">${e.name}</span>
              <span style="font-size: 0.6rem; color: #a1a1aa; font-family: monospace;" id="hp_txt_${eid}">${maxHp}</span>
            </div>
            <div class="cs-arena-avatar-box">
              ${renderUniversalIcon(avatar, 38)}
            </div>
            <div class="cs-bars" style="width: 100%;">
              <div class="cs-bar-wrap" style="height: 4px;"><div class="cs-hp-fill" id="hp_${eid}" style="width: 100%;"></div></div>
              <div class="cs-bar-wrap" style="height: 3px;"><div class="cs-mp-fill" id="mp_${eid}" style="width: 100%;"></div></div>
            </div>
          `;
          slot.appendChild(card);
        }

        enemyGridContainer.appendChild(slot);
      }
    }
  }

  // ── 戰鬥模擬核心 ──
  private runSingleBattle(): void {
    this.stopPlayback();
    this.ensurePlayerGridMap();
    const adventurers = this.buildAdventurers();
    const monsterWaves = this.buildMonstersForWaves();

    GameState.adventurers = adventurers;
    const attackerIds = adventurers.map(a => a.id);

    // 轉換 playerGridMap 為實際 adv.id 映射
    const simGridMap: Record<string, string> = {};
    for (const [slot, uId] of Object.entries(this.playerGridMap)) {
      const matchAdv = adventurers.find(a => a.id.endsWith(`_${uId}`) || a.id === uId);
      if (matchAdv) simGridMap[slot] = matchAdv.id;
    }

    const report = CombatSystem.simulateCombat(
      attackerIds,
      1,
      '',
      TerrainType.PLAINS,
      monsterWaves.length,
      undefined,
      monsterWaves[0],
      this.selectedFormationId,
      simGridMap,
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

    const isVfxOn = CombatStudioStageAdapter.getInstance().isVfxEnabled();
    const baseDelay = isVfxOn ? 650 : 450;
    const delay = Math.max(100, baseDelay / this.playSpeed);
    this.playTimer = setTimeout(() => this.stepPlayback(), delay);
  }

  private applyEventToUi(ev: CombatEvent, options?: { skipVfx?: boolean }): void {
    const logBox = byId('cs-combat-log');
    const row = document.createElement('div');
    row.className = 'cs-log-entry';

    if (ev.type === CombatEventType.CRIT) row.classList.add('crit');
    if (ev.type === CombatEventType.HEAL) row.classList.add('heal');
    if (ev.type === CombatEventType.STATUS_APPLY) row.classList.add('status');

    // 🔍 Phase 5: Action/Impact 與 VFX Cue 稽核資訊
    let debugTag = '';
    if (ev.actionId) {
      const segInfo = ev.impactIndex !== undefined && ev.impactCount !== undefined
        ? `Seg ${ev.impactIndex + 1}/${ev.impactCount}`
        : '';
      const vfxInfo = ev.vfxId ? `VFX: ${ev.vfxId}` : '';
      let warningTag = '';
      if (ev.vfxId && ev.impactCount !== undefined) {
        const repo = VFXPresetRepository.getInstance();
        const p = repo.getPreset(ev.vfxId);
        const cuesCount = p ? (p.hitCount || p.salvoCount || 1) : 1;
        if (ev.impactCount !== cuesCount) {
          warningTag = `<span class="cs-badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 0.65rem;" title="戰鬥數值段數與視覺段數不一致">⚠️ impact(${ev.impactCount}) ≠ cue(${cuesCount})</span>`;
        }
      }
      debugTag = `<div class="cs-log-debug-meta" style="font-size: 0.65rem; color: #64748b; font-family: monospace; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <span>🆔 ${ev.actionId}</span>
        ${segInfo ? `<span>| 🥊 ${segInfo}</span>` : ''}
        ${vfxInfo ? `<span>| ✨ ${vfxInfo}</span>` : ''}
        ${warningTag}
      </div>`;
    }

    row.innerHTML = `<div>${ev.text}</div>${debugTag}`;
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

    // 🎬 觸發 3D 視覺演出與打擊感反饋，並在命中時序同步更新血條
    let barsUpdated = false;
    const doUpdateBars = () => {
      if (barsUpdated) return;
      barsUpdated = true;
      this.updateBarsFromEvent(ev);
    };

    if (ev.actorId || ev.targetId) {
      CombatStudioStageAdapter.getInstance().playEventAction(ev, {
        skipVfx: options?.skipVfx,
        onImpact: () => {
          doUpdateBars();
        }
      }).catch((err) => {
        console.warn('[CombatStudio] playEventAction exception caught, proceeding with bar update:', err);
        doUpdateBars();
      });

      // 防呆：若特效因故未在 1.5 秒內觸發 impact，強制更新血條
      setTimeout(() => doUpdateBars(), 1500);
    } else {
      doUpdateBars();
    }
  }

  private updateBarsFromEvent(ev: CombatEvent): void {
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
    CombatStudioStageAdapter.getInstance().clear();
    byId('btn-play-pause').textContent = '▶ 繼續';
  }

  // ── 蒙地卡羅 100 場極速模擬 ──
  private runMonteCarlo(): void {
    this.stopPlayback();
    const adventurers = this.buildAdventurers();
    const monsterWaves = this.buildMonstersForWaves();
    GameState.adventurers = adventurers;
    const attackerIds = adventurers.map(a => a.id);

    const simGridMap: Record<string, string> = {};
    for (const [slot, uId] of Object.entries(this.playerGridMap)) {
      const matchAdv = adventurers.find(a => a.id.endsWith(`_${uId}`) || a.id === uId);
      if (matchAdv) simGridMap[slot] = matchAdv.id;
    }

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
        this.selectedFormationId,
        simGridMap,
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
      CombatStudioStageAdapter.getInstance().setSpeed(this.playSpeed);
    };

    const btnVfxToggle = byId('btn-vfx-toggle');
    if (btnVfxToggle) {
      btnVfxToggle.onclick = () => {
        const adapter = CombatStudioStageAdapter.getInstance();
        const next = !adapter.isVfxEnabled();
        adapter.setVfxEnabled(next);
        btnVfxToggle.textContent = next ? '🎬 特效: 開' : '🎬 特效: 關';
      };
    }

    byId('btn-skip-all').onclick = () => {
      if (!this.currentReport) return;
      CombatStudioStageAdapter.getInstance().clear();
      while (this.currentEventIndex < this.currentReport.events.length) {
        this.applyEventToUi(this.currentReport.events[this.currentEventIndex], { skipVfx: true });
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

      // ✅ 轉換成 SubjugationTemplate 格式，合併進 strongholdsDb 並持久化
      const subTemplate: SubjugationTemplate = {
        id,
        name,
        description: `【自訂據點】${name}`,
        terrain: terrain as SubjugationTemplate['terrain'],
        difficulty: diff,
        factionId: faction || undefined,
        worldGenMode: 'PERMANENT_VISIBLE',
        waves: garrisonWaves.map((wave, wIdx) => ({
          name: wIdx === garrisonWaves.length - 1 ? '守將波次' : `第 ${wIdx + 1} 波`,
          monsters: wave.map((u, mIdx) => ({
            monsterId: u.monsterId,
            powerTier: u.difficulty,
            formationRow: u.formationRow,
            gridR: u.formationRow === FormationRow.FRONT ? 0 : u.formationRow === FormationRow.BACK ? 2 : 1,
            gridC: mIdx % 3,
            slotId: `${u.formationRow === FormationRow.FRONT ? 0 : u.formationRow === FormationRow.BACK ? 2 : 1}_${mIdx % 3}`,
            affix: (u as EnemyUnitConfig & { affix?: string }).affix
          } as SubjugationWaveMonster))
        }))
      };

      // 若 id 已存在則更新，否則新增
      const existIdx = this.strongholdsDb.findIndex(s => s.id === id);
      if (existIdx >= 0) {
        this.strongholdsDb[existIdx] = subTemplate;
      } else {
        this.strongholdsDb.push(subTemplate);
      }
      this.normalizeStrongholdWaves(subTemplate);
      this.saveStrongholdsToStorage();

      const sel = byId<HTMLSelectElement>('cs-stronghold-select');
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `🏰 [自訂] ${name} (難度 ${diff} - ${terrain})`;
      opt.selected = true;
      sel.appendChild(opt);

      this.enemyWaves = clone(garrisonWaves);
      this.currentWaveIdx = 0;
      byId('modal-stronghold-designer').style.display = 'none';
      alert(`已成功設計自訂據點【${name}】！\n✅ 已同步寫入據點資料庫（LocalStorage）\n💾 請點「寫入專案硬碟」以永久存入 subjugation_nodes.json`);
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

    const btnPickerFlip = byId('btn-icon-picker-flip');
    if (btnPickerFlip) {
      btnPickerFlip.onclick = () => {
        this.isIconPickerFlipped = !this.isIconPickerFlipped;
        this.updateIconPickerFlipBtnState();
        this.renderIconPickerItems(this.currentIconPickerTab);
      };
    }

    byId('btn-close-icon-picker').onclick = () => byId('modal-icon-picker').style.display = 'none';
    byId('btn-close-icon-picker-footer').onclick = () => byId('modal-icon-picker').style.display = 'none';
    byId('btn-quick-open-icon-studio').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/icon-studio.html`, '_blank');

    byId('btn-apply-custom-icon').onclick = () => {
      const input = byId<HTMLInputElement>('icon-picker-custom-input');
      let val = input ? input.value.trim() : '';
      if (val && this.isIconPickerFlipped && !val.includes('?flip')) {
        val = `${val}?flip`;
      }
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
      const rawAttackType = (byId('mc-attack-type') as HTMLSelectElement).value as import('../models/types').AttackType;
      const avatarIcon = byId('mc-avatar-preview')?.dataset?.iconVal || `icons_monsters:${id}`;
      const characterKey = (byId('mc-character-key') as HTMLInputElement)?.value?.trim() || undefined;
      const substituteMonsterId = (byId('mc-substitute-id') as HTMLInputElement)?.value?.trim() || undefined;
      const rawCaptureRate = (byId('mc-capture-rate') as HTMLInputElement)?.value?.trim();
      const captureRate = rawCaptureRate !== '' && !isNaN(Number(rawCaptureRate)) ? Number(rawCaptureRate) : undefined;
      
      const selectedTerrains: TerrainType[] = [];
      document.querySelectorAll<HTMLInputElement>('input[name="mc-terrain"]:checked').forEach(cb => {
        selectedTerrains.push(cb.value as any);
      });

      const newMonster: MonsterData = {
        id,
        name,
        characterKey,
        substituteMonsterId,
        captureRate,
        race: (byId('mc-race') as HTMLSelectElement).value as any,
        defaultElement: (byId('mc-element') as HTMLSelectElement).value as any,
        powerTier: Number((byId('mc-powertier') as HTMLInputElement).value) || 1.0,
        attackType: rawAttackType || 'MELEE',
        isMagicalAttacker: rawAttackType === 'MAGIC',
        compatibleRaces: [((byId('mc-race') as HTMLSelectElement).value as any)],
        terrains: selectedTerrains.length > 0 ? selectedTerrains : [TerrainType.PLAINS, TerrainType.FOREST],
        avatarIcon
      };
      if ((byId('mc-comp-undead') as HTMLInputElement).checked) {
        newMonster.compatibleRaces.push(MonsterRace.UNDEAD);
      }

      const existingIdx = this.monstersDb.findIndex(m => m.id === id);
      if (existingIdx >= 0) {
        this.monstersDb[existingIdx] = { ...this.monstersDb[existingIdx], ...newMonster };
      } else {
        this.monstersDb.push(newMonster);
      }
      this.saveMonsterDraft();

      byId('modal-monster-creator').style.display = 'none';
      this.renderMonsterDatabase();
      this.renderEnemyList();
      void this.saveMonstersToDisk();
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
        if (field === 'level') {
          const newLvl = Math.max(1, Math.min(10, Number(val)));
          this.playerTeam[idx].level = newLvl;
          this.playerTeam[idx].isAdvanced = newLvl >= 10;
          this.render();
        }
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
          const maxPoints = (p.level - 1) * 2;
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
          const totalPoints = (p.level - 1) * 2;
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
            this.clearMonsterDraft();
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

    // ── 英雄技能卡槽點擊更換 ──
    byId('hc-skill-slot-0').onclick = () => this.openHeroSkillPicker(0);
    byId('hc-skill-slot-1').onclick = () => this.openHeroSkillPicker(1);
    byId('hc-skill-slot-2').onclick = () => this.openHeroSkillPicker(2);

    // ── 英雄裝備卡槽點擊開啟裝備挑選器 ──
    const wpnSlotCard = byId('hc-wpn-slot-card');
    if (wpnSlotCard) wpnSlotCard.onclick = () => this.openHeroEquipmentPicker('WEAPON');
    const armSlotCard = byId('hc-arm-slot-card');
    if (armSlotCard) armSlotCard.onclick = () => this.openHeroEquipmentPicker('ARMOR');
    const accSlotCard = byId('hc-acc-slot-card');
    if (accSlotCard) accSlotCard.onclick = () => this.openHeroEquipmentPicker('ACCESSORY');

    // ── 全視覺化裝備挑選器彈窗按鈕與事件 ──
    const btnCloseHCEquip = byId('btn-close-hc-equip-picker');
    if (btnCloseHCEquip) btnCloseHCEquip.onclick = () => byId('modal-hc-equip-picker').style.display = 'none';
    const btnCancelHCEquip = byId('btn-cancel-hc-equip-picker');
    if (btnCancelHCEquip) btnCancelHCEquip.onclick = () => byId('modal-hc-equip-picker').style.display = 'none';
    const btnClearHCEquip = byId('btn-hc-equip-clear');
    if (btnClearHCEquip) {
      btnClearHCEquip.onclick = () => {
        if (this.activeHeroEquipSlotType === 'WEAPON') {
          const wInput = byId<HTMLInputElement>('hc-wpn-template');
          if (wInput) wInput.value = '';
        } else if (this.activeHeroEquipSlotType === 'ARMOR') {
          const aInput = byId<HTMLInputElement>('hc-arm-template');
          if (aInput) aInput.value = '';
        } else {
          const accInput = byId<HTMLInputElement>('hc-acc-template');
          if (accInput) accInput.value = '';
        }
        this.updateHeroCreatorEquipmentDisplays();
        byId('modal-hc-equip-picker').style.display = 'none';
      };
    }
    byId<HTMLInputElement>('inp-hc-equip-search')?.addEventListener('input', (e) => {
      this.equipPickerSearchQuery = (e.target as HTMLInputElement).value.trim();
      this.renderHeroEquipmentPickerGrid();
    });
    byId('hc-equip-picker-tabs')?.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
      btn.onclick = () => {
        const tier = btn.dataset.equipTier || 'ALL';
        this.equipPickerTierFilter = tier;
        byId('hc-equip-picker-tabs')?.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.classList.toggle('cs-btn-gold', b === btn);
        });
        this.renderHeroEquipmentPickerGrid();
      };
    });

    // ── 全視覺化技能挑選器彈窗按鈕與事件 ──
    byId('btn-close-hc-skill-picker').onclick = () => byId('modal-hc-skill-picker').style.display = 'none';
    byId('btn-cancel-hc-skill-picker').onclick = () => byId('modal-hc-skill-picker').style.display = 'none';
    byId<HTMLInputElement>('inp-hc-skill-search')?.addEventListener('input', (e) => {
      this.skillPickerSearchQuery = (e.target as HTMLInputElement).value.trim();
      this.renderHeroSkillPickerGrid();
    });
    byId('hc-skill-picker-tabs')?.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.skillTab || 'ALL';
        this.currentSkillPickerTab = tab;
        byId('hc-skill-picker-tabs')?.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.classList.toggle('cs-btn-gold', b === btn);
        });
        this.renderHeroSkillPickerGrid();
      };
    });

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
            this.saveMonsterDraft();
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
          this.saveMonsterDraft();
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

  private updateIconPickerFlipBtnState(): void {
    const btn = byId('btn-icon-picker-flip');
    if (btn) {
      if (this.isIconPickerFlipped) {
        btn.textContent = '↔️ 水平翻轉: 開';
        btn.style.background = 'rgba(245, 158, 11, 0.35)';
        btn.style.borderColor = '#f59e0b';
        btn.style.fontWeight = 'bold';
      } else {
        btn.textContent = '↔️ 水平翻轉: 關';
        btn.style.background = 'rgba(245, 158, 11, 0.15)';
        btn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        btn.style.fontWeight = 'normal';
      }
    }
  }

  // ── 🖼️ 全圖集通用圖標選擇器 (Universal Icon Picker) ──
  private openIconPicker(callback: (icon: string) => void): void {
    this.iconPickerCallback = callback;
    const tabsContainer = byId('icon-picker-tabs');
    const customInput = byId<HTMLInputElement>('icon-picker-custom-input');

    if (tabsContainer) tabsContainer.innerHTML = '';
    if (customInput) customInput.value = '';

    this.updateIconPickerFlipBtnState();

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
        const flipStyle = this.isIconPickerFlipped ? 'transform: scaleX(-1);' : '';
        item.innerHTML = `<div style="font-size: 1.8rem; line-height: 1.2; ${flipStyle}">${emoji}</div>`;
        item.onclick = () => {
          const finalId = this.isIconPickerFlipped ? `${emoji}?flip` : emoji;
          if (this.iconPickerCallback) this.iconPickerCallback(finalId);
          byId('modal-icon-picker').style.display = 'none';
        };
        grid.appendChild(item);
      });
      return;
    }

    const catData = this.iconDatasets[tabKey];
    if (!catData || !catData.items) return;

    catData.items.forEach((it: any) => {
      const rawFullId = `${tabKey}:${it.id}`;
      const displayId = this.isIconPickerFlipped ? `${rawFullId}?flip` : rawFullId;
      const item = document.createElement('div');
      item.className = 'cs-icon-picker-item';
      item.innerHTML = `
        ${renderUniversalIcon(displayId, 44)}
        <div class="cs-icon-picker-item-label">${it.name || it.id}</div>
      `;
      item.onclick = () => {
        if (this.iconPickerCallback) this.iconPickerCallback(displayId);
        byId('modal-icon-picker').style.display = 'none';
      };
      grid.appendChild(item);
    });
  }

  // ── 📦 全物資與特產視覺化選擇器 ──
  private openMaterialPicker(
    title: string,
    initialSelected: string[],
    onConfirm: (selected: string[]) => void
  ): void {
    const modal = byId('modal-material-picker');
    const titleEl = byId('material-picker-title');
    const searchInput = byId<HTMLInputElement>('material-picker-search');
    const grid = byId('material-picker-grid');
    const countEl = byId('material-picker-selected-count');
    const btnConfirm = byId('btn-confirm-material-picker');
    const btnCancel = byId('btn-cancel-material-picker');
    const btnClose = byId('btn-close-material-picker');
    const btnClearAll = byId('btn-material-picker-clear-all');

    if (!modal || !grid) return;

    if (titleEl) titleEl.textContent = title;
    if (searchInput) searchInput.value = '';

    const selectedSet = new Set<string>(initialSelected);

    const updateCount = () => {
      if (countEl) countEl.textContent = `已選取 ${selectedSet.size} 項物資`;
    };

    const renderGrid = () => {
      grid.innerHTML = '';
      const q = searchInput?.value.trim().toLowerCase() || '';

      const filtered = materialsJson.filter(m => {
        if (q && !m.name.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) return false;
        return true;
      });

      filtered.forEach(mat => {
        const isSelected = selectedSet.has(mat.id);
        const card = document.createElement('div');
        card.style.cssText = `
          background: ${isSelected ? 'rgba(234, 179, 8, 0.18)' : '#0e121a'};
          border: 1.5px solid ${isSelected ? 'var(--cs-gold)' : 'rgba(255,255,255,0.08)'};
          box-shadow: ${isSelected ? '0 0 8px rgba(234, 179, 8, 0.3)' : 'none'};
          border-radius: 6px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        `;

        card.innerHTML = `
          <div style="font-size: 1.2rem;">${renderUniversalIcon(mat.icon, 36)}</div>
          <div style="font-size: 0.8rem; font-weight: bold; color: ${isSelected ? '#fbbf24' : '#e2e8f0'}; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${mat.name}</div>
          <div style="font-size: 0.7rem; color: #94a3b8;">${mat.basePrice} 金幣</div>
          ${isSelected ? '<div style="position: absolute; top: 4px; right: 4px; color: #4ade80; font-size: 0.8rem; font-weight: bold;">✓</div>' : ''}
        `;

        card.onmouseenter = () => {
          if (!isSelected) card.style.borderColor = 'rgba(234,179,8,0.5)';
        };
        card.onmouseleave = () => {
          if (!isSelected) card.style.borderColor = 'rgba(255,255,255,0.08)';
        };

        card.onclick = () => {
          if (selectedSet.has(mat.id)) {
            selectedSet.delete(mat.id);
          } else {
            selectedSet.add(mat.id);
          }
          updateCount();
          renderGrid();
        };

        grid.appendChild(card);
      });
      updateCount();
    };

    renderGrid();

    if (searchInput) {
      searchInput.oninput = () => renderGrid();
    }

    if (btnClearAll) {
      btnClearAll.onclick = () => {
        selectedSet.clear();
        updateCount();
        renderGrid();
      };
    }

    const closeModal = () => {
      modal.style.display = 'none';
    };

    if (btnClose) btnClose.onclick = closeModal;
    if (btnCancel) btnCancel.onclick = closeModal;

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        onConfirm(Array.from(selectedSet));
        closeModal();
      };
    }

    modal.style.display = 'flex';
  }
}

export { CombatStudioController };

// 啟動工坊
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const controller = new CombatStudioController();
    controller.init();
  });
}
