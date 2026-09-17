import {
  VFXPreset,
  VFXShaderMode,
  VFXRendererType,
  VFXTrajectory,
  VFXSpatialMode,
  getTrajectorySpatialAnchor
} from '../../models/VFX';
import { VFXStudioStore, VFXEditorSelection } from './VFXStudioStore';
import {
  InspectorCapability,
  ControlConfig,
  INSPECTOR_CONTROL_MAP,
  normalizeVfxPreset
} from '../../ui/fx/VFXPresetNormalizer';
export type { InspectorCapability, ControlConfig };
export { INSPECTOR_CONTROL_MAP, normalizeVfxPreset };

/**
 * 🎯 依據當前 Preset 與選取狀態純函式求值可用的 Inspector 能力集合 (Capability Schema)
 */
export function getSelectionCapabilities(
  preset: VFXPreset,
  selection: VFXEditorSelection
): Set<InspectorCapability> {
  const caps = new Set<InspectorCapability>();

  if (selection.type === 'BINDING') {
    caps.add('BINDING');
    return caps;
  }

  if (selection.type === 'CUE') {
    caps.add('CUE');
    caps.add('IMPACT_FEEDBACK');
    caps.add('CASTER_MOTION');
  }

  // PRESET, MAIN_TRACK, CUE, LAYER 基本能力
  caps.add('TRANSFORM');
  caps.add('TRAJECTORY');
  caps.add('PARTICLES');

  const layer = selection.type === 'LAYER'
    ? preset.layers?.find(l => l.id === selection.layerId)
    : undefined;

  const shaderMode = layer?.shaderMode || preset.shaderMode || 'SLASH_BLADE';
  const spatialMode = layer?.spatialMode || preset.spatialMode || 'TRAJECTORY';
  const rendererType = preset.rendererType;

  // Slash 幾何能力：以 shaderMode === 'SLASH_BLADE' 為唯一真理來源
  const isSlash = shaderMode === 'SLASH_BLADE';
  if (isSlash) {
    caps.add('SLASH_GEOMETRY');
  }

  // Projectile 幾何能力：非斬擊且非地底破土時開放，或明確設定了彈道/彈幕
  const isGround = shaderMode === 'EARTH_SHATTER' || rendererType === 'GROUND_FISSURE' || preset.trajectory === 'GROUND_FISSURE' || preset.trajectory === 'GROUND_BURST';
  if (
    !isSlash &&
    (rendererType === 'PROJECTILE' ||
     preset.spatialMode === 'TRAJECTORY' ||
     spatialMode === 'TRAJECTORY' ||
     preset.trajectoryPath !== undefined ||
     (preset.salvoCount !== undefined && preset.salvoCount > 0) ||
     (!isGround && spatialMode !== 'AT_CASTER'))
  ) {
    caps.add('PROJECTILE_GEOMETRY');
  }

  // Spike 幾何能力
  if (
    rendererType === 'GROUND_FISSURE' ||
    shaderMode === 'EARTH_SHATTER' ||
    preset.trajectory === 'GROUND_FISSURE' ||
    preset.trajectory === 'GROUND_BURST' ||
    (preset.spikes !== undefined && preset.spikes > 0)
  ) {
    caps.add('SPIKE_GEOMETRY');
  }

  // Shield 幾何能力
  if (
    rendererType === 'SHIELD' ||
    (preset.trajectory as string) === 'SHIELD_BARRIER' ||
    shaderMode === 'ENERGY_SHIELD'
  ) {
    caps.add('SHIELD_GEOMETRY');
  }

  // Shout / Shockwave 幾何能力
  if (
    rendererType === 'SHOUT_WAVE' ||
    (preset.trajectory as string) === 'SHOUT_WAVE' ||
    shaderMode === 'SHOCKWAVE'
  ) {
    caps.add('SHOUT_GEOMETRY');
  }

  // Fire / Ice Shader
  if (shaderMode.includes('FLAME') || shaderMode.includes('FIRE') || shaderMode === 'VOLUMETRIC_FIRE') {
    caps.add('FIRE_SHADER');
  }
  if (shaderMode.includes('ICE') || shaderMode.includes('FROST') || shaderMode === 'FRESNEL_ICE') {
    caps.add('ICE_SHADER');
  }

  // 僅主軌或整體 Preset 顯示受擊反饋與施法動作
  if (selection.type === 'MAIN_TRACK' || selection.type === 'PRESET') {
    caps.add('IMPACT_FEEDBACK');
    caps.add('CASTER_MOTION');
  }

  return caps;
}


