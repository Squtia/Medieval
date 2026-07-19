import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { CombatReport, CombatEvent, CombatEventType, CombatParticipantState } from '../models/Combat';
import { FormationRow, TerrainType } from '../models/types';

export class CombatUIManager {
  private static modal = document.getElementById('combat-modal')!;
  private static playerTeamContainer = document.getElementById('combat-player-team')!;
  private static enemyTeamContainer = document.getElementById('combat-enemy-team')!;
  private static logArea = document.getElementById('combat-log-area')!;
  private static btnSkip = document.getElementById('btn-combat-skip')!;
  private static btnClose = document.getElementById('btn-combat-close')!;
  private static resultOverlay = document.getElementById('combat-result-overlay')!;
  private static resultTitle = document.getElementById('combat-result-title')!;
  private static resultDesc = document.getElementById('combat-result-desc')!;
  private static btnResultClose = document.getElementById('btn-combat-result-close')!;
  private static btnSpeed1x = document.getElementById('btn-combat-speed-1x')!;
  private static btnSpeed2x = document.getElementById('btn-combat-speed-2x')!;
  
  private static currentReport: CombatReport | null = null;
  private static playInterval: number | null = null;
  private static currentSpeed = 1200; // 1x 預設較慢
  private static eventIndex = 0;
  private static hpMap: Record<string, number> = {};

  private static isInitialized = false;

  public static init() {
    EventBus.getInstance().subscribe(GameEventType.COMBAT_FINISHED, (payload) => {
      if (payload.report) {
         this.showCombat(payload.report);
      }
    });

    if (!this.isInitialized) {
      this.btnSkip.addEventListener('click', () => this.skipPlayback());
      this.btnClose.addEventListener('click', () => this.closeCombat());
      this.btnResultClose.addEventListener('click', () => this.closeCombat());
      this.btnSpeed1x.addEventListener('click', () => this.setSpeed(1));
      this.btnSpeed2x.addEventListener('click', () => this.setSpeed(2));
      this.isInitialized = true;
    }
  }

  public static replayCombat(report: CombatReport) {
    this.showCombat(report);
  }

