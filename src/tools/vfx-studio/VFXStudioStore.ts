import { VFXPreset, VFXSequence, getSequenceMainTrack, getSequenceMainClip } from '../../models/VFX';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { normalizeVfxPreset } from '../../ui/fx/VFXPresetNormalizer';

export const VALID_SEQUENCE_ROOT_KEYS = new Set([
  'schemaVersion',
  'id',
  'name',
  'category',
  'description',
  'duration',
  'spatialMode',
  'casterMotion',
  'randomSeed',
  'tags',
  'tracks',
  'impact',
  'impactCues',
  'impactPresentationMode',
  'quality',
  'metadata',
  'layers',
  'usageType',
  'isBuiltin',
  'author'
]);

export function sanitizeSequenceRoot(seq: Record<string, unknown>): VFXSequence {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(seq)) {
    if (VALID_SEQUENCE_ROOT_KEYS.has(k)) {
      clean[k] = v;
    }
  }
  return clean as unknown as VFXSequence;
}

export interface TrackMuteStates {
  main: boolean;
  layers: boolean;
  impact: boolean;
}

export type VFXEditorSelection =
  | { type: 'PRESET' }
  | { type: 'MAIN_TRACK' }
  | { type: 'LAYER'; layerId: string }
  | { type: 'CUE'; cueId: string }
  | { type: 'BINDING'; skillId: string };

export type StoreChangeListener = (preset: VFXPreset & VFXSequence, isDirty: boolean, sequence?: VFXSequence) => void;
export type SelectionChangeListener = (selection: VFXEditorSelection) => void;

/**
 * 📦 VFXStudioStore
 * 特效工房集中狀態管理中樞 (Single Source of State)
 * 負責快照留存、Undo/Redo (上限 50 步)、Dirty Flag、固定 Seed 與軌道 Mute 狀態
 */
export class VFXStudioStore {
  private static instance: VFXStudioStore | null = null;

  public static readonly MAX_HISTORY = 50;

  private currentSequence: VFXSequence;
  private selection: VFXEditorSelection = { type: 'PRESET' };
  private undoStack: VFXSequence[] = [];
  private redoStack: VFXSequence[] = [];
  private isDirty: boolean = false;
  private isFixedSeed: boolean = false;
  private fixedSeedValue: number = 12345;
  private isSlowMo: boolean = false;
  private isDarkBg: boolean = true;
  private isLooping: boolean = true;
  private targetMode: 'SINGLE' | 'FRONT_ROW' | 'ALL_AOE' | 'SIEGE_GATE' = 'SINGLE';

  private trackMuteStates: TrackMuteStates = {
    main: false,
    layers: false,
    impact: false
  };

  // 🛡️ 草稿無損暫存棧 (Draft Stash Stack) - 支援編輯素材時自動暫存當前複合技能
  private stashStack: { sequence: VFXSequence; name: string }[] = [];

  private listeners = new Set<StoreChangeListener>();
  private selectionListeners = new Set<SelectionChangeListener>();
  private isSnapshotPaused: boolean = false;

  private constructor() {
    const repo = VFXPresetRepository.getInstance();
    const all = repo.getAllSequences();
    const initSeq = all.find(s => s.id === 'VFX_HEAVY_STRIKE') || all[0] || ({
      schemaVersion: 2,
      id: 'VFX_HEAVY_STRIKE',
      name: '巨力重劈',
      category: 'PHYSICAL',
      description: '',
      duration: 0.28,
      tracks: [],
      impactCues: []
    } as VFXSequence);
    this.currentSequence = JSON.parse(JSON.stringify(initSeq));
  }

  public static getInstance(): VFXStudioStore {
    const g = globalThis as unknown as { __VFX_STUDIO_STORE_INSTANCE__?: VFXStudioStore };
    if (!VFXStudioStore.instance) {
      if (g.__VFX_STUDIO_STORE_INSTANCE__) {
        VFXStudioStore.instance = g.__VFX_STUDIO_STORE_INSTANCE__;
      } else {
        VFXStudioStore.instance = new VFXStudioStore();
        g.__VFX_STUDIO_STORE_INSTANCE__ = VFXStudioStore.instance;
      }
    }
    return VFXStudioStore.instance;
  }

