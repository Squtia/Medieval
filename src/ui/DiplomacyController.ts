import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { Faction, FactionPersonality } from '../models/types';

export class DiplomacyController {
  private static initialized = false;

  public static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 綁定關閉按鈕
    document.getElementById('btn-close-diplomacy')?.addEventListener('click', () => {
      this.close();
    });

    // 訂閱外交事件，若面板已開啟則重新渲染
    EventBus.getInstance().subscribe(GameEventType.DIPLOMACY_EVENT, () => {
      const panel = document.getElementById('diplomacy-panel');
      if (panel?.classList.contains('active')) {
        this.renderFactions();
      }
    }, 'ui');
  }

  public static open(): void {
    this.initialize();
    const panel = document.getElementById('diplomacy-panel');
    if (panel) {
      panel.classList.add('active');
      this.renderFactions();
    }
  }

  public static close(): void {
    document.getElementById('diplomacy-panel')?.classList.remove('active');
  }

  public static isOpen(): boolean {
    return document.getElementById('diplomacy-panel')?.classList.contains('active') ?? false;
  }

  private static renderFactions(): void {
    const listEl = document.getElementById('diplomacy-list');
    if (!listEl) return;

    if (!GameState.mapSystem) {
      listEl.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 2rem;">無派系資料。</p>';
      return;
    }

    const factions = GameState.mapSystem.getFactions().filter(f => f.controlledNodes.length > 0);

    if (factions.length === 0) {
      listEl.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 2rem;">大陸上已無其他活躍的派系。</p>';
      return;
    }

    let html = '';

    for (const faction of factions) {
      const isAtWar = faction.atWarWith?.includes('player') || false;
      const favor = faction.playerFavor || 0;
      let favorText = '中立';
      let favorColor = 'color: #d1d5db;';
      if (favor > 50) { favorText = '友善'; favorColor = 'color: #4ade80;'; }
      else if (favor > 20) { favorText = '友好'; favorColor = 'color: #60a5fa;'; }
      else if (favor < -50) { favorText = '敵視'; favorColor = 'color: #ef4444;'; }
      else if (favor < -20) { favorText = '冷淡'; favorColor = 'color: #fb923c;'; }

      if (isAtWar) {
        favorText = '交戰中';
        favorColor = 'color: #dc2626; font-weight: bold; text-shadow: 0 0 5px rgba(220,38,38,0.5);';
      }

      let personalityText = '未知';
      switch (faction.personality) {
        case FactionPersonality.WARMONGER: personalityText = '⚔️ 好戰'; break;
        case FactionPersonality.PEACEFUL:  personalityText = '🕊️ 和平'; break;
        case FactionPersonality.MERCHANT:  personalityText = '💰 重商'; break;
        case FactionPersonality.SCHEMER:   personalityText = '👁️ 善變'; break;
      }

      html += `
        <div style="background: rgba(0,0,0,0.4); padding: 14px; border: 1px solid #4b5563; border-radius: 8px; margin-bottom: 12px; transition: border-color 0.2s;"
             onmouseover="this.style.borderColor='#9ca3af'" onmouseout="this.style.borderColor='#4b5563'">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 12px; height: 40px; border-radius: 6px; background-color: ${faction.color}; flex-shrink: 0;"></div>
              <div>
                <div style="font-size: 1.05em; font-weight: bold; color: #f3f4f6;">${faction.factionName}</div>
                <div style="font-size: 0.82em; color: #9ca3af; display: flex; gap: 10px; margin-top: 3px;">
                  <span>性格: <span style="color: #d1d5db;">${personalityText}</span></span>
                  <span>據點: <span style="color: #fbbf24;">${faction.controlledNodes.length}</span></span>
                </div>
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <div style="font-size: 0.78em; color: #9ca3af;">對您的態度</div>
              <div style="font-size: 1.05em; font-weight: bold; ${favorColor}">${favorText} (${favor})</div>
            </div>
          </div>

          <p style="color: #9ca3af; font-size: 0.82em; font-style: italic; margin: 0 0 10px 0; line-height: 1.4;">${faction.description}</p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="action-btn diplomacy-action-btn"
              style="background: rgba(217,119,6,0.2); border-color: rgba(217,119,6,0.5); color: #fcd34d; padding: 5px 10px; font-size: 0.82em; min-width: auto; height: auto;"
              data-action="gift" data-id="${faction.id}">
              🎁 贈禮 (500金)
            </button>
            ${isAtWar ? `
            <button class="action-btn diplomacy-action-btn"
              style="background: rgba(37,99,235,0.2); border-color: rgba(37,99,235,0.5); color: #93c5fd; padding: 5px 10px; font-size: 0.82em; min-width: auto; height: auto;"
              data-action="peace" data-id="${faction.id}">
              🕊️ 求和 (2000金)
            </button>
            ` : `
            <button class="action-btn diplomacy-action-btn"
              style="background: rgba(220,38,38,0.2); border-color: rgba(220,38,38,0.5); color: #fca5a5; padding: 5px 10px; font-size: 0.82em; min-width: auto; height: auto;"
              data-action="war" data-id="${faction.id}">
              ⚔️ 宣戰 (-100聲望)
            </button>
            `}
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;

    // 綁定操作按鈕事件
    listEl.querySelectorAll<HTMLButtonElement>('.diplomacy-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const factionId = btn.dataset.id;
        if (action && factionId) {
          this.handleDiplomacyAction(action, factionId);
        }
      });
    });
  }

  private static handleDiplomacyAction(action: string, factionId: string): void {
    if (!GameState.mapSystem) return;
    const faction = GameState.mapSystem.getFactions().find(f => f.id === factionId);
    if (!faction) return;

    let success = false;
    let msg = '';

    if (action === 'gift') {
      const cost = 500;
      if (GameState.myTerritory.gold >= cost) {
        GameState.myTerritory.gold -= cost;
        const gain = (Math.random() * 5 + 5) | 0; // +5 ~ +10
        faction.playerFavor = Math.min(100, faction.playerFavor + gain);
        success = true;
        msg = `贈送厚禮給【${faction.factionName}】，好感度上升了 ${gain} 點。`;
      } else {
        if ((window as any).toastManager) (window as any).toastManager.show('金幣不足！', 'error');
        return;
      }
    } else if (action === 'war') {
      const cost = 100;
      if (GameState.myTerritory.prestige >= cost) {
        GameState.myTerritory.prestige -= cost;
        if (!faction.atWarWith) faction.atWarWith = [];
        if (!faction.atWarWith.includes('player')) {
          faction.atWarWith.push('player');
        }
        faction.playerFavor = -100;
        success = true;
        msg = `對【${faction.factionName}】正式宣戰！雙方進入戰爭狀態。`;
      } else {
        if ((window as any).toastManager) (window as any).toastManager.show('聲望不足以發布宣戰布告！', 'error');
        return;
      }
    } else if (action === 'peace') {
      const cost = 2000;
      if (GameState.myTerritory.gold >= cost) {
        GameState.myTerritory.gold -= cost;
        faction.atWarWith = faction.atWarWith.filter(id => id !== 'player');
        faction.playerFavor = -20;
        success = true;
        msg = `花費鉅資與【${faction.factionName}】達成停戰協議。`;
      } else {
        if ((window as any).toastManager) (window as any).toastManager.show('金幣不足！', 'error');
        return;
      }
    }

    if (success) {
      console.log(`[外交] ${msg}`);
      if ((window as any).toastManager) {
        (window as any).toastManager.show(msg, 'success');
      }

      EventBus.getInstance().publish({
        type: GameEventType.DIPLOMACY_EVENT,
        payload: { actionType: action, targetFactionId: factionId, resultMsg: msg, newRelation: faction.playerFavor }
      });

      // 更新頂部資源列
      if (typeof (window as any).updateUICallback === 'function') {
        (window as any).updateUICallback();
      }
    }
  }
}
