import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { MapNode, NodeFeature } from '../models/types';
import { TaskType } from '../models/DispatchTask';
import { getNodeIcon } from './MapController';

export class MapScene extends Phaser.Scene {
  private routeGraphics!: Phaser.GameObjects.Graphics;
  private nodeContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private caravans: Phaser.GameObjects.Text[] = [];
  
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
    this.load.image('bg-map', './bg-map.png');
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
    this.scale.on('resize', () => {
      this.updateCameraZoomAndLimits();
    });

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
      const px = (node.x / 100) * 1600;
      const py = (node.y / 100) * 900;

      let glowColor = '#000000';
      
      if (node.isPlayerBase) {
        glowColor = '#ffd700'; // 金色
      } else if (node.ownerFactionId) {
        const f = GameState.mapSystem.getFactions().find(fac => fac.id === node.ownerFactionId);
        if (f) glowColor = f.color;
      } else if (node.feature === NodeFeature.MONSTER_NEST) {
        glowColor = '#dc2626'; // 紅色
      } else if (node.feature === NodeFeature.SUBJUGATION) {
        glowColor = '#6b7280'; // 灰色
      }

      // 繪製 Emoji 圖標
      const icon = getNodeIcon(node);
      const iconText = this.add.text(0, -10, icon, {
        fontSize: '36px',
        fontFamily: 'Arial'
      }).setOrigin(0.5);

      iconText.setShadow(0, 0, glowColor, 12, true, true);

      // 繪製名字標籤
      const labelText = this.add.text(0, 22, node.name, {
        fontSize: '13px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      labelText.setShadow(1, 1, '#000000', 2, true, true);
      labelText.setShadow(0, 0, glowColor, 4, true, true);

      const container = this.add.container(px, py);
      container.add([iconText, labelText]);

      // 判斷該據點是否有派遣任務 (COMBAT 或 EXPLORE)
      const activeMissions = GameState.system?.getActiveMissions() || [];
      const hasMission = activeMissions.some(m => m.task.targetNodeId === node.id);
      
      if (hasMission) {
        // 建立交叉雙劍 (⚔️) - 一體化 45 度斜插交叉，尺寸超大且顯眼，徹底解決兩把劍單獨定位對齊偏角的所有視覺問題
        const crossSwords = this.add.text(0, -45, '⚔️', { fontSize: '38px' }).setOrigin(0.5);
        crossSwords.setDepth(60);
        
        container.add(crossSwords);
        
        const runSwordAnim = () => {
          if (!crossSwords.active) return;
          
          crossSwords.alpha = 0;
          crossSwords.setPosition(0, -90);
          crossSwords.setAngle(0);
          
          // 1. 掉落與淡入
          this.tweens.add({
            targets: crossSwords,
            alpha: 1,
            y: -35,
            duration: 250,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              // 2. 插地顫動反彈 (微小抖動)
              this.tweens.add({
                targets: crossSwords,
                angle: 10,
                duration: 50,
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                  crossSwords.setAngle(0); // 確保抖動後回到水平正向
                }
              });
            }
          });
          
          // 3. 停留 1.5 秒後淡出
          this.time.delayedCall(250 + 50 * 6 + 1500, () => {
            if (!crossSwords.active) return;
            this.tweens.add({
              targets: crossSwords,
              alpha: 0,
              duration: 300,
              ease: 'Linear',
              onComplete: () => {
                // 4. 等待 0.5 秒後再次重啟循環
                this.time.delayedCall(500, () => {
                  runSwordAnim();
                });
              }
            });
          });
        };
        
        runSwordAnim();
      }
      
      let depth = 10;
      if (node.isPlayerBase) depth = 50;
      else if (node.ownerFactionId) depth = 30;
      else if (node.feature === NodeFeature.MONSTER_NEST) depth = 20;
      container.setDepth(depth);

      iconText.setInteractive({ useHandCursor: true });

