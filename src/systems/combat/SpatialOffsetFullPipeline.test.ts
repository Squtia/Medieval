import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { VFXPreset } from '../../models/VFX';

describe('SpatialOffsetFullPipeline - 全特效「落點微調」與「軌道平移」全管線幾何驗證', () => {
  let fxEngine: CombatFXEngine;
  const casterPos = new THREE.Vector3(0, 0, 0);
  const targetPos = new THREE.Vector3(200, 100, 0);

  beforeEach(() => {
    fxEngine = CombatFXEngine.getInstance();
  });

  it('1. ⚔️ 原地近戰揮砍 (SLASH_BLADE / MELEE_SWEEP)：網格群組精準疊加落點微調與軌道平移', () => {
    const slashPreset = {
      id: 'VFX_TEST_SLASH_OFFSET',
      name: '測試劈砍偏移',
      trajectory: 'MELEE_SWEEP',
      shaderMode: 'SLASH_BLADE',
      spatialMode: 'AT_TARGET',
      duration: 0.5,
      targetOffsetX: 40,
      targetOffsetY: -30,
      trackOffsetX: 15,
      trackOffsetY: 10,
      scale: 1.0,
      colorCore: '#ffffff',
      colorRim: '#f59e0b'
    } as unknown as VFXPreset;

    fxEngine.renderFrameWorldAt(slashPreset, 0.25, casterPos, targetPos);

    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    expect(trackGroup).toBeDefined();

    // 預期位置：目標點 B (200, 100) + targetOffset (40, -30) + trackOffset (15, 10) = (255, 80)
    expect(trackGroup.position.x).toBeCloseTo(255, 2);
    expect(trackGroup.position.y).toBeCloseTo(80, 2);
  });

  it('2. ⛰️ 破土尖岩地刺 (EARTH_SHATTER) 與 ☀️ 神聖天降光柱 (HOLY_LIGHT)：受擊錨點與幾何精準位移', () => {
    const holyPillarPreset = {
      id: 'VFX_TEST_HOLY_LIGHT_OFFSET',
      name: '測試神聖光柱偏移',
      spatialMode: 'AT_TARGET',
      shaderMode: 'HOLY_LIGHT',
      duration: 0.6,
      targetOffsetX: -50,
      targetOffsetY: 20,
      trackOffsetX: 10,
      trackOffsetY: 0,
      scale: 1.2,
      colorCore: '#fde047'
    } as unknown as VFXPreset;

    fxEngine.renderFrameWorldAt(holyPillarPreset, 0.3, casterPos, targetPos);

    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    expect(trackGroup).toBeDefined();

    // 預期位置：(200 - 50 + 10, 100 + 20 + 0) = (160, 120)
    expect(trackGroup.position.x).toBeCloseTo(160, 2);
    expect(trackGroup.position.y).toBeCloseTo(120, 2);
  });

  it('3. 🛡️ 神聖壁壘 (SHIELD_BARRIER) 與 💥 目標受擊光環 (AT_TARGET)：群組座標精確依據 endPos 定位', () => {
    const shieldPreset = {
      id: 'VFX_TEST_SHIELD_OFFSET',
      name: '測試護盾偏移',
      spatialMode: 'AT_TARGET',
      shaderMode: 'SHIELD_BARRIER',
      trajectory: 'SHIELD_BARRIER',
      duration: 0.5,
      targetOffsetX: 25,
      targetOffsetY: 35,
      trackOffsetX: -10,
      trackOffsetY: -5,
      scale: 1.0,
      colorCore: '#fde047',
      colorRim: '#eab308'
    } as unknown as VFXPreset;

    fxEngine.renderFrameWorldAt(shieldPreset, 0.25, casterPos, targetPos);

    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    expect(trackGroup).toBeDefined();

    // 預期位置：(200 + 25 - 10, 100 + 35 - 5) = (215, 130)
    expect(trackGroup.position.x).toBeCloseTo(215, 2);
    expect(trackGroup.position.y).toBeCloseTo(130, 2);
  });

  it('4. 🌟 多圖層 (Composite Layers) 正交平行位移：主軌與次生圖層各自獨立設定 trackOffsetX，互不污染', () => {
    // 模擬主軌為正中重劈，圖層 1 向左偏 30px，圖層 2 向右偏 30px，拼裝「三連交錯斬」
    const tripleSlashPreset: any = {
      schemaVersion: 2,
      id: 'VFX_TEST_TRIPLE_SLASH',
      name: '三刃交錯劈砍',
      duration: 0.6,
      spatialMode: 'AT_TARGET',
      trajectory: 'MELEE_SWEEP',
      shaderMode: 'SLASH_BLADE',
      targetOffsetX: 0,
      targetOffsetY: 0,
      trackOffsetX: 0,
      trackOffsetY: 0,
      scale: 1.0,
      tracks: [
        {
          id: 'trk_main',
          name: '主軌刃芒',
          type: 'SLASH',
          enabled: true,
          clips: [
            {
              id: 'c_main',
              startTime: 0,
              duration: 0.6,
              payload: {
                type: 'SLASH',
                data: {
                  shaderMode: 'SLASH_BLADE',
                  trackOffsetX: 0,
                  trackOffsetY: 0
                }
              }
            }
          ]
        }
      ],
      layers: [
        {
          id: 'layer_left_slash',
          name: '左翼錯位斬',
          enabled: true,
          delay: 0,
          duration: 0.6,
          shaderMode: 'SLASH_BLADE',
          trackOffsetX: -30,
          trackOffsetY: 0,
          scale: 0.9
        },
        {
          id: 'layer_right_slash',
          name: '右翼錯位斬',
          enabled: true,
          delay: 0,
          duration: 0.6,
          shaderMode: 'SLASH_BLADE',
          trackOffsetX: 30,
          trackOffsetY: 0,
          scale: 0.9
        }
      ]
    };

    fxEngine.renderFrameWorldAt(tripleSlashPreset, 0.3, casterPos, targetPos);

    const studioGroups = (fxEngine as any).studioTrackGroups;
    expect(studioGroups.length).toBeGreaterThanOrEqual(3);

    const mainGroup = studioGroups[0];
    const leftLayerGroup = studioGroups[1];
    const rightLayerGroup = studioGroups[2];

    // 主軌：正中目標點 (200, 100)
    expect(mainGroup.position.x).toBeCloseTo(200, 2);
    expect(mainGroup.position.y).toBeCloseTo(100, 2);

    // 左翼圖層：左移 30px (170, 100)
    expect(leftLayerGroup.position.x).toBeCloseTo(170, 2);
    expect(leftLayerGroup.position.y).toBeCloseTo(100, 2);

    // 右翼圖層：右移 30px (230, 100)
    expect(rightLayerGroup.position.x).toBeCloseTo(230, 2);
    expect(rightLayerGroup.position.y).toBeCloseTo(100, 2);
  });
});
