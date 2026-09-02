import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import {
  NarrativeChannel,
  NarrativeChoice,
  NarrativeCondition,
  NarrativeEffect,
  NarrativeNode,
  NarrativeRuntimeState,
  NarrativeStory,
  createEmptyNarrativeState
} from '../models/Narrative';
import { NarrativeContentStore } from './NarrativeContentStore';
import { DataStore } from './DataStore';
import { EquipmentGenerator } from './EquipmentGenerator';
import { AcquisitionItem, AcquisitionNotification } from '../ui/AcquisitionNotification';
import { TRADE_GOODS } from './MarketSystem';
import { EnemyFeature } from '../models/DispatchTask';
import { MapNode, NodeFeature, NodeLevel, TerrainType, WeatherType } from '../models/types';
import { TerritoryDefenseSystem } from './TerritoryDefenseSystem';
import { FactionManager } from './FactionManager';
import { createUniqueAdventurer } from '../data/UniqueAdventurers';

export interface NarrativeNodeRef {
  story: NarrativeStory;
  node: NarrativeNode;
}

export class NarrativeSystem {
  private static stories: NarrativeStory[] = [];

  static reloadDefinitions(): void {
    this.stories = NarrativeContentStore.getPublishedStories();
  }

  static getStories(): NarrativeStory[] {
    if (this.stories.length === 0) this.reloadDefinitions();
    return this.stories;
  }

  static setDefinitionsForTesting(stories: NarrativeStory[]): void {
    this.stories = JSON.parse(JSON.stringify(stories));
  }

  static ensureState(): NarrativeRuntimeState {
    const current = GameState.narrativeState;
    if (!current) GameState.narrativeState = createEmptyNarrativeState();
    const state = GameState.narrativeState;
    state.facts ||= {};
    state.completedNodeIds ||= [];
    state.presentedNodeIds ||= [];
    state.scheduledNodes ||= {};
    state.exploredNodeIds ||= [];
    return state;
  }

  static getNodeKey(storyId: string, nodeId: string): string {
    return `${storyId}:${nodeId}`;
  }

  static findNode(storyId: string, nodeId: string): NarrativeNodeRef | null {
    const story = this.getStories().find(item => item.id === storyId);
    const node = story?.nodes.find(item => item.id === nodeId);
    return story && node ? { story, node } : null;
  }

  static getEligibleNodes(channel?: NarrativeChannel, includePresented = false): NarrativeNodeRef[] {
    const state = this.ensureState();
    const result: NarrativeNodeRef[] = [];
    for (const story of this.getStories()) {
      if (!story.enabled) continue;
      for (const node of story.nodes) {
        const key = this.getNodeKey(story.id, node.id);
        if (channel && node.channel !== channel) continue;
        if (node.repeatable) {
          // 可重複輪替節點：檢查冷卻天數
          if (state.nodeLastCompletedDay && state.nodeLastCompletedDay[key] !== undefined) {
            const cooldown = node.cooldownDays ?? 3;
            if (GameState.totalDays - state.nodeLastCompletedDay[key] < cooldown) continue;
          }
        } else {
          if (state.completedNodeIds.includes(key)) continue;
          if (!includePresented && state.presentedNodeIds.includes(key)) continue;
        }
        if (this.explainBlocked(story, node).length === 0) result.push({ story, node });
      }
    }
    return result;
  }

  /** 取得所有當前合資格且未在進行中的日常輪替懸賞節點 */
  static getEligibleRoutineBounties(): NarrativeNodeRef[] {
    const activeKeys = new Set((GameState.bounties || []).map((b: any) => b.narrativeNodeKey).filter(Boolean));
    return this.getEligibleNodes('BOUNTY_BOARD', true).filter(({ story, node }) => {
      if (!node.repeatable) return false;
      const key = this.getNodeKey(story.id, node.id);
      return !activeKeys.has(key);
    });
  }

