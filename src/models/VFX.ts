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
  | 'EARTH_SHATTER'        // ⛰️ 地刺與重擊震波 (Earth Spike & Ground Shatter)
  | 'SHOCKWAVE'            // 🌊 衝擊波與音波震盪環 (Shockwave Ring & Sonic Blast)
  | 'ENERGY_SHIELD';       // 🛡️ 能量防護壁壘與神聖護盾 (Energy Shield & Holy Aegis)

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
  | 'STAGGERED'    // 隨機微擾散佈
  | 'VOLLEY_SYNC'  // 同步齊射
  | 'CHAOTIC';     // 混沌不規則節奏

export type VFXRendererType =
  | 'SLASH'
  | 'PROJECTILE'
  | 'LIGHTNING'
  | 'BEAM'
  | 'GROUND_FISSURE'
  | 'AURA'
  | 'SHIELD'
  | 'SHOUT_WAVE';

export interface VFXPreset {
  id: string;
  name: string;
  category: 'PHYSICAL' | 'ELEMENTAL' | 'HOLY_DARK' | 'SPECIAL';
  usageType?: VFXUsageType;
  isBuiltin?: boolean;
  description: string;
  
  // 視覺渲染與渲染器形態
  rendererType?: VFXRendererType;
  spatialTopology?: VFXSpatialTopology; // 規範新版：空間傳播形態 (POINT_TRANSPORT | SPAN_BEAM | STAGGERED_ARRAY | LOCAL_MORPH)
  trajectory?: VFXTrajectory;
  spatialMode?: VFXSpatialMode; // 規範新版：時空發生模式 (AT_CASTER | AT_TARGET | 5大彈道路徑)
  trajectoryPath?: VFXTrajectoryPath; // 5 大幾何彈道路徑
  reverse?: boolean;            // 🔄 反向開關 (例如 B➔A 吸血、垂直沖天、斜向擊飛)
  slashAlignToPath?: boolean;   // 劍氣是否自動對齊飛行向量 (預設 true)
  spikeArrayBehavior?: SpikeArrayBehavior; // 沿途地刺動畫模式 (PERSIST_FADE | SURGE_RECEDE)
  spikeArrayCount?: number;     // 沿途連鎖尖刺數量 (預設 5，範圍 2~12)
  shaderMode?: VFXShaderMode;
  colorCore: string;
  colorRim: string;
  duration: number;             // 飛行/動畫總時間 (s)
  mainDelay?: number;           // 主軌前搖延遲 (s，預設 0.0s)
  mainDuration?: number;        // 主軌有效播放時長 (s，預設等於或小於 duration)
  scale: number;                // 尺寸比例
  spin?: number;                // 自轉速度
  fresnel?: number;             // 邊緣高光權重
  trailCount?: number;          // 拖尾粒子數
  trailSize?: number;           // 拖尾尺寸
  enableTrail?: boolean;        // 是否啟用軌跡/刀尖拖尾
  trailColor?: string;          // 拖尾粒子自訂顏色 (留空則跟隨 colorRim)
  spikes?: number;              // 次生尖刺/碎屑數量
  spikeHeight?: number;         // 尖刺高度
  burstCount?: number;          // 命中爆散粒子數
  burstTime?: number;           // 碎屑爆發時間點 (s，0 為自動吸附主 CUE 點)
  bloomStr?: number;            // 發光光學強度
  bloomRad?: number;            // 輝光模糊半徑
  bloomThresh?: number;         // 輝光閾值

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

  // 🎯 空間時空路徑與落點正交偏移 (Rule 12.1 正交解耦)
  targetOffsetX?: number;       // 以目標基準中心為基準的落點微調 X (px)
  targetOffsetY?: number;       // 以目標基準中心為基準的落點微調 Y (px)
  trackOffsetX?: number;        // 整條軌道起點與終點的平行平移 X (px)
  trackOffsetY?: number;        // 整條軌道起點與終點的平行平移 Y (px)

