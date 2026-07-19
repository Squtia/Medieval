/**
 * 冒險者當前的狀態
 */
export enum AdventurerState {
  IDLE = 'IDLE',             // 閒置：留在領地內，可以隨時派遣或執行其他操作
  DISPATCHED = 'DISPATCHED', // 派遣中：正在執行任務，無法指派其他工作
  RESTING = 'RESTING'        // 休息：體力耗盡或受傷正在恢復中
}

/**
 * 戰鬥陣位
 */
export enum FormationRow {
  FRONT = 'FRONT',
  BACK = 'BACK'
}

/**
 * 貴族的爵位系統
 * 隨著聲望與皇家好感度提升可以晉升
 */
export enum NobleTitle {
  COMMONER = 'COMMONER', // 平民 (初始階級)
  KNIGHT = 'KNIGHT',     // 騎士
  BARON = 'BARON',       // 男爵
  VISCOUNT = 'VISCOUNT', // 子爵
  COUNT = 'COUNT',       // 伯爵
  MARQUIS = 'MARQUIS',   // 侯爵
  DUKE = 'DUKE'          // 公爵
}

/**
 * 根據爵位獲取最大商隊派遣數量上限
 * TODO: 往後若需修改行商序列數量與爵位相關的限制，請修改此處的對應關係
 */
export function getMaxCaravansLimit(title: NobleTitle): number {
  switch (title) {
    case NobleTitle.COMMONER: return 1;
    case NobleTitle.KNIGHT: return 1;
    case NobleTitle.BARON: return 2;
    case NobleTitle.VISCOUNT: return 2;
    case NobleTitle.COUNT: return 3;
    case NobleTitle.MARQUIS: return 4;
    case NobleTitle.DUKE: return 5;
    default: return 1;
  }
}

/**
 * 勞動力分配職業
 */
export enum WorkerJob {
  UNASSIGNED = 'UNASSIGNED', // 閒置 (仍會消耗糧食)
  FARMER = 'FARMER',         // 農夫 (產出糧食)
  WOODCUTTER = 'WOODCUTTER', // 伐木工 (產出木材)
  MINER = 'MINER'            // 礦工 (產出石材與微量鐵礦)
}

/**
 * 國家狀態定義
 */
export enum CountryState {
  FLOURISHING = 'FLOURISHING', // 興盛
  STABLE = 'STABLE',           // 穩定
  DECLINING = 'DECLINING',     // 衰退
  DESTROYED = 'DESTROYED'      // 覆滅
}

/**
 * 節點等級 (取代原有的 NodeType)
 * 根據繁榮度動態升級或降級
 */
export enum NodeLevel {
  WILDERNESS = 0, // 荒野
  CAMP = 1,       // 營地
  VILLAGE = 2,    // 村莊
  TOWN = 3,       // 城鎮
  CAPITAL = 4     // 首都
}

/**
 * 節點特徵
 */
export enum NodeFeature {
  OCCUPIABLE = 'OCCUPIABLE', // 可佔領/建城
  SUBJUGATION = 'SUBJUGATION', // 討伐點 (不可佔領)
  MONSTER_NEST = 'MONSTER_NEST' // 大型巢穴 (危險區)
}

/**
 * 地形類型
 */
export enum TerrainType {
  PLAINS = 'PLAINS',
  FOREST = 'FOREST',
  SNOW_MOUNTAIN = 'SNOW_MOUNTAIN',
  VOLCANO = 'VOLCANO',
  DESERT = 'DESERT'
}

/**
 * 天氣類型
 */
export enum WeatherType {
  CLEAR = 'CLEAR',
  RAIN = 'RAIN',
  SNOW = 'SNOW',
  SANDSTORM = 'SANDSTORM',
  FOG = 'FOG'
}

/**
 * 地圖節點 (動態沙盒節點)
 */
export interface MapNode {
  id: string;
  name: string;
  description: string;
  x: number; // 地圖上的 X 座標 (百分比)
  y: number; // 地圖上的 Y 座標 (百分比)
  
  // 動態沙盒屬性
  population: number;         // 人口數量
  prosperity: number;         // 繁榮度
  nodeLevel: NodeLevel;       // 根據繁榮度動態計算的階段
  ownerFactionId: string | null; // 當前佔領該節點的派系 ID（若無則為 null）
  isPlayerBase: boolean;      // 標記這是否為玩家當前的所在地
  terrain: TerrainType;       // 地形類型
  feature: NodeFeature;       // 節點特性
  
  // 情報迷霧系統 (Scouting System)
  isScouted: boolean;
  scoutExpiryDate: number | null;
  scoutData?: NodeScoutData;
  
  // 天氣系統
  currentWeather: WeatherType;
  weatherDuration: number;
  
  // 市場資料
  marketData?: NodeMarketData;
}

export interface NodeScoutData {
  dangerLevel: string;
  treasureTier: string;
  garrisonPower?: number;
}

