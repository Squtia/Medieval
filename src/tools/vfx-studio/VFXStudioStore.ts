import { VFXPreset, VFXSequence, getSequenceMainTrack, getSequenceMainClip } from '../../models/VFX';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { normalizeVfxPreset } from '../../ui/fx/VFXPresetNormalizer';

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

export type StoreChangeListener = (preset: any, isDirty: boolean, sequence?: VFXSequence) => void;
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
    if (!VFXStudioStore.instance) {
      VFXStudioStore.instance = new VFXStudioStore();
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
    this.currentSequence = JSON.parse(JSON.stringify(newSequence));
    this.isDirty = true;
    this.notify();
  }

  public updateSequence(partial: Partial<VFXSequence>, recordHistory: boolean = false): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    Object.assign(this.currentSequence, partial);
    this.isDirty = true;
    this.notify();
  }

  public updateMainClipData(partialData: Record<string, any>, recordHistory: boolean = false): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    const mainClip = getSequenceMainClip(this.currentSequence);
    if (mainClip && mainClip.payload) {
      mainClip.payload.data = { ...(mainClip.payload.data as any), ...partialData };
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

  public updateConfig(partial: Record<string, any>, recordHistory: boolean = false): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    // 1. 同步根物件
    Object.assign(this.currentSequence, partial);

    // 2. 自動判斷目標 Clip (選取次生圖層 vs 主軌)
    const {
      layers: _l,
      tracks: _t,
      duration: _d,
      impactCues: _c,
      impactPresentationMode: _m,
      impact: _imp,
      ...clipSpecificData
    } = partial;

    const mainClip = getSequenceMainClip(this.currentSequence);
    if (mainClip) {
      if (partial.mainDelay !== undefined) {
        mainClip.startTime = partial.mainDelay;
      }
      if (partial.mainDuration !== undefined) {
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
    }
    if (!targetClip) {
      targetClip = mainClip;
    }

    if (targetClip && targetClip.payload && Object.keys(clipSpecificData).length > 0) {
      targetClip.payload.data = {
        ...(targetClip.payload.data as any),
        ...clipSpecificData
      };
      // 🛡️ 時空傳播形態轉換保護：若切換為質點運動或 TRAJECTORY，同步糾偏 targetClip 殘留的 MELEE_SWEEP
      if (partial.spatialMode === 'TRAJECTORY' || partial.spatialTopology === 'POINT_TRANSPORT') {
        const data = targetClip.payload.data as any;
        if (data.trajectory === 'MELEE_SWEEP' || data.trajectory === 'AT_TARGET') {
          data.trajectory = partial.trajectoryPath || 'A_TO_B';
        }
        if ((this.currentSequence as any).trajectory === 'MELEE_SWEEP' || (this.currentSequence as any).trajectory === 'AT_TARGET') {
          (this.currentSequence as any).trajectory = partial.trajectoryPath || 'A_TO_B';
        }
      }
    }

    // 3. 粒子軌同步
    const partTrack = this.currentSequence.tracks.find(t => t.type === 'PARTICLE');
    const partClip = partTrack?.clips[0];
    if (partClip && partClip.payload) {
      const particleProps: Record<string, any> = {};
      if (partial.trailCount !== undefined) particleProps.trailCount = partial.trailCount;
      if (partial.trailSize !== undefined) particleProps.trailSize = partial.trailSize;
      if (partial.burstCount !== undefined) particleProps.burstCount = partial.burstCount;
      if (partial.enableTrail !== undefined) particleProps.enableTrail = partial.enableTrail;
      if (partial.trailColor !== undefined) particleProps.trailColor = partial.trailColor;
      if (partial.bloomStr !== undefined) particleProps.bloomStr = partial.bloomStr;
      if (partial.bloomRad !== undefined) particleProps.bloomRad = partial.bloomRad;
      if (partial.bloomThresh !== undefined) particleProps.bloomThresh = partial.bloomThresh;
      if (Object.keys(particleProps).length > 0) {
        partClip.payload.data = { ...(partClip.payload.data as any), ...particleProps };
      }
    }

    // 4. 受擊反饋軌同步
    const impactTrack = this.currentSequence.tracks.find(t => t.type === 'IMPACT');
    const impactClip = impactTrack?.clips[0];
    if (impactClip && impactClip.payload && partial.impact) {
      impactClip.payload.data = {
        ...(impactClip.payload.data as any),
        ...partial.impact
      };
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
