import { Adventurer } from '../../models/Adventurer';
import { EquipmentSlot, AdventurerState } from '../../models/types';
import { GameState } from '../../core/GameState';
import { ToastManager } from '../ToastManager';
import { UIManager } from '../UIManager';
import { EquipModalController } from './EquipModalController';
import { positionFloatingElement } from '../FloatingPosition';
import { getAdventurerSkillInfo, getAdventurerPassiveInfo, SKILLS } from '../../data/SkillData';
import { renderEquipIcon, getEquipTooltipHtml } from '../ShopController';
import { GambitConditionType, GAMBIT_CONDITION_LABELS } from '../../models/Gambit';
import { GambitModalController } from './GambitModalController';

export class PartyModalController {
  private static instance: PartyModalController;
  public static getInstance() {
    if (!this.instance) this.instance = new PartyModalController();
    return this.instance;
  }

  private currentPartyAdv: Adventurer | null = null;
  private currentPartyTab: 'stats' | 'equip' | 'skills' = 'stats';
  private tempAllocations: Record<string, number> = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
  
  public getSelectedPartyAdventurer(): Adventurer | null {
    return this.currentPartyAdv;
  }
  
  public selectPartyAdventurer(adv: Adventurer | null) {
    if (this.currentPartyAdv !== adv) {
      this.currentPartyAdv = adv;
      this.tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
    }
    this.renderPartyUpperSection();
  }
  
  public setPartyTab(tab: 'stats' | 'equip' | 'skills') {
    this.currentPartyTab = tab;
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
  
    this.renderPartyUpperSection();
  }
  
  public renderPartyUpperSection() {
    if (!this.currentPartyAdv || !GameState.adventurers.includes(this.currentPartyAdv)) {
      this.currentPartyAdv = GameState.adventurers[0] || null;
    }
    const adv = this.currentPartyAdv;
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
      const avatarIndex = adv.avatarIndex ?? (nameHash % 25);
      adv.avatarIndex = avatarIndex;
  
      const bgX = (avatarIndex % 5) * 25;
      const bgY = Math.floor(avatarIndex / 5) * 25;
      const avatarImage = adv.gender === 'FEMALE' ? 'assets/avatars_female.jpg' : 'assets/avatars_male.jpg';
      avatarWrapper.innerHTML = `
        <div style="aspect-ratio: 1/1; min-width: 100%; min-height: 100%; flex-shrink: 0; background-image: url('${avatarImage}'); background-size: 500% 500%; background-position: ${bgX}% ${bgY}%;"></div>
      `;
    }
    if (jobTraitEl) jobTraitEl.textContent = `Lv.${adv.level} ${displayClass}`;
    if (traitNameEl) traitNameEl.textContent = adv.trait.name;

    const btnAdvance = document.getElementById('btn-advance-class') as HTMLButtonElement;
    if (btnAdvance) {
      if (adv.level >= 10 && !adv.isAdvanced) {
        btnAdvance.style.display = 'inline-block';
        btnAdvance.onclick = () => {
          this.handleAdvanceClass(adv);
        };
      } else {
        btnAdvance.style.display = 'none';
        btnAdvance.onclick = null;
      }
    }
  
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
  
