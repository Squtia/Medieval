import { GameState } from '../../core/GameState';
import { ChurchSystem } from '../../systems/ChurchSystem';
import { ToastManager } from '../ToastManager';
import { EventBus } from '../../core/EventBus';
import { GameEventType } from '../../core/GameEvents';
import { Adventurer } from '../../models/Adventurer';
import { renderAdventurerCard } from '../components/AdventurerCard';
import { UIManager } from '../UIManager';

export class ChurchModalController {
  private static isInitialized = false;
  private static selectedBedId: string | null = null;

  public static init(): void {
    if (this.isInitialized) return;

    // 熬製 1 瓶生命藥水
    document.getElementById('btn-brew-single')?.addEventListener('click', () => {
      const territory = GameState.myTerritory;
      if (!territory) return;
      const res = ChurchSystem.brewHealingPotion(1, territory);
      ToastManager.show(res.message, res.success ? 'success' : 'warning');
      this.render();
      UIManager.updateUI();
    });

    // 熬製最大數量生命藥水
    document.getElementById('btn-brew-max')?.addEventListener('click', () => {
      const territory = GameState.myTerritory;
      if (!territory) return;
      const herbs = territory.materials['tg_Medicinal_herbs'] || 0;
      const maxCount = Math.floor(herbs / 50);
      if (maxCount <= 0) {
        ToastManager.show('⚠️ 野生藥草不足，至少需要 50 株才能熬製 1 瓶！', 'warning');
        return;
      }
      const res = ChurchSystem.brewHealingPotion(maxCount, territory);
      ToastManager.show(res.message, res.success ? 'success' : 'warning');
      this.render();
      UIManager.updateUI();
    });

    // 打造新病床
    document.getElementById('btn-build-infirmary-bed')?.addEventListener('click', () => {
      const territory = GameState.myTerritory;
      if (!territory) return;
      const res = ChurchSystem.buildBed(territory);
      ToastManager.show(res.message, res.success ? 'success' : 'warning');
      this.render();
      UIManager.updateUI();
    });

    // 訂閱資源或狀態變更事件
    EventBus.getInstance().subscribe(GameEventType.RESOURCE_CHANGED, () => {
      const view = document.getElementById('view-church');
      if (view && view.classList.contains('active')) {
        this.render();
      }
    }, 'ui');

    this.isInitialized = true;
  }

  public static open(): void {
    this.init();
    const views = document.querySelectorAll('.facility-view, #view-city');
    views.forEach(v => v.classList.remove('active'));

    const churchView = document.getElementById('view-church');
    if (churchView) churchView.classList.add('active');

    // 預設選中第一個病床（若有）
    const beds = GameState.myTerritory?.infirmaryBeds || [];
    if (beds.length > 0 && !this.selectedBedId) {
      this.selectedBedId = beds[0].id;
    }

    this.render();
  }

