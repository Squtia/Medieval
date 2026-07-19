import { GameState } from './GameState';
import { Territory } from '../models/Territory';
import { Adventurer } from '../models/Adventurer';
import { EventBus } from './EventBus';
import { DispatchSystem } from '../systems/DispatchSystem';
import { MapDynamicsSystem } from '../systems/MapDynamicsSystem';
import { SettlementSystem } from '../systems/SettlementSystem';
import { HeroSystem } from '../systems/HeroSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ThreatSystem } from '../systems/ThreatSystem';
import { MarketSystem } from '../systems/MarketSystem';

export interface SaveSlotMetadata {
  slot: number;
  isEmpty: boolean;
  timestamp?: number;
  playTime?: number;
  territoryName?: string;
  title?: string;
  gold?: number;
}

export class SaveManager {
  private static readonly SAVE_KEY_PREFIX = 'idle_rpg_save_';

  public static getSaveSlots(): SaveSlotMetadata[] {
    const slots: SaveSlotMetadata[] = [];
    for (let i = 1; i <= 3; i++) {
      const dataStr = localStorage.getItem(`${this.SAVE_KEY_PREFIX}${i}`);
      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          slots.push({
            slot: i,
            isEmpty: false,
            timestamp: data.timestamp,
            playTime: data.playTime,
            territoryName: data.territory.name,
            title: data.territory.title,
            gold: data.territory.gold
          });
        } catch (e) {
          slots.push({ slot: i, isEmpty: true });
        }
      } else {
        slots.push({ slot: i, isEmpty: true });
      }
    }
    return slots;
  }

  public static saveGame(slot: number): void {
    const currentPlayTime = GameState.playTime + (Date.now() - GameState.sessionStartTime);
    
    const saveData = {
      timestamp: Date.now(),
      playTime: currentPlayTime,
      territory: GameState.myTerritory,
      adventurers: GameState.adventurers,
      activeMissions: GameState.system ? GameState.system.getActiveMissions() : [],
      factions: GameState.mapSystem.getFactions(),
      mapNodes: GameState.mapSystem.getNodes(),
      currentDay: GameState.currentDay,
      currentMonth: GameState.currentMonth,
      currentYear: GameState.currentYear,
      restedExpPool: GameState.restedExpPool
    };

    localStorage.setItem(`${this.SAVE_KEY_PREFIX}${slot}`, JSON.stringify(saveData));
    // 儲存時不再使用 console.log 印出以免污染遊戲日誌
  }

  public static deleteGame(slot: number): void {
    localStorage.removeItem(`${this.SAVE_KEY_PREFIX}${slot}`);
    // 不使用 console.log 以免污染遊戲日誌
  }

  public static loadGame(slot: number): boolean {
    const dataStr = localStorage.getItem(`${this.SAVE_KEY_PREFIX}${slot}`);
    if (!dataStr) return false;

    try {
      const data = JSON.parse(dataStr);
      
      // 1. 還原 Territory
      const t = new Territory(data.territory.name, data.territory.currentCountryId);
      Object.assign(t, data.territory);
      
      // 相容舊存檔預設值
      if (t.exploredToday === undefined) t.exploredToday = 0;
      if (t.maxExplorationsPerDay === undefined) t.maxExplorationsPerDay = 1;
      if (t.tavernLevel === undefined) t.tavernLevel = 0;
      if (t.weaponShopLevel === undefined) t.weaponShopLevel = 0;
      if (t.armorShopLevel === undefined) t.armorShopLevel = 0;
      if (t.forgeLevel === undefined) t.forgeLevel = 0;
      if (t.exploreCount === undefined) t.exploreCount = 0;
      if (t.hasRecruitedFromFirstExplorations === undefined) t.hasRecruitedFromFirstExplorations = false;
      
      GameState.myTerritory = t;

      // 2. 還原 Adventurers
      GameState.adventurers = data.adventurers.map((advData: any) => {
        const adv = new Adventurer(advData.id, advData.name, advData.job, advData.trait);
        Object.assign(adv, advData);
        return adv;
      });

      // 3. 還原 Systems
      // 先清除舊的 EventBus 訂閱，避免讀檔後系統被訂閱多次
      EventBus.getInstance().clearAll();
      GameState.system = new DispatchSystem(GameState.myTerritory);
      if (data.activeMissions) {
        GameState.system.loadActiveMissions(data.activeMissions);
      }
      GameState.mapSystem = new MapDynamicsSystem(data.mapNodes, data.factions);
      new SettlementSystem();
      new HeroSystem();
      new CombatSystem();
      new ThreatSystem();

      // 4. 更新時間紀錄與日曆
      GameState.playTime = data.playTime || 0;
      
      const now = Date.now();
      if (data.timestamp) {
        const offlineMs = now - data.timestamp;
        const offlineHours = offlineMs / (1000 * 60 * 60);
        // 每離線一小時給予 1000 點雙倍經驗，最多累積 24 小時
        const gainedRested = Math.min(24, Math.floor(offlineHours)) * 1000;
        GameState.restedExpPool = (data.restedExpPool || 0) + gainedRested;
        
        if (gainedRested > 0) {
          console.log(`[系統] 💤 領主歸來！離線期間累積了 ${gainedRested} 點雙倍經驗 (Rested EXP)。`);

        } else {
          GameState.restedExpPool = data.restedExpPool || 0;
        }
      } else {
        GameState.restedExpPool = data.restedExpPool || 0;
      }

      GameState.sessionStartTime = now;
      GameState.currentDay = data.currentDay || 1;
      GameState.currentMonth = data.currentMonth || 1;
      GameState.currentYear = data.currentYear || 1;

      // 還原 currentViewNode
      if (t.currentCountryId) {
        GameState.currentViewNode = GameState.mapSystem.getNodes().find(n => n.id === t.currentCountryId) || null;
      } else {
        GameState.currentViewNode = null;
      }
      
      GameState.currentSaveSlot = slot;

      // 成功載入後，確保市場資料有被初始化 (相容舊存檔)
      MarketSystem.updateMarkets(GameState.mapSystem.getNodes(), GameState.totalDays);

      // 成功載入不需使用 console.log 印出以免污染遊戲日誌
      return true;
    } catch (e) {
      console.error('Failed to load save file:', e);
      return false;
    }
  }

  public static formatPlayTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}小時 ${minutes}分`;
    } else {
      return `${minutes}分 ${seconds}秒`;
    }
  }
}