  // 🌟 立體拖尾表現力原地擴充 (Native Trail Pipeline)
  trailSpread?: number;         // 拖尾粒子錐形擴散寬度 (px，0=細線，>0=厚重煙塵羽流)
  trailStrands?: number;        // 拖尾股數 (1~3 股微相位交織)

  // 🛡️ 專屬幾何與模型紋理形態
  slashShape?: 'CRESCENT' | 'CROSS' | 'WHIRLWIND';
  slashTrajectory?: 'CLEAVE_DOWN' | 'UPPER_CUT' | 'HORIZONTAL' | 'VERTICAL_DOWN' | 'CUSTOM';
  slashAngle?: number;          // 斬擊起手起始角度 (-180° ~ 180°，相容 slashRotZ)
  slashRotX?: number;           // 斬擊 X 軸歐拉角俯仰傾角 (-90° ~ 90°，預設 0°)
  slashRotY?: number;           // 斬擊 Y 軸歐拉角偏航傾角 (-90° ~ 90°，預設 0°)
  slashRotZ?: number;           // 斬擊 Z 軸歐拉角滾轉旋轉 (-180° ~ 180°，預設 -45°)
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
  impact?: VFXImpactConfig;

  // 🏃 施術者發力動作與反饋 (Caster Action Motion)
  casterMotion?: VFXCasterMotionConfig;

  // 🔮 複合多圖層特效支援 (Composite VFX Layers)
  layers?: VFXLayer[];
  /** @deprecated VFX 不得決定真正戰鬥 HIT；僅供舊資料 migration。 */
  hitCount?: number;
  impactCues?: VFXImpactCue[];  // 具名時間軸 Impact Cue
  impactPresentationMode?: ImpactPresentationMode; // 傷害數值呈現模式

  // 🌟 Schema v2 軌道制完全閉合支援
  tracks?: VFXTrack[];
  schemaVersion?: number;
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
  spatialTopology?: VFXSpatialTopology;
  trajectory?: VFXTrajectory;
  spatialMode?: VFXSpatialMode; // 原地類 或 5種彈道路徑之一
  trajectoryPath?: VFXTrajectoryPath;
  reverse?: boolean;           // 🔄 是否反向運動
  slashAlignToPath?: boolean;
  spikeArrayBehavior?: SpikeArrayBehavior;
  spikeArrayCount?: number;
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
  targetOffsetX?: number;      // 次生圖層專屬落點微調 X (px)
  targetOffsetY?: number;      // 次生圖層專屬落點微調 Y (px)
  trackOffsetX?: number;       // 次生圖層專屬軌道平移 X (px)
  trackOffsetY?: number;       // 次生圖層專屬軌道平移 Y (px)
  trailSpread?: number;        // 次生圖層拖尾錐形擴散寬度 (px)
  trailStrands?: number;       // 次生圖層拖尾股數 (1~3)
  generatesHit?: boolean;      // 舊版相容：是否產生真實戰鬥 HIT 判定
  emitsImpactCue?: boolean;    // 是否產生演出命中 cue (受擊閃光、抖動與跳字)
}

export type VFXCueKind = 'IMPACT' | 'HEAL' | 'SHIELD' | 'STATUS' | 'VISUAL_ONLY';
export type VFXCueTargetPolicy = 'PRIMARY_TARGET' | 'EACH_TARGET' | 'CASTER';
export type VFXTargetPolicy = VFXCueTargetPolicy;

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
  | 'LIGHT' | 'IMPACT' | 'SCREEN_FX' | 'AUDIO' | 'CUE'
  | 'SLASH' | 'PROJECTILE' | 'COMPOSITE_LAYER';

export interface VFXQualityProfile {
  maxParticles: number;
  maxDrawCalls: number;
  maxConcurrentObjects: number;
  allowScreenShake: boolean;
  allowBloom: boolean;
}

