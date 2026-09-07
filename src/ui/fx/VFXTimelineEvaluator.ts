import { VFXPreset, VFXImpactConfig, VFXImpactCue, VFXLayer, SalvoRhythmCurve } from '../../models/VFX';

export interface ResolvedLayerItem {
  layer: VFXLayer;
  delay: number;
  resolvedPreset: VFXPreset;
}

export interface HitFeedbackParams {
  shakeIntensity: number;
  shakeDuration: number;
  punchScale: number;
  hitStopTime: number;
  hitFlashColor: string;
  screenShake: boolean;
}

/**
 * ⏱️ VFXTimelineEvaluator
 * 專門負責連擊節奏曲線計算、Impact Cue 解析、打擊時間點提取以及多圖層排程繼承的純邏輯求值器
 * 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md §3, §6, §8 規範
 * 100% 純演算法計算，杜絕 DOM 與 WebGL 渲染耦合，便於進行單元測試與確定性求值
 */
export class VFXTimelineEvaluator {
  /**
   * ⏱️ 計算特效預設之真實總演示時長 (Effective Presentation Duration Envelope)
   * 綜合計算主軌有效時長、連射持續時間、所有次生圖層 (delay + duration) 以及所有 Impact Cue 點位的最大包絡線
   * 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md §5 與選項 B 邊界守護規範
   */
  public static getEffectivePresentationDuration(preset: VFXPreset): number {
    let maxDur = Math.max(0.05, preset.duration || 0.35);

    // 1. 主軌延遲與時長
    const mainDelay = Math.max(0, preset.mainDelay || 0);
    const mainDur = preset.mainDuration !== undefined ? preset.mainDuration : (preset.duration || 0.35);
    maxDur = Math.max(maxDur, mainDelay + mainDur);

    // 2. 連擊時長（僅在真正具備多發連射時生效）
    const isActualSalvo = (preset.salvoCount !== undefined && preset.salvoCount > 1) || preset.trajectory === 'ARC_MULTI';
    if (isActualSalvo && preset.salvoDuration !== undefined && preset.salvoDuration > 0) {
      maxDur = Math.max(maxDur, preset.salvoDuration);
    }

    // 3. 次生圖層時間包絡線
    if (Array.isArray(preset.layers)) {
      for (const layer of preset.layers) {
        if (layer.enabled !== false) {
          const lDelay = Math.max(0, layer.delay || 0);
          const lDur = Math.max(0.05, layer.duration || 0.2);
          maxDur = Math.max(maxDur, lDelay + lDur);
        }
      }
    }

    // 4. 打擊點 Cue 點位時間包絡線
    if (Array.isArray(preset.impactCues)) {
      for (const cue of preset.impactCues) {
        if (typeof cue.time === 'number' && !Number.isNaN(cue.time)) {
          maxDur = Math.max(maxDur, cue.time);
        }
      }
    }

    return Number(maxDur.toFixed(3));
  }

  /**
   * 🚀 計算多段連擊發射時間點序列 (Salvo & Multi-Hit Scheduler)
   * @param preset 特效預設配置
   * @param totalHits 總打擊段數
   * @returns 各段打擊的絕對邏輯觸發秒數陣列
   */
  public static evaluateSalvoTimings(preset: VFXPreset, totalHits: number): number[] {
    const hits = Math.max(1, Math.floor(totalHits));
    const baseOffset = Math.min(preset.duration * 0.4, 0.2);

    if (hits === 1) {
      return [baseOffset];
    }

    const salvoDur = preset.salvoDuration || Math.min(preset.duration * 0.85, 0.45);
    const curve: SalvoRhythmCurve = preset.salvoRhythmCurve || 'LINEAR';
    const timings: number[] = [];

    for (let i = 0; i < hits; i++) {
      const ratio = hits > 1 ? i / (hits - 1) : 0;
      let timeOffset = 0;

      switch (curve) {
        case 'ACCELERATE':
          // 指數急速連射：前慢後急
          timeOffset = Math.pow(ratio, 1.8) * salvoDur;
          break;

        case 'DECELERATE':
          // 爆發後衰減：前急後慢
          timeOffset = Math.sqrt(ratio) * salvoDur;
          break;

        case 'BURST_PAIRS': {
          // 雙發成對點射：兩發緊密，組間有間歇
          const pairIdx = Math.floor(i / 2);
          const inPair = i % 2;
          timeOffset = pairIdx * (salvoDur * 0.6) + inPair * 0.06;
          break;
        }

        case 'STAGGERED': {
          // 隨機交錯微擾
          const jitter = (i % 2 === 1) ? 0.02 : -0.01;
          timeOffset = Math.max(0, ratio * salvoDur + jitter);
          break;
        }

        case 'LINEAR':
        default:
          // 等距均勻
          timeOffset = ratio * salvoDur;
          break;
      }

      const triggerTimeSec = Math.min(preset.duration, timeOffset + baseOffset);
      timings.push(Number(triggerTimeSec.toFixed(4)));
    }

    // 確保時間序列嚴格單調不減
    for (let i = 1; i < timings.length; i++) {
      if (timings[i] < timings[i - 1]) {
        timings[i] = timings[i - 1];
      }
    }

    return timings;
  }

