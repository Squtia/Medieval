import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VFXStudioStore } from './VFXStudioStore';
import { VFXInspector, INSPECTOR_CONTROL_MAP } from './VFXInspector';
import { VFXTimeline } from './VFXTimeline';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { MeshLayerRenderer } from '../../ui/fx/renderers/MeshLayerRenderer';
import { ImpactLayerRenderer } from '../../ui/fx/renderers/ImpactLayerRenderer';
import * as THREE from 'three';

// 輕量 Mock DOM
class MockDOMElement {
  public id: string = '';
  public value: string = '';
  public checked: boolean = false;
  public textContent: string = '';
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  private listeners: Record<string, Function[]> = {};

  constructor(id: string = '') {
    this.id = id;
  }

  public addEventListener(type: string, fn: Function): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }

  public dispatchEvent(event: { type: string; [key: string]: any }): void {
    const list = this.listeners[event.type] || [];
    for (const fn of list) {
      fn({ target: this, currentTarget: this, ...event });
    }
  }

  public setPointerCapture(_id: number): void {}
  public releasePointerCapture(_id: number): void {}
  public getBoundingClientRect() {
    return { left: 0, top: 0, width: 200, height: 20 };
  }
  public querySelector(_sel: string) { return null; }
  public querySelectorAll(_sel: string) { return []; }
}

