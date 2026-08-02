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
function buildEquipStatsHtml(eq: any): string {
  const effects = eq.effects || {};
  const combatEffects = eq.combatEffects || {};
  const allStats = { ...effects, ...combatEffects } as Record<string, number>;

  // 張数：辨識斀屬性對應 label 與顏色
  const combatStatMeta: Record<string, { label: string; color: string; icon: string }> = {
    patk:  { label: '物攻', color: '#f59e0b', icon: '🗡️' },
    pdef:  { label: '物防', color: '#ef4444', icon: '🛡️' },
    matk:  { label: '魔攻', color: '#a78bfa', icon: '✨' },
    mdef:  { label: '魔防', color: '#60a5fa', icon: '🗡️' },
    hp:    { label: 'HP', color: '#f87171', icon: '❤️' },
    hit:   { label: '命中', color: '#3b82f6', icon: '🎯' },
    evade: { label: '閃避', color: '#3b82f6', icon: '💨' },
    spd:   { label: '速度', color: '#3b82f6', icon: '⚡' },
    crit:  { label: '暴擊率', color: '#eab308', icon: '🔥' },
  };
  const attrStatMeta: Record<string, { label: string; color: string }> = {
    str:   { label: '力量 (STR)', color: '#22c55e' },
    agi:   { label: '敏捷 (AGI)', color: '#22c55e' },
    con:   { label: '體質 (CON)', color: '#22c55e' },
    int:   { label: '智慧 (INT)', color: '#22c55e' },
    spr:   { label: '精神 (SPR)', color: '#22c55e' },
    luk:   { label: '幸運 (LUK)', color: '#22c55e' },
    charm: { label: '魅力 (CHA)', color: '#22c55e' },
    command: { label: '統御 (CMD)', color: '#22c55e' },
  };

  let combatHtml = '';
  let attrHtml = '';

  for (const [key, val] of Object.entries(allStats)) {
    if (!val) continue;
    const v = val as number;
    if (combatStatMeta[key]) {
      const m = combatStatMeta[key];
      combatHtml += `<div style="display:flex; justify-content:space-between; width:100%; gap:8px;"><span style="color:#94a3b8;">${m.icon} ${m.label}</span><span style="color:${m.color}; font-weight:bold;">+${v}</span></div>`;
    } else if (attrStatMeta[key]) {
      const m = attrStatMeta[key];
      attrHtml += `<div style="display:flex; justify-content:space-between; width:100%; gap:8px;"><span style="color:#94a3b8;">&#9670; ${m.label}</span><span style="color:${m.color}; font-weight:bold;">+${v}</span></div>`;
    }
  }

  let result = '';
  if (combatHtml) {
    result += `<div style="color:#fbbf24; font-size:0.8em; font-weight:bold; margin-top:6px; margin-bottom:3px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">戰鬥效果：</div>${combatHtml}`;
  }
  if (attrHtml) {
    result += `<div style="color:#4ade80; font-size:0.8em; font-weight:bold; margin-top:6px; margin-bottom:3px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">屬性加成：</div>${attrHtml}`;
  }
  if (!result) result = '<div style="color:#64748b; font-size:0.85em;">無額外屬性</div>';
  return result;
}
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
import { getAdventurerSkillInfo, getAdventurerPassiveInfo } from '../models/Skill';

function initPresetEvents() {
  if (presetEventsInitialized) return;
  presetEventsInitialized = true;

  const presetBtns = document.querySelectorAll('.btn-preset');
  const saveBtn = document.getElementById('btn-save-preset');

  function updatePresetButtonUI() {
    presetBtns.forEach(btn => {
      const idx = parseInt((btn as HTMLElement).dataset.preset || '0');
      if (idx === currentSelectedPresetIndex) {
        (btn as HTMLElement).style.background = 'rgba(59,130,246,0.5)';
        (btn as HTMLElement).style.borderColor = '#3b82f6';
        (btn as HTMLElement).style.color = '#fff';
      } else {
        (btn as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
        (btn as HTMLElement).style.borderColor = 'transparent';
        (btn as HTMLElement).style.color = '#d4c4a8';
      }
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.preset || '0');
      currentSelectedPresetIndex = idx;
      updatePresetButtonUI();
      
      const preset = GameState.formationPresets ? GameState.formationPresets[idx] : null;
      if (preset && preset.gridMap) {
        currentFormationId = preset.formationId || 'DEFAULT';
        currentGridMap = {};
        selectedAdventurersForDispatch.clear();
        
        let missingNames: string[] = [];
        
        for (const [slot, advId] of Object.entries(preset.gridMap)) {
          const adv = GameState.adventurers.find(a => a.id === advId);
          if (adv) {
            if (adv.currentState === AdventurerState.IDLE) {
              if (selectedAdventurersForDispatch.size < 5) {
                currentGridMap[slot] = advId;
                selectedAdventurersForDispatch.add(advId);
              }
            } else {
              missingNames.push(adv.name);
            }
          }
        }
        
        renderDispatchTeamRoster();
        renderDispatchAdvList();
        
        if (missingNames.length > 0) {
          ToastManager.show(`隊伍讀取不完整：${missingNames.join(', ')} 正在執行其他任務或休養中。`);
        } else {
          ToastManager.show(`已讀取隊伍 ${idx + 1}`);
        }
      } else {
        ToastManager.show(`隊伍 ${idx + 1} 尚未儲存任何配置`);
      }
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!GameState.formationPresets) {
        GameState.formationPresets = [];
      }
      
      // Ensure the array has enough elements
      while (GameState.formationPresets.length <= currentSelectedPresetIndex) {
        GameState.formationPresets.push({
          id: `preset_${GameState.formationPresets.length}`,
          name: `隊伍 ${GameState.formationPresets.length + 1}`,
          formationId: 'DEFAULT',
          gridMap: {}
        });
      }
      
      GameState.formationPresets[currentSelectedPresetIndex] = {
        id: `preset_${currentSelectedPresetIndex}`,
        name: `隊伍 ${currentSelectedPresetIndex + 1}`,
        formationId: currentFormationId,
        gridMap: { ...currentGridMap }
      };
      
      ToastManager.show(`已將當前配置儲存至隊伍 ${currentSelectedPresetIndex + 1}`);
    });
  }
  
  updatePresetButtonUI();
}

export async function openWarehouse(isForgeMode: boolean) {
  const { openWarehouse: impl } = await import('./ShopController');
  impl(isForgeMode);
}

let currentPartyAdv: Adventurer | null = null;
let currentPartyTab: 'stats' | 'equip' | 'skills' = 'stats';
let tempAllocations: Record<string, number> = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };

export function getSelectedPartyAdventurer(): Adventurer | null {
  return currentPartyAdv;
}

export function selectPartyAdventurer(adv: Adventurer | null) {
  if (currentPartyAdv !== adv) {
    currentPartyAdv = adv;
    tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
  }
  renderPartyUpperSection();
}

export function setPartyTab(tab: 'stats' | 'equip' | 'skills') {
  currentPartyTab = tab;
  const btnStats = document.getElementById('tab-btn-stats');
  const btnEquip = document.getElementById('tab-btn-equip');
  const btnSkills = document.getElementById('tab-btn-skills');

  const inactiveStyle = (btn: HTMLElement | null) => {
    if (!btn) return;
    btn.className = 'party-tab-btn';
    btn.style.border = '1px solid rgba(255,255,255,0.1)';
    btn.style.background = 'rgba(255,255,255,0.05)';
    btn.style.color = '#94a3b8';
  };

  const activeStyle = (btn: HTMLElement | null) => {
    if (!btn) return;
    btn.className = 'party-tab-btn active';
    btn.style.border = '1px solid rgba(234,179,8,0.4)';
    btn.style.background = 'rgba(234,179,8,0.2)';
    btn.style.color = '#eab308';
  };

  inactiveStyle(btnStats);
  inactiveStyle(btnEquip);
  inactiveStyle(btnSkills);

  if (tab === 'stats') activeStyle(btnStats);
  else if (tab === 'equip') activeStyle(btnEquip);
  else if (tab === 'skills') activeStyle(btnSkills);

  renderPartyUpperSection();
}

