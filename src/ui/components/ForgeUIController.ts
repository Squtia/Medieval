import { GameState } from '../../core/GameState';
import { UIManager } from '../UIManager';
import { DataStore } from '../../systems/DataStore';
import { EquipmentGenerator } from '../../systems/EquipmentGenerator';
import { EnhancementSystem } from '../../systems/EnhancementSystem';
import { CombatStats, ElementType, Equipment, EquipmentSlot, EquipmentTemplate } from '../../models/types';
import { MarketSystem } from '../../systems/MarketSystem';
import { positionFloatingElement } from '../FloatingPosition';
import { renderEquipIcon, ICON_SIZE, formatStatsTags, getElementBadge, consumeMaterial, attachTooltip, getEquipTooltipHtml, getMaterialCount } from '../ShopController';
import { renderUniversalIcon } from '../IconSpriteHelper';
import { ToastManager } from '../ToastManager';
import { TRADE_GOODS } from '../../systems/MarketSystem';
import materialsJson from '../../data/materials.json';

export class ForgeUIController {
  private static instance: ForgeUIController;
  private enhanceSource: 'WAREHOUSE' | 'ADVENTURER' = 'WAREHOUSE';
  private enchantSource: 'WAREHOUSE' | 'ADVENTURER' = 'WAREHOUSE';
  private constructor() {}
  public static getInstance(): ForgeUIController {
    if (!ForgeUIController.instance) {
      ForgeUIController.instance = new ForgeUIController();
    }
    return ForgeUIController.instance;
  }

  public openWarehouse(isForgeMode: boolean) {
    if (isForgeMode) {
      const viewForge = document.getElementById('view-forge');
      if (viewForge) {
        viewForge.style.display = 'flex';
        this.renderForgeView();
      }
    } else {
      const modalWarehouse = document.getElementById('modal-warehouse');
      if (modalWarehouse) {
        modalWarehouse.classList.add('active');
      }
    }
  }
  
  public renderForgeView() {
    const territory = GameState.myTerritory;
    const forgeLevel = territory.forgeLevel || 0;
  
    // 更新等級
    const uiForgeLvl = document.getElementById('ui-forge-lvl');
    if (uiForgeLvl) uiForgeLvl.textContent = forgeLevel.toString();
  
    // 5 大頁籤按鈕
    const btnEnhance = document.getElementById('btn-forge-tab-enhance')!;
    const btnCraft = document.getElementById('btn-forge-tab-craft')!;
    const btnEnchant = document.getElementById('btn-forge-tab-enchant')!;
    const btnSmelt = document.getElementById('btn-forge-tab-smelt')!;
    const btnDisassemble = document.getElementById('btn-forge-tab-disassemble')!;
  
    const tabs = [
      { btn: btnEnhance, render: () => this.renderForgeEnhanceMode() },
      { btn: btnCraft, render: () => this.renderForgeCraftMode() }, // Craft & Reforge combined
      { btn: btnEnchant, render: () => this.renderForgeEnchantMode() },
      { btn: btnSmelt, render: () => this.renderForgeSmeltMode() },
      { btn: btnDisassemble, render: () => this.renderForgeDisassembleMode() }
    ];
  
    const setActiveTab = (activeIndex: number) => {
      // 切換頁籤時關閉隱藏舊的 tooltip
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) tEl.style.opacity = '0';
  
      tabs.forEach((t, idx) => {
        if (!t.btn) return;
        if (idx === activeIndex) {
          t.btn.style.background = 'rgba(234, 179, 8, 0.25)';
          t.btn.style.borderColor = 'rgba(234, 179, 8, 0.5)';
          t.btn.style.color = '#fbbf24';
          t.render();
        } else {
          t.btn.style.background = 'rgba(0, 0, 0, 0.4)';
          t.btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          t.btn.style.color = '#94a3b8';
        }
      });
    };
  
    tabs.forEach((t, idx) => {
      if (t.btn) {
        t.btn.onclick = () => setActiveTab(idx);
      }
    });
  
