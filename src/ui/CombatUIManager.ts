import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { CombatReport, CombatEvent, CombatEventType, CombatParticipantState } from '../models/Combat';
import { FormationRow, TerrainType } from '../models/types';

export class CombatUIManager {
  // DOM 引用：延遲到 init() 時才初始化，避免 template 尚未注入時取得 null
  private static modal: HTMLElement;
  private static playerTeamContainer: HTMLElement;
  private static enemyTeamContainer: HTMLElement;
  private static logArea: HTMLElement;
  private static btnSkip: HTMLElement;
  private static btnClose: HTMLElement;
  private static resultOverlay: HTMLElement;
  private static resultTitle: HTMLElement;
  private static resultDesc: HTMLElement;
  private static btnResultClose: HTMLElement;
  private static btnSpeed1x: HTMLElement;
  private static btnSpeed2x: HTMLElement;
  
  private static currentReport: CombatReport | null = null;
  private static playInterval: number | null = null;
  private static finishTimeout: ReturnType<typeof setTimeout> | null = null;
  private static currentSpeed = 1200; // 1x 預設較慢
  private static eventIndex = 0;
  private static hpMap: Record<string, number> = {};
  private static fallbackPlayerCount = 0;
  private static fallbackEnemyCount = 0;

  private static isInitialized = false;

  public static init() {
    // 在 templates 注入完成後，init() 被呼叫時才查詢 DOM
    this.modal               = document.getElementById('combat-modal')!;
    this.playerTeamContainer = document.getElementById('combat-player-team')!;
    this.enemyTeamContainer  = document.getElementById('combat-enemy-team')!;
    this.logArea             = document.getElementById('combat-log-area')!;
    this.btnSkip             = document.getElementById('btn-combat-skip')!;
    this.btnClose            = document.getElementById('btn-combat-close')!;
    this.resultOverlay       = document.getElementById('combat-result-overlay')!;
    this.resultTitle         = document.getElementById('combat-result-title')!;
    this.resultDesc          = document.getElementById('combat-result-desc')!;
    this.btnResultClose      = document.getElementById('btn-combat-result-close')!;
    this.btnSpeed1x          = document.getElementById('btn-combat-speed-1x')!;
    this.btnSpeed2x          = document.getElementById('btn-combat-speed-2x')!;

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
    this.fallbackPlayerCount = 0;
    this.fallbackEnemyCount = 0;
    
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
    
    let avatarHtml = '<span style="font-size: 1.4em;">👺</span>';
    if (state.isPlayer) {
      if (state.avatarIndex !== undefined) {
        const bgX = (state.avatarIndex % 5) * 25;
        const bgY = Math.floor(state.avatarIndex / 5) * 25;
        const avatarImage = state.gender === 'FEMALE' ? 'assets/avatars_female.jpg' : 'assets/avatars_male.jpg';
        avatarHtml = `<div style="width: 34px; height: 34px; border-radius: 4px; overflow: hidden; border: 1.5px solid rgba(234, 179, 8, 0.7); flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.5); background-image: url('${avatarImage}'); background-size: 500% 500%; background-position: ${bgX}% ${bgY}%;"></div>`;
      } else {
        avatarHtml = '<span style="font-size: 1.4em;">🦸</span>';
      }
    }
    
    let gridColumn = 1;
    let gridRow = 1;

    if (state.isPlayer) {
      if (state.gridR !== undefined && state.gridC !== undefined) {
         gridColumn = 3 - state.gridR; // r=0(Front) -> col=3, r=1(Mid) -> col=2, r=2(Back) -> col=1
         gridRow = state.gridC + 1;    // c=0(Top) -> row=1, c=1(Mid) -> row=2, c=2(Bottom) -> row=3
      } else {
         const fallbackIndex = this.fallbackPlayerCount++;
         gridColumn = state.row === 'FRONT' ? 3 : (state.row === 'MIDDLE' ? 2 : 1);
         gridRow = (fallbackIndex % 3) + 1;
      }
    } else {
      if (state.gridR !== undefined && state.gridC !== undefined) {
         gridColumn = state.gridR + 1; // r=0(Front) -> col=1, r=1(Mid) -> col=2, r=2(Back) -> col=3
         gridRow = state.gridC + 1;
      } else {
         const fallbackIndex = this.fallbackEnemyCount++;
         gridColumn = state.row === 'FRONT' ? 1 : (state.row === 'MIDDLE' ? 2 : 3);
         gridRow = (fallbackIndex % 3) + 1;
      }
    }
    div.style.gridColumn = gridColumn.toString();
    div.style.gridRow = gridRow.toString();

    let rowLabel = '前排';
    if (state.row === 'BACK') rowLabel = '後排';
    else if (state.row === 'MIDDLE') rowLabel = '中排';

    const maxMp = state.maxMp || 100;
    const curMp = state.currentMp !== undefined ? state.currentMp : maxMp;
    const mpPct = Math.max(0, Math.min(100, (curMp / maxMp) * 100));

    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 4px; ${state.isPlayer ? '' : 'flex-direction: row-reverse;'} flex-shrink: 0; min-height: 0;">
        ${avatarHtml}
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 0.55em; line-height: 1.2; font-weight: bold; color: ${state.isPlayer ? '#fbbf24' : '#f87171'}; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${state.name} <span style="font-size: 0.85em; color: #94a3b8; white-space: nowrap;">${rowLabel}</span></div>
        </div>
      </div>
      <div class="combat-hp-bg">
        <div id="hp-fill-${state.id}" class="combat-hp-fill" style="width: 100%;"></div>
      </div>
      <div class="combat-mp-bg">
        <div id="mp-fill-${state.id}" class="combat-mp-fill" style="width: ${mpPct}%;"></div>
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
      if (this.playInterval) {
        clearInterval(this.playInterval);
        this.playInterval = null;
      }
      if (!this.finishTimeout) {
        this.finishTimeout = setTimeout(() => this.finishPlayback(), 800);
      }
      return;
    }
    