  /**
   * 🎯 解析預設之 Impact Cues (優先具名 Cue，無則依連擊曲線動態展開 Fallback Cues)
   * 嚴格遵循 §8 EXACT_IMPACTS 規範
   */
  public static resolveImpactCues(preset: VFXPreset): VFXImpactCue[] {
    if (Array.isArray(preset.impactCues) && preset.impactCues.length > 0) {
      return [...preset.impactCues].sort((a, b) => a.time - b.time);
    }

    const totalHits = Math.max(1, preset.hitCount || preset.salvoCount || 1);
    const timings = this.evaluateSalvoTimings(preset, totalHits);

    return timings.map((time, idx) => ({
      cueId: `${preset.id || 'fx'}_cue_${idx}`,
      time,
      kind: 'IMPACT',
      weight: 1,
      isPrimary: idx === totalHits - 1,
      targetPolicy: 'PRIMARY_TARGET'
    }));
  }

  /**
   * 🔮 解析複合多圖層特效排程 (Composite VFX Layers Resolver)
   * 安全解析次生圖層延遲、運動軌跡覆蓋與著色器繼承
   */
  public static resolveCompositeLayers(preset: VFXPreset): ResolvedLayerItem[] {
    if (!preset.layers || preset.layers.length === 0) {
      return [];
    }

    const results: ResolvedLayerItem[] = [];

    preset.layers.forEach((layer, idx) => {
      if (layer.enabled === false) return; // 略過被 Mute 的圖層

      const delay = Math.max(0, layer.delay !== undefined ? layer.delay : 0.1);

      const resolvedPreset: VFXPreset = {
        ...preset,
        id: layer.id || `${preset.id}_layer_${idx}`,
        name: layer.name || `${preset.name} (Layer ${idx + 1})`,
        trajectory: layer.trajectory || preset.trajectory,
        spatialMode: layer.spatialMode || preset.spatialMode,
        trajectoryPath: layer.trajectoryPath || preset.trajectoryPath,
        reverse: layer.reverse !== undefined ? layer.reverse : preset.reverse,
        shaderMode: layer.shaderMode || preset.shaderMode,
        colorCore: layer.colorCore || preset.colorCore,
        colorRim: layer.colorRim || preset.colorRim,
        scale: (layer.scale || 1) * preset.scale,
        duration: layer.duration || preset.duration,
        layers: undefined // 避免無限遞迴
      };

      results.push({
        layer,
        delay,
        resolvedPreset
      });
    });

    return results;
  }

  /**
   * 💥 計算單次打擊之受擊回饋參數 (支援前段輕顫 + 終結重震 multiHitImpact)
   */
  public static calculateHitFeedback(
    impactConfig: VFXImpactConfig,
    hitIndex: number,
    totalHits: number,
    multiHitImpact: boolean = false
  ): HitFeedbackParams {
    const isFinalHit = hitIndex >= totalHits - 1;

    if (multiHitImpact && !isFinalHit) {
      // 多段打擊前段：輕顫、微形變、無全螢幕震動
      return {
        shakeIntensity: Math.max(2, impactConfig.shakeIntensity * 0.4),
        shakeDuration: Math.max(0.1, impactConfig.shakeDuration * 0.6),
        punchScale: 1.0 - (1.0 - impactConfig.targetPunchScale) * 0.5,
        hitStopTime: Math.floor(impactConfig.hitStopTime * 0.3),
        hitFlashColor: impactConfig.hitFlashColor,
        screenShake: false
      };
    }

    // 終結擊或單擊：完整重量反饋
    return {
      shakeIntensity: impactConfig.shakeIntensity,
      shakeDuration: impactConfig.shakeDuration,
      punchScale: impactConfig.targetPunchScale,
      hitStopTime: impactConfig.hitStopTime,
      hitFlashColor: impactConfig.hitFlashColor,
      screenShake: impactConfig.screenShake
    };
  }
}
