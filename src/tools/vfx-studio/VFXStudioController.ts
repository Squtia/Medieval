import { VFXStudioStore } from './VFXStudioStore';
import { VFXTimeline } from './VFXTimeline';
import { VFXInspector } from './VFXInspector';
import { VFXLibrary } from './VFXLibrary';
import { VFXStudioAdapter } from '../../ui/fx/VFXPlayer';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { VFXPreset } from '../../models/VFX';

/**
 * 🎮 VFXStudioController
 * 特效工房主控制器 (Main Controller)
 * 協同 Store、Timeline、Inspector、Library 與 StudioAdapter，並整合效能預算監控 HUD
 */
export class VFXStudioController {
  private store: VFXStudioStore;
  private timeline: VFXTimeline;
  private inspector: VFXInspector;
  private library: VFXLibrary;
  private studioAdapter: VFXStudioAdapter;

  private loopTimer: any = null;
  private casterTimer: any = null;
  private hudBudgetTimer: any = null;
  private targetMode: 'SINGLE' | 'AOE' = 'SINGLE';

  constructor() {
    this.store = VFXStudioStore.getInstance();

    const viewportContainer = document.getElementById('viewport')!;
    const casterEl = document.getElementById('ref-caster')!;
    const targetEls = Array.from(document.querySelectorAll('#target-stage-wrapper .target, #ref-target')) as HTMLElement[];

    this.studioAdapter = new VFXStudioAdapter({
      viewportContainer,
      casterElement: casterEl,
      targetElements: targetEls
    });

    const timelineContainer = document.getElementById('timeline-mount-point')!;
    this.timeline = new VFXTimeline(timelineContainer);

    const leftSidebar = document.querySelector('.sidebar-left') as HTMLElement;
    const rightSidebar = document.querySelector('.sidebar-right') as HTMLElement;
    this.inspector = new VFXInspector(leftSidebar, rightSidebar);
    this.inspector.bindAll();

    const libraryMount = document.getElementById('library-mount-point')!;
    this.library = new VFXLibrary(libraryMount);

    this.bindTopControls();
    this.bindKeyboard();
    this.startQualityBudgetMonitor();

    // 初始觸發播放
    this.playCurrent();
  }

