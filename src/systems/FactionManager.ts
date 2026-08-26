import { Faction, FactionType, FactionPersonality } from '../models/types';
import { INITIAL_FACTIONS } from '../data/FactionData';

export const CUSTOM_FACTIONS_STORAGE_KEY = 'MEDIEVAL_CUSTOM_FACTIONS_V1';

/** 預設內建的特殊自訂陣營：遠古龍裔 */
export const DEFAULT_CUSTOM_FACTIONS: Faction[] = [
  {
    id: 'f_dragonkin',
    factionName: '遠古龍裔',
    description: '傳承古老巨龍血脈的神秘隱世氏族，崇尚力量與古老誓約。唯有完成特殊遠古考驗者方能贏得其敬重。',
    factionType: FactionType.MINOR_HOUSE,
    color: '#ea580c', // 龍息琥珀橙
    resources: 2000,
    controlledNodes: [],
    capitalNodeId: '',
    playerFavor: 0,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.WARMONGER
  }
];

export class FactionManager {
  private static cachedCustomFactions: Faction[] | null = null;

  /**
   * 取得所有自訂陣營（若無則初始化並回傳預設的遠古龍裔）
   */
  public static getCustomFactions(): Faction[] {
    if (this.cachedCustomFactions) {
      return this.cachedCustomFactions;
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(CUSTOM_FACTIONS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cachedCustomFactions = parsed;
            return parsed;
          }
        }
      } catch (err) {
        console.warn('載入自訂陣營失敗，使用預設值', err);
      }
    }

    this.cachedCustomFactions = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_FACTIONS));
    this.saveCustomFactions(this.cachedCustomFactions!);
    return this.cachedCustomFactions!;
  }

  /**
   * 儲存自訂陣營列表
   */
  public static saveCustomFactions(factions: Faction[]): void {
    this.cachedCustomFactions = factions;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(CUSTOM_FACTIONS_STORAGE_KEY, JSON.stringify(factions));
      } catch (err) {
        console.error('儲存自訂陣營至 localStorage 失敗', err);
      }
    }
  }

  /**
   * 取得所有陣營名單（內建 7 大家族 + 所有自訂陣營）
   */
  public static getAllFactions(): Faction[] {
    const custom = this.getCustomFactions();
    const builtInIds = new Set(INITIAL_FACTIONS.map(f => f.id));
    const uniqueCustom = custom.filter(f => !builtInIds.has(f.id));
    return [...INITIAL_FACTIONS, ...uniqueCustom];
  }

  /**
   * 新增或更新自訂陣營
   */
  public static upsertCustomFaction(faction: Faction): void {
    const list = this.getCustomFactions();
    const idx = list.findIndex(f => f.id === faction.id);
    if (idx >= 0) {
      list[idx] = faction;
    } else {
      list.push(faction);
    }
    this.saveCustomFactions(list);
  }

  /**
   * 刪除自訂陣營
   */
  public static deleteCustomFaction(id: string): void {
    const list = this.getCustomFactions().filter(f => f.id !== id);
    this.saveCustomFactions(list);
  }
}