export function renderPartyUpperSection() {
  if (!currentPartyAdv || !GameState.adventurers.includes(currentPartyAdv)) {
    currentPartyAdv = GameState.adventurers[0] || null;
  }
  const adv = currentPartyAdv;
  const titleEl = document.getElementById('party-panel-title');
  if (!adv) {
    if (titleEl) titleEl.textContent = '🛡️ 冒險者小隊 (無冒險者)';
    const viewport = document.getElementById('party-tab-viewport');
    if (viewport) viewport.innerHTML = '<div style="color:#94a3b8; text-align:center; padding-top:40px;">目前尚無冒險者，請至酒館招募！</div>';
    const cardEl = document.getElementById('party-portrait-card');
    if (cardEl) cardEl.style.display = 'none';
    return;
  }

  const cardEl = document.getElementById('party-portrait-card');
  if (cardEl) cardEl.style.display = 'flex';

  // 1. 更新頂部動態冒險者姓名標題
  if (titleEl) {
    titleEl.textContent = `🛡️ ${adv.name}`;
  }

  // 2. 更新左側常駐立繪卡與基本資訊
  const avatarWrapper = document.getElementById('party-portrait-img-wrapper');
  const jobTraitEl = document.getElementById('party-job-trait');
  const traitNameEl = document.getElementById('party-trait-name');
  const statusBadgeEl = document.getElementById('party-status-badge');
  const displayClass = (adv as any).currentClass || adv.job.name;

  if (avatarWrapper) {
    const nameHash = adv.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const avatarIndex = adv.avatarIndex ?? (nameHash % 24);
    adv.avatarIndex = avatarIndex;

    const bgX = (avatarIndex % 6) * 20;
    const bgY = Math.floor(avatarIndex / 6) * 33.3333;
    avatarWrapper.innerHTML = `
      <span style="font-size: 3.2em; position: absolute;">🦸</span>
      <div style="width: 100%; height: 100%; position: absolute; inset: 0; background-image: url('assets/avatars_6x4.jpg'); background-size: auto 400%; background-position: ${bgX}% ${bgY}%;"></div>
    `;
  }
  if (jobTraitEl) jobTraitEl.textContent = `Lv.${adv.level} ${displayClass}`;
  if (traitNameEl) traitNameEl.textContent = adv.trait.name;

  const stats = adv.getCombatStats();
  const hpTextEl = document.getElementById('party-bar-hp-text');
  const hpFillEl = document.getElementById('party-bar-hp-fill');
  const mpTextEl = document.getElementById('party-bar-mp-text');
  const mpFillEl = document.getElementById('party-bar-mp-fill');
  const xpFillEl = document.getElementById('party-bar-xp-fill');
  const xpTextEl = document.getElementById('party-bar-xp-text');
  
  if (hpTextEl) hpTextEl.textContent = `${stats.hp} / ${stats.hp}`;
  if (hpFillEl) hpFillEl.style.width = '100%';
  if (mpTextEl) mpTextEl.textContent = `${stats.mp} / ${stats.mp}`;
  if (mpFillEl) mpFillEl.style.width = '100%';
  if (xpFillEl) {
    const isMax = adv.level >= 10;
    const xpPercent = isMax ? 100 : Math.min(100, Math.max(0, (adv.xp / adv.getRequiredXP()) * 100));
    xpFillEl.style.width = `${xpPercent}%`;
    if (xpTextEl) {
      xpTextEl.textContent = isMax ? 'MAX' : `${Math.floor(adv.xp)} / ${adv.getRequiredXP()}`;
    }
  }

  if (statusBadgeEl) {
    if (adv.currentState === AdventurerState.RESTING) {
      statusBadgeEl.textContent = `🛌 休養(${adv.restingDaysLeft}天)`;
      statusBadgeEl.style.background = 'rgba(234, 179, 8, 0.2)';
      statusBadgeEl.style.color = '#fde047';
      statusBadgeEl.style.borderColor = 'rgba(234, 179, 8, 0.4)';
    } else if (adv.currentState !== AdventurerState.IDLE) {
      statusBadgeEl.textContent = '🔴 任務中';
      statusBadgeEl.style.background = 'rgba(239, 68, 68, 0.2)';
      statusBadgeEl.style.color = '#f87171';
      statusBadgeEl.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
      statusBadgeEl.textContent = '🟢 閒置中';
      statusBadgeEl.style.background = 'rgba(34, 197, 94, 0.2)';
      statusBadgeEl.style.color = '#4ade80';
      statusBadgeEl.style.borderColor = 'rgba(34, 197, 94, 0.4)';
    }
  }

  // 3. 更新中間 Viewport (根據當前頁籤)
  const viewport = document.getElementById('party-tab-viewport');
  if (!viewport) return;

  const attr = adv.getEffectiveAttributes();

  if (currentPartyTab === 'stats') {
    const sumAllocated = tempAllocations.str + tempAllocations.agi + tempAllocations.con + tempAllocations.int + tempAllocations.spr + tempAllocations.luk;
    const tempUnspent = adv.unspentStatPoints - sumAllocated;
    
    const baseStats = adv.getCombatStats();
    const previewStats = adv.getCombatStats(undefined, tempAllocations);
    const baseAttr = adv.getEffectiveAttributes();
    const previewAttr = adv.getEffectiveAttributes(undefined, tempAllocations);
    const currentPower = adv.getPower();
    const previewPower = adv.getPower(tempAllocations);

    const formatStat = (currVal: number, prevVal: number, isPercent = false, prefix = '') => {
      const diff = prevVal - currVal;
      if (diff > 0) {
        return `${prefix}${prevVal}${isPercent ? '%' : ''} <span style="color:#22c55e; font-weight:bold; font-size:0.85em;">(+${diff})</span>`;
      }
      return `${prefix}${currVal}${isPercent ? '%' : ''}`;
    };

    const getStatRow = (label: string, key: 'str' | 'agi' | 'con' | 'int' | 'spr' | 'luk', val: number) => {
      const tempVal = tempAllocations[key] || 0;
      const btnStyle = "width: 20px; height: 20px; line-height: 16px; text-align: center; border-radius: 4px; cursor: pointer; border: 1px solid; font-weight: bold; font-size: 0.8em;";
      const plusBtn = tempUnspent > 0 
        ? `<button class="btn-temp-plus" data-stat="${key}" style="${btnStyle} background:rgba(34,197,94,0.3); border-color:#22c55e; color:#fff;">+</button>` 
        : `<div style="width: 20px;"></div>`;
      const minusBtn = tempVal > 0 
        ? `<button class="btn-temp-minus" data-stat="${key}" style="${btnStyle} background:rgba(239,68,68,0.3); border-color:#ef4444; color:#fff;">-</button>` 
        : `<div style="width: 20px;"></div>`;
      const greenStr = tempVal > 0 ? `<span style="color:#22c55e; font-weight:bold; width: 28px; text-align: left; padding-left: 2px;">(+${tempVal})</span>` : `<span style="width: 28px;"></span>`;
      return `
        <div style="display:flex; align-items:center; font-size:0.78em; background:rgba(255,255,255,0.03); padding:2px 6px; border-radius:4px;">
          <span style="flex:1; color:#94a3b8; white-space:nowrap; overflow:hidden;">${label}</span>
          <span style="font-weight:bold; color:#f1f5f9; width: 20px; text-align: right; flex-shrink:0;">${val + tempVal}</span>
          ${greenStr}
          <div style="display: flex; gap: 4px; margin-left: 4px; flex-shrink:0;">${minusBtn}${plusBtn}</div>
        </div>`;
    };

    const confirmBtnsHtml = `
      <div style="display: flex; gap: 6px; margin-top: 6px; flex-shrink: 0;">
        <button id="btn-confirm-stats" class="action-btn" ${sumAllocated > 0 ? '' : 'disabled'} style="flex:1; ${sumAllocated > 0 ? 'background:linear-gradient(135deg, #059669, #047857); color:#fff; cursor:pointer;' : 'background:rgba(255,255,255,0.05); color:#64748b; border-color:rgba(255,255,255,0.1); opacity:0.35; cursor:not-allowed;'} padding:5px 0; font-size:0.8em; font-weight:bold; transition:all 0.2s;">確認分配</button>
        <button id="btn-reset-stats" class="action-btn" ${sumAllocated > 0 ? '' : 'disabled'} style="flex:1; ${sumAllocated > 0 ? 'background:rgba(255,255,255,0.1); color:#ebdcb6; cursor:pointer;' : 'background:rgba(255,255,255,0.05); color:#64748b; border-color:rgba(255,255,255,0.1); opacity:0.35; cursor:not-allowed;'} padding:5px 0; font-size:0.8em; transition:all 0.2s;">重設</button>
      </div>
    `;

    viewport.innerHTML = `
      <div style="font-size: 0.8em; margin-bottom: 4px; background: rgba(234,179,8,0.12); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(234,179,8,0.2); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <span>⚔️ 綜合戰力：<b style="color:#eab308; font-size: 1.05em;">${previewPower > currentPower ? `${previewPower} <span style="color:#22c55e; font-size:0.85em;">(+${previewPower - currentPower})</span>` : currentPower}</b></span>
        <span>✨ 可用點數：<b style="color:#facc15; font-size: 1.05em;">${tempUnspent}</b></span>
      </div>

      <div style="font-size:0.8em; color:#eab308; font-weight:bold; margin: 4px 0 2px 0; border-bottom:1px solid rgba(234,179,8,0.3); padding-bottom:2px; flex-shrink: 0;">基礎屬性：</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; flex-shrink: 0;">
        ${getStatRow('STR 力量', 'str', baseAttr.str)}
        ${getStatRow('AGI 敏捷', 'agi', baseAttr.agi)}
        ${getStatRow('CON 體質', 'con', baseAttr.con)}
        ${getStatRow('INT 智慧', 'int', baseAttr.int)}
        ${getStatRow('SPR 精神', 'spr', baseAttr.spr)}
        ${getStatRow('LUK 幸運', 'luk', baseAttr.luk)}
        <div style="display:flex; align-items:center; font-size:0.78em; background:rgba(255,255,255,0.03); padding:2px 6px; border-radius:4px;">
          <span style="flex:1; color:#94a3b8; white-space:nowrap; overflow:hidden;">CHM 魅力</span>
          <span style="font-weight:bold; color:#f472b6; width: 20px; text-align: right; flex-shrink:0;">${baseAttr.charm || 0}</span>
          <span style="width: 28px;"></span>
          <div style="display: flex; gap: 4px; margin-left: 4px; flex-shrink:0;"><div style="width: 44px;"></div></div>
        </div>
        <div style="display:flex; align-items:center; font-size:0.78em; background:rgba(255,255,255,0.03); padding:2px 6px; border-radius:4px;">
          <span style="flex:1; color:#94a3b8; white-space:nowrap; overflow:hidden;">CMD 統帥</span>
          <span style="font-weight:bold; color:#60a5fa; width: 20px; text-align: right; flex-shrink:0;">${baseAttr.command || 0}</span>
          <span style="width: 28px;"></span>
          <div style="display: flex; gap: 4px; margin-left: 4px; flex-shrink:0;"><div style="width: 44px;"></div></div>
        </div>
      </div>

      ${confirmBtnsHtml}

      <div style="font-size:0.8em; color:#eab308; font-weight:bold; margin: 6px 0 2px 0; border-bottom:1px solid rgba(234,179,8,0.3); padding-bottom:2px; flex-shrink: 0;">戰鬥屬性：</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 4px; flex-shrink: 0;">
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">物攻 (PATK)</span><span style="color:#eab308; font-weight:bold;">${formatStat(baseStats.patk, previewStats.patk)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">魔攻 (MATK)</span><span style="color:#a855f7; font-weight:bold;">${formatStat(baseStats.matk, previewStats.matk)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">物防 (PDEF)</span><span style="color:#eab308; font-weight:bold;">${formatStat(baseStats.pdef, previewStats.pdef)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">魔防 (MDEF)</span><span style="color:#a855f7; font-weight:bold;">${formatStat(baseStats.mdef, previewStats.mdef)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">命中 (HIT)</span><span style="color:#3b82f6;">${formatStat(baseStats.hit, previewStats.hit)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">閃避 (EVD)</span><span style="color:#3b82f6;">${formatStat(baseStats.evade, previewStats.evade)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">爆擊率</span><span style="color:#f97316; font-weight:bold;">${formatStat(baseStats.critRate, previewStats.critRate, true)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">爆擊傷害</span><span style="color:#f97316; font-weight:bold;">${formatStat(baseStats.critDmg, previewStats.critDmg, true)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">狀態抗性</span><span style="color:#f43f5e; font-weight:bold;">${formatStat((baseAttr.con || 0) + (baseAttr.spr || 0), (previewAttr.con || 0) + (previewAttr.spr || 0), true)}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">HP回復</span><span style="color:#22c55e; font-weight:bold;">${formatStat(Math.floor((baseAttr.con || 0) * 0.5), Math.floor((previewAttr.con || 0) * 0.5), false, '+')}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px; grid-column: span 2;"><span style="color:#94a3b8;">MP回復</span><span style="color:#3b82f6; font-weight:bold;">${formatStat(Math.floor((baseAttr.spr || 0) * 0.5), Math.floor((previewAttr.spr || 0) * 0.5), false, '+')}</span></div>
      </div>
    `;

    viewport.querySelectorAll('.btn-temp-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).getAttribute('data-stat')!;
        tempAllocations[key] = (tempAllocations[key] || 0) + 1;
        renderPartyUpperSection();
      });
    });

    viewport.querySelectorAll('.btn-temp-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).getAttribute('data-stat')!;
        if ((tempAllocations[key] || 0) > 0) {
          tempAllocations[key]--;
        }
        renderPartyUpperSection();
      });
    });

    const btnConfirm = viewport.querySelector('#btn-confirm-stats');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        for (const [key, val] of Object.entries(tempAllocations)) {
          if (val > 0) {
            for (let i = 0; i < val; i++) {
              adv.allocateStat(key as any);
            }
          }
        }
        tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
        renderPartyUpperSection();
        UIManager.updateUI();
      });
    }

    const btnReset = viewport.querySelector('#btn-reset-stats');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
        renderPartyUpperSection();
      });
    }
  } else if (currentPartyTab === 'equip') {
    const slots = [
      { key: EquipmentSlot.WEAPON, name: '武器', icon: '🗡️' },
      { key: EquipmentSlot.ARMOR, name: '防具', icon: '🛡️' },
      { key: EquipmentSlot.ACCESSORY, name: '飾品', icon: '💍' }
    ];

    let equipRowsHtml = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">';
    slots.forEach(s => {
      const eq = adv.equipment[s.key];
      if (eq) {
        const lvlStr = eq.enhancementLevel ? `<div style="color:#3b82f6; font-size:0.9em; font-weight:bold;">+${eq.enhancementLevel}</div>` : '';
        const statsHtml = buildEquipStatsHtml(eq);

        const iconHtml = renderEquipIcon(eq, 36);
        const jobMeta = eq.allowedJobs && eq.allowedJobs.length > 0
          ? `<div style="color:#94a3b8; font-size:0.8em; margin-bottom:4px;">職業：${eq.allowedJobs.join('/')}</div>`
          : '';
        const tooltipHtml = `
          <div style="font-size: 1.05em; color: #eab308; border-bottom: 1px solid rgba(234,179,8,0.3); padding-bottom: 4px; margin-bottom: 4px; display:flex; align-items:center; gap:6px;">
            ${iconHtml} <b>${eq.name}</b> ${eq.enhancementLevel ? `<span style="color:#3b82f6;">+${eq.enhancementLevel}</span>` : ''}
          </div>
          ${jobMeta}
          <div style="font-size: 0.88em; display: flex; flex-direction: column; gap: 2px;">
            ${statsHtml}
          </div>
        `;
        equipRowsHtml += `
          <div class="equip-card-square tooltip-eq-trigger" data-slot="${s.key}" data-html-tip="${encodeURIComponent(tooltipHtml)}" style="position:relative; background:rgba(15,23,42,0.6); border:1px solid rgba(234,179,8,0.3); border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px 5px; cursor:pointer;">
            <div style="flex:1; display:flex; align-items:center; justify-content:center;">${iconHtml}</div>
            <div style="font-size:0.78em; font-weight:bold; color:#f1f5f9; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; padding:0 2px;">${eq.name}</div>
            ${lvlStr}
          </div>
        `;
      } else {
        equipRowsHtml += `
          <div class="equip-card-square" data-slot="${s.key}" style="background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.15); border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px 5px; cursor:pointer; color:#64748b; font-size:0.85em; text-align:center; transition: background 0.2s;">
            <div style="font-size:1.8em; margin-bottom:6px; opacity:0.5;">${s.icon}</div>
            <div>${s.name}</div>
            <div style="color:#3b82f6; margin-top:4px; font-size:0.9em; font-weight:bold;">+ 裝備</div>
          </div>
        `;
      }
    });
    equipRowsHtml += '</div>';

    const canRetire = adv.trait.name !== '誓約守衛';
    const retireBtnHtml = canRetire ? `
        <button id="btn-party-retire-init" class="action-btn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 2px 6px; font-size: 0.72em; border-radius: 4px; cursor: pointer;">
          🚪 退休...
        </button>
        <div id="retire-confirm-group" style="display:none; gap:4px;">
          <button id="btn-party-retire-confirm" class="action-btn" style="background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #f87171; padding: 2px 6px; font-size: 0.72em; border-radius: 4px; cursor: pointer;">
            ⚠️ 確認退休
          </button>
          <button id="btn-party-retire-cancel" class="action-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; padding: 2px 6px; font-size: 0.72em; border-radius: 4px; cursor: pointer;">
            取消
          </button>
        </div>
    ` : `<span style="font-size: 0.72em; color: #64748b; font-style: italic;">誓約守衛不可退休</span>`;

    viewport.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:0.85em; color:#eab308; font-weight:bold;">裝備槽位：</span>
        ${retireBtnHtml}
      </div>
      ${equipRowsHtml}
    `;

    // 處理裝備 Tooltip
    viewport.querySelectorAll('.tooltip-eq-trigger').forEach(card => {
      card.addEventListener('mouseenter', (e) => {
        const raw = (e.currentTarget as HTMLElement).getAttribute('data-html-tip');
        if (!raw) return;
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.innerHTML = decodeURIComponent(raw);
          tEl.style.opacity = '1';
        }
      });
      card.addEventListener('mousemove', (e: Event) => {
        const mouseEv = e as MouseEvent;
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          positionFloatingElement(tEl, mouseEv.clientX, mouseEv.clientY);
        }
      });
      card.addEventListener('mouseleave', () => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';
      });
    });

    viewport.querySelectorAll('.equip-card-square').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';
        const slotKey = (e.currentTarget as HTMLElement).getAttribute('data-slot') as EquipmentSlot;
        openEquipSelect(adv, slotKey);
      });
    });

    const btnRetireInit = viewport.querySelector('#btn-party-retire-init') as HTMLButtonElement;
    const retireConfirmGroup = viewport.querySelector('#retire-confirm-group') as HTMLDivElement;
    const btnRetireConfirm = viewport.querySelector('#btn-party-retire-confirm') as HTMLButtonElement;
    const btnRetireCancel = viewport.querySelector('#btn-party-retire-cancel') as HTMLButtonElement;

    if (btnRetireInit && retireConfirmGroup && btnRetireConfirm && btnRetireCancel) {
      btnRetireInit.addEventListener('click', () => {
        btnRetireInit.style.display = 'none';
        retireConfirmGroup.style.display = 'flex';
      });

      btnRetireCancel.addEventListener('click', () => {
        retireConfirmGroup.style.display = 'none';
        btnRetireInit.style.display = 'block';
      });

      btnRetireConfirm.addEventListener('click', () => {
        if (confirm(`確定要讓 ${adv.name} 退休嗎？\n退休後將利用其魅力 (當前: ${attr.charm}) 永久提升領地每日稅收！`)) {
          const slotsArr = [EquipmentSlot.WEAPON, EquipmentSlot.ARMOR, EquipmentSlot.ACCESSORY];
          slotsArr.forEach(s => {
            const eq = adv.equipment[s];
            if (eq) {
              adv.unequip(s);
              GameState.myTerritory.addEquipmentToWarehouse(eq);
            }
          });
          GameState.myTerritory.retireAdventurer(adv);
          const index = GameState.adventurers.indexOf(adv);
          if (index !== -1) {
            GameState.adventurers.splice(index, 1);
          }
          currentPartyAdv = GameState.adventurers[0] || null;
          renderPartyUpperSection();
          UIManager.updateUI();
        }
      });
    }
  } else if (currentPartyTab === 'skills') {
    const skillsList = getAdventurerSkillInfo(adv);
    const passivesList = getAdventurerPassiveInfo(adv);

    let skillsCardsHtml = '';
    const learnedSkills = skillsList.filter(item => item.isLearned);
    if (learnedSkills.length === 0) {
      skillsCardsHtml = '<div style="font-size:0.75em; color:#94a3b8; grid-column: span 2;">目前尚無已學習的主動技能</div>';
    } else {
      learnedSkills.forEach(item => {
        const { skill } = item;
        const tooltipHtml = `
          <div style="font-size: 1.05em; color: #eab308; border-bottom: 1px solid rgba(234,179,8,0.3); padding-bottom: 4px; margin-bottom: 4px;">
            ✨ <b>${skill.name}</b>
          </div>
          <div style="font-size: 0.85em; color: #cbd5e1; margin-bottom: 4px;">
            ${skill.description}
          </div>
          <div style="font-size: 0.8em; color: #94a3b8; display:flex; gap:10px;">
            <span>耗魔: <b style="color:#3b82f6;">${skill.mpCost} MP</b></span>
            <span>冷卻: <b style="color:#f59e0b;">${skill.cooldown || 0} 回合</b></span>
          </div>
        `;
        const encodedTip = encodeURIComponent(tooltipHtml);

        skillsCardsHtml += `
          <div class="skill-card tooltip-eq-trigger" data-html-tip="${encodedTip}" style="background: rgba(15,23,42,0.7); border: 1px solid rgba(234,179,8,0.3); border-radius: 5px; padding: 6px 8px; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
            <div style="font-size: 0.82em; font-weight: bold; color: #fef08a; display: flex; justify-content: space-between; align-items: center;">
              <span>${skill.name}</span>
              <span style="font-size: 0.72em; color: #60a5fa; background: rgba(59,130,246,0.15); padding: 1px 4px; border-radius: 3px;">${skill.mpCost} MP</span>
            </div>
            <div style="font-size: 0.72em; color: #94a3b8; margin-top: 4px; display: flex; justify-content: space-between;">
              <span>${item.category === 'ADVANCED' ? '⭐ 終極招' : '⚔️ 基礎'}</span>
              <span>CD: ${skill.cooldown || 0}t</span>
            </div>
          </div>
        `;
      });
    }

    let passivesHtml = '';
    passivesList.forEach(pas => {
      passivesHtml += `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 4px 8px; font-size: 0.78em;">
          <div style="color: #fbbf24; font-weight: bold; display: flex; align-items: center; gap: 4px;">
            <span>${pas.icon}</span><span>${pas.name}</span>
          </div>
          <div style="color: #cbd5e1; font-size: 0.9em; margin-top: 2px;">${pas.description}</div>
        </div>
      `;
    });

    viewport.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; overflow-y: auto; padding-right: 2px;">
        <div style="font-size:0.8em; color:#eab308; font-weight:bold; border-bottom:1px solid rgba(234,179,8,0.3); padding-bottom:2px; flex-shrink: 0;">⚔️ 主動技能：</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; flex-shrink: 0;">
          ${skillsCardsHtml}
        </div>

        <div style="font-size:0.8em; color:#eab308; font-weight:bold; margin-top: 4px; border-bottom:1px solid rgba(234,179,8,0.3); padding-bottom:2px; flex-shrink: 0;">🛡️ 職業天賦與被動：</div>
        <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
          ${passivesHtml || '<div style="font-size:0.75em; color:#94a3b8;">暫無額外被動效果</div>'}
        </div>

        <!-- Gambit 戰術策略預留卡槽 -->
        <div id="gambit-strategy-container" style="margin-top: 6px; background: rgba(15,23,42,0.6); border: 1px dashed rgba(234,179,8,0.4); border-radius: 6px; padding: 6px 8px; flex-shrink: 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-size:0.78em; color:#facc15; font-weight:bold;">🎯 Gambit 戰術策略 (預留 Slot)</span>
            <span style="font-size:0.68em; color:#94a3b8; background:rgba(255,255,255,0.05); padding:1px 4px; border-radius:3px;">智慧 AI 動態評估</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:3px;">
            <div style="font-size:0.72em; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:3px 6px; border-radius:4px; color:#cbd5e1; display:flex; justify-content:space-between; align-items:center;">
              <span>[戰術 1] If 隊友 HP < 40% ➔ 優先施放防禦/治療</span>
              <span style="color:#64748b; font-size:0.9em;">🔒 擴充槽</span>
            </div>
            <div style="font-size:0.72em; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:3px 6px; border-radius:4px; color:#cbd5e1; display:flex; justify-content:space-between; align-items:center;">
              <span>[戰術 2] If 敵方有後排 ➔ 優先遠程/貫穿斬殺</span>
              <span style="color:#64748b; font-size:0.9em;">🔒 擴充槽</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // 綁定技能 Tooltip 事件
    viewport.querySelectorAll('.tooltip-eq-trigger').forEach(card => {
      card.addEventListener('mouseenter', (e) => {
        const raw = (e.currentTarget as HTMLElement).getAttribute('data-html-tip');
        if (!raw) return;
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.innerHTML = decodeURIComponent(raw);
          tEl.style.opacity = '1';
        }
      });
      card.addEventListener('mousemove', (e: Event) => {
        const mouseEvent = e as MouseEvent;
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.style.left = `${mouseEvent.clientX + 15}px`;
          tEl.style.top = `${mouseEvent.clientY + 15}px`;
        }
      });
      card.addEventListener('mouseleave', () => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.style.opacity = '0';
        }
      });
    });
  }
}

export function openAdvDetail(adv: Adventurer) {
  selectPartyAdventurer(adv);
  const modal = document.getElementById('modal-party-list');
  if (modal) {
    modal.classList.add('active');
  }
}

export function openEquipSelect(adv: Adventurer, slotKey: EquipmentSlot) {
  const equipSelectPane = document.getElementById('party-equip-select-pane');
  const equipSelectList = document.getElementById('equip-select-list')!;
  const myTerritory = GameState.myTerritory;
  
  if (!equipSelectPane || !equipSelectList) return;

  equipSelectList.innerHTML = '';
  
  const gridContainer = document.createElement('div');
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = 'repeat(3, 90px)';
  gridContainer.style.gap = '8px';
  gridContainer.style.justifyContent = 'center';
  equipSelectList.appendChild(gridContainer);

  const availableEqs = myTerritory.warehouse.filter(e => e.slot === slotKey);

  // 若當前有裝備，提供「卸下」選項
  const currentEq = adv.equipment[slotKey];
  if (currentEq) {
    const unequipCard = document.createElement('div');
    unequipCard.className = 'equip-card-square';
    unequipCard.style.position = 'relative';
    unequipCard.style.width = '90px';
    unequipCard.style.height = '100px';
    unequipCard.style.background = 'rgba(239, 68, 68, 0.12)';
    unequipCard.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    unequipCard.style.borderRadius = '6px';
    unequipCard.style.display = 'flex';
    unequipCard.style.flexDirection = 'column';
    unequipCard.style.alignItems = 'center';
    unequipCard.style.justifyContent = 'center';
    unequipCard.style.padding = '6px 4px';
    unequipCard.style.cursor = 'pointer';
    unequipCard.style.transition = 'all 0.2s';
    unequipCard.innerHTML = `
      <div style="font-size:1.6em; margin-bottom:2px;">⛔</div>
      <strong style="color:#f87171; font-size:0.78em;">卸下裝備</strong>
    `;
    unequipCard.addEventListener('click', () => {
      adv.unequip(slotKey);
      GameState.myTerritory.addEquipmentToWarehouse(currentEq);
      equipSelectPane.style.display = 'none';
      renderPartyUpperSection();
      UIManager.updateUI();
    });
    gridContainer.appendChild(unequipCard);
  }

  if (availableEqs.length === 0) {
    equipSelectList.insertAdjacentHTML('beforeend', `<p style="text-align:center; color:#94a3b8; grid-column: span 3; margin-top: 20px; font-size: 0.85em;">倉庫中沒有符合條件的裝備。</p>`);
  } else {
    availableEqs.forEach(eq => {
      const isJobAllowed = !eq.allowedJobs || eq.allowedJobs.length === 0 || eq.allowedJobs.includes(adv.job.name);
      
      const card = document.createElement('div');
      card.className = 'equip-card-square tooltip-eq-trigger';
      card.style.position = 'relative';
      card.style.width = '90px';
      card.style.height = '100px';
      card.style.background = isJobAllowed ? 'rgba(15,23,42,0.7)' : 'rgba(30,27,75,0.4)';
      card.style.border = isJobAllowed ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(239,68,68,0.4)';
      card.style.borderRadius = '6px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      card.style.padding = '6px 4px';
      card.style.cursor = isJobAllowed ? 'pointer' : 'not-allowed';
      card.style.opacity = isJobAllowed ? '1' : '0.65';
      card.style.transition = 'all 0.2s';

      const statsHtml = buildEquipStatsHtml(eq);
      const jobTagHtml = eq.allowedJobs && eq.allowedJobs.length > 0 
        ? `<div style="color:#f59e0b; font-size:0.82em; margin-top:2px; font-weight:bold;">🏷️ 限制職業: ${eq.allowedJobs.join('/')}</div>` 
        : '';
      const iconHtml = renderEquipIcon(eq, 38);
      const tooltipHtml = `
        <div style="font-size: 1.05em; color: #eab308; border-bottom: 1px solid rgba(234,179,8,0.3); padding-bottom: 4px; margin-bottom: 4px; display:flex; align-items:center; gap:6px;">
          ${iconHtml} <b>${eq.name}</b> ${eq.enhancementLevel ? `<span style="color:#3b82f6;">+${eq.enhancementLevel}</span>` : ''}
        </div>
        ${jobTagHtml}
        <div style="font-size: 0.85em; display: flex; flex-direction: column; gap: 2px; margin-top: 4px;">
          ${statsHtml}
        </div>
      `;

      card.setAttribute('data-html-tip', encodeURIComponent(tooltipHtml));

      const lvlStr = eq.enhancementLevel ? `<div style="color:#3b82f6; font-size:0.75em; font-weight:bold;">+${eq.enhancementLevel}</div>` : '';
      const jobDisallowedBadge = !isJobAllowed ? `<div style="color:#ef4444; font-size:0.68em; font-weight:bold; margin-top:1px;">職業不符</div>` : '';

      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center; padding:2px;">
          ${iconHtml}
        </div>
        <div style="display:flex; justify-content:space-between; width:100%; border-top:1px solid rgba(255,255,255,0.12); padding-top:2px; margin-top:2px;">
          ${jobDisallowedBadge || lvlStr || '<div style="font-size:0.7em; color:#94a3b8;">可裝備</div>'}
        </div>
      `;

      // 綁定 Tooltip
      card.addEventListener('mouseenter', (e) => {
        const raw = (e.currentTarget as HTMLElement).getAttribute('data-html-tip');
        if (!raw) return;
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.innerHTML = decodeURIComponent(raw);
          tEl.style.opacity = '1';
        }
      });
      card.addEventListener('mousemove', (e: Event) => {
        const mouseEv = e as MouseEvent;
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.style.left = mouseEv.clientX + 10 + 'px';
          tEl.style.top = mouseEv.clientY + 10 + 'px';
        }
      });
      card.addEventListener('mouseleave', () => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';
      });

      card.addEventListener('click', () => {
        try {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0'; // hide tooltip on click

          const [canEquipOk, reasons] = adv.canEquip(eq);
          if (!canEquipOk) {
            ToastManager.show(`⚠️ 無法裝備：${reasons.join(', ')}`);
            return;
          }

          if (currentEq) {
             adv.unequip(slotKey);
             myTerritory.addEquipmentToWarehouse(currentEq);
          }
          adv.equip(eq);
          myTerritory.removeEquipmentFromWarehouse(eq.uuid!);
          console.log(`[系統] ${adv.name} 裝備了 ${eq.name}！`);
          equipSelectPane.style.display = 'none';
          openAdvDetail(adv);
          UIManager.updateUI();
        } catch (e: any) {
          // ToastManager may be undefined, use console
          console.error(e.message); 
        }
      });
      gridContainer.appendChild(card);
    });
  }

  equipSelectPane.style.display = 'flex';
}

