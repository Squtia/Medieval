import { describe, it, expect, beforeEach } from 'vitest';
import { VFXPreset } from '../../models/VFX';
import { VFXStudioStore, VFXEditorSelection } from './VFXStudioStore';
import { getSelectionCapabilities, INSPECTOR_CONTROL_MAP } from './VFXInspector';
import { MeshLayerRenderer } from '../../ui/fx/renderers/MeshLayerRenderer';

describe('Phase 3 驗收: Inspector 與欄位收斂 (Capability-Driven & SSOT Duration)', () => {
  let store: VFXStudioStore;

  beforeEach(() => {
    store = VFXStudioStore.getInstance();
    store.setSelection({ type: 'PRESET' });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. 選取狀態 Union 測試 (§5.2)
  // ─────────────────────────────────────────────────────────────
  describe('1. 選取狀態 Union (VFXEditorSelection & Store)', () => {
    it('初始選取狀態必須為 PRESET', () => {
      const sel = store.getSelection();
      expect(sel.type).toBe('PRESET');
    });

    it('以穩定 ID 切換選取，訂閱者可即時收到通知且無索引漂移', () => {
      let receivedSelection: VFXEditorSelection | null = null;
      const unsubscribe = store.subscribeSelection((sel) => {
        receivedSelection = sel;
      });

      // 切換為主軌
      store.setSelection({ type: 'MAIN_TRACK' });
      expect(receivedSelection).toEqual({ type: 'MAIN_TRACK' });

      // 切換為副圖層 (以 layerId)
      store.setSelection({ type: 'LAYER', layerId: 'layer_shockwave_1' });
      expect(receivedSelection).toEqual({ type: 'LAYER', layerId: 'layer_shockwave_1' });

      // 切換為 Cue (以 cueId)
      store.setSelection({ type: 'CUE', cueId: 'cue_slash_impact_2' });
      expect(receivedSelection).toEqual({ type: 'CUE', cueId: 'cue_slash_impact_2' });

      // 切換為技能綁定 (以 skillId)
      store.setSelection({ type: 'BINDING', skillId: 'FIGHTER_HEAVY_STRIKE' });
      expect(receivedSelection).toEqual({ type: 'BINDING', skillId: 'FIGHTER_HEAVY_STRIKE' });

      unsubscribe();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Capability-Driven 欄位與卡片顯隱契約 (§5.3 & §8.4)
  // ─────────────────────────────────────────────────────────────
  describe('2. Capability-Driven 欄位與選取顯隱架構', () => {
    const slashPreset: VFXPreset = {
      id: 'VFX_TEST_SLASH',
      name: '測試斬擊',
      category: 'PHYSICAL',
      description: '測試用',
      rendererType: 'SLASH',
      trajectory: 'MELEE_SWEEP',
      shaderMode: 'SLASH_BLADE',
      duration: 0.35,
      impactCues: [
        { time: 0.15, kind: 'IMPACT', cueId: 'cue_1', weight: 1.0 }
      ]
    } as unknown as VFXPreset;

    const projectilePreset: VFXPreset = {
      id: 'VFX_TEST_FIREBALL',
      name: '測試火球',
      category: 'ELEMENTAL',
      description: '測試用',
      rendererType: 'PROJECTILE',
      spatialMode: 'TRAJECTORY',
      trajectoryPath: 'A_TO_B',
      trajectory: 'HORIZONTAL',
      shaderMode: 'VOLUMETRIC_FIRE',
      duration: 0.5,
      salvoCount: 3,
      impactCues: []
    } as unknown as VFXPreset;

    it('選中斬擊主軌時，必須具備 TRANSFORM, TRAJECTORY, SLASH_GEOMETRY, IMPACT_FEEDBACK 等能力', () => {
      const caps = getSelectionCapabilities(slashPreset, { type: 'MAIN_TRACK' });
      expect(caps.has('TRANSFORM')).toBe(true);
      expect(caps.has('TRAJECTORY')).toBe(true);
      expect(caps.has('SLASH_GEOMETRY')).toBe(true);
      expect(caps.has('IMPACT_FEEDBACK')).toBe(true);
      expect(caps.has('PROJECTILE_GEOMETRY')).toBe(false);
      expect(caps.has('CUE')).toBe(false);
    });

    it('選中投射物時，必須具備 PROJECTILE_GEOMETRY 與 FIRE_SHADER 能力，但不具備 SLASH_GEOMETRY', () => {
      const caps = getSelectionCapabilities(projectilePreset, { type: 'MAIN_TRACK' });
      expect(caps.has('PROJECTILE_GEOMETRY')).toBe(true);
      expect(caps.has('FIRE_SHADER')).toBe(true);
      expect(caps.has('SLASH_GEOMETRY')).toBe(false);
    });

    it('選中 Cue 時，必須具備 CUE 能力，且保有打擊反饋與施法動作能力以利微調對齊', () => {
      const caps = getSelectionCapabilities(slashPreset, { type: 'CUE', cueId: 'cue_1' });
      expect(caps.has('CUE')).toBe(true);
      expect(caps.has('IMPACT_FEEDBACK')).toBe(true);
      expect(caps.has('CASTER_MOTION')).toBe(true);
      expect(caps.has('SLASH_GEOMETRY')).toBe(true);
    });

    it('選中 Binding 時，僅具備 BINDING 能力', () => {
      const caps = getSelectionCapabilities(slashPreset, { type: 'BINDING', skillId: 'SKILL_SLASH' });
      expect(caps.size).toBe(1);
      expect(caps.has('BINDING')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 無效控制項處置與 Legacy 欄位收斂 (§5.6 & §5.7)
  // ─────────────────────────────────────────────────────────────
  describe('3. 無效控制項處置與 Legacy 欄位隔離', () => {
    it('Legacy trajectory 與未實作之 textureSprite 必須標記為 isLegacy/isHidden', () => {
      const legacyTrajConfig = INSPECTOR_CONTROL_MAP.find(c => c.id === 'param-trajectory');
      expect(legacyTrajConfig).toBeDefined();
      expect(legacyTrajConfig?.isLegacy).toBe(true);
      expect(legacyTrajConfig?.isHidden).toBe(true);

      const textureSpriteConfig = INSPECTOR_CONTROL_MAP.find(c => c.id === 'param-texture-sprite');
      expect(textureSpriteConfig).toBeDefined();
      expect(textureSpriteConfig?.isHidden).toBe(true);
    });

    it('重複之 param-duration 滑桿必須自 INSPECTOR_CONTROL_MAP 移除，確保只有唯一時間軸控制器', () => {
      const duplicateDuration = INSPECTOR_CONTROL_MAP.find(c => c.id === 'param-duration');
      expect(duplicateDuration).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Runtime 幾何與材質控制項真實生效驗證 (§5.7 完成條件)
  // ─────────────────────────────────────────────────────────────
  describe('4. 控制項 Runtime 實質生效 (Non-Mocked Real Geometry Evaluation)', () => {
    it('waveCount: 傳入不同圈數 (如 1 與 5) 必須產生可觀察之音波環網格數量差異', () => {
      const group1 = MeshLayerRenderer.buildTauntShoutGroup(1, '#ef4444');
      const waves1 = (group1 as any).__waves;
      expect(waves1).toBeDefined();
      expect(waves1.length).toBe(1);

      const group5 = MeshLayerRenderer.buildTauntShoutGroup(5, '#ef4444');
      const waves5 = (group5 as any).__waves;
      expect(waves5).toBeDefined();
      expect(waves5.length).toBe(5);
    });

    it('waveRadius / waveThickness / waveBlur: 傳入幾何參數必須實質寫入網格屬性與材質不透明度', () => {
      const g1 = MeshLayerRenderer.buildTauntShoutGroup(2, '#ef4444', 120, 8, 80);
      expect((g1 as any).__waveRadius).toBe(120);
      const waves = (g1 as any).__waves;
      expect(waves.length).toBe(2);
      expect(waves[0].baseOpacity).toBeLessThan(0.95);
      expect(waves[0].mesh.geometry.parameters.outerRadius).toBe(15 + 8);
    });

    it('次生圖層 spatialMode 隔離：更新次生圖層為 AT_TARGET 時不污染 Sequence 頂層且寫入圖層物件', () => {
      const store = VFXStudioStore.getInstance();
      store.setSequence({
        id: 'SEQ_TEST_ISOLATION',
        name: '測試隔離序列',
        duration: 1.0,
        spatialMode: 'A_TO_B',
        tracks: [
          { id: 'trk_main', name: '主軌', type: 'MESH', enabled: true, clips: [{ id: 'c1', startTime: 0, duration: 1, payload: { type: 'MESH', data: { spatialMode: 'A_TO_B' } } }] },
          { id: 'layer_shock_1', name: '震波圖層', type: 'MESH', enabled: true, clips: [{ id: 'c2', startTime: 0.2, duration: 0.4, payload: { type: 'MESH', data: { spatialMode: 'AT_CASTER' } } }] }
        ],
        layers: [
          { id: 'layer_shock_1', name: '震波圖層', delay: 0.2, duration: 0.4, spatialMode: 'AT_CASTER' as any }
        ]
      } as any, false);

      // 選取次生圖層
      store.setSelection({ type: 'LAYER', layerId: 'layer_shock_1' });
      // 更新空間模式為受擊目標
      store.updateConfig({ spatialMode: 'AT_TARGET' as any }, false);

      const seq = store.getSequence();
      // 1. 頂層 Sequence 嚴格維持原樣，絕不被污染
      expect(seq.spatialMode).toBe('A_TO_B');
      // 2. 次生圖層 layer 物件已正確更新為 AT_TARGET
      expect(seq.layers?.[0].spatialMode).toBe('AT_TARGET');
      // 3. 次生圖層 Clip 也已正確更新為 AT_TARGET
      const layerClip = seq.tracks.find(t => t.id === 'layer_shock_1')?.clips[0];
      expect((layerClip?.payload.data as any)?.spatialMode).toBe('AT_TARGET');
    });

    it('新技能打擊感解鎖：新建技能無 IMPACT 軌道時，調整 impact 必須自動建立 IMPACT 軌道且正確寫入頂層與 Clip', () => {
      const store = VFXStudioStore.getInstance();
      // 模擬全新技能（只有主軌，完全沒有 IMPACT 軌道，就像使用者新建立的「連續地刺」）
      store.setSequence({
        id: 'VFX_CUSTOM_NEW_SKILL',
        name: '全新技能測試',
        duration: 2.0,
        spatialMode: 'TRAJECTORY',
        tracks: [
          {
            id: 'trk_main',
            name: '主軌',
            type: 'MESH',
            enabled: true,
            clips: [{ id: 'c1', startTime: 0, duration: 1, payload: { type: 'MESH', data: {} } }]
          }
        ],
        impactCues: []
      } as any, false);

      // 使用者拖動打擊感滑桿：定格 80ms、擠壓 0.75x、震動 20px、擊退 25px
      store.updateConfig({
        impact: {
          hitStopTime: 80,
          targetPunchScale: 0.75,
          shakeIntensity: 20,
          shakeDuration: 0.35,
          knockbackDistance: 25,
          hitFlashColor: '#ff0000'
        } as any
      }, false);

      const seq = store.getSequence();
      // 1. 頂層 Sequence 必須正確保存 impact
      expect((seq as any).impact?.hitStopTime).toBe(80);
      expect((seq as any).impact?.shakeIntensity).toBe(20);

      // 2. 必須自動補齊標準 Canonical IMPACT 軌道
      const impactTrack = seq.tracks.find(t => t.type === 'IMPACT');
      expect(impactTrack).toBeDefined();
      expect(impactTrack?.clips.length).toBe(1);
      expect((impactTrack?.clips[0].payload.data as any)?.hitStopTime).toBe(80);
      expect((impactTrack?.clips[0].payload.data as any)?.knockbackDistance).toBe(25);

      // 3. 回讀 getPreset() / normalizeVfxPreset 必須 100% 讀出新數值，不再死鎖在 55ms
      const preset = store.getPreset();
      expect(preset.impact?.hitStopTime).toBe(80);
      expect(preset.impact?.targetPunchScale).toBe(0.75);
      expect(preset.impact?.shakeIntensity).toBe(20);
    });

    it('shieldShape: 傳入 HEX、CROSS_SHIELD、RUNE_RING 必須產生結構與形態差異', () => {
      const hexGroup = MeshLayerRenderer.buildHolyShieldGroup(1.0, '#fde047', '#eab308', 'HEX');
      const crossGroup = MeshLayerRenderer.buildHolyShieldGroup(1.0, '#fde047', '#eab308', 'CROSS_SHIELD');
      const runeGroup = MeshLayerRenderer.buildHolyShieldGroup(1.0, '#fde047', '#eab308', 'RUNE_RING');

      expect((hexGroup as any).__shieldParts.shape).toBe('HEX');
      expect((crossGroup as any).__shieldParts.shape).toBe('CROSS_SHIELD');
      expect((runeGroup as any).__shieldParts.shape).toBe('RUNE_RING');

      // RUNE_RING 移除實體十字
      expect((runeGroup as any).__shieldParts.crossVMesh.parent).toBeNull();
      // CROSS_SHIELD 保留實體十字
      expect((crossGroup as any).__shieldParts.crossVMesh.parent).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. 唯一總時長契約與縮短不默默裁切驗證 (§5.5 & §5.4)
  // ─────────────────────────────────────────────────────────────
  describe('5. 唯一總時長契約與縮短防禦機制 (§5.5)', () => {
    it('時間軸頂部具備 range 與 number 複合控制項，且右側不再有重複的 param-duration', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const htmlPath = path.resolve(__dirname, '../../../tools/vfx-studio.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');

      // 右側重複控制項已移除
      expect(html.includes('id="param-duration"')).toBe(false);

      // 時間軸具備溢出確認對話框容器
      const { TimelineView } = await import('../../tools/vfx-studio/timeline/TimelineView');
      const rendered = TimelineView.renderHTML({
        preset: { id: 'test', duration: 1.0 } as any,
        duration: 1.0,
        totalFrames: 60,
        isPaused: true,
        selectedClipIndex: null,
        selectedCueIndex: null,
        trackMuteStates: { main: false, layers: false, impact: false },
        soloTrack: null,
        allPresets: [],
        isTrackLocked: () => false,
        isTrackSoloed: () => false
      });

      expect(rendered.includes('id="tl-input-duration"')).toBe(true);
      expect(rendered.includes('id="tl-range-duration"')).toBe(true);
      expect(rendered.includes('id="tl-duration-overflow-dialog"')).toBe(true);
      expect(rendered.includes('id="tl-btn-dur-extend"')).toBe(true);
      expect(rendered.includes('id="tl-btn-dur-scale"')).toBe(true);
      expect(rendered.includes('id="tl-btn-dur-cancel"')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. 模式相依欄位顯隱規則驗證 (§5.8)
  // ─────────────────────────────────────────────────────────────
  describe('6. 模式相依欄位顯隱規則 (§5.8)', () => {
    it('Fire turbulence 與 Fresnel 在能力解析中嚴格排他匹配相應著色器', () => {
      const firePreset: VFXPreset = {
        id: 'FIRE',
        shaderMode: 'VOLUMETRIC_FIRE',
        rendererType: 'PROJECTILE'
      } as any;

      const icePreset: VFXPreset = {
        id: 'ICE',
        shaderMode: 'FRESNEL_ICE',
        rendererType: 'PROJECTILE'
      } as any;

      const fireCaps = getSelectionCapabilities(firePreset, { type: 'MAIN_TRACK' });
      expect(fireCaps.has('FIRE_SHADER')).toBe(true);
      expect(fireCaps.has('ICE_SHADER')).toBe(false);

      const iceCaps = getSelectionCapabilities(icePreset, { type: 'MAIN_TRACK' });
      expect(iceCaps.has('ICE_SHADER')).toBe(true);
      expect(fireCaps.has('ICE_SHADER')).toBe(false);
    });

    it('Shield 幾何能力僅在 SHIELD 渲染器或盾牌預設時賦予', () => {
      const shieldPreset: VFXPreset = {
        id: 'VFX_HOLY_SHIELD',
        rendererType: 'SHIELD'
      } as any;

      const slashPreset: VFXPreset = {
        id: 'SLASH',
        rendererType: 'SLASH'
      } as any;

      const shieldCaps = getSelectionCapabilities(shieldPreset, { type: 'MAIN_TRACK' });
      expect(shieldCaps.has('SHIELD_GEOMETRY')).toBe(true);

      const slashCaps = getSelectionCapabilities(slashPreset, { type: 'MAIN_TRACK' });
      expect(slashCaps.has('SHIELD_GEOMETRY')).toBe(false);
    });
  });
});

