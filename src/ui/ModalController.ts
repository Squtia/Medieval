import { positionFloatingElement } from './FloatingPosition';
import { renderEquipIcon } from './ShopController';
import { ToastManager } from './ToastManager';
import { Adventurer } from '../models/Adventurer';
import { EquipmentSlot, MapNode, NodeLevel, NodeFeature, AdventurerState, getMaxCaravansLimit, FactionChampion } from '../models/types';
import { GameState } from '../core/GameState';
import { renderAdventurerCard } from './components/AdventurerCard';
import { EnhancementSystem } from '../systems/EnhancementSystem';
import { UIManager } from './UIManager';
import { DataStore } from '../systems/DataStore';

/** 共用工具：產生裝備屬性的 Tooltip HTML，格式對齊圖三樣式 */

import { EquipmentGenerator } from '../systems/EquipmentGenerator';
import { DispatchTask, EnemyFeature, TaskType, TradeInstruction, TradePhase, SubjugationMode } from '../models/DispatchTask';
import { monsterSystem } from '../systems/MonsterSystem';
import { GAME_EVENTS } from '../data/EventData';
import { startRoutePlanning } from './MapController';
import { TRADE_GOODS } from '../systems/MarketSystem';
import { DispatchSystem, ActiveMission } from '../systems/DispatchSystem';
import { CombatUIManager } from './CombatUIManager';
import { Random } from '../core/Random';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import {
  getCombatPrestigeReward,
  getDifficultyModifiers
} from '../data/BalanceData';
import { FormationDB } from '../systems/FormationDB';
import { getAdventurerSkillInfo, getAdventurerPassiveInfo } from '../data/SkillData';


export async function openWarehouse(isForgeMode: boolean) {
  const { openWarehouse: impl } = await import('./ShopController');
  impl(isForgeMode);
}


import { PartyModalController } from './modals/PartyModalController';

export function getSelectedPartyAdventurer() { return PartyModalController.getInstance().getSelectedPartyAdventurer(); }
export function selectPartyAdventurer(adv: Adventurer | null) { PartyModalController.getInstance().selectPartyAdventurer(adv); }
export function setPartyTab(tab: 'stats' | 'equip' | 'skills') { PartyModalController.getInstance().setPartyTab(tab); }
export function renderPartyUpperSection() { PartyModalController.getInstance().renderPartyUpperSection(); }
export function openAdvDetail(adv: Adventurer) { PartyModalController.getInstance().open(adv); }

let currentSelectedPresetIndex: number = 0;
let presetEventsInitialized: boolean = false;

export function openDispatchSetup(node: MapNode, actionType: 'subjugation' | 'war' | 'diplomacy') {
  import('./modals/DispatchModalController').then(m => m.DispatchModalController.getInstance().openDispatchSetup(node, actionType));
}

export function openEventModal(event: any) {
  import('./modals/EventModalController').then(m => m.EventModalController.getInstance().openEventModal(event));
}




export async function openTradePlanner(plannedRouteNodeIds: string[]) {
  const { openTradePlanner: impl } = await import('./TradeController');
  impl(plannedRouteNodeIds);
}


export function openTodoModal() {
  import('./modals/TodoModalController').then(m => m.TodoModalController.getInstance().openTodoModal());
}

// === 情報迷霧與節點詳細面板 ===

export function closeNodeDetailPanel() { import("./modals/NodeDetailModalController").then(m => m.NodeDetailModalController.getInstance().closeNodeDetailPanel()); }

export function openNodeDetailPanel(node: MapNode) { import("./modals/NodeDetailModalController").then(m => m.NodeDetailModalController.getInstance().openNodeDetailPanel(node)); }


/**
 * 開啟市場交易與商隊派遣視窗
 */
export async function openTradeModal(node: MapNode) { const m = await import("./modals/NodeDetailModalController"); return m.NodeDetailModalController.getInstance().openTradeModal(node); }

export function openCombatHistory() {
  const panel = document.getElementById('combat-history-panel')!;
  const listContainer = document.getElementById('combat-history-list')!;

  panel.classList.add('active');
  listContainer.innerHTML = '';

  if (!GameState.myTerritory.combatHistory || GameState.myTerritory.combatHistory.length === 0) {
    listContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">目前沒有任何近期的戰鬥紀錄。</p>';
    return;
  }

  GameState.myTerritory.combatHistory.forEach(record => {
    const isVictory = record.report.isVictory;
    const titleColor = isVictory ? '#10b981' : '#ef4444';
    const titleText = isVictory ? '勝利' : '失敗';

    const card = document.createElement('div');
    card.style.cssText = 'background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;';

    card.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
        <div style="font-size: 1em; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <span style="color: ${titleColor};">【${titleText}】</span> ${record.nodeName}
          <span style="font-size: 0.8em; color: #64748b; font-weight: normal; margin-left: 8px;">(第 ${record.day} 天)</span>
        </div>
        <div style="font-size: 0.82em; color: #cbd5e1;">
          MVP: <span style="color: #eab308; font-weight: bold;">${record.report.mvpName || '無'}</span> |
          傷害: <span style="color: #f87171;">${record.report.totalDamageDealt || 0}</span> |
          收益: <span style="color: #fbbf24;">${record.report.lootValue || 0}</span>
        </div>
      </div>
      <button class="action-btn replay-btn" style="padding: 6px 12px; font-size: 0.82em; background: rgba(59,130,246,0.4); border-color: #3b82f6; margin-left: 10px; flex-shrink: 0;">🎬 重播</button>
    `;

    const replayBtn = card.querySelector('.replay-btn') as HTMLButtonElement;
    replayBtn.onclick = () => {
      panel.classList.remove('active');
      CombatUIManager.replayCombat(record.report);
    };

    listContainer.appendChild(card);
  });
}

export async function renderWeaponShop() {
  const { renderWeaponShop: impl } = await import('./ShopController');
  impl();
}

export async function renderArmorShop() {
  const { renderArmorShop: impl } = await import('./ShopController');
  impl();
}

export function openPrisonerModal(champion: import('../models/types').FactionChampion) {
  import('./modals/PrisonerModalController').then(m => m.PrisonerModalController.getInstance().openPrisonerModal(champion));
}