// === Radial Menu 與派遣系統 ===

export function closeRadialMenu() {
  const radialMenu = document.getElementById('radial-menu');
  if (radialMenu) {
    radialMenu.classList.remove('active');
    radialMenu.innerHTML = '';
  }
}

export function openRadialMenu(node: MapNode, targetEl: HTMLElement) {
  const radialMenu = document.getElementById('radial-menu')!;
  radialMenu.innerHTML = '';
  
  // 計算節點相對於 radial-menu 父元素的精確像素位置
  const nodeRect = targetEl.getBoundingClientRect();
  const parentEl = radialMenu.parentElement!;
  const parentRect = parentEl.getBoundingClientRect();
  
  const nodeCenterX = nodeRect.left - parentRect.left + nodeRect.width / 2;
  const nodeCenterY = nodeRect.top - parentRect.top + nodeRect.height / 2;

  radialMenu.style.left = `${nodeCenterX}px`;
  radialMenu.style.top = `${nodeCenterY}px`;

  // Tooltip（顯示在節點下方）
  const tooltip = document.createElement('div');
  tooltip.className = 'radial-tooltip';
  tooltip.id = 'radial-tooltip';
  radialMenu.appendChild(tooltip);
  
  const buttons: { icon: string, text: string, action: () => void, disabled?: boolean }[] = [];

  // 動態判斷可用功能
  if (node.ownerFactionId !== null && !node.isPlayerBase) {
    // UI-13: 間諜功能準備中，改為 disabled 灰色不可點擊（保留提醒待開發）
    buttons.push({ icon: '👁️', text: '派遣間諜 (開發中)', action: () => {}, disabled: true });
  }
  if (node.ownerFactionId === null && !node.isPlayerBase) {
    if (node.nodeLevel === NodeLevel.WILDERNESS) {
      buttons.push({ icon: '⛺', text: '在此建立據點', action: () => {
        if (GameState.mapSystem.foundSettlement(node.id, GameState.myTerritory)) {
          closeRadialMenu();
          import('./SceneController').then(m => m.enterSceneWithTransition(node));
        }
      }});
    }
  }
  if (!node.isPlayerBase) {
    if (node.ownerFactionId !== null) {
      buttons.push({ icon: '🛡️', text: '發動攻城戰', action: () => openDispatchSetup(node, 'war') });
    } else {
      buttons.push({ icon: '⚔️', text: '派遣傭兵討伐', action: () => openDispatchSetup(node, 'subjugation') });
    }
  }

  const radius = 60; // 圓半徑
  const angleStep = (2 * Math.PI) / buttons.length;

  // 根據節點在地圖中的位置，動態計算起始角度使按鈕朝向中央展開
  // node.x, node.y 是 0~100 的百分比座標
  // 計算方向：從節點指向地圖中心 (50, 50) 的角度
  const dirX = 50 - node.x; // 正值 = 偏右，負值 = 偏左
  const dirY = 50 - node.y; // 正值 = 偏下，負值 = 偏上
  const startAngle = Math.atan2(dirY, dirX) - (Math.PI * (buttons.length - 1)) / buttons.length / 2;

  buttons.forEach((btnInfo, index) => {
    const angle = startAngle + index * angleStep;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const btnEl = document.createElement('div');
    btnEl.className = 'radial-btn';
    
    // UI-13: 若為 disabled 狀態，加入灰色樣式且不可點擊
    if (btnInfo.disabled) {
      btnEl.style.opacity = '0.35';
      btnEl.style.filter = 'grayscale(1)';
      btnEl.style.cursor = 'not-allowed';
    }
    
    btnEl.innerHTML = btnInfo.icon;
    btnEl.style.left = `${x}px`;
    btnEl.style.top = `${y}px`;

    btnEl.addEventListener('mouseenter', () => {
      tooltip.textContent = btnInfo.text;
      tooltip.style.opacity = '1';
      tooltip.style.top = '80px';
    });
    btnEl.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      // UI-13: disabled 按鈕不觸發區塊
      if (btnInfo.disabled) return;
      btnInfo.action();
      closeRadialMenu();
    });

    radialMenu.appendChild(btnEl);
  });

  radialMenu.classList.add('active');
}

