import type { NarrativeNode, NarrativeStory } from '../../models/Narrative';
import { BUILTIN_STORIES } from '../../data/StoryData';
import {
  DRAFT_STORAGE_KEY,
  GRAPH_COLS,
  GRAPH_H_GAP,
  GRAPH_POS_KEY,
  GRAPH_V_GAP,
  makeNode,
  safeId,
  uniqueId
} from './StoryStudioTypes';

export type StoreEventType =
  | 'storiesLoaded'
  | 'storySelected'
  | 'nodeSelected'
  | 'nodeUpdated'
  | 'storyUpdated'
  | 'graphPositionsChanged'
  | 'validationChanged';

export class StoryStudioStore {
  private static instance: StoryStudioStore;
  public stories: NarrativeStory[] = [];
  public selectedStoryId: string = '';
  public selectedNodeId: string = '';
  public graphPositions: Record<string, { x: number; y: number }> = {};
  public isFormPopulating: boolean = false;
  
  private listeners: Map<StoreEventType, Set<() => void>> = new Map();

  private constructor() {}

  public static getInstance(): StoryStudioStore {
    if (!StoryStudioStore.instance) {
      StoryStudioStore.instance = new StoryStudioStore();
    }
    return StoryStudioStore.instance;
  }

  public subscribe(event: StoreEventType, callback: () => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  public emit(event: StoreEventType): void {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(); } catch (err) { console.error(`Error in Store listener [${event}]:`, err); }
    });
  }

  public getActiveStory(): NarrativeStory | undefined {
    return this.stories.find(s => s.id === this.selectedStoryId);
  }

  public getActiveNode(): NarrativeNode | undefined {
    return this.getActiveStory()?.nodes.find(n => n.id === this.selectedNodeId);
  }

  public async loadFromProject(): Promise<void> {
    // 1. 優先檢查是否有草稿
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed.stories) && parsed.stories.length > 0) {
          this.stories = parsed.stories;
          this.selectedStoryId = parsed.selectedStoryId || this.stories[0]?.id || '';
          this.selectedNodeId = parsed.selectedNodeId || this.stories[0]?.nodes[0]?.id || '';
          this.loadGraphPos(this.selectedStoryId);
          this.autoLayoutMissing();
          console.log('📝 已從本地草稿還原故事工坊進度');
          this.emit('storiesLoaded');
          return;
        }
      } catch (e) {
        console.warn('讀取故事草稿失敗', e);
      }
    }

    // 2. 向後端讀取
    try {
      const response = await fetch('/api/get-story-definitions');
      if (response.ok) {
        const loaded = await response.json();
        const loadedList: NarrativeStory[] = Array.isArray(loaded) ? loaded : [];
        const loadedIds = new Set(loadedList.map(s => s.id));
        const merged: NarrativeStory[] = [...loadedList];
        for (const builtin of BUILTIN_STORIES) {
          if (!loadedIds.has(builtin.id)) {
            merged.push(JSON.parse(JSON.stringify(builtin)));
          }
        }
        this.stories = merged.length > 0 ? merged : JSON.parse(JSON.stringify(BUILTIN_STORIES));
      } else {
        this.stories = JSON.parse(JSON.stringify(BUILTIN_STORIES));
      }
    } catch {
      this.stories = JSON.parse(JSON.stringify(BUILTIN_STORIES));
    }

    if (!this.stories.some(s => s.id === this.selectedStoryId)) {
      this.selectedStoryId = this.stories[0]?.id ?? '';
      this.selectedNodeId = this.stories[0]?.nodes[0]?.id ?? '';
    }

    this.loadGraphPos(this.selectedStoryId);
    this.autoLayoutMissing();
    this.emit('storiesLoaded');
  }

  public selectStory(storyId: string): void {
    if (this.selectedStoryId === storyId) return;
    this.selectedStoryId = storyId;
    const story = this.getActiveStory();
    this.selectedNodeId = story?.nodes[0]?.id ?? '';
    this.loadGraphPos(storyId);
    this.autoLayoutMissing();
    this.autoSaveDraft();
    this.emit('storySelected');
  }

  public selectNode(nodeId: string): void {
    if (this.selectedNodeId === nodeId) return;
    this.selectedNodeId = nodeId;
    this.emit('nodeSelected');
  }

  public createStory(): void {
    const id = uniqueId('new_story', this.stories.map(s => s.id));
    const newStory: NarrativeStory = {
      id,
      title: '新故事',
      summary: '',
      version: 1,
      enabled: false,
      nodes: [makeNode('opening')]
    };
    this.stories.push(newStory);
    this.selectedStoryId = id;
    this.selectedNodeId = 'opening';
    this.graphPositions = {};
    this.autoLayoutMissing();
    this.saveGraphPos(id);
    this.autoSaveDraft();
    this.emit('storiesLoaded');
  }

  public createNode(): void {
    const story = this.getActiveStory();
    if (!story) return;
    const id = uniqueId('new_node', story.nodes.map(n => n.id));
    const node = makeNode(id);
    story.nodes.push(node);
    this.selectedNodeId = id;
    this.autoLayoutMissing();
    this.saveGraphPos(story.id);
    this.autoSaveDraft();
    this.emit('storyUpdated');
    this.emit('nodeSelected');
  }

  public createBountyNode(): void {
    const story = this.getActiveStory();
    if (!story) return;
    const id = uniqueId('bounty_task', story.nodes.map(n => n.id));
    const node = makeNode(id);
    node.channel = 'BOUNTY_BOARD';
    node.title = '新懸賞委託';
    node.description = '一張張貼在告示欄上的懸賞委託，等待有能力的傭兵接取。';
    node.repeatable = true;
    node.cooldownDays = 3;
    node.bounty = {
      duration: 2,
      expireDays: 4,
      gold: 50,
      exp: 30,
      type: 'NORMAL'
    };
    story.nodes.push(node);
    this.selectedNodeId = id;
    this.autoLayoutMissing();
    this.saveGraphPos(story.id);
    this.autoSaveDraft();
    this.emit('storyUpdated');
    this.emit('nodeSelected');
  }

  public deleteNode(nodeId: string): void {
    const story = this.getActiveStory();
    if (!story) return;
    story.nodes = story.nodes.filter(n => n.id !== nodeId);
    delete this.graphPositions[nodeId];
    this.selectedNodeId = story.nodes[0]?.id ?? '';
    this.saveGraphPos(story.id);
    this.autoSaveDraft();
    this.emit('storyUpdated');
    this.emit('nodeSelected');
  }

  public setNodePosition(nodeId: string, x: number, y: number): void {
    this.graphPositions[nodeId] = { x: Math.max(0, x), y: Math.max(0, y) };
    const story = this.getActiveStory();
    if (story) this.saveGraphPos(story.id);
    this.emit('graphPositionsChanged');
  }

  public loadGraphPos(storyId: string): void {
    try {
      this.graphPositions = JSON.parse(localStorage.getItem(`${GRAPH_POS_KEY}_${storyId}`) ?? '{}');
    } catch {
      this.graphPositions = {};
    }
  }

  public saveGraphPos(storyId: string): void {
    localStorage.setItem(`${GRAPH_POS_KEY}_${storyId}`, JSON.stringify(this.graphPositions));
  }

  public autoLayoutMissing(): void {
    const story = this.getActiveStory();
    if (!story) return;
    story.nodes.forEach((node, i) => {
      if (!this.graphPositions[node.id]) {
        this.graphPositions[node.id] = {
          x: 40 + (i % GRAPH_COLS) * GRAPH_H_GAP,
          y: 40 + Math.floor(i / GRAPH_COLS) * GRAPH_V_GAP
        };
      }
    });
    this.saveGraphPos(story.id);
  }

  public autoSaveDraft(): void {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
        stories: this.stories,
        selectedStoryId: this.selectedStoryId,
        selectedNodeId: this.selectedNodeId,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('自動草稿儲存失敗', e);
    }
  }

  public async saveProject(): Promise<string> {
    const note = prompt('這份快照的備註：', '故事內容調整') ?? '故事內容調整';
    const response = await fetch('/api/save-story-definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stories: this.stories,
        note
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || '寫入專案失敗');
    }

    const res = await response.json();
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return res.snapshot || '完成';
  }

  public getValidationErrors(): string[] {
    const errors: string[] = [];
    const storyIds = new Set<string>();

    for (const story of this.stories) {
      if (!story.id) errors.push(`存在未命名 ID 的故事。`);
      if (storyIds.has(story.id)) errors.push(`故事 ID 重複：「${story.id}」。`);
      storyIds.add(story.id);

      const nodeIds = new Set<string>();
      for (const node of story.nodes) {
        if (!node.id) errors.push(`故事【${story.title}】中有未設定 ID 的節點。`);
        if (nodeIds.has(node.id)) errors.push(`故事【${story.title}】中節點 ID 重複：「${node.id}」。`);
        nodeIds.add(node.id);
      }
    }
    return errors;
  }
}
