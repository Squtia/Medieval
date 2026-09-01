import { Faction, FactionType, FactionPersonality } from '../models/types';
import { INITIAL_FACTIONS } from '../data/FactionData';
import customFactionsJson from '../data/custom_factions.json';

export const CUSTOM_FACTIONS_STORAGE_KEY = 'MEDIEVAL_CUSTOM_FACTIONS_V1';

/** 預設自訂陣營：由創作者於勢力工坊中全權自訂管理 */
export const DEFAULT_CUSTOM_FACTIONS: Faction[] = customFactionsJson as Faction[];

export class FactionManager {
  private static cachedCustomFactions: Faction[] | null = null;

  /**
   * 取得所有自訂陣營（若無則為空陣列）
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
          if (Array.isArray(parsed)) {
            this.cachedCustomFactions = parsed;
            return parsed;
          }
        }
      } catch (err) {
        console.warn('載入自訂陣營失敗，使用預設值', err);
      }
    }

    this.cachedCustomFactions = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_FACTIONS));
    return this.cachedCustomFactions!;
  }

  /**
   * 儲存自訂陣營列表
   */
  public static saveCustomFactions(factions: Faction[]): void {
    this.cachedCustomFactions = JSON.parse(JSON.stringify(factions));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(CUSTOM_FACTIONS_STORAGE_KEY, JSON.stringify(factions));
      } catch (err) {
        console.error('儲存自訂陣營至 localStorage 失敗', err);
      }
    }
  }

  public static hasDraft(): boolean {
    return typeof localStorage !== 'undefined' && localStorage.getItem(CUSTOM_FACTIONS_STORAGE_KEY) !== null;
  }

  public static loadProjectFactions(factions: Faction[], preserveDraft = true): void {
    if (preserveDraft && this.hasDraft()) {
      this.cachedCustomFactions = null;
      this.getCustomFactions();
      return;
    }
    this.cachedCustomFactions = JSON.parse(JSON.stringify(factions));
  }

  public static markPublished(factions: Faction[]): void {
    this.cachedCustomFactions = JSON.parse(JSON.stringify(factions));
    if (typeof localStorage !== 'undefined') localStorage.removeItem(CUSTOM_FACTIONS_STORAGE_KEY);
  }

  public static discardDraft(): void {
    this.cachedCustomFactions = null;
    if (typeof localStorage !== 'undefined') localStorage.removeItem(CUSTOM_FACTIONS_STORAGE_KEY);
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
