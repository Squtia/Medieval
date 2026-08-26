import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { MapNode, NodeFeature } from '../models/types';
import { TaskType } from '../models/DispatchTask';
import { buildTradeRouteSegments, getNodeIcon, getNodeTextureKey } from './MapPresentation';
import { positionFloatingElement } from './FloatingPosition';

interface CombatBeacon {
  container: Phaser.GameObjects.Container;
  tweens: Phaser.Tweens.Tween[];
}

export class MapScene extends Phaser.Scene {
  private routeGraphics!: Phaser.GameObjects.Graphics;
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private fogTexture!: Phaser.Textures.CanvasTexture;
  private fogImage!: Phaser.GameObjects.Image;
  private fogCellCanvas: HTMLCanvasElement | null = null;
  private explorationRangeTexture!: Phaser.Textures.CanvasTexture;
  private explorationRangeImage!: Phaser.GameObjects.Image;
  private explorationRangeCellCanvas: HTMLCanvasElement | null = null;
  private explorationGraphics!: Phaser.GameObjects.Graphics;
  private nodeContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private caravans: Phaser.GameObjects.Text[] = [];
  private caravanTweens: Phaser.Tweens.Tween[] = [];
  private combatBeacons: Map<string, CombatBeacon> = new Map();
  private readonly resizeHandler = () => this.updateCameraZoomAndLimits();
  private readonly explorationSelectionHandler = (event: Event) => {
    const detail = (event as CustomEvent<{ active?: boolean }>).detail;
    this.renderExplorationTargetRange(Boolean(detail?.active));
  };
  
  private clickStartX = 0;
  private clickStartY = 0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  
  constructor() {
    super({ key: 'MapScene' });
  }

  preload() {
    const base = import.meta.env.BASE_URL || './';
    const cleanBase = base.endsWith('/') ? base : base + '/';
    // 載入背景圖
    this.load.image('bg-map', `${cleanBase}bg-map.webp`);
    this.load.svg('combat-sword', `${cleanBase}assets/combat_sword.svg`, { width: 48, height: 96 });

    // 載入 Isometric 地圖節點圖示 (v2 簡潔高對比風格)
    this.load.image('node-castle', `${cleanBase}assets/node_castle.png`);
    this.load.image('node-town', `${cleanBase}assets/node_town.png`);
    this.load.image('node-village', `${cleanBase}assets/node_village.png`);
    this.load.image('node-ruins', `${cleanBase}assets/node_ruins.png`);
    this.load.image('node-cave', `${cleanBase}assets/node_cave.png`);
    this.load.image('node-forest', `${cleanBase}assets/node_forest.png`);
    this.load.image('node-port', `${cleanBase}assets/node_port.png`);
    this.load.image('node-monastery', `${cleanBase}assets/node_monastery.png`);
    this.load.image('node-volcano', `${cleanBase}assets/node_volcano.png`);
  }

