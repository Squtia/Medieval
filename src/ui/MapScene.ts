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
  private nodeContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private caravans: Phaser.GameObjects.Text[] = [];
  private caravanTweens: Phaser.Tweens.Tween[] = [];
  private combatBeacons: Map<string, CombatBeacon> = new Map();
  private readonly resizeHandler = () => this.updateCameraZoomAndLimits();
  
  private clickStartX = 0;
  private clickStartY = 0;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  
  constructor() {
    super({ key: 'MapScene' });
  }

  preload() {
    // 載入背景圖
    this.load.image('bg-map', './bg-map.webp');
    this.load.svg('combat-sword', './assets/combat_sword.svg', { width: 48, height: 96 });

    // 載入 Isometric 地圖節點圖示 (v2 簡潔高對比風格)
    this.load.image('node-castle', './assets/node_castle.png');
    this.load.image('node-town', './assets/node_town.png');
    this.load.image('node-village', './assets/node_village.png');
    this.load.image('node-ruins', './assets/node_ruins.png');
    this.load.image('node-cave', './assets/node_cave.png');
    this.load.image('node-forest', './assets/node_forest.png');
    this.load.image('node-port', './assets/node_port.png');
    this.load.image('node-monastery', './assets/node_monastery.png');
    this.load.image('node-volcano', './assets/node_volcano.png');
  }

  create() {
    const width = 1600;
    const height = 900;

    // 1. 設置背景
    this.add.image(800, 450, 'bg-map').setDisplaySize(width, height);

    // 2. 設置線條繪製 Graphics
    this.routeGraphics = this.add.graphics();

    // 3. 繪製節點與互動
    this.rebuildNodes();

    // 4. 設定相機範圍與操作
    this.cameras.main.setBounds(0, 0, width, height);
    
    // 初始化相機縮放限制與居中
    this.updateCameraZoomAndLimits();
    this.cameras.main.centerOn(800, 450);

    // 監聽視窗變更，自動調整
    this.scale.on('resize', this.resizeHandler);

    // 設定滑鼠拖曳 Camera
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.isDragging = true;
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

    this.input.on('pointerup', () => {
      this.isDragging = false;
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

    // 5. 繪製貿易路線與商隊
    this.updateRoutesAndCaravans();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupSceneResources());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupSceneResources());
  }

  private cleanupSceneResources() {
    this.clearCombatBeacons();
    this.caravanTweens.forEach(tween => tween.remove());
    this.caravanTweens = [];
    this.hideTooltip();
    this.scale.off('resize', this.resizeHandler);
    this.input.removeAllListeners();
  }

  private updateCameraZoomAndLimits() {
    const minZoom = Math.max(this.scale.width / 1600, this.scale.height / 900);
    if (this.cameras.main.zoom < minZoom) {
      this.cameras.main.setZoom(minZoom);
    }
  }

  // 重新繪製所有城鎮節點
  rebuildNodes() {
    this.nodeContainers.forEach(c => c.destroy());
    this.nodeContainers.clear();

    const nodes = GameState.mapSystem?.getNodes() || [];
    nodes.forEach(node => {
      // 隱藏中後期的未解鎖據點
      if (node.isHidden) return;

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
      const iconSize = node.isDynamic ? 25 : 35;
      const iconSprite = this.add.image(0, -10, textureKey).setDisplaySize(iconSize, iconSize);

      // 繪製名字標籤 (移除黑框，改為純文字加發光陰影)
      const labelText = this.add.text(0, 28, node.name, {
        fontSize: '11px',
        color: '#fef08a',
        fontFamily: 'Cinzel, sans-serif',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      labelText.setStroke('#000000', 4);
      labelText.setShadow(0, 4, '#000000', 4, true, true);

      const container = this.add.container(px, py);
      container.add([iconSprite, labelText]);

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
          this.handleNodeClick(node);
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

  private handleNodeClick(node: MapNode) {
    const event = new CustomEvent('phaser-node-clicked', { detail: { node } });
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
