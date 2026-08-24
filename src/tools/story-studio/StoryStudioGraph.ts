import { StoryStudioStore } from './StoryStudioStore';
import {
  channelName,
  GRAPH_NODE_H,
  GRAPH_NODE_W,
  GraphEdge,
  SVG_NS
} from './StoryStudioTypes';
import type { NarrativeNode, NarrativeStory } from '../../models/Narrative';

export class StoryStudioGraph {
  private store: StoryStudioStore;
  private wrapper: HTMLElement | null = null;
  private svg: SVGSVGElement | null = null;

  public zoom: number = 1.0;
  public panX: number = 0;
  public panY: number = 0;
  public wireSource: string | null = null;

  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;

  private isDraggingNode: boolean = false;
  private dragCandidateNodeId: string | null = null;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragNodeInitX: number = 0;
  private dragNodeInitY: number = 0;
  private readonly DRAG_THRESHOLD: number = 5; // 5px 安全門檻

  constructor(store: StoryStudioStore) {
    this.store = store;
  }

  public mount(wrapperId: string, svgId: string): void {
    this.wrapper = document.getElementById(wrapperId);
    this.svg = document.getElementById(svgId) as unknown as SVGSVGElement;
    if (!this.wrapper || !this.svg) return;

    this.bindEvents();
    this.store.subscribe('storySelected', () => {
      this.render();
      this.fitView();
    });
    this.store.subscribe('storiesLoaded', () => {
      this.render();
      this.fitView();
    });
    this.store.subscribe('storyUpdated', () => {
      this.render();
    });
    this.store.subscribe('nodeSelected', () => {
      this.updateNodeHighlights();
    });
  }

  private svgEl<T extends SVGElement>(tag: string): T {
    return document.createElementNS(SVG_NS, tag) as T;
  }

  public render(): void {
    if (!this.svg) return;
    this.svg.innerHTML = '';

    const story = this.store.getActiveStory();
    if (!story || story.nodes.length === 0) return;

    // 1. Defs & Markers
    const defs = this.svgEl<SVGDefsElement>('defs');
    const MARKERS: [string, string][] = [
      ['arrow-fact', '#d4a017'],
      ['arrow-schedule', '#60a5fa'],
      ['arrow-victory', '#86efac'],
      ['arrow-defeat', '#fca5a5'],
      ['arrow-journey', '#c084fc']
    ];
    for (const [id, color] of MARKERS) {
      const m = this.svgEl<SVGMarkerElement>('marker');
      m.setAttribute('id', id);
      m.setAttribute('markerWidth', '8');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('refX', '7');
      m.setAttribute('refY', '3');
      m.setAttribute('orient', 'auto');
      const poly = this.svgEl<SVGPolygonElement>('polygon');
      poly.setAttribute('points', '0 0, 8 3, 0 6');
      poly.setAttribute('fill', color);
      m.appendChild(poly);
      defs.appendChild(m);
    }
    this.svg.appendChild(defs);

    // 2. Root Group (Zoom & Pan)
    const rootG = this.svgEl<SVGGElement>('g');
    rootG.id = 'graph-root-g';
    this.svg.appendChild(rootG);

    const edgeLayer = this.svgEl<SVGGElement>('g');
    edgeLayer.id = 'graph-edge-layer';
    const nodeLayer = this.svgEl<SVGGElement>('g');
    nodeLayer.id = 'graph-node-layer';

    rootG.appendChild(edgeLayer);
    rootG.appendChild(nodeLayer);

    this.renderEdges(edgeLayer, story);
    this.renderNodes(nodeLayer, story);
    this.applyTransform();
  }

  private buildEdges(story: NarrativeStory): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const factSetters = new Map<string, string>();
    const nodeSet = new Set(story.nodes.map(n => n.id));

