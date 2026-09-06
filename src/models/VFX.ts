export type VFXTrajectory =
  | 'HORIZONTAL'       // 水平飛行彈道（箭矢、火球、冰槍）
  | 'VERTICAL_DROP'    // 垂直天降（雷殛、神聖光柱）
  | 'DIAGONAL_DROP'    // 斜向天傾（天降隕石、天火）
  | 'GROUND_BURST'     // 地面破土噴發（地刺、裂地震波）
  | 'GROUND_FISSURE'   // 施術者向目標推進的大地衝擊裂地波（浪湧地刺/地火連爆）
  | 'COLUMN_PIERCE'    // 直線排式穿刺（貫穿射擊）
  | 'MELEE_SWEEP'      // 近戰弧光揮擊（單體斬擊、旋風斬、死神鐮刀）
  | 'BODY_AURA'        // 自身/全隊光環升騰（治療、戰吼、神聖庇護）
  | 'ARC_MULTI'        // 弧線分散連射（奧術飛彈、精靈舞連鎖）
  | 'PARABOLA_ARC'     // 拋物線拋射（弓兵齊射、箭雨）
  | 'SHIELD_BARRIER'   // 神聖/金屬光盾升騰防護（神聖庇護、聖盾）
  | 'SHOUT_WAVE';      // 戰吼威懾與同心音波震盪（嘲諷、掩護、戰吼）

export type VFXShaderMode =
  | 'FRESNEL_ICE'          // 菲涅爾冰晶著色器
  | 'VOLUMETRIC_FIRE'      // 3D 體積黑體輻射火焰
  | 'DIELECTRIC_LIGHTNING'  // 介質擊穿電弧
  | 'ENERGY_BEAM'          // 高能聚能雷射束
  | 'HOLY_LIGHT'           // 神聖光耀天罰柱
  | 'DARK_VOID'            // 暗影虛空侵蝕
  | 'SLASH_BLADE'          // 刀刃弧芒與殘影斬光
  | 'EARTH_SHATTER';       // 碎石崩裂與重擊震波

export interface VFXImpactConfig {
  hitStopTime: number;          // 命中瞬間定格時間 (ms，例如 30~80ms，營造砍入肉裡的重量感)
  targetPunchScale: number;     // 受擊卡牌形變縮放比例 (例如 0.90x 擠壓後回彈)
  shakeIntensity: number;       // 卡牌受擊震動振幅 (px，輕擊 4px、重擊 12px、巨刃 20px)
  shakeDuration: number;        // 震動持續時間 (s，例如 0.25s)
  penetrationDistance: number;  // 穿刺貫通向後延伸距離 (px，如穿刺箭 60px)
  knockbackDistance: number;    // 受擊卡牌被衝擊力推後的短暫位移 (px)
  hitFlashColor: string;        // 受擊高光閃爍顏色 ('#ffffff' 白閃, '#ef4444' 鮮紅, '#38bdf8' 冰藍, '#fef08a' 雷黃, '#c084fc' 暗紫)
  screenShake: boolean;         // 是否觸發全螢幕視窗震動 (大招/隕石)
}

export type SalvoRhythmCurve = 
  | 'LINEAR'       // 等距均勻
  | 'ACCELERATE'   // 指數急速連射
  | 'DECELERATE'   // 爆發後衰減
  | 'BURST_PAIRS'  // 雙發點射成對
  | 'STAGGERED';   // 隨機微擾散佈

export interface VFXPreset {
  id: string;
  name: string;
  category: 'PHYSICAL' | 'ELEMENTAL' | 'HOLY_DARK' | 'SPECIAL';
  description: string;
  
  // 視覺渲染參數
  trajectory: VFXTrajectory;
  spatialMode?: VFXSpatialMode; // 規範新版：時空發生模式 (AT_CASTER | AT_TARGET | 5大彈道路徑)
  trajectoryPath?: VFXTrajectoryPath; // 5 大幾何彈道路徑
  reverse?: boolean;            // 🔄 反向開關 (例如 B➔A 吸血、垂直沖天、斜向擊飛)
  shaderMode: VFXShaderMode;
  colorCore: string;
  colorRim: string;
  duration: number;             // 飛行/動畫總時間 (s)
  mainDelay?: number;           // 主軌前搖延遲 (s，預設 0.0s)
  mainDuration?: number;        // 主軌有效播放時長 (s，預設等於或小於 duration)
  scale: number;                // 尺寸比例
  spin: number;                 // 自轉速度
  fresnel: number;              // 邊緣高光權重
  trailCount: number;           // 拖尾粒子數
  trailSize: number;            // 拖尾尺寸
  spikes: number;               // 次生尖刺/碎屑數量
  spikeHeight: number;          // 尖刺高度
  burstCount: number;           // 命中爆散粒子數
  bloomStr: number;             // 發光光學強度
  bloomRad: number;             // 輝光模糊半徑
  bloomThresh: number;          // 輝光閾值