  /** 檢查某個節點是否被其他節點指定為排程或立即接續目標。 */
  static isScheduledTargetNode(storyId: string, nodeId: string): boolean {
    for (const story of this.getStories()) {
      if (!story.enabled) continue;
      for (const n of story.nodes) {
        // 若為自排程（自身完成後重新排程自身）則不視為前置依賴阻擋
        for (const eff of n.completionEffects || []) {
          if ((eff.type === 'SCHEDULE_NODE' || eff.type === 'PRESENT_NODE') && eff.nodeId === nodeId && (story.id !== storyId || n.id !== nodeId)) {
            return true;
          }
        }
        for (const choice of n.choices || []) {
          for (const eff of choice.effects || []) {
            if ((eff.type === 'SCHEDULE_NODE' || eff.type === 'PRESENT_NODE') && eff.nodeId === nodeId && (story.id !== storyId || n.id !== nodeId)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /** 檢查某個節點是否被劇本中任何節點的 CREATE_SUBJUGATION_NODE 指名為勝利、失敗或途中事件後續節點 */
  static isSubjugationTargetNode(storyId: string, nodeId: string): boolean {
    for (const story of this.getStories()) {
      if (!story.enabled) continue;
      for (const n of story.nodes) {
        for (const eff of n.completionEffects || []) {
          if (eff.type === 'CREATE_SUBJUGATION_NODE' && eff.definition) {
            const def = eff.definition;
            if (def.victoryNodeId === nodeId || def.defeatNodeId === nodeId) return true;
            if (def.journeyNodeIds && def.journeyNodeIds.includes(nodeId)) return true;
          }
        }
        for (const choice of n.choices || []) {
          for (const eff of choice.effects || []) {
            if (eff.type === 'CREATE_SUBJUGATION_NODE' && eff.definition) {
              const def = eff.definition;
              if (def.victoryNodeId === nodeId || def.defeatNodeId === nodeId) return true;
              if (def.journeyNodeIds && def.journeyNodeIds.includes(nodeId)) return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * 檢查某個節點是否被劇本中任何節點的 TRIGGER_RAID 效果指名為戰役勝利或失敗後續節點。
   * 這類節點必須等到守城/攔截戰役實際結算後，由 TerritoryDefenseSystem 透過 onClose 回調主動觸發，
   * 不得由每日輪詢 getEligibleNodes 無條件喚醒。
   */
  static isRaidTargetNode(storyId: string, nodeId: string): boolean {
    for (const story of this.getStories()) {
      if (!story.enabled) continue;
      for (const n of story.nodes) {
        for (const eff of n.completionEffects || []) {
          if (eff.type === 'TRIGGER_RAID') {
            if (eff.successNodeId === nodeId || eff.failNodeId === nodeId) return true;
          }
        }
        for (const choice of n.choices || []) {
          for (const eff of choice.effects || []) {
            if (eff.type === 'TRIGGER_RAID') {
              if (eff.successNodeId === nodeId || eff.failNodeId === nodeId) return true;
            }
          }
        }
      }
    }
    return false;
  }

  static explainBlocked(story: NarrativeStory, node: NarrativeNode): string[] {
    const state = this.ensureState();
    const key = this.getNodeKey(story.id, node.id);
    const scheduledDay = state.scheduledNodes[key];
    const reasons: string[] = [];
    
    // 若該節點是受前置節點 SCHEDULE_NODE 排程的目標節點：
    if (this.isScheduledTargetNode(story.id, node.id)) {
      if (scheduledDay === undefined) {
        reasons.push('尚未被前置劇情決策排程喚醒');
      } else if (GameState.totalDays < scheduledDay) {
        reasons.push(`排程於第 ${scheduledDay} 天開放（尚餘 ${scheduledDay - GameState.totalDays} 天）`);
      }
    } else if (scheduledDay !== undefined && GameState.totalDays < scheduledDay) {
      reasons.push(`排程於第 ${scheduledDay} 天開放（尚餘 ${scheduledDay - GameState.totalDays} 天）`);
    }

    // 若該節點是討伐據點專屬後續節點 (勝利/失敗/途中事件)：
    if (this.isSubjugationTargetNode(story.id, node.id)) {
      reasons.push('為討伐據點專屬後續節點，需在討伐結算時觸發');
    }

    // 若該節點是 TRIGGER_RAID 戰役結算專屬後續節點 (守城大捷/城防失守)：
    // 必須等待 TerritoryDefenseSystem 的 settleSiegeDefenseResults onClose 回調主動觸發，
    // 絕對不可由每日輪詢無條件喚醒！
    if (this.isRaidTargetNode(story.id, node.id)) {
      reasons.push('為戰役結算專屬後續節點（守城大捷/城防失守），需在戰役結算時觸發');
    }

    for (const condition of node.conditions) {
      if (!this.checkCondition(condition)) reasons.push(this.describeCondition(condition));
    }
    return reasons;
  }


  private static checkCondition(condition: NarrativeCondition): boolean {
    const state = this.ensureState();
    switch (condition.type) {
      case 'DAY_AT_LEAST': return GameState.totalDays >= condition.value;
      case 'TAVERN_LEVEL_AT_LEAST': return GameState.myTerritory.tavernLevel >= condition.value;
      case 'BUILDING_LEVEL_AT_LEAST': {
        const territory = GameState.myTerritory;
        const bId = condition.buildingId;
        let lvl = 0;
        if (bId === 'defense') lvl = territory.defenseLevel;
        else if (bId === 'tavern') lvl = territory.tavernLevel;
        else if (bId === 'forge') lvl = territory.forgeLevel;
        else if (bId === 'weapon') lvl = territory.weaponShopLevel;
        else if (bId === 'armor') lvl = territory.armorShopLevel;
        else if (bId === 'church') lvl = territory.churchLevel;
        else if (bId === 'farmland') lvl = territory.farmlandLevel;
        else if (bId === 'lumberMill') lvl = territory.lumberMillLevel;
        else if (bId === 'quarry') lvl = territory.quarryLevel;
        else if (bId === 'huntingGround') lvl = territory.huntingGroundLevel;
        return lvl >= condition.value;
      }
      case 'SECURITY_AT_LEAST': return (GameState.myTerritory.security ?? 100) >= condition.value;
      case 'SECURITY_AT_MOST': return (GameState.myTerritory.security ?? 100) <= condition.value;
      case 'PRESTIGE_AT_LEAST': return GameState.myTerritory.prestige >= condition.value;
      case 'GOLD_AT_LEAST': return GameState.myTerritory.gold >= condition.value;
      case 'FACTION_FAVOR_AT_LEAST': {
        const f = GameState.mapSystem?.getFactions().find(item => item.id === condition.factionId);
        return (f?.playerFavor ?? 50) >= condition.value;
      }
      case 'FACTION_FAVOR_AT_MOST': {
        const f = GameState.mapSystem?.getFactions().find(item => item.id === condition.factionId);
        return (f?.playerFavor ?? 50) <= condition.value;
      }
      case 'FACT_EXISTS': return state.facts[condition.fact] !== undefined;
      case 'FACT_MISSING': return state.facts[condition.fact] === undefined;
      case 'DAYS_SINCE_FACT': {
        const fact = state.facts[condition.fact];
        return !!fact && GameState.totalDays - fact.day >= condition.value;
      }
      case 'NODE_EXPLORED': return state.exploredNodeIds.includes(condition.nodeId);
      case 'SUBJUGATION_COUNT_AT_LEAST': {
        const count = Object.keys(state.facts)
          .filter(key => key.startsWith('subjugation:') && key.endsWith(':victory')).length;
        return count >= condition.value;
      }
      case 'NODE_OWNER_IS': {
        const node = GameState.mapSystem?.getNodes().find(n => n.id === condition.nodeId);
        return node?.ownerFactionId === condition.factionId;
      }
      case 'FACTION_AT_WAR': {
        const f = GameState.mapSystem?.getFactions().find(item => item.id === condition.factionId);
        return (f?.atWarWith || []).length > 0;
      }
      case 'FACTION_STARVING': {
        const f = GameState.mapSystem?.getFactions().find(item => item.id === condition.factionId) as any;
        return (f?.economy?.grainDays ?? 100) <= 0;
      }
      case 'HERO_EXISTS': {
        const currentAdvs = GameState.adventurers || [];
        const targetIds = condition.heroIds || [];
        if (targetIds.length === 0) return true;
        const isMatch = (tId: string) => currentAdvs.some(adv => {
          const aId = (adv.id || '').toLowerCase();
          const target = tId.toLowerCase();
          return aId === target || aId.includes(target) || (adv.name || '').includes(tId);
        });
        return condition.matchMode === 'ALL' ? targetIds.every(isMatch) : targetIds.some(isMatch);
      }
      case 'HERO_MISSING': {
        const currentAdvs = GameState.adventurers || [];
        const targetIds = condition.heroIds || [];
        if (targetIds.length === 0) return true;
        const isMatch = (tId: string) => currentAdvs.some(adv => {
          const aId = (adv.id || '').toLowerCase();
          const target = tId.toLowerCase();
          return aId === target || aId.includes(target) || (adv.name || '').includes(tId);
        });
        return condition.matchMode === 'ALL' ? targetIds.every(tId => !isMatch(tId)) : targetIds.some(tId => !isMatch(tId));
      }
    }
  }

  private static describeCondition(condition: NarrativeCondition): string {
    switch (condition.type) {
      case 'DAY_AT_LEAST': return `需要到第 ${condition.value} 天`;
      case 'TAVERN_LEVEL_AT_LEAST': return `酒館需要達到 ${condition.value} 級`;
      case 'BUILDING_LEVEL_AT_LEAST': return `建築「${condition.buildingId}」需達到 ${condition.value} 級`;
      case 'SECURITY_AT_LEAST': return `領地治安度需 ≥ ${condition.value}`;
      case 'SECURITY_AT_MOST': return `領地治安度需 ≤ ${condition.value}`;
      case 'PRESTIGE_AT_LEAST': return `聲望需要達到 ${condition.value}`;
      case 'GOLD_AT_LEAST': return `金幣需要達到 ${condition.value}`;
      case 'FACTION_FAVOR_AT_LEAST': return `派系「${condition.factionId}」好感度需 ≥ ${condition.value}`;
      case 'FACTION_FAVOR_AT_MOST': return `派系「${condition.factionId}」好感度需 ≤ ${condition.value}`;
      case 'FACT_EXISTS': return `尚未取得線索「${condition.fact}」`;
      case 'FACT_MISSING': return `線索「${condition.fact}」已存在`;
      case 'DAYS_SINCE_FACT': return `取得「${condition.fact}」後需經過 ${condition.value} 天`;
      case 'NODE_EXPLORED': return `尚未探索據點「${condition.nodeId}」`;
      case 'SUBJUGATION_COUNT_AT_LEAST': return `尚未討伐滿 ${condition.value} 個動態據點`;
      case 'NODE_OWNER_IS': return `據點「${condition.nodeId}」控制者需為「${condition.factionId}」`;
      case 'FACTION_AT_WAR': return `派系「${condition.factionId}」需處於交戰狀態`;
      case 'FACTION_STARVING': return `派系「${condition.factionId}」需處於糧荒狀態`;
      case 'HERO_EXISTS': return `需要已招募英雄「${condition.heroIds.join('、')}」`;
      case 'HERO_MISSING': return `需要尚未擁有英雄「${condition.heroIds.join('、')}」`;
    }
  }

  static processDailyTick(): void {
    this.ensureStoryBounties();
    this.ensureStoryTodos();
    const territoryEvent = this.getEligibleNodes('TERRITORY_EVENT')[0];
    if (territoryEvent) this.presentInteractiveNode(territoryEvent.story.id, territoryEvent.node.id);
    for (const ref of this.getEligibleNodes('STORY_NODE')) this.unlockStoryNode(ref);
  }

  static ensureStoryTodos(): void {
    const territory = GameState.myTerritory as any;
    if (!territory) return;
    if (!territory.pendingNarrativeNodes) territory.pendingNarrativeNodes = [];
    for (const { story, node } of this.getEligibleNodes('TODO_LIST')) {
      const key = this.getNodeKey(story.id, node.id);
      if (!territory.pendingNarrativeNodes.includes(key)) {
        territory.pendingNarrativeNodes.push(key);
        this.markPresented(story.id, node.id);
      }
    }
  }

  static ensureStoryBounties(): void {
    for (const { story, node } of this.getEligibleNodes('BOUNTY_BOARD')) {
      if (node.repeatable) continue; // 日常輪替懸賞由 BountySystem 每日隨機抽取
      const key = this.getNodeKey(story.id, node.id);
      if (GameState.bounties.some((bounty: any) => bounty.narrativeNodeKey === key)) continue;
      const bounty = node.bounty ?? { duration: 2, expireDays: 30, gold: 50, exp: 30 };
      GameState.bounties.push({
        id: `STORY_${story.id}_${node.id}`,
        name: `◆ ${node.title}`,
        desc: node.description,
        duration: bounty.duration,
        expireDays: bounty.expireDays,
        status: 'PENDING',
        type: bounty.type || 'NORMAL',
        narrativeNodeKey: key,
        narrativeStoryId: story.id,
        narrativeNodeId: node.id,
        rewards: {
          gold: bounty.gold,
          exp: bounty.exp,
          items: bounty.items
        }
      });
      this.markPresented(story.id, node.id);
    }
  }

  static getEligibleStreetEvents(): NarrativeNodeRef[] {
    return this.getEligibleNodes('STREET_EVENT', true);
  }

  static consumeTavernRumor(): NarrativeNodeRef | null {
    const ref = this.getEligibleNodes('TAVERN_RUMOR')[0];
    if (!ref) return null;
    this.markPresented(ref.story.id, ref.node.id);
    this.completeNode(ref.story.id, ref.node.id);
    return ref;
  }

  static handleNodeExplored(nodeId: string): void {
    const state = this.ensureState();
    if (!state.exploredNodeIds.includes(nodeId)) state.exploredNodeIds.push(nodeId);
    const ref = this.getEligibleNodes('EXPLORATION')[0];
    if (ref) this.presentInteractiveNode(ref.story.id, ref.node.id);
  }

  static handleSubjugationJourney(storyId: string, nodeId: string): boolean {
    return this.presentInteractiveNode(storyId, nodeId, true);
  }

  static handleSubjugationCompleted(
    nodeId: string,
    isVictory: boolean,
    narrative?: MapNode['narrativeSubjugation']
  ): void {
    const state = this.ensureState();
    state.facts[`subjugation:${nodeId}:${isVictory ? 'victory' : 'defeat'}`] = {
      value: true,
      day: GameState.totalDays
    };
    const outcomeNodeId = isVictory ? narrative?.victoryNodeId : narrative?.defeatNodeId;
    const delayDays = isVictory ? (narrative?.victoryDelayDays ?? 0) : (narrative?.defeatDelayDays ?? 0);
    if (narrative && outcomeNodeId) {
      if (delayDays > 0) {
        state.scheduledNodes[this.getNodeKey(narrative.storyId, outcomeNodeId)] = GameState.totalDays + delayDays;
      } else {
        this.presentInteractiveNode(narrative.storyId, outcomeNodeId, true);
      }
      return;
    }
    const ref = this.getEligibleNodes('SUBJUGATION')[0];
    if (ref) this.presentInteractiveNode(ref.story.id, ref.node.id, true);
  }

  static presentInteractiveNode(storyId: string, nodeId: string, force = false): boolean {
    const ref = this.findNode(storyId, nodeId);
    if (!ref) return false;
    if (!force && this.explainBlocked(ref.story, ref.node).length > 0) return false;
    this.markPresented(storyId, nodeId);
    EventBus.getInstance().publish({
      type: GameEventType.NARRATIVE_NODE_TRIGGERED,
      payload: { storyId, nodeId }
    });
    return true;
  }

  static resolveChoice(storyId: string, nodeId: string, choice?: NarrativeChoice): void {
    const ref = this.findNode(storyId, nodeId);
    if (!ref) return;
    if (choice) this.applyEffects(storyId, choice.effects, nodeId);
    this.applyEffects(storyId, ref.node.completionEffects, nodeId);
    this.completeNode(storyId, nodeId, false);
  }

  static completeNode(storyId: string, nodeId: string, applyCompletionEffects = true): void {
    const ref = this.findNode(storyId, nodeId);
    if (!ref) return;
    if (applyCompletionEffects) this.applyEffects(storyId, ref.node.completionEffects);
    const state = this.ensureState();
    const key = this.getNodeKey(storyId, nodeId);
    if (!state.nodeLastCompletedDay) state.nodeLastCompletedDay = {};
    state.nodeLastCompletedDay[key] = GameState.totalDays;
    if (!state.completedNodeIds.includes(key)) state.completedNodeIds.push(key);
    if (ref.node.loop?.targetNodeId) {
      const loopNodeIds = new Set([ref.node.loop.targetNodeId, ...(ref.node.loop.resetNodeIds || [])]);
      const loopKeys = new Set([...loopNodeIds].map(id => this.getNodeKey(storyId, id)));
      state.completedNodeIds = state.completedNodeIds.filter(completedKey => !loopKeys.has(completedKey));
      state.presentedNodeIds = state.presentedNodeIds.filter(presentedKey => !loopKeys.has(presentedKey));
      state.scheduledNodes[this.getNodeKey(storyId, ref.node.loop.targetNodeId)] =
        GameState.totalDays + Math.max(0, ref.node.loop.cooldownDays ?? 0);
    }
    GameState.bounties = GameState.bounties.filter((bounty: any) => bounty.narrativeNodeKey !== key);
  }

  static canAffordChoice(choice: NarrativeChoice): { affordable: boolean; missingReason?: string } {
    const territory = GameState.myTerritory as any;
    if (!territory) return { affordable: true };

    for (const effect of choice.effects) {
      if (effect.type === 'ADD_GOLD' && effect.value < 0) {
        const required = Math.abs(effect.value);
        if ((territory.gold || 0) < required) {
          return { affordable: false, missingReason: `金幣不足 (需 ${required} G)` };
        }
      }
      if (effect.type === 'GRANT_MATERIAL' && effect.mode !== 'RANDOM' && effect.quantity < 0) {
        const required = Math.abs(effect.quantity);
        const count = territory.materials?.[effect.itemId] || 0;
        if (count < required) {
          const mat = DataStore.MaterialDB[effect.itemId];
          const name = mat?.name || effect.itemId;
          return { affordable: false, missingReason: `缺少素材：${name} x${required}` };
        }
      }
      if (effect.type === 'GRANT_TRADE_GOOD' && effect.mode !== 'RANDOM' && effect.quantity < 0) {
        const required = Math.abs(effect.quantity);
        const count = territory.tradeInventory?.[effect.itemId] || 0;
        if (count < required) {
          const tg = TRADE_GOODS.find(g => g.id === effect.itemId);
          const name = tg?.name || effect.itemId;
          return { affordable: false, missingReason: `缺少特產：${name} x${required}` };
        }
      }
    }
    return { affordable: true };
  }

  static applyEffects(storyId: string, effects: NarrativeEffect[], sourceNodeId?: string): void {
    const state = this.ensureState();
    const acquisitions: AcquisitionItem[] = [];
    for (const effect of effects) {
      const chance = Math.max(0, Math.min(100, effect.chancePercent ?? 100));
      if (chance < 100 && Math.random() * 100 >= chance) continue;
      switch (effect.type) {
        case 'SET_FACT':
          state.facts[effect.fact] = { value: effect.value ?? true, day: GameState.totalDays };
          break;
        case 'ADD_GOLD':
          GameState.myTerritory.gold = Math.max(0, GameState.myTerritory.gold + effect.value);
          break;
        case 'ADD_PRESTIGE':
          GameState.myTerritory.prestige += effect.value;
          break;
        case 'ADD_RESTED_EXP':
          GameState.restedExpPool += Math.max(0, effect.value);
          break;
        case 'CHANGE_FACTION_FAVOR': {
          const faction = GameState.mapSystem?.getFactions().find(f => f.id === effect.factionId);
          if (faction) faction.playerFavor = Math.max(-100, Math.min(100, faction.playerFavor + effect.value));
          break;
        }
        case 'GRANT_MATERIAL':
          GameState.myTerritory.materials = GameState.myTerritory.materials || {};
          if (effect.mode === 'RANDOM') {
            const requestedKeys = (effect.itemIds || []).filter(key => !!DataStore.MaterialDB[key]);
            const allMatKeys = requestedKeys.length > 0 ? requestedKeys : Object.keys(DataStore.MaterialDB);
            if (allMatKeys.length > 0) {
              const pickedKey = allMatKeys[Math.floor(Math.random() * allMatKeys.length)];
              GameState.myTerritory.materials[pickedKey] = (GameState.myTerritory.materials[pickedKey] || 0) + Math.max(1, effect.quantity);
              const material = DataStore.MaterialDB[pickedKey];
              acquisitions.push({ name: material?.name || pickedKey, icon: material?.icon || '💎', quantity: Math.max(1, effect.quantity) });
            }
          } else if (effect.itemId) {
            const current = GameState.myTerritory.materials[effect.itemId] || 0;
            const updated = current + effect.quantity;
            if (updated <= 0) {
              delete GameState.myTerritory.materials[effect.itemId];
            } else {
              GameState.myTerritory.materials[effect.itemId] = updated;
              if (effect.quantity > 0) {
                const material = DataStore.MaterialDB[effect.itemId];
                acquisitions.push({ name: material?.name || effect.itemId, icon: material?.icon || '💎', quantity: effect.quantity });
              }
            }
          }
          break;
        case 'GRANT_TRADE_GOOD':
          GameState.myTerritory.tradeInventory = GameState.myTerritory.tradeInventory || {};
          if (effect.mode === 'RANDOM') {
            if (TRADE_GOODS.length > 0) {
              const pickedGood = TRADE_GOODS[Math.floor(Math.random() * TRADE_GOODS.length)];
              GameState.myTerritory.tradeInventory[pickedGood.id] = (GameState.myTerritory.tradeInventory[pickedGood.id] || 0) + Math.max(1, effect.quantity);
              acquisitions.push({ name: pickedGood.name, icon: pickedGood.icon || '📦', quantity: Math.max(1, effect.quantity) });
            }
          } else if (effect.itemId) {
            const current = GameState.myTerritory.tradeInventory[effect.itemId] || 0;
            const updated = current + effect.quantity;
            if (updated <= 0) {
              delete GameState.myTerritory.tradeInventory[effect.itemId];
            } else {
              GameState.myTerritory.tradeInventory[effect.itemId] = updated;
              if (effect.quantity > 0) acquisitions.push({ name: TRADE_GOODS.find(g => g.id === effect.itemId)?.name || effect.itemId, icon: TRADE_GOODS.find(g => g.id === effect.itemId)?.icon || '📦', quantity: effect.quantity });
            }
          }
          break;
        case 'GRANT_EQUIPMENT':
          for (let index = 0; index < Math.max(1, effect.quantity); index++) {
            const equipment = effect.mode === 'RANDOM'
              ? EquipmentGenerator.generateByFilter(effect.slot, effect.tier)
              : (effect.templateId ? EquipmentGenerator.generate(effect.templateId) : null);
            if (equipment) {
              GameState.myTerritory.addEquipmentToWarehouse(equipment);
              acquisitions.push({ name: equipment.name, icon: equipment.icon || '⚔️', quantity: 1 });
            }
          }
          break;
        case 'GRANT_HERO': {
          if (effect.heroId) {
            const hero = createUniqueAdventurer(effect.heroId);
            if (hero) {
              GameState.adventurers.push(hero);
              acquisitions.push({ name: hero.name, icon: hero.avatarIcon || '👑', quantity: 1 });
              console.log(`🎉【英雄加入】${hero.name} 已正式加入您的領地麾下！`);
            }
          }
          break;
        }
        case 'SCHEDULE_NODE':
          state.scheduledNodes[this.getNodeKey(storyId, effect.nodeId)] = GameState.totalDays + Math.max(0, effect.delayDays);
          break;
        case 'PRESENT_NODE':
          // 等目前對話的同步關閉流程完成後再開下一節，避免兩個 modal 互相覆蓋。
          queueMicrotask(() => this.presentInteractiveNode(storyId, effect.nodeId, true));
          break;
        case 'UNLOCK_MAP_NODE': {
          const mapSystem = GameState.mapSystem;
          const target = mapSystem?.getNodeById(effect.nodeId)
            || mapSystem?.getNodeById(`secret_${effect.nodeId}`)
            || mapSystem?.getNodes().find(node => node.narrativeSubjugation?.templateId === effect.nodeId);
          if (target) {
            target.isHidden = false;
            target.isDiscovered = true;
            EventBus.getInstance().publish({
              type: GameEventType.MAP_NODES_CHANGED,
              payload: { reason: 'UNLOCKED', nodeId: target.id }
            });
          }
          break;
        }
        case 'REMOVE_MAP_NODE': {
          const mapSystem = GameState.mapSystem;
          const targetId = effect.nodeId;
          if (mapSystem && targetId) {
            const stableId = targetId.startsWith('story_') ? targetId : `story_${storyId}_${targetId}`;
            const target = mapSystem.getNodeById(targetId) || mapSystem.getNodeById(stableId);
            if (target) {
              mapSystem.removeDynamicNode(target.id);
            }
          }
          break;
        }
        case 'CREATE_SUBJUGATION_NODE':
          this.createSubjugationNode(storyId, effect.definition);
          break;
        case 'REDUCE_POPULATION_PERCENT': {
          const territory = GameState.myTerritory;
          const minP = Math.max(0, Math.min(100, effect.minPercent ?? 0));
          const maxP = Math.max(minP, Math.min(100, effect.maxPercent ?? minP));
          const percent = minP === maxP ? minP : Math.round(minP + Math.random() * (maxP - minP));
          const totalPop = territory.population;
          const lostCount = Math.min(totalPop, Math.max(1, Math.round(totalPop * (percent / 100))));
          if (lostCount > 0) {
            TerritoryDefenseSystem.reducePopulationRandomly(territory, lostCount);
            console.log(`⚠️【領地損失】領地遭遇懲罰事件，隨機損失了 ${lostCount} 名領民（扣除 ${percent}% 人口）！請至書房重新調整工作分配。`);
          }
          break;
        }
        case 'REDUCE_RESOURCE_PERCENT': {
          const territory = GameState.myTerritory;
          const minP = Math.max(0, Math.min(100, effect.minPercent ?? 0));
          const maxP = Math.max(minP, Math.min(100, effect.maxPercent ?? minP));
          const percent = minP === maxP ? minP : Math.round(minP + Math.random() * (maxP - minP));
          const factor = percent / 100;
          const res = effect.resource;

          if (res === 'GOLD' || res === 'ALL') {
            const lost = Math.round(territory.gold * factor);
            territory.gold = Math.max(0, territory.gold - lost);
          }
          if (res === 'FOOD' || res === 'ALL') {
            const lost = Math.round(territory.food * factor);
            territory.food = Math.max(0, territory.food - lost);
          }
          if (res === 'WOOD' || res === 'ALL') {
            const lost = Math.round(territory.wood * factor);
            territory.wood = Math.max(0, territory.wood - lost);
          }
          if (res === 'STONE' || res === 'ALL') {
            const lost = Math.round(territory.stone * factor);
            territory.stone = Math.max(0, territory.stone - lost);
          }
          if (res === 'IRON' || res === 'ALL') {
            const lost = Math.round(territory.iron * factor);
            territory.iron = Math.max(0, territory.iron - lost);
          }
          console.log(`📉【物資損失】領地扣除了 ${res} 庫存的 ${percent}%！`);
          break;
        }
        case 'REDUCE_PRESTIGE_PERCENT': {
          const minP = Math.max(0, Math.min(100, effect.minPercent ?? 0));
          const maxP = Math.max(minP, Math.min(100, effect.maxPercent ?? minP));
          const percent = minP === maxP ? minP : Math.round(minP + Math.random() * (maxP - minP));
          const lost = Math.round(GameState.myTerritory.prestige * (percent / 100));
          GameState.myTerritory.prestige = Math.max(0, GameState.myTerritory.prestige - lost);
          console.log(`📉【聲望受挫】領主聲望下降了 ${lost} 點（-${percent}%）！`);
          break;
        }
        case 'REDUCE_BUILDING_LEVEL': {
          const territory = GameState.myTerritory;
          const levels = Math.max(1, effect.levels ?? 1);
          const bId = effect.buildingId;
          if (bId === 'defense' && territory.defenseLevel > 0) territory.defenseLevel = Math.max(0, territory.defenseLevel - levels);
          else if (bId === 'tavern' && territory.tavernLevel > 0) territory.tavernLevel = Math.max(0, territory.tavernLevel - levels);
          else if (bId === 'forge' && territory.forgeLevel > 0) territory.forgeLevel = Math.max(0, territory.forgeLevel - levels);
          else if (bId === 'weapon' && territory.weaponShopLevel > 0) territory.weaponShopLevel = Math.max(0, territory.weaponShopLevel - levels);
          else if (bId === 'armor' && territory.armorShopLevel > 0) territory.armorShopLevel = Math.max(0, territory.armorShopLevel - levels);
          else if (bId === 'church' && territory.churchLevel > 0) territory.churchLevel = Math.max(0, territory.churchLevel - levels);
          else if (bId === 'farmland' && territory.farmlandLevel > 1) territory.farmlandLevel = Math.max(1, territory.farmlandLevel - levels);
          else if (bId === 'lumberMill' && territory.lumberMillLevel > 1) territory.lumberMillLevel = Math.max(1, territory.lumberMillLevel - levels);
          else if (bId === 'quarry' && territory.quarryLevel > 1) territory.quarryLevel = Math.max(1, territory.quarryLevel - levels);
          else if (bId === 'huntingGround' && territory.huntingGroundLevel > 1) territory.huntingGroundLevel = Math.max(1, territory.huntingGroundLevel - levels);
          console.log(`🏚️【建築受損】領地建築「${bId}」受損降低了 ${levels} 級！`);
          break;
        }
        case 'REDUCE_RANDOM_BUILDING_LEVEL': {
          const territory = GameState.myTerritory;
          const count = Math.max(1, effect.count ?? 1);
          const levels = Math.max(1, effect.levels ?? 1);

          // 收集所有已建造/等級可降的建築
          const candidates: { id: string; name: string; getLvl: () => number; setLvl: (v: number) => void; minLvl: number }[] = [];
          if (territory.defenseLevel > 0) candidates.push({ id: 'defense', name: '城牆/城防', getLvl: () => territory.defenseLevel, setLvl: v => territory.defenseLevel = v, minLvl: 0 });
          if (territory.tavernLevel > 0) candidates.push({ id: 'tavern', name: '酒館', getLvl: () => territory.tavernLevel, setLvl: v => territory.tavernLevel = v, minLvl: 0 });
          if (territory.forgeLevel > 0) candidates.push({ id: 'forge', name: '鐵匠鋪', getLvl: () => territory.forgeLevel, setLvl: v => territory.forgeLevel = v, minLvl: 0 });
          if (territory.weaponShopLevel > 0) candidates.push({ id: 'weapon', name: '武器店', getLvl: () => territory.weaponShopLevel, setLvl: v => territory.weaponShopLevel = v, minLvl: 0 });
          if (territory.armorShopLevel > 0) candidates.push({ id: 'armor', name: '防具店', getLvl: () => territory.armorShopLevel, setLvl: v => territory.armorShopLevel = v, minLvl: 0 });
          if (territory.churchLevel > 0) candidates.push({ id: 'church', name: '教會/醫療所', getLvl: () => territory.churchLevel, setLvl: v => territory.churchLevel = v, minLvl: 0 });
          if (territory.farmlandLevel > 1) candidates.push({ id: 'farmland', name: '農田', getLvl: () => territory.farmlandLevel, setLvl: v => territory.farmlandLevel = v, minLvl: 1 });
          if (territory.lumberMillLevel > 1) candidates.push({ id: 'lumberMill', name: '伐木場', getLvl: () => territory.lumberMillLevel, setLvl: v => territory.lumberMillLevel = v, minLvl: 1 });
          if (territory.quarryLevel > 1) candidates.push({ id: 'quarry', name: '採石場', getLvl: () => territory.quarryLevel, setLvl: v => territory.quarryLevel = v, minLvl: 1 });
          if (territory.huntingGroundLevel > 1) candidates.push({ id: 'huntingGround', name: '獵場', getLvl: () => territory.huntingGroundLevel, setLvl: v => territory.huntingGroundLevel = v, minLvl: 1 });

          if (candidates.length > 0) {
            const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, count);
            shuffled.forEach(target => {
              const curLvl = target.getLvl();
              const newLvl = Math.max(target.minLvl, curLvl - levels);
              target.setLvl(newLvl);
              console.log(`💥【隨機災害】領地「${target.name}」受損降為 Lv.${newLvl} (扣減 ${curLvl - newLvl} 級)！`);
            });
          }
          break;
        }
        case 'TRIGGER_RAID': {
          TerritoryDefenseSystem.startLiveSiegeDefense(storyId, effect, sourceNodeId);
          break;
        }
      }
    }
    AcquisitionNotification.enqueue(acquisitions);
  }

  private static createSubjugationNode(storyId: string, definition: Extract<NarrativeEffect, { type: 'CREATE_SUBJUGATION_NODE' }>['definition']): MapNode | null {
    const mapSystem = GameState.mapSystem;
    if (!mapSystem || !definition.nodeId) return null;
    const stableId = `story_${storyId}_${definition.nodeId}`;
    const existing = mapSystem.getNodeById(stableId);
    if (existing) return existing;

    const template = definition.templateId ? DataStore.getSubjugationTemplates().find(t => t.id === definition.templateId) : undefined;
    const terrainKey = definition.terrain || template?.terrain || 'RUINS';
    const finalDifficulty = Math.max(1, definition.difficulty ?? template?.difficulty ?? 2);
    const requiresScouting = definition.requiresScouting ?? template?.requiresScouting ?? false;
    const removeOnVictory = definition.removeOnVictory ?? (template?.removeOnVictory !== false);

    const playerNode = mapSystem.getNodes().find(node => node.isPlayerBase);
    const anchor = definition.placement === 'NEAR_NODE'
      ? mapSystem.getNodeById(definition.anchorNodeId ?? '') ?? playerNode
      : playerNode;
    let x = definition.x ?? anchor?.x ?? 50;
    let y = definition.y ?? anchor?.y ?? 50;
    if (definition.placement !== 'FIXED') {
      const radius = Math.max(3, definition.radius ?? 8);
      const hash = [...stableId].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 7);
      for (let attempt = 0; attempt < 12; attempt++) {
        const angle = ((hash % 360) + attempt * 31) * Math.PI / 180;
        const candidateX = Math.max(2, Math.min(98, (anchor?.x ?? 50) + Math.cos(angle) * radius));
        const candidateY = Math.max(2, Math.min(98, (anchor?.y ?? 50) + Math.sin(angle) * radius));
        const occupied = mapSystem.getNodes().some(item => Math.hypot(item.x - candidateX, item.y - candidateY) < 3);
        x = candidateX;
        y = candidateY;
        if (!occupied) break;
      }
    }

    const node: MapNode = {
      id: stableId,
      name: definition.name || template?.name || definition.nodeId,
      description: definition.description || template?.description || '',
      x,
      y,
      population: 0,
      prosperity: 0,
      nodeLevel: NodeLevel.WILDERNESS,
      ownerFactionId: null,
      isPlayerBase: false,
      isDiscovered: true,
      terrain: TerrainType[terrainKey as keyof typeof TerrainType] || TerrainType.RUINS,
      feature: NodeFeature.SUBJUGATION,
      isHidden: false,
      isDynamic: true,
      baseDifficulty: finalDifficulty,
      establishedBaseMonsterId: definition.monsterId || undefined,
      isScouted: !requiresScouting,
      scoutExpiryDate: null,
      currentWeather: WeatherType.CLEAR,
      weatherDuration: 0,
      narrativeSubjugation: {
        storyId,
        sourceNodeId: definition.nodeId,
        templateId: definition.templateId,
        journeyNodeIds: definition.journeyNodeIds ?? [],
        victoryNodeId: definition.victoryNodeId,
        victoryDelayDays: definition.victoryDelayDays,
        defeatNodeId: definition.defeatNodeId,
        defeatDelayDays: definition.defeatDelayDays,
        removeOnVictory,
        enemyFeature: definition.enemyFeature
      }
    };
    mapSystem.addStoryNode(node);
    EventBus.getInstance().publish({ type: GameEventType.MISSIONS_CHANGED, payload: { reason: 'PROGRESSED' } });
    return node;
  }

  private static unlockStoryNode({ story, node }: NarrativeNodeRef): void {
    if (!node.targetNodeId) return;
    const target = GameState.mapSystem?.getNodeById(node.targetNodeId);
    if (!target) return;
    target.isHidden = false;
    target.isDiscovered = true;
    this.markPresented(story.id, node.id);
    this.completeNode(story.id, node.id);
  }

  private static markPresented(storyId: string, nodeId: string): void {
    const state = this.ensureState();
    const key = this.getNodeKey(storyId, nodeId);
    if (!state.presentedNodeIds.includes(key)) state.presentedNodeIds.push(key);
  }

  static resetStory(storyId: string): void {
    const state = this.ensureState();
    const story = this.getStories().find(item => item.id === storyId);
    const ownedFacts = new Set<string>();
    for (const node of story?.nodes ?? []) {
      for (const effect of [...node.completionEffects, ...node.choices.flatMap(choice => choice.effects)]) {
        if (effect.type === 'SET_FACT') ownedFacts.add(effect.fact);
      }
    }
    for (const fact of ownedFacts) delete state.facts[fact];
    const prefix = `${storyId}:`;
    state.completedNodeIds = state.completedNodeIds.filter(key => !key.startsWith(prefix));
    state.presentedNodeIds = state.presentedNodeIds.filter(key => !key.startsWith(prefix));
    for (const key of Object.keys(state.scheduledNodes)) {
      if (key.startsWith(prefix)) delete state.scheduledNodes[key];
    }
    if (GameState.mapSystem) {
      for (const node of [...GameState.mapSystem.getNodes()]) {
        if (node.narrativeSubjugation?.storyId === storyId) GameState.mapSystem.removeDynamicNode(node.id);
      }
    }
  }
}