  private bindTopControls(): void {
    // 播放
    document.getElementById('btn-play')?.addEventListener('click', () => this.playCurrent());

    // 循環
    const btnLoop = document.getElementById('btn-loop');
    if (btnLoop) {
      btnLoop.addEventListener('click', () => {
        const next = !this.store.getIsLooping();
        this.store.setLooping(next);
        btnLoop.textContent = next ? '🔄 自動循環: 開' : '🔄 自動循環: 關';
        btnLoop.style.borderColor = next ? '#38bdf8' : '#30363d';
        btnLoop.style.color = next ? '#38bdf8' : '#c9d1d9';
        if (next) this.playCurrent();
      });
    }

    // 慢動作
    const btnSlow = document.getElementById('btn-slow');
    if (btnSlow) {
      btnSlow.addEventListener('click', () => {
        const next = !this.store.getIsSlowMo();
        this.store.setSlowMo(next);
        btnSlow.textContent = next ? '⚡ 正常速度 (1.0x)' : '🐢 慢動作 (0.3x)';
        CombatFXEngine.getInstance().setPlaybackSpeed(next ? 0.3 : 1.0);
      });
    }

    // 背景切換
    const btnBg = document.getElementById('btn-bg-toggle');
    if (btnBg) {
      btnBg.addEventListener('click', () => {
        const next = !this.store.getIsDarkBg();
        this.store.setDarkBg(next);
        const vp = document.getElementById('viewport');
        if (vp) vp.style.background = next ? '#090d16' : '#1e293b';
        btnBg.textContent = next ? '🎨 背景: 純黑' : '🎨 背景: 舞台';
      });
    }

    // Undo / Redo
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    btnUndo?.addEventListener('click', () => this.store.undo());
    btnRedo?.addEventListener('click', () => this.store.redo());

    // 固定 Seed
    const chkSeed = document.getElementById('chk-fixed-seed') as HTMLInputElement;
    chkSeed?.addEventListener('change', (e) => {
      this.store.setFixedSeed((e.target as HTMLInputElement).checked);
    });

    // 受擊目標模式
    const targetModeSel = document.getElementById('stage-target-mode') as HTMLSelectElement;
    targetModeSel?.addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement).value as any;
      this.store.setTargetMode(mode);
      this.updateTargetLayout(mode);
      this.playCurrent();
    });

    window.addEventListener('resize', () => {
      this.studioAdapter.resize();
    });

    window.addEventListener('beforeunload', (e) => {
      if (this.store.getIsDirty()) {
        e.preventDefault();
        e.returnValue = '尚有未發布至專案的特效變更，確定要離開嗎？';
      }
    });
  }

  private bindFooterControls(): void {
    const repo = (this.library as any).repo || VFXStudioStore.getInstance();

    // 1. 📥 保存/同步
    const btnSaveProject = document.getElementById('btn-save-project');
    btnSaveProject?.addEventListener('click', () => {
      const p = this.store.getPreset();
      const res = (this.library as any).repo?.saveCustomPreset(p);
      if (res && res.success) {
        this.store.setDirty(false);
        const origText = btnSaveProject.textContent;
        btnSaveProject.textContent = '✅ 已保存/同步！';
        setTimeout(() => { btnSaveProject.textContent = origText; }, 1800);
      }
    });

    // 2. 🚀 發布至專案 SSOT
    const btnPublish = document.getElementById('btn-publish-ssot');
    btnPublish?.addEventListener('click', async () => {
      const libBtn = document.getElementById('lib-btn-publish');
      if (libBtn) {
        libBtn.click();
      } else {
        const all = (this.library as any).repo?.getAllPresets?.() || [this.store.getPreset()];
        try {
          const resp = await fetch('/__vfx_api/save_ssot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presets: all })
          });
          const data = await resp.json();
          if (data.success) {
            alert(`✅ 已成功發布 ${data.count} 款特效至專案 SSOT！`);
            this.store.setDirty(false);
          }
        } catch (e: any) {
          navigator.clipboard.writeText(JSON.stringify(all, null, 2));
          alert(`⚠️ 發布失敗，已複製 JSON 至剪貼簿。`);
        }
      }
    });

    // 3. 📋 複製單項 JSON
    const btnSave = document.getElementById('btn-save');
    btnSave?.addEventListener('click', () => {
      const p = this.store.getPreset();
      navigator.clipboard.writeText(JSON.stringify(p, null, 2));
      const origText = btnSave.textContent;
      btnSave.textContent = '📋 已複製單項！';
      setTimeout(() => { btnSave.textContent = origText; }, 1800);
    });

    // 4. 💾 複製完整庫 JSON
    const btnExportAll = document.getElementById('btn-export-all');
    btnExportAll?.addEventListener('click', () => {
      const libBtn = document.getElementById('lib-btn-export');
      if (libBtn) {
        libBtn.click();
      } else {
        const all = (this.library as any).repo?.getAllPresets?.() || [this.store.getPreset()];
        navigator.clipboard.writeText(JSON.stringify(all, null, 2));
        const origText = btnExportAll.textContent;
        btnExportAll.textContent = '💾 已複製庫！';
        setTimeout(() => { btnExportAll.textContent = origText; }, 1800);
      }
    });

    // 5. 🔄 還原出廠預設
    const btnResetDefaults = document.getElementById('btn-reset-defaults');
    btnResetDefaults?.addEventListener('click', () => {
      if (confirm('確定要還原官方出廠預設嗎？這將清除所有自訂與覆寫設定。')) {
        const r = (this.library as any).repo;
        if (r && typeof r.resetToFactoryDefaults === 'function') {
          r.resetToFactoryDefaults();
          const first = r.getAllPresets()[0];
          if (first) {
            this.store.setPreset(first, false);
            this.store.setDirty(false);
          }
          this.playCurrent();
        }
      }
    });
  }

  private updateTargetLayout(mode: 'SINGLE' | 'FRONT_ROW' | 'ALL_AOE' | 'SIEGE_GATE'): void {
    const wrapper = document.getElementById('target-stage-wrapper');
    if (!wrapper) return;

    this.targetMode = (mode === 'FRONT_ROW' || mode === 'ALL_AOE') ? 'AOE' : 'SINGLE';

    if (mode === 'SINGLE') {
      wrapper.innerHTML = `
        <div class="ref-card target" id="ref-target">
          <div class="ref-card-icon">👺</div>
          <div class="ref-card-label">受擊目標 (End)</div>
        </div>
      `;
    } else if (mode === 'FRONT_ROW') {
      wrapper.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前排1</div></div>
          <div class="ref-card target" id="ref-target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前排2 (中)</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前排3</div></div>
        </div>
      `;
    } else if (mode === 'ALL_AOE') {
      wrapper.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前上</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">後上</div></div>
          <div class="ref-card target" id="ref-target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前中</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">後中</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前下</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">後下</div></div>
        </div>
      `;
    } else if (mode === 'SIEGE_GATE') {
      wrapper.innerHTML = `
        <div class="ref-card target" id="ref-target" style="width: 140px; height: 160px; border-color: #f59e0b; background: rgba(180, 83, 9, 0.2);">
          <div class="ref-card-icon" style="font-size: 2.2rem;">🏰</div>
          <div class="ref-card-label" style="font-weight: bold; color: #fbbf24;">要塞鋼鐵城門</div>
        </div>
      `;
    }

    const newTargets = Array.from(document.querySelectorAll('#target-stage-wrapper .target, #ref-target')) as HTMLElement[];
    this.studioAdapter.setTargets(newTargets);
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'SELECT') {
        e.preventDefault();
        this.playCurrent();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        this.store.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
        e.preventDefault();
        this.store.redo();
      }
    });
  }

  public async playCurrent(): Promise<void> {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.casterTimer) {
      clearTimeout(this.casterTimer);
      this.casterTimer = null;
    }
    this.studioAdapter.clear();

    const preset = this.store.getPreset();
    const mutes = this.store.getTrackMuteStates();

    // 若主軌道靜音，過濾主效果
    const activeConfig: VFXPreset = JSON.parse(JSON.stringify(preset));
    if (mutes.layers) activeConfig.layers = [];
    if (mutes.impact) activeConfig.impact = {} as any;

    // 🎲 固定 Seed 邏輯
    let restoreMathRandom: (() => void) | null = null;
    if (this.store.getIsFixedSeed()) {
      let s = 123456789;
      const origRandom = Math.random;
      Math.random = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
      restoreMathRandom = () => { Math.random = origRandom; };
    }

    // 施術者突進
    const casterEl = document.getElementById('ref-caster');
    if (casterEl) {
      casterEl.style.transform = 'scale(1.04) translateX(18px)';
      this.casterTimer = setTimeout(() => {
        casterEl.style.transform = 'none';
        this.casterTimer = null;
      }, 220);
    }

    try {
      if (!mutes.main) {
        if (this.targetMode === 'AOE') {
          await this.studioAdapter.playMultiTarget(activeConfig);
        } else {
          await this.studioAdapter.play(activeConfig);
        }
      }
    } catch (err) {
      console.warn('Playback error:', err);
    } finally {
      if (restoreMathRandom) restoreMathRandom();
    }

    if (this.store.getIsLooping()) {
      this.loopTimer = setTimeout(() => {
        this.loopTimer = null;
        if (this.store.getIsLooping()) this.playCurrent();
      }, 400);
    }
  }

  /**
   * 📊 實裝效能預算即時監控 HUD (Quality Budgets)
   */
  private startQualityBudgetMonitor(): void {
    const hud = document.getElementById('quality-budget-hud');
    if (!hud) return;

    this.hudBudgetTimer = setInterval(() => {
      const fxEngine = CombatFXEngine.getInstance();
      const scene = (fxEngine as any).scene;
      const renderer = (fxEngine as any).renderer;

      let drawCalls = 0;
      let triangles = 0;
      if (renderer && renderer.info && renderer.info.render) {
        drawCalls = renderer.info.render.calls || 0;
        triangles = renderer.info.render.triangles || 0;
      }

      const activeChildCount = scene ? scene.children.length : 0;
      const isOverBudget = drawCalls > 12 || activeChildCount > 30;

      hud.innerHTML = `
        <span style="color: ${isOverBudget ? '#ef4444' : '#38bdf8'}; font-weight: bold;">
          ${isOverBudget ? '⚠️ 效能警告' : '🟢 效能健康'}
        </span>
        <span>DrawCalls: <b style="color: ${drawCalls > 10 ? '#ef4444' : '#fbbf24'};">${drawCalls}</b></span>
        <span>Triangles: <b style="color: #cbd5e1;">${triangles}</b></span>
        <span>Active Objects: <b style="color: #cbd5e1;">${activeChildCount}</b></span>
      `;
    }, 500);
  }

  public destroy(): void {
    if (this.loopTimer) clearTimeout(this.loopTimer);
    if (this.casterTimer) clearTimeout(this.casterTimer);
    if (this.hudBudgetTimer) clearInterval(this.hudBudgetTimer);
    this.studioAdapter.clear();
  }
}