  public static render(): void {
    const territory = GameState.myTerritory;
    if (!territory) return;

    this.init();

    const lvl = territory.churchLevel || 0;
    const maxBeds = territory.getMaxInfirmaryBeds();
    const beds = territory.infirmaryBeds || [];
    const baseRecoveryRate = territory.getChurchNaturalRecoveryRate();
    const prayerBonus = ChurchSystem.getRetiredPrayersBonus();

    // 1. 頂部等級標籤與標題
    const lvlEl = document.getElementById('ui-church-lvl');
    if (lvlEl) {
      const names = ['Lv.0 (未建造)', 'Lv.1 祈禱處', 'Lv.2 禮拜堂', 'Lv.3 修道院', 'Lv.4 大教堂'];
      lvlEl.textContent = names[lvl] || `Lv.${lvl}`;
    }

    // 2. 左欄資訊刷新
    const dailyRecEl = document.getElementById('church-daily-recovery-text');
    if (dailyRecEl) {
      const totalRec = Math.round((baseRecoveryRate + prayerBonus.recoveryBonusPct) * 100);
      dailyRecEl.textContent = `+${totalRec}% MaxHP/MP (基礎 ${Math.round(baseRecoveryRate * 100)}% + 被動 ${Math.round(prayerBonus.recoveryBonusPct * 100)}%)`;
    }

    const clergyEl = document.getElementById('church-clergy-bonus-text');
    if (clergyEl) {
      if (prayerBonus.prayerCount > 0) {
        clergyEl.textContent = `📜 聖光庇護：領地現有 ${prayerBonus.prayerCount} 位退休神職人員，全領地每日恢復 +${Math.round(prayerBonus.recoveryBonusPct * 100)}%、藥水急救效果 +${Math.round(prayerBonus.potionBonusPct * 100)}%`;
        clergyEl.style.color = '#60a5fa';
      } else {
        clergyEl.textContent = '📜 聖光庇護：暫無退休神職人員（退休祈禱者/神官可提供永久被動）';
        clergyEl.style.color = '#94a3b8';
      }
    }

    const herbsEl = document.getElementById('church-herbs-count');
    if (herbsEl) herbsEl.textContent = (territory.materials['tg_Medicinal_herbs'] || 0).toLocaleString();

    const potionEl = document.getElementById('church-potion-count');
    if (potionEl) potionEl.textContent = (territory.materials['item_healing_potion_s'] || 0).toLocaleString();

    const capEl = document.getElementById('church-bed-capacity');
    if (capEl) capEl.textContent = `${beds.length} / ${maxBeds} 床`;

    const costTextEl = document.getElementById('church-bed-cost-text');
    const buildBedBtn = document.getElementById('btn-build-infirmary-bed') as HTMLButtonElement | null;
    if (costTextEl && buildBedBtn) {
      if (beds.length >= maxBeds) {
        costTextEl.textContent = '已達當前等級上限 (需在書房擴建教會)';
        buildBedBtn.disabled = true;
        buildBedBtn.style.opacity = '0.5';
      } else {
        const bedCost = ChurchSystem.getBedCost();
        const curPlank = territory.materials['mat_wood_plank'] || 0;
        const curLeather = territory.materials['mat_leather'] || 0;
        costTextEl.textContent = `消耗: ${bedCost.plank}木板 (現有 ${curPlank}) ${bedCost.leather}皮革 (現有 ${curLeather})`;
        const canBuild = curPlank >= bedCost.plank && curLeather >= bedCost.leather;
        buildBedBtn.disabled = !canBuild;
        buildBedBtn.style.opacity = canBuild ? '1' : '0.6';
      }
    }

    // 3. 右欄病床卡片列表渲染
    this.renderBedsList(beds);

    // 4. 右欄下方選中區域渲染
    this.renderSelectedDetail(beds);
  }

  /**
   * 🛏️ 渲染上半部病床卡片列表
   */
  private static renderBedsList(beds: any[]): void {
    const container = document.getElementById('church-beds-container');
    if (!container) return;
    container.innerHTML = '';

    if (beds.length === 0) {
      container.innerHTML = `
        <div style="width: 100%; text-align: center; color: #94a3b8; padding: 30px; font-size: 0.95em;">
          🏛️ 尚未打造任何病床，請點擊左側「🔨 打造新病床」！
        </div>
      `;
      return;
    }

    // 若當前選中的 bedId 不存在，重置為第一個
    if (!beds.some(b => b.id === this.selectedBedId)) {
      this.selectedBedId = beds[0].id;
    }

    beds.forEach((bed, idx) => {
      const isSelected = bed.id === this.selectedBedId;
      const patient = bed.isOccupied ? (GameState.adventurers || []).find(a => a.id === bed.adventurerId) : null;

      const bedCard = document.createElement('div');
      bedCard.className = 'bed-card';
      bedCard.style.cssText = `
        width: 150px;
        min-height: 190px;
        background: ${isSelected ? 'rgba(234, 179, 8, 0.15)' : 'rgba(0, 0, 0, 0.45)'};
        border: 2px solid ${isSelected ? '#eab308' : (bed.isOccupied ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.12)')};
        border-radius: 8px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        box-shadow: ${isSelected ? '0 0 12px rgba(234, 179, 8, 0.35)' : '0 4px 10px rgba(0,0,0,0.5)'};
      `;

      if (bed.isOccupied && patient) {
        // 已入住病患卡片
        const stats = patient.getCombatStats();
        const curHp = patient.getCurrentHp();
        const hpPct = Math.min(100, Math.max(0, Math.round((curHp / stats.hp) * 100)));

        bedCard.innerHTML = `
          <div style="font-size: 0.78em; font-weight: bold; color: #fbbf24; margin-bottom: 4px;">🛏️ 病床 #${idx + 1}</div>
          <div class="adv-card-wrapper" style="width: 100%; height: 110px; position: relative; pointer-events: none;">
            ${renderAdventurerCard(patient)}
          </div>
          <div style="width: 100%; margin-top: 6px; font-size: 0.75em; text-align: center;">
            <div style="color: ${patient.isWounded ? '#f87171' : '#4ade80'}; font-weight: bold;">
              ${patient.isWounded ? '🩸 重傷瀕死' : '休養中'}
            </div>
            <div style="color: #cbd5e1; margin-top: 2px;">HP: ${curHp} / ${stats.hp} (${hpPct}%)</div>
          </div>
        `;
      } else {
        // 空床位卡片
        bedCard.innerHTML = `
          <div style="font-size: 0.78em; font-weight: bold; color: #94a3b8; margin-bottom: 8px;">🛏️ 病床 #${idx + 1}</div>
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; width: 100%;">
            <div style="font-size: 2.2em; opacity: 0.7;">🛏️</div>
            <div style="font-size: 0.85em; color: #4ade80; font-weight: bold;">➕ 空床位</div>
            <div style="font-size: 0.72em; color: #94a3b8;">點擊指派傷員</div>
          </div>
        `;
      }

      bedCard.addEventListener('click', () => {
        this.selectedBedId = bed.id;
        this.render();
      });

      container.appendChild(bedCard);
    });
  }