export const CANONICAL_SEQUENCE_SCHEMA_VERSION = 2;

export interface VFXCurveDefinition {
  property: string;
  keyframes: { time: number; value: number }[];
}

export interface VFXMeshClipPayload {
  trajectory?: VFXTrajectory;
  shaderMode?: VFXShaderMode;
  colorCore?: string;
  colorRim?: string;
  scale?: number;
  spikeWidth?: number;
  spikeHeight?: number;
  burstCount?: number;
  burstTime?: number;
  spikeAngle?: number;
  spikes?: number;
  spikeRadius?: number;
  spikeStagger?: number;
  spikeMaterialMode?: 'BASIC' | 'PHONG';
  spikeEruptFire?: boolean;
  salvoCount?: number;
  salvoDuration?: number;
  salvoRhythmCurve?: SalvoRhythmCurve;
  salvoSpreadAngle?: number;
  salvoSpreadRadius?: number;
  arcHeight?: number;
  multiHitImpact?: boolean;
  glowRadius?: number;
  glowOpacity?: number;
  coreBrightness?: number;
  flameTurbulence?: number;
  flameTurbulenceSpeed?: number;
  reverse?: boolean;
  spatialMode?: VFXSpatialMode;
  spatialTopology?: VFXSpatialTopology;
  slashAlignToPath?: boolean;
  spikeArrayBehavior?: SpikeArrayBehavior;
  spikeArrayCount?: number;
  targetOffsetX?: number;
  targetOffsetY?: number;
  trackOffsetX?: number;
  trackOffsetY?: number;
  trailSpread?: number;
  trailStrands?: number;
}

export interface VFXParticleClipPayload {
  burstCount?: number;
  burstTime?: number;
  trailCount?: number;
  trailSize?: number;
  enableTrail?: boolean;
  trailColor?: string;
  trailSpread?: number;
  trailStrands?: number;
  colorCore?: string;
  colorRim?: string;
  scale?: number;
  bloomStr?: number;
  bloomRad?: number;
  bloomThresh?: number;
}

export interface VFXScreenFxClipPayload {
  screenShake?: boolean;
  shakeIntensity?: number;
  shakeDuration?: number;
  hitFlashColor?: string;
}

export interface VFXAudioClipPayload {
  soundKey?: string;
  volume?: number;
  pitch?: number;
}

export interface VFXCompositeLayerClipPayload {
  presetId?: string;
  spatialMode?: VFXSpatialMode;
  reverse?: boolean;
  scale?: number;
  fadeIn?: number;
  fadeOut?: number;
  delay?: number;
  duration?: number;
  shaderMode?: VFXShaderMode;
  colorCore?: string;
  colorRim?: string;
  emitsImpactCue?: boolean;
  generatesHit?: boolean;
}

export interface SlashGeometryInput {
  shape?: 'CRESCENT' | 'CROSS' | 'WHIRLWIND' | string;
  slashShape?: 'CRESCENT' | 'CROSS' | 'WHIRLWIND' | string;
  radius?: number;
  slashRadius?: number;
  bladeWidth?: number;
  slashBladeWidth?: number;
  arcSpan?: number;
  slashArcSpan?: number;
  rotX?: number;
  slashRotX?: number;
  rotY?: number;
  slashRotY?: number;
  rotZ?: number;
  slashRotZ?: number;
  angle?: number;
  slashAngle?: number;
  aspect?: number;
  slashAspect?: number;
  reverse?: boolean;
  slashReverse?: boolean;
  angleJitter?: number;
  slashAngleJitter?: number;
  isAlternating?: boolean;
  slashAlternating?: boolean;
  slashTrajectory?: 'CLEAVE_DOWN' | 'UPPER_CUT' | 'HORIZONTAL' | 'VERTICAL_DOWN' | 'CUSTOM';
  colorCore?: string;
  colorRim?: string;
  scale?: number;
}