    const event = this.currentReport.events[this.eventIndex];
    this.renderEvent(event);
    
    this.eventIndex++;
  }

  private static renderEvent(event: CombatEvent) {
    // 例行每回合恢復，不寫入文字對話框洗版
    if (!event.isQuietRegen) {
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
    }
    
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

    // 更新 MP 能量條與動畫
    if (event.targetMp !== undefined && event.targetId !== undefined && event.targetMaxMp !== undefined) {
      const mpFillEl = document.getElementById(`mp-fill-${event.targetId}`);
      if (mpFillEl) {
        const mpPct = Math.max(0, Math.min(100, (event.targetMp / event.targetMaxMp) * 100));
        mpFillEl.style.width = `${mpPct}%`;
      }
    }

    // 觸發恢復浮動綠字/藍字 (頭頂動態)
    if (event.type === CombatEventType.HEAL && (event.targetId || event.actorId) && event.damage) {
      const targetId = event.targetId || event.actorId;
      const targetEl = document.getElementById(`combat-p-${targetId}`);
      if (targetEl) {
        const isMp = event.healType === 'MP';
        const floatEl = document.createElement('div');
        floatEl.className = 'floating-dmg';
        floatEl.style.color = isMp ? '#38bdf8' : '#4ade80';
        floatEl.style.textShadow = '0 0 5px rgba(0,0,0,0.9)';
        floatEl.style.fontSize = '1.1em';
        floatEl.style.fontWeight = 'bold';
        floatEl.textContent = `+${event.damage} ${isMp ? 'MP' : 'HP'}`;
        targetEl.appendChild(floatEl);
        setTimeout(() => { if (floatEl.parentNode) floatEl.remove(); }, 1000);
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
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = null;
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
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = null;
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
      let lootText = `<div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 10px; font-weight: bold;">`;
      if (this.currentReport.totalEarnedGold) lootText += `<span style="color: #fbbf24;">💰 ${this.currentReport.totalEarnedGold}</span>`;
      if (this.currentReport.totalEarnedExp) lootText += `<span style="color: #38bdf8;">✨ ${this.currentReport.totalEarnedExp}</span>`;
      if (this.currentReport.lootValue && !this.currentReport.totalEarnedGold) lootText += `<span style="color: #fbbf24;">👑 聲望：${this.currentReport.lootValue}</span>`; // fallback
      lootText += `</div>`;
      if (this.currentReport.droppedEquipment && this.currentReport.droppedEquipment.length > 0) {
         lootText += `<div style="margin-top: 5px; color: #a78bfa; font-size: 0.9em;">🗡️ 獲得裝備：${this.currentReport.droppedEquipment.join(', ')}</div>`;
      }

      resultEl.innerHTML = `
        <h3 style="color: #4ade80; margin: 0 0 10px 0; font-size: 1.5em;">✅ 戰鬥勝利！</h3>
        <p style="margin: 0;">${this.currentReport.battleLog}</p>
        ${lootText}
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