  // 💡 精準光學與泛光控制
  glowRadius?: number;          // 光暈面片半徑 (px，預設 80，範圍 10~220)
  glowOpacity?: number;         // 光暈透明度 (預設 0.85，範圍 0.0~1.0)
  coreBrightness?: number;      // 核心亮度白熾度 (預設 1.0，範圍 0.2~2.0)
  flameTurbulence?: number;     // 體積黑體火焰頂點熱浪震顫強度 (0~20)
  flameTurbulenceSpeed?: number;// 體積黑體火焰震顫頻率 (0.5~5.0)
  coreMeshShape?: 'SPHERE' | 'DIAMOND' | 'ARROW' | 'STAR' | 'RING'; // 核心幾何彈頭形態

  // 🚀 彈幕發射與節奏曲線參數
  salvoCount?: number;          // 連射彈數 (1~12)
  salvoDuration?: number;       // 連射總持續時間 (s)
  salvoRhythmCurve?: SalvoRhythmCurve; // 節奏曲線
  salvoSpreadAngle?: number;    // 散射偏角 (度)
  salvoSpreadRadius?: number;   // 受擊散佈半徑 (px，多發時落點隨機擾動)
  arcHeight?: number;           // 拋物線高度 (px)
  multiHitImpact?: boolean;     // 是否前段輕顫 + 終結重震

  // 🛡️ 專屬幾何與模型紋理形態
  slashShape?: 'CRESCENT' | 'CROSS' | 'WHIRLWIND';
  slashTrajectory?: 'CLEAVE_DOWN' | 'UPPER_CUT' | 'HORIZONTAL' | 'VERTICAL_DOWN' | 'CUSTOM';
  slashAngle?: number;          // 斬擊起手起始角度 (-180° ~ 180°)
  slashArcSpan?: number;        // 斬擊揮砍弧度跨度 (30° ~ 240°)
  slashAspect?: number;         // 刀芒長寬扁平比例 (0.4 ~ 2.0)
  slashReverse?: boolean;       // 是否反轉揮砍方向
  slashBladeWidth?: number;     // 刀刃寬度/粗細 (px，預設 10px，範圍 2px~50px)
  slashRadius?: number;         // 劍氣弧光半徑 (px，預設 65px，範圍 30px~130px)
  slashAngleJitter?: number;    // 多發斬擊隨機角度擾動 (度，0°~60°)
  slashAlternating?: boolean;   // 多發斬擊左右反手交錯出刀

  // 🌋 次生晶刺 / 地刺幾何形態
  spikeShape?: 'CONE_SPIKE' | 'CRYSTAL_PRISM' | 'JAGGED_ROCK' | 'PILLAR_COLUMN';
  spikeWidth?: number;          // 地刺粗細半徑 (px，預設 7px，範圍 2px~35px)
  spikeAngle?: number;          // 地刺方位旋轉角度 (0° ~ 360°)
  spikeRadius?: number;         // 地刺生長分佈範圍 (px，預設 80px，範圍 20px~280px)
  spikeStagger?: number;        // 破土連鎖時差 (ms，預設 25ms，範圍 0ms~80ms)
  spikeAlignToImpact?: boolean; // 地刺是否自動順應衝擊向量
  spikeMaterialMode?: 'PHONG' | 'BASIC'; // 尖岩材質模式：PHONG 實體明暗漫反射(預設) / BASIC 發光晶芒
  spikeEruptFire?: boolean;     // 破土尖峰時伴生體積熱浪噴火

  shieldShape?: 'HEX' | 'CROSS_SHIELD' | 'RUNE_RING';
  waveCount?: number;
  textureSprite?: 'GLOW' | 'STAR' | 'RUNE' | 'FIRE';

