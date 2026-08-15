import { GameState } from '../../core/GameState';
import { DataStore } from '../../systems/DataStore';
import { EquipmentGenerator } from '../../systems/EquipmentGenerator';
import { ToastManager } from '../ToastManager';
import { UIManager } from '../UIManager';
import { renderEquipIcon, formatStatsTags, attachTooltip, getEquipTooltipHtml } from '../ShopController';
import { EquipmentSlot, Equipment } from '../../models/types';

export class SecondHandShopController {
  private static activeTab: 'BUY' | 'SELL' = 'BUY';

  public static render() {
    const territory = GameState.myTerritory;
    const workspace = document.getElementById('secondhand-shop-workspace');
    if (!workspace) return;
    workspace.innerHTML = '';

    // 綁定頂部頁籤樣式與切換
    const btnBuy = document.getElementById('btn-secondhand-tab-buy');
    const btnSell = document.getElementById('btn-secondhand-tab-sell');

    if (btnBuy && btnSell) {
      if (this.activeTab === 'BUY') {
        btnBuy.style.background = 'rgba(234, 179, 8, 0.25)';
        btnBuy.style.border = '1px solid rgba(234, 179, 8, 0.5)';
        btnBuy.style.color = '#fbbf24';
        btnSell.style.background = 'rgba(0, 0, 0, 0.4)';
        btnSell.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        btnSell.style.color = '#94a3b8';
      } else {
        btnSell.style.background = 'rgba(234, 179, 8, 0.25)';
        btnSell.style.border = '1px solid rgba(234, 179, 8, 0.5)';
        btnSell.style.color = '#fbbf24';
        btnBuy.style.background = 'rgba(0, 0, 0, 0.4)';
        btnBuy.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        btnBuy.style.color = '#94a3b8';
      }

      btnBuy.onclick = () => {
        this.activeTab = 'BUY';
        this.render();
      };
      btnSell.onclick = () => {
        this.activeTab = 'SELL';
        this.render();
      };
    }

    if (this.activeTab === 'BUY') {
      this.renderAccessoryMarket(workspace, territory);
    } else {
      this.renderPawnShop(workspace, territory);
    }
  }

