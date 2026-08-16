import { Adventurer } from '../../models/Adventurer';
import { EquipmentSlot } from '../../models/types';
import { GameState } from '../../core/GameState';
import { ToastManager } from '../ToastManager';
import { UIManager } from '../UIManager';
import { renderEquipIcon, ICON_SIZE, getEquipComparisonTooltipHtml } from '../ShopController';
import { positionFloatingElement } from '../FloatingPosition';
import { PartyModalController } from './PartyModalController';

export class EquipModalController {
  public static buildEquipStatsHtml(eq: any): string {
    const effects = eq.effects || {};
    const combatEffects = eq.combatEffects || {};
    const allStats = { ...effects, ...combatEffects } as Record<string, number>;

    const combatStatMeta: Record<string, { label: string; color: string; icon: string }> = {
      patk:  { label: '物攻', color: '#f59e0b', icon: '🗡️' },
      pdef:  { label: '物防', color: '#ef4444', icon: '🛡️' },
      matk:  { label: '魔攻', color: '#a78bfa', icon: '✨' },
      mdef:  { label: '魔防', color: '#60a5fa', icon: '🗡️' },
      hp:    { label: 'HP', color: '#f87171', icon: '❤️' },
      hit:   { label: '命中', color: '#3b82f6', icon: '🎯' },
      evade: { label: '閃避', color: '#3b82f6', icon: '💨' },
      speed: { label: '速度', color: '#fcd34d', icon: '👟' },
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

  public static open(adv: Adventurer, slotKey: EquipmentSlot): void {
    const equipSelectPane = document.getElementById('party-equip-select-pane');
    const equipSelectList = document.getElementById('equip-select-list');
    const myTerritory = GameState.myTerritory;
    
    if (!equipSelectPane || !equipSelectList) return;

    equipSelectPane.style.display = 'block'; // Make sure it's visible
    equipSelectList.innerHTML = '';
    
    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = 'repeat(3, 90px)';
    gridContainer.style.gap = '8px';
    gridContainer.style.justifyContent = 'center';
    equipSelectList.appendChild(gridContainer);

    const availableEqs = myTerritory.warehouse.filter(e => e.slot === slotKey);

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
        <div style="font-size:1.6em; margin-bottom:2px;">❌</div>
        <strong style="color:#f87171; font-size:0.78em;">卸下裝備</strong>
      `;
      unequipCard.addEventListener('click', () => {
        adv.unequip(slotKey);
        GameState.myTerritory.addEquipmentToWarehouse(currentEq);
        equipSelectPane.style.display = 'none';
        PartyModalController.getInstance().renderPartyUpperSection();
        UIManager.updateUI();
      });
      gridContainer.appendChild(unequipCard);
    }

    if (availableEqs.length === 0) {
      equipSelectList.insertAdjacentHTML('beforeend', `<p style="text-align:center; color:#94a3b8; grid-column: span 3; margin-top: 20px; font-size: 0.85em;">倉庫中無符合條件的裝備</p>`);
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

        const iconHtml = renderEquipIcon(eq, ICON_SIZE.LG);
        const tooltipHtml = getEquipComparisonTooltipHtml(adv, slotKey, eq);

        card.setAttribute('data-html-tip', encodeURIComponent(tooltipHtml));

        const lvlStr = eq.enhancementLevel ? `<div style="color:#3b82f6; font-size:0.75em; font-weight:bold;">+${eq.enhancementLevel}</div>` : '';
        const jobDisallowedBadge = !isJobAllowed ? `<div style="color:#ef4444; font-size:0.68em; font-weight:bold; margin-top:1px;">職業不符</div>` : '';

        card.innerHTML = `
          <div style="flex:1; display:flex; align-items:center; justify-content:center; padding:2px;">
            ${iconHtml}
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; border-top:1px solid rgba(255,255,255,0.12); padding-top:2px; margin-top:2px;">
            ${jobDisallowedBadge || lvlStr || '<div style="font-size:0.7em; color:#94a3b8;">裝備</div>'}
          </div>
        `;

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

        card.addEventListener('click', () => {
          try {
            const tEl = document.getElementById('adv-tooltip');
            if (tEl) tEl.style.opacity = '0';

            const [canEquipOk, reasons] = adv.canEquip(eq);
            if (!canEquipOk) {
              ToastManager.show(`無法裝備：${reasons.join(', ')}`);
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
            PartyModalController.getInstance().open(adv);
            UIManager.updateUI();
          } catch (e: any) {
            console.error(e.message); 
          }
        });
        gridContainer.appendChild(card);
      });
    }
    
    // 綁定關閉按鈕
    const closeBtn = equipSelectPane.querySelector('.btn-close');
    if (closeBtn) {
       // Avoid multiple listeners by cloning or just assigning onclick
       (closeBtn as HTMLElement).onclick = () => {
          equipSelectPane.style.display = 'none';
       };
    }
  }
}