  // 💥 受擊衝擊波與光圈形態 (Impact Wave)
  waveRadius?: number;          // 衝擊光圈擴散最大半徑 (px，預設 65，範圍 20~180)
  waveThickness?: number;       // 衝擊光圈線條粗細 (px，預設 4，範圍 1~25)
  waveColor?: string;           // 衝擊光圈顏色 (hex，留空則跟隨 colorCore)
  waveBlur?: number;            // 邊緣柔化/羽化程度 (0.0~1.0，0=硬邊，1=柔焦氣浪)
  wavePlane?: 'CAMERA' | 'GROUND'; // 擴散平面 (CAMERA=面朝鏡頭，GROUND=水平地面)
  
  // 戰鬥打擊感與節奏斷點參數
  impact: VFXImpactConfig;

  // 🏃 施術者發力動作與反饋 (Caster Action Motion)
  casterMotion?: VFXCasterMotionConfig;

  // 🔮 複合多圖層特效支援 (Composite VFX Layers)
  layers?: VFXLayer[];
  hitCount?: number;            // 戰鬥 HIT 判定段數（未填則預設使用 salvoCount 或 1）
  impactCues?: VFXImpactCue[];  // 具名時間軸 Impact Cue
  impactPresentationMode?: ImpactPresentationMode; // 傷害數值呈現模式
}

export interface VFXCasterMotionConfig {
  stepForward?: number;         // 踏步突進距離 (px，例如揮砍向前踏 25px)
  recoil?: number;              // 射擊後坐力位移 (px，例如向後彈 12px)
  tiltAngle?: number;           // 發力瞬間傾斜角度 (度，例如 -6°)
  motionDuration?: number;      // 動作持續時間 (秒，預設 0.25s)
}

export interface VFXLayer {
  id?: string;
  name?: string;
  presetId?: string;           // 引用現有特效庫之 Preset ID 單元 (積木組合)
  trajectory?: VFXTrajectory;
  spatialMode?: VFXSpatialMode; // 原地類 或 5種彈道路徑之一
  trajectoryPath?: VFXTrajectoryPath;
  reverse?: boolean;           // 🔄 是否反向運動
  enabled?: boolean;           // 是否啟用 (false 即 Mute 靜音)
  shaderMode?: VFXShaderMode;
  colorCore?: string;
  colorRim?: string;
  delay?: number;              // 延遲播放 (秒)
  scale?: number;
  duration?: number;
  fadeIn?: number;             // 影格基礎淡入時長 (秒，預設 0.05s)
  fadeOut?: number;            // 影格基礎淡出時長 (秒，預設 0.08s)
  fadeMode?: 'OPACITY' | 'SCALE' | 'BOTH'; // 邊緣衰減模式 (透明度 / 尺寸 / 兩者兼具)
  generatesHit?: boolean;      // 舊版相容：是否產生真實戰鬥 HIT 判定
  emitsImpactCue?: boolean;    // 是否產生演出命中 cue (受擊閃光、抖動與跳字)
}

export type VFXCueKind = 'IMPACT' | 'HEAL' | 'SHIELD' | 'STATUS' | 'VISUAL_ONLY';
export type VFXCueTargetPolicy = 'PRIMARY_TARGET' | 'EACH_TARGET' | 'CASTER';

export interface VFXImpactCue {
  cueId: string;
  time: number;                // 命中發生時間 (秒)
  kind?: VFXCueKind;           // 演出類型 (預設 IMPACT)
  weight?: number;             // 權重 (供 SPLIT_SINGLE_IMPACT 拆分跳字)
  isPrimary?: boolean;         // 是否為主命中點 (PRIMARY_ONLY 模式於此 cue 跳出完整傷害)
  targetPolicy?: VFXCueTargetPolicy; // 目標受擊派發策略 (預設 PRIMARY_TARGET)
  layerId?: string;
}

export type ImpactPresentationMode =
  | 'EXACT_IMPACTS'            // 真多段傷害：一筆 impact 對一個 cue
  | 'SPLIT_SINGLE_IMPACT'      // 單次傷害、多段演出：依權重拆分跳字
  | 'PRIMARY_ONLY';            // 僅在 Primary Cue (最後一段) 顯示完整傷害，其餘為純視覺打擊感

