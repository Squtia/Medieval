export type VFXTrajectory =
  | 'HORIZONTAL'       // 水平飛行彈道（箭矢、火球、冰槍）
  | 'VERTICAL_DROP'    // 垂直天降（雷殛、神聖光柱）
  | 'DIAGONAL_DROP'    // 斜向天傾（天降隕石、天火）
  | 'GROUND_BURST'     // 地面破土噴發（地刺、裂地震波）
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
  shaderMode: VFXShaderMode;
  colorCore: string;
  colorRim: string;
  duration: number;             // 飛行/動畫總時間 (s)
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

  shieldShape?: 'HEX' | 'CROSS_SHIELD' | 'RUNE_RING';
  waveCount?: number;
  textureSprite?: 'GLOW' | 'STAR' | 'RUNE' | 'FIRE';
  
  // 戰鬥打擊感與節奏斷點參數
  impact: VFXImpactConfig;

  // 🔮 複合多圖層特效支援 (Composite VFX Layers)
  layers?: VFXLayer[];
  hitCount?: number;            // 戰鬥 HIT 判定段數（未填則預設使用 salvoCount 或 1）
}

export interface VFXLayer {
  id?: string;
  name?: string;
  presetId?: string;           // 引用現有特效庫之 Preset ID 單元 (積木組合)
  trajectory?: VFXTrajectory;
  shaderMode?: VFXShaderMode;
  colorCore?: string;
  colorRim?: string;
  delay?: number;              // 延遲播放 (秒)
  scale?: number;
  duration?: number;
  generatesHit?: boolean;      // 是否產生真實戰鬥 HIT 判定 (受擊閃光、抖動與分段跳字)
}