export interface TradeGood {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  type: 'FOOD' | 'MATERIAL' | 'LUXURY' | 'SPECIALTY';
  icon?: string;
}

export interface NodeMarketData {
  lastUpdateDay: number;
  goods: {
    goodId: string;
    buyPrice: number;
    sellPrice: number;
    stock: number;
  }[];
}

export enum FactionType {
  ROYAL = 'ROYAL',             // 王室
  GREAT_HOUSE = 'GREAT_HOUSE', // 四大統治家族
  MINOR_HOUSE = 'MINOR_HOUSE', // 小家族/附庸
  SYNDICATE = 'SYNDICATE'      // 商會/聯盟
}

/**
 * AI 派系
 */
export interface Faction {
  id: string;
  factionName: string;
  description: string;        // 家族背景描述
  factionType: FactionType;   // 派系類型 (用於事件邏輯判斷)
  color: string;              // 代表色，用於地圖渲染
  resources: number;          // 勢力資源 (用於判斷擴張)
  controlledNodes: string[];  // 控制的據點 ID
  capitalNodeId: string;      // 首都節點 ID
  playerFavor: number;        // 對玩家的好感度
}

/**
 * ==========================================
 * 模組化生成系統 (六維屬性、職業、裝備)
 * ==========================================
 */

/**
 * 六維基礎屬性
 */
export interface Attributes {
  str: number; // 力量 (Strength)
  agi: number; // 敏捷 (Agility)
  con: number; // 體質 (Constitution)
  int: number; // 智慧 (Intelligence)
  spr: number; // 精神 (Spirit)
  luk: number; // 幸運 (Luck)
  charm: number; // 魅力 (Charm) - 用於外交與特定加成
  command: number; // 統帥 (Command) - 用於未來軍團系統
}

/**
 * 戰鬥派生屬性
 */
export interface CombatStats {
  hp: number;      // 生命值
  mp: number;      // 魔力值
  atk: number;     // 物理/魔法攻擊力
  def: number;     // 防禦力
  hit: number;     // 命中率
  evade: number;   // 閃避率
}

/**
 * 職業設定檔
 * 決定冒險者的初始屬性與每次升級時的成長係數
 */
export interface JobConfig {
  name: string;
  baseAttributes: Attributes;  // Lv.1 時的初始屬性
  growthRates: Attributes;     // 每次升級增加的屬性
}

/**
 * 性格設定檔
 * 影響升級所需經驗值乘數，並以百分比修正最終屬性
 */
export interface TraitConfig {
  name: string;
  xpModifier: number;          // 經驗值需求倍率 (例如 1.2 代表需要多 20% 經驗)
  statMultipliers: Partial<Attributes>; // 屬性百分比加成 (例如 { agi: 0.1 } 代表敏捷 +10%)
}

/**
 * 裝備槽位
 */
export enum EquipmentSlot {
  WEAPON = 'WEAPON',       // 武器 (決定基礎傷害與攻擊屬性)
  ARMOR = 'ARMOR',         // 防具 (決定生存能力)
  ACCESSORY = 'ACCESSORY'  // 飾品/聖物 (提供特殊加成或配點)
}

/**
 * 裝備資料結構
 * 任何職業皆可穿戴，但必須符合最低的屬性要求
 */
export interface Equipment {
  uuid?: string;                        // 實體裝備的唯一識別碼 (庫存系統用)
  id: string;                           // 來源模板 ID
  name: string;
  slot: EquipmentSlot;
  requirements: Partial<Attributes>;    // 穿戴條件 (例如 { str: 40 })
  effects: Partial<Attributes>;         // 裝備提供的基礎屬性加成 (例如 { int: 10 })
  combatEffects?: Partial<CombatStats>; // 直接給予的戰鬥數值加成 (例如加HP、攻擊力)
  enhancementLevel?: number;            // 強化等級 (預設0)
  icon?: string;                        // 裝備圖示佔位符(emoji)
}

/**
 * 裝備模板
 * 用於隨機生成實體裝備
 */
export interface EquipmentTemplate {
  id: string;                 // 模板ID (例如 wpn_iron_sword)
  name: string;               // 裝備名稱
  slot: EquipmentSlot;        // 裝備部位
  icon?: string;              // 裝備圖示
  itemLevel: number;          // 裝備等級 (影響隨機屬性的數值大小)
  baseRequirements: Partial<Attributes>;   // 基礎穿戴條件
  baseEffects: Partial<Attributes>;        // 固定屬性加成
  baseCombatEffects: Partial<CombatStats>; // 固定戰鬥數值 (例如武器的基礎攻擊力固定)
  // 決定在生成時，會隨機抽取哪些額外屬性進行加成
  randomPool?: {
    attributes?: (keyof Attributes)[];
    combatStats?: (keyof CombatStats)[];
  };
}