export type VFXTrackType =
  | 'MESH' | 'PARTICLE' | 'TRAIL' | 'DECAL'
  | 'LIGHT' | 'IMPACT' | 'SCREEN_FX' | 'AUDIO' | 'CUE';

export interface VFXQualityProfile {
  maxParticles: number;
  maxDrawCalls: number;
  maxConcurrentObjects: number;
  allowScreenShake: boolean;
  allowBloom: boolean;
}

export interface VFXClip {
  id: string;
  startTime: number;
  duration: number;
  layer?: any;
  curves?: Record<string, any>;
}

export interface VFXTrack {
  id: string;
  name: string;
  type: VFXTrackType;
  enabled: boolean;
  locked?: boolean;
  clips: VFXClip[];
}

export interface VFXSequence {
  schemaVersion: number;
  id: string;
  name: string;
  category: 'PHYSICAL' | 'ELEMENTAL' | 'HOLY_DARK' | 'SPECIAL';
  description: string;
  duration: number;
  randomSeed?: number;
  tags?: string[];
  tracks: VFXTrack[];
  impactCues: VFXImpactCue[];
  quality?: VFXQualityProfile;
  metadata?: Record<string, any>;
}

export interface SkillVfxBinding {
  skillId: string;
  vfxId: string;
  impactPresentationMode: ImpactPresentationMode;
  cueMap?: Record<string, string>;
}

/**
 * 🔄 純函式將舊版 VFXPreset 遷移為規範 VFXSequence 結構
 */
export function migrateLegacyPreset(preset: VFXPreset): VFXSequence {
  const dur = preset.duration || 0.35;
  const tracks: VFXTrack[] = [
    {
      id: 'trk_main',
      name: '主特效軌 (Main Track)',
      type: 'MESH',
      enabled: true,
      clips: [{
        id: `clip_main_${preset.id}`,
        startTime: 0,
        duration: dur,
        layer: {
          trajectory: preset.trajectory,
          shaderMode: preset.shaderMode,
          colorCore: preset.colorCore,
          colorRim: preset.colorRim,
          scale: preset.scale
        }
      }]
    }
  ];

  if (preset.layers && preset.layers.length > 0) {
    tracks.push({
      id: 'trk_layers',
      name: '次生圖層軌 (Layers Track)',
      type: 'PARTICLE',
      enabled: true,
      clips: preset.layers.map((l, i) => ({
        id: `clip_layer_${i}`,
        startTime: l.delay || 0,
        duration: l.duration || 0.2,
        layer: l
      }))
    });
  }

  if (preset.impact) {
    tracks.push({
      id: 'trk_impact',
      name: '打擊反饋軌 (Impact Track)',
      type: 'IMPACT',
      enabled: true,
      clips: [{
        id: `clip_impact_${preset.id}`,
        startTime: preset.impactCues?.[0]?.time || (dur * 0.7),
        duration: preset.impact.shakeDuration || 0.28,
        layer: preset.impact
      }]
    });
  }

  return {
    schemaVersion: 1,
    id: preset.id,
    name: preset.name || preset.id,
    category: preset.category || 'SPECIAL',
    description: preset.description || '',
    duration: dur,
    tracks,
    impactCues: preset.impactCues || [
      { cueId: 'CUE_1', time: Number((dur * 0.7).toFixed(2)), weight: 1.0, isPrimary: true }
    ],
    quality: {
      maxParticles: preset.burstCount || 60,
      maxDrawCalls: 12,
      maxConcurrentObjects: 30,
      allowScreenShake: !!preset.impact?.screenShake,
      allowBloom: (preset.bloomStr || 0) > 0
    }
  };
}

/**
 * 🌐 三大時空錨點分類
 * - AT_CASTER: 固定於施術者 (A 點)
 * - TRAJECTORY: 位移飛行彈道 (A ➔ B 等 5 大幾何路徑)
 * - AT_TARGET: 固定於受擊目標 (B 點)
 */
export type VFXSpatialAnchor = 'AT_CASTER' | 'TRAJECTORY' | 'AT_TARGET';