  /**
   * 📋 渲染下半部選中病床操作區
   */
  private static renderSelectedDetail(beds: any[]): void {
    const detailEl = document.getElementById('church-selected-detail');
    if (!detailEl) return;

    if (!this.selectedBedId || beds.length === 0) {
      detailEl.style.display = 'none';
      return;
    }

    const currentBed = beds.find(b => b.id === this.selectedBedId);
    if (!currentBed) {
      detailEl.style.display = 'none';
      return;
    }

    detailEl.style.display = 'flex';
    detailEl.innerHTML = '';

    const bedIdx = beds.findIndex(b => b.id === this.selectedBedId) + 1;
    const territory = GameState.myTerritory;

    if (currentBed.isOccupied) {
      // ── 選中已入住傷員：展示急救與出院按鈕 ──
      const patient = (GameState.adventurers || []).find(a => a.id === currentBed.adventurerId);
      if (!patient) return;

      const stats = patient.getCombatStats();
      const curHp = patient.getCurrentHp();
      const curMp = patient.getCurrentMp();
      const hpPct = Math.min(100, Math.max(0, Math.round((curHp / stats.hp) * 100)));
      const potionCount = territory.materials['item_healing_potion_s'] || 0;

      const detailCard = document.createElement('div');
      detailCard.style.cssText = `
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(234,179,8,0.3);
        border-radius: 6px;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;

      detailCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 1em; font-weight: bold; color: #fbbf24;">
            🛏️ 病床 #${bedIdx} 當前病患：<span style="color: #fff;">${patient.name} (Lv.${patient.level} ${patient.job.name})</span>
          </div>
          <span style="font-size: 0.85em; padding: 2px 8px; border-radius: 4px; background: ${patient.isWounded ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}; color: ${patient.isWounded ? '#f87171' : '#4ade80'}; border: 1px solid ${patient.isWounded ? '#ef4444' : '#22c55e'};">
            ${patient.isWounded ? '🩸 重傷瀕死 (全屬性-20%)' : '🌿 休養中'}
          </span>
        </div>

        <div style="display: flex; gap: 20px; font-size: 0.88em; color: #cbd5e1; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 4px;">
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>生命值 (HP)</span>
              <span style="color: #4ade80; font-weight: bold;">${curHp} / ${stats.hp} (${hpPct}%)</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.6); border-radius: 3px; overflow: hidden;">
              <div style="width: ${hpPct}%; height: 100%; background: ${hpPct < 30 ? '#ef4444' : (hpPct < 80 ? '#f59e0b' : '#10b981')};"></div>
            </div>
          </div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>魔力值 (MP)</span>
              <span style="color: #60a5fa; font-weight: bold;">${curMp} / ${stats.mp}</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.6); border-radius: 3px; overflow: hidden;">
              <div style="width: ${Math.min(100, Math.round((curMp / stats.mp) * 100))}%; height: 100%; background: #3b82f6;"></div>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: center; margin-top: 2px;">
          <button id="btn-patient-potion-treat" class="action-btn" ${potionCount > 0 ? '' : 'disabled'} style="flex: 1; padding: 8px; font-size: 0.9em; background: ${potionCount > 0 ? 'linear-gradient(135deg, #059669, #047857)' : 'rgba(255,255,255,0.08)'}; color: #fff; font-weight: bold;">
            💉 施用生命藥水急救 (立即補 25% HP，剩餘 ${potionCount} 瓶)
          </button>
          <button id="btn-patient-discharge" class="action-btn" style="width: 140px; padding: 8px; font-size: 0.9em; background: linear-gradient(135deg, #475569, #334155); color: #e2e8f0;">
            🚪 離床出院
          </button>
        </div>
      `;

      detailEl.appendChild(detailCard);

      // 綁定藥水急救
      document.getElementById('btn-patient-potion-treat')?.addEventListener('click', () => {
        const res = ChurchSystem.treatWithPotion(patient.id, territory, currentBed.id);
        ToastManager.show(res.message, res.success ? 'success' : 'warning');
        this.render();
        UIManager.updateUI();
      });

      // 綁定離床出院
      document.getElementById('btn-patient-discharge')?.addEventListener('click', () => {
        const res = ChurchSystem.dischargePatient(currentBed.id, territory);
        ToastManager.show(res.message, res.success ? 'success' : 'warning');
        this.render();
        UIManager.updateUI();
      });

    } else {
      // ── 選中空病床：下方直接展示可入住傭兵卡片列表 ──
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      `;
      headerDiv.innerHTML = `
        <div style="font-size: 0.95em; font-weight: bold; color: #4ade80;">
          ➕ 為【病床 #${bedIdx}】選擇入住傷員 (點擊卡片直接躺床)：
        </div>
        <div style="font-size: 0.8em; color: #94a3b8;">
          受傷/重傷者已自動置頂排序
        </div>
      `;
      detailEl.appendChild(headerDiv);

      // 取得所有未在病床上且未出征的傭兵
      const allAdvs = (GameState.adventurers || []).filter(a => {
        const isDispatched = (a as any).isDispatched || (a as any).onExpedition;
        return !a.inInfirmaryBed && !isDispatched;
      });

      // 排序：重傷 ➔ 受傷 ➔ 滿血
      allAdvs.sort((a, b) => {
        if (a.isWounded && !b.isWounded) return -1;
        if (!a.isWounded && b.isWounded) return 1;
        const aStats = a.getCombatStats();
        const bStats = b.getCombatStats();
        const aPct = a.getCurrentHp() / aStats.hp;
        const bPct = b.getCurrentHp() / bStats.hp;
        return aPct - bPct;
      });

      const cardsScroll = document.createElement('div');
      cardsScroll.style.cssText = `
        display: flex;
        gap: 10px;
        overflow-x: auto;
        padding: 4px 2px 8px 2px;
        min-height: 140px;
        align-items: center;
      `;

      if (allAdvs.length === 0) {
        cardsScroll.innerHTML = `
          <div style="color: #94a3b8; font-size: 0.9em; padding: 20px; width: 100%; text-align: center;">
            暫無可指派的閒置傭兵（全體均已入住或外出執行任務中）。
          </div>
        `;
      } else {
        allAdvs.forEach(adv => {
          const cardWrap = document.createElement('div');
          cardWrap.className = 'candidate-card';
          cardWrap.style.cssText = `
            width: 105px;
            height: 130px;
            flex-shrink: 0;
            cursor: pointer;
            position: relative;
            transition: transform 0.15s ease;
          `;
          cardWrap.innerHTML = renderAdventurerCard(adv);

          cardWrap.addEventListener('mouseenter', () => {
            cardWrap.style.transform = 'translateY(-4px) scale(1.04)';
          });
          cardWrap.addEventListener('mouseleave', () => {
            cardWrap.style.transform = 'translateY(0) scale(1)';
          });

          cardWrap.addEventListener('click', () => {
            const res = ChurchSystem.assignPatient(currentBed.id, adv.id, territory);
            ToastManager.show(res.message, res.success ? 'success' : 'warning');
            this.render();
            UIManager.updateUI();
          });

          cardsScroll.appendChild(cardWrap);
        });
      }

      detailEl.appendChild(cardsScroll);
    }
  }
}
