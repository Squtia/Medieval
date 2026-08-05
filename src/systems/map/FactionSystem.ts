import { Faction, MapNode, NodeFeature, FactionPersonality } from '../../models/types';
import { GameEventType } from '../../core/GameEvents';
import { Random } from '../../core/Random';
import { MapUtils } from './MapUtils';

export class FactionSystem {
  public static readonly FACTION_EXPANSION_THRESHOLD = 500;
  public static readonly FACTION_EXPANSION_COST = 400;

  public static processAIFactionsInteractions(factions: Faction[]): void {
    for (const faction of factions) {
      if (faction.controlledNodes.length === 0) continue;

      if (!faction.relations) faction.relations = {};
      if (!faction.atWarWith) faction.atWarWith = [];

      for (const other of factions) {
        if (faction.id === other.id || other.controlledNodes.length === 0) continue;
        
        const relation = faction.relations[other.id] || 0;
        const rand = (Math.random() * 5) | 0;
        if (faction.personality === FactionPersonality.WARMONGER) {
          faction.relations[other.id] = Math.max(-100, relation - rand);
        } else if (faction.personality === FactionPersonality.PEACEFUL) {
          faction.relations[other.id] = Math.min(100, relation + rand);
        }

        if (faction.relations[other.id] < -50 && !faction.atWarWith.includes(other.id)) {
          faction.atWarWith.push(other.id);
          if (!other.atWarWith) other.atWarWith = [];
          if (!other.atWarWith.includes(faction.id)) other.atWarWith.push(faction.id);
          console.log(`[系統] ⚔️ 派系動態：【${faction.factionName}】對【${other.factionName}】宣戰了！`);
        }
        
        if (faction.relations[other.id] > -20 && faction.atWarWith.includes(other.id)) {
          faction.atWarWith = faction.atWarWith.filter(id => id !== other.id);
          if (other.atWarWith) other.atWarWith = other.atWarWith.filter(id => id !== faction.id);
          console.log(`[系統] 🕊️ 派系動態：【${faction.factionName}】與【${other.factionName}】達成了停戰協議。`);
        }
      }

      if (faction.playerFavor < -50 && !faction.atWarWith.includes('player')) {
        faction.atWarWith.push('player');
        console.log(`[系統] ⚠️ 警告：【${faction.factionName}】對您的好感度過低，已對您正式宣戰！`);
        if ((window as any).toastManager) {
           (window as any).toastManager.show(`⚠️ 【${faction.factionName}】對您宣戰了！`, 'error');
        }
      }
    }
  }