/**
 * 🚀 5 大位移彈道路徑 (支援 reverse 反向)
 * - A_TO_B: 施術者 ➔ 目標 (正向直射/拋物線，反向為 B ➔ A 汲取/吸血)
 * - A_TO_VERTICAL_SKY: 施術者 ➔ 垂直天空 (朝天射箭/信號彈，反向為天光垂直灌頂 A 自身)
 * - VERTICAL_SKY_TO_B: 垂直天空 ➔ 目標 (天降雷殛直劈，反向為目標垂直擊飛沖天)
 * - A_TO_DIAGONAL_SKY: 施術者 ➔ 斜向天空 (斜天際迫擊發射，反向為斜方星光匯聚 A 點)
 * - DIAGONAL_SKY_TO_B: 斜向天空 ➔ 目標 (斜降隕石天火，反向為目標被斜向擊飛出鏡頭)
 */
export type VFXTrajectoryPath =
  | 'A_TO_B'
  | 'A_TO_VERTICAL_SKY'
  | 'VERTICAL_SKY_TO_B'
  | 'A_TO_DIAGONAL_SKY'
  | 'DIAGONAL_SKY_TO_B';

/**
 * 🌐 完整的時空發生模式 (包含 2 種原地類 + 5 種位移彈道類)
 */
export type VFXSpatialMode =
  | 'AT_CASTER'
  | 'AT_TARGET'
  | 'A_TO_B'
  | 'A_TO_VERTICAL_SKY'
  | 'VERTICAL_SKY_TO_B'
  | 'A_TO_DIAGONAL_SKY'
  | 'DIAGONAL_SKY_TO_B';

export function getTrajectorySpatialAnchor(trajectory?: VFXTrajectory | string): VFXSpatialAnchor {
  if (!trajectory) return 'AT_TARGET';
  switch (trajectory) {
    case 'BODY_AURA':
    case 'SHIELD_BARRIER':
    case 'SHOUT_WAVE':
    case 'AT_CASTER':
      return 'AT_CASTER';
    case 'HORIZONTAL':
    case 'PARABOLA_ARC':
    case 'COLUMN_PIERCE':
    case 'GROUND_FISSURE':
    case 'ARC_MULTI':
    case 'A_TO_B':
    case 'A_TO_VERTICAL_SKY':
    case 'VERTICAL_SKY_TO_B':
    case 'A_TO_DIAGONAL_SKY':
    case 'DIAGONAL_SKY_TO_B':
      return 'TRAJECTORY';
    case 'MELEE_SWEEP':
    case 'VERTICAL_DROP':
    case 'DIAGONAL_DROP':
    case 'GROUND_BURST':
    case 'AT_TARGET':
    default:
      return 'AT_TARGET';
  }
}

export interface Spatial2DPoint {
  x: number;
  y: number;
}

/**
 * 📐 計算時空點位在任意時間進度 (0~1) 下的即時 2D 空間座標
 * 支援 5 大位移彈道路徑與 reverse 反向開關
 */
export function calculateSpatialPoint(
  spatialMode: VFXSpatialMode | VFXTrajectory | string,
  reverse: boolean,
  progress: number,
  casterPoint: Spatial2DPoint,
  targetPoint: Spatial2DPoint
): Spatial2DPoint {
  const p = Math.max(0, Math.min(1, progress));

  // 1. 原地類
  if (spatialMode === 'AT_CASTER' || spatialMode === 'BODY_AURA' || spatialMode === 'SHIELD_BARRIER' || spatialMode === 'SHOUT_WAVE') {
    return { x: casterPoint.x, y: casterPoint.y };
  }
  if (spatialMode === 'AT_TARGET' || spatialMode === 'MELEE_SWEEP' || spatialMode === 'GROUND_BURST') {
    return { x: targetPoint.x, y: targetPoint.y };
  }

  // 2. 位移彈道類：計算端點 (StartPoint & EndPoint)
  let startX = casterPoint.x;
  let startY = casterPoint.y;
  let endX = targetPoint.x;
  let endY = targetPoint.y;

  // 定義天頂座標（正上方或斜上方）
  const verticalSkyX = targetPoint.x;
  const verticalSkyY = Math.min(0, targetPoint.y - 300); // 螢幕上方外緣

  const casterVerticalSkyX = casterPoint.x;
  const casterVerticalSkyY = Math.min(0, casterPoint.y - 300);

  const diagonalSkyX = targetPoint.x - 180;
  const diagonalSkyY = Math.min(0, targetPoint.y - 320);

  const casterDiagonalSkyX = casterPoint.x + 180;
  const casterDiagonalSkyY = Math.min(0, casterPoint.y - 320);

  switch (spatialMode) {
    case 'A_TO_VERTICAL_SKY':
      startX = casterPoint.x;
      startY = casterPoint.y;
      endX = casterVerticalSkyX;
      endY = casterVerticalSkyY;
      break;

    case 'VERTICAL_SKY_TO_B':
    case 'VERTICAL_DROP':
      startX = verticalSkyX;
      startY = verticalSkyY;
      endX = targetPoint.x;
      endY = targetPoint.y;
      break;

    case 'A_TO_DIAGONAL_SKY':
      startX = casterPoint.x;
      startY = casterPoint.y;
      endX = casterDiagonalSkyX;
      endY = casterDiagonalSkyY;
      break;

    case 'DIAGONAL_SKY_TO_B':
    case 'DIAGONAL_DROP':
      startX = diagonalSkyX;
      startY = diagonalSkyY;
      endX = targetPoint.x;
      endY = targetPoint.y;
      break;

    case 'A_TO_B':
    case 'HORIZONTAL':
    case 'PARABOLA_ARC':
    case 'COLUMN_PIERCE':
    case 'GROUND_FISSURE':
    case 'ARC_MULTI':
    default:
      startX = casterPoint.x;
      startY = casterPoint.y;
      endX = targetPoint.x;
      endY = targetPoint.y;
      break;
  }

  // 若開起 reverse 反向，則起點與終點對調
  if (reverse) {
    const tempX = startX;
    const tempY = startY;
    startX = endX;
    startY = endY;
    endX = tempX;
    endY = tempY;
  }

  return {
    x: startX + (endX - startX) * p,
    y: startY + (endY - startY) * p
  };
}

