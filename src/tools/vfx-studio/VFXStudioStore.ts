import { VFXPreset } from '../../models/VFX';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';

export interface TrackMuteStates {
  main: boolean;
  layers: boolean;
  impact: boolean;
}

export type StoreChangeListener = (preset: VFXPreset, isDirty: boolean) => void;

/**
 * 📦 VFXStudioStore
 * 特效工房集中狀態管理中樞 (Single Source of State)
 * 負責快照留存、Undo/Redo (上限 50 步)、Dirty Flag、固定 Seed 與軌道 Mute 狀態
 */
export class VFXStudioStore {
  private static instance: VFXStudioStore | null = null;

  public static readonly MAX_HISTORY = 50;

  private currentPreset: VFXPreset;
  private undoStack: VFXPreset[] = [];
  private redoStack: VFXPreset[] = [];
  private isDirty: boolean = false;
  private isFixedSeed: boolean = false;
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
  private stashStack: { preset: VFXPreset; name: string }[] = [];

  private listeners = new Set<StoreChangeListener>();
  private isSnapshotPaused: boolean = false;

  private constructor() {
    const repo = VFXPresetRepository.getInstance();
    const all = repo.getAllPresets();
    const initPreset = all.find(p => p.id === 'VFX_HEAVY_STRIKE') || all[0] || ({} as VFXPreset);
    this.currentPreset = JSON.parse(JSON.stringify(initPreset));
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

  private notify(): void {
    const clone = JSON.parse(JSON.stringify(this.currentPreset));
    this.listeners.forEach(fn => fn(clone, this.isDirty));
  }

  public getPreset(): VFXPreset {
    return JSON.parse(JSON.stringify(this.currentPreset));
  }

  public setPreset(newPreset: VFXPreset, recordHistory: boolean = true): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    this.currentPreset = JSON.parse(JSON.stringify(newPreset));
    this.isDirty = true;
    this.notify();
  }

  public updateConfig(partial: Partial<VFXPreset>, recordHistory: boolean = false): void {
    if (recordHistory && !this.isSnapshotPaused) {
      this.recordSnapshot();
    }
    Object.assign(this.currentPreset, partial);
    this.isDirty = true;
    this.notify();
  }

  public recordSnapshot(): void {
    if (this.isSnapshotPaused) return;
    this.undoStack.push(JSON.parse(JSON.stringify(this.currentPreset)));
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
    this.redoStack.push(JSON.parse(JSON.stringify(this.currentPreset)));
    const prev = this.undoStack.pop()!;
    this.isSnapshotPaused = true;
    this.currentPreset = prev;
    this.isSnapshotPaused = false;
    this.isDirty = true;
    this.notify();
    return true;
  }

  public redo(): boolean {
    if (!this.canRedo()) return false;
    this.undoStack.push(JSON.parse(JSON.stringify(this.currentPreset)));
    const next = this.redoStack.pop()!;
    this.isSnapshotPaused = true;
    this.currentPreset = next;
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
  }

  public getIsFixedSeed(): boolean {
    return this.isFixedSeed;
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
    const name = displayName || this.currentPreset.name || this.currentPreset.id;
    this.stashStack.push({
      preset: JSON.parse(JSON.stringify(this.currentPreset)),
      name
    });
  }

  /**
   * 🔙 恢復並彈出最上層暫存草稿
   */
  public popStashedDraft(): VFXPreset | null {
    if (this.stashStack.length === 0) return null;
    const entry = this.stashStack.pop()!;
    this.setPreset(entry.preset, true);
    return entry.preset;
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
