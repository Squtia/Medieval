import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { TargetType } from '../../models/Skill';
import { CombatStageAdapter } from './adapters/CombatStageAdapter';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';

// 輕量 Mock DOM 元素
class MockElement {
  public id: string = '';
  public style: Record<string, string> = {};
  public children: MockElement[] = [];
  public clientWidth: number = 1000;
  public clientHeight: number = 600;
  private rect: any;

  constructor(id: string = '', rect: any = { left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 }) {
    this.id = id;
    this.rect = rect;
  }

  public appendChild(child: MockElement): void {
    this.children.push(child);
  }

  public querySelector(sel: string): MockElement | null {
    if (sel.startsWith('#')) {
      const targetId = sel.substring(1);
      if (this.id === targetId) return this;
      for (const ch of this.children) {
        const found = ch.querySelector(sel);
        if (found) return found;
      }
    }
    return null;
  }

  public getBoundingClientRect() {
    return this.rect;
  }
}

describe('TargetAnchorAndSalvoRhythm - 戰鬥目標幾何中心與彈幕散佈節奏測試', () => {
  let adapter: CombatStageAdapter;
  let mockModal: MockElement;
  let playerTeamEl: MockElement;
  let enemyTeamEl: MockElement;

  beforeEach(() => {
    mockModal = new MockElement('combat-modal', {
      left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600
    });
    playerTeamEl = new MockElement('combat-player-team', {
      left: 50, top: 100, right: 350, bottom: 400, width: 300, height: 300
    });
    enemyTeamEl = new MockElement('combat-enemy-team', {
      left: 650, top: 100, right: 950, bottom: 400, width: 300, height: 300
    });

    mockModal.appendChild(playerTeamEl);
    mockModal.appendChild(enemyTeamEl);

    adapter = CombatStageAdapter.getInstance();
    adapter.mount(mockModal as any);
  });

  describe('🎯 1. 目標中心 B 點固定幾何定位 (與死活解耦)', () => {
    it('全體技能 (ALL_ENEMIES) 應精準落於敵方九宮格中排中 (正中心)', () => {
      const pt = adapter.resolveTargetAnchorPoint(TargetType.ALL_ENEMIES, true);
      // enemyTeamLeft = 650, width = 300 -> center = 800
      // enemyTeamTop = 100, height = 300 -> center = 250
      expect(pt.x).toBe(800);
      expect(pt.y).toBe(250);
    });

    it('敵方前排 (FRONT_ENEMIES) 應落於敵方右側席位靠左的前排欄位中心', () => {
      const pt = adapter.resolveTargetAnchorPoint(TargetType.FRONT_ENEMIES, true);
      // 右側席位前排在 X=1/6: 650 + 300 * (1/6) = 700
      expect(pt.x).toBe(700);
      expect(pt.y).toBe(250);
    });

    it('敵方後排 (BACK_ENEMY) 應落於敵方右側席位靠右的後排欄位中心', () => {
      const pt = adapter.resolveTargetAnchorPoint(TargetType.BACK_ENEMY, true);
      // 右側席位後排在 X=5/6: 650 + 300 * (5/6) = 900
      expect(pt.x).toBe(900);
      expect(pt.y).toBe(250);
    });

    it('我方全體 (ALL_ALLIES) 應精準落於我方陣型中排中', () => {
      const pt = adapter.resolveTargetAnchorPoint(TargetType.ALL_ALLIES, true);
      // playerTeamLeft = 50, width = 300 -> center = 200
      expect(pt.x).toBe(200);
      expect(pt.y).toBe(250);
    });
  });

  describe('🚀 2. 彈幕散佈隨機性 (極座標圓盤散佈非空心圓)', () => {
    it('多發彈幕在受擊散佈時，各子彈距中心的半徑應具有非等長隨機性，絕非正圓周等分', () => {
      const group = new THREE.Group();
      const cache: any = {};
      const start = new THREE.Vector3(-100, 0, 0);
      const end = new THREE.Vector3(100, 0, 0);

      MeshLayerRenderer.updateArcMulti(
        group,
        start,
        end,
        0.5,
        1.0,
        '#38bdf8',
        cache,
        7,
        undefined,
        0,
        60, // 散佈半徑 60px
        0,
        'ARC_MULTI',
        '#ffffff',
        { trailCount: 10, trailSize: 8, trailColor: '#38bdf8' },
        75,
        0.85,
        1.0,
        'LINEAR'
      );

      const arcs = cache.multiArcs;
      expect(arcs).toBeDefined();
      expect(arcs.length).toBe(7);

      const radii = arcs.map((a: any) => Math.sqrt(a.targetOffsetX * a.targetOffsetX + a.targetOffsetY * a.targetOffsetY));
      
      // 若是舊版空心圓，所有子彈的半徑全部嚴格等於 60
      // 隨機圓盤散佈下，半徑必須各不相同且分佈在 0~60 範圍內
      const allIdentical = radii.every((r: number) => Math.abs(r - radii[0]) < 0.001);
      expect(allIdentical).toBe(false);

      radii.forEach((r: number) => {
        expect(r).toBeLessThanOrEqual(60.001);
        expect(r).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('⏱️ 3. 彈幕節奏曲線 (Salvo Rhythm Curve)', () => {
    it('ACCELERATE 與 DECELERATE 應呈現相反的時間梯度階梯', () => {
      const group = new THREE.Group();
      const cacheAcc: any = {};
      const cacheDec: any = {};
      const start = new THREE.Vector3(-100, 0, 0);
      const end = new THREE.Vector3(100, 0, 0);

      MeshLayerRenderer.updateArcMulti(group, start, end, 0.5, 1.0, '#38bdf8', cacheAcc, 5, undefined, 0, 0, 0, 'ARC_MULTI', '#ffffff', undefined, 75, 0.85, 1.0, 'ACCELERATE');
      MeshLayerRenderer.updateArcMulti(group, start, end, 0.5, 1.0, '#38bdf8', cacheDec, 5, undefined, 0, 0, 0, 'ARC_MULTI', '#ffffff', undefined, 75, 0.85, 1.0, 'DECELERATE');

      const accDelays = cacheAcc.multiArcs.map((a: any) => a.delay);
      const decDelays = cacheDec.multiArcs.map((a: any) => a.delay);

      // ACCELERATE 前慢後快（前期間隔大，後期急促）
      // DECELERATE 前快後慢（前期急促，後期間隔大）
      const accMidStep = accDelays[2] - accDelays[1];
      const decMidStep = decDelays[2] - decDelays[1];
      expect(accDelays[0]).toBe(0);
      expect(decDelays[0]).toBe(0);
      expect(accDelays[4]).toBeCloseTo(decDelays[4], 2);
      expect(accMidStep).not.toEqual(decMidStep);
    });

    it('VOLLEY_SYNC 應使所有子彈在極小時間窗 (<=0.03s) 內同步齊射', () => {
      const group = new THREE.Group();
      const cacheVolley: any = {};
      const start = new THREE.Vector3(-100, 0, 0);
      const end = new THREE.Vector3(100, 0, 0);

      MeshLayerRenderer.updateArcMulti(group, start, end, 0.5, 1.0, '#38bdf8', cacheVolley, 6, undefined, 0, 0, 0, 'ARC_MULTI', '#ffffff', undefined, 75, 0.85, 1.0, 'VOLLEY_SYNC');

      const delays = cacheVolley.multiArcs.map((a: any) => a.delay);
      delays.forEach((d: number) => {
        expect(d).toBeLessThanOrEqual(0.03);
      });
    });
  });

  describe('🌪️ 4. 原地擴充立體拖尾羽流 (Trail Spread & Strands)', () => {
    it('trailSpread > 0 時，尾部粒子的 Y/Z 軸應產生錐形徑向發散', () => {
      const group = new THREE.Group();
      const cacheSpread: any = {};
      const start = new THREE.Vector3(-100, 0, 0);
      const end = new THREE.Vector3(100, 0, 0);

      MeshLayerRenderer.updateArcMulti(
        group,
        start,
        end,
        0.5,
        1.0,
        '#38bdf8',
        cacheSpread,
        1,
        undefined,
        0,
        0,
        0,
        'ARC_MULTI',
        '#ffffff',
        { trailCount: 20, trailSize: 8, trailColor: '#38bdf8', trailSpread: 25, trailStrands: 2 },
        75,
        0.85,
        1.0,
        'LINEAR'
      );

      const arc = cacheSpread.multiArcs[0];
      expect(arc.trailGeo).toBeDefined();
      const posArr = arc.trailGeo.attributes.position.array;

      // 檢查末端粒子是否有非零的 Y/Z 散佈
      let hasRadialOffset = false;
      for (let k = 0; k < 5; k++) {
        const y = posArr[k * 3 + 1];
        const z = posArr[k * 3 + 2];
        if (Math.abs(y) > 0.1 || Math.abs(z) > 0.1) {
          hasRadialOffset = true;
          break;
        }
      }
      expect(hasRadialOffset).toBe(true);
    });
  });
});