export interface VFXSlashClipPayload extends SlashGeometryInput {
  rendererType: 'SLASH';
  colorCore?: string;
  colorRim?: string;
  scale?: number;
  angle?: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  arcSpan?: number;
  aspect?: number;
  bladeWidth?: number;
  radius?: number;
  reverse?: boolean;
  shape?: 'CRESCENT' | 'CROSS' | 'WHIRLWIND' | string;
  shaderMode?: VFXShaderMode;
  trajectory?: VFXTrajectory;
  salvo?: {
    count: number;
    rhythm: SalvoRhythmCurve;
    angleJitter: number;
    alternating: boolean;
  };
}

export interface VFXProjectileClipPayload {
  rendererType: 'PROJECTILE';
  shape?: 'SPHERE' | 'DIAMOND' | 'ARROW' | 'STAR' | 'RING';
  shaderMode?: VFXShaderMode;
  colorCore?: string;
  colorRim?: string;
  coreBrightness?: number;
  burstCount?: number;
  burstTime?: number;
  scale?: number;
  spin?: number;
  path?: VFXTrajectoryPath;
  reverse?: boolean;
  arcHeight?: number;
  salvoCount?: number;
  salvoDuration?: number;
  salvoRhythmCurve?: SalvoRhythmCurve;
  salvoSpreadAngle?: number;
  salvoSpreadRadius?: number;
  salvo?: {
    count: number;
    duration: number;
    rhythm: SalvoRhythmCurve;
    spreadAngle: number;
    spreadRadius: number;
  };
}

export type VFXClipPayload =
  | { type: 'MESH'; data: VFXMeshClipPayload }
  | { type: 'SLASH'; data: VFXSlashClipPayload }
  | { type: 'PROJECTILE'; data: VFXProjectileClipPayload }
  | { type: 'PARTICLE'; data: VFXParticleClipPayload }
  | { type: 'IMPACT'; data: VFXImpactConfig }
  | { type: 'SCREEN_FX'; data: VFXScreenFxClipPayload }
  | { type: 'AUDIO'; data: VFXAudioClipPayload }
  | { type: 'COMPOSITE_LAYER'; data: VFXCompositeLayerClipPayload };

export interface VFXClip {
  id: string;
  name?: string;
  startTime: number;
  duration: number;
  fadeIn?: number;
  fadeOut?: number;
  payload: VFXClipPayload;
  curves?: Record<string, VFXCurveDefinition>;
}

export interface VFXTrack {
  id: string;
  name: string;
  type: VFXTrackType;
  enabled?: boolean;
  isMuted?: boolean;
  locked?: boolean;
  clips: VFXClip[];
}

export type VFXUsageType = 'SKILL' | 'MATERIAL';

export interface VFXSequence {
  schemaVersion: number;
  id: string;
  name: string;
  category: 'PHYSICAL' | 'ELEMENTAL' | 'HOLY_DARK' | 'SPECIAL';
  usageType?: VFXUsageType; // 🌟 核心用途：'SKILL' (技能專用) | 'MATERIAL' (素材圖層，禁綁技能)
  isBuiltin?: boolean;      // 🌟 官方出廠標記 (官方 30 款 Baseline 唯讀保護)
  description: string;
  duration: number;
  spatialMode?: VFXSpatialMode;
  casterMotion?: VFXCasterMotionConfig;
  randomSeed?: number;
  tags?: string[];
  tracks: VFXTrack[];
  impactCues: VFXImpactCue[];
  impactPresentationMode?: ImpactPresentationMode;
  quality?: VFXQualityProfile;
  metadata?: Record<string, any>;
  layers?: VFXLayer[];
}

/**
 * 🔄 將舊版扁平 VFXPreset 100% 確定性升級為 Schema v2 的純 VFXSequence
 */