    for (const node of story.nodes) {
      const allFx = [...node.completionEffects, ...node.choices.flatMap(c => c.effects)];
      for (const fx of allFx) {
        if (fx.type === 'SET_FACT') factSetters.set(fx.fact, node.id);
        if (fx.type === 'SCHEDULE_NODE' && nodeSet.has(fx.nodeId))
          edges.push({ from: node.id, to: fx.nodeId, type: 'schedule' });
        if (fx.type === 'CREATE_SUBJUGATION_NODE') {
          const d = fx.definition;
          if (d.victoryNodeId && nodeSet.has(d.victoryNodeId)) edges.push({ from: node.id, to: d.victoryNodeId, type: 'victory' });
          if (d.defeatNodeId && nodeSet.has(d.defeatNodeId)) edges.push({ from: node.id, to: d.defeatNodeId, type: 'defeat' });
          for (const jId of d.journeyNodeIds) if (nodeSet.has(jId)) edges.push({ from: node.id, to: jId, type: 'journey' });
        }
      }
    }
    for (const node of story.nodes) {
      for (const cond of node.conditions) {
        if (cond.type === 'FACT_EXISTS' || cond.type === 'FACT_MISSING' || cond.type === 'DAYS_SINCE_FACT') {
          const setter = factSetters.get(cond.fact);
          if (setter && setter !== node.id) edges.push({ from: setter, to: node.id, type: 'fact', label: cond.fact });
        }
      }
    }
    return edges;
  }

  private renderEdges(layer: SVGGElement, story: NarrativeStory): void {
    layer.innerHTML = '';
    const edges = this.buildEdges(story);
    for (const edge of edges) {
      const fp = this.store.graphPositions[edge.from];
      const tp = this.store.graphPositions[edge.to];
      if (!fp || !tp) continue;
      const x1 = fp.x + GRAPH_NODE_W;
      const y1 = fp.y + GRAPH_NODE_H / 2;
      const x2 = tp.x;
      const y2 = tp.y + GRAPH_NODE_H / 2;
      const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
      const path = this.svgEl<SVGPathElement>('path');
      path.setAttribute('d', `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('class', `graph-edge graph-edge-${edge.type}`);
      path.setAttribute('marker-end', `url(#arrow-${edge.type})`);
      layer.appendChild(path);

      if (edge.label) {
        const t = this.svgEl<SVGTextElement>('text');
        t.setAttribute('x', String((x1 + x2) / 2));
        t.setAttribute('y', String((y1 + y2) / 2 - 6));
        t.setAttribute('class', 'graph-edge-label');
        t.textContent = edge.label;
        layer.appendChild(t);
      }
    }
  }

  private renderNodes(layer: SVGGElement, story: NarrativeStory): void {
    layer.innerHTML = '';

    for (const node of story.nodes) {
      const pos = this.store.graphPositions[node.id] ?? { x: 40, y: 40 };
      const isCur = node.id === this.store.selectedNodeId;
      const isWire = this.wireSource === node.id;

      const g = this.svgEl<SVGGElement>('g');
      g.setAttribute('class', `graph-node${isCur ? ' graph-node-selected' : ''}${isWire ? ' graph-node-wire-src' : ''}`);
      g.dataset.nodeId = node.id;
      g.setAttribute('transform', `translate(${pos.x},${pos.y})`);

      // 節點主矩形
      const rect = this.svgEl<SVGRectElement>('rect');
      rect.setAttribute('width', String(GRAPH_NODE_W));
      rect.setAttribute('height', String(GRAPH_NODE_H));
      rect.setAttribute('rx', '7');
      rect.setAttribute('class', 'graph-node-rect');
      g.appendChild(rect);

      // 頻道 Badge
      const bgR = this.svgEl<SVGRectElement>('rect');
      bgR.setAttribute('x', '10');
      bgR.setAttribute('y', '10');
      bgR.setAttribute('width', '64');
      bgR.setAttribute('height', '16');
      bgR.setAttribute('rx', '8');
      bgR.setAttribute('class', 'graph-node-channel-bg');
      g.appendChild(bgR);

      const chTxt = this.svgEl<SVGTextElement>('text');
      chTxt.setAttribute('x', '42');
      chTxt.setAttribute('y', '22');
      chTxt.setAttribute('text-anchor', 'middle');
      chTxt.setAttribute('class', 'graph-node-channel-txt');
      chTxt.textContent = channelName(node.channel);
      g.appendChild(chTxt);

      // 標題
      const titleTxt = this.svgEl<SVGTextElement>('text');
      titleTxt.setAttribute('x', '10');
      titleTxt.setAttribute('y', '48');
      titleTxt.setAttribute('class', 'graph-node-title-txt');
      titleTxt.textContent = node.title.length > 20 ? node.title.slice(0, 20) + '…' : node.title;
      g.appendChild(titleTxt);

      // 節點 ID
      const idTxt = this.svgEl<SVGTextElement>('text');
      idTxt.setAttribute('x', '10');
      idTxt.setAttribute('y', '63');
      idTxt.setAttribute('class', 'graph-node-id-txt');
      idTxt.textContent = node.id.length > 26 ? node.id.slice(0, 26) + '…' : node.id;
      g.appendChild(idTxt);

      // 條件與效果計數
      const meta = `${node.conditions.length > 0 ? `⚙ ${node.conditions.length} 條件` : ''}${node.completionEffects.length > 0 ? `  ✦ ${node.completionEffects.length} 效果` : ''}`.trim();
      if (meta) {
        const metaTxt = this.svgEl<SVGTextElement>('text');
        metaTxt.setAttribute('x', '10');
        metaTxt.setAttribute('y', '80');
        metaTxt.setAttribute('class', 'graph-node-meta-txt');
        metaTxt.textContent = meta;
        g.appendChild(metaTxt);
      }

      // 輸入輸出埠
      const inPort = this.svgEl<SVGCircleElement>('circle');
      inPort.setAttribute('cx', '0');
      inPort.setAttribute('cy', String(GRAPH_NODE_H / 2));
      inPort.setAttribute('r', '5');
      inPort.setAttribute('class', 'graph-port graph-port-in');
      g.appendChild(inPort);

      const outPort = this.svgEl<SVGCircleElement>('circle');
      outPort.setAttribute('cx', String(GRAPH_NODE_W));
      outPort.setAttribute('cy', String(GRAPH_NODE_H / 2));
      outPort.setAttribute('r', '5');
      outPort.setAttribute('class', 'graph-port graph-port-out');
      outPort.dataset.portNode = node.id;
      g.appendChild(outPort);

      layer.appendChild(g);
    }
  }

  public updateNodeHighlights(): void {
    if (!this.svg) return;
    const curId = this.store.selectedNodeId;
    this.svg.querySelectorAll('.graph-node').forEach(g => {
      const isCur = (g as SVGElement).dataset.nodeId === curId;
      g.classList.toggle('graph-node-selected', isCur);
    });
  }

  public applyTransform(): void {
    const rootG = this.svg?.querySelector<SVGGElement>('#graph-root-g');
    if (rootG) {
      rootG.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
    }
    const zoomVal = document.getElementById('graph-zoom-val');
    if (zoomVal) zoomVal.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  public centerNode(nodeId: string): void {
    if (!this.wrapper || !this.store.graphPositions[nodeId]) return;
    const pos = this.store.graphPositions[nodeId];
    const targetX = this.wrapper.clientWidth / 2 - (pos.x + GRAPH_NODE_W / 2) * this.zoom;
    const targetY = this.wrapper.clientHeight / 2 - (pos.y + GRAPH_NODE_H / 2) * this.zoom;
    this.panX = targetX;
    this.panY = targetY;
    this.applyTransform();
  }

  public fitView(): void {
    const story = this.store.getActiveStory();
    if (!story || story.nodes.length === 0 || !this.wrapper) return;

    const xs = story.nodes.map(n => this.store.graphPositions[n.id]?.x ?? 0);
    const ys = story.nodes.map(n => this.store.graphPositions[n.id]?.y ?? 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + GRAPH_NODE_W;
    const minY = Math.min(...ys), maxY = Math.max(...ys) + GRAPH_NODE_H;

    const contentW = maxX - minX + 80;
    const contentH = maxY - minY + 80;
    const viewW = this.wrapper.clientWidth || 800;
    const viewH = this.wrapper.clientHeight || 500;

    const scale = Math.min(1.4, Math.max(0.4, Math.min(viewW / contentW, viewH / contentH)));
    this.zoom = Math.round(scale * 100) / 100;
    this.panX = (viewW - contentW * this.zoom) / 2 - minX * this.zoom + 40 * this.zoom;
    this.panY = (viewH - contentH * this.zoom) / 2 - minY * this.zoom + 40 * this.zoom;
    this.applyTransform();
  }

  public relayout(): void {
    const story = this.store.getActiveStory();
    if (!story) return;
    this.store.graphPositions = {};
    this.store.autoLayoutMissing();
    this.render();
    this.fitView();
  }

  private bindEvents(): void {
    if (!this.wrapper || !this.svg) return;

    // 1. 滑鼠按下
    this.svg.addEventListener('mousedown', (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as SVGElement;
      if (target.closest('[data-port-node]')) return; // 點輸出埠不觸發拖動畫布

      const nodeG = target.closest<SVGGElement>('.graph-node');
      if (nodeG) {
        // 記錄候選拖曳節點與起始點，尚未判定為拖曳！
        this.dragCandidateNodeId = nodeG.dataset.nodeId!;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        this.dragNodeInitX = this.store.graphPositions[this.dragCandidateNodeId]?.x ?? 0;
        this.dragNodeInitY = this.store.graphPositions[this.dragCandidateNodeId]?.y ?? 0;
        this.isDraggingNode = false;
      } else {
        // 點擊空白處，準備平移畫布 (Pan)
        this.isPanning = true;
        this.panStartX = event.clientX - this.panX;
        this.panStartY = event.clientY - this.panY;
        this.svg!.style.cursor = 'grabbing';
      }
    });

    // 2. 滑鼠移動
    window.addEventListener('mousemove', (event: MouseEvent) => {
      if (this.isPanning) {
        this.panX = event.clientX - this.panStartX;
        this.panY = event.clientY - this.panStartY;
        this.applyTransform();
      } else if (this.dragCandidateNodeId) {
        const dist = Math.hypot(event.clientX - this.dragStartX, event.clientY - this.dragStartY);
        if (!this.isDraggingNode && dist >= this.DRAG_THRESHOLD) {
          this.isDraggingNode = true;
          this.svg!.style.cursor = 'grabbing';
        }

        if (this.isDraggingNode) {
          const dx = (event.clientX - this.dragStartX) / this.zoom;
          const dy = (event.clientY - this.dragStartY) / this.zoom;
          const newX = Math.max(0, this.dragNodeInitX + dx);
          const newY = Math.max(0, this.dragNodeInitY + dy);
          this.store.graphPositions[this.dragCandidateNodeId] = { x: newX, y: newY };

          const g = this.svg!.querySelector<SVGGElement>(`.graph-node[data-node-id="${this.dragCandidateNodeId}"]`);
          if (g) g.setAttribute('transform', `translate(${newX},${newY})`);

          const edgeLayer = this.svg!.querySelector<SVGGElement>('#graph-edge-layer');
          const story = this.store.getActiveStory();
          if (edgeLayer && story) this.renderEdges(edgeLayer, story);
        }
      }
    });

    // 3. 滑鼠放開
    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.svg!.style.cursor = 'default';
      }

      if (this.dragCandidateNodeId) {
        if (this.isDraggingNode) {
          // 真正的拖曳完成，儲存座標
          const story = this.store.getActiveStory();
          if (story) this.store.saveGraphPos(story.id);
          this.store.autoSaveDraft();
        } else {
          // 只是單純點擊（移動距離 < 5px）➔ 執行乾淨的選取節點！
          const nodeId = this.dragCandidateNodeId;
          this.handleNodeClick(nodeId);
        }

        this.dragCandidateNodeId = null;
        this.isDraggingNode = false;
        this.svg!.style.cursor = 'default';
      }
    });

    // 4. 滾輪縮放
    this.wrapper.addEventListener('wheel', (event: WheelEvent) => {
      event.preventDefault();
      const rect = this.wrapper!.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const oldZoom = this.zoom;
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(2.0, Math.max(0.3, Math.round(oldZoom * factor * 100) / 100));
      if (newZoom === oldZoom) return;

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / oldZoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / oldZoom);
      this.zoom = newZoom;
      this.applyTransform();
    }, { passive: false });

    // 5. 輸出埠點擊牽線
    this.svg.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as SVGElement;
      const port = target.closest<SVGCircleElement>('[data-port-node]');
      if (port) {
        event.stopPropagation();
        const pId = port.dataset.portNode!;
        this.wireSource = this.wireSource === pId ? null : pId;
        const hint = document.getElementById('graph-wire-hint');
        if (hint) hint.hidden = !this.wireSource;
        this.render();
      }
    });
  }

  private handleNodeClick(nodeId: string): void {
    if (this.wireSource && this.wireSource !== nodeId) {
      const srcId = this.wireSource;
      const srcNode = this.store.getActiveStory()?.nodes.find(n => n.id === srcId);
      if (srcNode && !srcNode.completionEffects.some(e => e.type === 'SCHEDULE_NODE' && e.nodeId === nodeId)) {
        srcNode.completionEffects.push({ type: 'SCHEDULE_NODE', nodeId, delayDays: 1 });
      }
      this.wireSource = null;
      const hint = document.getElementById('graph-wire-hint');
      if (hint) hint.hidden = true;
      this.store.selectNode(srcId);
      this.store.autoSaveDraft();
      this.render();
      return;
    }
    this.store.selectNode(nodeId);
  }
}