    // 預設第 0 個頁籤 (裝備強化)
    setActiveTab(0);
  }
  
  private renderForgeEnhanceMode() {
    const territory = GameState.myTerritory;
    const workspace = document.getElementById('forge-workspace')!;
    workspace.innerHTML = '';

    // 收集所有可強化的裝備（依據來源）
    const getAvailableItems = (): { eq: Equipment; label?: string; advName?: string }[] => {
      if (this.enhanceSource === 'WAREHOUSE') {
        return (territory.warehouse || []).map(eq => ({ eq }));
      } else {
        const items: { eq: Equipment; label?: string; advName?: string }[] = [];
        (GameState.adventurers || []).forEach(adv => {
          if (!adv.equipment) return;
          const slots: EquipmentSlot[] = [EquipmentSlot.WEAPON, EquipmentSlot.ARMOR, EquipmentSlot.ACCESSORY];
          slots.forEach(slot => {
            const eq = adv.equipment[slot];
            if (eq) {
              const slotName = slot === EquipmentSlot.WEAPON ? '武器' : (slot === EquipmentSlot.ARMOR ? '防具' : '飾品');
              items.push({
                eq,
                label: `${adv.name} (${slotName})`,
                advName: adv.name
              });
            }
          });
        });
        return items;
      }
    };

    let availableItems = getAvailableItems();
    let selectedUuid = availableItems.length > 0 ? availableItems[0].eq.uuid : null;

    // 雙欄 Container
    const splitContainer = document.createElement('div');
    splitContainer.style.display = 'flex';
    splitContainer.style.gap = '15px';
    splitContainer.style.flex = '1';
    splitContainer.style.minHeight = '0';

    // 左欄：420px 寬，半透明玻璃質感
    const leftPanel = document.createElement('div');
    leftPanel.style.width = '420px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.background = 'rgba(18, 14, 11, 0.68)';
    leftPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    leftPanel.style.borderRadius = '8px';
    leftPanel.style.padding = '12px';

    // 頂部來源切換按鈕列
    const sourceToggleRow = document.createElement('div');
    sourceToggleRow.style.display = 'flex';
    sourceToggleRow.style.gap = '8px';
    sourceToggleRow.style.marginBottom = '10px';

    const btnSourceWh = document.createElement('button');
    btnSourceWh.style.flex = '1';
    btnSourceWh.style.padding = '6px 0';
    btnSourceWh.style.fontSize = '0.85em';
    btnSourceWh.style.borderRadius = '4px';
    btnSourceWh.style.cursor = 'pointer';
    btnSourceWh.style.border = `1px solid ${this.enhanceSource === 'WAREHOUSE' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
    btnSourceWh.style.background = this.enhanceSource === 'WAREHOUSE' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(0,0,0,0.4)';
    btnSourceWh.style.color = this.enhanceSource === 'WAREHOUSE' ? '#fbbf24' : '#94a3b8';
    btnSourceWh.textContent = `📦 領地倉庫 (${territory.warehouse?.length || 0})`;
    btnSourceWh.onclick = () => {
      this.enhanceSource = 'WAREHOUSE';
      this.renderForgeEnhanceMode();
    };

    let advEquipTotal = 0;
    (GameState.adventurers || []).forEach(adv => {
      if (adv.equipment) {
        if (adv.equipment[EquipmentSlot.WEAPON]) advEquipTotal++;
        if (adv.equipment[EquipmentSlot.ARMOR]) advEquipTotal++;
        if (adv.equipment[EquipmentSlot.ACCESSORY]) advEquipTotal++;
      }
    });

    const btnSourceAdv = document.createElement('button');
    btnSourceAdv.style.flex = '1';
    btnSourceAdv.style.padding = '6px 0';
    btnSourceAdv.style.fontSize = '0.85em';
    btnSourceAdv.style.borderRadius = '4px';
    btnSourceAdv.style.cursor = 'pointer';
    btnSourceAdv.style.border = `1px solid ${this.enhanceSource === 'ADVENTURER' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
    btnSourceAdv.style.background = this.enhanceSource === 'ADVENTURER' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(0,0,0,0.4)';
    btnSourceAdv.style.color = this.enhanceSource === 'ADVENTURER' ? '#fbbf24' : '#94a3b8';
    btnSourceAdv.textContent = `👤 傭兵穿戴 (${advEquipTotal})`;
    btnSourceAdv.onclick = () => {
      this.enhanceSource = 'ADVENTURER';
      this.renderForgeEnhanceMode();
    };

    sourceToggleRow.appendChild(btnSourceWh);
    sourceToggleRow.appendChild(btnSourceAdv);
    leftPanel.appendChild(sourceToggleRow);

    // 卡片網格
    const leftGrid = document.createElement('div');
    leftGrid.style.flex = '1';
    leftGrid.style.overflowY = 'auto';
    leftGrid.style.overflowX = 'hidden';
    leftGrid.style.display = 'grid';
    leftGrid.style.gridTemplateColumns = this.enhanceSource === 'ADVENTURER' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))';
    leftGrid.style.gap = '6px';
    leftGrid.style.paddingRight = '2px';
    leftGrid.style.alignContent = 'flex-start';
    leftPanel.appendChild(leftGrid);

    // 右欄：高溫強化火爐對比區
    const rightPanel = document.createElement('div');
    rightPanel.style.flex = '1';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.justifyContent = 'space-between';
    rightPanel.style.background = 'rgba(18, 14, 11, 0.68)';
    rightPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    rightPanel.style.borderRadius = '8px';
    rightPanel.style.padding = '18px';

    const renderLeftGrid = () => {
      leftGrid.innerHTML = '';
      availableItems = getAvailableItems();
      if (!selectedUuid || !availableItems.some(item => item.eq.uuid === selectedUuid)) {
        selectedUuid = availableItems.length > 0 ? availableItems[0].eq.uuid : null;
      }

      if (availableItems.length === 0) {
        leftGrid.innerHTML = `<div style="grid-column: 1 / -1; color:#94a3b8; text-align:center; padding:40px 0; font-size:0.9em;">
          ${this.enhanceSource === 'WAREHOUSE' ? '倉庫內目前沒有任何裝備。' : '目前所有傭兵身上皆未穿戴任何裝備。'}
        </div>`;
        return;
      }

      availableItems.forEach(item => {
        const eq = item.eq;
        const isSel = eq.uuid === selectedUuid;
        const card = document.createElement('div');

        if (this.enhanceSource === 'ADVENTURER') {
          // 傭兵穿戴：2 欄卡片式排版，附帶傭兵名稱與部位標註
          card.style.background = isSel ? 'rgba(234, 179, 8, 0.25)' : 'rgba(30, 24, 20, 0.8)';
          card.style.border = `1.5px solid ${isSel ? '#eab308' : 'rgba(217, 119, 6, 0.3)'}`;
          card.style.borderRadius = '6px';
          card.style.padding = '6px 8px';
          card.style.display = 'flex';
          card.style.alignItems = 'center';
          card.style.gap = '8px';
          card.style.cursor = 'pointer';
          card.style.boxSizing = 'border-box';
          card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';

          card.innerHTML = `
            <div style="flex-shrink:0;">${renderEquipIcon(eq, ICON_SIZE.SM)}</div>
            <div style="flex:1; min-width:0; line-height:1.2;">
              <div style="font-size:0.85em; font-weight:bold; color:${isSel ? '#fbbf24' : '#e2e8f0'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${eq.name} <span style="color:#38bdf8;">+${eq.enhancementLevel || 0}</span>
              </div>
              <div style="font-size:0.75em; color:#94a3b8; margin-top:2px;">
                👤 ${item.label || '穿戴中'}
              </div>
            </div>
          `;
        } else {
          // 倉庫：5 欄正方形網格
          card.style.background = isSel ? 'rgba(234, 179, 8, 0.25)' : 'rgba(30, 24, 20, 0.8)';
          card.style.border = `1.5px solid ${isSel ? '#eab308' : 'rgba(217, 119, 6, 0.3)'}`;
          card.style.borderRadius = '6px';
          card.style.padding = '4px 3px';
          card.style.display = 'flex';
          card.style.flexDirection = 'column';
          card.style.alignItems = 'center';
          card.style.textAlign = 'center';
          card.style.justifyContent = 'space-between';
          card.style.cursor = 'pointer';
          card.style.height = '94px';
          card.style.minWidth = '0';
          card.style.boxSizing = 'border-box';
          card.style.overflow = 'hidden';
          card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';

          card.innerHTML = `
            <div style="flex:1; display:flex; align-items:center; justify-content:center;">
              ${renderEquipIcon(eq, ICON_SIZE.MD)}
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; font-size:0.7em; border-top:1px solid rgba(255,255,255,0.12); padding:2px 3px 0; margin-top:2px;">
              <span style="color:#38bdf8; font-weight:bold;">+${eq.enhancementLevel || 0}</span>
              <span style="color:#fbbf24; font-size:0.85em; padding:0 2px; background:rgba(217,119,6,0.25); border-radius:2px;">T${eq.tier || 1}</span>
            </div>
          `;
        }

        attachTooltip(card, () => getEquipTooltipHtml(eq));

        card.onclick = () => {
          selectedUuid = eq.uuid;
          renderLeftGrid();
          renderRightPanel();
        };

        leftGrid.appendChild(card);
      });
    };

    const renderRightPanel = () => {
      rightPanel.innerHTML = '';
      availableItems = getAvailableItems();
      const targetItem = availableItems.find(x => x.eq.uuid === selectedUuid) || (availableItems.length > 0 ? availableItems[0] : null);

      if (!targetItem) {
        rightPanel.innerHTML = `
          <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#64748b;">
            <div style="font-size:3em; margin-bottom:10px;">🔨</div>
            <div>請從左側選擇一件裝備以開啟強化火爐</div>
          </div>
        `;
        return;
      }

      const eq = targetItem.eq;
      const curLvl = eq.enhancementLevel || 0;
      const maxLvl = EnhancementSystem.getMaxEnhancementLevel(territory.forgeLevel || 0);
      const isCappedByFacility = curLvl >= maxLvl && curLvl < 10;
      const isMax10 = curLvl >= 10;
      const cost = EnhancementSystem.getEnhancementCost(curLvl);
      const rate = EnhancementSystem.getSuccessRate(curLvl);
      const goldEnough = territory.gold >= cost;
      const canEnhance = goldEnough && !isCappedByFacility && !isMax10;

      const facilityName = (territory.forgeLevel || 0) >= 3 
        ? 'Lv.3 皇家鍛造所' 
        : ((territory.forgeLevel || 0) === 2 ? 'Lv.2 工藝坊' : 'Lv.1 鐵匠鋪');

      // 算計強化後的屬性預覽 (明確顯示 PATK, MATK, PDEF, MDEF 變動綠字)
      const baseCb = eq.baseCombatEffects || eq.combatEffects || {};
      const nextMult = 1 + (0.10 * (curLvl + 1));
      
      const previews: string[] = [];
      for (const key of ['patk', 'matk', 'pdef', 'mdef', 'hit', 'evade', 'speed', 'hp', 'mp']) {
        const k = key as keyof CombatStats;
        const baseVal = baseCb[k];
        if (typeof baseVal === 'number' && baseVal > 0) {
          const curVal = eq.combatEffects?.[k] || baseVal;
          const nextVal = Math.round(baseVal * nextMult);
          const diff = nextVal - curVal;
          const labelText = k === 'patk' ? '⚔️ 物理攻擊 (PATK)' : (k === 'matk' ? '🔮 魔法攻擊 (MATK)' : (k === 'pdef' ? '🛡️ 物理防禦 (PDEF)' : (k === 'mdef' ? '✨ 魔法防禦 (MDEF)' : (k === 'hit' ? '🎯 命中 (HIT)' : (k === 'evade' ? '🌀 閃避 (EVD)' : (k === 'speed' ? '👟 速度 (SPD)' : k.toUpperCase()))))));
          previews.push(`
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:rgba(0,0,0,0.5); border-radius:6px; border:1px solid rgba(217,119,6,0.2);">
              <span style="color:#cbd5e1; font-weight:bold; font-size:0.9em;">${labelText}</span>
              <div>
                <span style="color:#fff; font-weight:bold; font-size:1em;">${curVal}</span> ➔ 
                <span style="color:#22c55e; font-weight:bold; font-size:1.05em;">${nextVal}</span> 
                <span style="color:#22c55e; font-size:0.82em; margin-left:4px;">(+${diff})</span>
              </div>
            </div>
          `);
        }
      }

      let btnText = '🔨 執行強化';
      if (isMax10) {
        btnText = '✨ 已達最高等級 (+10)';
      } else if (isCappedByFacility) {
        btnText = `🔒 需升級鍛造屋 (當前上限 +${maxLvl})`;
      }

      const wearerBadge = targetItem.advName 
        ? `<div style="font-size:0.82em; color:#38bdf8; margin-top:3px;">👤 穿戴者：${targetItem.label} (就地升級，即時生效)</div>`
        : '';

      rightPanel.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- 上方選中裝備卡片 -->
          <div style="display:flex; gap:16px; align-items:center; background:rgba(30, 24, 20, 0.85); padding:16px; border-radius:8px; border:1px solid rgba(217,119,6,0.35);">
            <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid rgba(217,119,6,0.3); flex-shrink:0; display:flex; align-items:center; justify-content:center;">${renderEquipIcon(eq, ICON_SIZE.LG)}</div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:#eab308; font-size:1.35em;">${eq.name} <span style="color:#38bdf8;">+${curLvl}</span> ➔ <span style="color:${isCappedByFacility || isMax10 ? '#94a3b8' : '#22c55e'};">+${isMax10 ? curLvl : curLvl + 1}</span></h3>
                <span style="padding:2px 7px; background:rgba(217,119,6,0.25); border-radius:4px; color:#fbbf24; font-weight:bold; font-size:0.85em;">T${eq.tier || 1}</span>
              </div>
              <div style="font-size:0.85em; color:#94a3b8; margin-top:4px;">
                ${getElementBadge(eq.element)} | 職業限制：${eq.allowedJobs ? eq.allowedJobs.join('/') : '無限制'}
              </div>
              ${wearerBadge}
              <div style="font-size:0.82em; color:#f59e0b; margin-top:4px;">
                🏛️ 當前設施：${facilityName} (最高支援強化至 <strong style="color:#22c55e;">+${maxLvl}</strong>)
              </div>
              <div style="font-size:0.85em; margin-top:6px;">
                現有戰鬥屬性：${formatStatsTags(eq.combatEffects, eq.effects)}
              </div>
            </div>
          </div>

          <!-- 中間強化對比預覽 -->
          <div style="background:rgba(25, 20, 16, 0.8); padding:16px; border-radius:8px; border:1px solid rgba(217,119,6,0.2);">
            <h4 style="margin-top:0; color:#fbbf24; font-size:0.95em; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">📈 強化提升屬性對比 (PATK, MATK, PDEF, MDEF)</h4>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
              ${previews.length > 0 ? previews.join('') : '<p style="color:#94a3b8; margin:0;">基礎無戰鬥屬性提升。</p>'}
            </div>
          </div>
        </div>

        <!-- 下方金幣與強化按鈕 -->
        <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:14px; text-align:center;">
          <div style="display:flex; justify-content:space-between; font-size:0.9em; color:#cbd5e1; margin-bottom:10px; padding:0 20px;">
            <span>消耗：<strong style="color:${goldEnough ? '#22c55e' : '#ef4444'};">${territory.gold}</strong> / <strong style="color:#fbbf24;">${cost} 金幣</strong></span>
            <span>成功機率：<strong style="color:${rate >= 80 ? '#22c55e' : '#f59e0b'};">${rate}%</strong></span>
          </div>
          <button id="btn-exec-enhance-furnace" class="action-btn" style="width:260px; padding:9px; font-size:1.05em; font-weight:bold; background:${canEnhance ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.1)'}; color:${canEnhance ? '#fff' : '#64748b'};" ${canEnhance ? '' : 'disabled'}>
            ${btnText}
          </button>
        </div>
      `;

      rightPanel.querySelector('#btn-exec-enhance-furnace')?.addEventListener('click', () => {
        const res = EnhancementSystem.enhance(territory, eq);
        ToastManager.show(res, res.includes('成功') ? 'success' : 'error');
        UIManager.updateUI();
        renderLeftGrid();
        renderRightPanel();
      });
    };

    renderLeftGrid();
    renderRightPanel();

    splitContainer.appendChild(leftPanel);
    splitContainer.appendChild(rightPanel);
    workspace.appendChild(splitContainer);
  }

  private renderForgeCraftMode() {
    this.renderRecipeFurnaceView('craft');
  }

  private renderForgeSmeltMode() {
    this.renderRecipeFurnaceView('smelt');
  }

  private renderRecipeFurnaceView(mode: 'craft' | 'smelt') {
    const territory = GameState.myTerritory;
    const workspace = document.getElementById('forge-workspace')!;
    workspace.innerHTML = '';

    const allRecipes = (DataStore.CraftingRecipeDB as any[]);
    let baseList = mode === 'smelt' 
      ? allRecipes.filter((r: any) => r.isMaterialRecipe === true)
      : allRecipes.filter((r: any) => {
          if (r.isMaterialRecipe) return false;
          // T4 裝備重鑄：依照設定，沒有配方書或前置裝備就完全隱藏不顯示（包含原生職業與變異職業）
          if (r.tier === 4 || r.baseEquipmentId) {
            // 需鍛造屋等級 >= 3 才能看見重鑄
            if ((territory.forgeLevel || 0) < 3) return false;

            // 必須在倉庫中擁有對應前置 T3 裝備
            if (r.baseEquipmentId) {
              const hasBaseEquip = territory.warehouse.some((eq: any) => eq.id === r.baseEquipmentId);
              if (!hasBaseEquip) return false;
            }

            // 必須持有對應重鑄書道具或通用重鑄卷軸
            const tomeId = r.requireTomeId || `tome_${r.targetEquipmentId}`;
            const hasTome = getMaterialCount(territory, tomeId) > 0 || getMaterialCount(territory, 'mat_reforge_scroll') > 0;
            if (!hasTome) return false;
          }
          return true;
        });

    let activeTierFilter: string = 'ALL';
    let craftAmount = 1;

    // 雙欄 Container
    const splitContainer = document.createElement('div');
    splitContainer.style.display = 'flex';
    splitContainer.style.gap = '15px';
    splitContainer.style.flex = '1';
    splitContainer.style.minHeight = '0';

    // 左欄：可合成/重鑄列表 (寬度 360px，半透明玻璃質感)
    const leftPanel = document.createElement('div');
    leftPanel.style.width = '360px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.background = 'rgba(18, 14, 11, 0.68)';
    leftPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    leftPanel.style.borderRadius = '8px';
    leftPanel.style.padding = '12px';

    const leftTitle = document.createElement('h4');
    leftTitle.style.margin = '0 0 8px 0';
    leftTitle.style.color = '#fbbf24';
    leftTitle.style.borderBottom = '1px solid rgba(217, 119, 6, 0.2)';
    leftTitle.style.paddingBottom = '6px';
    leftTitle.textContent = mode === 'smelt' ? '♨️ 素材冶煉工坊' : '⚒️ 裝備鍛造 / 重鑄';
    leftPanel.appendChild(leftTitle);

    // 階級過濾標籤列 (Tabs)
    const filterContainer = document.createElement('div');
    filterContainer.style.display = 'flex';
    filterContainer.style.gap = '4px';
    filterContainer.style.marginBottom = '10px';
    filterContainer.style.flexWrap = 'wrap';

    const filterOptions = mode === 'smelt'
      ? [
          { key: 'ALL', label: '全部' },
          { key: '1', label: 'T1 基礎 (Lv1)' },
          { key: '2', label: 'T2 高級 (Lv2)' },
          { key: '3', label: 'T3 特種 (Lv3)' }
        ]
      : [
          { key: 'ALL', label: '全部' },
          { key: '1', label: 'T1 基礎 (Lv1)' },
          { key: '2', label: 'T2 高級 (Lv2)' },
          { key: '3', label: 'T3 專家 (Lv3)' },
          { key: '4', label: 'T4 重鑄 (Lv3)' }
        ];

    leftPanel.appendChild(filterContainer);

    const leftList = document.createElement('div');
    leftList.style.flex = '1';
    leftList.style.overflowY = 'auto';
    leftList.style.display = 'flex';
    leftList.style.flexDirection = 'column';
    leftList.style.gap = '8px';
    leftList.style.paddingRight = '2px';
    leftPanel.appendChild(leftList);

    // 右欄：合成/重鑄火爐區
    const rightPanel = document.createElement('div');
    rightPanel.style.flex = '1';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.justifyContent = 'space-between';
    rightPanel.style.background = 'rgba(18, 14, 11, 0.68)';
    rightPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    rightPanel.style.borderRadius = '8px';
    rightPanel.style.padding = '18px';

    const getFilteredRecipes = () => {
      if (activeTierFilter === 'ALL') return baseList;
      const tierNum = parseInt(activeTierFilter);
      return baseList.filter((r: any) => (r.tier || 1) === tierNum);
    };

    let selectedRecipeId: string = getFilteredRecipes().length > 0 ? getFilteredRecipes()[0].id : '';

    const renderFilterTabs = () => {
      filterContainer.innerHTML = '';
      filterOptions.forEach(opt => {
        const btn = document.createElement('button');
        const isSel = opt.key === activeTierFilter;
        btn.style.padding = '3px 7px';
        btn.style.fontSize = '0.74em';
        btn.style.borderRadius = '4px';
        btn.style.border = `1px solid ${isSel ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
        btn.style.background = isSel ? 'rgba(234, 179, 8, 0.3)' : 'rgba(0,0,0,0.5)';
        btn.style.color = isSel ? '#fbbf24' : '#94a3b8';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = isSel ? 'bold' : 'normal';
        btn.textContent = opt.label;

        btn.onclick = () => {
          activeTierFilter = opt.key;
          const filtered = getFilteredRecipes();
          selectedRecipeId = filtered.length > 0 ? filtered[0].id : '';
          craftAmount = 1;
          renderFilterTabs();
          renderLeftList();
          renderRightPanel();
        };

        filterContainer.appendChild(btn);
      });
    };

    const renderLeftList = () => {
      leftList.innerHTML = '';
      const recipes = getFilteredRecipes();

      if (recipes.length === 0) {
        leftList.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:30px 0; font-size:0.85em;">該階級目前沒有配方。</p>`;
        return;
      }

      recipes.forEach(r => {
        const targetTpl = mode === 'smelt' 
          ? null 
          : DataStore.getEquipmentTemplate(r.targetEquipmentId);
        const matTpl = mode === 'smelt' 
          ? materialsJson.find(m => m.id === r.targetEquipmentId) 
          : null;
        
        const isSel = r.id === selectedRecipeId;
        const recipeTier = r.tier || 1;
        const requiredForgeLevel = recipeTier === 4 ? 3 : recipeTier;
        const isLockedByFacility = (territory.forgeLevel || 0) < requiredForgeLevel;

        const card = document.createElement('div');
        card.style.background = isSel ? 'rgba(234, 179, 8, 0.25)' : (isLockedByFacility ? 'rgba(15, 12, 10, 0.6)' : 'rgba(30, 24, 20, 0.75)');
        card.style.border = `1.5px solid ${isSel ? '#eab308' : (isLockedByFacility ? 'rgba(100, 116, 139, 0.3)' : 'rgba(217, 119, 6, 0.3)')}`;
        card.style.borderRadius = '8px';
        card.style.padding = '8px 10px';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '10px';
        card.style.cursor = 'pointer';
        card.style.opacity = isLockedByFacility ? '0.75' : '1';

        const iconHtml = mode === 'smelt' 
          ? `<div style="flex-shrink:0; display:flex; align-items:center; justify-content:center;">${renderUniversalIcon(matTpl?.icon || '📦', 36)}</div>`
          : `<div style="flex-shrink:0;">${renderEquipIcon(targetTpl, ICON_SIZE.SM)}</div>`;

        card.innerHTML = `
          ${iconHtml}
          <div style="flex:1; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:${isSel ? '#fbbf24' : (isLockedByFacility ? '#94a3b8' : '#e2e8f0')}; font-size:0.9em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name}</strong>
              <span style="font-size:0.75em; padding:1px 4px; border-radius:3px; background:${isLockedByFacility ? 'rgba(239, 68, 68, 0.2)' : 'rgba(217, 119, 6, 0.25)'}; color:${isLockedByFacility ? '#ef4444' : '#fbbf24'}; font-weight:bold;">
                ${isLockedByFacility ? `🔒 Lv.${requiredForgeLevel}` : `T${recipeTier}`}
              </span>
            </div>
            <span style="font-size:0.75em; color:#94a3b8;">${r.goldCost} 金幣</span>
          </div>
        `;

        if (targetTpl) {
          attachTooltip(card, () => getEquipTooltipHtml(targetTpl));
        }

        card.onclick = () => {
          selectedRecipeId = r.id;
          craftAmount = 1;
          renderLeftList();
          renderRightPanel();
        };

        leftList.appendChild(card);
      });
    };

    const renderRightPanel = () => {
      rightPanel.innerHTML = '';
      const recipes = getFilteredRecipes();
      if (recipes.length === 0) {
        rightPanel.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:50px 0;">請選擇欲製作的項目。</p>`;
        return;
      }

      const recipe = recipes.find(r => r.id === selectedRecipeId) || recipes[0];
      const recipeTier = recipe.tier || 1;
      const requiredForgeLevel = recipeTier === 4 ? 3 : recipeTier;
      const isLockedByFacility = (territory.forgeLevel || 0) < requiredForgeLevel;
      
      let targetTemplate: any = null;
      let targetMat: any = null;
      
      if (mode === 'smelt') {
        targetMat = materialsJson.find(m => m.id === recipe.targetEquipmentId);
      } else {
        targetTemplate = DataStore.getEquipmentTemplate(recipe.targetEquipmentId);
      }

      let maxCraftable = 999;
      if (recipe.goldCost > 0) {
        maxCraftable = Math.min(maxCraftable, Math.floor(territory.gold / recipe.goldCost));
      }
      if (recipe.baseEquipmentId) {
        maxCraftable = Math.min(maxCraftable, 1);
      } else {
        for (const [matId, reqAmount] of Object.entries(recipe.requiredMaterials || {})) {
          const hasCount = getMaterialCount(territory, matId);
          maxCraftable = Math.min(maxCraftable, Math.floor(hasCount / (reqAmount as number)));
        }
      }
      if (maxCraftable <= 0) maxCraftable = 0;
      if (craftAmount > maxCraftable && maxCraftable > 0) craftAmount = maxCraftable;
      if (craftAmount < 1) craftAmount = 1;

      const baseTemplate = recipe.baseEquipmentId ? DataStore.getEquipmentTemplate(recipe.baseEquipmentId) : null;
      const baseEquipInWarehouse = recipe.baseEquipmentId ? territory.warehouse.find(eq => eq.id === recipe.baseEquipmentId) : null;
      const hasBaseEquip = !recipe.baseEquipmentId || !!baseEquipInWarehouse;

      // 檢查變異專用神兵重鑄書
      let hasTome = true;
      let tomeDef: any = null;
      if (recipe.isVariant && recipe.requireTomeId) {
        const tomeCount = getMaterialCount(territory, recipe.requireTomeId) + getMaterialCount(territory, 'mat_reforge_scroll');
        hasTome = tomeCount > 0;
        tomeDef = materialsJson.find(m => m.id === recipe.requireTomeId) || { name: '專屬重鑄書', icon: '📜' };
      }

      let canCraft = hasBaseEquip && !isLockedByFacility && hasTome;
      const matCardsHtml: string[] = [];

      if (baseTemplate) {
        matCardsHtml.push(`
          <div class="mat-slot-box" style="display:flex; flex-direction:column; align-items:center; width:80px;">
            <div style="width:64px; height:64px; background:rgba(0,0,0,0.6); border:2px solid ${hasBaseEquip ? '#22c55e' : '#ef4444'}; border-radius:8px; display:flex; justify-content:center; align-items:center; box-shadow:0 3px 10px rgba(0,0,0,0.6);">
              ${renderEquipIcon(baseTemplate, ICON_SIZE.MD)}
            </div>
            <div style="font-size:0.78em; color:#e2e8f0; margin-top:4px; font-weight:bold; text-align:center; height:28px; overflow:hidden;">${baseTemplate.name}</div>
            <div style="font-size:0.82em; color:${hasBaseEquip ? '#22c55e' : '#ef4444'}; font-weight:bold; margin-top:2px;">${hasBaseEquip ? '1/1' : '0/1'}</div>
          </div>
        `);
      }

      if (recipe.isVariant && recipe.requireTomeId) {
        matCardsHtml.push(`
          <div class="mat-slot-box" style="display:flex; flex-direction:column; align-items:center; width:80px;">
            <div style="width:64px; height:64px; background:rgba(0,0,0,0.6); border:2px solid ${hasTome ? '#22c55e' : '#ef4444'}; border-radius:8px; display:flex; justify-content:center; align-items:center; box-shadow:0 3px 10px rgba(0,0,0,0.6);">
              ${renderUniversalIcon(tomeDef?.icon || '📜', 44)}
            </div>
            <div style="font-size:0.78em; color:#e2e8f0; margin-top:4px; font-weight:bold; text-align:center; height:28px; overflow:hidden;">${tomeDef?.name || '重鑄書'}</div>
            <div style="font-size:0.82em; color:${hasTome ? '#22c55e' : '#ef4444'}; font-weight:bold; margin-top:2px;">${hasTome ? '1/1' : '0/1'}</div>
          </div>
        `);
      }

      for (const [matId, reqAmount] of Object.entries(recipe.requiredMaterials || {})) {
        const matDef = materialsJson.find(m => m.id === matId);
        const name = matDef ? matDef.name : matId;
        const icon = matDef ? matDef.icon : '🧲';
        const hasCount = getMaterialCount(territory, matId);
        const totalReq = (reqAmount as number) * craftAmount;
        const isEnough = hasCount >= totalReq;
        if (!isEnough) canCraft = false;

        matCardsHtml.push(`
          <div class="mat-slot-box" style="display:flex; flex-direction:column; align-items:center; width:80px;">
            <div style="width:64px; height:64px; background:rgba(0,0,0,0.6); border:2px solid ${isEnough ? '#22c55e' : '#ef4444'}; border-radius:8px; display:flex; justify-content:center; align-items:center; box-shadow:0 3px 10px rgba(0,0,0,0.6);">
              ${renderUniversalIcon(icon, 44)}
            </div>
            <div style="font-size:0.78em; color:#e2e8f0; margin-top:4px; font-weight:bold; text-align:center; height:28px; overflow:hidden;">${name}</div>
            <div style="font-size:0.82em; color:${isEnough ? '#22c55e' : '#ef4444'}; font-weight:bold; margin-top:2px;">${hasCount}/${totalReq}</div>
          </div>
        `);
      }

      const totalGoldCost = recipe.goldCost * craftAmount;
      const goldEnough = territory.gold >= totalGoldCost;
      if (!goldEnough) canCraft = false;

      const amountSelectorHtml = `
        <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:12px;">
          <button id="btn-amount-sub" style="width:30px; height:30px; background:rgba(0,0,0,0.5); border:1px solid #64748b; color:#fff; cursor:pointer; font-weight:bold; border-radius:4px;">-</button>
          <input type="number" id="input-craft-amount" class="no-spinners" value="${craftAmount}" style="width:50px; height:30px; text-align:center; background:rgba(0,0,0,0.8); border:1px solid #fbbf24; color:#fff; font-weight:bold; border-radius:4px; outline:none;" ${maxCraftable <= 1 || isLockedByFacility ? 'disabled' : ''}>
          <button id="btn-amount-add" style="width:30px; height:30px; background:rgba(0,0,0,0.5); border:1px solid #64748b; color:#fff; cursor:pointer; font-weight:bold; border-radius:4px;">+</button>
          <button id="btn-amount-max" style="padding:0 8px; height:30px; background:rgba(217,119,6,0.3); border:1px solid #d97706; color:#fbbf24; cursor:pointer; font-weight:bold; border-radius:4px; transition:all 0.2s;">MAX</button>
        </div>
      `;

      let targetHtml = '';
      if (mode === 'smelt' && targetMat) {
        targetHtml = `
          <div style="display:flex; gap:16px; align-items:center; background:rgba(30, 24, 20, 0.85); padding:16px; border-radius:8px; border:1px solid rgba(217,119,6,0.35);">
            <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid rgba(217,119,6,0.3); flex-shrink:0; display:flex; align-items:center; justify-content:center;">${renderUniversalIcon(targetMat.icon, 54)}</div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:#eab308; font-size:1.4em;">${targetMat.name}</h3>
                <span style="padding:2px 7px; background:rgba(217,119,6,0.25); border-radius:4px; color:#fbbf24; font-weight:bold; font-size:0.85em;">T${recipeTier}</span>
              </div>
              <div style="font-size:0.85em; color:#94a3b8; margin-top:4px;">${targetMat.description}</div>
            </div>
          </div>
        `;
      } else if (targetTemplate) {
        targetHtml = `
          <div style="display:flex; gap:16px; align-items:center; background:rgba(30, 24, 20, 0.85); padding:16px; border-radius:8px; border:1px solid rgba(217,119,6,0.35);">
            <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid rgba(217,119,6,0.3); flex-shrink:0; display:flex; align-items:center; justify-content:center;">${renderEquipIcon(targetTemplate, ICON_SIZE.LG)}</div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:#eab308; font-size:1.4em;">${targetTemplate.name}</h3>
                <span style="padding:2px 7px; background:rgba(217,119,6,0.25); border-radius:4px; color:#fbbf24; font-weight:bold; font-size:0.85em;">T${targetTemplate.tier || recipeTier}</span>
              </div>
              <div style="font-size:0.85em; color:#94a3b8; margin-top:4px;">${getElementBadge(targetTemplate.element)} | 職業限制：${targetTemplate.allowedJobs ? targetTemplate.allowedJobs.join('/') : '無限制'}</div>
            </div>
          </div>
        `;
      }

      let execBtnText = mode === 'smelt' ? `冶煉 x${craftAmount}` : (recipe.baseEquipmentId ? `重鑄` : `鍛造 x${craftAmount}`);
      if (isLockedByFacility) {
        execBtnText = `🔒 設施等級不足 (需鍛造屋 Lv.${requiredForgeLevel})`;
      } else if (!hasTome) {
        execBtnText = `🔒 缺少專屬重鑄書道具`;
      } else if (!hasBaseEquip) {
        execBtnText = `🔒 倉庫缺少前置裝備`;
      }

      rightPanel.innerHTML = `
        <div style="flex:1;">
          <h3 style="margin-top:0; color:#cbd5e1; font-size:1.1em; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; margin-bottom:16px;">${mode === 'smelt' ? '🏭 冶煉素材' : '⚒️ 裝備鍛造 / 重鑄'}</h3>
          ${targetHtml}
          <div style="background:rgba(25, 20, 16, 0.8); padding:16px; border-radius:8px; border:1px solid rgba(217,119,6,0.2); margin-top:16px;">
            <h4 style="margin-top:0; color:#fbbf24; font-size:0.95em; margin-bottom:12px; text-align:center; letter-spacing:1px;">═══ 所需材料與前置需求 ═══</h4>
            <div style="display:flex; gap:16px; justify-content:center; overflow-x:auto; padding:6px 0;">${matCardsHtml.join('')}</div>
          </div>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:14px; text-align:center;">
          ${amountSelectorHtml}
          <div style="font-size:0.95em; color:#cbd5e1; margin-bottom:10px;">
            消耗：<span style="color:${goldEnough ? '#22c55e' : '#ef4444'}; font-weight:bold;">${territory.gold}</span> / <span style="color:#fbbf24; font-weight:bold;">${totalGoldCost} 金幣</span>
          </div>
          <button id="btn-exec-recipe-craft-furnace" class="action-btn" style="width:280px; padding:9px; font-size:1.05em; font-weight:bold; background:${canCraft ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.1)'}; color:${canCraft ? '#fff' : '#64748b'};" ${canCraft ? '' : 'disabled'}>
            ${execBtnText}
          </button>
        </div>
      `;

      // 綁定前置裝備與材料框體懸浮 Tooltip
      if (baseTemplate) {
        const firstBox = rightPanel.querySelector('.mat-slot-box');
        if (firstBox) attachTooltip(firstBox as HTMLElement, () => getEquipTooltipHtml(baseTemplate));
      }

      // 綁定數量選擇器事件
      const btnSub = rightPanel.querySelector('#btn-amount-sub');
      const btnAdd = rightPanel.querySelector('#btn-amount-add');
      const btnMax = rightPanel.querySelector('#btn-amount-max');
      const inputAmt = rightPanel.querySelector('#input-craft-amount') as HTMLInputElement;

      if (btnSub) btnSub.addEventListener('click', () => { if (craftAmount > 1) { craftAmount--; renderRightPanel(); } });
      if (btnAdd) btnAdd.addEventListener('click', () => { if (craftAmount < Math.max(1, maxCraftable)) { craftAmount++; renderRightPanel(); } });
      if (btnMax) btnMax.addEventListener('click', () => { craftAmount = Math.max(1, maxCraftable); renderRightPanel(); });
      if (inputAmt) inputAmt.addEventListener('change', (e) => {
        let val = parseInt((e.target as HTMLInputElement).value) || 1;
        if (val < 1) val = 1;
        if (val > Math.max(1, maxCraftable)) val = Math.max(1, maxCraftable);
        craftAmount = val;
        renderRightPanel();
      });

      rightPanel.querySelector('#btn-exec-recipe-craft-furnace')?.addEventListener('click', () => {
        if (!canCraft) return;

        if (recipe.baseEquipmentId) {
          const baseIndex = territory.warehouse.findIndex(eq => eq.id === recipe.baseEquipmentId);
          if (baseIndex === -1) return;
          territory.warehouse.splice(baseIndex, 1);
        }

        // 消耗變異專用重鑄書 (如果有的話)
        if (recipe.isVariant && recipe.requireTomeId) {
          if (getMaterialCount(territory, recipe.requireTomeId) > 0) {
            consumeMaterial(territory, recipe.requireTomeId, 1);
          } else if (getMaterialCount(territory, 'mat_reforge_scroll') > 0) {
            consumeMaterial(territory, 'mat_reforge_scroll', 1);
          }
        }

        for (const [matId, reqAmount] of Object.entries(recipe.requiredMaterials || {})) {
          consumeMaterial(territory, matId, (reqAmount as number) * craftAmount);
        }
        territory.gold -= recipe.goldCost * craftAmount;

        if (mode === 'smelt') {
          territory.materials[recipe.targetEquipmentId] = (territory.materials[recipe.targetEquipmentId] || 0) + craftAmount;
          ToastManager.show(`✨ 冶煉成功！獲得【${targetMat?.name}】 x${craftAmount}！`, 'success');
        } else {
          for (let i = 0; i < craftAmount; i++) {
            const newEq = EquipmentGenerator.generate(recipe.targetEquipmentId);
            if (newEq) {
              territory.warehouse.push(newEq);
            }
          }
          ToastManager.show(`✨ ${recipe.baseEquipmentId ? '重鑄' : `鍛造 x${craftAmount}`}成功！獲得【${targetTemplate?.name || '裝備'}】！`, 'success');
        }
        
        craftAmount = 1; // 製作完成後數量重置為 1，避免下次材料不夠
        UIManager.updateUI();
        renderLeftList();
        renderRightPanel();
      });
    };

    renderFilterTabs();
    renderLeftList();
    renderRightPanel();

    splitContainer.appendChild(leftPanel);
    splitContainer.appendChild(rightPanel);
    workspace.appendChild(splitContainer);
  }
  
  private renderForgeEnchantMode() {
    const territory = GameState.myTerritory;
    const workspace = document.getElementById('forge-workspace')!;
    workspace.innerHTML = '';

    const elemStones = [
      { matId: 'mat_element_fire', element: ElementType.FIRE, name: '熾炎附魔石', icon: '🔥', color: '#ef4444' },
      { matId: 'mat_element_ice', element: ElementType.ICE, name: '霜冰附魔石', icon: '❄️', color: '#38bdf8' },
      { matId: 'mat_element_lightning', element: ElementType.LIGHTNING, name: '疾雷附魔石', icon: '⚡', color: '#eab308' },
      { matId: 'mat_element_holy', element: ElementType.HOLY, name: '聖光附魔石', icon: '☀️', color: '#fef08a' },
      { matId: 'mat_element_dark', element: ElementType.DARK, name: '暗影附魔石', icon: '🌙', color: '#a855f7' }
    ];

    let selectedStoneMatId = elemStones[0].matId;

    // 收集所有可附魔的裝備（依據來源）
    const getAvailableItems = (): { eq: Equipment; label?: string; advName?: string }[] => {
      if (this.enchantSource === 'WAREHOUSE') {
        return (territory.warehouse || []).map(eq => ({ eq }));
      } else {
        const items: { eq: Equipment; label?: string; advName?: string }[] = [];
        (GameState.adventurers || []).forEach(adv => {
          if (!adv.equipment) return;
          const slots: EquipmentSlot[] = [EquipmentSlot.WEAPON, EquipmentSlot.ARMOR, EquipmentSlot.ACCESSORY];
          slots.forEach(slot => {
            const eq = adv.equipment[slot];
            if (eq) {
              const slotName = slot === EquipmentSlot.WEAPON ? '武器' : (slot === EquipmentSlot.ARMOR ? '防具' : '飾品');
              items.push({
                eq,
                label: `${adv.name} (${slotName})`,
                advName: adv.name
              });
            }
          });
        });
        return items;
      }
    };

    let availableItems = getAvailableItems();
    let selectedUuid = availableItems.length > 0 ? availableItems[0].eq.uuid : null;

    // 雙欄 Container
    const splitContainer = document.createElement('div');
    splitContainer.style.display = 'flex';
    splitContainer.style.gap = '15px';
    splitContainer.style.flex = '1';
    splitContainer.style.minHeight = '0';

    // 左欄：420px 寬，半透明玻璃質感
    const leftPanel = document.createElement('div');
    leftPanel.style.width = '420px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.background = 'rgba(18, 14, 11, 0.68)';
    leftPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    leftPanel.style.borderRadius = '8px';
    leftPanel.style.padding = '12px';

    // 頂部來源切換按鈕列
    const sourceToggleRow = document.createElement('div');
    sourceToggleRow.style.display = 'flex';
    sourceToggleRow.style.gap = '8px';
    sourceToggleRow.style.marginBottom = '10px';

    const btnSourceWh = document.createElement('button');
    btnSourceWh.style.flex = '1';
    btnSourceWh.style.padding = '6px 0';
    btnSourceWh.style.fontSize = '0.85em';
    btnSourceWh.style.borderRadius = '4px';
    btnSourceWh.style.cursor = 'pointer';
    btnSourceWh.style.border = `1px solid ${this.enchantSource === 'WAREHOUSE' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
    btnSourceWh.style.background = this.enchantSource === 'WAREHOUSE' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(0,0,0,0.4)';
    btnSourceWh.style.color = this.enchantSource === 'WAREHOUSE' ? '#fbbf24' : '#94a3b8';
    btnSourceWh.textContent = `📦 領地倉庫 (${territory.warehouse?.length || 0})`;
    btnSourceWh.onclick = () => {
      this.enchantSource = 'WAREHOUSE';
      this.renderForgeEnchantMode();
    };

    let advEquipTotal = 0;
    (GameState.adventurers || []).forEach(adv => {
      if (adv.equipment) {
        if (adv.equipment[EquipmentSlot.WEAPON]) advEquipTotal++;
        if (adv.equipment[EquipmentSlot.ARMOR]) advEquipTotal++;
        if (adv.equipment[EquipmentSlot.ACCESSORY]) advEquipTotal++;
      }
    });

    const btnSourceAdv = document.createElement('button');
    btnSourceAdv.style.flex = '1';
    btnSourceAdv.style.padding = '6px 0';
    btnSourceAdv.style.fontSize = '0.85em';
    btnSourceAdv.style.borderRadius = '4px';
    btnSourceAdv.style.cursor = 'pointer';
    btnSourceAdv.style.border = `1px solid ${this.enchantSource === 'ADVENTURER' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
    btnSourceAdv.style.background = this.enchantSource === 'ADVENTURER' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(0,0,0,0.4)';
    btnSourceAdv.style.color = this.enchantSource === 'ADVENTURER' ? '#fbbf24' : '#94a3b8';
    btnSourceAdv.textContent = `👤 傭兵穿戴 (${advEquipTotal})`;
    btnSourceAdv.onclick = () => {
      this.enchantSource = 'ADVENTURER';
      this.renderForgeEnchantMode();
    };

    sourceToggleRow.appendChild(btnSourceWh);
    sourceToggleRow.appendChild(btnSourceAdv);
    leftPanel.appendChild(sourceToggleRow);

    const leftGrid = document.createElement('div');
    leftGrid.style.flex = '1';
    leftGrid.style.overflowY = 'auto';
    leftGrid.style.overflowX = 'hidden';
    leftGrid.style.display = 'grid';
    leftGrid.style.gridTemplateColumns = this.enchantSource === 'ADVENTURER' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))';
    leftGrid.style.gap = '6px';
    leftGrid.style.paddingRight = '2px';
    leftGrid.style.alignContent = 'flex-start';
    leftPanel.appendChild(leftGrid);

    // 右欄：附魔台
    const rightPanel = document.createElement('div');
    rightPanel.style.flex = '1';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.justifyContent = 'space-between';
    rightPanel.style.background = 'rgba(18, 14, 11, 0.68)';
    rightPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    rightPanel.style.borderRadius = '8px';
    rightPanel.style.padding = '18px';

    const renderLeftGrid = () => {
      leftGrid.innerHTML = '';
      availableItems = getAvailableItems();
      if (!selectedUuid || !availableItems.some(item => item.eq.uuid === selectedUuid)) {
        selectedUuid = availableItems.length > 0 ? availableItems[0].eq.uuid : null;
      }

      if (availableItems.length === 0) {
        leftGrid.innerHTML = `<div style="grid-column: 1 / -1; color:#94a3b8; text-align:center; padding:40px 0; font-size:0.9em;">
          ${this.enchantSource === 'WAREHOUSE' ? '倉庫內目前沒有任何可附魔的裝備。' : '目前所有傭兵身上皆未穿戴任何裝備。'}
        </div>`;
        return;
      }

      availableItems.forEach(item => {
        const eq = item.eq;
        const isSel = eq.uuid === selectedUuid;
        const card = document.createElement('div');

        if (this.enchantSource === 'ADVENTURER') {
          // 傭兵穿戴：2 欄卡片式排版
          card.style.background = isSel ? 'rgba(234, 179, 8, 0.25)' : 'rgba(30, 24, 20, 0.8)';
          card.style.border = `1.5px solid ${isSel ? '#eab308' : 'rgba(217, 119, 6, 0.3)'}`;
          card.style.borderRadius = '6px';
          card.style.padding = '6px 8px';
          card.style.display = 'flex';
          card.style.alignItems = 'center';
          card.style.gap = '8px';
          card.style.cursor = 'pointer';
          card.style.boxSizing = 'border-box';
          card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';

          card.innerHTML = `
            <div style="flex-shrink:0;">${renderEquipIcon(eq, ICON_SIZE.SM)}</div>
            <div style="flex:1; min-width:0; line-height:1.2;">
              <div style="font-size:0.85em; font-weight:bold; color:${isSel ? '#fbbf24' : '#e2e8f0'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${eq.name} ${getElementBadge(eq.element)}
              </div>
              <div style="font-size:0.75em; color:#94a3b8; margin-top:2px;">
                👤 ${item.label || '穿戴中'}
              </div>
            </div>
          `;
        } else {
          // 倉庫：5 欄正方形網格
          card.style.background = isSel ? 'rgba(234, 179, 8, 0.25)' : 'rgba(30, 24, 20, 0.8)';
          card.style.border = `1.5px solid ${isSel ? '#eab308' : 'rgba(217, 119, 6, 0.3)'}`;
          card.style.borderRadius = '6px';
          card.style.padding = '4px 3px';
          card.style.display = 'flex';
          card.style.flexDirection = 'column';
          card.style.alignItems = 'center';
          card.style.textAlign = 'center';
          card.style.justifyContent = 'space-between';
          card.style.cursor = 'pointer';
          card.style.height = '94px';
          card.style.minWidth = '0';
          card.style.boxSizing = 'border-box';
          card.style.overflow = 'hidden';
          card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';

          card.innerHTML = `
            <div style="flex:1; display:flex; align-items:center; justify-content:center;">
              ${renderEquipIcon(eq, ICON_SIZE.MD)}
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; font-size:0.7em; border-top:1px solid rgba(255,255,255,0.12); padding:2px 3px 0; margin-top:2px;">
              <span style="color:#38bdf8; font-weight:bold;">+${eq.enhancementLevel || 0}</span>
              <span style="font-size:0.85em;">${getElementBadge(eq.element)}</span>
            </div>
          `;
        }

        attachTooltip(card, () => getEquipTooltipHtml(eq));

        card.onclick = () => {
          selectedUuid = eq.uuid;
          renderLeftGrid();
          renderRightPanel();
        };

        leftGrid.appendChild(card);
      });
    };

    const renderRightPanel = () => {
      rightPanel.innerHTML = '';
      availableItems = getAvailableItems();
      const targetItem = availableItems.find(x => x.eq.uuid === selectedUuid) || (availableItems.length > 0 ? availableItems[0] : null);

      if (!targetItem) {
        rightPanel.innerHTML = `
          <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#64748b;">
            <div style="font-size:3em; margin-bottom:10px;">💎</div>
            <div>請從左側選擇一件裝備以開啟元素附魔台</div>
          </div>
        `;
        return;
      }

      const eq = targetItem.eq;
      const selStone = elemStones.find(s => s.matId === selectedStoneMatId) || elemStones[0];
      const stoneCount = getMaterialCount(territory, selStone.matId);

        const stoneCardsHtml = elemStones.map(stone => {
        const count = getMaterialCount(territory, stone.matId);
        const isSel = stone.matId === selectedStoneMatId;
        return `
          <div class="stone-opt-box-altar" data-id="${stone.matId}" style="background:${isSel ? 'rgba(234,179,8,0.25)' : 'rgba(35, 28, 22, 0.85)'}; border:2px solid ${isSel ? '#eab308' : 'rgba(217,119,6,0.3)'}; border-radius:8px; padding:12px; display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer; width:110px;">
            <div style="width:48px; height:48px; display:flex; align-items:center; justify-content:center;">${renderUniversalIcon(stone.icon, 44)}</div>
            <div style="font-size:0.85em; color:${stone.color}; font-weight:bold; margin-top:4px;">${stone.name}</div>
            <div style="font-size:0.78em; color:${count > 0 ? '#22c55e' : '#ef4444'}; margin-top:4px; font-weight:bold;">擁有 x${count}</div>
          </div>
        `;
      }).join('');

      const wearerBadge = targetItem.advName 
        ? `<div style="font-size:0.82em; color:#38bdf8; margin-top:3px;">👤 穿戴者：${targetItem.label} (就地附魔，即時生效)</div>`
        : '';

      rightPanel.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- 頂部選中裝備卡片 -->
          <div style="display:flex; gap:16px; align-items:center; background:rgba(30, 24, 20, 0.85); padding:16px; border-radius:8px; border:1px solid rgba(217,119,6,0.35);">
            <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid rgba(217,119,6,0.3); flex-shrink:0; display:flex; align-items:center; justify-content:center;">${renderEquipIcon(eq, ICON_SIZE.LG)}</div>
            <div style="flex:1;">
              <h3 style="margin:0; color:#eab308; font-size:1.35em;">${eq.name}</h3>
              <div style="font-size:0.85em; color:#94a3b8; margin-top:4px;">
                當前元素：${getElementBadge(eq.element)}
              </div>
              ${wearerBadge}
              <div style="font-size:0.85em; margin-top:6px;">
                屬性效果：${formatStatsTags(eq.combatEffects, eq.effects)}
              </div>
            </div>
          </div>

          <!-- 中間 5 大元素石框體對齊圖三 -->
          <div style="background:rgba(25, 20, 16, 0.8); padding:16px; border-radius:8px; border:1px solid rgba(217,119,6,0.2);">
            <h4 style="margin-top:0; color:#fbbf24; font-size:0.95em; margin-bottom:12px; text-align:center;">💎 選擇背包中的元素附魔石 (點擊卡片選取)</h4>
            <div style="display:flex; gap:14px; justify-content:center; overflow-x:auto; padding:4px 0;">
              ${stoneCardsHtml}
            </div>
          </div>
        </div>

        <!-- 下方按鈕 -->
        <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:14px; text-align:center;">
          <div style="font-size:0.9em; color:#cbd5e1; margin-bottom:10px;">
            注入 <strong style="color:${selStone.color};">${selStone.name} (${renderUniversalIcon(selStone.icon, 20)})</strong> 覆蓋注入元素
          </div>
          <button id="btn-exec-enchant-furnace" class="action-btn" style="width:220px; padding:9px; font-size:1.05em; font-weight:bold; background:${stoneCount > 0 ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : 'rgba(255,255,255,0.1)'}; color:${stoneCount > 0 ? '#fff' : '#64748b'};" ${stoneCount > 0 ? '' : 'disabled'}>
            注入元素
          </button>
        </div>
      `;

      rightPanel.querySelectorAll('.stone-opt-box-altar').forEach(opt => {
        opt.addEventListener('click', (e) => {
          selectedStoneMatId = (e.currentTarget as HTMLElement).getAttribute('data-id')!;
          renderRightPanel();
        });
      });

      rightPanel.querySelector('#btn-exec-enchant-furnace')?.addEventListener('click', () => {
        if (stoneCount <= 0) return;
        consumeMaterial(territory, selStone.matId, 1);
        eq.element = selStone.element;
        ToastManager.show(`✨ 附魔成功！【${eq.name}】已成功注入 ${selStone.name}！`, 'success');
        UIManager.updateUI();
        renderLeftGrid();
        renderRightPanel();
      });
    };

    renderLeftGrid();
    renderRightPanel();

    splitContainer.appendChild(leftPanel);
    splitContainer.appendChild(rightPanel);
    workspace.appendChild(splitContainer);
  }
  
  private renderForgeDisassembleMode() {
    const territory = GameState.myTerritory;
    const workspace = document.getElementById('forge-workspace')!;
    workspace.innerHTML = '';
  
    if (!territory.warehouse || territory.warehouse.length === 0) {
      workspace.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:50px 0;">倉庫內沒有可拆解的裝備。</p>';
      return;
    }
  
    let selectedUuid = territory.warehouse[0].uuid;
  
    // 雙欄 Container
    const splitContainer = document.createElement('div');
    splitContainer.style.display = 'flex';
    splitContainer.style.gap = '15px';
    splitContainer.style.flex = '1';
    splitContainer.style.minHeight = '0';
  
    // 左欄：選擇欲拆解裝備
    const leftPanel = document.createElement('div');
    leftPanel.style.width = '420px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.background = 'rgba(18, 14, 11, 0.68)';
    leftPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    leftPanel.style.borderRadius = '8px';
    leftPanel.style.padding = '12px';
  
    const leftTitle = document.createElement('h4');
    leftTitle.style.margin = '0 0 10px 0';
    leftTitle.style.color = '#fbbf24';
    leftTitle.style.borderBottom = '1px solid rgba(217, 119, 6, 0.2)';
    leftTitle.style.paddingBottom = '6px';
    leftTitle.textContent = '♻️ 選擇欲拆解裝備';
    leftPanel.appendChild(leftTitle);
  
    const leftGrid = document.createElement('div');
    leftGrid.style.flex = '1';
    leftGrid.style.overflowY = 'auto';
    leftGrid.style.overflowX = 'hidden';
    leftGrid.style.display = 'grid';
    leftGrid.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
    leftGrid.style.gap = '6px';
    leftGrid.style.paddingRight = '2px';
    leftGrid.style.alignContent = 'flex-start';
    leftPanel.appendChild(leftGrid);
  
    // 右欄：拆解預覽區
    const rightPanel = document.createElement('div');
    rightPanel.style.flex = '1';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.justifyContent = 'space-between';
    rightPanel.style.background = 'rgba(18, 14, 11, 0.68)';
    rightPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    rightPanel.style.borderRadius = '8px';
    rightPanel.style.padding = '18px';
  
    const renderLeftGrid = () => {
      leftGrid.innerHTML = '';
      territory.warehouse.forEach(eq => {
        const isSel = eq.uuid === selectedUuid;
        const card = document.createElement('div');
        card.style.background = isSel ? 'rgba(234, 179, 8, 0.25)' : 'rgba(30, 24, 20, 0.8)';
        card.style.border = `1.5px solid ${isSel ? '#eab308' : 'rgba(217, 119, 6, 0.3)'}`;
        card.style.borderRadius = '6px';
        card.style.padding = '4px 3px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.textAlign = 'center';
        card.style.justifyContent = 'space-between';
        card.style.cursor = 'pointer';
        card.style.height = '94px';
        card.style.minWidth = '0';
        card.style.boxSizing = 'border-box';
        card.style.overflow = 'hidden';
        card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
  
        card.innerHTML = `
          <div style="flex:1; display:flex; align-items:center; justify-content:center;">
            ${renderEquipIcon(eq, ICON_SIZE.MD)}
          </div>
          <div style="display:flex; justify-content:space-between; width:100%; font-size:0.7em; border-top:1px solid rgba(255,255,255,0.12); padding:2px 3px 0; margin-top:2px;">
            <span style="color:#38bdf8; font-weight:bold;">+${eq.enhancementLevel || 0}</span>
            <span style="color:#fbbf24; font-size:0.85em; padding:0 2px; background:rgba(217,119,6,0.25); border-radius:2px;">T${eq.tier || 1}</span>
          </div>
        `;
  
        attachTooltip(card, () => getEquipTooltipHtml(eq));
  
        card.onclick = () => {
          selectedUuid = eq.uuid;
          renderLeftGrid();
          renderRightPanel();
        };
  
        leftGrid.appendChild(card);
      });
    };
  
    const renderRightPanel = () => {
      rightPanel.innerHTML = '';
      const selectedEq = territory.warehouse.find(eq => eq.uuid === selectedUuid);
      if (!selectedEq) return;
  
      // 決定拆解獲得的材料
      const slot = selectedEq.slot;
      const wType = selectedEq.weaponType;
      const tier = selectedEq.tier || 1;
      
      let returnMatId = 'mat_stone_brick';
      let returnCount = 1;
      
      if (wType === 'GREATSWORD' || wType === 'DUAL_SWORDS' || wType === 'SWORD_AND_SHIELD' || wType === 'DAGGERS' || wType === 'HAMMER' || wType === 'SCYTHE' || selectedEq.armorType === 'HEAVY' || selectedEq.armorType === 'LEATHER') {
        returnMatId = tier >= 2 ? 'mat_steel_ingot' : 'mat_iron_ingot';
        returnCount = Math.max(1, Math.floor(tier * 1.5));
      } else if (wType === 'BOW' || wType === 'MAGIC_BOW' || wType === 'RUNE_SHIELD') {
        returnMatId = 'mat_wood_plank';
        returnCount = Math.max(1, Math.floor(tier * 1.5));
      } else if (wType === 'STAFF' || wType === 'HOLY_BOOK' || wType === 'MAGIC_RING' || selectedEq.armorType === 'CLOTH') {
        returnMatId = 'mat_cloth';
        returnCount = Math.max(1, Math.floor(tier * 1.5));
      } else if (slot === 'ACCESSORY') {
        returnMatId = 'mat_reforge_scroll';
        returnCount = 1;
      }
      
      // 如果裝備有強化等級，有機率返還鐵礦石/精鋼石
      const enhanceRetMatId = selectedEq.enhancementLevel! >= 3 ? 'mat_element_fire' : 'mat_whetstone';
      const enhanceRetCount = selectedEq.enhancementLevel! > 0 ? Math.ceil(selectedEq.enhancementLevel! / 2) : 0;
  
      const retMatDef = materialsJson.find(m => m.id === returnMatId);
      const enhanceMatDef = materialsJson.find(m => m.id === enhanceRetMatId);
  
      let resultCards = `
        <div style="background:rgba(0,0,0,0.6); border:1px solid #10b981; border-radius:8px; padding:12px; display:flex; align-items:center; gap:12px;">
          <div style="width:48px; height:48px; display:flex; justify-content:center; align-items:center;">${renderUniversalIcon(retMatDef?.icon || '📦', 44)}</div>
          <div>
            <div style="font-weight:bold; color:#a7f3d0;">${retMatDef?.name || returnMatId}</div>
            <div style="font-size:0.85em; color:#10b981;">x ${returnCount}</div>
          </div>
        </div>
      `;
      
      if (enhanceRetCount > 0) {
        resultCards += `
          <div style="background:rgba(0,0,0,0.6); border:1px solid #10b981; border-radius:8px; padding:12px; display:flex; align-items:center; gap:12px;">
            <div style="width:48px; height:48px; display:flex; justify-content:center; align-items:center;">${renderUniversalIcon(enhanceMatDef?.icon || '📦', 44)}</div>
            <div>
              <div style="font-weight:bold; color:#a7f3d0;">${enhanceMatDef?.name || enhanceRetMatId}</div>
              <div style="font-size:0.85em; color:#10b981;">x ${enhanceRetCount}</div>
            </div>
          </div>
        `;
      }
  
      rightPanel.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- 目標裝備 -->
          <div style="display:flex; gap:16px; align-items:center; background:rgba(30, 24, 20, 0.85); padding:16px; border-radius:8px; border:1px solid rgba(217,119,6,0.35);">
            <div id="disassemble-source-icon" style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; border:1px solid rgba(217,119,6,0.3); flex-shrink:0; display:flex; align-items:center; justify-content:center; cursor:pointer;">
              ${renderEquipIcon(selectedEq, ICON_SIZE.LG)}
            </div>
            <div style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:#eab308; font-size:1.4em;">${selectedEq.name} <span style="color:#38bdf8;">+${selectedEq.enhancementLevel || 0}</span></h3>
                <span style="padding:2px 7px; background:rgba(217,119,6,0.25); border-radius:4px; color:#fbbf24; font-weight:bold; font-size:0.85em;">T${selectedEq.tier || 1}</span>
              </div>
              <div style="font-size:0.85em; margin-top:6px; color:#94a3b8;">
                裝備部位: ${selectedEq.slot}
              </div>
            </div>
          </div>
  
          <!-- 拆解預期獲得 -->
          <div style="background:rgba(25, 20, 16, 0.8); padding:16px; border-radius:8px; border:1px solid rgba(16,185,129,0.2);">
            <h4 style="margin-top:0; color:#34d399; font-size:0.95em; margin-bottom:12px; text-align:center; letter-spacing:1px;">═══ 拆解獲得材料 ═══</h4>
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
              ${resultCards}
            </div>
          </div>
        </div>
  
        <!-- 確認拆解按鈕 -->
        <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:14px; text-align:center;">
          ${(selectedEq.id === 'wpn_heirloom_sword' || (selectedEq as any).isLocked)
            ? `<button id="btn-exec-disassemble" class="action-btn" style="width:220px; padding:9px; font-size:1.05em; font-weight:bold; background:#475569; color:#94a3b8; cursor:not-allowed;" disabled>
                🔒 傳家寶無法拆解
              </button>`
            : `<button id="btn-exec-disassemble" class="action-btn" style="width:220px; padding:9px; font-size:1.05em; font-weight:bold; background:linear-gradient(135deg, #059669, #047857); color:#fff; cursor:pointer;">
                ♻️ 確定拆解
              </button>`
          }
        </div>
      `;
  
      attachTooltip(rightPanel.querySelector('#disassemble-source-icon') as HTMLElement, () => getEquipTooltipHtml(selectedEq));
  
      rightPanel.querySelector('#btn-exec-disassemble')?.addEventListener('click', () => {
        if (selectedEq.id === 'wpn_heirloom_sword' || (selectedEq as any).isLocked) {
          ToastManager.show('🛡️ 家族傳承的佩劍蘊含先祖榮光，無法被拆解摧毀！', 'warning');
          return;
        }

        const idx = territory.warehouse.findIndex(e => e.uuid === selectedEq.uuid);
        if (idx !== -1) {
          territory.warehouse.splice(idx, 1);
          
          territory.materials[returnMatId] = (territory.materials[returnMatId] || 0) + returnCount;
          if (enhanceRetCount > 0) {
            territory.materials[enhanceRetMatId] = (territory.materials[enhanceRetMatId] || 0) + enhanceRetCount;
          }
          
          ToastManager.show(`♻️ 拆解成功！獲得素材。`, 'success');
          
          if (territory.warehouse.length > 0) {
            selectedUuid = territory.warehouse[0].uuid;
          }
          
          UIManager.updateUI();
          renderLeftGrid();
          if (territory.warehouse.length > 0) {
            renderRightPanel();
          } else {
            rightPanel.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:50px 0;">倉庫內沒有可拆解的裝備。</p>';
          }
        }
      });
    };
  
    renderLeftGrid();
    renderRightPanel();
  
    splitContainer.appendChild(leftPanel);
    splitContainer.appendChild(rightPanel);
    workspace.appendChild(splitContainer);
  }
  
  public openHomeWarehouse() {
    const modal = document.getElementById('modal-base-warehouse');
    if (!modal) return;
    modal.classList.add('active');
  
    const btnClose = document.getElementById('btn-close-base-warehouse');
    if (btnClose) {
      btnClose.onclick = () => modal.classList.remove('active');
    }
  
    const tabEquip = document.getElementById('tab-base-warehouse-equip');
    const tabMats = document.getElementById('tab-base-warehouse-mats');
    const tabGoods = document.getElementById('tab-base-warehouse-goods');
  
    const panelEquip = document.getElementById('panel-base-warehouse-equip');
    const panelMats = document.getElementById('panel-base-warehouse-mats');
    const panelGoods = document.getElementById('panel-base-warehouse-goods');
  
    const setActiveTab = (activeTab: HTMLElement, activePanel: HTMLElement) => {
      [tabEquip, tabMats, tabGoods].forEach(t => {
        if (t) {
          t.style.background = 'rgba(0,0,0,0.3)';
          t.style.border = '1px solid rgba(255,255,255,0.1)';
          t.style.color = '#94a3b8';
        }
      });
      [panelEquip, panelMats, panelGoods].forEach(p => {
        if (p) p.style.display = 'none';
      });
  
      if (activeTab) {
        activeTab.style.background = 'rgba(234,179,8,0.2)';
        activeTab.style.border = '1px solid rgba(234,179,8,0.4)';
        activeTab.style.color = '#fbbf24';
      }
      if (activePanel) {
        activePanel.style.display = 'block';
      }
    };
  
    if (tabEquip) {
      tabEquip.onclick = () => {
        setActiveTab(tabEquip, panelEquip!);
        this.renderHomeWarehouseEquip();
      };
    }
    if (tabMats) {
      tabMats.onclick = () => {
        setActiveTab(tabMats, panelMats!);
        this.renderHomeWarehouseMats();
      };
    }
    if (tabGoods) {
      tabGoods.onclick = () => {
        setActiveTab(tabGoods, panelGoods!);
        this.renderHomeWarehouseGoods();
      };
    }
  
    if (tabEquip && panelEquip) {
      setActiveTab(tabEquip, panelEquip);
      this.renderHomeWarehouseEquip();
    }
  }
  
  private renderHomeWarehouseEquip() {
    const grid = document.getElementById('grid-base-warehouse-equip');
    if (!grid) return;
    grid.innerHTML = '';
  
    const warehouse = GameState.myTerritory.warehouse;
    if (warehouse.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#94a3b8; padding:30px;">倉庫內暫無儲備裝備</div>';
      return;
    }
  
    warehouse.forEach(eq => {
      const card = document.createElement('div');
      card.style.background = 'rgba(30, 24, 20, 0.8)';
      card.style.border = '1.5px solid rgba(217, 119, 6, 0.3)';
      card.style.borderRadius = '6px';
      card.style.padding = '4px 3px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.textAlign = 'center';
      card.style.justifyContent = 'space-between';
      card.style.cursor = 'pointer';
      card.style.width = '85px';
      card.style.height = '94px';
      card.style.flexShrink = '0';
      card.style.boxSizing = 'border-box';
      card.style.overflow = 'hidden';
  
      const iconHtml = renderEquipIcon(eq, ICON_SIZE.MD);
      const enhancementText = eq.enhancementLevel ? `+${eq.enhancementLevel}` : '+0';
      const tierText = `T${eq.tier || 1}`;
  
      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">${iconHtml}</div>
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.7em; padding:2px 3px 0; border-top:1px solid rgba(255,255,255,0.12); margin-top:2px;">
          <span style="color:#38bdf8; font-weight:bold;">${enhancementText}</span>
          <span style="color:#fbbf24; background:rgba(0,0,0,0.5); padding:1px 4px; border-radius:3px; border:1px solid rgba(251,191,36,0.3);">${tierText}</span>
        </div>
      `;
  
      attachTooltip(card, () => getEquipTooltipHtml(eq));
      grid.appendChild(card);
    });
  }
  
  private renderHomeWarehouseMats() {
    const grid = document.getElementById('grid-base-warehouse-mats');
    if (!grid) return;
    grid.innerHTML = '';
  
    const materials = GameState.myTerritory.materials;
    const matKeys = Object.keys(materials).filter(k => (materials[k] || 0) > 0);
  
    if (matKeys.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#94a3b8; padding:30px;">倉庫內暫無素材與附魔石</div>';
      return;
    }
  
    matKeys.forEach(matId => {
      const count = materials[matId] || 0;
      const matDef = DataStore.MaterialDB[matId] || { name: matId, icon: '🧲', description: '強化/附魔素材' };
  
      const card = document.createElement('div');
      card.style.background = 'rgba(30, 24, 20, 0.8)';
      card.style.border = '1.5px solid rgba(217, 119, 6, 0.3)';
      card.style.borderRadius = '6px';
      card.style.padding = '5px 4px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.textAlign = 'center';
      card.style.justifyContent = 'space-between';
      card.style.cursor = 'pointer';
      card.style.width = '85px';
      card.style.height = '94px';
      card.style.flexShrink = '0';
      card.style.boxSizing = 'border-box';
  
      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">${renderUniversalIcon(matDef.icon || '🧲', 36)}</div>
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.75em; padding:0 4px;">
          <span style="color:#e2e8f0; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:45px;">${matDef.name}</span>
          <span style="color:#fbbf24; font-weight:bold;">x${count}</span>
        </div>
      `;
  
      attachTooltip(card, () => `
        <div style="padding:8px; max-width:200px;">
          <div style="font-weight:bold; color:#fbbf24; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            ${renderUniversalIcon(matDef.icon || '🧲', 20)} <span>${matDef.name}</span>
          </div>
          <div style="font-size:0.8em; color:#cbd5e1;">${matDef.description || '鍛造與附魔必備物資'}</div>
          <div style="font-size:0.8em; color:#e2e8f0; margin-top:4px;">擁有數量：${count}</div>
        </div>
      `);
      grid.appendChild(card);
    });
  }
  
  private renderHomeWarehouseGoods() {
    const grid = document.getElementById('grid-base-warehouse-goods');
    if (!grid) return;
    grid.innerHTML = '';
  
    const inventory = GameState.myTerritory.tradeInventory;
    const goodKeys = Object.keys(inventory).filter(k => (inventory[k] || 0) > 0);
  
    if (goodKeys.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#94a3b8; padding:30px;">倉庫內暫無交易品物資</div>';
      return;
    }
  
    goodKeys.forEach(goodId => {
      const count = inventory[goodId] || 0;
      const goodRef = TRADE_GOODS.find(g => g.id === goodId);
      const name = goodRef ? goodRef.name : goodId;
      const icon = goodRef ? (goodRef.icon || '📦') : '📦';
  
      const card = document.createElement('div');
      card.style.background = 'rgba(30, 24, 20, 0.8)';
      card.style.border = '1.5px solid rgba(217, 119, 6, 0.3)';
      card.style.borderRadius = '6px';
      card.style.padding = '5px 4px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.textAlign = 'center';
      card.style.justifyContent = 'space-between';
      card.style.cursor = 'pointer';
      card.style.width = '85px';
      card.style.height = '85px';
      card.style.aspectRatio = '1 / 1';
      card.style.flexShrink = '0';
      card.style.boxSizing = 'border-box';
  
      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">${renderUniversalIcon(icon, 36)}</div>
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.75em; padding:0 4px;">
          <span style="color:#e2e8f0; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:45px;">${name}</span>
          <span style="color:#fbbf24; font-weight:bold;">x${count}</span>
        </div>
      `;
  
      attachTooltip(card, () => `
        <div style="padding:8px; max-width:200px;">
          <div style="font-weight:bold; color:#fbbf24; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            ${renderUniversalIcon(icon, 20)} <span>${name}</span>
          </div>
          <div style="font-size:0.8em; color:#cbd5e1;">用於城鎮商隊貿易與物資輸送</div>
          <div style="font-size:0.8em; color:#e2e8f0; margin-top:4px;">庫存數量：${count} 單位</div>
        </div>
      `);
      grid.appendChild(card);
    });
  }
  
  
}
