import { MapNode, NodeLevel, NodeFeature, WeatherType, TerrainType } from '../../models/types';
import { Territory } from '../../models/Territory';
import { Random } from '../../core/Random';
import { monsterSystem } from '../MonsterSystem';
import { MapUtils } from './MapUtils';

export class MapEventSystem {
  public static scoutNode(nodeId: string, mapNodes: MapNode[], territory: Territory): boolean {
    const node = mapNodes.find(n => n.id === nodeId);
    if (!node) return false;

    if (node.isScouted) {
      console.log(`[系統] ⚠️ 該節點「${node.name}」已經偵查過了！`);
      return false;
    }
    
    if (node.pendingScoutDays && node.pendingScoutDays > 0) {
      console.log(`[系統] ⚠️ 該節點「${node.name}」已經有斥候正在前往！`);
      return false;
    }

    const cost = 100; // 偵查花費
    if (territory.gold >= cost) {
      territory.gold -= cost;
      
      let scoutDays = 1;
      const baseId = territory.currentCountryId;
      if (baseId) {
        const baseNode = mapNodes.find(n => n.id === baseId);
        if (baseNode) {
          const dist = MapUtils.getDistance(baseNode, node);
          if (dist >= 70) scoutDays = 3;
          else if (dist >= 30) scoutDays = 2;
          else scoutDays = 1;
        }
      }
      
      node.pendingScoutDays = scoutDays;
      console.log(`[系統] 👁️ 花費 ${cost} 金幣派遣斥候前往「${node.name}」，預計 ${scoutDays} 天後回報情報！`);
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法派遣斥候！(需要 ${cost} 金幣)`);
      return false;
    }
  }

  public static resolveScout(node: MapNode, currentDay: number): void {
    node.isScouted = true;
    node.scoutExpiryDate = currentDay + 30; // 情報有效期限 30 天

    monsterSystem.generateNodeEncounter(node);
    console.log(`[系統] 👁️ 斥候已傳回「${node.name}」的最新情報！(有效期限 30 天)`);
  }

  public static checkScoutExpiry(mapNodes: MapNode[], currentDay: number): void {
    for (const node of mapNodes) {
      if (node.isScouted && node.scoutExpiryDate !== null) {
        if (currentDay >= node.scoutExpiryDate) {
          node.isScouted = false;
          node.scoutExpiryDate = null;
          node.scoutData = undefined;
          console.log(`[系統] 🌫️ 關於「${node.name}」的情報已經過期，節點重新陷入迷霧。`);
        }
      }
    }
  }

  public static updateWeather(mapNodes: MapNode[]): void {
    for (const node of mapNodes) {
      if (node.weatherDuration > 0) {
        node.weatherDuration -= 1;
        continue;
      }

      const r = Random.next();
      
      if (node.terrain === TerrainType.SNOW_MOUNTAIN) {
        if (r < 0.6) {
          node.currentWeather = WeatherType.SNOW;
          node.weatherDuration = Random.int(2, 4);
        } else if (r < 0.8) {
          node.currentWeather = WeatherType.FOG;
          node.weatherDuration = Random.int(1, 2);
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(1, 2);
        }
      } else if (node.terrain === TerrainType.DESERT) {
        if (r < 0.3) {
          node.currentWeather = WeatherType.SANDSTORM;
          node.weatherDuration = Random.int(1, 3);
        } else if (r < 0.35) {
          node.currentWeather = WeatherType.RAIN;
          node.weatherDuration = 1;
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(3, 7);
        }
      } else if (node.terrain === TerrainType.FOREST) {
        if (r < 0.4) {
          node.currentWeather = WeatherType.RAIN;
          node.weatherDuration = Random.int(1, 3);
        } else if (r < 0.6) {
          node.currentWeather = WeatherType.FOG;
          node.weatherDuration = Random.int(1, 2);
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(2, 5);
        }
      } else if (node.terrain === TerrainType.VOLCANO) {
        if (r < 0.2) {
          node.currentWeather = WeatherType.FOG;
          node.weatherDuration = Random.int(1, 3);
        } else if (r < 0.25) {
          node.currentWeather = WeatherType.SNOW;
          node.weatherDuration = 1;
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(2, 7);
        }
      } else {
        if (r < 0.3) {
          node.currentWeather = WeatherType.RAIN;
          node.weatherDuration = Random.int(1, 3);
        } else if (r < 0.4) {
          node.currentWeather = WeatherType.FOG;
          node.weatherDuration = Random.int(1, 2);
        } else if (r < 0.45) {
          node.currentWeather = WeatherType.SNOW;
          node.weatherDuration = 1;
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(2, 6);
        }
      }
    }
  }

  public static checkNodeUnlocks(mapNodes: MapNode[], currentDay: number, currentPrestige: number): void {
    let unlockedAny = false;
    for (const node of mapNodes) {
      if (node.isHidden && node.unlockCondition) {
        const meetsDay = !node.unlockCondition.minDay || currentDay >= node.unlockCondition.minDay;
        const meetsPrestige = !node.unlockCondition.minPrestige || currentPrestige >= node.unlockCondition.minPrestige;

        if (meetsDay && meetsPrestige) {
          node.isHidden = false;
          unlockedAny = true;
          console.log(`🗺️ [情報解鎖] 發現了新的據點：${node.name}！`);

          if ((window as any).toastManager) {
            (window as any).toastManager.show(`🗺️ 發現了新區域：${node.name}！`, 'info');
          }
        }
      }
    }

    if (unlockedAny) {
      Promise.all([
        import('../../core/EventBus'),
        import('../../core/GameEvents')
      ]).then(([{ EventBus }, { GameEventType }]) => {
        EventBus.getInstance().publish({
          type: GameEventType.MISSIONS_CHANGED,
          payload: { reason: 'PROGRESSED' }
        });
      });
    }
  }

  public static spawnDynamicNode(mapNodes: MapNode[], baseNode: MapNode, radius: number = 10): MapNode | null {
    const dynamicCount = mapNodes.filter(n => n.isDynamic).length;
    if (dynamicCount >= 5) {
      return null;
    }

    let newX = baseNode.x;
    let newY = baseNode.y;
    let validPos = false;
    let attempts = 0;

    let explorationSystem: any = null;
    try {
      const gs = (window as any).GameState;
      if (gs && gs.explorationSystem) {
        explorationSystem = gs.explorationSystem;
      }
    } catch (e) {}

    while (!validPos && attempts < 50) {
      const offsetX = Random.int(-radius, radius);
      const offsetY = Random.int(-radius, radius);
      if (Math.abs(offsetX) < 2 && Math.abs(offsetY) < 2) {
        attempts++;
        continue;
      }
      newX = Math.max(2, Math.min(98, baseNode.x + offsetX));
      newY = Math.max(2, Math.min(98, baseNode.y + offsetY));

      if (explorationSystem && typeof explorationSystem.isPointRevealed === 'function') {
        if (!explorationSystem.isPointRevealed(newX, newY)) {
          attempts++;
          continue;
        }
      }

      let tooClose = false;
      for (const n of mapNodes) {
        const dist = MapUtils.getDistance(n, { x: newX, y: newY } as MapNode);
        if (dist < 3) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        validPos = true;
      }
      attempts++;
    }

    if (!validPos) {
      return null;
    }

    const possibleTerrains = [TerrainType.FOREST, TerrainType.PLAINS, TerrainType.CAVE, TerrainType.RUINS, TerrainType.WILDERNESS];
    const terrain = Random.pick(possibleTerrains);
    
    let feature = NodeFeature.MONSTER_NEST;
    let namePrefix = '怪物巢穴';
    if (Random.next() < 0.3) {
      feature = NodeFeature.SUBJUGATION;
      namePrefix = '隨機事件';
    }

    let top5Power = 0;
    try {
       const gs = (window as any).GameState;
       if (gs && gs.adventurers) {
          const sorted = [...gs.adventurers].sort((a: any, b: any) => b.power - a.power);
          top5Power = sorted.slice(0, 5).reduce((sum: number, a: any) => sum + a.power, 0);
       }
    } catch(e) {}
    
    const maxDiff = Math.max(10, Math.floor(10 + top5Power / 40));
    const dynamicDiff = Random.int(5, maxDiff);

    const newNode: MapNode = {
      id: `dynamic_node_${Date.now()}_${Random.int(100, 999)}`,
      name: `未知的${namePrefix}`,
      description: '這是領主親自探索時發現的神秘地點。',
      x: newX,
      y: newY,
      population: 0,
      prosperity: 0,
      nodeLevel: NodeLevel.WILDERNESS,
      ownerFactionId: null,
      isPlayerBase: false,
      terrain: terrain,
      feature: feature,
      isHidden: false,
      isDiscovered: true,
      isDynamic: true,
      baseDifficulty: dynamicDiff,
      isScouted: false,
      scoutExpiryDate: null,
      currentWeather: WeatherType.CLEAR,
      weatherDuration: 0
    };

    mapNodes.push(newNode);

    Promise.all([
      import('../../core/EventBus'),
      import('../../core/GameEvents')
    ]).then(([{ EventBus }, { GameEventType }]) => {
      EventBus.getInstance().publish({ 
        type: GameEventType.MISSIONS_CHANGED, 
        payload: { reason: 'PROGRESSED' }
      });
    });

    return newNode;
  }
}
