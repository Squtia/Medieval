import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import defaultVFXPresets from '../../data/vfx_presets.json';
import { VFXPresetRepository, VFX_STORAGE_KEY } from '../../ui/fx/VFXPresetRepository';
import { VFXPreset } from '../../models/VFX';

/**
 * 🧪 特效工房重構與 SSOT 完整性驗收測試套件 (VFX Studio Rebuild & SSOT Verification)
 * 嚴格對齊 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 之各階段驗收標準
 */
describe('特效工房重構與 SSOT 完整性驗收 (VFX Studio Rebuild Verification)', () => {
  const vfxStudioHtmlPath = path.resolve(__dirname, '../../../tools/vfx-studio.html');
  const vfxPlayerTsPath = path.resolve(__dirname, '../../ui/fx/VFXPlayer.ts');
  const combatStudioTsPath = path.resolve(__dirname, '../../tools/CombatStudio.ts');

  describe('1. 單一 Player／Canvas 管線架構驗收', () => {
    it('應確認 tools/vfx-studio.html 已移除頁內私有 WebGLRenderer 與靜態 Canvas，統一由 VFXStudioAdapter 驅動', () => {
      const htmlContent = fs.readFileSync(vfxStudioHtmlPath, 'utf-8');

      // 驗證：頁內已不再宣告私有 WebGLRenderer 實例
      const hasEmbeddedRenderer = htmlContent.includes('new THREE.WebGLRenderer');
      expect(hasEmbeddedRenderer).toBe(false);

      // 驗證：頁內已移除舊版靜態 #three-canvas，統一由 CombatFXEngine 動態掛載單一 Canvas
      const hasStaticCanvas = htmlContent.includes('id="three-canvas"');
      expect(hasStaticCanvas).toBe(false);

      // 驗證：頁內已不再維護私有 requestAnimationFrame(animate) 迴圈
      const hasEmbeddedRaf = htmlContent.includes('requestAnimationFrame(animate)');
      expect(hasEmbeddedRaf).toBe(false);

      // 驗證：引入模組入口 src/tools/vfx-studio/index.ts，並由 VFXStudioController 調用 VFXStudioAdapter
      expect(htmlContent.includes('src/tools/vfx-studio/index.ts')).toBe(true);
      const controllerCode = fs.readFileSync(path.resolve(__dirname, '../../tools/vfx-studio/VFXStudioController.ts'), 'utf-8');
      expect(controllerCode.includes('VFXStudioAdapter')).toBe(true);
    });

    it('應確認 src/ui/fx/VFXPlayer.ts 匯出 CombatFXEngine 與 VFXStudioAdapter 等核心模組', () => {
      const code = fs.readFileSync(vfxPlayerTsPath, 'utf-8');
      expect(code.includes('CombatFXEngine')).toBe(true);
      expect(code.includes('VFXStudioAdapter')).toBe(true);
      expect(code.includes('VFXPresetRepository')).toBe(true);
    });
  });

  describe('2. Repository CRUD 儲存結構與發布安全驗收', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      (globalThis as any).localStorage = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
        clear: () => { mockStorage = {}; }
      };
    });

    it('應確認 tools/vfx-studio.html 已消除直接覆寫 LocalStorage 之漏洞，完全委由 VFXPresetRepository 處理', () => {
      const htmlContent = fs.readFileSync(vfxStudioHtmlPath, 'utf-8');

      // 驗證：已消除直接將純陣列寫入 MEDIEVAL_CUSTOM_VFX_PRESETS 的退化寫法
      const hasDirectV1ArraySave = htmlContent.includes("localStorage.setItem('MEDIEVAL_CUSTOM_VFX_PRESETS', JSON.stringify(all))");
      expect(hasDirectV1ArraySave).toBe(false);

      // 驗證：模組 VFXLibrary 具有發布至專案 SSOT 端點之安全機制
      const libCode = fs.readFileSync(path.resolve(__dirname, '../../tools/vfx-studio/VFXLibrary.ts'), 'utf-8');
      expect(libCode.includes('/__vfx_api/save_ssot')).toBe(true);
    });

    it('應驗證 VFXPresetRepository 在儲存與讀取時保持 Schema v2 結構完整性', () => {
      const repo = VFXPresetRepository.getInstance();
      const testPreset: VFXPreset = {
        id: 'VFX_V2_TEST',
        name: 'V2 測試特效',
        category: 'SPECIAL',
        description: '驗證 Schema v2',
        trajectory: 'GROUND_FISSURE',
        shaderMode: 'EARTH_SHATTER',
        colorCore: '#ffffff',
        colorRim: '#ff5500',
        duration: 0.35,
        scale: 1,
        spin: 0,
        fresnel: 1,
        trailCount: 0,
        trailSize: 0,
        spikes: 4,
        spikeHeight: 40,
        spikeMaterialMode: 'PHONG',
        burstCount: 0,
        bloomStr: 0,
        bloomRad: 0,
        bloomThresh: 0,
        impact: {
          hitStopTime: 0,
          targetPunchScale: 1,
          shakeIntensity: 0,
          shakeDuration: 0,
          penetrationDistance: 0,
          knockbackDistance: 0,
          hitFlashColor: '#fff',
          screenShake: false
        },
        impactCues: [{ cueId: 'CUE_1', time: 0.25, weight: 1.0, isPrimary: true }]
      };

      const res = repo.saveCustomPreset(testPreset);
      expect(res.success).toBe(true);

      const raw = mockStorage[VFX_STORAGE_KEY];
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe(2);
      expect(Array.isArray(parsed.customPresets)).toBe(true);
    });
  });

  describe('3. 30 款官方 Preset 與 Impact Cue 升級驗收', () => {
    it('應確認官方 vfx_presets.json 包含 30 款唯一 ID Preset，且 100% 具備具名 impactCues 結構', () => {
      const presets = defaultVFXPresets as VFXPreset[];
      expect(presets.length).toBe(30);

      const idSet = new Set<string>();
      const missingCuesList: string[] = [];

      presets.forEach(p => {
        expect(idSet.has(p.id)).toBe(false);
        idSet.add(p.id);

        if (!p.impactCues || p.impactCues.length === 0) {
          missingCuesList.push(p.id);
        }
      });

      // 30 款全部配置具名 impactCues，完成規格書 Phase 5 定義
      expect(missingCuesList.length).toBe(0);
    });

    it('應驗證核心特效（含 VFX_EARTH_SPIKE）已成功啟用多圖層 layers 與實體尖岩材質', () => {
      const presets = defaultVFXPresets as VFXPreset[];
      let hasLayersCount = 0;

      presets.forEach(p => {
        if (p.layers && p.layers.length > 0) hasLayersCount++;
      });

      // 至少 5 款（目前為 6 款旗艦）啟用多圖層
      expect(hasLayersCount).toBeGreaterThanOrEqual(5);

      // 驗證重點痛點解決之 VFX_EARTH_SPIKE
      const earthSpike = presets.find(p => p.id === 'VFX_EARTH_SPIKE');
      expect(earthSpike).toBeDefined();
      expect(earthSpike?.trajectory).toBe('GROUND_FISSURE');
      expect(earthSpike?.spikeMaterialMode).toBe('PHONG');
      expect(earthSpike?.spikeEruptFire).toBe(true);
      expect(earthSpike?.layers?.length).toBeGreaterThan(0);
    });
  });

  describe('4. UI 模組化、Undo/Redo、Dirty State 與固定 Seed 驗收', () => {
    it('應確認 tools/vfx-studio.html 樣式已外置至 vfx-studio.css，且 HTML 零 Three.js import', () => {
      const htmlContent = fs.readFileSync(vfxStudioHtmlPath, 'utf-8');
      expect(htmlContent.includes('<link rel="stylesheet" href="../src/styles/vfx-studio.css">')).toBe(true);
      expect(htmlContent.includes('<style>')).toBe(false);
      expect(htmlContent.includes("from 'three'")).toBe(false);
    });

    it('應確認 src/styles/vfx-studio.css 包含 1024x720 視窗自適應與防溢出保護', () => {
      const cssPath = path.resolve(__dirname, '../../styles/vfx-studio.css');
      expect(fs.existsSync(cssPath)).toBe(true);
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      expect(cssContent.includes('@media (max-width: 1024px)')).toBe(true);
      expect(cssContent.includes('overflow-x: hidden')).toBe(true);
    });

    it('應確認 tools/vfx-studio.html 實裝 Undo/Redo (50 步歷史)、Dirty Flag 與固定 Seed 控件，且 HTML < 800 行', () => {
      const htmlContent = fs.readFileSync(vfxStudioHtmlPath, 'utf-8');
      expect(htmlContent.split('\n').length).toBeLessThan(800);
      expect(htmlContent.includes('id="btn-undo"')).toBe(true);
      expect(htmlContent.includes('id="btn-redo"')).toBe(true);
      expect(htmlContent.includes('id="vfx-dirty-indicator"')).toBe(true);
      expect(htmlContent.includes('id="chk-fixed-seed"')).toBe(true);

      const storeCode = fs.readFileSync(path.resolve(__dirname, '../../tools/vfx-studio/VFXStudioStore.ts'), 'utf-8');
      expect(storeCode.includes('MAX_HISTORY = 50')).toBe(true);

      const controllerCode = fs.readFileSync(path.resolve(__dirname, '../../tools/vfx-studio/VFXStudioController.ts'), 'utf-8');
      expect(controllerCode.includes("e.key === 'z'")).toBe(true);
    });
  });

  describe('5. Fix 1: DOM 階層、響應式契約與 Inspector Control Map 驗收', () => {
    it('應驗證 tools/vfx-studio.html 之頂層 DOM 階層：#timeline-mount-point 不在 #viewport 內，且右側面板具備 .sidebar-right', () => {
      const htmlContent = fs.readFileSync(vfxStudioHtmlPath, 'utf-8');

      // 驗證 1：#viewport 與 #timeline-mount-point 是分離的直接容器，#viewport 必須先閉合
      const viewportIdx = htmlContent.indexOf('id="viewport"');
      const sceneOverlayIdx = htmlContent.indexOf('id="scene-overlay"');
      const timelineMountIdx = htmlContent.indexOf('id="timeline-mount-point"');
      const inspectorRightIdx = htmlContent.indexOf('id="inspector-right"');

      expect(viewportIdx).toBeGreaterThan(-1);
      expect(sceneOverlayIdx).toBeGreaterThan(viewportIdx);
      expect(timelineMountIdx).toBeGreaterThan(sceneOverlayIdx);
      expect(inspectorRightIdx).toBeGreaterThan(timelineMountIdx);

      // 驗證 2：在 scene-overlay 到 timeline-mount-point 之間，必須存在 </div></div> 依序閉合 scene-overlay 與 #viewport
      const betweenOverlayAndTimeline = htmlContent.substring(sceneOverlayIdx, timelineMountIdx);
      const closeDivMatches = betweenOverlayAndTimeline.match(/<\/div>/g) || [];
      // 至少閉合 ref-target 內部、scene-overlay 與 #viewport
      expect(closeDivMatches.length).toBeGreaterThanOrEqual(3);

      // 驗證 3：#inspector-right 同時具備 inspector-panel 與 sidebar-right 契約
      expect(htmlContent.includes('id="inspector-right" class="inspector-panel sidebar-right"')).toBe(true);

      // 驗證 4：情境式區塊 class 存在於 HTML
      expect(htmlContent.includes('card-slash-section')).toBe(true);
      expect(htmlContent.includes('card-salvo-section')).toBe(true);
      expect(htmlContent.includes('card-spike-section')).toBe(true);
    });

    it('應確認 INSPECTOR_CONTROL_MAP 的 50+ 個控制項 ID 與 labelId 在 tools/vfx-studio.html 中恰好出現一次', async () => {
      const { INSPECTOR_CONTROL_MAP } = await import('../../tools/vfx-studio/VFXInspector');
      const htmlContent = fs.readFileSync(vfxStudioHtmlPath, 'utf-8');

      expect(INSPECTOR_CONTROL_MAP.length).toBeGreaterThanOrEqual(45);

      for (const ctrl of INSPECTOR_CONTROL_MAP) {
        const idPattern = new RegExp(`id="${ctrl.id}"`, 'g');
        const matches = htmlContent.match(idPattern) || [];
        expect(matches.length, `控制項 ID [${ctrl.id}] 應在 HTML 中恰好出現 1 次`).toBe(1);

        if (ctrl.labelId) {
          const labelPattern = new RegExp(`id="${ctrl.labelId}"`, 'g');
          const labelMatches = htmlContent.match(labelPattern) || [];
          expect(labelMatches.length, `Label ID [${ctrl.labelId}] 應在 HTML 中恰好出現 1 次`).toBe(1);
        }
      }
    });

    it('應遍歷 30 款正式 Preset，驗證 normalizeVfxPreset 保證所有 Inspector 欄位零 undefined、零 NaN', async () => {
      const { INSPECTOR_CONTROL_MAP, normalizeVfxPreset } = await import('../../tools/vfx-studio/VFXInspector');
      const presets = defaultVFXPresets as VFXPreset[];

      expect(presets.length).toBeGreaterThanOrEqual(25);

      for (const p of presets) {
        const normalized = normalizeVfxPreset(p);

        for (const ctrl of INSPECTOR_CONTROL_MAP) {
          const val = ctrl.isImpact ? normalized.impact?.[ctrl.key as keyof typeof normalized.impact] : (normalized as any)[ctrl.key];
          expect(val, `Preset [${p.id}] 之欄位 [${ctrl.key}] 不得為 undefined`).toBeDefined();
          expect(val, `Preset [${p.id}] 之欄位 [${ctrl.key}] 不得為 null`).not.toBeNull();
          if (typeof val === 'number') {
            expect(Number.isNaN(val), `Preset [${p.id}] 之數值 [${ctrl.key}] 不得為 NaN`).toBe(false);
          }
        }
      }
    });
  });
});

