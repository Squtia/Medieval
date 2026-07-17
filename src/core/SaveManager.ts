import { GameState } from './GameState';
import { Territory } from '../models/Territory';
import { Adventurer } from '../models/Adventurer';
import { EventBus } from './EventBus';
import { DispatchSystem } from '../systems/DispatchSystem';
import { MapDynamicsSystem } from '../systems/MapDynamicsSystem';

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
      factions: GameState.mapSystem.getFactions(),
      mapNodes: GameState.mapSystem.getNodes(),
      currentDay: GameState.currentDay,
      currentMonth: GameState.currentMonth,
      currentYear: GameState.currentYear,
      restedExpPool: GameState.restedExpPool
    };

    localStorage.setItem(`${this.SAVE_KEY_PREFIX}${slot}`, JSON.stringify(saveData));
    console.log(`[系統] 遊戲已儲存至欄位 ${slot}`);
  }

  public static deleteGame(slot: number): void {
    localStorage.removeItem(`${this.SAVE_KEY_PREFIX}${slot}`);
    console.log(`[系統] 已刪除欄位 ${slot} 的遊戲存檔`);
  }

  public static loadGame(slot: number): boolean {
    const dataStr = localStorage.getItem(`${this.SAVE_KEY_PREFIX}${slot}`);
    if (!dataStr) return false;

    try {
      const data = JSON.parse(dataStr);
      
      // 1. 還原 Territory
      const t = new Territory(data.territory.name, data.territory.currentCountryId);
      Object.assign(t, data.territory);
      GameState.myTerritory = t;

      // 2. 還原 Adventurers
      GameState.adventurers = data.adventurers.map((advData: any) => {
        const adv = new Adventurer(advData.id, advData.name, advData.job, advData.trait);
        Object.assign(adv, advData);
        return adv;
      });

      // 3. 還原 Systems
      GameState.system = new DispatchSystem(GameState.myTerritory);
      GameState.mapSystem = new MapDynamicsSystem(data.mapNodes, data.factions);

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

      console.log(`[系統] 已成功從欄位 ${slot} 載入遊戲`);
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