  /**
   * 1. 稀有飾品貨架
   */
  private static renderAccessoryMarket(container: HTMLElement, territory: any) {
    const shopData = DataStore.SecondHandShopDB || { accessories: [] };
    const allAccessories = (shopData.accessories as any[]) || [];

    const wrapper = document.createElement('div');
    wrapper.style.flex = '1';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.background = 'rgba(18, 14, 11, 0.72)';
    wrapper.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    wrapper.style.borderRadius = '8px';
    wrapper.style.padding = '16px';
    wrapper.style.minHeight = '0';
    wrapper.style.overflowY = 'auto';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = '1px solid rgba(217, 119, 6, 0.2)';
    header.style.paddingBottom = '8px';
    header.style.marginBottom = '14px';
    header.innerHTML = `
      <div style="font-weight:bold; color:#fbbf24; font-size:1.05em;">💍 當期稀有飾品與古物</div>
      <div style="font-size:0.82em; color:#94a3b8;">每日貨架隨機補貨 | 領地金幣: <span style="color:#fbbf24; font-weight:bold;">${territory.gold} G</span></div>
    `;
    wrapper.appendChild(header);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    grid.style.gap = '14px';

    allAccessories.forEach(acc => {
      const price = acc.basePrice || 300;
      const canBuy = territory.gold >= price;

      const card = document.createElement('div');
      card.style.background = 'rgba(0, 0, 0, 0.45)';
      card.style.border = '1px solid rgba(255, 255, 255, 0.12)';
      card.style.borderRadius = '6px';
      card.style.padding = '12px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.justifyContent = 'space-between';
      card.style.gap = '8px';

      const iconHtml = renderEquipIcon(acc, 36);
      const statsStr = formatStatsTags(acc.baseCombatEffects, acc.baseEffects);
      const tierBadge = acc.tier ? `<span style="color:#a855f7; font-size:0.8em; font-weight:bold;">T${acc.tier}</span>` : '';

      card.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            ${iconHtml}
            <div style="flex:1;">
              <div style="font-weight:bold; color:#fbbf24; font-size:0.95em;">${acc.name} ${tierBadge}</div>
              <div style="font-size:0.75em; color:#94a3b8;">飾品 / 護符</div>
            </div>
          </div>
          <div style="font-size:0.8em; color:#cbd5e1; background:rgba(0,0,0,0.35); padding:6px; border-radius:4px; margin-bottom:6px;">
            ${statsStr}
          </div>
          <div style="font-size:0.75em; color:#94a3b8; line-height:1.3;">
            ${acc.description || ''}
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
          <span style="font-weight:bold; color:#fbbf24; font-size:0.95em;">💰 ${price} G</span>
          <button class="action-btn btn-buy-accessory" data-id="${acc.id}" style="padding:4px 16px; font-size:0.85em; ${canBuy ? 'background:linear-gradient(135deg, #059669, #047857); cursor:pointer;' : 'background:#475569; color:#94a3b8; cursor:not-allowed;'}" ${canBuy ? '' : 'disabled'}>
            ${canBuy ? '購買' : '金幣不足'}
          </button>
        </div>
      `;

      const buyBtn = card.querySelector('.btn-buy-accessory');
      if (buyBtn && canBuy) {
        buyBtn.addEventListener('click', () => {
          this.buyAccessory(territory, acc);
        });
      }

      attachTooltip(card, () => getEquipTooltipHtml(acc));
      grid.appendChild(card);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
  }

  /**
   * 2. 二手裝備典當 (回收變現)
   */
  private static renderPawnShop(container: HTMLElement, territory: any) {
    const warehouseEqs = (territory.warehouse as any[]) || [];

    const wrapper = document.createElement('div');
    wrapper.style.flex = '1';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.background = 'rgba(18, 14, 11, 0.72)';
    wrapper.style.border = '1px solid rgba(217, 119, 6, 0.35)';
    wrapper.style.borderRadius = '8px';
    wrapper.style.padding = '16px';
    wrapper.style.minHeight = '0';
    wrapper.style.overflowY = 'auto';

    // 計算單件典當金幣
    const getPawnPrice = (eq: any) => {
      const baseVal = (DataStore.EquipmentPriceDB[eq.id] || ((eq.tier || 1) * 120));
      const mult = DataStore.SecondHandShopDB?.resaleMultiplier || 0.5;
      const enhBonus = 1 + (eq.enhancementLevel || 0) * 0.2;
      return Math.max(10, Math.floor(baseVal * mult * enhBonus));
    };

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = '1px solid rgba(217, 119, 6, 0.2)';
    header.style.paddingBottom = '8px';
    header.style.marginBottom = '14px';

    const t1Count = warehouseEqs.filter(e => (e.tier || 1) === 1 && !e.enhancementLevel).length;

    header.innerHTML = `
      <div>
        <div style="font-weight:bold; color:#fbbf24; font-size:1.05em;">💰 倉庫裝備典當變現</div>
        <div style="font-size:0.8em; color:#94a3b8;">典當倉庫中的閒置裝備以回收金幣 (目前倉庫存量: ${warehouseEqs.length} 件)</div>
      </div>
      <div>
        <button id="btn-quick-pawn-t1" class="action-btn" style="padding:6px 14px; font-size:0.82em; background:rgba(239,68,68,0.25); border:1px solid rgba(239,68,68,0.5); color:#fca5a5; cursor:${t1Count > 0 ? 'pointer' : 'not-allowed'};" ${t1Count > 0 ? '' : 'disabled'}>
          ⚡ 一鍵典當無強化 T1 基礎裝 (${t1Count} 件)
        </button>
      </div>
    `;
    wrapper.appendChild(header);

    const quickBtn = header.querySelector('#btn-quick-pawn-t1');
    if (quickBtn && t1Count > 0) {
      quickBtn.addEventListener('click', () => {
        let totalGain = 0;
        const toSell = warehouseEqs.filter(e => (e.tier || 1) === 1 && !e.enhancementLevel);
        toSell.forEach(eq => {
          const p = getPawnPrice(eq);
          totalGain += p;
          territory.removeEquipmentFromWarehouse(eq.uuid);
        });
        territory.gold += totalGain;
        ToastManager.show(`💰 批量典當完成！共出售 ${toSell.length} 件基礎裝備，獲得 ${totalGain} 金幣！`);
        UIManager.updateUI();
        this.render();
      });
    }

    if (warehouseEqs.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.style.flex = '1';
      emptyBox.style.display = 'flex';
      emptyBox.style.flexDirection = 'column';
      emptyBox.style.justifyContent = 'center';
      emptyBox.style.alignItems = 'center';
      emptyBox.style.color = '#64748b';
      emptyBox.innerHTML = `
        <div style="font-size:3em; margin-bottom:10px;">📦</div>
        <div>領地倉庫目前沒有任何裝備可供典當</div>
      `;
      wrapper.appendChild(emptyBox);
    } else {
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
      grid.style.gap = '12px';

      warehouseEqs.forEach(eq => {
        const price = getPawnPrice(eq);
        const card = document.createElement('div');
        card.style.background = 'rgba(0, 0, 0, 0.45)';
        card.style.border = '1px solid rgba(255, 255, 255, 0.12)';
        card.style.borderRadius = '6px';
        card.style.padding = '10px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';
        card.style.gap = '6px';

        const iconHtml = renderEquipIcon(eq, 32);
        const lvlStr = eq.enhancementLevel ? ` <span style="color:#38bdf8;">+${eq.enhancementLevel}</span>` : '';
        const tierStr = eq.tier ? ` <span style="color:#a855f7; font-size:0.8em;">(T${eq.tier})</span>` : '';

        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            ${iconHtml}
            <div style="flex:1;">
              <div style="font-weight:bold; color:#e2e8f0; font-size:0.88em;">${eq.name}${lvlStr}${tierStr}</div>
              <div style="font-size:0.75em; color:#94a3b8;">${eq.slot || '裝備'}</div>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px; margin-top:4px;">
            <span style="font-size:0.82em; color:#34d399; font-weight:bold;">估價: +${price} G</span>
            <button class="action-btn btn-pawn-single" style="padding:3px 10px; font-size:0.78em; background:linear-gradient(135deg, #b45309, #78350f);">
              典當變現
            </button>
          </div>
        `;

        const pawnBtn = card.querySelector('.btn-pawn-single');
        if (pawnBtn) {
          pawnBtn.addEventListener('click', () => {
            territory.removeEquipmentFromWarehouse(eq.uuid);
            territory.gold += price;
            ToastManager.show(`💰 成功典當 ${eq.name}，獲得 +${price} 金幣！`);
            UIManager.updateUI();
            this.render();
          });
        }

        attachTooltip(card, () => getEquipTooltipHtml(eq));
        grid.appendChild(card);
      });

      wrapper.appendChild(grid);
    }

    container.appendChild(wrapper);
  }

  private static buyAccessory(territory: any, accDef: any) {
    territory.gold -= accDef.basePrice;
    const newEq = EquipmentGenerator.generate(accDef.id);
    if (newEq) {
      territory.addEquipmentToWarehouse(newEq);
      ToastManager.show(`🎉 成功購買 ${newEq.name}！已存放至領地倉庫。`);
      UIManager.updateUI();
      this.render();
    }
  }
}
