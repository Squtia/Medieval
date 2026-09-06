import { VFXStudioAdapter } from '../../ui/fx/VFXPlayer';

export type StageTargetMode = 'SINGLE' | 'FRONT_ROW' | 'ALL_AOE' | 'ALLY_HEAL' | 'SELF_BUFF' | 'SIEGE_GATE';
export type StageBackgroundMode = 'pure-black' | 'checkerboard' | 'combat-arena';

/**
 * 🌟 VFXStage
 * 特效工房 3D 舞台視覺與陣型管理者 (Stage Layout & Viewport Overlay Controller)
 * 嚴格遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 6 節規範：
 * 1. 管理單體、前排 3 人、全體 6 人、友軍治療、自身增益與攻城門受擊陣型
 * 2. 管理純黑、棋盤格與實戰背景切換
 * 3. 繪製 90% 安全區、中心十字與動態彈道預測輔助線 (SVG Guides)
 * 4. 協同 VFXStudioAdapter 進行動態受術目標綁定
 */
export class VFXStage {
  private viewportEl: HTMLElement;
  private casterEl: HTMLElement;
  private wrapperEl: HTMLElement;
  private guidesSvg: SVGSVGElement | null = null;
  private studioAdapter: VFXStudioAdapter;

  private currentTargetMode: StageTargetMode = 'SINGLE';
  private currentBgMode: StageBackgroundMode = 'pure-black';
  private guidesEnabled: boolean = false;
  private casterTimer: any = null;

  constructor(studioAdapter: VFXStudioAdapter) {
    this.studioAdapter = studioAdapter;
    this.viewportEl = document.getElementById('viewport')!;
    this.casterEl = document.getElementById('ref-caster')!;
    this.wrapperEl = document.getElementById('target-stage-wrapper')!;
    this.guidesSvg = document.getElementById('vfx-guides-overlay') as SVGSVGElement | null;

    this.bindControls();
    this.updateTargetLayout('SINGLE');
  }

  private bindControls(): void {
    // 1. 背景模式切換 (純黑 / 棋盤格 / 實戰背景)
    const btnBg = document.getElementById('btn-bg-toggle');
    if (btnBg) {
      btnBg.addEventListener('click', () => this.toggleBackground());
    }

    // 2. 📐 輔助線開關 (中心十字、安全區、彈道預測線)
    const btnGuides = document.getElementById('btn-toggle-guides');
    if (btnGuides) {
      btnGuides.addEventListener('click', () => this.toggleGuides());
    }

    // 3. 受擊目標陣型切換
    const targetModeSel = document.getElementById('stage-target-mode') as HTMLSelectElement;
    if (targetModeSel) {
      targetModeSel.addEventListener('change', (e) => {
        const mode = (e.target as HTMLSelectElement).value as StageTargetMode;
        this.updateTargetLayout(mode);
      });
    }

    // 視窗大小改變時重繪輔助線
    window.addEventListener('resize', () => {
      if (this.guidesEnabled) {
        this.renderGuides();
      }
    });
  }

  public toggleBackground(): StageBackgroundMode {
    const modes: StageBackgroundMode[] = ['pure-black', 'checkerboard', 'combat-arena'];
    const nextIdx = (modes.indexOf(this.currentBgMode) + 1) % modes.length;
    this.currentBgMode = modes[nextIdx];

    if (this.viewportEl) {
      this.viewportEl.classList.remove('bg-pure-black', 'bg-checkerboard', 'bg-combat-arena');
      this.viewportEl.classList.add(`bg-${this.currentBgMode}`);
    }

    const labels: Record<StageBackgroundMode, string> = {
      'pure-black': '🎨 背景: 純黑',
      'checkerboard': '🏁 背景: 棋盤格',
      'combat-arena': '🏟️ 背景: 實戰'
    };
    const btnBg = document.getElementById('btn-bg-toggle');
    if (btnBg) {
      btnBg.textContent = labels[this.currentBgMode] || '🎨 背景: 純黑';
    }
    return this.currentBgMode;
  }

  public toggleGuides(): boolean {
    this.guidesEnabled = !this.guidesEnabled;
    const btnGuides = document.getElementById('btn-toggle-guides');
    if (btnGuides) {
      btnGuides.textContent = this.guidesEnabled ? '📐 輔助線: 開' : '📐 輔助線: 關';
      btnGuides.style.borderColor = this.guidesEnabled ? '#a855f7' : '#30363d';
      btnGuides.style.color = this.guidesEnabled ? '#c084fc' : '#c9d1d9';
    }
    this.renderGuides();
    return this.guidesEnabled;
  }

