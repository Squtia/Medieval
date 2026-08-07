import { GameState } from '../../core/GameState';
import { AdventureLogEntry } from '../../models/AdventureLog';
import { CombatUIManager } from '../CombatUIManager';

export class AdventureLogModalController {
  private static modalId = 'modal-adventure-log';

  public static show(): void {
    let modal = document.getElementById(this.modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = this.modalId;
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="glass-panel" style="position: absolute; right: 0; top: 0; bottom: 0; width: 800px; max-width: 100vw; height: 100vh; margin: 0; border-radius: 0; border-right: none; border-top: none; border-bottom: none; display: flex; flex-direction: column; overflow: hidden; padding: 0; animation: slideInRight 0.3s ease-out;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5);">
            <h2 style="margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 10px; color: #fbbf24;">📜 探險日誌</h2>
            <button class="close-btn" style="position: static;" onclick="document.getElementById('${this.modalId}').classList.remove('active')">✖</button>
          </div>
          <div class="modal-body" style="flex: 1; overflow: hidden; display: flex; padding: 0;">
            <!-- 左側列表 -->
            <div id="adventure-log-list" style="width: 250px; border-right: 1px solid rgba(255,255,255,0.1); overflow-y: auto; background: rgba(0,0,0,0.4);"></div>
            <!-- 右側內容 -->
            <div id="adventure-log-content" style="flex: 1; padding: 25px; overflow-y: auto; background: rgba(15,23,42,0.7);">
              <div style="color: #64748b; text-align: center; margin-top: 40px; font-size: 1.1rem;">請選擇左側的冒險日誌。</div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    modal.classList.add('active');
    this.renderList();
  }

  private static renderList(): void {
    const listContainer = document.getElementById('adventure-log-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const logs = [...GameState.myTerritory.adventureLogs].reverse();

    if (logs.length === 0) {
      listContainer.innerHTML = '<div style="padding: 15px; color: #64748b; text-align: center;">尚無探險紀錄</div>';
      return;
    }

    logs.forEach(log => {
      const item = document.createElement('div');
      item.style.padding = '15px';
      item.style.borderBottom = '1px solid #334155';
      item.style.cursor = 'pointer';
      item.style.transition = 'background 0.2s';
      item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.1)';
      item.onmouseout = () => item.style.background = 'transparent';
      
      item.innerHTML = `
        <div style="color: #fbbf24; font-size: 0.9rem;">第 ${log.day} 天</div>
        <div style="font-size: 1.1rem; margin: 5px 0;">以 ${log.squadLeaderName} 為首的隊伍</div>
        <div style="color: #94a3b8; font-size: 0.8rem;">探索了 ${log.nodeName}</div>
      `;
      item.onclick = () => this.renderContent(log);
      listContainer.appendChild(item);
    });
  }

  private static renderContent(log: AdventureLogEntry): void {
    const contentContainer = document.getElementById('adventure-log-content');
    if (!contentContainer) return;

    contentContainer.innerHTML = '';
    
    // 渲染段落
    log.segments.forEach(seg => {
      if (seg.type === 'TEXT') {
        const p = document.createElement('p');
        p.style.lineHeight = '1.8';
        p.style.marginBottom = '20px';
        p.style.fontSize = '1.05rem';
        p.style.color = '#e2e8f0';
        p.textContent = seg.content;
        contentContainer.appendChild(p);
      } else if (seg.type === 'COMBAT_LINK') {
        const btnWrapper = document.createElement('div');
        btnWrapper.style.textAlign = 'center';
        btnWrapper.style.margin = '30px 0';

        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerHTML = '⚔️ 戰鬥紀錄';
        btn.style.background = '#b91c1c';
        btn.style.color = '#fff';
        btn.style.padding = '8px 20px';
        btn.style.borderRadius = '5px';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';

        btn.onclick = () => {
          const record = GameState.myTerritory.combatHistory.find(r => r.id === seg.content);
          if (record) {
            CombatUIManager.replayCombat(record.report);
          } else {
            alert('找不到該場戰鬥的紀錄。');
          }
        };

        btnWrapper.appendChild(btn);
        contentContainer.appendChild(btnWrapper);
      }
    });

    // 渲染獎勵面板
    if (log.rewards) {
      const rewardsPanel = document.createElement('div');
      rewardsPanel.style.marginTop = '40px';
      rewardsPanel.style.padding = '15px';
      rewardsPanel.style.background = 'rgba(0,0,0,0.4)';
      rewardsPanel.style.border = '1px solid rgba(251, 191, 36, 0.3)';
      rewardsPanel.style.borderRadius = '8px';
      
      let html = `<div style="color: #fbbf24; font-size: 1.1rem; margin-bottom: 10px; border-bottom: 1px solid rgba(251, 191, 36, 0.2); padding-bottom: 5px;">🎁 戰利品與收益</div>`;
      html += `<div style="display: flex; gap: 15px; flex-wrap: wrap;">`;
      if (log.rewards.gold > 0) {
        html += `<span style="color: #facc15;">💰 金幣 +${log.rewards.gold}</span>`;
      }
      if (log.rewards.exp > 0) {
        html += `<span style="color: #4ade80;">✨ 經驗值 +${log.rewards.exp}</span>`;
      }
      if (log.rewards.prestige > 0) {
        html += `<span style="color: #a855f7;">👑 聲望 +${log.rewards.prestige}</span>`;
      }
      html += `</div>`;

      if (log.rewards.items && log.rewards.items.length > 0) {
        html += `<div style="margin-top: 10px; color: #cbd5e1; font-size: 0.95rem;">`;
        html += `獲得裝備：<br/>`;
        log.rewards.items.forEach(item => {
          html += `<span style="display: inline-block; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; margin-right: 5px; margin-top: 5px; color: #bae6fd;">🗡️ ${item}</span>`;
        });
        html += `</div>`;
      }
      
      rewardsPanel.innerHTML = html;
      contentContainer.appendChild(rewardsPanel);
    }
  }
}
