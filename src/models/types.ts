/**
 * 傭兵當前的狀態
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
 * 爵位設定檔，包含各項特權與晉升條件
 */
export interface TitleConfig {
  title: NobleTitle;
  titleCN: string;
  maxCaravans: number;
  maxRoster: number;
  maxFacilityLevel: number;
  taxBonusPer10Pop: number; // 每 10 人口帶來的額外稅收
  reqPrestige: number;
  reqPopulation: number;
  reqGold: number;          // 晉升大典花費
  officeSlots: Partial<Record<OfficeType, number>>; // 各官職的數量上限
}

/**
 * 官職系統
 */
export enum OfficeType {
  RETAINER = 'RETAINER',       // 扈從
  CAPTAIN = 'CAPTAIN',         // 隊長
  BANNERET = 'BANNERET',       // 方旗騎士
  CASTELLAN = 'CASTELLAN',     // 城主
}

/**
 * 爵位數值設定表 (可隨時調整)
 */
export const TITLE_CONFIG: TitleConfig[] = [
  { title: NobleTitle.COMMONER, titleCN: '平民', maxCaravans: 1, maxRoster: 10, maxFacilityLevel: 1, taxBonusPer10Pop: 0, reqPrestige: 0, reqPopulation: 0, reqGold: 0, officeSlots: {} },
  { title: NobleTitle.KNIGHT, titleCN: '騎士', maxCaravans: 1, maxRoster: 15, maxFacilityLevel: 2, taxBonusPer10Pop: 1, reqPrestige: 500, reqPopulation: 30, reqGold: 1500, officeSlots: { [OfficeType.RETAINER]: 1 } },
  { title: NobleTitle.BARON, titleCN: '男爵', maxCaravans: 2, maxRoster: 20, maxFacilityLevel: 3, taxBonusPer10Pop: 2, reqPrestige: 2000, reqPopulation: 80, reqGold: 4000, officeSlots: { [OfficeType.RETAINER]: 2, [OfficeType.CAPTAIN]: 1 } },
  { title: NobleTitle.VISCOUNT, titleCN: '子爵', maxCaravans: 2, maxRoster: 30, maxFacilityLevel: 4, taxBonusPer10Pop: 3, reqPrestige: 5000, reqPopulation: 200, reqGold: 10000, officeSlots: { [OfficeType.RETAINER]: 3, [OfficeType.CAPTAIN]: 2, [OfficeType.CASTELLAN]: 1 } },
  { title: NobleTitle.COUNT, titleCN: '伯爵', maxCaravans: 3, maxRoster: 40, maxFacilityLevel: 5, taxBonusPer10Pop: 4, reqPrestige: 12000, reqPopulation: 500, reqGold: 25000, officeSlots: { [OfficeType.RETAINER]: 4, [OfficeType.CAPTAIN]: 4, [OfficeType.BANNERET]: 1, [OfficeType.CASTELLAN]: 1 } },
  { title: NobleTitle.MARQUIS, titleCN: '侯爵', maxCaravans: 4, maxRoster: 50, maxFacilityLevel: 6, taxBonusPer10Pop: 5, reqPrestige: 25000, reqPopulation: 1200, reqGold: 60000, officeSlots: { [OfficeType.RETAINER]: 6, [OfficeType.CAPTAIN]: 6, [OfficeType.BANNERET]: 2, [OfficeType.CASTELLAN]: 1 } },
  { title: NobleTitle.DUKE, titleCN: '公爵', maxCaravans: 5, maxRoster: 60, maxFacilityLevel: 7, taxBonusPer10Pop: 6, reqPrestige: 60000, reqPopulation: 3000, reqGold: 150000, officeSlots: { [OfficeType.RETAINER]: 10, [OfficeType.CAPTAIN]: 10, [OfficeType.BANNERET]: 4, [OfficeType.CASTELLAN]: 1 } }
];

export function getTitleConfig(title: NobleTitle): TitleConfig {
  return TITLE_CONFIG.find(c => c.title === title) || TITLE_CONFIG[0];
}

/**
 * 根據爵位獲取最大商隊派遣數量上限
 */
export function getMaxCaravansLimit(title: NobleTitle): number {
  return getTitleConfig(title).maxCaravans;
}

export function getMaxRosterLimit(title: NobleTitle): number {
  return getTitleConfig(title).maxRoster;
}

export function getMaxFacilityLevel(title: NobleTitle): number {
  return getTitleConfig(title).maxFacilityLevel;
}

export function getTaxBonusPer10Pop(title: NobleTitle): number {
  return getTitleConfig(title).taxBonusPer10Pop;
}

/**
 * 勞動力分配職業
 */