  public updateTargetLayout(mode: StageTargetMode): void {
    this.currentTargetMode = mode;
    if (!this.wrapperEl) return;

    if (mode === 'SINGLE') {
      this.wrapperEl.innerHTML = `
        <div class="ref-card target" id="ref-target">
          <div class="ref-card-icon">👺</div>
          <div class="ref-card-label">受擊目標 (End)</div>
        </div>
      `;
    } else if (mode === 'FRONT_ROW') {
      this.wrapperEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前排1</div></div>
          <div class="ref-card target" id="ref-target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前排2 (中)</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前排3</div></div>
        </div>
      `;
    } else if (mode === 'ALL_AOE') {
      this.wrapperEl.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前上</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">後上</div></div>
          <div class="ref-card target" id="ref-target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前中</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">後中</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">前下</div></div>
          <div class="ref-card target"><div class="ref-card-icon">👺</div><div class="ref-card-label">後下</div></div>
        </div>
      `;
    } else if (mode === 'ALLY_HEAL') {
      this.wrapperEl.innerHTML = `
        <div class="ref-card target ally" id="ref-target" style="border-color: #22c55e; background: rgba(34, 197, 94, 0.15);">
          <div class="ref-card-icon">🧝</div>
          <div class="ref-card-label" style="color: #86efac;">友軍受術者 (Ally)</div>
        </div>
      `;
    } else if (mode === 'SELF_BUFF') {
      this.wrapperEl.innerHTML = `
        <div class="ref-card target self" id="ref-target" style="border-color: #a855f7; background: rgba(168, 85, 247, 0.18);">
          <div class="ref-card-icon">✨</div>
          <div class="ref-card-label" style="color: #e9d5ff;">自身增益/護盾 (Self)</div>
        </div>
      `;
    } else if (mode === 'SIEGE_GATE') {
      this.wrapperEl.innerHTML = `
        <div class="ref-card target" id="ref-target" style="width: 140px; height: 160px; border-color: #f59e0b; background: rgba(180, 83, 9, 0.2);">
          <div class="ref-card-icon" style="font-size: 2.2rem;">🏰</div>
          <div class="ref-card-label" style="font-weight: bold; color: #fbbf24;">要塞鋼鐵城門</div>
        </div>
      `;
    }

    const newTargets = Array.from(document.querySelectorAll('#target-stage-wrapper .target, #ref-target')) as HTMLElement[];
    this.studioAdapter.setTargets(newTargets);
    this.renderGuides();
  }

  public renderGuides(): void {
    if (!this.guidesSvg) return;

    if (!this.guidesEnabled) {
      this.guidesSvg.style.display = 'none';
      this.guidesSvg.innerHTML = '';
      return;
    }

    const w = this.viewportEl.clientWidth || 800;
    const h = this.viewportEl.clientHeight || 500;
    this.guidesSvg.style.display = 'block';

    const cx = w / 2;
    const cy = h / 2;

    const safeMarginX = w * 0.05;
    const safeMarginY = h * 0.05;
    const safeW = w * 0.9;
    const safeH = h * 0.9;

    const casterEl = document.getElementById('ref-caster');
    const targetEl = document.getElementById('ref-target');
    const vpRect = this.viewportEl.getBoundingClientRect();

    let lineSvg = '';
    if (casterEl && targetEl) {
      const cRect = casterEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();
      const cX = (cRect.left + cRect.right) / 2 - vpRect.left;
      const cY = (cRect.top + cRect.bottom) / 2 - vpRect.top;
      const tX = (tRect.left + tRect.right) / 2 - vpRect.left;
      const tY = (tRect.top + tRect.bottom) / 2 - vpRect.top;
      lineSvg = `
        <line x1="${cX}" y1="${cY}" x2="${tX}" y2="${tY}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.75" />
        <circle cx="${cX}" cy="${cY}" r="4" fill="#38bdf8" />
        <circle cx="${tX}" cy="${tY}" r="5" fill="#f87171" stroke="#ffffff" stroke-width="1.5" />
      `;
    }

    this.guidesSvg.innerHTML = `
      <!-- 90% 安全區 (Safe Area) -->
      <rect x="${safeMarginX}" y="${safeMarginY}" width="${safeW}" height="${safeH}" fill="none" stroke="#f59e0b" stroke-width="1" stroke-dasharray="6 4" opacity="0.4" />
      <text x="${safeMarginX + 8}" y="${safeMarginY + 16}" fill="#f59e0b" font-size="10" opacity="0.6">90% Safe Area</text>
      <!-- 中心十字線 (Center Crosshair) -->
      <line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="#a855f7" stroke-width="1" stroke-dasharray="2 4" opacity="0.35" />
      <line x1="0" y1="${cy}" x2="${w}" y2="${cy}" stroke="#a855f7" stroke-width="1" stroke-dasharray="2 4" opacity="0.35" />
      <circle cx="${cx}" cy="${cy}" r="3" fill="#a855f7" opacity="0.6" />
      <!-- 彈道瞄準直線 -->
      ${lineSvg}
    `;
  }

  public triggerCasterLunge(): void {
    if (this.casterTimer) {
      clearTimeout(this.casterTimer);
      this.casterTimer = null;
    }
    if (this.casterEl) {
      this.casterEl.style.transform = 'scale(1.04) translateX(18px)';
      this.casterTimer = setTimeout(() => {
        this.casterEl.style.transform = 'none';
        this.casterTimer = null;
      }, 220);
    }
  }

  public isAOE(): boolean {
    return this.currentTargetMode === 'FRONT_ROW' || this.currentTargetMode === 'ALL_AOE';
  }

  public getTargetMode(): StageTargetMode {
    return this.currentTargetMode;
  }
}