export function presetToSequence(preset: VFXPreset): VFXSequence {
  if ((preset as any).tracks && Array.isArray((preset as any).tracks)) {
    return preset as unknown as VFXSequence;
  }
  const dur = preset.duration || 0.5;
  const isMelee = preset.rendererType === 'SLASH' || preset.trajectory === 'MELEE_SWEEP';
  const mainTrackType: VFXTrackType = isMelee ? 'SLASH' : (preset.rendererType === 'PROJECTILE' ? 'PROJECTILE' : 'MESH');

  const mainClipPayload: any = {
    rendererType: mainTrackType,
    shaderMode: preset.shaderMode,
    colorCore: preset.colorCore,
    colorRim: preset.colorRim,
    scale: preset.scale ?? 1.0,
    spin: preset.spin,
    fresnel: preset.fresnel,
    glowRadius: preset.glowRadius,
    glowOpacity: preset.glowOpacity,
    coreBrightness: preset.coreBrightness,
    flameTurbulence: preset.flameTurbulence,
    flameTurbulenceSpeed: preset.flameTurbulenceSpeed,
    spikes: preset.spikes,
    spikeHeight: preset.spikeHeight,
    spikeWidth: preset.spikeWidth,
    spikeRadius: preset.spikeRadius,
    spikeAngle: preset.spikeAngle,
    spikeStagger: preset.spikeStagger,
    spikeShape: preset.spikeShape,
    spikeMaterialMode: preset.spikeMaterialMode,
    spikeEruptFire: preset.spikeEruptFire,
    salvoCount: preset.salvoCount,
    salvoDuration: preset.salvoDuration,
    salvoRhythmCurve: preset.salvoRhythmCurve,
    salvoSpreadAngle: preset.salvoSpreadAngle,
    salvoSpreadRadius: preset.salvoSpreadRadius,
    arcHeight: preset.arcHeight,
    multiHitImpact: preset.multiHitImpact,
    reverse: preset.reverse,
    spatialMode: preset.spatialMode,
    slashShape: preset.slashShape,
    slashTrajectory: preset.slashTrajectory,
    slashAngle: preset.slashAngle,
    slashRotX: preset.slashRotX,
    slashRotY: preset.slashRotY,
    slashRotZ: preset.slashRotZ,
    slashArcSpan: preset.slashArcSpan,
    slashAspect: preset.slashAspect,
    slashReverse: preset.slashReverse,
    slashBladeWidth: preset.slashBladeWidth,
    slashRadius: preset.slashRadius,
    slashAngleJitter: preset.slashAngleJitter,
    slashAlternating: preset.slashAlternating
  };

  const tracks: VFXTrack[] = [
    {
      id: 'trk_main',
      name: 'Main Track',
      type: mainTrackType,
      clips: [
        {
          id: 'clip_main_0',
          startTime: preset.mainDelay || 0,
          duration: preset.mainDuration !== undefined ? preset.mainDuration : dur,
          payload: {
            type: mainTrackType,
            data: mainClipPayload
          }
        }
      ]
    },
    {
      id: 'trk_particles',
      name: 'Particles',
      type: 'PARTICLE',
      clips: [
        {
          id: 'clip_part_0',
          startTime: 0,
          duration: dur,
          payload: {
            type: 'PARTICLE',
            data: {
              burstCount: preset.burstCount,
              burstTime: preset.burstTime,
              trailCount: preset.trailCount,
              trailSize: preset.trailSize,
              enableTrail: preset.enableTrail,
              trailColor: preset.trailColor,
              bloomStr: preset.bloomStr,
              bloomRad: preset.bloomRad,
              bloomThresh: preset.bloomThresh
            }
          }
        }
      ]
    }
  ];

  if (preset.impact) {
    tracks.push({
      id: 'trk_impact',
      name: 'Impact Feedback',
      type: 'IMPACT',
      clips: [
        {
          id: 'clip_impact_0',
          startTime: (preset.impactCues && preset.impactCues[0]) ? preset.impactCues[0].time : dur * 0.6,
          duration: preset.impact.shakeDuration || 0.25,
          payload: {
            type: 'IMPACT',
            data: { ...preset.impact }
          }
        }
      ]
    });
  }

  return {
    schemaVersion: CANONICAL_SEQUENCE_SCHEMA_VERSION,
    id: preset.id,
    name: preset.name || preset.id,
    category: preset.category || 'SPECIAL',
    description: preset.description || '',
    duration: dur,
    spatialMode: preset.spatialMode,
    casterMotion: preset.casterMotion,
    tracks,
    impactCues: preset.impactCues || [
      { cueId: 'default', time: dur * 0.6, weight: 1.0, isPrimary: true }
    ],
    impactPresentationMode: preset.impactPresentationMode,
    layers: preset.layers
  };
}