let pendingDispatchTask: DispatchTask | null = null;
let pendingDispatchNode: MapNode | null = null;
let selectedAdventurersForDispatch: Set<string> = new Set();
let selectedTroopsForDispatch: Record<string, number> = {};
let currentFormationId: string = 'DEFAULT';
let currentGridMap: Record<string, string> = {};
let dragDraggedAdvId: string | null = null;
let dragSourceSlot: string | null = null;
let currentSelectedPresetIndex: number = 0;
let presetEventsInitialized: boolean = false;

export function openDispatchSetup(node: MapNode, actionType: 'subjugation' | 'war' | 'diplomacy') {
  const modal = document.getElementById('modal-dispatch-setup')!;
  const title = document.getElementById('dispatch-setup-title')!;
  const desc = document.getElementById('dispatch-setup-desc')!;
  const reqPowerEl = document.getElementById('dispatch-req-power')!;
  
  pendingDispatchNode = node;
  selectedAdventurersForDispatch.clear();
  selectedTroopsForDispatch = {};
  currentFormationId = 'DEFAULT';
  currentGridMap = {};
  dragDraggedAdvId = null;
  dragSourceSlot = null;
  // 根據 NodeLevel 或自訂難度決定難度
  const difficultyModifiers = getDifficultyModifiers(GameState.worldGeneration?.difficulty);
  const rawBaseDiff = node.baseDifficulty !== undefined ? node.baseDifficulty : (node.nodeLevel === NodeLevel.WILDERNESS ? 10 : 20 + node.nodeLevel * 10);
  const baseDiff = Math.max(1, Math.round(rawBaseDiff * difficultyModifiers.enemyStrength));
  const rawMinPower = node.nodeLevel === NodeLevel.WILDERNESS ? 30 : 50 + node.nodeLevel * 40;
  const minPower = Math.max(1, Math.round(rawMinPower * difficultyModifiers.enemyStrength));
  
  const optionsContainer = document.getElementById('dispatch-subjugation-options')!;
  
  if (actionType === 'diplomacy') {
    optionsContainer.style.display = 'none';
    title.innerHTML = '🤝 外交使節隊伍編制';
    desc.textContent = `目標：${node.name} (派遣使節前往簽署通商條約)`;
    pendingDispatchTask = new DispatchTask(`外交使節前往${node.name}`, TaskType.DIPLOMACY, 3, 0, 50, 0, 30);
    pendingDispatchTask.targetNodeId = node.id;
  } else if (actionType === 'war') {
    optionsContainer.style.display = 'block';
    title.innerHTML = '🛡️ 攻城隊伍編制';
    const features = Object.values(EnemyFeature);
    const randomFeature = Random.pick(features);
    const prestigeReward = getCombatPrestigeReward(baseDiff, true, node.nodeLevel);
    pendingDispatchTask = new DispatchTask(`攻城${node.name}`, TaskType.COMBAT, 4, baseDiff, 100 + node.nodeLevel * 50, prestigeReward, minPower, randomFeature);
    pendingDispatchTask.targetNodeId = node.id;
    pendingDispatchTask.isWar = true;
    
    let fStr = '';
    if (randomFeature === EnemyFeature.HIGH_DEF) fStr = '（高防禦敵人：建議高攻擊與多波續戰能力）';
    if (randomFeature === EnemyFeature.HIGH_EVADE) fStr = '（高閃避敵人：建議高命中隊員）';
    desc.textContent = `目標：${node.name}${fStr} - 難度評估：${baseDiff}`;
  } else {
    optionsContainer.style.display = 'block';
    title.innerHTML = '⚔️ 討伐隊伍編制';
    const features = Object.values(EnemyFeature);
    const randomFeature = Random.pick(features);
    
    // 確保偵查資訊與討伐敵軍 100% 一致：優先取用 node.scoutData 已持久化的 garrisonEncounter
    const enemyLineup = (node.scoutData && node.scoutData.garrisonEncounter && node.scoutData.garrisonEncounter.length > 0)
      ? node.scoutData.garrisonEncounter
      : monsterSystem.generateNodeEncounter(node);
    
    // 計算與四捨五入駐軍真實戰力，建議戰力 100% 對齊真實駐軍
    const rawGarrisonPower = (node.scoutData && node.scoutData.garrisonPower !== undefined)
      ? node.scoutData.garrisonPower
      : (enemyLineup ? enemyLineup.reduce((sum, m) => sum + m.calculatedPowerScore, 0) : 0);
    const subjugationMinPower = rawGarrisonPower > 0 ? Math.round(rawGarrisonPower) : minPower;

    // 討伐任務需要較長天數 (預設 4 天)
    const prestigeReward = getCombatPrestigeReward(baseDiff, false, node.nodeLevel);
    pendingDispatchTask = new DispatchTask(`討伐${node.name}`, TaskType.COMBAT, 4, baseDiff, 100 + node.nodeLevel * 50, prestigeReward, subjugationMinPower, randomFeature);
    pendingDispatchTask.targetNodeId = node.id;
    pendingDispatchTask.enemyLineup = enemyLineup;
    
    let fStr = '';
    if (enemyLineup && enemyLineup.length > 0) {
      const monsterNames = enemyLineup.map(m => m.name).join('、');
      const elemStr = node.scoutData?.mainElements && node.scoutData.mainElements.length > 0 ? ` [威脅元素: ${node.scoutData.mainElements.join('/')}]` : '';
      const affixStr = node.scoutData?.affix ? ` [據點詞綴: ${node.scoutData.affix}]` : '';
      fStr = `\n情報回報：據點駐守 ${enemyLineup.length} 隻【${monsterNames}】${elemStr}${affixStr}`;
    } else {
      if (randomFeature === EnemyFeature.HIGH_DEF) fStr = '（高防禦敵人：建議高攻擊與多波續戰能力）';
      if (randomFeature === EnemyFeature.HIGH_EVADE) fStr = '（高閃避敵人：建議高命中隊員）';
    }
    desc.textContent = `目標：${node.name}${fStr} - 難度評估：${baseDiff}`;
  }

  reqPowerEl.textContent = `🎯 建議戰力：${pendingDispatchTask.minPowerRequired}`;
  
  // 討伐模式切換與動態提示說明
  const modeRadios = document.querySelectorAll('input[name="subjugation-mode"]');
  const hintEl = document.getElementById('subjugation-mode-hint');
  
  const updateSubjugationHint = () => {
    const selectedMode = (document.querySelector('input[name="subjugation-mode"]:checked') as HTMLInputElement)?.value;
    if (pendingDispatchTask && actionType !== 'diplomacy') {
      const baseGold = 100 + node.nodeLevel * 50;
      const basePrestige = getCombatPrestigeReward(baseDiff, false, node.nodeLevel);
      if (selectedMode === 'PROGRESS') {
        pendingDispatchTask.subjugationMode = SubjugationMode.PROGRESS;
        pendingDispatchTask.totalWaves = 3;
        pendingDispatchTask.expectedGold = Math.floor(baseGold * 3.5);
        pendingDispatchTask.expectedPrestige = Math.floor(basePrestige * 3.5);
        if (hintEl) {
          hintEl.innerHTML = '🔥 <span style="color:#fbbf24; font-weight:bold;">【連續平定】(3波)</span>：連續交戰 3 波敵軍，成功全勝後據點將徹底平定並<span style="color:#ef4444; font-weight:bold;">【從地圖消失】</span>，獲得 <span style="color:#fbbf24;">3.5 倍</span> 基礎獎勵，並<span style="color:#a855f7; font-weight:bold;">必定獲得 1 件對應難度裝備</span>！';
        }
      } else {
        pendingDispatchTask.subjugationMode = SubjugationMode.SINGLE;
        pendingDispatchTask.totalWaves = 1;
        pendingDispatchTask.expectedGold = baseGold;
        pendingDispatchTask.expectedPrestige = basePrestige;
        if (hintEl) {
          hintEl.innerHTML = '💡 <span style="color:#38bdf8; font-weight:bold;">【單次討伐】(1波)</span>：討伐成功後獲得基礎戰利品，據點<span style="color:#4ade80; font-weight:bold;">【保留在地圖上】</span>供重複練級刷資源。';
        }
      }
    }
  };

  modeRadios.forEach(radio => {
    radio.removeEventListener('change', updateSubjugationHint);
    radio.addEventListener('change', () => {
      updateSubjugationHint();
      renderDispatchTeamRoster();
    });
  });
  updateSubjugationHint();
  
  const playerBase = GameState.mapSystem.getNodes().find(candidate => candidate.isPlayerBase);
  if (playerBase && GameState.roadSystem && pendingDispatchTask) {
    const roadTiming = GameState.roadSystem.getMissionDays(
      pendingDispatchTask.requiredDays,
      playerBase,
      node
    );
    if (roadTiming.hasRoad) {
      pendingDispatchTask.baseRequiredDays = roadTiming.baseDays;
      pendingDispatchTask.requiredDays = roadTiming.adjustedDays;
      pendingDispatchTask.roadBenefitApplied = true;
    }
  }

  renderDispatchAdvList();
  renderDispatchTeamRoster();
  initPresetEvents();

  // 更新確認按鈕事件
  const btnConfirm = document.getElementById('btn-confirm-dispatch')!;
  const newBtn = btnConfirm.cloneNode(true) as HTMLButtonElement;
  btnConfirm.parentNode!.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener('click', () => {
    if (selectedAdventurersForDispatch.size === 0) {
      ToastManager.show('請至少選擇一名冒險者！');
      return;
    }
    const team = GameState.adventurers.filter(a => selectedAdventurersForDispatch.has(a.id));
    if (pendingDispatchTask) {
      const totalPower = team.reduce((sum, adventurer) => sum + adventurer.power, 0);
      if (
        totalPower < pendingDispatchTask.minPowerRequired &&
        !confirm(`我方戰力 ${totalPower} 低於建議戰力 ${pendingDispatchTask.minPowerRequired}，預估勝率偏低，仍要出征嗎？`)
      ) {
        return;
      }
      if (actionType === 'subjugation' || actionType === 'war') {
        const selectedMode = (document.querySelector('input[name="subjugation-mode"]:checked') as HTMLInputElement)?.value as any;
        pendingDispatchTask.subjugationMode = selectedMode;
        if (selectedMode === 'PROGRESS') {
           pendingDispatchTask.totalWaves = 3;
        }
        
        // 驗證總派兵數是否超過領地庫存 (只有 WAR 模式才會帶兵)
        if (pendingDispatchTask.isWar) {
          const terr = GameState.myTerritory;
          const totals: Record<string, number> = { INFANTRY: 0, CAVALRY: 0, ARCHER: 0 };
          // selectedTroopsForDispatch is Record<string, any> where any is {type, count}
          for (const [id, tObj] of Object.entries(selectedTroopsForDispatch)) {
            const t = tObj as any;
            if (t.type !== 'NONE' && selectedAdventurersForDispatch.has(id)) {
               totals[t.type] += t.count;
            }
          }
          if ((totals.INFANTRY > (terr.workers.INFANTRY || 0)) ||
              (totals.CAVALRY > (terr.workers.CAVALRY || 0)) ||
              (totals.ARCHER > (terr.workers.ARCHER || 0))) {
            ToastManager.show('派出的兵力總和超過了領地現有庫存！');
            return;
          }
          
          // 將有效兵力綁定至 Task
          pendingDispatchTask.troopAssignments = {};
          for (const [id, tObj] of Object.entries(selectedTroopsForDispatch)) {
            const t = tObj as any;
            if (t.type !== 'NONE' && t.count > 0 && selectedAdventurersForDispatch.has(id)) {
              pendingDispatchTask.troopAssignments[id] = { type: t.type, count: t.count };
            }
          }
        }
      }
      
      pendingDispatchTask.formationId = currentFormationId;
      pendingDispatchTask.gridMap = { ...currentGridMap };
      
      GameState.system.dispatchAdventurers(team, pendingDispatchTask);
      modal.classList.remove('active');
    }
  });

  const btnClose = document.getElementById('btn-close-dispatch-setup')!;
  btnClose.onclick = () => modal.classList.remove('active');

  modal.classList.add('active');
}