  public static attemptFactionExpansion(faction: Faction, mapNodes: MapNode[], factions: Faction[]): void {
    if (faction.atWarWith && faction.atWarWith.length > 0 && faction.resources >= this.FACTION_EXPANSION_COST * 2) {
      const enemyNodes = mapNodes.filter(node =>
        !node.siegeData && (
          (node.isPlayerBase && faction.atWarWith.includes('player')) ||
          (node.ownerFactionId && faction.atWarWith.includes(node.ownerFactionId))
        )
      );

      if (enemyNodes.length > 0) {
        const factionNodes = mapNodes.filter(n => faction.controlledNodes.includes(n.id));
        let siegeTarget: MapNode | null = null;
        let minSiegeDist = Infinity;

        for (const target of enemyNodes) {
          for (const fn of factionNodes) {
            const dist = MapUtils.getDistance(fn, target);
            if (dist < 20 && dist < minSiegeDist) {
              minSiegeDist = dist;
              siegeTarget = target;
            }
          }
        }

        if (siegeTarget) {
          faction.resources -= this.FACTION_EXPANSION_COST * 2;
          const remainingDays = Random.int(3, 6);
          siegeTarget.siegeData = {
            attackerFactionId: faction.id,
            remainingDays: remainingDays,
            attackerPower: faction.resources + 500
          };

          console.log(`[系統] ⚔️ 攻城戰發起！【${faction.factionName}】開始圍攻「${siegeTarget.name}」（剩餘 ${remainingDays} 天）。`);

          if (siegeTarget.isPlayerBase && (window as any).toastManager) {
            (window as any).toastManager.show(`🚨 警告！【${faction.factionName}】開始圍攻您的據點「${siegeTarget.name}」！`, 'error');
          }

          import('../../core/EventBus').then(({ EventBus }) => {
            EventBus.getInstance().publish({
              type: GameEventType.SIEGE_STARTED,
              payload: { targetNodeId: siegeTarget!.id, attackerFactionId: faction.id }
            });
          });
          return;
        }
      }
    }

    const availableTargets = mapNodes.filter(node =>
      node.ownerFactionId === null &&
      !node.isPlayerBase &&
      node.feature === NodeFeature.OCCUPIABLE
    );

    if (availableTargets.length > 0) {
      let bestTarget: MapNode | null = null;
      let minDistance = Infinity;

      for (const target of availableTargets) {
        const factionNodes = mapNodes.filter(n => faction.controlledNodes.includes(n.id));
        for (const fn of factionNodes) {
          const dist = MapUtils.getDistance(fn, target);
          if (dist < minDistance) {
            minDistance = dist;
            bestTarget = target;
          }
        }
      }

      if (bestTarget) {
        if (minDistance < 15) {
          faction.resources -= this.FACTION_EXPANSION_COST;
          faction.controlledNodes.push(bestTarget.id);
          bestTarget.ownerFactionId = faction.id;
          console.log(`[系統] 🛡️ 派系動態：【${faction.factionName}】的勢力穩步擴張，佔領了「${bestTarget.name}」。`);
        } else if (faction.resources >= this.FACTION_EXPANSION_COST * 5) {
          faction.resources -= this.FACTION_EXPANSION_COST * 5;
          faction.controlledNodes.push(bestTarget.id);
          bestTarget.ownerFactionId = faction.id;
          console.log(`[系統] 🛡️ 派系動態：【${faction.factionName}】發動了遠征，耗費鉅資佔領了「${bestTarget.name}」。`);
        }
      }
    }
  }

  public static resolveSiege(node: MapNode, factions: Faction[]): void {
    if (!node.siegeData) return;
    const attackerFactionId = node.siegeData.attackerFactionId;
    const attacker = factions.find(f => f.id === attackerFactionId);
    
    if (attacker) {
      if (node.isPlayerBase) {
        node.prosperity = Math.max(0, node.prosperity - 100);
        console.log(`[系統] 💥 您的據點「${node.name}」被【${attacker.factionName}】攻陷，繁榮度大幅下降！`);
        if ((window as any).toastManager) {
           (window as any).toastManager.show(`💥 據點遭到【${attacker.factionName}】攻陷！`, 'error');
        }
      } else {
        console.log(`[系統] 🏰 【${attacker.factionName}】成功攻陷了「${node.name}」。`);
        if (node.ownerFactionId) {
          this.removeNodeFromFaction(node.id, node.ownerFactionId, factions);
        }
        node.ownerFactionId = attacker.id;
        attacker.controlledNodes.push(node.id);
      }
      
      import('../../core/EventBus').then(({ EventBus }) => {
         EventBus.getInstance().publish({ 
           type: GameEventType.SIEGE_RESOLVED, 
           payload: { targetNodeId: node.id, winnerId: attacker.id, isCityFallen: true }
         });
      });
    }
    
    node.siegeData = undefined;
  }

  public static removeNodeFromFaction(nodeId: string, factionId: string, factions: Faction[]): void {
    const faction = factions.find(f => f.id === factionId);
    if (faction) {
      faction.controlledNodes = faction.controlledNodes.filter(id => id !== nodeId);
      if (faction.controlledNodes.length === 0) {
        console.log(`[系統] 💀 派系滅亡：【${faction.factionName}】失去了最後的據點，該勢力已在歷史中消亡。`);
      }
    }
  }
}
