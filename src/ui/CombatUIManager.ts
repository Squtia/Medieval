import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { CombatReport, CombatEvent, CombatEventType, CombatParticipantState } from '../models/Combat';
import { FormationRow, TerrainType, SiegeBattleMode, SiegeRole } from '../models/types';
import { getAvatarSpriteStyle, renderUniversalIcon } from './IconSpriteHelper';
import { InteractiveCombatSession, CommanderOrderType } from '../systems/combat/InteractiveCombatSession';
import { CombatFXEngine, ScreenPoint } from './fx/CombatFXEngine';
import { getSkillVfxId } from '../data/SkillData';
import { VFXImpactConfig } from '../models/VFX';

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
  private static btnSpeed3x: HTMLElement;
  
  // 👑 領主親征光環與軍令 HUD 引用
  private static lordAuraBadge: HTMLElement | null = null;
  private static lordAuraText: HTMLElement | null = null;
  private static commanderHud: HTMLElement | null = null;
  private static cmdShieldCount: HTMLElement | null = null;
  private static cmdArcherCount: HTMLElement | null = null;
  private static cmdCavalryCount: HTMLElement | null = null;
  
  private static currentReport: CombatReport | null = null;
  private static currentSession: InteractiveCombatSession | null = null;
  private static playInterval: number | null = null;
  private static finishTimeout: ReturnType<typeof setTimeout> | null = null;
  private static currentSpeed = 1000; // 1x 預設 1000ms
  private static eventIndex = 0;
  private static currentEventQueue: CombatEvent[] = [];
  private static hpMap: Record<string, number> = {};
  private static fallbackPlayerCount = 0;
  private static fallbackEnemyCount = 0;

  private static isInitialized = false;

  public static ensureInit() {
    if (!this.isInitialized || !this.modal || !this.playerTeamContainer) {
      this.init();
    }
  }

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
    this.btnSpeed3x          = document.getElementById('btn-combat-speed-3x')!;

    // 領主親征 HUD DOM 綁定
    this.lordAuraBadge       = document.getElementById('combat-lord-aura-bar');
    this.lordAuraText        = document.getElementById('combat-lord-aura-text');
    this.commanderHud        = document.getElementById('combat-commander-hud');
    this.cmdShieldCount      = document.getElementById('cmd-shield-count');
    this.cmdArcherCount      = document.getElementById('cmd-archer-count');
    this.cmdCavalryCount     = document.getElementById('cmd-cavalry-count');

    if (!this.isInitialized) {
      this.btnSkip?.addEventListener('click', () => this.skipPlayback());
      this.btnClose?.addEventListener('click', () => this.closeCombat());
      this.btnResultClose?.addEventListener('click', () => this.closeCombat());
      this.btnSpeed1x?.addEventListener('click', () => this.setSpeed(1));
      this.btnSpeed2x?.addEventListener('click', () => this.setSpeed(2));
      this.btnSpeed3x?.addEventListener('click', () => this.setSpeed(3));

      // 👑 領主軍令按鈕手動點擊監聽
      document.getElementById('cmd-btn-shield-wall')?.addEventListener('click', () => this.handleOrderClick('SHIELD_WALL'));
      document.getElementById('cmd-btn-volley-fire')?.addEventListener('click', () => this.handleOrderClick('VOLLEY_FIRE'));
      document.getElementById('cmd-btn-cavalry-charge')?.addEventListener('click', () => this.handleOrderClick('CAVALRY_CHARGE'));
      document.getElementById('cmd-btn-inspire')?.addEventListener('click', () => this.handleOrderClick('INSPIRE'));
      document.getElementById('cmd-btn-pass-turn')?.addEventListener('click', () => this.handleOrderClick('STANDBY'));
      document.getElementById('btn-commander-auto')?.addEventListener('click', () => this.toggleAutoMode());

      if (this.modal) {
        CombatFXEngine.getInstance().mount(this.modal);
      }

      this.isInitialized = true;
    }
  }

  // 親征回合制指揮循環狀態
  private static isAutoMode = false;
  private static isWaitingForCommanderOrder = false;

  private static toggleAutoMode() {
    this.isAutoMode = !this.isAutoMode;
    const btnAuto = document.getElementById('btn-commander-auto');
    if (btnAuto) {
      if (this.isAutoMode) {
        btnAuto.style.background = '#10b981';
        btnAuto.style.color = '#fff';
        btnAuto.textContent = '🤖 自動戰鬥 (ON)';
      } else {
        btnAuto.style.background = '#334155';
        btnAuto.style.color = '#cbd5e1';
        btnAuto.textContent = '🤖 自動戰鬥';
      }
    }
    if (this.isAutoMode && this.isWaitingForCommanderOrder) {
      this.autoPickOrder();
    }
  }

  private static autoPickOrder() {
    if (!this.currentSession || !this.isWaitingForCommanderOrder) return;
    const cds = this.currentSession.tacticCds;
    const troops = this.currentSession.assignedTroops;

    if (troops.archer > 0 && cds.VOLLEY_FIRE <= 0) {
      this.handleOrderClick('VOLLEY_FIRE');
    } else if (troops.cavalry > 0 && cds.CAVALRY_CHARGE <= 0) {
      this.handleOrderClick('CAVALRY_CHARGE');
    } else if (troops.infantry > 0 && cds.SHIELD_WALL <= 0) {
      this.handleOrderClick('SHIELD_WALL');
    } else if (cds.INSPIRE <= 0) {
      this.handleOrderClick('INSPIRE');
    } else {
      this.handleOrderClick('STANDBY');
    }
  }

  private static handleOrderClick(order: CommanderOrderType) {
    if (!this.currentSession) {
      // 若為純重播回放模式，忽略點擊
      return;
    }
    if (!this.isWaitingForCommanderOrder) return;

    // 檢查該技能是否處於 CD 或兵力不足 (嚴格阻斷，防誤觸空過回合)
    const cds = this.currentSession.tacticCds || { SHIELD_WALL: 0, VOLLEY_FIRE: 0, CAVALRY_CHARGE: 0, INSPIRE: 0 };
    const troops = this.currentSession.assignedTroops || { infantry: 0, archer: 0, cavalry: 0 };

    if (order === 'SHIELD_WALL') {
      if (cds.SHIELD_WALL > 0) {
        import('./ToastManager').then(({ ToastManager }) => ToastManager.show(`⚠️ 【鋼鐵盾牆】冷卻中（剩餘 ${cds.SHIELD_WALL} 回合）！`));
        return;
      }
      if ((troops.infantry || 0) <= 0) {
        import('./ToastManager').then(({ ToastManager }) => ToastManager.show('⚠️ 步兵兵力不足，無法展開盾牆！'));
        return;
      }
    } else if (order === 'VOLLEY_FIRE') {
      if (cds.VOLLEY_FIRE > 0) {
        import('./ToastManager').then(({ ToastManager }) => ToastManager.show(`⚠️ 【漫天箭雨】冷卻中（剩餘 ${cds.VOLLEY_FIRE} 回合）！`));
        return;
      }
      if ((troops.archer || 0) <= 0) {
        import('./ToastManager').then(({ ToastManager }) => ToastManager.show('⚠️ 弓兵兵力不足，無法發動齊射！'));
        return;
      }
    } else if (order === 'CAVALRY_CHARGE') {
      if (cds.CAVALRY_CHARGE > 0) {
        import('./ToastManager').then(({ ToastManager }) => ToastManager.show(`⚠️ 【破陣衝鋒】冷卻中（剩餘 ${cds.CAVALRY_CHARGE} 回合）！`));
        return;
      }
      if ((troops.cavalry || 0) <= 0) {
        import('./ToastManager').then(({ ToastManager }) => ToastManager.show('⚠️ 騎兵兵力不足，無法發動衝鋒！'));
        return;
      }
    } else if (order === 'INSPIRE') {
      if (cds.INSPIRE > 0) {
        import('./ToastManager').then(({ ToastManager }) => ToastManager.show(`⚠️ 【全軍鼓舞】冷卻中（剩餘 ${cds.INSPIRE} 回合）！`));
        return;
      }
    }

    // 🔒 立即反灰鎖定指揮列按鈕，嚴禁中途干涉
    this.isWaitingForCommanderOrder = false;
    this.disableTacticButtons();

    // 實時演算本回合戰鬥
    const turnEvents = this.currentSession.stepTurn(order);
    this.currentEventQueue = turnEvents;
    this.eventIndex = 0;

    this.playTurnQueue();
  }

  private static disableTacticButtons() {
    ['cmd-btn-shield-wall', 'cmd-btn-volley-fire', 'cmd-btn-cavalry-charge', 'cmd-btn-inspire', 'cmd-btn-pass-turn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.opacity = '0.35';
        el.style.cursor = 'not-allowed';
      }
    });
  }

  private static isSkipped = false;
  private static isPlayingLoop = false;

  private static async playTurnQueue() {
    if (this.isPlayingLoop) return;
    this.isPlayingLoop = true;
    this.isSkipped = false;

    while (this.isPlayingLoop && this.eventIndex < this.currentEventQueue.length) {
      if (this.isSkipped) {
        while (this.eventIndex < this.currentEventQueue.length) {
          this.renderEvent(this.currentEventQueue[this.eventIndex], true);
          this.eventIndex++;
        }
        break;
      }
      const event = this.currentEventQueue[this.eventIndex];
      await this.renderEventAsync(event);
      this.eventIndex++;
    }

    this.isPlayingLoop = false;
    if (this.currentSession) {
      this.onTurnQueueFinished();
    } else {
      this.finishPlayback();
    }
  }

  private static onTurnQueueFinished() {
    if (!this.currentSession) return;

    if (this.currentSession.isFinished) {
      const finalReport = this.currentSession.generateFinalReport();
      this.currentReport = finalReport;
      this.finishPlayback();
    } else {
      // 戰鬥未結束 ➔ 更新 CD，解鎖指揮列，等待下回合
      this.updateTacticButtonsUI();
      this.isWaitingForCommanderOrder = true;

      if (this.isAutoMode) {
        setTimeout(() => this.autoPickOrder(), Math.max(200, this.currentSpeed / 2));
      }
    }
  }

  private static updateTacticButtonsUI() {
    const btnShield = document.getElementById('cmd-btn-shield-wall');
    const btnArcher = document.getElementById('cmd-btn-volley-fire');
    const btnCav = document.getElementById('cmd-btn-cavalry-charge');
    const btnInspire = document.getElementById('cmd-btn-inspire');
    const btnPass = document.getElementById('cmd-btn-pass-turn');

    const cds = this.currentSession?.tacticCds || { SHIELD_WALL: 0, VOLLEY_FIRE: 0, CAVALRY_CHARGE: 0, INSPIRE: 0 };
    const troops = this.currentSession?.assignedTroops || { infantry: 0, archer: 0, cavalry: 0 };

    if (btnShield) {
      const isAvailable = (troops.infantry || 0) > 0 && cds.SHIELD_WALL <= 0;
      btnShield.style.opacity = isAvailable ? '1' : '0.45';
      btnShield.style.cursor = isAvailable ? 'pointer' : 'not-allowed';
      if (this.cmdShieldCount) {
        this.cmdShieldCount.textContent = cds.SHIELD_WALL > 0 ? `(CD: ${cds.SHIELD_WALL})` : `(${troops.infantry || 0}人)`;
      }
    }
    if (btnArcher) {
      const isAvailable = (troops.archer || 0) > 0 && cds.VOLLEY_FIRE <= 0;
      btnArcher.style.opacity = isAvailable ? '1' : '0.45';
      btnArcher.style.cursor = isAvailable ? 'pointer' : 'not-allowed';
      if (this.cmdArcherCount) {
        this.cmdArcherCount.textContent = cds.VOLLEY_FIRE > 0 ? `(CD: ${cds.VOLLEY_FIRE})` : `(${troops.archer || 0}人)`;
      }
    }
    if (btnCav) {
      const isAvailable = (troops.cavalry || 0) > 0 && cds.CAVALRY_CHARGE <= 0;
      btnCav.style.opacity = isAvailable ? '1' : '0.45';
      btnCav.style.cursor = isAvailable ? 'pointer' : 'not-allowed';
      if (this.cmdCavalryCount) {
        this.cmdCavalryCount.textContent = cds.CAVALRY_CHARGE > 0 ? `(CD: ${cds.CAVALRY_CHARGE})` : `(${troops.cavalry || 0}人)`;
      }
    }
    if (btnInspire) {
      const isAvailable = cds.INSPIRE <= 0;
      btnInspire.style.opacity = isAvailable ? '1' : '0.45';
      btnInspire.style.cursor = isAvailable ? 'pointer' : 'not-allowed';
      const countEl = document.getElementById('cmd-inspire-count');
      if (countEl) {
        countEl.textContent = cds.INSPIRE > 0 ? `(CD: ${cds.INSPIRE})` : '(領主)';
      }
    }
    if (btnPass) {
      btnPass.style.opacity = '1';
      btnPass.style.cursor = 'pointer';
    }
  }


  private static onCloseCallback: (() => void) | null = null;

  /**
   * 👑 軌道 B：啟動領主親征實時戰鬥 (Interactive Turn-by-Turn Mode)
   */
  public static startInteractiveCombat(session: InteractiveCombatSession, onClose?: (report: CombatReport) => void) {
    this.ensureInit();
    this.currentSession = session;
    this.currentReport = null;
    this.onCloseCallback = () => {
      if (onClose) onClose(session.generateFinalReport());
    };

    this.eventIndex = 0;
    this.currentEventQueue = [];
    this.hpMap = {};
    this.fallbackPlayerCount = 0;
    this.fallbackEnemyCount = 0;

    if (this.modal) this.modal.classList.add('active');
    if (this.resultOverlay) this.resultOverlay.classList.remove('active');
    if (this.btnSkip) this.btnSkip.style.display = 'none'; // 👑 領主親征模式隱藏「瞬間完成」按鈕！
    if (this.btnClose) this.btnClose.style.display = 'none';
    if (this.logArea) this.logArea.innerHTML = '';
    if (this.playerTeamContainer) this.playerTeamContainer.innerHTML = '';
    if (this.enemyTeamContainer) this.enemyTeamContainer.innerHTML = '';

    // 光環與軍令 HUD 渲染
    if (this.lordAuraBadge) {
      this.lordAuraBadge.style.display = 'flex';
      if (this.lordAuraText) {
        this.lordAuraText.textContent = session.lordAura ? `${session.lordAura.name} (${session.lordAura.description})` : '【領主威嚴】全軍士氣高昂 (+10% 攻防)';
      }
    }
    if (this.commanderHud) {
      this.commanderHud.style.display = 'flex';
      const troops = session.assignedTroops;
      if (this.cmdShieldCount) this.cmdShieldCount.textContent = `(${troops.infantry}人)`;
      if (this.cmdArcherCount) this.cmdArcherCount.textContent = `(${troops.archer}人)`;
      if (this.cmdCavalryCount) this.cmdCavalryCount.textContent = `(${troops.cavalry}人)`;
      this.updateTacticButtonsUI();
    }

    // 依據守城/野外設定戰鬥舞台背景與城門 HUD
    const isSiege = session.siegeOptions?.isSiege ?? false;
    this.setupStageEnvironment(
      isSiege,
      session.terrain,
      session.gateMaxHp,
      session.gateRemainingHp
    );

    // 繪製初始雙方卡片 (精準繼承當前剩餘 HP)
    session.playerTeam.forEach(p => {
      this.hpMap[p.id] = p.currentHp !== undefined ? p.currentHp : p.maxHp;
      this.createHpBar(p);
    });
    session.enemyTeam.forEach(e => {
      this.hpMap[e.id] = e.currentHp !== undefined ? e.currentHp : e.maxHp;
      this.createHpBar(e);
    });

    // 播放開局事件流（在下一幀確保 canvas resize 完成後才啟動）
    const initEvents = session.getInitialEvents();
    this.currentEventQueue = initEvents;
    this.eventIndex = 0;

    requestAnimationFrame(() => {
      CombatFXEngine.getInstance().resize();
      this.playTurnQueue();
    });
  }

  public static getCurrentBattleMode(): SiegeBattleMode {
    if (this.currentReport?.battleMode) return this.currentReport.battleMode;
    if (this.currentSession?.battleMode) return this.currentSession.battleMode;
    if (this.currentReport?.isOffensiveSiege || this.currentSession?.isOffensiveSiege) return SiegeBattleMode.OFFENSIVE_SIEGE;
    if (this.currentReport?.isDefenseSiege || this.currentSession?.siegeOptions?.isSiege) return SiegeBattleMode.DEFENSE_SIEGE;
    return SiegeBattleMode.NONE;
  }

  public static getPlayerRole(): SiegeRole {
    if (this.currentReport?.playerRole) return this.currentReport.playerRole;
    if (this.currentSession?.playerRole) return this.currentSession.playerRole;
    const mode = this.getCurrentBattleMode();
    return mode === SiegeBattleMode.DEFENSE_SIEGE ? SiegeRole.DEFENDER : SiegeRole.ATTACKER;
  }

  private static isCurrentDefenseSiege(): boolean {
    return this.getCurrentBattleMode() === SiegeBattleMode.DEFENSE_SIEGE;
  }

  private static setupStageEnvironment(
    isDefenseSiege: boolean,
    terrain?: TerrainType,
    gateMaxHp?: number,
    gateRemainingHp?: number
  ) {
    const stage = document.getElementById('combat-stage');
    if (!stage) return;

    const battleMode = this.getCurrentBattleMode();
    const isSiegeActive = battleMode === SiegeBattleMode.DEFENSE_SIEGE || battleMode === SiegeBattleMode.OFFENSIVE_SIEGE;

    if (battleMode === SiegeBattleMode.DEFENSE_SIEGE) {
      stage.classList.add('is-defense-siege');
    } else {
      stage.classList.remove('is-defense-siege');
    }

    if (terrain) {
      if (terrain === TerrainType.DESERT) stage.style.background = 'linear-gradient(to bottom, #78350f, #451a03)';
      else if (terrain === TerrainType.FOREST) stage.style.background = 'linear-gradient(to bottom, #14532d, #064e3b)';
      else if (terrain === TerrainType.SNOW_MOUNTAIN) stage.style.background = 'linear-gradient(to bottom, #e0f2fe, #38bdf8)';
      else if (terrain === TerrainType.VOLCANO) stage.style.background = 'linear-gradient(to bottom, #7f1d1d, #450a0a)';
      else stage.style.background = isSiegeActive ? 'linear-gradient(to bottom, #2a1b12, #110d0a)' : 'linear-gradient(to bottom, #1e293b, #0f172a)';
    } else {
      stage.style.background = isSiegeActive ? 'linear-gradient(to bottom, #2a1b12, #110d0a)' : 'linear-gradient(to bottom, #1e293b, #0f172a)';
    }

    // 攻守戰役：中央實體要塞城牆與城門屏障顯示控制
    const wallDivider = document.getElementById('combat-siege-wall-divider');
    if (wallDivider) {
      wallDivider.style.display = isSiegeActive ? 'flex' : 'none';
      wallDivider.classList.remove('wall-hit');
    }

    // 正中底部城門耐久度 HUD (位於中央城門底部)
    const gateHud = document.getElementById('combat-siege-gate-hud');
    if (gateHud) {
      if (isSiegeActive && gateMaxHp) {
        gateHud.style.display = 'flex';
        const currentHp = gateRemainingHp !== undefined ? gateRemainingHp : gateMaxHp;
        const hpPct = Math.max(0, Math.min(100, (currentHp / gateMaxHp) * 100));
        const txtEl = document.getElementById('siege-gate-hp-display');
        const barEl = document.getElementById('siege-gate-hp-bar');
        const titleEl = document.getElementById('siege-gate-title');
        if (titleEl) {
          titleEl.textContent = battleMode === SiegeBattleMode.OFFENSIVE_SIEGE ? '🏰 敵方要塞城門' : '🛡️ 主城防衛城門';
        }
        if (txtEl) txtEl.textContent = `${currentHp} / ${gateMaxHp}`;
        if (barEl) barEl.style.width = `${hpPct}%`;
      } else {
        gateHud.style.display = 'none';
      }
    }
  }

  /**
   * 🛡️ 軌道 A：常規派遣 / 討伐 / 跑商戰鬥重播 (Replay Static Report Mode)
   */
  public static replayCombat(report: CombatReport, onClose?: () => void) {
    this.ensureInit();
    this.currentSession = null;
    this.onCloseCallback = onClose || null;
    this.showCombat(report);
  }

  private static setSpeed(multiplier: number) {
    this.currentSpeed = multiplier === 1 ? 1000 : (multiplier === 2 ? 450 : 180);
    
    [this.btnSpeed1x, this.btnSpeed2x, this.btnSpeed3x].forEach((btn, idx) => {
      if (!btn) return;
      if (idx + 1 === multiplier) {
        btn.classList.add('active');
        btn.style.borderColor = '#eab308';
        btn.style.color = '#eab308';
      } else {
        btn.classList.remove('active');
        btn.style.borderColor = '#64748b';
        btn.style.color = '#64748b';
      }
    });

    // 速度變更已寫入 this.currentSpeed，非同步播放循環在下個斷點將自動感知新速度
  }

  private static showCombat(report: CombatReport) {
    this.ensureInit();
    this.currentReport = report;
    this.eventIndex = 0;
    this.hpMap = {};
    this.fallbackPlayerCount = 0;
    this.fallbackEnemyCount = 0;
    
    if (this.modal) this.modal.classList.add('active');
    if (this.resultOverlay) this.resultOverlay.classList.remove('active');
    if (this.btnSkip) this.btnSkip.style.display = 'block';
    if (this.btnClose) this.btnClose.style.display = 'none';
    if (this.logArea) this.logArea.innerHTML = '';
    if (this.playerTeamContainer) this.playerTeamContainer.innerHTML = '';
    if (this.enemyTeamContainer) this.enemyTeamContainer.innerHTML = '';
    
    // 👑 領主親征光環與軍令 HUD 渲染
    if (report.isLordCampaign || report.lordAura) {
      if (this.lordAuraBadge) {
        this.lordAuraBadge.style.display = 'flex';
        if (this.lordAuraText) {
          this.lordAuraText.textContent = report.lordAura ? `${report.lordAura.name} (${report.lordAura.description})` : '【領主威嚴】全軍士氣高昂 (+10% 攻防)';
        }
      }
      if (this.commanderHud) {
        this.commanderHud.style.display = 'flex';
        const troops = report.commanderTroops || { infantry: 0, archer: 0, cavalry: 0 };
        if (this.cmdShieldCount) this.cmdShieldCount.textContent = `(${troops.infantry || 0}人)`;
        if (this.cmdArcherCount) this.cmdArcherCount.textContent = `(${troops.archer || 0}人)`;
        if (this.cmdCavalryCount) this.cmdCavalryCount.textContent = `(${troops.cavalry || 0}人)`;
        this.updateTacticButtonsUI();
      }
    } else {
      if (this.lordAuraBadge) this.lordAuraBadge.style.display = 'none';
      if (this.commanderHud) this.commanderHud.style.display = 'none';
    }

    // 依據地形設定戰鬥舞台背景與城門 HUD
    this.setupStageEnvironment(
      report.isDefenseSiege ?? false,
      report.terrain,
      report.gateMaxHp,
      report.gateRemainingHp
    );
    
    // 初始化血條 (只初始化我方，敵方由 WAVE_START 處理)
    if (report.initialStates && Array.isArray(report.initialStates)) {
      report.initialStates.forEach(state => {
        this.hpMap[state.id] = state.maxHp;
        this.createHpBar(state);
      });
    }
    
    // 開始非同步打擊感播放隊列（在下一幀確保 canvas resize 完成後才啟動）
    this.currentEventQueue = report.events;
    requestAnimationFrame(() => {
      CombatFXEngine.getInstance().resize();
      this.playTurnQueue();
    });
  }
  
  // ── 建立單位戰鬥卡片（Full-Art 滿版卡牌式）──
  private static createHpBar(state: CombatParticipantState) {
    if (!state) return;
    const div = document.createElement('div');
    div.className = `combat-participant ${state.isPlayer ? 'player-side' : 'enemy-side'}`;
    div.id = `combat-p-${state.id}`;
    
    let avatarHtml = '';
    if (state.isPlayer) {
      if (state.avatarIndex !== undefined || (state as any).avatarIcon) {
        const avatarStyle = getAvatarSpriteStyle((state.gender as any) || 'MALE', state.avatarIndex ?? 0, state.isGuardian, (state as any).avatarIcon);
        avatarHtml = `<div class="combat-p-avatar-sq" style="background-image: ${avatarStyle.backgroundImage}; background-size: ${avatarStyle.backgroundSize}; background-position: ${avatarStyle.backgroundPosition};"></div>`;
      } else {
        avatarHtml = '<span style="font-size: 2.5rem;">🦸</span>';
      }
    } else {
      // 敵方怪物肖像：大尺寸渲染 8x8 寫實精靈圖
      const iconKey = state.avatarIcon || 'icons_monsters:goblin';
      avatarHtml = renderUniversalIcon(iconKey, 84);
    }
    
    let gridColumn = 1;
    let gridRow = 1;
    const playerRole = this.getPlayerRole();
    // 依據棋盤規則判定此卡片所屬單位是否在戰場左側 (進攻席位)
    const isLeftTeam = (state.isPlayer && playerRole === SiegeRole.ATTACKER) || (!state.isPlayer && playerRole === SiegeRole.DEFENDER);

    if (isLeftTeam) {
      // 🚩 左側進攻席位：面向右側推進，前排靠右 (X=3)，後排靠左 (X=1)
      if (state.gridR !== undefined && state.gridC !== undefined) {
        gridColumn = 3 - state.gridR;
        gridRow = state.gridC + 1;
      } else {
        const fallbackIndex = state.isPlayer ? this.fallbackPlayerCount++ : this.fallbackEnemyCount++;
        gridColumn = state.row === 'FRONT' ? 3 : (state.row === 'MIDDLE' ? 2 : 1);
        gridRow = (fallbackIndex % 3) + 1;
      }
    } else {
      // 🛡️ 右側防守席位：面向左側迎敵，前排靠左 (X=1)，後排靠右 (X=3)
      if (state.gridR !== undefined && state.gridC !== undefined) {
        gridColumn = state.gridR + 1;
        gridRow = state.gridC + 1;
      } else {
        const fallbackIndex = state.isPlayer ? this.fallbackPlayerCount++ : this.fallbackEnemyCount++;
        gridColumn = state.row === 'FRONT' ? 1 : (state.row === 'MIDDLE' ? 2 : 3);
        gridRow = (fallbackIndex % 3) + 1;
      }
    }
    div.style.gridColumn = gridColumn.toString();
    div.style.gridRow = gridRow.toString();

    let rowLabel = '前';
    if (state.row === 'BACK') rowLabel = '後';
    else if (state.row === 'MIDDLE') rowLabel = '中';

    const maxHp = state.maxHp || 100;
    const curHp = state.currentHp !== undefined ? state.currentHp : (this.hpMap[state.id] !== undefined ? this.hpMap[state.id] : maxHp);
    const hpPct = Math.max(0, Math.min(100, (curHp / maxHp) * 100));

    const maxMp = state.maxMp || 100;
    const curMp = state.currentMp !== undefined ? state.currentMp : maxMp;
    const mpPct = Math.max(0, Math.min(100, (curMp / maxMp) * 100));

    div.innerHTML = `
      <!-- 滿版背景肖像 (取消內層小框) -->
      <div class="combat-p-avatar-bg">
        ${avatarHtml}
      </div>

      <!-- 頂部懸浮名稱與站位標籤 -->
      <div class="combat-p-top-bar">
        <span class="combat-p-name-text" style="color: ${state.isPlayer ? '#fde047' : '#fca5a5'};">${state.name}</span>
        <span class="combat-p-row-tag">${rowLabel}</span>
      </div>

      <!-- 底部懸浮血條與魔力條 (內嵌即時數值) -->
      <div class="combat-p-bottom-bar">
        <div class="combat-hp-bg">
          <div id="hp-fill-${state.id}" class="combat-hp-fill ${hpPct < 30 ? 'low' : ''}" style="width: ${hpPct}%;"></div>
          <span id="hp-txt-${state.id}" class="combat-hp-text">${curHp}/${maxHp}</span>
        </div>
        <div class="combat-mp-bg">
          <div id="mp-fill-${state.id}" class="combat-mp-fill" style="width: ${mpPct}%;"></div>
          <span id="mp-txt-${state.id}" class="combat-mp-text">${curMp}/${maxMp}</span>
        </div>
      </div>
    `;
    
    if (state.isPlayer) {
      if (this.playerTeamContainer) this.playerTeamContainer.appendChild(div);
    } else {
      if (this.enemyTeamContainer) this.enemyTeamContainer.appendChild(div);
    }
  }

  private static async renderEventAsync(event: CombatEvent): Promise<void> {
    this.renderLogAndStage(event);

    // 🛡️ 被前置 SKILL_CAST 動畫吸收的多段傷害事件，不再做卡片撞擊與重複播放
    if ((event as any).absorbedBySkillCast) {
      const absorbDelay = this.currentSpeed <= 250 ? 20 : (this.currentSpeed <= 550 ? 40 : 80);
      await new Promise(r => setTimeout(r, absorbDelay));
      return;
    }

    const isHitOrSkill = (
      event.type === CombatEventType.HIT ||
      event.type === CombatEventType.CRIT ||
      event.type === CombatEventType.SKILL_CAST ||
      event.type === CombatEventType.STATUS_DAMAGE ||
      event.type === CombatEventType.CAVALRY_CHARGE ||
      event.type === CombatEventType.CAVALRY_BREACH_CHARGE ||
      event.type === CombatEventType.TREBUCHET_ATTACK ||
      event.type === CombatEventType.BATTERING_RAM_ATTACK ||
      event.type === CombatEventType.WATCHTOWER_ATTACK ||
      event.type === CombatEventType.SIEGE_GATE_DAMAGE ||
      event.type === CombatEventType.SIEGE_GATE_BREAK
    );

    if (isHitOrSkill && this.modal) {
      const actorEl = event.actorId ? document.getElementById(`combat-p-${event.actorId}`) : null;

      // 🎯 SKILL_CAST 使用 skillTargetId 找到技能受術目標元素；其他事件使用 targetId
      const fxTargetId = event.type === CombatEventType.SKILL_CAST
        ? (event.skillTargetId || event.targetId)
        : event.targetId;
      let targetEl = fxTargetId ? document.getElementById(`combat-p-${fxTargetId}`) : null;

      // 攻城戰打擊城門目標 fallback
      if (!targetEl && (event.type === CombatEventType.SIEGE_GATE_DAMAGE || event.type === CombatEventType.SIEGE_GATE_BREAK || event.gateRemainingHp !== undefined)) {
        targetEl = document.getElementById('combat-siege-gate-hud');
      }

      // 🎯 施術者卡片單次攻擊突進撞擊（整個技能僅撞一次）
      if (actorEl) {
        actorEl.classList.add('skill-cast-glow');
        const isPlayer = actorEl.classList.contains('player-side') || !!this.currentReport?.initialStates.find(s => s.id === event.actorId)?.isPlayer;
        const bumpClass = isPlayer ? 'attack-bump-player' : 'attack-bump-enemy';
        actorEl.classList.remove(bumpClass);
        void actorEl.offsetWidth;
        actorEl.classList.add(bumpClass);
        setTimeout(() => {
          actorEl.classList.remove('skill-cast-glow');
          actorEl.classList.remove(bumpClass);
        }, 280);
      }

      // 🔄 若為技能施放事件：往後預先提取歸屬於本次施法的傷害數據（避免後續重複撞擊）
      let harvestedDamage = (event.damage || 0);
      let finalTargetHp = event.targetHp;
      let finalTargetMaxHp = event.targetMaxHp;
      let isCrit = event.type === CombatEventType.CRIT;

      if (event.type === CombatEventType.SKILL_CAST) {
        for (let k = this.eventIndex + 1; k < this.currentEventQueue.length; k++) {
          const followEv = this.currentEventQueue[k];
          if ((followEv.type === CombatEventType.HIT || followEv.type === CombatEventType.CRIT) && followEv.actorId === event.actorId) {
            (followEv as any).absorbedBySkillCast = true;
            harvestedDamage += (followEv.damage || 0);
            if (followEv.targetHp !== undefined) finalTargetHp = followEv.targetHp;
            if (followEv.targetMaxHp !== undefined) finalTargetMaxHp = followEv.targetMaxHp;
            if (followEv.type === CombatEventType.CRIT) isCrit = true;
          } else if (followEv.type === CombatEventType.SKILL_CAST || followEv.type === CombatEventType.DEATH || followEv.type === CombatEventType.TURN_START) {
            break;
          }
        }
      }

      if (targetEl) {
        // === 全功能特效路徑 ===
        const mRect = this.modal.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();

        let fromPt: ScreenPoint;
        if (actorEl) {
          const aRect = actorEl.getBoundingClientRect();
          fromPt = {
            x: (aRect.left + aRect.right) / 2 - mRect.left,
            y: (aRect.top + aRect.bottom) / 2 - mRect.top
          };
        } else {
          // 器械/軍令/箭塔預設發射點
          if (event.type === CombatEventType.TREBUCHET_ATTACK) {
            fromPt = { x: mRect.width * 0.2, y: -40 };
          } else if (event.type === CombatEventType.WATCHTOWER_ATTACK) {
            fromPt = { x: 30, y: 30 };
          } else {
            fromPt = { x: mRect.width * 0.25, y: mRect.height * 0.5 };
          }
        }

        const toPt: ScreenPoint = {
          x: (tRect.left + tRect.right) / 2 - mRect.left,
          y: (tRect.top + tRect.bottom) / 2 - mRect.top
        };

        // 決定 VFX ID
        let vfxId = event.vfxId;
        if (!vfxId) {
          if (event.type === CombatEventType.CAVALRY_CHARGE || event.type === CombatEventType.CAVALRY_BREACH_CHARGE) {
            vfxId = 'VFX_CAVALRY_CHARGE';
          } else if (event.type === CombatEventType.TREBUCHET_ATTACK) {
            vfxId = 'VFX_TREBUCHET_BOULDER';
          } else if (event.type === CombatEventType.BATTERING_RAM_ATTACK || event.type === CombatEventType.SIEGE_GATE_DAMAGE || event.type === CombatEventType.SIEGE_GATE_BREAK) {
            vfxId = 'VFX_BATTERING_RAM';
          } else if (event.type === CombatEventType.WATCHTOWER_ATTACK) {
            vfxId = 'VFX_WATCHTOWER_VOLLEY';
          } else {
            vfxId = getSkillVfxId(event.skillId || event.skillName);
          }
        }

        // 🥊 執行 3D 特效飛行，並在特效命中的每個 HIT 斷點觸發多段打擊感與分段跳字！
        await CombatFXEngine.getInstance().playPreset(vfxId, fromPt, toPt, (impact: VFXImpactConfig, hitIdx: number, totalHits: number) => {
          if (targetEl) {
            const isTargetEnemy = targetEl.classList.contains('enemy-side');
            const knockDir = isTargetEnemy ? 1 : -1;
            const isLastHit = (hitIdx >= totalHits - 1);

            // 前段輕微顫動，尾段重擊破甲
            const knockDist = isLastHit ? ((impact.knockbackDistance || 0) * knockDir) : 0;
            const shakeX = isLastHit ? (impact.shakeIntensity || 12) : Math.max(4, Math.round((impact.shakeIntensity || 12) * 0.45));
            const shakeY = Math.round(shakeX * 0.35);
            const shakeDur = isLastHit ? (impact.shakeDuration || 0.28) : 0.16;
            const punchScale = isLastHit ? (impact.targetPunchScale || 0.88) : 0.95;

            targetEl.style.setProperty('--punch-scale', punchScale.toString());
            targetEl.style.setProperty('--shake-x', `${shakeX}px`);
            targetEl.style.setProperty('--shake-y', `${shakeY}px`);
            targetEl.style.setProperty('--shake-dur', `${shakeDur}s`);
            targetEl.style.setProperty('--flash-color', impact.hitFlashColor || '#ffffff');
            targetEl.style.setProperty('--knockback-x', `${knockDist}px`);

            targetEl.classList.remove('target-hit');
            void targetEl.offsetWidth;
            targetEl.classList.add('target-hit');

            setTimeout(() => {
              targetEl.classList.remove('target-hit');
            }, shakeDur * 1000);

            // 🎯 特效出現多少次 HIT 就跳多少次數字傷害 (技能設定的傷害 / 特效 HIT 次數)
            if (harvestedDamage > 0) {
              const baseDmg = Math.floor(harvestedDamage / totalHits);
              const thisHitDmg = isLastHit ? (harvestedDamage - baseDmg * (totalHits - 1)) : baseDmg;

              if (thisHitDmg > 0) {
                const dmgEl = document.createElement('div');
                dmgEl.className = `floating-dmg ${(isCrit && isLastHit) ? 'crit' : ''}`;
                dmgEl.textContent = `${(isCrit && isLastHit) ? '💥 ' : ''}-${thisHitDmg}`;
                targetEl.appendChild(dmgEl);
                setTimeout(() => { if (dmgEl.parentNode) dmgEl.remove(); }, 800);
              }
            }

            // 最後一段命中時，結算血條扣減與終結全螢幕震動！
            if (isLastHit) {
              if (finalTargetHp !== undefined && fxTargetId && finalTargetMaxHp !== undefined) {
                this.hpMap[fxTargetId] = finalTargetHp;
                const fillEl = document.getElementById(`hp-fill-${fxTargetId}`);
                if (fillEl) {
                  const pct = Math.max(0, (finalTargetHp / finalTargetMaxHp) * 100);
                  fillEl.style.width = `${pct}%`;
                  if (pct < 30) fillEl.classList.add('low');
                  else fillEl.classList.remove('low');
                }
                const txtEl = document.getElementById(`hp-txt-${fxTargetId}`);
                if (txtEl) {
                  txtEl.textContent = `${Math.max(0, finalTargetHp)}/${finalTargetMaxHp}`;
                }
                if (finalTargetHp <= 0) {
                  targetEl.classList.add('is-dead');
                }
              }

              if (impact.screenShake && this.modal) {
                this.modal.classList.add('shake');
                setTimeout(() => this.modal.classList.remove('shake'), 350);
              }
            }
          }
        });

        // 收招等待時間
        const postHitDelay = this.currentSpeed <= 250 ? 60 : (this.currentSpeed <= 550 ? 120 : 200);
        await new Promise(r => setTimeout(r, postHitDelay));
        return;
      }
    }

    // 若非目標打擊或找不到 DOM，執行常規結算
    this.applyDamageAndFloatingNumbers(event);
    const nonHitDelay = this.currentSpeed <= 250 ? 80 : (this.currentSpeed <= 550 ? 180 : 300);
    await new Promise(r => setTimeout(r, nonHitDelay));
  }

  private static renderEvent(event: CombatEvent, instant = false) {
    this.renderLogAndStage(event);
    this.applyDamageAndFloatingNumbers(event);
  }

  private static renderLogAndStage(event: CombatEvent) {
    if (!event.isQuietRegen) {
      const logEl = document.createElement('div');
      logEl.className = 'combat-log-entry';
      logEl.textContent = event.text;

      if (event.type === CombatEventType.WAVE_START) {
        logEl.style.color = '#eab308';
        logEl.style.fontWeight = 'bold';
        logEl.style.textAlign = 'center';
        logEl.style.margin = '12px 0';

        this.enemyTeamContainer.innerHTML = '';
        this.fallbackEnemyCount = 0;
        if (event.enemies) {
          event.enemies.forEach(e => {
            this.hpMap[e.id] = e.currentHp !== undefined ? e.currentHp : e.maxHp;
            this.createHpBar(e);
          });
        }
      } else if (event.type === CombatEventType.CRIT) {
        logEl.classList.add('log-crit');
        this.modal.classList.add('shake');
        setTimeout(() => this.modal.classList.remove('shake'), 350);
      } else if (event.type === CombatEventType.MISS) {
        logEl.classList.add('log-miss');
      } else if (event.type === CombatEventType.STATUS_APPLY) {
        logEl.classList.add('log-status');
      } else if (event.type === CombatEventType.DEATH) {
        logEl.classList.add('log-death');
      } else if (event.type === CombatEventType.SIEGE_GATE_DAMAGE || event.type === CombatEventType.SIEGE_GATE_BREAK) {
        logEl.style.color = '#f97316';
        logEl.style.fontWeight = 'bold';
        const maxHp = this.currentSession?.gateMaxHp || this.currentReport?.gateMaxHp || 5000;
        if (event.gateRemainingHp !== undefined && maxHp > 0) {
          const curHp = Math.max(0, event.gateRemainingHp);
          const barEl = document.getElementById('siege-gate-hp-bar');
          const txtEl = document.getElementById('siege-gate-hp-display');
          if (barEl) barEl.style.width = `${Math.max(0, Math.min(100, (curHp / maxHp) * 100))}%`;
          if (txtEl) txtEl.textContent = `${curHp} / ${maxHp}`;
        }
        const gateHud = document.getElementById('combat-siege-gate-hud');
        if (gateHud) {
          gateHud.classList.add('hit-shake', 'hit-flash');
          setTimeout(() => gateHud.classList.remove('hit-shake', 'hit-flash'), 300);
        }
      } else if (event.type === CombatEventType.TURN_START) {
        logEl.style.color = '#38bdf8';
        logEl.style.fontWeight = 'bold';
        logEl.style.textAlign = 'center';
        logEl.style.margin = '10px 0 6px 0';
        logEl.style.borderBottom = '1px dashed rgba(56, 189, 248, 0.4)';
      } else if (event.type === CombatEventType.TURN_END) {
        logEl.style.color = '#64748b';
        logEl.style.fontSize = '0.82em';
        logEl.style.textAlign = 'center';
        logEl.style.margin = '4px 0 8px 0';
      } else if (event.type === CombatEventType.SQUAD_CHANGE) {
        logEl.style.color = '#c084fc';
        logEl.style.fontWeight = 'bold';
        logEl.style.fontSize = '1.05em';
        if (event.newSquadStates && event.newSquadStates.length > 0) {
          this.playerTeamContainer.innerHTML = '';
          this.fallbackPlayerCount = 0;
          event.newSquadStates.forEach(s => {
            this.hpMap[s.id] = s.currentHp !== undefined ? s.currentHp : s.maxHp;
            this.createHpBar(s);
          });
        }
      }

      this.logArea.appendChild(logEl);
      this.logArea.scrollTop = this.logArea.scrollHeight;
    }
  }

  private static applyDamageAndFloatingNumbers(event: CombatEvent, preloadedTargetEl?: HTMLElement | null) {
    const targetId = event.targetId || event.actorId;
    const targetEl = preloadedTargetEl || (targetId ? document.getElementById(`combat-p-${targetId}`) : null);

    // 彈出傷害跳字
    if (targetEl && event.damage !== undefined && (event.type === CombatEventType.HIT || event.type === CombatEventType.CRIT || event.type === CombatEventType.STATUS_DAMAGE || event.type === CombatEventType.SKILL_CAST)) {
      const dmgEl = document.createElement('div');
      dmgEl.className = `floating-dmg ${event.type === CombatEventType.CRIT ? 'crit' : ''}`;
      dmgEl.textContent = `${event.type === CombatEventType.CRIT ? '💥 ' : ''}-${event.damage}`;
      targetEl.appendChild(dmgEl);
      setTimeout(() => { if (dmgEl.parentNode) dmgEl.remove(); }, 800);
    }

    // 治療浮動跳字
    if (targetEl && event.type === CombatEventType.HEAL && event.damage) {
      const isMp = event.healType === 'MP';
      const floatEl = document.createElement('div');
      floatEl.className = 'floating-dmg';
      floatEl.style.color = isMp ? '#38bdf8' : '#22c55e';
      floatEl.textContent = `+${event.damage} ${isMp ? 'MP' : 'HP'}`;
      targetEl.appendChild(floatEl);
      setTimeout(() => { if (floatEl.parentNode) floatEl.remove(); }, 800);
    }

    // 更新血量條
    if (event.targetHp !== undefined && event.targetId !== undefined && event.targetMaxHp !== undefined) {
      this.hpMap[event.targetId] = event.targetHp;
      const fillEl = document.getElementById(`hp-fill-${event.targetId}`);
      if (fillEl) {
        const pct = Math.max(0, (event.targetHp / event.targetMaxHp) * 100);
        fillEl.style.width = `${pct}%`;
        if (pct < 30) fillEl.classList.add('low');
        else fillEl.classList.remove('low');
      }
      const txtEl = document.getElementById(`hp-txt-${event.targetId}`);
      if (txtEl) {
        txtEl.textContent = `${Math.max(0, event.targetHp)}/${event.targetMaxHp}`;
      }
      if (event.targetHp <= 0 && targetEl) {
        targetEl.classList.add('is-dead');
      }
    }

    // 死亡事件直接暗化
    if (event.type === CombatEventType.DEATH && (event.targetId || event.actorId)) {
      const deadId = event.targetId || event.actorId;
      const deadEl = document.getElementById(`combat-p-${deadId}`);
      if (deadEl) deadEl.classList.add('is-dead');
    }

    // 更新 MP 能量條
    if (event.targetMp !== undefined && event.targetId !== undefined && event.targetMaxMp !== undefined) {
      const mpFillEl = document.getElementById(`mp-fill-${event.targetId}`);
      if (mpFillEl) {
        const mpPct = Math.max(0, Math.min(100, (event.targetMp / event.targetMaxMp) * 100));
        mpFillEl.style.width = `${mpPct}%`;
      }
      const mpTxtEl = document.getElementById(`mp-txt-${event.targetId}`);
      if (mpTxtEl) {
        mpTxtEl.textContent = `${Math.max(0, event.targetMp)}/${event.targetMaxMp}`;
      }
    }
  }

  private static skipPlayback() {
    this.isSkipped = true;
    this.isPlayingLoop = false;
    CombatFXEngine.getInstance().clear();
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = null;
    }
    const queue = this.currentSession ? this.currentEventQueue : (this.currentReport?.events || []);
    while (this.eventIndex < queue.length) {
      this.renderEvent(queue[this.eventIndex], true);
      this.eventIndex++;
    }
    if (this.currentSession) {
      this.onTurnQueueFinished();
    } else {
      this.finishPlayback();
    }
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
    if (this.btnSkip) this.btnSkip.style.display = 'none';
    if (this.btnClose) this.btnClose.style.display = 'block'; // 顯示返回按鈕
    
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
    
    if (this.logArea) {
      this.logArea.appendChild(resultEl);
      this.logArea.scrollTop = this.logArea.scrollHeight;
    }
  }

  private static closeCombat() {
    this.isPlayingLoop = false;
    this.isSkipped = true;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = null;
    }
    CombatFXEngine.getInstance().clear();

    if (this.modal) this.modal.classList.remove('active');
    this.currentReport = null;
    if (this.onCloseCallback) {
      const cb = this.onCloseCallback;
      this.onCloseCallback = null;
      cb();
    }
  }

  /**
   * 喚起專屬【🏰 領地防衛戰報 (Siege Debrief)】彈窗
   */
  public static showSiegeDebrief(options: {
    isVictory: boolean;
    isSiege: boolean;
    raidName: string;
    wallStatusText: string;
    gateRemaining: number;
    gateMax: number;
    lostInfantry: number;
    lostArchers: number;
    lostCavalry: number;
    lostVillagers: number;
    lostGold: number;
    lostFood: number;
    securityDelta: number;
    mvpName: string;
    onClose?: () => void;
  }): void {
    if (typeof document === 'undefined') {
      if (options.onClose) options.onClose();
      return;
    }

    const modal = document.getElementById('modal-siege-debrief');
    if (!modal) {
      if (options.onClose) options.onClose();
      return;
    }

    const bannerIcon = document.getElementById('debrief-banner-icon');
    const titleEl = document.getElementById('debrief-title');
    const subtitleEl = document.getElementById('debrief-subtitle');
    const wallStatusEl = document.getElementById('debrief-wall-status');
    const casualtiesListEl = document.getElementById('debrief-casualties-list');
    const resourcesStatusEl = document.getElementById('debrief-resources-status');
    const mvpNameEl = document.getElementById('debrief-mvp-name');
    const btnClose = document.getElementById('btn-close-siege-debrief');

    if (bannerIcon) bannerIcon.textContent = options.isVictory ? '🏆' : '💀';
    if (titleEl) {
      titleEl.textContent = options.isVictory ? `🛡️ 領地防衛大捷：${options.raidName}` : `🔥 領地防禦失守：${options.raidName}`;
      titleEl.style.color = options.isVictory ? '#fbbf24' : '#ef4444';
    }
    if (subtitleEl) {
      subtitleEl.textContent = options.isVictory
        ? (options.isSiege ? '守城部隊成功擊退敵軍主力，保衛了領地！' : '巡邏守軍在市街及時壓制了強盜突襲！')
        : (options.isSiege ? '要塞城防失守，敵軍突破防線掠奪了城鎮！' : '市街遭遇戰敗退，領地遭受了強盜洗劫！');
    }
    if (wallStatusEl) {
      wallStatusEl.textContent = options.isSiege ? options.wallStatusText : '街巷突襲（未受城防設施保護）';
      wallStatusEl.style.color = (options.gateRemaining <= 0 && options.isSiege) ? '#ef4444' : '#4ade80';
    }

    if (casualtiesListEl) {
      let casualtiesHtml = '';
      if (options.isSiege) {
        casualtiesHtml += `<div>🛡️ 步兵護衛戰損：<b style="color: ${options.lostInfantry > 0 ? '#f87171' : '#4ade80'};">${options.lostInfantry > 0 ? `-${options.lostInfantry} 人` : '無傷亡'}</b></div>`;
        casualtiesHtml += `<div>🏹 弓兵民兵戰損：<b style="color: ${options.lostArchers > 0 ? '#f87171' : '#4ade80'};">${options.lostArchers > 0 ? `-${options.lostArchers} 人` : '無傷亡'}</b></div>`;
        casualtiesHtml += `<div>🐎 騎兵部隊戰損：<b style="color: ${options.lostCavalry > 0 ? '#f87171' : '#4ade80'};">${options.lostCavalry > 0 ? `-${options.lostCavalry} 人` : '無傷亡'}</b></div>`;
      } else {
        casualtiesHtml += `<div>🏘️ 市街波及村民：<b style="color: #f87171;">-${options.lostVillagers} 位村民</b></div>`;
      }
      casualtiesListEl.innerHTML = casualtiesHtml;
    }

    if (resourcesStatusEl) {
      if (options.isVictory) {
        resourcesStatusEl.innerHTML = `<span style="color: #4ade80;">物資全數保全</span> | <span style="color: #60a5fa;">治安 +${options.securityDelta}</span>`;
      } else {
        resourcesStatusEl.innerHTML = `<span style="color: #f87171;">損失 💰${options.lostGold}、🌾${options.lostFood}</span> | <span style="color: #f87171;">治安 ${options.securityDelta}</span>`;
      }
    }

    if (mvpNameEl) mvpNameEl.textContent = options.mvpName;

    modal.style.display = 'flex';

    if (btnClose) {
      btnClose.onclick = () => {
        modal.style.display = 'none';
        if (options.onClose) options.onClose();
      };
    }
  }
}
