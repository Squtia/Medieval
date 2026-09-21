import { GameState } from '../../core/GameState';
import { DataStore } from '../../systems/DataStore';
import { ToastManager } from '../ToastManager';
import { UIManager } from '../UIManager';
import { renderEquipIcon, ICON_SIZE, formatStatsTags, attachTooltip, getEquipTooltipHtml, getMaterialCount, consumeMaterial } from '../ShopController';
import { renderUniversalIcon } from '../IconSpriteHelper';
import { EquipmentSlot, Equipment, AdventurerState } from '../../models/types';
import { EquipSourcePicker } from './EquipSourcePicker';

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

    // 左欄佈局：掛載全域 EquipSourcePicker
    const leftPanel = document.createElement('div');
    leftPanel.style.width = '360px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.background = 'rgba(18, 14, 11, 0.72)';
    leftPanel.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    leftPanel.style.borderRadius = '8px';
    leftPanel.style.padding = '12px';
    leftPanel.style.minHeight = '0';

    EquipSourcePicker.render({
      container: leftPanel,
      selectedEquipUuid: this.selectedEquipUuid,
      onSelectEquip: (eq) => {
        this.selectedEquipUuid = eq.uuid || null;
        this.selectedModRecipeId = null;
        this.render();
      }
    });

    // 尋找選中的裝備
    const findSelectedEquipment = (): { eq: Equipment; label?: string } | null => {
      if (!this.selectedEquipUuid) {
        // 若無預選，自動選取倉庫第一件或傭兵第一件
        const firstWh = territory.warehouse?.[0];
        if (firstWh) return { eq: firstWh, label: '倉庫' };
        for (const adv of (GameState.adventurers || [])) {
          if (adv.equipment?.WEAPON) return { eq: adv.equipment.WEAPON, label: `${adv.name} (武器)` };
          if (adv.equipment?.ARMOR) return { eq: adv.equipment.ARMOR, label: `${adv.name} (防具)` };
          if (adv.equipment?.ACCESSORY) return { eq: adv.equipment.ACCESSORY, label: `${adv.name} (飾品)` };
        }
        return null;
      }
      const inWh = territory.warehouse?.find(eq => eq.uuid === this.selectedEquipUuid);
      if (inWh) return { eq: inWh, label: '倉庫' };
      for (const adv of (GameState.adventurers || [])) {
        if (!adv.equipment) continue;
        const slots: EquipmentSlot[] = [EquipmentSlot.WEAPON, EquipmentSlot.ARMOR, EquipmentSlot.ACCESSORY];
        for (const slot of slots) {
          const eq = adv.equipment[slot];
          if (eq && eq.uuid === this.selectedEquipUuid) {
            const slotName = slot === EquipmentSlot.WEAPON ? '武器' : (slot === EquipmentSlot.ARMOR ? '防具' : '飾品');
            return { eq, label: `${adv.name} (${slotName})` };
          }
        }
      }
      return null;
    };

    const targetItem = findSelectedEquipment();
    if (targetItem && targetItem.eq.uuid) {
      this.selectedEquipUuid = targetItem.eq.uuid;
    }

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

    // --- 右欄：改造工作臺 ---
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
      const wearerInfo = targetItem.label && targetItem.label !== '倉庫' ? `<div style="font-size:0.82em; color:#fbbf24; margin-top:2px;">穿戴者：${targetItem.label} (就地升級，即時生效)</div>` : '';

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
