import { GameState } from '../../core/GameState';
import { BountyQuest, BountySystem } from '../../systems/BountySystem';
import { Adventurer, ADV_TEMPLATES } from '../../models/Adventurer';
import { renderAdventurerCard, getAdventurerTooltipHtml } from '../components/AdventurerCard';
import { positionFloatingElement } from '../FloatingPosition';


export class BountyModalController {
  private static instance: BountyModalController;
  private selectedBountyId: string | null = null;
  private selectedMercIdForDispatch: string | null = null;
  private isBound = false;

  private constructor() {
    this.bindEvents();
  }

  public static getInstance(): BountyModalController {
    if (!BountyModalController.instance) {
      BountyModalController.instance = new BountyModalController();
    }
    return BountyModalController.instance;
  }

  private bindEvents() {
    if (this.isBound) return;

    // 開啟懸賞欄 (綁定在酒館內的按鈕)
    const btnOpen = document.getElementById('btn-bounty-board');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        this.show();
      });
    }

    // 關閉 Modal
    const btnClose = document.getElementById('btn-close-bounty-board');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.hide();
      });
    }

    // 接受並派遣 (改在 populateMercSelect 中動態綁定，避免 HMR 或重繪失效)
    const btnAccept = document.getElementById('btn-accept-bounty');
    if (btnAccept) {
      btnAccept.onclick = () => {
        this.handleAcceptBounty();
      };
    }

    // 領取獎勵
    const btnClaim = document.getElementById('btn-claim-bounty');
    if (btnClaim) {
      btnClaim.addEventListener('click', () => {
        this.handleClaimReward();
      });
    }

    this.isBound = true;
  }

  public show() {
    const modal = document.getElementById('modal-bounty-board');
    if (modal) {
      modal.style.display = 'flex';
      this.selectedBountyId = null; // 重置選擇
      this.renderList();
      this.renderDetail();
    }
  }

  public hide() {
    const modal = document.getElementById('modal-bounty-board');
    if (modal) modal.style.display = 'none';
  }

  /**
   * 渲染左側懸賞清單
   */
  private renderList() {
    const container = document.getElementById('bounty-list-container');
    if (!container) return;

    container.innerHTML = '';

    if (!GameState.bounties || GameState.bounties.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: #64748b; margin-top: 20px;">目前沒有任何懸賞委託</div>`;
      return;
    }

    GameState.bounties.forEach(bounty => {
      const card = document.createElement('div');
      
      // 判斷狀態與顏色
      let statusHtml = '';
      let borderStyle = 'border: 1px solid rgba(255,255,255,0.1);';
      let opacity = '1';
      
      if (bounty.status === 'COMPLETED') {
        statusHtml = `<span style="color: #10b981; font-size: 0.8em; font-weight: bold; background: rgba(16,185,129,0.2); padding: 2px 6px; border-radius: 4px;">✅ 可領取</span>`;
        borderStyle = 'border: 1px solid #10b981;';
      } else if (bounty.status === 'IN_PROGRESS') {
        statusHtml = `<span style="color: #3b82f6; font-size: 0.8em; font-weight: bold; background: rgba(59,130,246,0.2); padding: 2px 6px; border-radius: 4px;">⏳ 進行中 (${bounty.remainingDuration}回合)</span>`;
        borderStyle = 'border: 1px solid #3b82f6;';
        opacity = '0.8';
      } else {
        statusHtml = `<span style="color: #94a3b8; font-size: 0.8em;">剩餘 ${bounty.expireDays} 天過期</span>`;
      }

      // 被選中的樣式
      if (this.selectedBountyId === bounty.id) {
        borderStyle = 'border: 1px solid #eab308; box-shadow: 0 0 8px rgba(234,179,8,0.3);';
        opacity = '1';
      }

      card.style.cssText = `
        padding: 12px;
        margin-bottom: 10px;
        background: rgba(0,0,0,0.4);
        border-radius: 6px;
        cursor: pointer;
        opacity: ${opacity};
        ${borderStyle}
        transition: all 0.2s;
      `;
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: bold; color: ${this.selectedBountyId === bounty.id ? '#fde047' : '#e2e8f0'};">${bounty.name}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <div style="font-size: 0.85em; color: #cbd5e1;">⏱️ 需 ${bounty.duration} 回合</div>
          <div>${statusHtml}</div>
        </div>
      `;

      // Hover 效果
      if (this.selectedBountyId !== bounty.id) {
        card.addEventListener('mouseenter', () => { card.style.background = 'rgba(255,255,255,0.05)'; });
        card.addEventListener('mouseleave', () => { card.style.background = 'rgba(0,0,0,0.4)'; });
      }

      card.addEventListener('click', () => {
        this.selectedBountyId = bounty.id;
        this.selectedMercIdForDispatch = null; // 切換任務時清空傭兵選擇
        this.renderList(); // 重新渲染列表以更新選取狀態
        this.renderDetail();
      });

      container.appendChild(card);
    });
  }

  /**
   * 渲染右側詳細資料
   */
  private renderDetail() {
    const emptyContainer = document.getElementById('bounty-detail-empty');
    const contentContainer = document.getElementById('bounty-detail-content');
    
    if (!this.selectedBountyId) {
      if (emptyContainer) emptyContainer.style.display = 'flex';
      if (contentContainer) contentContainer.style.display = 'none';
      return;
    }

    const bounty = GameState.bounties?.find(b => b.id === this.selectedBountyId);
    if (!bounty) {
      this.selectedBountyId = null;
      this.renderDetail();
      return;
    }

    if (emptyContainer) emptyContainer.style.display = 'none';
    if (contentContainer) contentContainer.style.display = 'flex';

    // 基本資訊
    const elTitle = document.getElementById('bounty-detail-title');
    if (elTitle) elTitle.innerText = bounty.name;
    const elDesc = document.getElementById('bounty-detail-desc');
    if (elDesc) elDesc.innerText = bounty.desc;
    const elDuration = document.getElementById('bounty-detail-duration');
    if (elDuration) elDuration.innerText = bounty.duration.toString();

    // 獎勵字串
    let rewardText = `💰 ${bounty.rewards.gold} 金幣, ✨ ${bounty.rewards.exp} 經驗`;
    if (bounty.rewards.items) {
      bounty.rewards.items.forEach((item: any) => {
        const names: Record<string, string> = { 'RAW_HIDE': '獸皮', 'GRAIN': '穀物', 'MEAT': '肉類', 'COTTON': '棉花', 'STONE': '石材', 'IRON_ORE': '鐵礦', 'WOOD': '木材' };
        const itemName = names[item.id] || item.id;
        rewardText += `, 📦 ${itemName} x${item.amount}`;
      });
    }
    const elRewards = document.getElementById('bounty-detail-rewards');
    if (elRewards) elRewards.innerText = rewardText;

    // 狀態區塊顯示切換
    const unacceptedDiv = document.getElementById('bounty-action-unaccepted');
    const inprogressDiv = document.getElementById('bounty-action-inprogress');
    const completedDiv = document.getElementById('bounty-action-completed');
    
    if (unacceptedDiv) unacceptedDiv.style.display = 'none';
    if (inprogressDiv) inprogressDiv.style.display = 'none';
    if (completedDiv) completedDiv.style.display = 'none';

    if (bounty.status === 'PENDING') {
      if (unacceptedDiv) unacceptedDiv.style.display = 'flex';
      this.populateMercSelect();
    } else if (bounty.status === 'IN_PROGRESS') {
      if (inprogressDiv) inprogressDiv.style.display = 'flex';
      const merc = GameState.adventurers.find(a => a.id === bounty.dispatchedMercId);
      const elMerc = document.getElementById('bounty-inprogress-merc');
      if (elMerc) elMerc.innerText = merc ? merc.name : '未知';
      const elTurns = document.getElementById('bounty-inprogress-turns');
      if (elTurns) elTurns.innerText = bounty.remainingDuration?.toString() || '0';
    } else if (bounty.status === 'COMPLETED') {
      if (completedDiv) completedDiv.style.display = 'flex';
    }
  }

  /**
   * 渲染可派遣的閒置傭兵列表
   */
  private populateMercSelect() {
    const listContainer = document.getElementById('bounty-merc-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    // 不在這裡重置 selectedMercIdForDispatch，避免重繪時把已選擇的傭兵清空
    
    // 重新綁定按鈕事件，確保即使 DOM 被替換也能生效
    const btnAccept = document.getElementById('btn-accept-bounty');
    if (btnAccept) {
      btnAccept.onclick = () => {
        this.handleAcceptBounty();
      };
    }
    
    const idleMercs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
    if (idleMercs.length === 0) {
      listContainer.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 10px;">(目前無閒置傭兵)</div>';
      return;
    }

    idleMercs.forEach(merc => {
      const card = document.createElement('div');
      card.className = 'adventurer-card';
      
      const isSelected = this.selectedMercIdForDispatch === merc.id;
      if (isSelected) {
        card.style.borderColor = '#3b82f6';
        card.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
      }
      
      card.innerHTML = renderAdventurerCard(merc);
      
      const displayClass = (merc as any).currentClass || merc.job.name;
      const tooltipHtml = getAdventurerTooltipHtml(merc);

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
        
        // 動態判斷目前是否已選擇這張卡片
        const currentlySelected = this.selectedMercIdForDispatch === merc.id;
        if (currentlySelected) {
          this.selectedMercIdForDispatch = null;
        } else {
          this.selectedMercIdForDispatch = merc.id;
        }
        // 重新渲染選擇列表（更新覆暗底色）
        this.populateMercSelect();
      });

      listContainer.appendChild(card);
    });
  }

  private handleAcceptBounty() {
    if (!this.selectedBountyId) return;
    
    const mercId = this.selectedMercIdForDispatch;
    
    if (!mercId) {
      import('../../ui/ToastManager').then(({ ToastManager }) => {
        ToastManager.show('請先選擇要派遣的傭兵！', 'error');
      });
      return;
    }

    if (BountySystem.acceptBounty(GameState, this.selectedBountyId, mercId)) {
      this.renderList();
      this.renderDetail();
      import('../../ui/ToastManager').then(({ ToastManager }) => {
        ToastManager.show('已成功派遣傭兵執行委託！', 'success');
      });
    } else {
      import('../../ui/ToastManager').then(({ ToastManager }) => {
        ToastManager.show('派遣失敗，請檢查傭兵狀態或任務狀態。', 'error');
      });
    }
  }

  private handleClaimReward() {
    if (!this.selectedBountyId) return;

    if (BountySystem.claimReward(GameState, this.selectedBountyId)) {
      this.selectedBountyId = null; // 領取後清空選擇
      this.renderList();
      this.renderDetail();
      
      // 更新上方資源列
      if (typeof (window as any).updateUICallback === 'function') {
        (window as any).updateUICallback();
      }
    }
  }
}