describe('⚡ VFX Studio 實質互動與全參數連通測試 (Fix 1 + Fix 2 核心驗收)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).document = {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    };
  });

  describe('1. 參數契約與雙向相容性', () => {
    it('應驗證 INSPECTOR_CONTROL_MAP 中 flameSpeed 已正確對齊至 flameTurbulenceSpeed 鍵名', () => {
      const flameCtrl = INSPECTOR_CONTROL_MAP.find(c => c.id === 'param-flame-speed');
      expect(flameCtrl).toBeDefined();
      expect(flameCtrl?.key).toBe('flameTurbulenceSpeed');
    });

    it('應驗證 MeshLayerRenderer 建立的 Fresnel Shader Material 具備動態 uFresnel uniform 且非寫死數值', () => {
      const mat = MeshLayerRenderer.createFresnelShaderMaterial('#ffffff', '#38bdf8', 3.5);
      expect(mat.uniforms.uFresnel).toBeDefined();
      expect(mat.uniforms.uFresnel.value).toBe(3.5);
      expect(mat.fragmentShader).toContain('uFresnel');
    });

    it('應驗證 ImpactLayerRenderer 能夠接收 thickness 與 blur 參數且更新不報錯', () => {
      const scene = new THREE.Scene();
      const wave = ImpactLayerRenderer.spawnImpactWave(scene, new THREE.Vector3(0, 0, 0), {
        radius: 80,
        thickness: 12,
        blur: 50,
        color: '#ff0000',
        plane: 'GROUND'
      });

      expect(wave).toBeDefined();
      expect(typeof wave.update).toBe('function');
      expect(typeof wave.dispose).toBe('function');

      const isDone = wave.update(0.1);
      expect(typeof isDone).toBe('boolean');
      wave.dispose();
      expect(scene.children.length).toBe(0);
    });
  });

  describe('2. 即時熱響應 (Live Reactive Notification)', () => {
    it('應驗證 VFXInspector 支援 onParamChange，在 input 事件觸發時即時通知回調', () => {
      const mockLeft = new MockDOMElement('left') as any;
      const mockRight = new MockDOMElement('right') as any;
      const inspector = new VFXInspector(mockLeft, mockRight);

      // 建立假 input 元素
      const sliderEl = new MockDOMElement('param-slash-angle');
      sliderEl.value = '-60';
      vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'param-slash-angle') return sliderEl as any;
        return null;
      });

      let changedPreset: any = null;
      inspector.onParamChange((preset) => {
        changedPreset = preset;
      });

      inspector.bindAll();

      // 模擬使用者操作：滑桿拖動至 -60
      sliderEl.value = '-60';
      sliderEl.dispatchEvent({ type: 'input' });

      expect(changedPreset).not.toBeNull();
      expect(changedPreset.slashAngle).toBe(-60);
    });
  });

  describe('3. 時間軸 Scrubbing 與 Playhead 拖曳', () => {
    it('應驗證 VFXTimeline 具備 onScrubStart, onScrub, onScrubEnd 且拖曳尺規時觸發 CombatFXEngine.seek()', () => {
      const mockContainer = new MockDOMElement('timeline-container') as any;
      const rulerBar = new MockDOMElement('tl-ruler-bar');
      const playhead = new MockDOMElement('tl-playhead');
      const timeDisplay = new MockDOMElement('tl-time-display');

      (mockContainer as any).querySelector = vi.fn((sel: string) => {
        if (sel === '#tl-ruler-bar') return rulerBar as any;
        if (sel === '#tl-playhead') return playhead as any;
        if (sel === '#tl-time-display') return timeDisplay as any;
        return null;
      });

      const timeline = new VFXTimeline(mockContainer);

      let scrubStarted = false;
      let scrubbedTime = -1;
      let scrubEndedTime = -1;

      timeline.onScrubStart(() => { scrubStarted = true; });
      timeline.onScrub((t) => { scrubbedTime = t; });
      timeline.onScrubEnd((t) => { scrubEndedTime = t; });

      const fxEngine = CombatFXEngine.getInstance();
      const seekSpy = vi.spyOn(fxEngine, 'seek');

      // 觸發刻度尺 pointerdown (模擬點擊在 50% 位置，若 duration=0.35 則 t 約 0.18s)
      rulerBar.dispatchEvent({
        type: 'pointerdown',
        pointerId: 1,
        clientX: 100 // 100 / 200 = 50%
      });

      expect(scrubStarted).toBe(true);
      expect(seekSpy).toHaveBeenCalled();
      expect(scrubbedTime).toBeGreaterThan(0);

      // 觸發 pointerup
      rulerBar.dispatchEvent({
        type: 'pointerup',
        pointerId: 1,
        clientX: 100
      });

      expect(scrubEndedTime).toBeGreaterThan(0);
    });

    it('應驗證 VFXTimeline 支援 setPaused, seekTo 且支援單格步進', () => {
      const mockContainer = new MockDOMElement('timeline-container') as any;
      const rulerBar = new MockDOMElement('tl-ruler-bar');
      const playhead = new MockDOMElement('tl-playhead');
      const timeDisplay = new MockDOMElement('tl-time-display');
      const btnPlayPause = new MockDOMElement('tl-btn-play-pause');

      (mockContainer as any).querySelector = vi.fn((sel: string) => {
        if (sel === '#tl-ruler-bar') return rulerBar as any;
        if (sel === '#tl-playhead') return playhead as any;
        if (sel === '#tl-time-display') return timeDisplay as any;
        if (sel === '#tl-btn-play-pause') return btnPlayPause as any;
        return null;
      });

      const timeline = new VFXTimeline(mockContainer);
      expect(timeline.getIsPaused()).toBe(false);

      timeline.setPaused(true);
      expect(timeline.getIsPaused()).toBe(true);

      let scrubbedTime = -1;
      timeline.onScrub((t) => { scrubbedTime = t; });

      timeline.seekTo(0.12);
      expect(timeline.getCurrentTime()).toBeCloseTo(0.12, 1);
      expect(scrubbedTime).toBeCloseTo(0.12, 1);
    });
  });

  describe('4. Inspector 孤兒控制項修復驗證', () => {
    it('應驗證 INSPECTOR_CONTROL_MAP 包含 glowRadius 與 glowOpacity', () => {
      const mockLeft = new MockDOMElement('left') as any;
      const mockRight = new MockDOMElement('right') as any;
      const inspector = new VFXInspector(mockLeft, mockRight);

      const glowRadiusEl = new MockDOMElement('param-glow-radius');
      glowRadiusEl.value = '110';
      vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'param-glow-radius') return glowRadiusEl as any;
        return null;
      });

      let changedPreset: any = null;
      inspector.onParamChange((p) => { changedPreset = p; });
      inspector.bindAll();

      glowRadiusEl.value = '110';
      glowRadiusEl.dispatchEvent({ type: 'input' });

      expect(changedPreset).not.toBeNull();
      expect(changedPreset.glowRadius).toBe(110);
    });
  });

  describe('5. Cue Inspector 點擊選取、屬性連動與資料閉環驗證', () => {
    it('應驗證 setSelectedCueIndex 可展開卡片、帶入屬性值，且修改後即時同步至 Store', () => {
      const mockLeft = new MockDOMElement('left') as any;
      const mockRight = new MockDOMElement('right') as any;
      const inspector = new VFXInspector(mockLeft, mockRight);

      const cardEl = new MockDOMElement('card-cue-inspector');
      cardEl.style.display = 'none';

      const inputId = new MockDOMElement('param-cue-id');
      const inputTime = new MockDOMElement('param-cue-time');
      const selectKind = new MockDOMElement('param-cue-kind');
      const inputWeight = new MockDOMElement('param-cue-weight');
      const selectPolicy = new MockDOMElement('param-cue-target-policy');
      const checkPrimary = new MockDOMElement('param-cue-is-primary');
      const btnDelete = new MockDOMElement('btn-delete-cue');

      vi.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        switch (id) {
          case 'card-cue-inspector': return cardEl as any;
          case 'param-cue-id': return inputId as any;
          case 'param-cue-time': return inputTime as any;
          case 'param-cue-kind': return selectKind as any;
          case 'param-cue-weight': return inputWeight as any;
          case 'param-cue-target-policy': return selectPolicy as any;
          case 'param-cue-is-primary': return checkPrimary as any;
          case 'btn-delete-cue': return btnDelete as any;
          default: return null;
        }
      });

      inspector.bindAll();

      const store = VFXStudioStore.getInstance();
      store.updateConfig({
        impactCues: [
          { cueId: 'HIT_TEST_1', time: 0.18, kind: 'IMPACT', weight: 1.5, isPrimary: true, targetPolicy: 'PRIMARY_TARGET' },
          { cueId: 'HEAL_TEST_2', time: 0.35, kind: 'HEAL', weight: 1.0, isPrimary: false, targetPolicy: 'CASTER' }
        ]
      }, false);

      // 1. 選中第 0 個 Cue
      inspector.setSelectedCueIndex(0);
      expect(cardEl.style.display).toBe('block');
      expect(inputId.value).toBe('HIT_TEST_1');
      expect(inputTime.value).toBe('0.18');
      expect(selectKind.value).toBe('IMPACT');
      expect(inputWeight.value).toBe('1.5');
      expect(checkPrimary.checked).toBe(true);
      expect(selectPolicy.value).toBe('PRIMARY_TARGET');

      // 2. 修改 weight 數值
      inputWeight.value = '2.8';
      inputWeight.dispatchEvent({ type: 'input' });
      expect(store.getPreset().impactCues?.[0].weight).toBe(2.8);

      // 3. 修改 kind
      selectKind.value = 'VISUAL_ONLY';
      selectKind.dispatchEvent({ type: 'change' });
      expect(store.getPreset().impactCues?.[0].kind).toBe('VISUAL_ONLY');

      // 4. 取消選取 (null)
      inspector.setSelectedCueIndex(null);
      expect(cardEl.style.display).toBe('none');
    });
  });
});