/**
 * 🎛️ VFXInspector
 * 情境式參數檢查器 (Contextual Inspector)
 * 負責屬性面板之雙向綁定、情境式顯隱（Contextual Visibility）與數值連動
 */
export class VFXInspector {
  private leftContainer: HTMLElement;
  private rightContainer: HTMLElement;
  private store: VFXStudioStore;
  private onParamChangeCallback?: (preset: VFXPreset) => void;

  constructor(leftContainer: HTMLElement, rightContainer: HTMLElement) {
    this.leftContainer = leftContainer;
    this.rightContainer = rightContainer;
    this.store = VFXStudioStore.getInstance();
    this.store.subscribe((preset) => {
      this.syncUI(preset);
    });
    this.store.subscribeSelection(() => {
      this.syncUI(this.store.getPreset());
      this.updateContextualVisibility(this.store.getPreset());
    });
  }

  /**
   * 📡 註冊參數變更回調（用於即時預覽 / 熱更新）
   */
  public onParamChange(cb: (preset: VFXPreset) => void): void {
    this.onParamChangeCallback = cb;
  }

  private triggerChange(): void {
    if (this.onParamChangeCallback) {
      this.onParamChangeCallback(this.store.getPreset());
    }
  }

  public bindAll(): void {
    for (const c of INSPECTOR_CONTROL_MAP) {
      const el = document.getElementById(c.id);
      if (!el) continue;

      const label = c.labelId ? document.getElementById(c.labelId) : null;

      if (c.type === 'range') {
        const input = el as HTMLInputElement;
        input.addEventListener('pointerdown', () => this.store.recordSnapshot());
        input.addEventListener('input', (e) => {
          const val = parseFloat((e.target as HTMLInputElement).value);
          if (label) {
            if (c.id === 'param-burst-time') {
              label.textContent = val <= 0 ? '自動 (隨Cue)' : `${val.toFixed(2)}s`;
            } else if (c.id.includes('offset')) {
              const prefix = val > 0 ? '+' : '';
              label.textContent = `${prefix}${val}${c.unit || ''}`;
            } else {
              const prefix = (c.id === 'param-slash-jitter' && val > 0) ? '±' : '';
              label.textContent = `${prefix}${val}${c.unit || ''}`;
            }
          }
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else if (c.id === 'param-slash-rot-x') {
            this.store.updateConfig({ slashRotX: val, rotX: val }, false);
          } else if (c.id === 'param-slash-rot-y') {
            this.store.updateConfig({ slashRotY: val, rotY: val }, false);
          } else if (c.id === 'param-slash-rot-z' || c.id === 'param-slash-angle') {
            this.store.updateConfig({ slashRotZ: val, rotZ: val, slashAngle: val, angle: val }, false);
          } else if (c.id === 'param-slash-width') {
            this.store.updateConfig({ slashBladeWidth: val, bladeWidth: val }, false);
          } else if (c.id === 'param-slash-radius') {
            this.store.updateConfig({ slashRadius: val, radius: val }, false);
          } else if (c.id === 'param-slash-arc-span') {
            this.store.updateConfig({ slashArcSpan: val, arcSpan: val }, false);
          } else if (c.id === 'param-slash-aspect') {
            this.store.updateConfig({ slashAspect: val, aspect: val }, false);
          } else if (c.id === 'param-slash-jitter') {
            this.store.updateConfig({ slashAngleJitter: val, angleJitter: val }, false);
          } else if (c.id === 'param-flame-speed') {
            this.store.updateConfig({ flameTurbulenceSpeed: val, flameSpeed: val }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
        });
      } else if (c.type === 'select') {
        const sel = el as HTMLSelectElement;
        sel.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLSelectElement).value;
          if (c.id === 'param-slash-shape') {
            this.store.updateConfig({ slashShape: val as any, shape: val as any }, false);
          } else if (c.id === 'param-slash-traj') {
            const updates: any = { slashTrajectory: val as any };
            if (val === 'CLEAVE_DOWN') {
              updates.slashAngle = -45;
              updates.angle = -45;
              updates.slashRotX = 0;
              updates.rotX = 0;
              updates.slashRotY = 0;
              updates.rotY = 0;
              updates.slashRotZ = -45;
              updates.rotZ = -45;
              updates.slashArcSpan = 120;
              updates.arcSpan = 120;
              updates.slashReverse = false;
              updates.reverse = false;
            } else if (val === 'UPPER_CUT') {
              updates.slashAngle = 135;
              updates.angle = 135;
              updates.slashRotX = 0;
              updates.rotX = 0;
              updates.slashRotY = 0;
              updates.rotY = 0;
              updates.slashRotZ = 135;
              updates.rotZ = 135;
              updates.slashArcSpan = 110;
              updates.arcSpan = 110;
              updates.slashReverse = true;
              updates.reverse = true;
            } else if (val === 'HORIZONTAL') {
              updates.slashAngle = -15;
              updates.angle = -15;
              updates.slashRotX = 0;
              updates.rotX = 0;
              updates.slashRotY = 0;
              updates.rotY = 0;
              updates.slashRotZ = -15;
              updates.rotZ = -15;
              updates.slashArcSpan = 140;
              updates.arcSpan = 140;
              updates.slashReverse = false;
              updates.reverse = false;
            } else if (val === 'VERTICAL_DOWN') {
              updates.slashAngle = 90;
              updates.angle = 90;
              updates.slashRotX = 0;
              updates.rotX = 0;
              updates.slashRotY = 0;
              updates.rotY = 0;
              updates.slashRotZ = 90;
              updates.rotZ = 90;
              updates.slashArcSpan = 130;
              updates.arcSpan = 130;
              updates.slashReverse = false;
              updates.reverse = false;
            }
            this.store.updateConfig(updates, false);
            this.syncUI(this.store.getPreset());
          } else if (c.id === 'param-trajectory') {
            const anchor = getTrajectorySpatialAnchor(val);
            const spatialMode = anchor === 'TRAJECTORY' ? 'TRAJECTORY' : anchor;
            this.store.updateConfig({ trajectory: val as any, spatialMode: spatialMode as any }, false);
          } else if (c.id === 'param-shader-mode') {
            const shaderVal = val as VFXShaderMode;
            const cur = this.store.getPreset();
            const updates: Partial<VFXPreset> = { shaderMode: shaderVal };

            if (shaderVal === 'SHOCKWAVE') {
              updates.rendererType = 'PROJECTILE';
              updates.trajectory = 'SHOUT_WAVE';
              if (cur.spatialMode !== 'AT_TARGET' && cur.spatialMode !== 'AT_CASTER') {
                updates.spatialMode = 'AT_CASTER';
              }
            } else if (shaderVal !== 'SLASH_BLADE') {
              if (cur.rendererType === 'SLASH') {
                updates.rendererType = shaderVal === 'EARTH_SHATTER' ? 'GROUND_FISSURE' : 'PROJECTILE';
              }
              if (cur.trajectory === 'MELEE_SWEEP') {
                updates.trajectory = shaderVal === 'EARTH_SHATTER' ? 'GROUND_BURST' : 'HORIZONTAL';
                updates.spatialMode = shaderVal === 'EARTH_SHATTER' ? 'AT_TARGET' : 'TRAJECTORY';
              }
            } else {
              updates.rendererType = 'SLASH';
              updates.trajectory = 'MELEE_SWEEP';
              updates.spatialMode = 'AT_TARGET';
            }
            this.store.updateConfig(updates, false);
            this.syncUI(this.store.getPreset());
          } else if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
        });
      } else if (c.type === 'select-boolean') {
        const sel = el as HTMLSelectElement;
        sel.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLSelectElement).value === 'true';
          if (c.id === 'param-slash-reverse') {
            this.store.updateConfig({ slashReverse: val, reverse: val }, false);
          } else if (c.id === 'param-slash-alternating') {
            this.store.updateConfig({ slashAlternating: val, alternating: val }, false);
          } else if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
        });
      } else if (c.type === 'checkbox') {
        const chk = el as HTMLInputElement;
        chk.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLInputElement).checked;
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
        });
      } else if (c.type === 'color') {
        const input = el as HTMLInputElement;
        input.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLInputElement).value;
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
        });
      }
    }

    // 初始同步
    this.syncUI(this.store.getPreset());
  }

  /**
   * 🔄 將 Preset 同步至 UI，以 Control Map 保證零 undefined 洩漏
   */
  public syncUI(rawPreset: VFXPreset): void {
    const p = normalizeVfxPreset(rawPreset);

    for (const c of INSPECTOR_CONTROL_MAP) {
      const el = document.getElementById(c.id) as HTMLInputElement | HTMLSelectElement;
      const label = c.labelId ? document.getElementById(c.labelId) : null;
      if (!el) continue;

      const sel = this.store.getSelection();
      const currentLayer = sel.type === 'LAYER' ? p.layers?.find(l => l.id === sel.layerId) : undefined;
      const rawVal = c.isImpact
        ? p.impact?.[c.key as keyof typeof p.impact]
        : (c.isCasterMotion
          ? (p.casterMotion as any)?.[c.key]
          : (currentLayer && (currentLayer as any)[c.key] !== undefined
            ? (currentLayer as any)[c.key]
            : ((p as any)[c.key] !== undefined ? (p as any)[c.key] : (c.key === 'flameTurbulenceSpeed' ? (p as any).flameSpeed : undefined))));
      const val = (rawVal !== undefined && rawVal !== null && !Number.isNaN(rawVal)) ? rawVal : c.defaultVal;

      if (c.type === 'range') {
        el.value = val.toString();
        if (label) {
          if (c.id === 'param-burst-time') {
            label.textContent = Number(val) <= 0 ? '自動 (隨Cue)' : `${Number(val).toFixed(2)}s`;
          } else if (c.id.includes('offset')) {
            const prefix = Number(val) > 0 ? '+' : '';
            label.textContent = `${prefix}${val}${c.unit || ''}`;
          } else {
            const prefix = (c.id === 'param-slash-jitter' && Number(val) > 0) ? '±' : '';
            label.textContent = `${prefix}${val}${c.unit || ''}`;
          }
        }
      } else if (c.type === 'select') {
        el.value = val.toString();
      } else if (c.type === 'select-boolean') {
        el.value = val ? 'true' : 'false';
      } else if (c.type === 'checkbox') {
        (el as HTMLInputElement).checked = !!val;
      } else if (c.type === 'color') {
        el.value = val.toString();
      }
    }

    // 🎭 情境式顯示控制 (Contextual Visibility)
    this.updateContextualVisibility(p);
  }

  private contextualTarget: { type: 'MAIN' | 'LAYER' | 'CUE'; index?: number } | null = null;

  public setContextualTarget(target: { type: 'MAIN' | 'LAYER' | 'CUE'; index?: number } | null): void {
    this.contextualTarget = target;
    if (target?.type === 'CUE') {
      this.selectedCueIndex = target.index !== undefined ? target.index : null;
      const cue = (this.store.getPreset().impactCues || [])[this.selectedCueIndex || 0];
      this.store.setSelection({ type: 'CUE', cueId: cue?.cueId || 'cue_0' });
    } else if (target?.type === 'LAYER') {
      const layer = (this.store.getPreset().layers || [])[target.index || 0];
      this.store.setSelection({ type: 'LAYER', layerId: layer?.id || 'layer_0' });
      this.selectedCueIndex = null;
    } else if (target?.type === 'MAIN') {
      this.store.setSelection({ type: 'MAIN_TRACK' });
      this.selectedCueIndex = null;
    } else {
      this.store.setSelection({ type: 'PRESET' });
      this.selectedCueIndex = null;
    }
    this.updateContextualVisibility(this.store.getPreset());
  }

  public updateContextualVisibility(p: VFXPreset): void {
    const sel = this.store.getSelection();
    const caps = getSelectionCapabilities(p, sel);

    const isCueSelected = sel.type === 'CUE' || this.selectedCueIndex !== null;
    const isBindingSelected = sel.type === 'BINDING';
    const isLayerSelected = sel.type === 'LAYER';

    const slashCard = document.querySelector('.card-slash-section') as HTMLElement;
    if (slashCard) {
      slashCard.style.display = (!isBindingSelected && caps.has('SLASH_GEOMETRY')) ? 'block' : 'none';
    }

    const particleCard = document.querySelector('.card-particle-section') as HTMLElement;
    if (particleCard) {
      particleCard.style.display = (!isBindingSelected && caps.has('PARTICLES')) ? 'block' : 'none';
    }

    const spikeCard = document.querySelector('.card-spike-section') as HTMLElement;
    if (spikeCard) {
      spikeCard.style.display = (!isBindingSelected && caps.has('SPIKE_GEOMETRY')) ? 'block' : 'none';
    }

    const salvoCard = document.querySelector('.card-salvo-section') as HTMLElement;
    if (salvoCard) {
      // 🚀 徹底解鎖彈幕卡片：只要是投射物幾何，隨時開放創作者調整發射彈數、節奏與散佈
      salvoCard.style.display = (!isBindingSelected && caps.has('PROJECTILE_GEOMETRY')) ? 'block' : 'none';
    }

    // 施法動作與受擊回饋卡片：在主軌或常規編輯時始終開放調整
    const casterCard = document.querySelector('.card-caster-motion') as HTMLElement;
    if (casterCard) {
      casterCard.style.display = (!isBindingSelected && caps.has('CASTER_MOTION')) ? 'block' : 'none';
    }

    const impactCard = document.querySelector('.card-impact-section') as HTMLElement;
    if (impactCard) {
      impactCard.style.display = (!isBindingSelected && caps.has('IMPACT_FEEDBACK')) ? 'block' : 'none';
    }

    // 🛡️ 依 §5.8 規則：Shield shape 只有 shield renderer 顯示
    const shieldCard = document.querySelector('.card-shield-section') as HTMLElement;
    if (shieldCard) {
      shieldCard.style.display = (!isBindingSelected && caps.has('SHIELD_GEOMETRY')) ? 'block' : 'none';
    }

    // 🌊 衝擊震波專屬幾何與姿態控制區顯隱
    const sectionShockwave = document.getElementById('section-shockwave-controls');
    if (sectionShockwave) {
      sectionShockwave.style.display = (!isBindingSelected && caps.has('SHOUT_GEOMETRY')) ? 'block' : 'none';
    }

    // 🔥 依 §5.8 規則：Fire turbulence 只有 fire renderer 顯示
    const rowFire = document.getElementById('row-flame-turbulence');
    if (rowFire) {
      rowFire.style.display = (!isBindingSelected && caps.has('FIRE_SHADER')) ? 'flex' : 'none';
    }

    // ❄️ 依 §5.8 規則：Fresnel 只有 ice/fresnel shader 顯示
    const colFresnel = document.getElementById('col-fresnel');
    if (colFresnel) {
      colFresnel.style.display = (!isBindingSelected && caps.has('ICE_SHADER')) ? 'block' : 'none';
    }

    // 隱藏 Legacy trajectory 與無效欄位
    const legacyTraj = document.getElementById('param-trajectory');
    if (legacyTraj) {
      const col = (typeof legacyTraj.closest === 'function')
        ? (legacyTraj.closest('.param-col') || legacyTraj.closest('.param-row'))
        : legacyTraj.parentElement;
      if (col) (col as HTMLElement).style.display = 'none';
    }

    const textureSprite = document.getElementById('param-texture-sprite');
    if (textureSprite) {
      const col = (typeof textureSprite.closest === 'function')
        ? (textureSprite.closest('.param-col') || textureSprite.closest('.param-row'))
        : textureSprite.parentElement;
      if (col) (col as HTMLElement).style.display = 'none';
    }

    // 🚀 當空間發生模式為原地類（AT_CASTER / AT_TARGET / LOCAL_MORPH）時，隱藏位移路徑選單
    const rowTrajPath = document.getElementById('row-trajectory-path');
    if (rowTrajPath) {
      const activeSpatial = p.spatialMode || 'TRAJECTORY';
      const topology = p.spatialTopology || 'POINT_TRANSPORT';
      const isStationary = activeSpatial === 'AT_CASTER' || activeSpatial === 'AT_TARGET' || topology === 'LOCAL_MORPH';
      rowTrajPath.style.display = isStationary ? 'none' : 'block';
    }

    // 🎯 同步選中的 Cue 資訊
    this.syncSelectedCueUI(p);
  }

  // ─────────────────────────────────────────────────────────────
  // 🎯 情境式 Cue 檢查器實作 (Contextual Cue Inspector)
  // ─────────────────────────────────────────────────────────────
  private selectedCueIndex: number | null = null;
  private isCueBindingDone = false;

  public setSelectedCueIndex(index: number | null): void {
    this.selectedCueIndex = index;
    if (index !== null) {
      const cue = (this.store.getPreset().impactCues || [])[index];
      this.store.setSelection({ type: 'CUE', cueId: cue?.cueId || `cue_${index}` });
    }
    this.syncSelectedCueUI(this.store.getPreset());

    if (index !== null) {
      const cueCard = document.getElementById('card-cue-inspector');
      if (cueCard && typeof cueCard.scrollIntoView === 'function') {
        cueCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        cueCard.classList.remove('cue-card-highlight');
        if (typeof (cueCard as any).offsetWidth === 'number') {
          void (cueCard as any).offsetWidth;
        }
        cueCard.classList.add('cue-card-highlight');
      }
    }
  }

  private syncSelectedCueUI(preset: VFXPreset): void {
    const cueCard = document.getElementById('card-cue-inspector');
    if (!cueCard) return;

    if (!this.isCueBindingDone) {
      this.bindCueControls();
      this.isCueBindingDone = true;
    }

    const cues = preset.impactCues || [];
    cueCard.style.display = 'block';

    const tabsContainer = document.getElementById('cue-selector-tabs');
    const bodyEl = typeof (cueCard as any).querySelector === 'function'
      ? (cueCard as any).querySelector('.inspector-card-body') as HTMLElement | null
      : null;

    if (cues.length === 0) {
      this.selectedCueIndex = null;
      if (tabsContainer) {
        tabsContainer.innerHTML = `
          <span style="font-size: 0.72rem; color: #94a3b8;">目前尚無打擊 Cue 點</span>
          <button id="btn-add-first-cue" style="background: #f59e0b; color: #000; border: none; font-weight: bold; border-radius: 3px; font-size: 0.68rem; padding: 2px 8px; cursor: pointer;">➕ 新增打擊 Cue</button>
        `;
        if (typeof tabsContainer.querySelector === 'function') {
          tabsContainer.querySelector('#btn-add-first-cue')?.addEventListener('click', () => {
            this.store.recordSnapshot();
            const newCue = {
              cueId: `hit_${Date.now() % 10000}`,
              time: Number(((preset.duration || 0.5) * 0.5).toFixed(2)),
              kind: 'IMPACT' as const,
              weight: 1.0,
              isPrimary: true
            };
            this.store.updateConfig({ impactCues: [newCue] }, true);
            this.setSelectedCueIndex(0);
            this.triggerChange();
          });
        }
      }
      if (bodyEl) bodyEl.style.display = 'none';
      return;
    }

    if (bodyEl) bodyEl.style.display = 'block';

    // 若未特選或索引越界，預設選取第 0 個 Cue
    if (this.selectedCueIndex === null || this.selectedCueIndex < 0 || this.selectedCueIndex >= cues.length) {
      this.selectedCueIndex = 0;
    }

    // 渲染 Cue 標籤切換列
    if (tabsContainer) {
      tabsContainer.innerHTML = '';
      cues.forEach((c, idx) => {
        const isSel = idx === this.selectedCueIndex;
        const tabBtn = document.createElement('button');
        tabBtn.style.cssText = isSel
          ? 'background: #f59e0b; color: #000; border: 1px solid #fbbf24; font-weight: bold; border-radius: 3px; font-size: 0.68rem; padding: 2px 7px; cursor: pointer;'
          : 'background: #272013; color: #f59e0b; border: 1px solid #78350f; border-radius: 3px; font-size: 0.68rem; padding: 2px 7px; cursor: pointer;';
        tabBtn.textContent = `🎯 #${idx + 1} ${(c.time || 0).toFixed(2)}s`;
        tabBtn.onclick = () => this.setSelectedCueIndex(idx);
        tabsContainer.appendChild(tabBtn);
      });

      const addBtn = document.createElement('button');
      addBtn.style.cssText = 'background: #1e293b; color: #38bdf8; border: 1px dashed #38bdf8; border-radius: 3px; font-size: 0.68rem; padding: 2px 6px; cursor: pointer; margin-left: auto;';
      addBtn.textContent = '➕ 加 Cue';
      addBtn.onclick = () => {
        this.store.recordSnapshot();
        const lastCueTime = cues[cues.length - 1]?.time ?? 0.2;
        const nextTime = Number(Math.min((preset.duration || 1.0), lastCueTime + 0.15).toFixed(2));
        const newCue = {
          cueId: `hit_${cues.length + 1}`,
          time: nextTime,
          kind: 'IMPACT' as const,
          weight: 1.0,
          isPrimary: false
        };
        const updated = [...cues, newCue];
        this.store.updateConfig({ impactCues: updated }, true);
        this.setSelectedCueIndex(updated.length - 1);
        this.triggerChange();
      };
      tabsContainer.appendChild(addBtn);
    }

    const cue = cues[this.selectedCueIndex];
    if (!cue) return;

    const inputId = document.getElementById('param-cue-id') as HTMLInputElement;
    const inputTime = document.getElementById('param-cue-time') as HTMLInputElement;
    const valTime = document.getElementById('val-cue-time');
    const selKind = document.getElementById('param-cue-kind') as HTMLSelectElement;
    const inputWeight = document.getElementById('param-cue-weight') as HTMLInputElement;
    const valWeight = document.getElementById('val-cue-weight');
    const selPolicy = document.getElementById('param-cue-target-policy') as HTMLSelectElement;
    const chkPrimary = document.getElementById('param-cue-is-primary') as HTMLInputElement;

    if (inputId) inputId.value = cue.cueId || '';
    if (inputTime) {
      inputTime.max = (preset.duration || 1.0).toString();
      inputTime.value = (cue.time || 0).toString();
    }
    if (valTime) valTime.textContent = `${(cue.time || 0).toFixed(2)}s`;
    if (selKind) selKind.value = cue.kind || 'IMPACT';
    const weightVal = cue.weight !== undefined ? cue.weight : 1.0;
    if (inputWeight) inputWeight.value = weightVal.toString();
    if (valWeight) valWeight.textContent = weightVal.toFixed(1);
    if (selPolicy) selPolicy.value = cue.targetPolicy || 'PRIMARY_TARGET';
    if (chkPrimary) chkPrimary.checked = !!cue.isPrimary;

    // 🎯 依模式控制 cue.weight 顯隱 (僅在 SPLIT_SINGLE_IMPACT 時顯示)
    const mode = preset.impactPresentationMode || 'EXACT_IMPACTS';
    const rowWeight = (inputWeight && typeof inputWeight.closest === 'function') 
      ? (inputWeight.closest('.param-row') as HTMLElement) 
      : (inputWeight?.parentElement as HTMLElement | null);
    if (rowWeight) {
      rowWeight.style.display = (mode === 'SPLIT_SINGLE_IMPACT') ? 'block' : 'none';
    }

    // ⭐ 依 §5.8 規則：cue.isPrimary 在 PRIMARY_ONLY 必顯示，其他模式標示用途
    const lblPrimary = chkPrimary ? (chkPrimary.nextElementSibling as HTMLElement) : null;
    if (lblPrimary) {
      if (mode === 'PRIMARY_ONLY') {
        lblPrimary.textContent = '⭐ 主要終結打擊點 (PRIMARY_ONLY 於此點顯示完整數值)';
      } else {
        lblPrimary.textContent = '⭐ 標記為主要打擊點 (當前模式保留為特效音畫同步參考點)';
      }
    }
  }

  private bindCueControls(): void {
    const cueCard = document.getElementById('card-cue-inspector');
    if (!cueCard) return;

    const inputId = document.getElementById('param-cue-id') as HTMLInputElement;
    const inputTime = document.getElementById('param-cue-time') as HTMLInputElement;
    const valTime = document.getElementById('val-cue-time');
    const selKind = document.getElementById('param-cue-kind') as HTMLSelectElement;
    const inputWeight = document.getElementById('param-cue-weight') as HTMLInputElement;
    const valWeight = document.getElementById('val-cue-weight');
    const selPolicy = document.getElementById('param-cue-target-policy') as HTMLSelectElement;
    const chkPrimary = document.getElementById('param-cue-is-primary') as HTMLInputElement;
    const btnDelete = document.getElementById('btn-delete-cue') as HTMLButtonElement;

    const updateCurrentCue = (updater: (cue: any) => void, recordHistory = false) => {
      if (this.selectedCueIndex === null) return;
      const cues = [...(this.store.getPreset().impactCues || [])];
      if (this.selectedCueIndex >= 0 && this.selectedCueIndex < cues.length) {
        updater(cues[this.selectedCueIndex]);
        this.store.updateConfig({ impactCues: cues }, recordHistory);
        this.triggerChange();
      }
    };

    inputId?.addEventListener('input', (e) => {
      updateCurrentCue(cue => { cue.cueId = (e.target as HTMLInputElement).value; }, false);
    });

    inputTime?.addEventListener('pointerdown', () => this.store.recordSnapshot());
    inputTime?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (valTime) valTime.textContent = `${val.toFixed(2)}s`;
      updateCurrentCue(cue => { cue.time = val; }, false);
    });

    selKind?.addEventListener('change', (e) => {
      this.store.recordSnapshot();
      updateCurrentCue(cue => { cue.kind = (e.target as HTMLSelectElement).value; }, true);
    });

    inputWeight?.addEventListener('pointerdown', () => this.store.recordSnapshot());
    inputWeight?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (valWeight) valWeight.textContent = val.toFixed(1);
      updateCurrentCue(cue => { cue.weight = val; }, false);
    });

    selPolicy?.addEventListener('change', (e) => {
      this.store.recordSnapshot();
      updateCurrentCue(cue => { cue.targetPolicy = (e.target as HTMLSelectElement).value; }, true);
    });

    chkPrimary?.addEventListener('change', (e) => {
      this.store.recordSnapshot();
      const isChecked = (e.target as HTMLInputElement).checked;
      updateCurrentCue(cue => { cue.isPrimary = isChecked; }, true);
    });

    btnDelete?.addEventListener('click', () => {
      if (this.selectedCueIndex === null) return;
      this.store.recordSnapshot();
      const cues = [...(this.store.getPreset().impactCues || [])];
      if (this.selectedCueIndex >= 0 && this.selectedCueIndex < cues.length) {
        cues.splice(this.selectedCueIndex, 1);
        this.selectedCueIndex = null;
        this.store.updateConfig({ impactCues: cues }, true);
        this.setSelectedCueIndex(null);
      }
    });
  }
}