      iconText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.isDragging = false; 
        this.clickStartX = pointer.x;
        this.clickStartY = pointer.y;
      });

      iconText.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        const dist = Phaser.Math.Distance.Between(this.clickStartX, this.clickStartY, pointer.x, pointer.y);
        if (dist < 5) {
          this.handleNodeClick(node);
        }
      });

      iconText.on('pointerover', () => {
        // 暫存原有的 depth，並將 depth 設為最高避免被遮擋
        container.setData('originalDepth', container.depth);
        container.setDepth(100);

        // 些微放大 1.3 倍的平滑過渡動畫
        this.tweens.add({
          targets: container,
          scale: 1.3,
          duration: 150,
          ease: 'Back.easeOut',
          overwrite: true
        });

        // 強化文字高亮效果與 Emoji 陰影
        labelText.setShadow(0, 0, glowColor, 12, true, true);
        iconText.setShadow(0, 0, glowColor, 20, true, true);

        this.showTooltip(node);
      });

      iconText.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        this.moveTooltip(pointer);
      });

      iconText.on('pointerout', () => {
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

        // 還原文字與圖示陰影
        labelText.setShadow(1, 1, '#000000', 2, true, true);
        labelText.setShadow(0, 0, glowColor, 4, true, true);
        iconText.setShadow(0, 0, glowColor, 12, true, true);

        this.hideTooltip();
      });

      this.nodeContainers.set(node.id, container);
    });
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

    // 取得並顯示該據點的外派冒險者名單
    const activeMissions = GameState.system?.getActiveMissions() || [];
    const nodeMissions = activeMissions.filter(m => m.task.targetNodeId === node.id);
    if (nodeMissions.length > 0) {
      tooltipText += '\n\n👤 外派人員名單：';
      nodeMissions.forEach(m => {
        const names = m.adventurers.map(adv => adv.name).join(', ');
        tooltipText += `\n- ${names} (${m.remainingDays}天)`;
      });
    }

    tooltip.textContent = tooltipText;
    tooltip.style.opacity = '1';
  }

  private moveTooltip(pointer: Phaser.Input.Pointer) {
    const tooltip = document.getElementById('map-tooltip');
    if (!tooltip) return;
    const e = pointer.event as MouseEvent;
    if (!e) return;
    
    const padding = 12;
    let x = e.clientX + padding;
    let y = e.clientY - tooltip.offsetHeight - padding;
    if (x + tooltip.offsetWidth > window.innerWidth) {
      x = e.clientX - tooltip.offsetWidth - padding;
    }
    if (y < 0) {
      y = e.clientY + padding;
    }
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  private hideTooltip() {
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) tooltip.style.opacity = '0';
  }

  updateRoutesAndCaravans() {
    this.routeGraphics.clear();
    
    this.caravans.forEach(c => c.destroy());
    this.caravans = [];

    const mapSystem = GameState.mapSystem;
    if (!mapSystem) return;

    const playerNode = mapSystem.getNodes().find(n => n.isPlayerBase);
    if (!playerNode) return;

    const activeMissions = GameState.system?.getActiveMissions()?.filter(m => m.task.type === TaskType.TRADE) || [];

    activeMissions.forEach(mission => {
      const routeIds = mission.task.tradeRouteNodeIds || [];
      if (routeIds.length === 0) return;

      const nodesPath: MapNode[] = [];
      nodesPath.push(playerNode);
      routeIds.forEach(id => {
        const n = mapSystem.getNodeById(id);
        if (n) nodesPath.push(n);
      });
      nodesPath.push(playerNode);

      for (let i = 0; i < nodesPath.length - 1; i++) {
        const startNode = nodesPath[i];
        const endNode = nodesPath[i+1];

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

        const isCurrentSegment = (mission.task.currentRouteIndex !== undefined && i === mission.task.currentRouteIndex);

        if (isCurrentSegment) {
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
          this.tweens.add({
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
