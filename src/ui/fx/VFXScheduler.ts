import { PlaybackClock, ScheduledTask, TickListener } from './PlaybackClock';

/**
 * ⏱️ VFXScheduler
 * 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 6 節規範之專用排程器
 * 負責演出播放頭、邏輯秒數進度、速度倍率、暫停、跳轉 (Seek) 與完全無殘留取消
 */
export class VFXScheduler extends PlaybackClock {
  constructor(duration: number = 1.0) {
    super(duration);
  }
}

export type { ScheduledTask, TickListener };