/**
 * 🔍 取得 Sequence 的主要視覺軌 (Main Track / 第一條 MESH 或主特效軌)
 */
export function getSequenceMainTrack(sequence: VFXSequence): VFXTrack | undefined {
  if (!sequence || !Array.isArray(sequence.tracks)) return undefined;
  return sequence.tracks.find(t => t.id === 'trk_main' || t.type === 'MESH') || sequence.tracks[0];
}

/**
 * 🔍 取得 Sequence 的主要 Clip
 */
export function getSequenceMainClip(sequence: VFXSequence): VFXClip | undefined {
  const mainTrack = getSequenceMainTrack(sequence);
  return mainTrack?.clips?.[0];
}

/**
 * 🔍 取得 Sequence 的受擊反饋設定 (ImpactConfig)
 */
export function getSequenceImpactConfig(sequence: VFXSequence): VFXImpactConfig | undefined {
  if (!sequence || !Array.isArray(sequence.tracks)) return undefined;
  const impactTrack = sequence.tracks.find(t => t.type === 'IMPACT');
  const clip = impactTrack?.clips?.find(c => c.payload.type === 'IMPACT');
  return clip ? (clip.payload.data as VFXImpactConfig) : undefined;
}

/**
 * 🔍 取得 Sequence 的粒子發射設定 (ParticlePayload)
 */
export function getSequenceParticlePayload(sequence: VFXSequence): VFXParticleClipPayload | undefined {
  if (!sequence || !Array.isArray(sequence.tracks)) return undefined;
  const partTrack = sequence.tracks.find(t => t.type === 'PARTICLE');
  const clip = partTrack?.clips?.find(c => c.payload.type === 'PARTICLE');
  return clip ? (clip.payload.data as VFXParticleClipPayload) : undefined;
}

export interface SkillVfxBinding {
  skillId: string;
  vfxId: string;
  impactPresentationMode: ImpactPresentationMode;
  cueMap?: Record<string, string>;
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
 * 🌐 空間傳播形態 (Spatial Topology)
 * 規範新版：將特效存在方式與幾何網格徹底解耦
 */
export type VFXSpatialTopology =
  | 'POINT_TRANSPORT'   // 質點運動（火球、箭矢、飛出劍氣）
  | 'SPAN_BEAM'          // 跨空間能量柱（天雷、連鎖電弧、貫穿光束）
  | 'STAGGERED_ARRAY'    // 沿途連鎖陣列（連鎖破土尖刺、地火、冰霜小徑）
  | 'LOCAL_MORPH';       // 原地幾何展開（近戰重劈、護盾、戰吼）

export type SpikeArrayBehavior = 'PERSIST_FADE' | 'SURGE_RECEDE';

/**
 * 🌐 完整的時空發生模式 (包含 3 大核心模式與相容擴展)
 * 遵循文件 §5.6: 'AT_CASTER' | 'AT_TARGET' | 'TRAJECTORY'
 */
export type VFXSpatialMode =
  | 'AT_CASTER'
  | 'AT_TARGET'
  | 'TRAJECTORY'
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
    case 'TRAJECTORY':
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