export enum WorkerJob {
  UNASSIGNED = 'UNASSIGNED', // 閒置 (仍會消耗糧食)
  FARMER = 'FARMER',         // 農夫 (產出糧食)
  WOODCUTTER = 'WOODCUTTER', // 伐木工 (產出木材)
  MINER = 'MINER',           // 礦工 (產出石材與微量鐵礦)
  INFANTRY = 'INFANTRY',     // 步兵 (軍隊，消耗額外糧食)
  CAVALRY = 'CAVALRY',       // 騎兵 (軍隊，消耗額外糧食)
  ARCHER = 'ARCHER'          // 弓兵 (軍隊，消耗額外糧食)
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
  DESERT = 'DESERT',
  CAVE = 'CAVE',
  RUINS = 'RUINS',
  WILDERNESS = 'WILDERNESS'
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
  
  // 動態顯示與解鎖機制
  isHidden?: boolean;
  isDynamic?: boolean; // 是否為動態生成的節點 (如：探索出來的隨機巢穴)
  baseDifficulty?: number; // 用於動態巢穴等自訂難度的節點
  unlockCondition?: {
    minDay?: number;
    minPrestige?: number;
  };

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
 * 軍階與官職系統 (Military Office System)
 * ==========================================
 */



export interface OfficeConfig {
  type: OfficeType;
  nameCN: string;
  salary: number;            // 每回合需支付的俸祿 (金幣)
  troopLimit: number;        // 可帶兵數上限 (人口轉換為士兵)
  commandBonus: number;      // 統帥附加值
  combatBonusPct: number;    // 部隊戰鬥力加成百分比 (例如 0.1 代表 10%)
  civicBonusPct: number;     // 內政/繁榮度/稅收加成百分比
}

export const OFFICE_CONFIG: Record<OfficeType, OfficeConfig> = {
  [OfficeType.RETAINER]: { type: OfficeType.RETAINER, nameCN: '扈從', salary: 10, troopLimit: 0, commandBonus: 1, combatBonusPct: 0, civicBonusPct: 0.05 },
  [OfficeType.CAPTAIN]: { type: OfficeType.CAPTAIN, nameCN: '隊長', salary: 50, troopLimit: 100, commandBonus: 5, combatBonusPct: 0, civicBonusPct: 0 },
  [OfficeType.BANNERET]: { type: OfficeType.BANNERET, nameCN: '方旗騎士', salary: 200, troopLimit: 300, commandBonus: 15, combatBonusPct: 0.1, civicBonusPct: 0 },
  [OfficeType.CASTELLAN]: { type: OfficeType.CASTELLAN, nameCN: '城主', salary: 150, troopLimit: 0, commandBonus: 0, combatBonusPct: 0, civicBonusPct: 0.2 },
};

export function getOfficeConfig(type: OfficeType): OfficeConfig {
  return OFFICE_CONFIG[type];
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
 * 決定傭兵的初始屬性與每次升級時的成長係數
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
 * 武器標籤 (影響職業變化)
 */
export enum WeaponType {
  GREATSWORD = 'GREATSWORD',             // 巨劍 (戰士)
  DUAL_BLADES = 'DUAL_BLADES',           // 雙劍 (魔劍士)
  SWORD_AND_SHIELD = 'SWORD_AND_SHIELD', // 劍盾 (騎士)
  RUNE_SHIELD = 'RUNE_SHIELD',           // 符文巨盾 (符文騎士)
  STAFF = 'STAFF',                       // 法杖 (法師)
  SCYTHE = 'SCYTHE',                     // 戰鐮 (戰鬥法師)
  DAGGERS = 'DAGGERS',                   // 雙匕首 (盜賊)
  MAGIC_RING = 'MAGIC_RING',             // 魔戒 (詭術師)
  HOLY_BOOK = 'HOLY_BOOK',               // 聖典 (祈禱者)
  HAMMER = 'HAMMER',                     // 審判槌 (異端拷問者)
  BOW = 'BOW',                           // 戰弓 (神射手)
  MAGIC_BOW = 'MAGIC_BOW'                // 術弓 (精靈使)
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
  weaponType?: WeaponType;              // 武器專屬標籤，影響動態職業
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
  weaponType?: WeaponType;    // 武器專屬標籤
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

/**
 * 四大魔物種族
 */
export enum MonsterRace {
  MONSTER = 'MONSTER',
  HUMAN = 'HUMAN',
  UNDEAD = 'UNDEAD',
  DRAGON = 'DRAGON'
}

/**
 * 魔物資料結構
 */
export interface MonsterData {
  id: string;
  name: string;
  race: MonsterRace;
  terrains: TerrainType[];
  powerTier: number;
  isBoss?: boolean;
}

/**
 * 戰鬥用實體魔物資料 (帶有具體數值)
 */
export interface MonsterInstance extends MonsterData {
  hp: number;
  damage: number;
  defense: number;
  evade: number;
  calculatedPowerScore: number;
}