export function openEventModal(event: any) {
  const modal = document.getElementById('modal-event')!;
  document.getElementById('event-title')!.textContent = event.title;
  document.getElementById('event-desc')!.textContent = event.description;
  
  const optionsContainer = document.getElementById('event-options')!;
  optionsContainer.innerHTML = '';
  
  event.options.forEach((opt: any) => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => {
      // 攔截 console.log 來獲取事件執行的結果文字
      const oldLog = console.log;
      let resultMsg = '';
      console.log = (...args) => {
        resultMsg += args.join(' ') + '\n';
        oldLog(...args); // 依然輸出給原本的 logger
      };
      
      opt.onSelect();
      console.log = oldLog; // 恢復
      
      UIManager.updateUI();
      modal.classList.remove('active');
      
      // 將事件結果用 Toast 彈出，讓玩家知道得失 (傳入 0 表示持續顯示於該回合，玩家可點擊關閉)
      if (resultMsg.trim()) {
        import('./ToastManager').then(({ ToastManager }) => {
          const cleanMsg = resultMsg.replace(/\[.*?\]/g, '').trim(); // 移除標籤
          ToastManager.show(cleanMsg, 'info', 0);
        });
      }
    });
    optionsContainer.appendChild(btn);
  });
  
  modal.classList.add('active');
}