  private static setSpeed(multiplier: number) {
    this.currentSpeed = multiplier === 1 ? 1200 : 500;
    
    if (multiplier === 1) {
      this.btnSpeed1x.classList.add('active');
      this.btnSpeed1x.style.borderColor = '#eab308';
      this.btnSpeed1x.style.color = '#eab308';
      this.btnSpeed2x.classList.remove('active');
      this.btnSpeed2x.style.borderColor = '#64748b';
      this.btnSpeed2x.style.color = '#64748b';
    } else {
      this.btnSpeed2x.classList.add('active');
      this.btnSpeed2x.style.borderColor = '#eab308';
      this.btnSpeed2x.style.color = '#eab308';
      this.btnSpeed1x.classList.remove('active');
      this.btnSpeed1x.style.borderColor = '#64748b';
      this.btnSpeed1x.style.color = '#64748b';
    }

    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = window.setInterval(() => this.playNextEvent(), this.currentSpeed);
    }
  }

  private static showCombat(report: CombatReport) {
    this.currentReport = report;
    this.eventIndex = 0;
    this.hpMap = {};
    
    this.modal.classList.add('active');
    this.resultOverlay.classList.remove('active');
    this.btnSkip.style.display = 'block';
    this.btnClose.style.display = 'none';
    this.logArea.innerHTML = '';
    this.playerTeamContainer.innerHTML = '';
    this.enemyTeamContainer.innerHTML = '';
    
    // 依據地形設定戰鬥舞台背景
    const stage = document.getElementById('combat-stage')!;
    if (report.terrain) {
      if (report.terrain === TerrainType.DESERT) stage.style.background = 'linear-gradient(to bottom, #78350f, #451a03)';
      else if (report.terrain === TerrainType.FOREST) stage.style.background = 'linear-gradient(to bottom, #14532d, #064e3b)';
      else if (report.terrain === TerrainType.SNOW_MOUNTAIN) stage.style.background = 'linear-gradient(to bottom, #e0f2fe, #38bdf8)';
      else if (report.terrain === TerrainType.VOLCANO) stage.style.background = 'linear-gradient(to bottom, #7f1d1d, #450a0a)';
      else stage.style.background = 'linear-gradient(to bottom, #1e293b, #0f172a)'; // PLAINS 或預設
    } else {
      stage.style.background = 'linear-gradient(to bottom, #1e293b, #0f172a)';
    }
    
    
    // 初始化血條 (只初始化我方，敵方由 WAVE_START 處理)
    report.initialStates.forEach(state => {
      this.hpMap[state.id] = state.maxHp;
      this.createHpBar(state);
    });
    
    // 開始非同步播放戰報
    this.playInterval = window.setInterval(() => this.playNextEvent(), this.currentSpeed);
  }
  
  private static createHpBar(state: CombatParticipantState) {
    const div = document.createElement('div');
    div.className = 'combat-participant';
    div.id = `combat-p-${state.id}`;
    
    const icon = state.isPlayer ? '🦸' : '👺';
    
    // 設定前後排與圖示
    // 玩家 (rtl)：grid-column: 1 是靠近中央(前排)，2 是遠離中央(後排)
    // 敵軍 (ltr)：grid-column: 1 是靠近中央(前排)，2 是遠離中央(後排)
    let gridColumn = 1;
    if (state.isPlayer) {
      gridColumn = state.row === FormationRow.FRONT ? 1 : 2;
    } else {
      gridColumn = state.row === FormationRow.FRONT ? 1 : 2;
    }
    div.style.gridColumn = gridColumn.toString();

    div.innerHTML = `
      <div style="font-size: 0.9em; font-weight: bold;">${icon} ${state.name} <span style="font-size: 0.7em; color: #94a3b8;">${state.row === FormationRow.FRONT ? '前排' : '後排'}</span></div>
      <div class="combat-hp-bg">
        <div id="hp-fill-${state.id}" class="combat-hp-fill" style="width: 100%;"></div>
      </div>
    `;
    
    if (state.isPlayer) {
      this.playerTeamContainer.appendChild(div);
    } else {
      this.enemyTeamContainer.appendChild(div);
      div.style.textAlign = 'right';
    }
  }

  private static playNextEvent() {
    if (!this.currentReport) return;
    
    if (this.eventIndex >= this.currentReport.events.length) {
      this.finishPlayback();
      return;
    }
    
    const event = this.currentReport.events[this.eventIndex];
    this.renderEvent(event);
    
    this.eventIndex++;
  }

  private static renderEvent(event: CombatEvent) {
    // 渲染文字
    const logEl = document.createElement('div');
    logEl.className = 'combat-log-entry';
    logEl.textContent = event.text;
    
    if (event.type === CombatEventType.WAVE_START) {
      logEl.style.color = '#eab308';
      logEl.style.fontWeight = 'bold';
      logEl.style.textAlign = 'center';
      logEl.style.margin = '15px 0';
      
      // 生成該波次敵人
      this.enemyTeamContainer.innerHTML = '';
      if (event.enemies) {
        event.enemies.forEach(e => {
          this.hpMap[e.id] = e.maxHp;
          this.createHpBar(e);
        });
      }
    } else if (event.type === CombatEventType.CRIT) {
      logEl.classList.add('log-crit');
      this.modal.classList.add('shake');
      setTimeout(() => this.modal.classList.remove('shake'), 400);
    } else if (event.type === CombatEventType.MISS) {
      logEl.classList.add('log-miss');
    } else if (event.type === CombatEventType.STATUS_APPLY) {
      logEl.classList.add('log-status');
    } else if (event.type === CombatEventType.DEATH) {
      logEl.classList.add('log-death');
    }
    
    this.logArea.appendChild(logEl);
    this.logArea.scrollTop = this.logArea.scrollHeight;
    
    // 更新血量與動畫
    if (event.targetHp !== undefined && event.targetId !== undefined && event.targetMaxHp !== undefined) {
      this.hpMap[event.targetId] = event.targetHp;
      const fillEl = document.getElementById(`hp-fill-${event.targetId}`);
      if (fillEl) {
        const pct = Math.max(0, (event.targetHp / event.targetMaxHp) * 100);
        fillEl.style.width = `${pct}%`;
        if (pct < 30) fillEl.classList.add('low');
      }
    }

    if ((event.type === CombatEventType.HIT || event.type === CombatEventType.CRIT) && event.actorId && event.targetId) {
      const actorEl = document.getElementById(`combat-p-${event.actorId}`);
      const targetEl = document.getElementById(`combat-p-${event.targetId}`);
      
      if (actorEl) {
        const isPlayer = this.currentReport?.initialStates.find(s => s.id === event.actorId)?.isPlayer;
        const bumpClass = isPlayer ? 'attack-bump-player' : 'attack-bump-enemy';
        actorEl.classList.remove(bumpClass);
        void actorEl.offsetWidth; // trigger reflow
        actorEl.classList.add(bumpClass);
      }
      
      if (targetEl) {
        targetEl.classList.remove('hit-flash');
        void targetEl.offsetWidth;
        targetEl.classList.add('hit-flash');
        
        if (event.damage !== undefined) {
          const dmgEl = document.createElement('div');
          dmgEl.className = `floating-dmg ${event.type === CombatEventType.CRIT ? 'crit' : ''}`;
          dmgEl.textContent = `-${event.damage}`;
          targetEl.appendChild(dmgEl);
          setTimeout(() => { if (dmgEl.parentNode) dmgEl.remove(); }, 1000);
        }
      }
    }
  }

  private static skipPlayback() {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    if (!this.currentReport) return;
    
    // 瞬間渲染剩下的所有 events
    while (this.eventIndex < this.currentReport.events.length) {
      this.renderEvent(this.currentReport.events[this.eventIndex]);
      this.eventIndex++;
    }
    
    this.finishPlayback();
  }

  private static finishPlayback() {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    this.btnSkip.style.display = 'none';
    this.btnClose.style.display = 'block'; // 顯示返回按鈕
    
    // 將結算訊息直接寫入文字戰報區
    const resultEl = document.createElement('div');
    resultEl.style.marginTop = '20px';
    resultEl.style.padding = '15px';
    resultEl.style.borderRadius = '8px';
    resultEl.style.textAlign = 'center';
    resultEl.style.border = '2px solid';
    
    if (this.currentReport?.isVictory) {
      resultEl.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
      resultEl.style.borderColor = '#22c55e';
      resultEl.innerHTML = `
        <h3 style="color: #4ade80; margin: 0 0 10px 0; font-size: 1.5em;">✅ 戰鬥勝利！</h3>
        <p style="margin: 0;">${this.currentReport.battleLog}</p>
        <p style="margin: 10px 0 0 0; font-weight: bold; color: #fbbf24;">獲得戰利品 / 聲望：${this.currentReport.lootValue}</p>
      `;
    } else {
      resultEl.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      resultEl.style.borderColor = '#ef4444';
      resultEl.innerHTML = `
        <h3 style="color: #f87171; margin: 0 0 10px 0; font-size: 1.5em;">❌ 戰鬥失敗...</h3>
        <p style="margin: 0;">${this.currentReport?.battleLog}</p>
        <p style="margin: 10px 0 0 0; color: #94a3b8;">小隊需要休養。</p>
      `;
    }
    
    this.logArea.appendChild(resultEl);
    this.logArea.scrollTop = this.logArea.scrollHeight;
  }

  private static closeCombat() {
    this.modal.classList.remove('active');
    this.currentReport = null;
  }
}