/**
 * 🎞️ 計算 Clip 影格基礎邊緣淡入淡出倍率 (0.0 ~ 1.0)
 * @param elapsedSeconds 當前圖層內部已播放秒數 (currentTime - delay)
 * @param duration 圖層總時長
 * @param fadeIn 淡入時間 (秒，預設 0.05s)
 * @param fadeOut 淡出時間 (秒，預設 0.08s)
 */
export function calculateEdgeFadeMultiplier(
  elapsedSeconds: number,
  duration: number,
  fadeIn: number = 0.05,
  fadeOut: number = 0.08
): { opacityMultiplier: number; scaleMultiplier: number } {
  if (elapsedSeconds < 0 || elapsedSeconds > duration) {
    return { opacityMultiplier: 0, scaleMultiplier: 0 };
  }

  let opacity = 1.0;
  let scale = 1.0;

  // 1. 前端淡入
  if (fadeIn > 0 && elapsedSeconds < fadeIn) {
    const inProgress = Math.max(0, Math.min(1, elapsedSeconds / fadeIn));
    opacity = inProgress;
    scale = 0.4 + inProgress * 0.6; // 0.4x 微微膨脹至 1.0x
  }

  // 2. 尾端淡出
  const remaining = duration - elapsedSeconds;
  if (fadeOut > 0 && remaining < fadeOut) {
    const outProgress = Math.max(0, Math.min(1, remaining / fadeOut));
    opacity = Math.min(opacity, outProgress);
    scale = Math.min(scale, 0.4 + outProgress * 0.6);
  }

  return {
    opacityMultiplier: Math.max(0, Math.min(1, opacity)),
    scaleMultiplier: Math.max(0.1, Math.min(1, scale))
  };
}

/**
 * 🏃 計算施術者發力動作在當前時間 t 的位移與傾角
 */
export function calculateCasterMotionOffset(
  currentTime: number,
  motion?: VFXCasterMotionConfig
): { offsetX: number; tiltDeg: number } {
  if (!motion) return { offsetX: 0, tiltDeg: 0 };
  const dur = motion.motionDuration || 0.25;
  if (currentTime < 0 || currentTime > dur) return { offsetX: 0, tiltDeg: 0 };

  const p = currentTime / dur;
  // 經典先突進後彈回鐘型曲線: sin(p * PI)
  const curve = Math.sin(p * Math.PI);

  const stepForward = motion.stepForward || 0;
  const recoil = motion.recoil || 0;
  const tiltAngle = motion.tiltAngle || 0;

  const netX = (stepForward - recoil) * curve;
  const netTilt = tiltAngle * curve;

  return {
    offsetX: netX,
    tiltDeg: netTilt
  };
}