function renderDispatchTeamRoster() {
  const container = document.getElementById('dispatch-team-grid');
  if (!container) return;
  container.innerHTML = '';
  
  // Render Formation Selector
  const select = document.getElementById('dispatch-formation-select') as HTMLSelectElement;
  if (select) {
    select.innerHTML = '';
    GameState.unlockedFormations.forEach(fid => {
      const form = FormationDB.getFormation(fid);
      const option = document.createElement('option');
      option.value = fid;
      option.textContent = `${form.icon} ${form.name}`;
      if (fid === currentFormationId) option.selected = true;
      select.appendChild(option);
    });
    
    if (!select.dataset.bound) {
      select.dataset.bound = 'true';
      select.addEventListener('change', (e) => {
        currentFormationId = (e.target as HTMLSelectElement).value;
        renderDispatchTeamRoster();
      });
    }
  }
  
  const descEl = document.getElementById('dispatch-formation-desc');
  const activeFormation = FormationDB.getFormation(currentFormationId);
  if (descEl) {
    descEl.textContent = activeFormation.description;
  }
  
  const isFormationActive = FormationDB.isFormationActive(currentGridMap, currentFormationId);
  
  for (let vr = 0; vr < 3; vr++) {
    for (let vc = 0; vc < 3; vc++) {
      const r = 2 - vc;
      const c = vr;
      const slotId = `${r}_${c}`;
      const advId = currentGridMap[slotId];
      const adv = advId ? GameState.adventurers.find(a => a.id === advId) : null;
      
      const isRequired = activeFormation.requiredSlots.some(s => s.row === r && s.col === c);
      
      const slot = document.createElement('div');
      slot.className = 'grid-slot';
      slot.style.width = '95px';
      slot.style.height = '110px';
      slot.style.border = '2px dashed ' + (isRequired ? (isFormationActive ? '#10b981' : '#eab308') : 'rgba(255,255,255,0.2)');
      slot.style.borderRadius = '6px';
      slot.style.background = 'rgba(0,0,0,0.4)';
      slot.style.position = 'relative';
      slot.style.display = 'flex';
      slot.style.alignItems = 'center';
      slot.style.justifyContent = 'center';
      
      const label = document.createElement('div');
      label.textContent = r === 0 ? '前排' : r === 1 ? '中排' : '後排';
      label.style.position = 'absolute';
      label.style.bottom = '-20px';
      label.style.color = '#94a3b8';
      label.style.fontSize = '0.7em';
      label.style.whiteSpace = 'nowrap';
      slot.appendChild(label);
      
      slot.dataset.slotId = slotId;
      slot.addEventListener('dragover', (e) => { e.preventDefault(); });
      slot.addEventListener('drop', (e) => handleDropOnGrid(e, slotId));
      
      if (adv) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'adventurer-card';
        cardDiv.style.transform = 'scale(0.85)';
        cardDiv.style.transformOrigin = 'center';
        cardDiv.style.pointerEvents = 'auto'; 
        cardDiv.draggable = true;
        
        cardDiv.innerHTML = renderAdventurerCard(adv, {
          showDismissBtn: true,
          dismissId: adv.id
        });
        
        const displayClass = (adv as any).currentClass || adv.job.name;
        const tooltipHtml = `【${adv.name}】<br/>Lv.${adv.level} ${displayClass}<br/>戰力：${adv.power}`;
        
        cardDiv.addEventListener('mouseenter', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.opacity = '1'; }
        });
        cardDiv.addEventListener('mousemove', (e) => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
        });
        cardDiv.addEventListener('mouseleave', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
        });
        
        cardDiv.addEventListener('dragstart', (e) => {
          dragDraggedAdvId = adv.id;
          dragSourceSlot = slotId;
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
        });
        
        const removeBtn = cardDiv.querySelector('button');
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            delete currentGridMap[slotId];
            selectedAdventurersForDispatch.delete(adv.id);
            const tEl = document.getElementById('adv-tooltip');
            if (tEl) tEl.style.opacity = '0';
            renderDispatchTeamRoster();
            renderDispatchAdvList();
          });
        }
        
        slot.appendChild(cardDiv);
      } else if (isRequired) {
         const reqLabel = document.createElement('div');
         reqLabel.textContent = '📍';
         reqLabel.style.fontSize = '1.5em';
         reqLabel.style.opacity = '0.5';
         slot.appendChild(reqLabel);
      }
      
      container.appendChild(slot);
    }
  }
  
  const btnSave = document.getElementById('btn-save-preset');
  if (btnSave && !btnSave.dataset.bound) {
    btnSave.dataset.bound = 'true';
    btnSave.addEventListener('click', () => {
      if (Object.keys(currentGridMap).length === 0) {
        ToastManager.show('隊伍為空，無法儲存！');
        return;
      }
      if (GameState.formationPresets.length >= 5) {
        GameState.formationPresets.shift(); 
      }
      GameState.formationPresets.push({
        id: 'preset_' + Date.now(),
        name: `隊伍 ${GameState.formationPresets.length + 1}`,
        formationId: currentFormationId,
        gridMap: { ...currentGridMap }
      });
      ToastManager.show('隊伍配置已儲存！');
      renderDispatchTeamRoster();
    });
  }
  
  const presetBtns = document.querySelectorAll('.btn-preset');
  presetBtns.forEach((btn, index) => {
    const el = btn as HTMLElement;
    if (GameState.formationPresets[index]) {
      el.style.background = 'rgba(59,130,246,0.3)';
      el.style.color = '#fff';
      if (!el.dataset.bound) {
        el.dataset.bound = 'true';
        el.addEventListener('click', () => {
          const preset = GameState.formationPresets[index];
          currentFormationId = preset.formationId;
          currentGridMap = { ...preset.gridMap };
          selectedAdventurersForDispatch.clear();
          Object.values(currentGridMap).forEach(id => selectedAdventurersForDispatch.add(id as string));
          renderDispatchTeamRoster();
          renderDispatchAdvList();
        });
      }
    } else {
      el.style.background = 'rgba(255,255,255,0.1)';
      el.style.color = '#94a3b8';
    }
  });

  updateDispatchPowerPreview();
}

function handleDropOnGrid(e: DragEvent, targetSlotId: string) {
  e.preventDefault();
  if (!dragDraggedAdvId) return;
  
  if (dragSourceSlot && dragSourceSlot !== 'pool') {
    const existingAdvInTarget = currentGridMap[targetSlotId];
    if (existingAdvInTarget) {
      currentGridMap[dragSourceSlot] = existingAdvInTarget;
    } else {
      delete currentGridMap[dragSourceSlot];
    }
  } else {
    const existingAdvInTarget = currentGridMap[targetSlotId];
    if (!existingAdvInTarget && selectedAdventurersForDispatch.size >= 5) {
      ToastManager.show('隊伍最多只能派出 5 名傭兵！');
      dragDraggedAdvId = null;
      dragSourceSlot = null;
      return;
    }
    if (existingAdvInTarget) {
      selectedAdventurersForDispatch.delete(existingAdvInTarget);
    }
    selectedAdventurersForDispatch.add(dragDraggedAdvId);
  }
  
  currentGridMap[targetSlotId] = dragDraggedAdvId;
  dragDraggedAdvId = null;
  dragSourceSlot = null;
  
  renderDispatchTeamRoster();
  renderDispatchAdvList();
}

