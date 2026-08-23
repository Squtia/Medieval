import { GameState } from '../../core/GameState';
import { DataStore } from '../../systems/DataStore';
import { ToastManager } from '../ToastManager';
import { UIManager } from '../UIManager';
import { renderEquipIcon, ICON_SIZE, formatStatsTags, attachTooltip, getEquipTooltipHtml, getMaterialCount, consumeMaterial } from '../ShopController';
import { renderUniversalIcon } from '../IconSpriteHelper';
import { EquipmentSlot, Equipment, AdventurerState } from '../../models/types';

export class ModificationWorkshopController {
  private static activeSource: 'WAREHOUSE' | 'ADVENTURER' = 'WAREHOUSE';
  private static activeSlotFilter: string = 'ALL';
  private static selectedEquipUuid: string | null = null;
  private static selectedModRecipeId: string | null = null;

  public static render() {
    const territory = GameState.myTerritory;
    const workspace = document.getElementById('mod-workshop-workspace');
    if (!workspace) return;
    workspace.innerHTML = '';

    // 收集所有裝備（依據來源）
    const getAllAvailableItems = (): { eq: Equipment; label?: string; advName?: string }[] => {
      if (this.activeSource === 'WAREHOUSE') {
        return (territory.warehouse || []).map(eq => ({ eq }));
      } else {
        const items: { eq: Equipment; label?: string; advName?: string }[] = [];
        (GameState.adventurers || []).filter(adv => adv.currentState === AdventurerState.IDLE).forEach(adv => {
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

    const allItems = getAllAvailableItems();
    const getFilteredItems = () => {
      if (this.activeSlotFilter === 'ALL') return allItems;
      return allItems.filter(item => item.eq.slot === this.activeSlotFilter);
    };

    const filteredItems = getFilteredItems();
    if (!this.selectedEquipUuid || !allItems.some(item => item.eq.uuid === this.selectedEquipUuid)) {
      this.selectedEquipUuid = filteredItems.length > 0 ? filteredItems[0].eq.uuid || null : null;
    }

    // 雙欄佈局
    const leftPanel = document.createElement('div');
    leftPanel.style.width = '360px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.background = 'rgba(18, 14, 11, 0.72)';
    leftPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    leftPanel.style.borderRadius = '8px';
    leftPanel.style.padding = '12px';
    leftPanel.style.minHeight = '0';

    const rightPanel = document.createElement('div');
    rightPanel.style.flex = '1';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.background = 'rgba(18, 14, 11, 0.72)';
    rightPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    rightPanel.style.borderRadius = '8px';
    rightPanel.style.padding = '16px';
    rightPanel.style.minHeight = '0';
    rightPanel.style.overflowY = 'auto';

    // --- 左欄：來源切換 + 分類篩選 + 裝備清單 ---
    // 1. 來源切換按鈕
    const sourceToggleRow = document.createElement('div');
    sourceToggleRow.style.display = 'flex';
    sourceToggleRow.style.gap = '6px';
    sourceToggleRow.style.marginBottom = '8px';

    const btnSourceWh = document.createElement('button');
    btnSourceWh.style.flex = '1';
    btnSourceWh.style.padding = '5px 0';
    btnSourceWh.style.fontSize = '0.82em';
    btnSourceWh.style.borderRadius = '4px';
    btnSourceWh.style.cursor = 'pointer';
    btnSourceWh.style.border = `1px solid ${this.activeSource === 'WAREHOUSE' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
    btnSourceWh.style.background = this.activeSource === 'WAREHOUSE' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(0,0,0,0.4)';
    btnSourceWh.style.color = this.activeSource === 'WAREHOUSE' ? '#fbbf24' : '#94a3b8';
    btnSourceWh.textContent = `📦 倉庫 (${territory.warehouse?.length || 0})`;
    btnSourceWh.onclick = () => {
      this.activeSource = 'WAREHOUSE';
      this.render();
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
    btnSourceAdv.style.padding = '5px 0';
    btnSourceAdv.style.fontSize = '0.82em';
    btnSourceAdv.style.borderRadius = '4px';
    btnSourceAdv.style.cursor = 'pointer';
    btnSourceAdv.style.border = `1px solid ${this.activeSource === 'ADVENTURER' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
    btnSourceAdv.style.background = this.activeSource === 'ADVENTURER' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(0,0,0,0.4)';
    btnSourceAdv.style.color = this.activeSource === 'ADVENTURER' ? '#fbbf24' : '#94a3b8';
    btnSourceAdv.textContent = `👤 傭兵 (${advEquipTotal})`;
    btnSourceAdv.onclick = () => {
      this.activeSource = 'ADVENTURER';
      this.render();
    };

    sourceToggleRow.appendChild(btnSourceWh);
    sourceToggleRow.appendChild(btnSourceAdv);
    leftPanel.appendChild(sourceToggleRow);

    // 2. 槽位分類按鈕列
    const filterRow = document.createElement('div');
    filterRow.style.display = 'flex';
    filterRow.style.gap = '4px';
    filterRow.style.marginBottom = '10px';
    filterRow.style.flexWrap = 'wrap';

    const filterOpts = [
      { key: 'ALL', label: '全部' },
      { key: EquipmentSlot.WEAPON, label: '武器' },
      { key: EquipmentSlot.ARMOR, label: '防具' },
      { key: EquipmentSlot.ACCESSORY, label: '飾品' }
    ];

    filterOpts.forEach(opt => {
      const btn = document.createElement('button');
      const isSel = opt.key === this.activeSlotFilter;
      btn.style.padding = '2px 7px';
      btn.style.fontSize = '0.74em';
      btn.style.borderRadius = '4px';
      btn.style.border = `1px solid ${isSel ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
      btn.style.background = isSel ? 'rgba(234, 179, 8, 0.3)' : 'rgba(0,0,0,0.5)';
      btn.style.color = isSel ? '#fbbf24' : '#94a3b8';
      btn.style.cursor = 'pointer';
      btn.textContent = opt.label;
      btn.onclick = () => {
        this.activeSlotFilter = opt.key;
        this.render();
      };
      filterRow.appendChild(btn);
    });
    leftPanel.appendChild(filterRow);

    // 3. 裝備卡片列表 (Scrollable)
    const eqListContainer = document.createElement('div');
    eqListContainer.style.flex = '1';
    eqListContainer.style.overflowY = 'auto';
    eqListContainer.style.display = 'flex';
    eqListContainer.style.flexDirection = 'column';
    eqListContainer.style.gap = '8px';
    eqListContainer.style.paddingRight = '2px';

    if (filteredItems.length === 0) {
      eqListContainer.innerHTML = `<div style="color:#64748b; font-size:0.85em; text-align:center; padding:30px 0;">
        ${this.activeSource === 'WAREHOUSE' ? '倉庫內無符合條件裝備' : '傭兵身上無符合條件裝備'}
      </div>`;
    } else {
      filteredItems.forEach(item => {
        const eq = item.eq;
        const isSelected = eq.uuid === this.selectedEquipUuid;
        const card = document.createElement('div');
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '10px';
        card.style.padding = '8px 10px';
        card.style.background = isSelected ? 'rgba(217, 119, 6, 0.25)' : 'rgba(0, 0, 0, 0.4)';
        card.style.border = `1px solid ${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.1)'}`;
        card.style.borderRadius = '6px';
        card.style.cursor = 'pointer';
        card.style.transition = 'all 0.15s';

        const iconHtml = renderEquipIcon(eq, ICON_SIZE.SM);
        const lvlStr = eq.enhancementLevel ? ` <span style="color:#38bdf8;">+${eq.enhancementLevel}</span>` : '';
        const tierStr = eq.tier ? ` <span style="color:#a855f7; font-size:0.8em;">(T${eq.tier})</span>` : '';
        const modCount = (eq as any).modCount || 0;
        const modBadge = modCount > 0 ? `<span style="color:#34d399; font-size:0.75em; margin-left:auto;">🔧 ${modCount}/3</span>` : `<span style="color:#64748b; font-size:0.75em; margin-left:auto;">0/3</span>`;
        const wearerSub = item.label ? `<div style="font-size:0.72em; color:#38bdf8; margin-top:2px;">👤 ${item.label}</div>` : `<div style="font-size:0.72em; color:#94a3b8; margin-top:2px;">${eq.slot || '裝備'}</div>`;

        card.innerHTML = `
          ${iconHtml}
          <div style="flex:1; min-width:0; line-height:1.2;">
            <div style="font-weight:bold; color:${isSelected ? '#fbbf24' : '#e2e8f0'}; font-size:0.86em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${eq.name}${lvlStr}${tierStr}</div>
            ${wearerSub}
          </div>
          ${modBadge}
        `;

        card.onclick = () => {
          this.selectedEquipUuid = eq.uuid || null;
          this.selectedModRecipeId = null;
          this.render();
        };

        attachTooltip(card, () => getEquipTooltipHtml(eq));
        eqListContainer.appendChild(card);
      });
    }
    leftPanel.appendChild(eqListContainer);

    // --- 右欄：改造工作臺 ---
    const targetItem = allItems.find(item => item.eq.uuid === this.selectedEquipUuid);

    if (!targetItem) {
      rightPanel.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#64748b;">
          <div style="font-size:3em; margin-bottom:10px;">🔧</div>
          <div>請從左側選擇一件裝備以開啟改造工作臺</div>
        </div>
      `;
    } else {
      const selectedEq = targetItem.eq;
      const curModCount = (selectedEq as any).modCount || 0;
      const maxModCount = 3;
      const isMaxModded = curModCount >= maxModCount;

      // 1. 上方：選中裝備展示卡
      const targetHeader = document.createElement('div');
      targetHeader.style.display = 'flex';
      targetHeader.style.alignItems = 'center';
      targetHeader.style.gap = '14px';
      targetHeader.style.background = 'rgba(0,0,0,0.5)';
      targetHeader.style.border = '1px solid rgba(217, 119, 6, 0.3)';
      targetHeader.style.borderRadius = '6px';
      targetHeader.style.padding = '12px 16px';
      targetHeader.style.marginBottom = '14px';

      const bigIcon = renderEquipIcon(selectedEq, ICON_SIZE.LG);
      const lvlStr = selectedEq.enhancementLevel ? ` +${selectedEq.enhancementLevel}` : '';
      const tierStr = selectedEq.tier ? ` (T${selectedEq.tier})` : '';
      const wearerInfo = targetItem.advName ? `<div style="font-size:0.82em; color:#38bdf8; margin-top:2px;">👤 穿戴者：${targetItem.label} (就地升級，即時生效)</div>` : '';

      targetHeader.innerHTML = `
        ${bigIcon}
        <div style="flex:1;">
          <div style="font-size:1.15em; font-weight:bold; color:#fbbf24;">${selectedEq.name}${lvlStr}${tierStr}</div>
          ${wearerInfo}
          <div style="font-size:0.82em; color:#cbd5e1; margin-top:3px;">
            當前效果：${formatStatsTags(selectedEq.combatEffects || selectedEq.baseCombatEffects, selectedEq.effects || (selectedEq as any).baseEffects)}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.8em; color:#94a3b8;">已改造工藝</div>
          <div style="font-size:1.2em; font-weight:bold; color:${isMaxModded ? '#ef4444' : '#34d399'};">${curModCount} / ${maxModCount}</div>
        </div>
      `;
      rightPanel.appendChild(targetHeader);

      // 2. 中間：可用改造方案清單 (物件卡片網格)
      const recipesTitle = document.createElement('div');
      recipesTitle.style.fontWeight = 'bold';
      recipesTitle.style.color = '#e2e8f0';
      recipesTitle.style.fontSize = '0.92em';
      recipesTitle.style.marginBottom = '8px';
      recipesTitle.textContent = '🛠️ 選擇附加改造工藝：';
      rightPanel.appendChild(recipesTitle);

      const allModRecipes = (DataStore.ModificationRecipeDB as any[]) || [];
      const applicableRecipes = allModRecipes.filter(r => !r.targetSlots || r.targetSlots.includes(selectedEq.slot));

      if (applicableRecipes.length > 0 && !this.selectedModRecipeId) {
        this.selectedModRecipeId = applicableRecipes[0].id;
      }

      const recipeGrid = document.createElement('div');
      recipeGrid.style.display = 'grid';
      recipeGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(230px, 1fr))';
      recipeGrid.style.gap = '10px';
      recipeGrid.style.marginBottom = '14px';

      applicableRecipes.forEach(rec => {
        const isRecSelected = rec.id === this.selectedModRecipeId;
        const recCard = document.createElement('div');
        recCard.style.background = isRecSelected ? 'rgba(234, 179, 8, 0.2)' : 'rgba(0,0,0,0.45)';
        recCard.style.border = `1px solid ${isRecSelected ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
        recCard.style.borderRadius = '6px';
        recCard.style.padding = '10px';
        recCard.style.cursor = 'pointer';
        recCard.style.transition = 'all 0.15s';
        recCard.style.display = 'flex';
        recCard.style.flexDirection = 'column';
        recCard.style.justifyContent = 'space-between';

        // 檢查素材與金幣
        const hasGold = territory.gold >= (rec.goldCost || 0);
        let hasMats = true;
        const matTags: string[] = [];
        if (rec.requiredMaterials) {
          for (const [mId, needAmount] of Object.entries(rec.requiredMaterials)) {
            const owned = getMaterialCount(territory, mId);
            const ok = owned >= (needAmount as number);
            if (!ok) hasMats = false;
            const matDef = DataStore.MaterialDB[mId];
            const matName = matDef ? matDef.name : mId;
            matTags.push(`<span style="color:${ok ? '#34d399' : '#ef4444'}; font-size:0.75em;">${matName} ${owned}/${needAmount}</span>`);
          }
        }

        recCard.innerHTML = `
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:bold; color:#fbbf24; font-size:0.92em; display:flex; align-items:center; gap:6px;">
                ${renderUniversalIcon(rec.icon || '🔨', 20)} ${rec.name}
              </span>
              <span style="font-size:0.78em; color:#fbbf24; font-weight:bold;">💰 ${rec.goldCost}G</span>
            </div>
            <div style="font-size:0.78em; color:#cbd5e1; margin-bottom:6px; line-height:1.3;">
              ${rec.description || ''}
            </div>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:4px; margin-top:4px; display:flex; flex-wrap:wrap; gap:6px;">
            ${matTags.join('')}
          </div>
        `;

        recCard.onclick = () => {
          this.selectedModRecipeId = rec.id;
          this.render();
        };

        recipeGrid.appendChild(recCard);
      });

      rightPanel.appendChild(recipeGrid);

      // 3. 下方：執行改造確認區
      const selectedRec = applicableRecipes.find(r => r.id === this.selectedModRecipeId);
      const actionBox = document.createElement('div');
      actionBox.style.marginTop = 'auto';
      actionBox.style.background = 'rgba(0,0,0,0.6)';
      actionBox.style.border = '1px solid rgba(217, 119, 6, 0.3)';
      actionBox.style.borderRadius = '6px';
      actionBox.style.padding = '12px 16px';
      actionBox.style.display = 'flex';
      actionBox.style.justifyContent = 'space-between';
      actionBox.style.alignItems = 'center';

      if (!selectedRec || isMaxModded) {
        actionBox.innerHTML = `
          <div style="color:#94a3b8; font-size:0.85em;">
            ${isMaxModded ? '⚠️ 該裝備改造次數已達上限 (3/3)，無法再進行改造。' : '請選擇一項改造工藝'}
          </div>
          <button class="action-btn" style="padding:8px 20px; font-size:0.9em; background:#475569; color:#94a3b8; cursor:not-allowed;" disabled>
            ${isMaxModded ? '🔒 已達改造上限' : '未選擇工藝'}
          </button>
        `;
      } else {
        const hasGold = territory.gold >= (selectedRec.goldCost || 0);
        let hasMats = true;
        if (selectedRec.requiredMaterials) {
          for (const [mId, needAmount] of Object.entries(selectedRec.requiredMaterials)) {
            if (getMaterialCount(territory, mId) < (needAmount as number)) {
              hasMats = false;
              break;
            }
          }
        }
        const canExecute = hasGold && hasMats && !isMaxModded;

        actionBox.innerHTML = `
          <div>
            <div style="font-weight:bold; color:#e2e8f0; font-size:0.9em;">
              準備執行：<span style="color:#fbbf24;">${selectedRec.name}</span>
            </div>
            <div style="font-size:0.8em; color:#94a3b8; margin-top:2px;">
              費用：💰 ${selectedRec.goldCost} 金幣 ${hasGold ? '' : '<span style="color:#ef4444;">(金幣不足)</span>'}
            </div>
          </div>
          <button id="btn-execute-mod" class="action-btn" style="padding:8px 24px; font-size:0.95em; font-weight:bold; ${canExecute ? 'background:linear-gradient(135deg, #d97706, #b45309); cursor:pointer;' : 'background:#475569; color:#94a3b8; cursor:not-allowed;'}" ${canExecute ? '' : 'disabled'}>
            🔧 執行裝備改造
          </button>
        `;

        const execBtn = actionBox.querySelector('#btn-execute-mod');
        if (execBtn && canExecute) {
          execBtn.addEventListener('click', () => {
            this.executeModification(territory, selectedEq, selectedRec);
          });
        }
      }

      rightPanel.appendChild(actionBox);
    }

    workspace.appendChild(leftPanel);
    workspace.appendChild(rightPanel);
  }

  private static executeModification(territory: any, eq: any, rec: any) {
    // 扣除金幣
    territory.gold -= rec.goldCost || 0;

    // 扣除素材
    if (rec.requiredMaterials) {
      for (const [mId, amount] of Object.entries(rec.requiredMaterials)) {
        consumeMaterial(territory, mId, amount as number);
      }
    }

    // 疊加屬性
    if (!eq.effects) eq.effects = {};
    if (!eq.combatEffects) eq.combatEffects = { ...eq.baseCombatEffects };

    if (rec.bonusEffects) {
      for (const [attr, val] of Object.entries(rec.bonusEffects)) {
        eq.effects[attr] = (eq.effects[attr] || 0) + (val as number);
      }
    }

    if (rec.bonusCombatEffects) {
      for (const [stat, val] of Object.entries(rec.bonusCombatEffects)) {
        eq.combatEffects[stat] = (eq.combatEffects[stat] || 0) + (val as number);
      }
    }

    // 記錄改造次數與工藝名稱
    eq.modCount = (eq.modCount || 0) + 1;
    if (!eq.appliedMods) eq.appliedMods = [];
    eq.appliedMods.push(rec.name);

    ToastManager.show(`🎉 改造成功！${eq.name} 已完成「${rec.name}」工藝！`);
    UIManager.updateUI();
    this.render();
  }
}