  public subscribe(listener: StoreChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeSelection(listener: SelectionChangeListener): () => void {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }

  public getSelection(): VFXEditorSelection {
    return { ...this.selection };
  }

  public setSelection(selection: VFXEditorSelection): void {
    this.selection = { ...selection };
    this.notifySelection();
  }

  private notifySelection(): void {
    const sel = { ...this.selection };
    this.selectionListeners.forEach(fn => fn(sel));
  }

  private notify(): void {
    const cloneSeq = JSON.parse(JSON.stringify(this.currentSequence));
    this.listeners.forEach(fn => fn(cloneSeq, this.isDirty, cloneSeq));
  }

  public getSequence(): VFXSequence {
    return JSON.parse(JSON.stringify(this.currentSequence));
  }

  public setSequence(newSequence: VFXSequence, recordHistory: boolean = true): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    this.currentSequence = sanitizeSequenceRoot(JSON.parse(JSON.stringify(newSequence)) as Record<string, unknown>);
    this.isDirty = false;
    this.notify();
  }

  public updateSequence(partial: Partial<VFXSequence>, recordHistory: boolean = false): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    const currentMap = this.currentSequence as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(partial)) {
      if (VALID_SEQUENCE_ROOT_KEYS.has(k)) {
        currentMap[k] = v;
      }
    }
    this.isDirty = true;
    this.notify();
  }

  public updateMainClipData(partialData: Record<string, unknown>, recordHistory: boolean = false): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    const mainClip = getSequenceMainClip(this.currentSequence);
    if (mainClip && mainClip.payload) {
      const existing = (mainClip.payload.data as Record<string, unknown>) || {};
      mainClip.payload.data = { ...existing, ...partialData };
      this.isDirty = true;
      this.notify();
    }
  }

  public getPreset(): VFXPreset & VFXSequence {
    return normalizeVfxPreset(this.getSequence());
  }

  public setPreset(newSequence: VFXSequence, recordHistory: boolean = true): void {
    this.setSequence(newSequence, recordHistory);
  }

  public updateConfig(partial: Record<string, unknown>, recordHistory: boolean = false): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    const isLayerSelected = this.selection.type === 'LAYER';

    // 1. 僅同步 Sequence 頂層合法架構欄位 (若選中次生圖層，spatialMode 嚴禁冒泡污染頂層)
    const currentMap = this.currentSequence as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(partial)) {
      if (VALID_SEQUENCE_ROOT_KEYS.has(k)) {
        if (k === 'spatialMode' && isLayerSelected) {
          continue; // 次生圖層時空模式局部隔離，絕不覆寫全域 Sequence
        }
        currentMap[k] = v;
      }
    }

    // 2. 自動判斷目標 Clip (選取次生圖層 vs 主軌)
    const {
      schemaVersion: _sv,
      id: _id,
      name: _n,
      category: _cat,
      description: _desc,
      duration: _d,
      casterMotion: _cm,
      randomSeed: _rs,
      tags: _tags,
      quality: _q,
      metadata: _meta,
      layers: _l,
      tracks: _t,
      impactCues: _c,
      impactPresentationMode: _m,
      impact: _imp,
      usageType: _ut,
      isBuiltin: _ib,
      author: _auth,
      ...clipSpecificData
    } = partial;

    const mainClip = getSequenceMainClip(this.currentSequence);
    if (mainClip) {
      if (typeof partial.mainDelay === 'number') {
        mainClip.startTime = partial.mainDelay;
      }
      if (typeof partial.mainDuration === 'number') {
        mainClip.duration = partial.mainDuration;
      }
    }

    let targetClip = undefined;
    if (this.selection.type === 'LAYER') {
      const layerId = this.selection.layerId;
      const layerTrack = this.currentSequence.tracks.find(t => t.id === layerId);
      targetClip = layerTrack?.clips[0];

      if (Array.isArray(this.currentSequence.layers)) {
        const lIdx = this.currentSequence.layers.findIndex(l => l.id === layerId);
        if (lIdx >= 0) {
          this.currentSequence.layers[lIdx] = {
            ...this.currentSequence.layers[lIdx],
            ...clipSpecificData
          };
        }
      }
    } else {
      // 只有在非次生圖層選取時，才作用於主軌 mainClip
      targetClip = mainClip;
    }

    if (targetClip && targetClip.payload && Object.keys(clipSpecificData).length > 0) {
      const existingData = (targetClip.payload.data as Record<string, unknown>) || {};
      targetClip.payload.data = {
        ...existingData,
        ...clipSpecificData
      };
      // 🛡️ 時空傳播形態轉換保護：若切換為質點運動或 TRAJECTORY，同步糾偏 targetClip 殘留的 MELEE_SWEEP
      if (partial.spatialMode === 'TRAJECTORY' || partial.spatialTopology === 'POINT_TRANSPORT') {
        const data = targetClip.payload.data as Record<string, unknown>;
        if (data.trajectory === 'MELEE_SWEEP' || data.trajectory === 'AT_TARGET') {
          data.trajectory = (partial.trajectoryPath as string) || 'A_TO_B';
        }
      }
    }

    // 3. 粒子軌同步
    const partTrack = this.currentSequence.tracks.find(t => t.type === 'PARTICLE');
    const partClip = partTrack?.clips[0];
    if (partClip && partClip.payload) {
      const particleProps: Record<string, unknown> = {};
      if (partial.trailCount !== undefined) particleProps.trailCount = partial.trailCount;
      if (partial.trailSize !== undefined) particleProps.trailSize = partial.trailSize;
      if (partial.trailSpread !== undefined) particleProps.trailSpread = partial.trailSpread;
      if (partial.trailStrands !== undefined) particleProps.trailStrands = partial.trailStrands;
      if (partial.burstCount !== undefined) particleProps.burstCount = partial.burstCount;
      if (partial.burstTime !== undefined) particleProps.burstTime = partial.burstTime;
      if (partial.enableTrail !== undefined) particleProps.enableTrail = partial.enableTrail;
      if (partial.trailColor !== undefined) particleProps.trailColor = partial.trailColor;
      if (partial.bloomStr !== undefined) particleProps.bloomStr = partial.bloomStr;
      if (partial.bloomRad !== undefined) particleProps.bloomRad = partial.bloomRad;
      if (partial.bloomThresh !== undefined) particleProps.bloomThresh = partial.bloomThresh;
      if (Object.keys(particleProps).length > 0) {
        const existingPart = (partClip.payload.data as Record<string, unknown>) || {};
        partClip.payload.data = { ...existingPart, ...particleProps };
      }
    }

    // 4. 受擊反饋軌同步 (若尚未建立 IMPACT 軌道，自動為新技能補齊 Canonical 軌道與 Clip)
    if (partial.impact) {
      let impactTrack = this.currentSequence.tracks.find(t => t.type === 'IMPACT');
      if (!impactTrack) {
        impactTrack = {
          id: 'trk_impact',
          name: '受擊反饋軌 (Impact Track)',
          type: 'IMPACT',
          enabled: true,
          clips: [
            {
              id: 'clip_impact_0',
              name: '受擊反饋片段',
              startTime: 0,
              duration: this.currentSequence.duration || 1.0,
              payload: {
                type: 'IMPACT',
                data: { ...(partial.impact as Record<string, unknown>) } as any
              }
            }
          ]
        };
        this.currentSequence.tracks.push(impactTrack);
      } else {
        const impactClip = impactTrack.clips[0];
        if (impactClip && impactClip.payload) {
          const existingImpact = (impactClip.payload.data as Record<string, unknown>) || {};
          impactClip.payload.data = {
            ...existingImpact,
            ...(partial.impact as Record<string, unknown>)
          };
        }
      }
    }

    this.isDirty = true;
    this.notify();
  }

  public recordSnapshot(): void {
    if (this.isSnapshotPaused) return;
    this.undoStack.push(JSON.parse(JSON.stringify(this.currentSequence)));
    if (this.undoStack.length > VFXStudioStore.MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.isDirty = true;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): boolean {
    if (!this.canUndo()) return false;
    this.redoStack.push(JSON.parse(JSON.stringify(this.currentSequence)));
    const prev = this.undoStack.pop()!;
    this.isSnapshotPaused = true;
    this.currentSequence = prev;
    this.isSnapshotPaused = false;
    this.isDirty = true;
    this.notify();
    return true;
  }

  public redo(): boolean {
    if (!this.canRedo()) return false;
    this.undoStack.push(JSON.parse(JSON.stringify(this.currentSequence)));
    const next = this.redoStack.pop()!;
    this.isSnapshotPaused = true;
    this.currentSequence = next;
    this.isSnapshotPaused = false;
    this.isDirty = true;
    this.notify();
    return true;
  }

  public setDirty(dirty: boolean): void {
    this.isDirty = dirty;
    this.notify();
  }

  public getIsDirty(): boolean {
    return this.isDirty;
  }

  public setFixedSeed(fixed: boolean): void {
    this.isFixedSeed = fixed;
    this.notify();
  }

  public getIsFixedSeed(): boolean {
    return this.isFixedSeed;
  }

  public getFixedSeedValue(): number {
    return this.fixedSeedValue;
  }

  public setFixedSeedValue(seed: number): void {
    this.fixedSeedValue = Math.floor(Math.abs(seed)) || 1;
    this.notify();
  }

  public rerollFixedSeed(): number {
    this.fixedSeedValue = Math.floor(Math.random() * 900000) + 100000;
    this.notify();
    return this.fixedSeedValue;
  }

  public setSlowMo(slow: boolean): void {
    this.isSlowMo = slow;
  }

  public getIsSlowMo(): boolean {
    return this.isSlowMo;
  }

  public setDarkBg(dark: boolean): void {
    this.isDarkBg = dark;
  }

  public getIsDarkBg(): boolean {
    return this.isDarkBg;
  }

  public setLooping(loop: boolean): void {
    this.isLooping = loop;
  }

  public getIsLooping(): boolean {
    return this.isLooping;
  }

  public setTargetMode(mode: 'SINGLE' | 'FRONT_ROW' | 'ALL_AOE' | 'SIEGE_GATE'): void {
    this.targetMode = mode;
  }

  public getTargetMode(): 'SINGLE' | 'FRONT_ROW' | 'ALL_AOE' | 'SIEGE_GATE' {
    return this.targetMode;
  }

  private soloTracks: Set<string> = new Set<string>();
  private lockedTracks: Set<string> = new Set<string>();

  public setTrackMute(track: keyof TrackMuteStates, mute: boolean): void {
    this.trackMuteStates[track] = mute;
    this.notify();
  }

  public toggleTrackMute(track: keyof TrackMuteStates): boolean {
    this.trackMuteStates[track] = !this.trackMuteStates[track];
    this.notify();
    return this.trackMuteStates[track];
  }

  public getTrackMuteStates(): TrackMuteStates {
    return { ...this.trackMuteStates };
  }

  public toggleTrackSolo(trackId: string): boolean {
    if (this.soloTracks.has(trackId)) {
      this.soloTracks.delete(trackId);
    } else {
      this.soloTracks.add(trackId);
    }
    this.notify();
    return this.soloTracks.has(trackId);
  }

  public setTrackSolo(track: keyof TrackMuteStates): void {
    if (this.soloTracks.has(track)) {
      this.soloTracks.delete(track);
    } else {
      this.soloTracks.clear();
      this.soloTracks.add(track);
    }
    this.notify();
  }

  public getSoloTrack(): (keyof TrackMuteStates) | null {
    if (this.soloTracks.has('main')) return 'main';
    if (this.soloTracks.has('impact')) return 'impact';
    return null;
  }

  public isTrackSoloed(trackId: string): boolean {
    return this.soloTracks.has(trackId);
  }

  public hasAnySolo(): boolean {
    return this.soloTracks.size > 0;
  }

  public toggleTrackLock(trackId: string): boolean {
    if (this.lockedTracks.has(trackId)) {
      this.lockedTracks.delete(trackId);
    } else {
      this.lockedTracks.add(trackId);
    }
    this.notify();
    return this.lockedTracks.has(trackId);
  }

  public isTrackLocked(trackId: string): boolean {
    return this.lockedTracks.has(trackId);
  }

  /**
   * 判定主軌在當前 Solo/Mute 條件下是否應渲染
   */
  public isMainTrackActive(): boolean {
    if (this.trackMuteStates.main) return false;
    if (this.soloTracks.size > 0) {
      return this.soloTracks.has('main');
    }
    return true;
  }

  /**
   * 判定指定次生圖層在當前 Solo/Mute 條件下是否應渲染
   */
  public isLayerTrackActive(layerIdx: number, layerEnabled: boolean = true): boolean {
    if (!layerEnabled || this.trackMuteStates.layers) return false;
    const layerTrackId = `layer_${layerIdx}`;
    if (this.soloTracks.size > 0) {
      return this.soloTracks.has(layerTrackId);
    }
    return true;
  }

  /**
   * 🛡️ 暫存當前草稿 (Auto Stash Draft)
   * 當創作者跳轉去編輯某素材時調用，保存當前未發布的所有圖層排程、CUE 點與時長
   */
  public stashCurrentDraft(displayName?: string): void {
    const name = displayName || this.currentSequence.name || this.currentSequence.id;
    this.stashStack.push({
      sequence: JSON.parse(JSON.stringify(this.currentSequence)),
      name
    });
  }

  /**
   * 🔙 恢復並彈出最上層暫存草稿
   */
  public popStashedDraft(): VFXSequence | null {
    if (this.stashStack.length === 0) return null;
    const entry = this.stashStack.pop()!;
    this.setSequence(entry.sequence, true);
    return entry.sequence;
  }

  public getHasStash(): boolean {
    return this.stashStack.length > 0;
  }

  public getStashedDraftInfo(): { name: string; count: number } | null {
    if (this.stashStack.length === 0) return null;
    const top = this.stashStack[this.stashStack.length - 1];
    return {
      name: top.name,
      count: this.stashStack.length
    };
  }
}