    if (this.currentPartyTab === 'stats') {
      const sumAllocated = this.tempAllocations.str + this.tempAllocations.agi + this.tempAllocations.con + this.tempAllocations.int + this.tempAllocations.spr + this.tempAllocations.luk;
      const tempUnspent = adv.unspentStatPoints - sumAllocated;
      
      const baseStats = adv.getCombatStats();
      const previewStats = adv.getCombatStats(undefined, this.tempAllocations);
      const baseAttr = adv.getEffectiveAttributes();
      const previewAttr = adv.getEffectiveAttributes(undefined, this.tempAllocations);
      const currentPower = adv.getPower();
      const previewPower = adv.getPower(this.tempAllocations);
  
      const formatStat = (currVal: number, prevVal: number, isPercent = false, prefix = '') => {
        const diff = prevVal - currVal;
        if (diff > 0) {
          return `${prefix}${prevVal}${isPercent ? '%' : ''} <span style="color:#22c55e; font-weight:bold; font-size:0.85em;">(+${diff})</span>`;
        }
        return `${prefix}${currVal}${isPercent ? '%' : ''}`;
      };
  
      const getStatRow = (label: string, key: 'str' | 'agi' | 'con' | 'int' | 'spr' | 'luk', val: number) => {
        const tempVal = this.tempAllocations[key] || 0;
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
          <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">命中 (HIT)</span><span style="color:#34d399;">${formatStat(baseStats.hit, previewStats.hit)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">閃避 (EVD)</span><span style="color:#38bdf8;">${formatStat(baseStats.evade, previewStats.evade)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:0.72em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">速度 (SPD)</span><span style="color:#fcd34d;">${formatStat(baseStats.speed, previewStats.speed)}</span></div>
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
          this.tempAllocations[key] = (this.tempAllocations[key] || 0) + 1;
          this.renderPartyUpperSection();
        });
      });
  
      viewport.querySelectorAll('.btn-temp-minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const key = (e.currentTarget as HTMLElement).getAttribute('data-stat')!;
          if ((this.tempAllocations[key] || 0) > 0) {
            this.tempAllocations[key]--;
          }
          this.renderPartyUpperSection();
        });
      });
  
      const btnConfirm = viewport.querySelector('#btn-confirm-stats');
      if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
          for (const [key, val] of Object.entries(this.tempAllocations)) {
            if (val > 0) {
              for (let i = 0; i < val; i++) {
                adv.allocateStat(key as any);
              }
            }
          }
          this.tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
          this.renderPartyUpperSection();
          UIManager.updateUI();
        });
      }
  
      const btnReset = viewport.querySelector('#btn-reset-stats');
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          this.tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
          this.renderPartyUpperSection();
        });
      }
    } else if (this.currentPartyTab === 'equip') {
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
          const statsHtml = EquipModalController.buildEquipStatsHtml(eq);
          const iconHtml = renderEquipIcon(eq, 54);
          const jobMeta = eq.allowedJobs && eq.allowedJobs.length > 0
            ? `<div style="color:#94a3b8; font-size:0.8em; margin-bottom:4px;">職業：${eq.allowedJobs.join('/')}</div>`
            : '';
          const tooltipHtml = getEquipTooltipHtml(eq);
          equipRowsHtml += `
            <div class="equip-card-square tooltip-eq-trigger" data-slot="${s.key}" data-html-tip="${encodeURIComponent(tooltipHtml)}" style="position:relative; background:rgba(15,23,42,0.7); border:1px solid rgba(234,179,8,0.4); border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 4px; cursor:pointer; min-height:96px;">
              <div style="flex:1; display:flex; align-items:center; justify-content:center; margin-bottom:4px;">${iconHtml}</div>
              <div style="font-size:0.82em; font-weight:bold; color:#f1f5f9; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; padding:0 2px;">${eq.name}</div>
              ${lvlStr}
            </div>
          `;
        } else {
          equipRowsHtml += `
            <div class="equip-card-square" data-slot="${s.key}" style="background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.2); border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:12px 5px; cursor:pointer; color:#64748b; font-size:0.85em; text-align:center; transition: all 0.2s; min-height:96px;">
              <div style="font-size:1.8em; margin-bottom:4px; opacity:0.6;">${s.icon}</div>
              <div style="font-weight:600; color:#cbd5e1;">${s.name}</div>
              <div style="color:#3b82f6; margin-top:3px; font-size:0.85em; font-weight:bold;">+ 裝備</div>
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
          EquipModalController.open(adv, slotKey);
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
            this.currentPartyAdv = GameState.adventurers[0] || null;
            this.renderPartyUpperSection();
            UIManager.updateUI();
          }
        });
      }
    } else if (this.currentPartyTab === 'skills') {
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
  
          <!-- Gambit 戰術策略卡槽 -->
          <div id="gambit-strategy-container" style="margin-top: 6px; background: rgba(15,23,42,0.6); border: 1px dashed rgba(234,179,8,0.4); border-radius: 6px; padding: 6px 8px; flex-shrink: 0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
              <span style="font-size:0.78em; color:#facc15; font-weight:bold;">🎯 Gambit 戰術策略 (前3順位)</span>
              <span style="font-size:0.68em; color:#94a3b8; background:rgba(255,255,255,0.05); padding:1px 4px; border-radius:3px;">智慧 AI 動態評估</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:3px;">
              ${(function() {
                let html = '';
                if (!adv.gambits) adv.gambits = [];
                if (adv.gambits.length === 0) {
                  for(let i=0; i<3; i++) adv.gambits.push({ isActive: i===0, conditionType: GambitConditionType.ALWAYS, actionSkillId: 'DEFAULT_ATTACK' });
                }
                adv.gambits.slice(0, 3).forEach((g, index) => {
                  const condLabel = GAMBIT_CONDITION_LABELS[g.conditionType];
                  const valStr = g.conditionValue !== undefined ? ` (${g.conditionValue})` : '';
                  const skillName = g.actionSkillId === 'DEFAULT_ATTACK' ? '預設普攻' : (SKILLS[g.actionSkillId]?.name || '未知');
                  const isActiveColor = g.isActive ? '#eab308' : '#64748b';
                  const isActiveBorder = g.isActive ? 'rgba(234,179,8,0.4)' : 'rgba(255,255,255,0.08)';
                  html += `
                    <div class="gambit-row" data-index="${index}" style="font-size:0.72em; background:rgba(255,255,255,0.03); border:1px solid ${isActiveBorder}; padding:3px 6px; border-radius:4px; color:${isActiveColor}; display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-weight:bold; font-size:1.1em;">${index + 1}.</span>
                        <span>If ${condLabel}${valStr} ➔ ${skillName}</span>
                      </div>
                      <span style="font-size:0.9em; background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:3px;">✏️ 編輯</span>
                    </div>
                  `;
                });
                return html;
              })()}
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

      // 綁定 Gambit 行點擊事件
      viewport.querySelectorAll('.gambit-row').forEach(row => {
        row.addEventListener('click', (e) => {
          const index = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0', 10);
          GambitModalController.getInstance().open(adv, index);
        });
      });
    }
  }
  
  private handleAdvanceClass(adv: Adventurer) {
    let reqMaterialId = '';
    const baseClass = adv.job.name;
    
    if (baseClass === '戰士') reqMaterialId = 'ADVANCE_WARRIOR';
    else if (baseClass === '法師') reqMaterialId = 'ADVANCE_MAGE';
    else if (baseClass === '弓箭手') reqMaterialId = 'ADVANCE_ARCHER';
    else if (baseClass === '騎士') reqMaterialId = 'ADVANCE_KNIGHT';
    else if (baseClass === '盜賊') reqMaterialId = 'ADVANCE_THIEF';
    else if (baseClass === '祈禱者') reqMaterialId = 'ADVANCE_PRAYER';
    
    if (!reqMaterialId) {
      ToastManager.show(`該職業無法轉職！`, 'error');
      return;
    }

    const territory = GameState.myTerritory;
    if (!territory.materials) territory.materials = {};
    const hasCount = territory.materials[reqMaterialId] || 0;
    
    // We import ADVANCEMENT_MATERIALS from types
    // Actually, we can hardcode the names or import
    const reqMaterialName = reqMaterialId === 'ADVANCE_WARRIOR' ? '狂怒之鋒' :
                            reqMaterialId === 'ADVANCE_MAGE' ? '秘法魔典' :
                            reqMaterialId === 'ADVANCE_ARCHER' ? '鷹隼之眼' :
                            reqMaterialId === 'ADVANCE_KNIGHT' ? '守護者之盾' :
                            reqMaterialId === 'ADVANCE_THIEF' ? '幽影之塵' :
                            '信仰之證';

    if (hasCount < 1) {
      ToastManager.show(`轉職失敗！需要素材：${reqMaterialName}`, 'error');
      return;
    }

    territory.materials[reqMaterialId] -= 1;
    const msg = adv.advance();
    ToastManager.show(msg, 'success');
    
    this.renderPartyUpperSection();
  }

  public open(adv: Adventurer) {
    this.selectPartyAdventurer(adv);
    const modal = document.getElementById('modal-party-list');
    if (modal) {
      modal.classList.add('active');
    }
  }
  
}