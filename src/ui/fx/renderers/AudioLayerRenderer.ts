export interface AudioPlayOptions {
  volume?: number;
  pitch?: number;
  pan?: number;
}

export type AudioPlayHandler = (soundId: string, options?: AudioPlayOptions) => void;

/**
 * 🔊 AudioLayerRenderer
 * 專門負責 VFX 音效軌道、Audio Cue 派發與音量控制的渲染器
 * 依據 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md §6 規格建立
 */
export class AudioLayerRenderer {
  private static isMuted: boolean = false;
  private static masterVolume: number = 1.0;
  private static playHandler: AudioPlayHandler | null = null;

  public static setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public static getMuted(): boolean {
    return this.isMuted;
  }

  public static setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1.0, volume));
  }

  public static getMasterVolume(): number {
    return this.masterVolume;
  }

  public static registerPlayHandler(handler: AudioPlayHandler | null): void {
    this.playHandler = handler;
  }

  /**
   * 觸發 Audio Cue 音效播放
   */
  public static playAudioCue(soundId: string, options?: AudioPlayOptions): void {
    if (this.isMuted || !soundId) return;

    const finalVolume = (options?.volume ?? 1.0) * this.masterVolume;
    if (this.playHandler) {
      try {
        this.playHandler(soundId, { ...options, volume: finalVolume });
      } catch (err) {
        console.warn(`[AudioLayerRenderer] Failed to play sound "${soundId}":`, err);
      }
    }
  }

  public static clear(): void {
    // 預留未來停止目前正在播放之 loop 音訊
  }
}