function renderDispatchAdvList() {
  const container = document.getElementById('dispatch-adv-list');
  if (!container) return;
  container.innerHTML = '';
  
  const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
  
  if (idleAdvs.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; grid-column: 1 / -1;">目前沒有閒置的冒險者可以派遣。</p>';
    return;
  }

  idleAdvs.forEach(adv => {
    const isSelected = selectedAdventurersForDispatch.has(adv.id);
    const card = document.createElement('div');
    card.className = 'adventurer-card';
    if (isSelected) {
      card.style.borderColor = '#3b82f6';
      card.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
      card.style.opacity = '0.5';
    } else {
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        dragDraggedAdvId = adv.id;
        dragSourceSlot = 'pool';
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';
      });
    }
    
    card.innerHTML = renderAdventurerCard(adv);
    
    const displayClass = (adv as any).currentClass || adv.job.name;
    const tooltipHtml = `【${adv.name}】<br/>Lv.${adv.level} ${displayClass}<br/>戰力：${adv.power}`;
    
    card.addEventListener('mouseenter', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.opacity = '1'; }
    });
    card.addEventListener('mousemove', (e) => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
    });
    card.addEventListener('mouseleave', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) tEl.style.opacity = '0';
    });

    card.addEventListener('click', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) tEl.style.opacity = '0';
      
      if (isSelected) {
        for (const [key, val] of Object.entries(currentGridMap)) {
          if (val === adv.id) delete currentGridMap[key];
        }
        selectedAdventurersForDispatch.delete(adv.id);
      } else {
        if (selectedAdventurersForDispatch.size >= 5) {
          ToastManager.show('隊伍最多只能派出 5 名傭兵！');
          return;
        }
        let found = false;
        for (let r=0; r<3; r++) {
          for (let c=0; c<3; c++) {
            const key = `${r}_${c}`;
            if (!currentGridMap[key]) {
              currentGridMap[key] = adv.id;
              selectedAdventurersForDispatch.add(adv.id);
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
      renderDispatchAdvList();
      renderDispatchTeamRoster();
    });

    container.appendChild(card);
  });
}

export async function openTradePlanner(plannedRouteNodeIds: string[]) {
  const { openTradePlanner: impl } = await import('./TradeController');
  impl(plannedRouteNodeIds);
}

function updateDispatchPowerPreview() {
  let totalPower = 0;
  GameState.adventurers.forEach(adv => {
    if (selectedAdventurersForDispatch.has(adv.id)) {
      totalPower += adv.power;
    }
  });
  const el = document.getElementById('dispatch-total-power')!;
  const riskEl = document.getElementById('dispatch-risk-preview')!;
  el.textContent = totalPower.toString();
  
  if (pendingDispatchTask && totalPower >= pendingDispatchTask.minPowerRequired) {
    el.style.color = '#10b981'; // 綠色
  } else {
    el.style.color = '#eab308'; // 黃色
  }
  if (pendingDispatchTask) {
    const ratio = pendingDispatchTask.minPowerRequired > 0 ? totalPower / pendingDispatchTask.minPowerRequired : 1;
    const risk = ratio >= 1.4 ? '低' : ratio >= 1 ? '中' : '高';
    const color = risk === '低' ? '#10b981' : risk === '中' ? '#f59e0b' : '#ef4444';
    const roadText = pendingDispatchTask.roadBenefitApplied
      ? `｜🛤️ 道路加速（原 ${pendingDispatchTask.baseRequiredDays} 天）`
      : '';
    riskEl.innerHTML = `風險：<strong style="color:${color}">${risk}</strong>｜耗時 ${pendingDispatchTask.requiredDays} 天${roadText}｜預期 💰${pendingDispatchTask.expectedGold}／✨${pendingDispatchTask.expectedPrestige}｜失敗將休養`;
  }
}

export function openTodoModal() {
  const modal = document.getElementById('modal-todo')!;
  const container = document.getElementById('todo-list-container')!;
  const territory = GameState.myTerritory;
  
  container.innerHTML = '';

  if (!territory || !territory.pendingEvents || territory.pendingEvents.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8;">目前沒有待辦事項。</p>';
  } else {
    territory.pendingEvents.forEach((eventId, index) => {
      const evt = GAME_EVENTS.find(e => e.id === eventId);
      if (!evt) return;

      const card = document.createElement('div');
      card.className = 'glass-panel';
      card.style.padding = '15px';
      card.style.borderLeft = '4px solid #eab308';
      
      const title = document.createElement('h3');
      title.style.margin = '0 0 10px 0';
      title.style.color = '#eab308';
      title.textContent = evt.title;
      card.appendChild(title);

      const desc = document.createElement('p');
      desc.style.color = '#e2e8f0';
      desc.style.fontSize = '0.9em';
      desc.style.lineHeight = '1.5';
      desc.style.marginBottom = '15px';
      desc.textContent = evt.description;
      card.appendChild(desc);

      const optionsDiv = document.createElement('div');
      optionsDiv.style.display = 'flex';
      optionsDiv.style.gap = '10px';

      evt.options.forEach((opt: any) => {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.flex = '1';
        btn.style.fontSize = '0.85em';
        btn.style.padding = '8px';
        btn.textContent = opt.text;
        
        btn.addEventListener('click', () => {
          // 執行效果
          opt.onSelect();
          // 從 pendingEvents 移除
          territory.pendingEvents.splice(territory.pendingEvents.indexOf(eventId), 1);
          // 更新 UI
          UIManager.updateUI();
          // 重新渲染 Modal 或關閉
          if (territory.pendingEvents.length > 0) {
            openTodoModal();
          } else {
            modal.classList.remove('active');
          }
        });
        optionsDiv.appendChild(btn);
      });

      card.appendChild(optionsDiv);
      container.appendChild(card);
    });
  }

  const btnClose = document.getElementById('btn-close-todo')!;
  btnClose.onclick = () => modal.classList.remove('active');

  modal.classList.add('active');
}

// === 情報迷霧與節點詳細面板 ===

export function closeNodeDetailPanel() {
  const panel = document.getElementById('node-detail-panel');
  if (panel) {
    panel.style.display = 'none';
  }
  const mapInfoPanel = document.getElementById('map-info-panel');
  if (mapInfoPanel) {
    mapInfoPanel.style.display = 'flex'; // 預設為 flex，還原顯示
  }
}

