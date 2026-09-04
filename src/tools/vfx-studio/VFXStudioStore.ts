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

  public setTrackMute(track: keyof TrackMuteStates, mute: boolean): void {
    this.trackMuteStates[track] = mute;
  }

  public getTrackMuteStates(): TrackMuteStates {
    return { ...this.trackMuteStates };
  }
}