  create() {
    const width = 1600;
    const height = 900;

    // 1. 設置背景
    this.add.image(800, 450, 'bg-map').setDisplaySize(width, height);

    // 2. 設置線條繪製 Graphics
    this.routeGraphics = this.add.graphics();
    this.routeGraphics.setDepth(1);

    this.roadGraphics = this.add.graphics();
    this.roadGraphics.setDepth(2);
    this.renderRoadNetwork();

    // 永久探索黑幕：位於背景與已發現節點之間。
    const existingFogTexture = this.textures.get('map-exploration-fog');
    this.fogTexture = existingFogTexture instanceof Phaser.Textures.CanvasTexture
      ? existingFogTexture
      : this.textures.createCanvas('map-exploration-fog', width, height)!;
    this.fogImage = this.add.image(0, 0, 'map-exploration-fog')
      .setOrigin(0)
      .setDepth(5);
    this.renderFog();

    const existingRangeTexture = this.textures.get('map-exploration-target-range');
    this.explorationRangeTexture = existingRangeTexture instanceof Phaser.Textures.CanvasTexture
      ? existingRangeTexture
      : this.textures.createCanvas('map-exploration-target-range', width, height)!;
    this.explorationRangeImage = this.add.image(0, 0, 'map-exploration-target-range')
      .setOrigin(0)
      .setDepth(6)
      .setVisible(false);

    this.explorationGraphics = this.add.graphics();
    this.explorationGraphics.setDepth(7);
    this.renderExplorationExpedition();
    document.addEventListener('exploration-selection-changed', this.explorationSelectionHandler);

    // 3. 繪製節點與互動
    this.rebuildNodes();

    // 4. 設定相機範圍與操作
    this.cameras.main.setBounds(0, 0, width, height);
    
    // 初始化相機縮放限制與居中
    this.updateCameraZoomAndLimits();
    const playerBase = GameState.mapSystem?.getNodes().find(node => node.isPlayerBase);
    this.cameras.main.centerOn(
      playerBase ? (playerBase.x / 100) * width : 800,
      playerBase ? (playerBase.y / 100) * height : 450
    );

    // 監聽視窗變更，自動調整
    this.scale.on('resize', this.resizeHandler);

    // 設定滑鼠拖曳 Camera
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.isDragging = true;
        this.clickStartX = pointer.x;
        this.clickStartY = pointer.y;
        this.dragStartX = this.cameras.main.scrollX;
        this.dragStartY = this.cameras.main.scrollY;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const zoom = this.cameras.main.zoom;
        this.cameras.main.scrollX = this.dragStartX - (pointer.x - pointer.downX) / zoom;
        this.cameras.main.scrollY = this.dragStartY - (pointer.y - pointer.downY) / zoom;
      }
    });

    this.input.on('pointerup', (
      pointer: Phaser.Input.Pointer,
      currentlyOver: Phaser.GameObjects.GameObject[]
    ) => {
      const clickDistance = Phaser.Math.Distance.Between(
        this.clickStartX,
        this.clickStartY,
        pointer.x,
        pointer.y
      );
      this.isDragging = false;
      if (clickDistance < 5 && currentlyOver.length === 0) {
        document.dispatchEvent(new CustomEvent('phaser-map-clicked', {
          detail: {
            x: (pointer.worldX / 1600) * 100,
            y: (pointer.worldY / 900) * 100
          }
        }));
      }
    });

    // 設定滾輪縮放，依據當前視窗動態計算限制
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number) => {
      const zoomIntensity = 0.05;
      let newZoom = this.cameras.main.zoom;
      
      const minZoom = Math.max(this.scale.width / 1600, this.scale.height / 900);
      const maxZoom = minZoom * 3;

      if (deltaY < 0) {
        newZoom = Math.min(this.cameras.main.zoom + zoomIntensity, maxZoom);
      } else {
        newZoom = Math.max(this.cameras.main.zoom - zoomIntensity, minZoom);
      }
      this.cameras.main.setZoom(newZoom);
    });

    // 5. 繪製貿易路線與商隊與初始節點
    this.rebuildNodes();
    this.renderFog();
    this.renderRoadNetwork();
    this.updateRoutesAndCaravans();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupSceneResources());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupSceneResources());
  }

  private cleanupSceneResources() {
    this.clearCombatBeacons();
    this.caravanTweens.forEach(tween => tween.remove());
    this.caravanTweens = [];
    this.hideTooltip();
    document.removeEventListener('exploration-selection-changed', this.explorationSelectionHandler);
    this.scale.off('resize', this.resizeHandler);
    this.input.removeAllListeners();
  }

  private updateCameraZoomAndLimits() {
    const minZoom = Math.max(this.scale.width / 1600, this.scale.height / 900);
    if (this.cameras.main.zoom < minZoom) {
      this.cameras.main.setZoom(minZoom);
    }
  }

  public renderFog() {
    if (!this.fogTexture) return;
    const exploration = GameState.explorationSystem;
    if (!exploration) return;

    const data = exploration.getData();
    const fogContext = this.fogTexture.getContext();
    fogContext.clearRect(0, 0, 1600, 900);
    fogContext.fillStyle = 'rgba(3, 5, 9, 0.98)';
    fogContext.fillRect(0, 0, 1600, 900);

    if (!this.fogCellCanvas) this.fogCellCanvas = document.createElement('canvas');
    this.fogCellCanvas.width = data.width;
    this.fogCellCanvas.height = data.height;
    const cellContext = this.fogCellCanvas.getContext('2d');
    if (!cellContext) return;
    cellContext.clearRect(0, 0, data.width, data.height);
    cellContext.fillStyle = '#ffffff';

    for (let row = 0; row < data.height; row += 1) {
      for (let column = 0; column < data.width; column += 1) {
        if (exploration.isCellRevealed(column, row)) cellContext.fillRect(column, row, 1, 1);
      }
    }

    // Upscale the persistent grid as one mask, then feather it. This preserves
    // save compatibility while removing the visible square-cell boundary.
    fogContext.save();
    fogContext.globalCompositeOperation = 'destination-out';
    fogContext.imageSmoothingEnabled = true;
    fogContext.filter = 'blur(18px)';
    fogContext.drawImage(this.fogCellCanvas, 0, 0, 1600, 900);
    fogContext.restore();
    this.fogTexture.refresh();
  }

  public renderExplorationExpedition() {
    if (!this.explorationGraphics) return;
    this.explorationGraphics.clear();
    const expedition = GameState.explorationSystem?.getActiveExpedition();
    if (!expedition) return;

    const startX = (expedition.startX / 100) * 1600;
    const startY = (expedition.startY / 100) * 900;
    const targetX = (expedition.targetX / 100) * 1600;
    const targetY = (expedition.targetY / 100) * 900;
    const currentX = (expedition.currentX / 100) * 1600;
    const currentY = (expedition.currentY / 100) * 900;

    this.explorationGraphics.lineStyle(2, 0xf8fafc, 0.42);
    const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
    const dashCount = Math.max(1, Math.ceil(distance / 24));
    for (let index = 0; index < dashCount; index += 2) {
      const from = index / dashCount;
      const to = Math.min(1, (index + 1) / dashCount);
      this.explorationGraphics.lineBetween(
        Phaser.Math.Linear(startX, targetX, from),
        Phaser.Math.Linear(startY, targetY, from),
        Phaser.Math.Linear(startX, targetX, to),
        Phaser.Math.Linear(startY, targetY, to)
      );
    }

    this.explorationGraphics.lineStyle(4, 0xf59e0b, 0.9);
    this.explorationGraphics.lineBetween(startX, startY, currentX, currentY);
    this.explorationGraphics.fillStyle(0xfbbf24, 1);
    this.explorationGraphics.fillCircle(currentX, currentY, 7);
    this.explorationGraphics.lineStyle(2, 0xfef3c7, 0.9);
    this.explorationGraphics.strokeCircle(currentX, currentY, 11);
    this.explorationGraphics.lineStyle(2, 0x38bdf8, 0.9);
    this.explorationGraphics.strokeCircle(targetX, targetY, 9);
  }

  public renderExplorationTargetRange(active: boolean) {
    if (!this.explorationRangeTexture || !this.explorationRangeImage) return;
    const exploration = GameState.explorationSystem;
    const origin = GameState.mapSystem?.getNodes().find(node => node.isPlayerBase);
    const rangeContext = this.explorationRangeTexture.getContext();
    rangeContext.clearRect(0, 0, 1600, 900);

    if (!active || !exploration || !origin || exploration.getActiveExpedition()) {
      this.explorationRangeTexture.refresh();
      this.explorationRangeImage.setVisible(false);
      return;
    }

    const preview = exploration.getTargetPreview(origin);
    if (!this.explorationRangeCellCanvas) {
      this.explorationRangeCellCanvas = document.createElement('canvas');
    }
    this.explorationRangeCellCanvas.width = preview.width;
    this.explorationRangeCellCanvas.height = preview.height;
    const cellContext = this.explorationRangeCellCanvas.getContext('2d');
    if (!cellContext) return;
    cellContext.clearRect(0, 0, preview.width, preview.height);
    cellContext.fillStyle = '#2dd4bf';
    preview.cells.forEach((selectable, index) => {
      if (!selectable) return;
      cellContext.fillRect(index % preview.width, Math.floor(index / preview.width), 1, 1);
    });

    // A soft translucent band makes the reachable frontier readable without
    // covering terrain details. The dashed edge marks the actual click limit.
    rangeContext.save();
    rangeContext.imageSmoothingEnabled = true;
    rangeContext.globalAlpha = 0.38;
    rangeContext.filter = 'blur(12px)';
    rangeContext.drawImage(this.explorationRangeCellCanvas, 0, 0, 1600, 900);
    rangeContext.restore();

    rangeContext.save();
    rangeContext.imageSmoothingEnabled = true;
    rangeContext.globalAlpha = 0.16;
    rangeContext.drawImage(this.explorationRangeCellCanvas, 0, 0, 1600, 900);
    rangeContext.restore();

    const cellWidth = 1600 / preview.width;
    const cellHeight = 900 / preview.height;
    const isSelectable = (column: number, row: number) =>
      column >= 0 &&
      row >= 0 &&
      column < preview.width &&
      row < preview.height &&
      preview.cells[row * preview.width + column] === 1;
    rangeContext.save();
    rangeContext.beginPath();
    rangeContext.strokeStyle = 'rgba(153, 246, 228, 0.88)';
    rangeContext.lineWidth = 2;
    rangeContext.lineCap = 'round';
    rangeContext.lineJoin = 'round';
    rangeContext.setLineDash([9, 8]);
    for (let row = 0; row < preview.height; row += 1) {
      for (let column = 0; column < preview.width; column += 1) {
        if (!isSelectable(column, row)) continue;
        const left = column * cellWidth;
        const top = row * cellHeight;
        const right = left + cellWidth;
        const bottom = top + cellHeight;
        if (!isSelectable(column, row - 1)) {
          rangeContext.moveTo(left, top);
          rangeContext.lineTo(right, top);
        }
        if (!isSelectable(column + 1, row)) {
          rangeContext.moveTo(right, top);
          rangeContext.lineTo(right, bottom);
        }
        if (!isSelectable(column, row + 1)) {
          rangeContext.moveTo(right, bottom);
          rangeContext.lineTo(left, bottom);
        }
        if (!isSelectable(column - 1, row)) {
          rangeContext.moveTo(left, bottom);
          rangeContext.lineTo(left, top);
        }
      }
    }
    rangeContext.stroke();
    rangeContext.restore();

    this.explorationRangeTexture.refresh();
    this.explorationRangeImage.setVisible(true);
  }

  public renderRoadNetwork() {
    if (!this.roadGraphics) return;
    this.roadGraphics.clear();
    if (!GameState.roadSystem || !GameState.mapSystem) return;

    const nodes = GameState.mapSystem.getNodes();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const drawCurve = (
      startPx: { x: number; y: number },
      targetPx: { x: number; y: number },
      roadId: string,
      color: number,
      width: number,
      alpha: number,
      progress = 1
    ) => {
      const steps = Math.max(16, Math.ceil(progress * 30));
      let prevPt = startPx;

      this.roadGraphics.lineStyle(width, color, alpha);
      this.roadGraphics.beginPath();
      this.roadGraphics.moveTo(prevPt.x, prevPt.y);

      for (let i = 1; i <= steps; i++) {
        const t = (i / steps) * progress;
        const pt = GameState.roadSystem.getSmoothCurvePoint(startPx, targetPx, roadId, t);
        this.roadGraphics.lineTo(pt.x, pt.y);
      }
      this.roadGraphics.strokePath();
    };

    const getRoadEndpoints = (road: any) => {
      const targetNode = nodeMap.get(road.targetNodeId);
      if (!targetNode) return null;
      const targetPx = GameState.roadSystem.nodeToPixel(targetNode);

      let startPx: { x: number; y: number } | null = null;
      let isBranch = false;

      if (road.startNodeId && nodeMap.has(road.startNodeId)) {
        startPx = GameState.roadSystem.nodeToPixel(nodeMap.get(road.startNodeId)!);
      } else if (road.parentRoadId) {
        const parent = GameState.roadSystem.getRoads().find(r => r.id === road.parentRoadId);
        if (parent) {
          startPx = GameState.roadSystem.getPointOnRoadConnection(parent, road.branchRatio ?? 0.5, nodeMap);
          isBranch = true;
        }
      }

      if (!startPx) {
        const originNode = nodeMap.get(road.originNodeId);
        if (!originNode) return null;
        startPx = GameState.roadSystem.nodeToPixel(originNode);
      }

      return { startPx, targetPx, roadId: road.id, isBranch };
    };

    // 1. 繪製已完成道路 (細緻 4px/2px 羊皮泥土棕配色)
    GameState.roadSystem.getRoads().forEach(road => {
      const endpoints = getRoadEndpoints(road);
      if (!endpoints) return;
      const { startPx, targetPx, roadId, isBranch } = endpoints;

      // 外底邊緣 (暖深褐色 4px, 透明度 0.65)
      drawCurve(startPx, targetPx, roadId, 0x4a2c11, 4, 0.65, 1);
      // 內層路面 (古樸羊皮泥土黃棕 2px, 透明度 0.85)
      drawCurve(startPx, targetPx, roadId, 0xa37b42, 2, 0.85, 1);

      // 若為中途分岔點，繪製微幅點狀融合點
      if (isBranch) {
        this.roadGraphics.fillStyle(0x4a2c11, 0.65);
        this.roadGraphics.fillCircle(startPx.x, startPx.y, 3);
        this.roadGraphics.fillStyle(0xa37b42, 0.85);
        this.roadGraphics.fillCircle(startPx.x, startPx.y, 1.5);
      }
    });

    // 2. 繪製施工中道路
    const project = GameState.roadSystem.getActiveProject();
    if (project) {
      const endpoints = getRoadEndpoints(project);
      if (endpoints) {
        const { startPx, targetPx, roadId } = endpoints;
        const progress = project.elapsedDays / project.totalDays;

        // 底層虛線全段標示 (細緻 2px 灰藍)
        const dashSteps = 20;
        this.roadGraphics.lineStyle(2, 0x94a3b8, 0.6);
        for (let i = 0; i < dashSteps; i += 2) {
          const tFrom = i / dashSteps;
          const tTo = (i + 1) / dashSteps;
          const p1 = GameState.roadSystem.getSmoothCurvePoint(startPx, targetPx, roadId, tFrom);
          const p2 = GameState.roadSystem.getSmoothCurvePoint(startPx, targetPx, roadId, tTo);
          this.roadGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
        }

        // 已施工進度琥珀金色亮線
        if (progress > 0) {
          drawCurve(startPx, targetPx, roadId, 0xd97706, 3, 0.85, progress);
        }
      }
    }
  }

  // 重新繪製所有城鎮節點
  rebuildNodes() {
    this.nodeContainers.forEach(c => c.destroy());
    this.nodeContainers.clear();

    const nodes = GameState.mapSystem?.getNodes() || [];
    nodes.forEach(node => {
      // 隱藏中後期的未解鎖據點
      if (node.isHidden || (!node.isPlayerBase && !node.isDiscovered)) return;

      const px = (node.x / 100) * 1600;
      const py = (node.y / 100) * 900;

      let glowColor = '#ffffff';
      if (node.isPlayerBase) {
        glowColor = '#ffd700'; // 金色
      } else if (node.ownerFactionId) {
        const f = GameState.mapSystem.getFactions().find(fac => fac.id === node.ownerFactionId);
        if (f) glowColor = f.color;
      } else if (node.feature === NodeFeature.MONSTER_NEST) {
        glowColor = '#dc2626'; // 紅色
      } else if (node.feature === NodeFeature.SUBJUGATION) {
        glowColor = '#9ca3af'; // 灰色
      }

      // 繪製 Isometric 3/4 俯視角地圖節點圖案
      const textureKey = getNodeTextureKey(node);
      const iconSize = node.isPlayerBase ? 42 : node.isDynamic ? 25 : 35;
      const iconSprite = this.add.image(0, -10, textureKey).setDisplaySize(iconSize, iconSize);

      // 繪製名字標籤 (移除黑框，改為純文字加發光陰影)
      const labelText = this.add.text(0, 12, node.name, {
        fontSize: node.isPlayerBase ? '14px' : '11px',
        color: node.isPlayerBase ? '#ffd84d' : '#fef08a',
        fontFamily: 'Cinzel, sans-serif',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      labelText.setStroke('#000000', node.isPlayerBase ? 6 : 4);
      labelText.setShadow(0, 4, node.isPlayerBase ? '#7c2d12' : '#000000', node.isPlayerBase ? 8 : 4, true, true);

      const elements: any[] = [];
      if (node.isPlayerBase) {
        const outerRing = this.add.ellipse(0, -7, 76, 38, 0xfbbf24, 0.1)
          .setStrokeStyle(3, 0xfbbf24, 0.95);
        const innerRing = this.add.ellipse(0, -7, 58, 28, 0xfef3c7, 0.05)
          .setStrokeStyle(1, 0xfef3c7, 0.72);
        const homeBadge = this.add.text(0, -50, '◆ 我的據點 ◆', {
          fontSize: '11px',
          color: '#fff7c2',
          backgroundColor: '#713f12',
          fontFamily: 'Cinzel, sans-serif',
          fontStyle: 'bold',
          padding: { x: 7, y: 3 }
        }).setOrigin(0.5);
        homeBadge.setStroke('#1c0a00', 2);
        homeBadge.setShadow(0, 3, '#000000', 4, true, true);
        elements.push(outerRing, innerRing, iconSprite, homeBadge, labelText);
      } else {
        elements.push(iconSprite, labelText);
      }
      
      const hasPendingRaid = node.isPlayerBase && (GameState.myTerritory?.pendingRaids && GameState.myTerritory.pendingRaids.length > 0);
      if (node.siegeData || hasPendingRaid) {
        const siegeIcon = this.add.text(0, -38, '⚔️', { fontSize: '22px' }).setOrigin(0.5);
        this.tweens.add({
          targets: siegeIcon,
          y: -46,
          scale: 1.2,
          duration: 450,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        const raidInfo = hasPendingRaid ? GameState.myTerritory.pendingRaids[0] : undefined;
        const warnText = this.add.text(0, -60, hasPendingRaid ? `⚠️ 敵軍逼近 (${raidInfo?.warningDaysLeft}天)` : '⚠️ 圍城中', {
          fontSize: '10px',
          color: '#fca5a5',
          backgroundColor: '#7f1d1d',
          fontFamily: 'sans-serif',
          fontStyle: 'bold',
          padding: { x: 5, y: 2 }
        }).setOrigin(0.5);
        elements.push(siegeIcon, warnText);
      }

      const container = this.add.container(px, py);
      container.add(elements);

      let depth = 10;
      if (node.isPlayerBase) depth = 50;
      else if (node.ownerFactionId) depth = 30;
      else if (node.feature === NodeFeature.MONSTER_NEST) depth = 20;
      container.setDepth(depth);

      iconSprite.setInteractive({ useHandCursor: true });

      iconSprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.isDragging = false; 
        this.clickStartX = pointer.x;
        this.clickStartY = pointer.y;
      });

      iconSprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        const dist = Phaser.Math.Distance.Between(this.clickStartX, this.clickStartY, pointer.x, pointer.y);
        if (dist < 5) {
          const e = pointer.event as any;
          const clientX = e.clientX ?? (e.touches && e.touches.length > 0 ? e.touches[0].clientX : 0);
          const clientY = e.clientY ?? (e.touches && e.touches.length > 0 ? e.touches[0].clientY : 0);
          this.handleNodeClick(node, clientX, clientY);
        }
      });

      iconSprite.on('pointerover', () => {
        // 暫存原有的 depth，並將 depth 設為最高避免被遮擋
        container.setData('originalDepth', container.depth);
        container.setDepth(100);

        // 些微放大 1.25 倍的平滑過渡動畫
        this.tweens.add({
          targets: container,
          scale: 1.25,
          duration: 150,
          ease: 'Back.easeOut',
          overwrite: true
        });

        // 強化文字高亮效果
        labelText.setShadow(0, 0, glowColor, 12, true, true);
        this.showTooltip(node);
      });

      iconSprite.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        this.moveTooltip(pointer);
      });

      iconSprite.on('pointerout', () => {
        // 還原 depth
        const originalDepth = container.getData('originalDepth') || depth;
        container.setDepth(originalDepth);

        // 平滑縮小還原動畫
        this.tweens.add({
          targets: container,
          scale: 1.0,
          duration: 150,
          ease: 'Power1',
          overwrite: true
        });

        // 還原文字陰影
        labelText.setShadow(1, 1, '#000000', 2, true, true);
        labelText.setShadow(0, 0, glowColor, 4, true, true);
        this.hideTooltip();
      });

      this.nodeContainers.set(node.id, container);
    });
    this.syncCombatBeacons(nodes);
  }

  private syncCombatBeacons(nodes: MapNode[]): void {
    const combatNodeIds = new Set(
      (GameState.system?.getActiveMissions() || [])
        .filter(mission => mission.task.type === TaskType.COMBAT && mission.task.targetNodeId)
        .map(mission => mission.task.targetNodeId!)
    );

    this.combatBeacons.forEach((beacon, nodeId) => {
      if (!combatNodeIds.has(nodeId)) {
        this.destroyCombatBeacon(beacon, true);
        this.combatBeacons.delete(nodeId);
      }
    });

    combatNodeIds.forEach(nodeId => {
      const node = nodes.find(candidate => candidate.id === nodeId);
      if (!node) return;
      const x = (node.x / 100) * 1600;
      // 與節點 Emoji 中心重疊，信標本身不設 interactive，不阻擋原節點點擊。
      const y = (node.y / 100) * 900 - 10;
      const existing = this.combatBeacons.get(nodeId);
      if (existing) {
        existing.container.setPosition(x, y);
      } else {
        this.combatBeacons.set(nodeId, this.createCombatBeacon(x, y));
      }
    });
  }

  private createCombatBeacon(x: number, y: number): CombatBeacon {
    const container = this.add.container(x, y).setDepth(140);
    const weaponGroup = this.add.container(0, 0);
    const impactGlow = this.add.ellipse(0, 15, 52, 16, 0xf59e0b, 0.16).setBlendMode(Phaser.BlendModes.ADD);
    const pulseRing = this.add.ellipse(0, 17, 76, 26, 0x000000, 0)
      .setStrokeStyle(3, 0xfbbf24, 1)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const swordGlow = this.add.circle(0, -9, 20, 0xfbbf24, 0.18).setBlendMode(Phaser.BlendModes.ADD);

    const leftSword = this.add.image(72, -82, 'combat-sword')
      .setDisplaySize(30, 60)
      .setOrigin(0.5, 0.94)
      .setAngle(38)
      .setAlpha(0);
    const rightSword = this.add.image(-72, -82, 'combat-sword')
      .setDisplaySize(30, 60)
      .setOrigin(0.5, 0.94)
      .setAngle(-38)
      .setAlpha(0);

    weaponGroup.add([swordGlow, leftSword, rightSword]);
    container.add([impactGlow, pulseRing, weaponGroup]);

    const tweens: Phaser.Tweens.Tween[] = [];
    // 3.2 秒一輪：沿劍身方向高速斜射入土，而非垂直落下。
    tweens.push(this.tweens.add({
      targets: leftSword,
      x: { from: 72, to: -10 },
      y: { from: -82, to: 18 },
      duration: 220,
      hold: 2980,
      ease: 'Cubic.easeIn',
      repeat: -1
    }));
    tweens.push(this.tweens.add({
      targets: rightSword,
      x: { from: -72, to: 10 },
      y: { from: -82, to: 18 },
      duration: 220,
      delay: 120,
      ease: 'Cubic.easeIn',
      hold: 2980,
      repeat: -1
    }));
    [leftSword, rightSword].forEach((sword, index) => {
      tweens.push(this.tweens.add({
        targets: sword,
        alpha: { from: 0, to: 1 },
        duration: 140,
        delay: index * 120,
        hold: 2400,
        yoyo: true,
        repeatDelay: 520,
        repeat: -1
      }));
    });
    tweens.push(this.tweens.add({
      targets: pulseRing,
      alpha: { from: 0.82, to: 0 },
      scaleX: { from: 0.7, to: 1.5 },
      scaleY: { from: 0.7, to: 1.5 },
      duration: 800,
      delay: 350,
      repeatDelay: 2400,
      ease: 'Sine.easeOut',
      repeat: -1
    }));
    tweens.push(this.tweens.add({
      targets: [impactGlow, swordGlow],
      alpha: { from: 0.12, to: 0.42 },
      scaleX: { from: 0.9, to: 1.12 },
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    }));

    return { container, tweens };
  }

  private destroyCombatBeacon(beacon: CombatBeacon, animate: boolean): void {
    beacon.tweens.forEach(tween => tween.remove());
    beacon.tweens.length = 0;
    if (!animate || !beacon.container.active) {
      beacon.container.destroy(true);
      return;
    }
    this.tweens.add({
      targets: beacon.container,
      alpha: 0,
      scale: 1.3,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => beacon.container.destroy(true)
    });
  }

  private clearCombatBeacons(): void {
    this.combatBeacons.forEach(beacon => this.destroyCombatBeacon(beacon, false));
    this.combatBeacons.clear();
  }

  private handleNodeClick(node: MapNode, clientX?: number, clientY?: number) {
    const event = new CustomEvent('phaser-node-clicked', { detail: { node, clientX, clientY } });
    document.dispatchEvent(event);
  }

  private showTooltip(node: MapNode) {
    const tooltip = document.getElementById('map-tooltip');
    if (!tooltip) return;

    let tooltipText = `【${node.name}】`;
    if (node.isPlayerBase) {
      tooltipText += '\n我的據點';
    } else if (node.ownerFactionId) {
      const f = GameState.mapSystem.getFactions().find(fac => fac.id === node.ownerFactionId);
      tooltipText += `\n歸屬：${f ? f.factionName : '未知'}`;
    } else {
      tooltipText += '\n無主之地';
    }
    
    const playerNode = GameState.mapSystem.getNodes().find(n => n.isPlayerBase);
    const isSameFaction = playerNode?.ownerFactionId && playerNode.ownerFactionId === node.ownerFactionId;
    
    if (!node.isScouted && !node.isPlayerBase && !isSameFaction) {
      tooltipText += '\n狀態：未偵查';
    } else if (node.scoutData) {
      tooltipText += `\n危險度：${node.scoutData.dangerLevel}`;
    }

    if (node.siegeData) {
      const attackerFaction = GameState.mapSystem.getFactions().find(f => f.id === node.siegeData!.attackerFactionId);
      const attackerName = attackerFaction ? attackerFaction.factionName : '未知勢力';
      tooltipText += `\n\n⚔️ 遭到圍攻！\n攻擊方：${attackerName}\n剩餘天數：${node.siegeData.remainingDays}天`;
    }

    // 取得並顯示該據點的外派傭兵名單
    const activeMissions = GameState.system?.getActiveMissions() || [];
    const nodeMissions = activeMissions.filter(m => m.task.targetNodeId === node.id);
    if (nodeMissions.length > 0) {
      tooltipText += '\n\n👤 外派人員名單：';
      nodeMissions.forEach(m => {
        const names = m.adventurers.map(adv => adv.name).join(', ');
        tooltipText += `\n- ${names} (${m.remainingDays}天)`;
      });
    }

    tooltip.innerHTML = tooltipText.replace(/\n/g, '<br/>');
    tooltip.style.opacity = '1';
  }

  private moveTooltip(pointer: Phaser.Input.Pointer) {
    const tooltip = document.getElementById('map-tooltip');
    if (!tooltip) return;
    const e = pointer.event as MouseEvent;
    if (!e) return;
    
    positionFloatingElement(tooltip, e.clientX, e.clientY);
  }

  private hideTooltip() {
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) tooltip.style.opacity = '0';
  }

  updateRoutesAndCaravans() {
    this.routeGraphics.clear();
    this.caravanTweens.forEach(tween => tween.remove());
    this.caravanTweens = [];
    
    this.caravans.forEach(c => c.destroy());
    this.caravans = [];

    const mapSystem = GameState.mapSystem;
    if (!mapSystem) return;

    const playerNode = mapSystem.getNodes().find(n => n.isPlayerBase);
    if (!playerNode) return;

    const activeMissions = GameState.system?.getActiveMissions()?.filter(m => m.task.type === TaskType.TRADE) || [];

    activeMissions.forEach(mission => {
      const segments = buildTradeRouteSegments(mission.task, playerNode.id);

      for (const segment of segments) {
        const startNode = mapSystem.getNodeById(segment.startNodeId);
        const endNode = mapSystem.getNodeById(segment.endNodeId);
        if (!startNode || !endNode) continue;

        const px1 = (startNode.x / 100) * 1600;
        const py1 = (startNode.y / 100) * 900;
        const px2 = (endNode.x / 100) * 1600;
        const py2 = (endNode.y / 100) * 900;

        const pmidX = (px1 + px2) / 2;
        const pmidY = (py1 + py2) / 2;

        const hash = getHashString(startNode.id + endNode.id);
        const offsetMultiplier = 3 + (hash % 5);
        const isPositive = (hash % 2 === 0) ? 1 : -1;

        const pdx = px2 - px1;
        const pdy = py2 - py1;
        const plen = Math.sqrt(pdx * pdx + pdy * pdy);
        
        const offsetPx = (offsetMultiplier / 100) * 1600;
        let pcontrolX = pmidX;
        let pcontrolY = pmidY;

        if (plen > 0) {
          const pnx = -pdy / plen;
          const pny = pdx / plen;
          pcontrolX = pmidX + pnx * offsetPx * isPositive;
          pcontrolY = pmidY + pny * offsetPx * isPositive;
        }

        const curve = new Phaser.Curves.QuadraticBezier(
          new Phaser.Math.Vector2(px1, py1),
          new Phaser.Math.Vector2(pcontrolX, pcontrolY),
          new Phaser.Math.Vector2(px2, py2)
        );

        if (segment.isCurrent) {
          this.routeGraphics.lineStyle(3, 0xeab308, 0.8);
          curve.draw(this.routeGraphics, 40);

          const caravanText = this.add.text(px1, py1, '🐪', {
            fontSize: '24px',
            fontFamily: 'Arial'
          }).setOrigin(0.5);
          caravanText.setDepth(40);
          caravanText.setShadow(0, 0, '#ffd700', 8, true, true);
          this.caravans.push(caravanText);

          const pathObj = { t: 0 };
          const caravanTween = this.tweens.add({
            targets: pathObj,
            t: 1,
            ease: 'Linear',
            duration: 8000,
            repeat: -1,
            onUpdate: () => {
              if (caravanText.active) {
                const pos = curve.getPoint(pathObj.t);
                caravanText.setPosition(pos.x, pos.y);
              }
            }
          });
          this.caravanTweens.push(caravanTween);
        } else {
          this.routeGraphics.lineStyle(2, 0x94a3b8, 0.3);
          const points = curve.getPoints(20);
          for (let k = 0; k < points.length - 1; k += 2) {
            this.routeGraphics.lineBetween(points[k].x, points[k].y, points[k + 1].x, points[k + 1].y);
          }
        }
      }
    });
  }
}

function getHashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}