export function openNodeDetailPanel(node: MapNode) {
  const panel = document.getElementById('node-detail-panel')!;
  const mapInfoPanel = document.getElementById('map-info-panel')!;
  
  // 隱藏預設的世界地圖資訊
  mapInfoPanel.style.display = 'none';
  
  document.getElementById('nd-name')!.textContent = node.name;
  
  let typeStr = '';
  if (node.nodeLevel === NodeLevel.WILDERNESS) typeStr = '荒野';
  else if (node.nodeLevel === NodeLevel.CAMP) typeStr = '營地';
  else if (node.nodeLevel === NodeLevel.VILLAGE) typeStr = '村莊';
  else if (node.nodeLevel === NodeLevel.TOWN) typeStr = '城鎮';
  else if (node.nodeLevel === NodeLevel.CAPITAL) typeStr = '首都';
  
  document.getElementById('nd-type')!.textContent = `📍 規模：${typeStr}`;
  
  const weatherEl = document.getElementById('nd-weather')!;
  let weatherStr = '';
  let weatherColor = '#e2e8f0';
  switch(node.currentWeather) {
    case 'CLEAR': weatherStr = '☀️ 晴朗'; weatherColor = '#eab308'; break;
    case 'RAIN': weatherStr = '🌧️ 雨天'; weatherColor = '#60a5fa'; break;
    case 'SNOW': weatherStr = '❄️ 下雪'; weatherColor = '#bae6fd'; break;
    case 'SANDSTORM': weatherStr = '🌪️ 沙暴'; weatherColor = '#d97706'; break;
    case 'FOG': weatherStr = '🌫️ 濃霧'; weatherColor = '#94a3b8'; break;
    default: weatherStr = '☀️ 晴朗'; weatherColor = '#eab308'; break;
  }
  weatherEl.textContent = `${weatherStr} (剩餘 ${node.weatherDuration} 天)`;
  weatherEl.style.color = weatherColor;

  document.getElementById('nd-desc')!.textContent = node.description;

  const scoutInfoBox = document.getElementById('nd-scout-info')!;
  const unscoutedBox = document.getElementById('nd-unscouted-info')!;
  
  const btnScout = document.getElementById('btn-scout-node')!;
  const btnAction = document.getElementById('btn-nd-action')!;
  
  // 清除舊的事件監聽器
  const newBtnScout = btnScout.cloneNode(true) as HTMLButtonElement;
  btnScout.parentNode!.replaceChild(newBtnScout, btnScout);
  
  const newBtnAction = btnAction.cloneNode(true) as HTMLButtonElement;
  btnAction.parentNode!.replaceChild(newBtnAction, btnAction);

  if (node.isScouted) {
    scoutInfoBox.style.display = 'block';
    unscoutedBox.style.display = 'none';
    
    if (node.scoutData) {
      document.getElementById('nd-danger')!.textContent = node.scoutData.dangerLevel;
      document.getElementById('nd-treasure')!.textContent = node.scoutData.treasureTier;
      
      const garrisonBox = document.getElementById('nd-garrison-box')!;
      if (node.scoutData.garrisonEncounter && node.scoutData.garrisonEncounter.length > 0) {
        garrisonBox.style.display = 'block';
        const names = node.scoutData.garrisonEncounter.map(m => m.name).join('、');
        const elemInfo = node.scoutData.mainElements && node.scoutData.mainElements.length > 0 ? ` | ⚡元素: ${node.scoutData.mainElements.join('/')}` : '';
        const affixInfo = node.scoutData.affix ? ` | ☠️詞綴: ${node.scoutData.affix}` : '';
        const roundedPower = Math.round(node.scoutData.garrisonPower || 0);
        document.getElementById('nd-garrison')!.textContent = `【${names}】(戰力:${roundedPower})${elemInfo}${affixInfo}`;
      } else if (node.scoutData.garrisonPower !== undefined) {
        garrisonBox.style.display = 'block';
        document.getElementById('nd-garrison')!.textContent = Math.round(node.scoutData.garrisonPower).toString();
      } else {
        garrisonBox.style.display = 'none';
      }
    }
    
    document.getElementById('nd-expiry')!.textContent = node.scoutExpiryDate ? `第 ${node.scoutExpiryDate} 天` : '-';
  } else {
    scoutInfoBox.style.display = 'none';
    unscoutedBox.style.display = 'block';
    
    if (node.pendingScoutDays && node.pendingScoutDays > 0) {
      newBtnScout.style.display = 'none';
      const pendingMsg = document.createElement('div');
      pendingMsg.style.color = '#fbbf24';
      pendingMsg.style.fontWeight = 'bold';
      pendingMsg.style.marginTop = '10px';
      pendingMsg.style.textAlign = 'center';
      pendingMsg.textContent = `👁️ 斥候偵查中... (預計剩餘 ${node.pendingScoutDays} 回合)`;
      
      // 移除舊的提示訊息，避免重複
      const oldMsg = unscoutedBox.querySelector('.pending-scout-msg');
      if (oldMsg) oldMsg.remove();
      
      pendingMsg.className = 'pending-scout-msg';
      unscoutedBox.appendChild(pendingMsg);
    } else {
      newBtnScout.style.display = 'inline-block';
      const oldMsg = unscoutedBox.querySelector('.pending-scout-msg');
      if (oldMsg) oldMsg.remove();
      
      newBtnScout.addEventListener('click', () => {
        if (GameState.mapSystem.scoutNode(node.id, GameState.myTerritory, GameState.totalDays)) {
          UIManager.updateUI(); // 更新金幣顯示
          openNodeDetailPanel(node); // 重新渲染面板
        }
      });
    }
  }

  // 市場按鈕
  const marketBtn = document.getElementById('nd-btn-market') as HTMLButtonElement;
  if (node.nodeLevel >= NodeLevel.VILLAGE && node.isScouted && node.marketData && node.ownerFactionId !== null && node.ownerFactionId !== 'player' && !node.isPlayerBase) {
    marketBtn.style.display = 'block';
    marketBtn.onclick = () => {
      openTradeModal(node);
    };
  } else {
    marketBtn.style.display = 'none';
  }

  // 代官 UI (僅限玩家佔領的附庸地)
  const oldRoadButton = document.getElementById('btn-build-road') as HTMLButtonElement;
  const roadButton = oldRoadButton.cloneNode(true) as HTMLButtonElement;
  oldRoadButton.parentNode!.replaceChild(roadButton, oldRoadButton);
  const playerBase = GameState.mapSystem.getNodes().find(candidate => candidate.isPlayerBase);
  const isNonPlayerTarget = !node.isPlayerBase && node.ownerFactionId !== 'player';

  if (isNonPlayerTarget && playerBase && GameState.roadSystem) {
    roadButton.style.display = 'block';
    const existingRoad = GameState.roadSystem.getRoadBetween(playerBase.id, node.id);
    const project = GameState.roadSystem.getProjectBetween(playerBase.id, node.id);
    const check = GameState.roadSystem.checkTarget(
      playerBase,
      node,
      GameState.explorationSystem
    );

    if (existingRoad) {
      roadButton.textContent = '✅ 道路已完成';
      roadButton.disabled = true;
      roadButton.title = '旅行路段縮短 40%、伏擊率降低，市場買價 -5%、賣價 +10%。';
    } else if (project) {
      roadButton.textContent = `🚧 道路施工中（${project.elapsedDays}/${project.totalDays} 天）`;
      roadButton.disabled = true;
    } else {
      roadButton.disabled = !check.valid;
      roadButton.textContent = check.valid
        ? `🛤️ 建造道路（${check.requiredDays} 天）`
        : '🛤️ 暫時無法建造';
      roadButton.title = check.reason ?? '';
      roadButton.onclick = () => {
        if (!check.valid || !check.requiredDays) {
          ToastManager.show(check.reason ?? '目前無法建造這條道路。', 'warning');
          return;
        }
        if (!window.confirm(
          `從 ${playerBase.name} 向 ${node.name} 建造道路？\n` +
          `預計需要 ${check.requiredDays} 天，同一時間只能施工一條道路。`
        )) return;

        const startedProject = GameState.roadSystem.startConstruction(
          playerBase,
          node,
          GameState.explorationSystem
        );
        EventBus.getInstance().publish({
          type: GameEventType.ROAD_CHANGED,
          payload: {
            reason: 'STARTED',
            roadId: startedProject.id,
            targetNodeId: node.id
          }
        });
        ToastManager.show(`通往 ${node.name} 的道路開始施工。`, 'success');
        openNodeDetailPanel(node);
      };
    }
  } else {
    roadButton.style.display = 'none';
  }

  const govBox = document.getElementById('nd-governor-box')!;
  if (node.ownerFactionId === 'player' && !node.isPlayerBase) {
    govBox.style.display = 'block';
    const govNameEl = document.getElementById('nd-governor-name')!;
    const govSelect = document.getElementById('nd-governor-select') as HTMLSelectElement;
    const btnAssign = document.getElementById('btn-assign-governor')!;

    if (node.governorId) {
      const govAdv = GameState.adventurers.find(a => a.id === node.governorId);
      govNameEl.textContent = govAdv ? govAdv.name : '未知的代官';
    } else {
      govNameEl.textContent = '無';
    }

    // 填充閒置傭兵
    govSelect.innerHTML = '<option value="">選擇閒置傭兵...</option>';
    const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE && !a.office && a.id !== node.governorId);
    idleAdvs.forEach(adv => {
      const intAttr = adv.getEffectiveAttributes().int;
      govSelect.innerHTML += `<option value="${adv.id}">${adv.name} (INT: ${intAttr})</option>`;
    });

    // 替換新的 assign 按鈕清除舊事件
    const newBtnAssign = btnAssign.cloneNode(true) as HTMLButtonElement;
    btnAssign.parentNode!.replaceChild(newBtnAssign, btnAssign);
    newBtnAssign.onclick = () => {
      const selId = govSelect.value;
      if (!selId) {
        ToastManager.show('請選擇一名傭兵！');
        return;
      }
      
      // 如果原本有代官，卸任
      if (node.governorId) {
        const oldGov = GameState.adventurers.find(a => a.id === node.governorId);
        if (oldGov) oldGov.currentState = AdventurerState.IDLE;
      }
      
      const newGov = GameState.adventurers.find(a => a.id === selId);
      if (newGov) {
        newGov.currentState = AdventurerState.DISPATCHED; // 指派出去當代官
        node.governorId = newGov.id;
        ToastManager.show(`已指派 ${newGov.name} 為 ${node.name} 的代官！`);
        openNodeDetailPanel(node); // 重新渲染 UI
      }
    };
  } else {
    govBox.style.display = 'none';
  }

  // 設定底部操作按鈕 (例如討伐/攻城)
  if (node.ownerFactionId === null) {
    newBtnAction.textContent = '🛡️ 討伐該區';
    newBtnAction.onclick = () => {
      if (!node.isScouted) {
        if (!confirm('⚠️ 【警告】您尚未偵查該區域，敵方戰力未知，貿然進軍將面臨極大風險！是否確定要盲目討伐？')) {
          return;
        }
      }
      openDispatchSetup(node, 'subjugation');
      closeNodeDetailPanel();
    };
  } else {
    if (node.isPlayerBase) {
      newBtnAction.textContent = '🔒 無法操作';
      newBtnAction.onclick = () => ToastManager.show('這是您自己的領地！');
    } else {
      newBtnAction.textContent = '⚔️ 發動攻城戰';
      newBtnAction.onclick = () => {
        if (!node.isScouted) {
          if (!confirm('⚠️ 【警告】您尚未偵查該據點，敵方駐軍數量與城防未知！是否確定要盲目發動攻城？')) {
            return;
          }
        }
        openDispatchSetup(node, 'war');
        closeNodeDetailPanel();
      };
    }
  }

  // 關閉按鈕
  document.getElementById('btn-close-node-detail')!.onclick = () => {
    closeNodeDetailPanel();
    mapInfoPanel.style.display = 'flex';
  };

  panel.style.display = 'flex';
}


/**
 * 開啟市場交易與商隊派遣視窗
 */
export async function openTradeModal(node: MapNode) {
  const { openTradeModal: impl } = await import('./TradeController');
  impl(node);
}

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

/**
 * 將 AI 派系武將轉換為玩家傭兵 (Adventurer)
 */
export function convertChampionToAdventurer(champion: FactionChampion): Adventurer {
  const job = DataStore.JobDB[champion.jobId] || DataStore.JobDB['WARRIOR'];
  const trait = DataStore.TraitDB[champion.traitId] || DataStore.TraitDB['GUARDIAN'];

  const qualityMap: Record<string, 'R' | 'SR' | 'SSR'> = {
    'ELITE': 'R',
    'CHAMPION': 'SR',
    'LEGENDARY': 'SSR'
  };

  const newAdv = new Adventurer(
    `adv_${champion.id}_${Date.now()}`,
    champion.name,
    job,
    trait,
    qualityMap[champion.rarity] || 'SR'
  );

  // 依據 powerTier 計算等級並提升
  const targetLevel = Math.max(1, champion.powerTier * 2);
  for (let i = 1; i < targetLevel; i++) {
    newAdv.gainXP(newAdv.getRequiredXP());
  }

  return newAdv;
}

/**
 * 開啟戰後俘虜處置 Modal
 */
export function openPrisonerModal(champion: FactionChampion) {
  const modal = document.getElementById('modal-prisoner-action');
  if (!modal) return;

  const avatar = document.getElementById('prisoner-avatar');
  const nameEl = document.getElementById('prisoner-name');
  const titleEl = document.getElementById('prisoner-title');
  const descEl = document.getElementById('prisoner-desc');

  const faction = GameState.mapSystem?.getFactions().find(f => f.id === champion.factionId);
  const factionName = faction ? faction.factionName : '未知派系';

  if (avatar) avatar.textContent = champion.portraitEmoji;
  if (nameEl) nameEl.textContent = champion.name;
  if (titleEl) titleEl.textContent = `【${champion.title}】 ${factionName}`;
  if (descEl) descEl.textContent = champion.description;

  modal.classList.add('active');

  const btnRecruit = document.getElementById('btn-prisoner-recruit');
  const btnRansom = document.getElementById('btn-prisoner-ransom');
  const btnExecute = document.getElementById('btn-prisoner-execute');
  const btnRelease = document.getElementById('btn-prisoner-release');

  if (btnRecruit) {
    btnRecruit.onclick = () => {
      modal.classList.remove('active');
      const newAdv = convertChampionToAdventurer(champion);
      GameState.adventurers.push(newAdv);
      if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 30);
      ToastManager.show(`🤝 成功招降【${champion.name}】！他已正式加入您的傭兵隊伍。`, 'success');
    };
  }

  if (btnRansom) {
    btnRansom.onclick = () => {
      modal.classList.remove('active');
      const ransomGold = champion.powerTier * 500;
      GameState.myTerritory.addGold(ransomGold);
      if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 15);
      ToastManager.show(`💰 獲得贖金 ${ransomGold} 金幣，【${champion.name}】已安全交還給 ${factionName}。`, 'info');
    };
  }

  if (btnExecute) {
    btnExecute.onclick = () => {
      modal.classList.remove('active');
      if (faction) {
        if (!faction.defeatedChampionIds) faction.defeatedChampionIds = [];
        faction.defeatedChampionIds.push(champion.id);
        faction.playerFavor = Math.max(-100, faction.playerFavor - 60);
      }
      ToastManager.show(`⚰️ 處決了【${champion.name}】！${factionName} 對您的恨意暴增！`, 'error');
    };
  }

  if (btnRelease) {
    btnRelease.onclick = () => {
      modal.classList.remove('active');
      if (faction) faction.playerFavor = Math.min(100, faction.playerFavor + 10);
      ToastManager.show(`🔓 釋放了【${champion.name}】。${factionName} 對您的仁慈表示敬意（好感度 +10）。`, 'info');
    };
  }
}
