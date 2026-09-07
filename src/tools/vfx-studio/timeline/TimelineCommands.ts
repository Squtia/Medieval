import { ImpactPresentationMode } from '../../../models/VFX';
import { VFXStudioStore, TrackMuteStates } from '../VFXStudioStore';
import { VFXPresetRepository } from '../../../ui/fx/VFXPresetRepository';

/**
 * ⚡ TimelineCommands
 * 時間軸指令操作器 (Timeline Action Commands)
 * 負責處理 Cue 新增/刪除/更新、圖層新增/刪除/時長調整與軌道 Solo/Mute/Lock 狀態變更
 */
export class TimelineCommands {
  private store: VFXStudioStore;

  constructor(store?: VFXStudioStore) {
    this.store = store || VFXStudioStore.getInstance();
  }

  public addNewCueAt(timeInSeconds: number, maxDuration: number): void {
    const preset = this.store.getPreset();
    const cues = [...(preset.impactCues || [])];
    const clampedTime = Math.min(maxDuration, Math.max(0, Number(timeInSeconds.toFixed(2))));
    cues.push({
      cueId: `CUE_${cues.length + 1}`,
      time: clampedTime,
      weight: 1.0,
      isPrimary: false
    });
    cues.sort((a, b) => a.time - b.time);
    this.store.updateConfig({ impactCues: cues }, true);
  }

  public deleteCue(cueIndex: number): void {
    const preset = this.store.getPreset();
    const cues = [...(preset.impactCues || [])];
    if (cueIndex >= 0 && cueIndex < cues.length) {
      cues.splice(cueIndex, 1);
      this.store.updateConfig({ impactCues: cues }, true);
    }
  }

  public updateCueTime(cueIndex: number, newTime: number, maxDuration: number): void {
    const preset = this.store.getPreset();
    const cues = [...(preset.impactCues || [])];
    if (cues[cueIndex]) {
      const clamped = Math.min(maxDuration, Math.max(0, Number(newTime.toFixed(2))));
      cues[cueIndex] = { ...cues[cueIndex], time: clamped };
      cues.sort((a, b) => a.time - b.time);
      this.store.updateConfig({ impactCues: cues }, false);
    }
  }

  public toggleTrackSolo(trackKey: string): void {
    this.store.toggleTrackSolo(trackKey);
  }

  public toggleTrackMute(trackKey: keyof TrackMuteStates): void {
    this.store.toggleTrackMute(trackKey);
  }

  public toggleTrackLock(trackKey: string): void {
    this.store.toggleTrackLock(trackKey);
  }

  public updatePresentationMode(mode: ImpactPresentationMode): void {
    this.store.updateConfig({ impactPresentationMode: mode }, true);
  }

  public addNewLayer(): void {
    const preset = this.store.getPreset();
    const repo = VFXPresetRepository.getInstance();
    const all = repo.getAllPresets();
    const defaultSub = all.find(p => p.id !== preset.id && !p.id.startsWith('COMP_')) || all[0];

    const newLayer = {
      id: `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `次生層 ${(preset.layers?.length || 0) + 1}`,
      presetId: defaultSub ? defaultSub.id : preset.id,
      delay: 0.05,
      duration: Math.max(0.1, Number(((preset.duration || 0.4) * 0.6).toFixed(2))),
      scale: 0.8,
      spatialMode: 'A_TO_B' as const,
      reverse: false,
      fadeIn: 0.05,
      fadeOut: 0.08,
      emitsImpactCue: true,
      generatesHit: false
    };

    const newLayers = [...(preset.layers || []), newLayer];
    this.store.updateConfig({ layers: newLayers }, true);
  }

  public deleteLayer(layerIndex: number): void {
    const preset = this.store.getPreset();
    const layers = [...(preset.layers || [])];
    if (layerIndex >= 0 && layerIndex < layers.length) {
      layers.splice(layerIndex, 1);
      this.store.updateConfig({ layers }, true);
    }
  }

  public updateLayerDelay(layerIndex: number, newDelay: number): void {
    const preset = this.store.getPreset();
    const layers = [...(preset.layers || [])];
    if (layers[layerIndex]) {
      layers[layerIndex] = { ...layers[layerIndex], delay: newDelay };
      this.store.updateConfig({ layers }, false);
    }
  }

  public updateLayerDuration(layerIndex: number, newDuration: number): void {
    const preset = this.store.getPreset();
    const layers = [...(preset.layers || [])];
    if (layers[layerIndex]) {
      layers[layerIndex] = { ...layers[layerIndex], duration: newDuration };
      this.store.updateConfig({ layers }, false);
    }
  }
}
