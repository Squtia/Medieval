export enum DamageType {
  PHYSICAL = 'PHYSICAL',
  MAGICAL = 'MAGICAL',
  CHAOS = 'CHAOS'
}

export enum ElementType {
  NONE = 'NONE',
  FIRE = 'FIRE',
  ICE = 'ICE',
  LIGHTNING = 'LIGHTNING',
  HOLY = 'HOLY',
  DARK = 'DARK'
}

export const ADVANCEMENT_MATERIALS: Record<string, string> = {
  ADVANCE_WARRIOR: '狂怒之鋒',
  ADVANCE_MAGE: '秘法魔典',
  ADVANCE_ARCHER: '鷹隼之眼',
  ADVANCE_KNIGHT: '守護者之盾',
  ADVANCE_THIEF: '幽影之塵',
  ADVANCE_PRAYER: '信仰之證'
};

export enum StrongholdAffix {
  MIASMA = 'MIASMA',             // 死靈瘴氣 (恢復-50%)
  VOLCANIC_HEAT = 'VOLCANIC_HEAT', // 酷熱熔岩 (回合扣血)
  BLIZZARD = 'BLIZZARD',         // 極寒暴風雪 (敏捷-15%, 遠程命中-10%)
  FORTIFIED = 'FORTIFIED',       // 要塞堅壁 (防禦+20%)
  BERSERK_AURA = 'BERSERK_AURA'  // 狂暴氣場 (傷害+25%, 暴擊+15%)
}

/**
 * 傭兵當前的狀態
 */
export enum AdventurerState {
  IDLE = 'IDLE',             // 閒置：留在領地內，可以隨時派遣或執行其他操作
  DISPATCHED = 'DISPATCHED', // 派遣中：正在執行任務，無法指派其他工作
  RESTING = 'RESTING',       // 休息：體力耗盡或受傷正在恢復中
  CAPTURED = 'CAPTURED'      // 被俘虜
}

/**
 * 戰鬥陣位
 */
export enum FormationRow {
  FRONT = 'FRONT',
  MIDDLE = 'MIDDLE',
  BACK = 'BACK'
}

/**
 * 玩家儲存的預設陣型與隊伍配置
 */
export interface FormationPreset {
  id: string;
  name: string;
  formationId: string; // 對應 FormationDB 的 ID
  gridMap: Record<string, string>; // key: 'row_col', value: adventurerId
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

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}
/**
 * 爵位設定檔，包含各項特權與晉升條件
 */
export enum ThreatType {
  NATURAL_DISASTER = 'NATURAL_DISASTER',
  MONSTER_INVASION = 'MONSTER_INVASION',
  BANDIT_RAID = 'BANDIT_RAID',
  DISEASE = 'DISEASE'
}

export interface TitleConfig {
  title: NobleTitle;
  titleCN: string;
  maxCaravans: number;
  maxRoster: number;
  taxBonusPer10Pop: number; // 每 10 人口帶來的額外稅收
  reqPrestige: number;
  reqProsperity: number;    // 晉升所需領地實質繁榮度
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
  { title: NobleTitle.COMMONER, titleCN: '平民', maxCaravans: 1, maxRoster: 10, taxBonusPer10Pop: 0, reqPrestige: 0, reqProsperity: 0, reqGold: 0, officeSlots: {} },
  { title: NobleTitle.KNIGHT, titleCN: '騎士', maxCaravans: 1, maxRoster: 15, taxBonusPer10Pop: 1, reqPrestige: 500, reqProsperity: 100, reqGold: 1500, officeSlots: { [OfficeType.RETAINER]: 1 } },
  { title: NobleTitle.BARON, titleCN: '男爵', maxCaravans: 2, maxRoster: 20, taxBonusPer10Pop: 2, reqPrestige: 1500, reqProsperity: 250, reqGold: 4000, officeSlots: { [OfficeType.RETAINER]: 1, [OfficeType.CASTELLAN]: 1 } },
  { title: NobleTitle.VISCOUNT, titleCN: '子爵', maxCaravans: 2, maxRoster: 30, taxBonusPer10Pop: 3, reqPrestige: 4000, reqProsperity: 600, reqGold: 10000, officeSlots: { [OfficeType.RETAINER]: 1, [OfficeType.CAPTAIN]: 1, [OfficeType.CASTELLAN]: 1 } },
  { title: NobleTitle.COUNT, titleCN: '伯爵', maxCaravans: 3, maxRoster: 40, taxBonusPer10Pop: 4, reqPrestige: 9000, reqProsperity: 1200, reqGold: 25000, officeSlots: { [OfficeType.RETAINER]: 2, [OfficeType.CAPTAIN]: 1, [OfficeType.CASTELLAN]: 1 } },
  { title: NobleTitle.MARQUIS, titleCN: '侯爵', maxCaravans: 4, maxRoster: 50, taxBonusPer10Pop: 5, reqPrestige: 18000, reqProsperity: 2500, reqGold: 60000, officeSlots: { [OfficeType.RETAINER]: 2, [OfficeType.CAPTAIN]: 2, [OfficeType.CASTELLAN]: 1 } },
  { title: NobleTitle.DUKE, titleCN: '公爵', maxCaravans: 5, maxRoster: 60, taxBonusPer10Pop: 6, reqPrestige: 35000, reqProsperity: 5000, reqGold: 150000, officeSlots: { [OfficeType.RETAINER]: 2, [OfficeType.CAPTAIN]: 2, [OfficeType.BANNERET]: 1, [OfficeType.CASTELLAN]: 1 } }
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

export function getNodeMaxFacilityLevel(level: NodeLevel): number {
  switch (level) {
    case NodeLevel.WILDERNESS: return 2; // 荒野允許開墾升至 Lv.2
    case NodeLevel.CAMP: return 3;       // 營地允許升至 Lv.3
    case NodeLevel.VILLAGE: return 4;    // 村莊允許升至 Lv.4
    case NodeLevel.TOWN: return 5;       // 城鎮允許升至 Lv.5
    case NodeLevel.CAPITAL: return 5;    // 首都最高 Lv.5
    default: return 2;
  }
}

export function getTaxBonusPer10Pop(title: NobleTitle): number {
  return getTitleConfig(title).taxBonusPer10Pop;
}

/**
 * 勞動力分配職業
 */
export enum WorkerJob {
  UNASSIGNED = 'UNASSIGNED', // 未指派的難民
  FARMER = 'FARMER',         // 農夫 (產出糧食、棉麻)
  HUNTER = 'HUNTER',         // 獵人 (產出生皮、獸肉)
  WOODCUTTER = 'WOODCUTTER', // 伐木工 (產出木材)
  MINER = 'MINER',           // 礦工 (產出石材與鐵礦)
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
  minimumNodeLevel?: NodeLevel; // 開局或特殊規則保證的最低據點階段
  ownerFactionId: string | null; // 當前佔領該節點的派系 ID（若無則為 null）
  isPlayerBase: boolean;      // 標記這是否為玩家當前的所在地
  isDiscovered?: boolean;     // 玩家是否已永久發現此據點
  isCapital?: boolean;        // 標記這是否為玩家冊封的首都
  isVassal?: boolean;         // 標記是否為玩家征服收編之附庸據點
  defenseLevel?: number;      // 據點城防與守軍難度等級
  terrain: TerrainType;       // 地形類型
  feature: NodeFeature;       // 節點特性
  
  // 動態顯示與解鎖機制
  isHidden?: boolean;
  isDynamic?: boolean; // 是否為動態生成的節點 (如：探索出來的隨機巢穴)
  isEliteLair?: boolean; // 是否為低機率刷出的稀有高難度挑戰據點
  allowTroops?: boolean; // 是否允許帶兵討伐/攻城 (支援調派步兵/弓兵/騎兵)
  customIcon?: string; // 自訂大地圖圖標 (例如 "cave_node_01:cave_node_01_1" 或自訂圖檔)
  baseDifficulty?: number; // 用於動態巢穴等自訂難度的節點
  narrativeSubjugation?: {
    storyId: string;
    sourceNodeId: string;
    templateId?: string;
    journeyNodeIds: string[];
    victoryNodeId?: string;
    victoryDelayDays?: number;
    defeatNodeId?: string;
    defeatDelayDays?: number;
    removeOnVictory: boolean;
    enemyFeature?: 'BALANCED' | 'HIGH_DEF' | 'HIGH_EVADE';
  };
  expansionCount?: number; // 動態隨機據點未清剿擴張次數 (最多2次)
  establishedBaseMonsterId?: string; // 首次確立的主題怪物原型 ID (保證擴張永遠同種族)
  establishedAffix?: StrongholdAffix; // 確立的據點環境詞綴
  unlockCondition?: {
    minDay?: number;
    minPrestige?: number;
  };

  // 情報迷霧系統 (Scouting System)
  isScouted: boolean;
  scoutExpiryDate: number | null;
  scoutData?: NodeScoutData;
  pendingScoutDays?: number; // 距離偵查完成還剩多少天
  
  // 天氣系統
  currentWeather: WeatherType;
  weatherDuration: number;
  
  // 市場資料
  marketData?: NodeMarketData;
  producedGoods?: string[]; // 盛產/可買物資 ID 清單 (從 materials.json 讀取)
  demandedGoods?: string[]; // 需求/高價收購 ID 清單 (從 materials.json 讀取)
  
  // 圍城資料
  siegeData?: SiegeData;
  
  // 代官資料
  governorId?: string;
}

export interface SiegeData {
  attackerFactionId: string;
  remainingDays: number;
  attackerPower: number;
}

export interface NodeScoutData {
  dangerLevel: string;
  treasureTier: string;
  garrisonPower?: number;
  garrisonEncounter?: MonsterInstance[]; // 儲存偵查生成的精確敵軍隊伍 (保證偵查結果與戰鬥 100% 一致)
  mainRaces?: MonsterRace[];              // 偵查情報：主體種族
  mainElements?: ElementType[];          // 偵查情報：主要元素威脅
  affix?: StrongholdAffix;               // 據點環境詞綴
}

export interface TradeGood {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  type: 'FOOD' | 'MATERIAL' | 'LUXURY' | 'SPECIALTY';
  icon?: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  icon: string;
  category: 'TRADE_GOOD' | 'CRAFTING_MATERIAL';
  type?: 'FOOD' | 'MATERIAL' | 'LUXURY' | 'SPECIALTY';
  tier: number;
  description: string;
  basePrice: number;
  flavorText?: string;
  isLocked?: boolean;
}

export interface NodeMarketData {
  lastUpdateDay: number;
  goods: {
    goodId: string;
    buyPrice: number;
    sellPrice: number;
    stock: number;
  }[];
  demandEvent?: {
    goodId: string;
    description: string;
    priceMultiplier: number;
  };
}

export enum FactionType {
  ROYAL = 'ROYAL',             // 王室
  GREAT_HOUSE = 'GREAT_HOUSE', // 四大統治家族
  MINOR_HOUSE = 'MINOR_HOUSE', // 小家族/附庸
  SYNDICATE = 'SYNDICATE'      // 商會/聯盟
}

export enum FactionPersonality {
  WARMONGER = 'WARMONGER', // 好戰
  PEACEFUL = 'PEACEFUL',   // 和平/保守
  MERCHANT = 'MERCHANT',   // 重商/中立
  SCHEMER = 'SCHEMER'      // 陰謀家/善變
}

/**
 * AI 派系陣營武將 (Champion)
 */
export interface FactionChampion {
  id: string;
  name: string;               // 武將姓名
  title: string;              // 稱號
  factionId: string;          // 所屬派系 ID
  powerTier: number;          // 強度係數 (1~10)
  isBoss: true;               // 標記為 Boss 等級
  jobId: string;              // 對應 DataStore.JobDB 職業
  traitId: string;            // 對應 DataStore.TraitDB 特質
  portraitEmoji: string;      // 頭像 Emoji
  description: string;        // 角色背景
  rarity: 'ELITE' | 'CHAMPION' | 'LEGENDARY'; // 稀有度
}

export interface FactionChampionInstance extends FactionChampion {
  hp: number;
  damage: number;
  defense: number;
  evade: number;
  calculatedPowerScore: number;
  race: MonsterRace;          // 設為 HUMAN
}


export enum TradeTreaty {
  NONE = 'NONE',
  BASIC = 'BASIC',     // 基礎通商條約 (含關稅)
  ALLIED = 'ALLIED'    // 免稅貿易協定
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
  tradeTreaty?: TradeTreaty;  // 與玩家簽署的貿易條約
  relations: Record<string, number>; // 對其他派系的關係矩陣 (-100 ~ 100)
  atWarWith: string[];               // 交戰中的派系 ID
  personality: FactionPersonality;   // 派系性格
  champions?: FactionChampion[];     // 派系武將名冊
  capturedChampionIds?: string[];    // 目前被玩家俘虜的武將 ID
  defeatedChampionIds?: string[];    // 已陣亡的武將 ID
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
  hp: number;        // 生命值
  mp: number;        // 魔力值
  patk: number;      // 物理攻擊力
  matk: number;      // 魔法攻擊力
  pdef: number;      // 物理防禦力
  mdef: number;      // 魔法防禦力
  hit: number;       // 命中率
  evade: number;     // 閃避率
  speed: number;     // 速度 (決定出手順序)
  critRate: number;  // 爆擊率 (%)
  critDmg: number;   // 爆擊傷害 (%)
  atk: number;       // 攻擊力 (為 patk 或 matk 較高者)
  def: number;       // 防禦力 (為 pdef)
}

/**
 * 武器/防具的打寶補正層級
 */
export type ScalingTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

export const SCALING_MULTIPLIERS: Record<ScalingTier, number> = {
  'S': 2.1,
  'A': 2.0,
  'B': 1.5,
  'C': 1.0,
  'D': 0.8,
  'E': 0.5
};

/**
 * 裝備實體所擁有的具體補正倍率字母
 */
export interface EquipmentScaling {
  patk?: Partial<Record<keyof Attributes, ScalingTier>>;
  matk?: Partial<Record<keyof Attributes, ScalingTier>>;
  pdef?: Partial<Record<keyof Attributes, ScalingTier>>;
  mdef?: Partial<Record<keyof Attributes, ScalingTier>>;
}

/**
 * 裝備模板用來生成隨機補正的骰子規則
 */
export interface ScalingRuleTarget {
  guaranteed?: Partial<Record<keyof Attributes, [ScalingTier, ScalingTier]>>; // 保底主屬性，例 { str: ['C', 'S'] }
  randomPool?: {
    possibleAttributes: (keyof Attributes)[]; // 可選的隨機屬性池
    rankRange: [ScalingTier, ScalingTier];    // 抽中時的等級範圍，例 ['E', 'A']
    count: [number, number];                  // 抽取數量範圍，例 [0, 2]
  };
}

export interface ScalingRules {
  patk?: ScalingRuleTarget;
  matk?: ScalingRuleTarget;
  pdef?: ScalingRuleTarget;
  mdef?: ScalingRuleTarget;
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
  id?: string;
  name: string;
  xpModifier: number;          // 經驗值需求倍率 (例如 1.2 代表需要多 20% 經驗)
  statMultipliers: Partial<Attributes>; // 屬性百分比加成 (例如 { agi: 0.1 } 代表敏捷 +10%)
  recruitmentModifier?: number; // 招募價格浮動係數 (例: 1.15)
  recruitDialogue?: string;     // 專屬招募台詞
}

/**
 * 武器標籤 (影響職業變化)
 */
export enum WeaponType {
  GREATSWORD = 'GREATSWORD',             // 巨劍 (狂戰士)
  DUAL_SWORDS = 'DUAL_SWORDS',           // 雙劍 (魔劍士)
  SWORD_AND_SHIELD = 'SWORD_AND_SHIELD', // 劍盾 (騎士)
  RUNE_SHIELD = 'RUNE_SHIELD',           // 符文巨盾 (符文騎士)
  STAFF = 'STAFF',                       // 法杖 (法師)
  SCYTHE = 'SCYTHE',                     // 戰鐮 (死靈法師)
  DAGGERS = 'DAGGERS',                   // 雙匕首/雙短刀 (盜賊)
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
  allowedJobs?: string[];               // 限制裝備的職業列表 (例如 ['戰士'])
  requirements: Partial<Attributes>;    // 穿戴條件 (例如 { str: 40 })
  effects: Partial<Attributes>;         // 裝備提供的基礎屬性加成 (例如 { int: 10 })
  combatEffects?: Partial<CombatStats>; // 直接給予的戰鬥數值加成 (例如加HP、攻擊力)
  baseCombatEffects?: Partial<CombatStats>; // 原始固定基底戰鬥數值 (用於強化時準確還原/計算)
  grantedSkill?: string;                // 裝備附帶的額外技能 ID
  extraSkills?: string[];               // 裝備附帶的額外雙技能 ID 列表
  fixedSkill?: string;                  // 固定本命特技 ID
  skillPool?: string[];                 // 隨機抽取技能候選池
  skillRollChance?: number;             // 隨機技能抽取機率 (0~100)
  skillRollCount?: number;              // 隨機技能抽取數量
  skillTriggerChances?: number[];       // 技能觸發機率 (例如 [20, 15] 代表 20% 與 15%)
  scaling?: EquipmentScaling;           // 個體差異化的屬性倍率補正 (S~E級)
  enhancementLevel?: number;            // 強化等級 (預設0)
  icon?: string;                        // 裝備圖示佔位符(emoji 或 category:id)
  element?: ElementType;                // 裝備附帶的元素屬性
  secondaryElement?: ElementType;       // 法杖專用第二元素
  armorType?: 'CLOTH' | 'LEATHER' | 'HEAVY'; // 防具類別
  tier?: number;                        // 裝備階級 (1~5)
  isVariant?: boolean;                  // 是否為變異職業專用裝備
  affixPool?: string[];                 // 隨機屬性詞條池
  craftable?: boolean;                  // 是否可由鐵匠鋪鍛造 (預設 true)
  droppable?: boolean;                  // 是否可由怪物/地城掉落 (預設 true)
  shopBuyable?: boolean;                // 是否可在商店貨架購買 (預設 true)
  combatStatRanges?: Partial<Record<keyof CombatStats, [number, number]>>; // 戰鬥數值浮動範圍 [min, max]
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
  armorType?: 'CLOTH' | 'LEATHER' | 'HEAVY'; // 防具類別
  tier?: number;              // 裝備階級 (1~5)
  isVariant?: boolean;        // 是否為變異職業專用裝備
  allowedJobs?: string[];     // 限制裝備的職業列表
  icon?: string;              // 裝備圖示
  itemLevel: number;          // 裝備等級 (影響隨機屬性的數值大小)
  baseRequirements: Partial<Attributes>;   // 基礎穿戴條件
  baseEffects: Partial<Attributes>;        // 固定六維屬性加成
  baseCombatEffects: Partial<CombatStats>; // 固定戰鬥數值 (例如武器的基礎攻擊力固定)
  grantedSkill?: string;                   // 裝備附帶的額外技能 ID
  extraSkills?: string[];                  // 額外雙技能 ID 列表
  fixedSkill?: string;                     // 固定本命特技 ID
  skillPool?: string[];                    // 隨機抽取技能候選池
  skillRollChance?: number;                // 隨機技能抽取機率 (0~100)
  skillRollCount?: number;                 // 隨機技能抽取數量
  skillTriggerChances?: number[];          // 技能觸發機率
  element?: ElementType;                   // 裝備附帶的元素屬性
  affixPool?: string[];                    // 隨機屬性詞條池
  craftable?: boolean;                     // 是否可鍛造 (預設 true)
  droppable?: boolean;                     // 是否可掉落 (預設 true)
  shopBuyable?: boolean;                   // 是否可在商店購買 (預設 true)
  combatStatRanges?: Partial<Record<keyof CombatStats, [number, number]>>; // 浮動戰鬥數值範圍
  isLocked?: boolean;                      // 防誤刪上鎖標記
  // 決定在生成時，會隨機抽取哪些額外屬性進行加成
  randomPool?: {
    attributes?: (keyof Attributes)[];
    combatStats?: (keyof CombatStats)[];
  };
  scalingRules?: ScalingRules;             // 定義掉落生成時的屬性權責補正骰子規則
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
 * 八大魔物戰鬥定位 (Stat Profiles)
 * 用於總預算鎖死下的正規化屬性分配
 */
export enum MonsterProfile {
  TANK = 'TANK',             // 鐵壁肉盾：高HP、超高物防、低速低攻
  ASSASSIN = 'ASSASSIN',     // 疾風刺客：高攻、高速、高暴擊高閃避、極脆皮
  MAGE = 'MAGE',             // 奧術法師：高魔攻、高魔防、魔法普攻、低血量
  BERSERKER = 'BERSERKER',   // 嗜血狂戰：極致高物理攻擊、中高血量、低雙防
  RANGER = 'RANGER',         // 遠程狙擊：高命中、高暴擊、狙擊後排、中等速度
  JUGGERNAUT = 'JUGGERNAUT', // 亡靈泥沼：巨量HP、中雙防、零閃低速
  BOSS = 'BOSS',             // 史詩首領：全能高維度屬性
  BALANCED = 'BALANCED'      // 常規均衡：標準平穩分配
}

export type AttackType = 'MELEE' | 'RANGED' | 'MAGIC';

/**
 * 魔物原型資料結構
 */
export interface MonsterData {
  id: string;
  name: string;                         // 基礎名稱 (例如 哥布林、骷髏)
  race: MonsterRace;                    // 預設/主要種族
  compatibleRaces: MonsterRace[];       // 允許冠上的種族標籤 (例如 ['MONSTER', 'UNDEAD'])
  terrains: TerrainType[];              // 出沒地形
  powerTier: number;                    // 基礎戰力係數
  profile?: MonsterProfile;             // 戰鬥定位模板 (預設 BALANCED)
  attackType?: AttackType;              // 攻擊類型: MELEE(近戰物理), RANGED(遠程物理), MAGIC(遠程魔法)
  skills?: string[];                    // 預設掛載的通用技能 ID 清單
  defaultElement?: ElementType;         // 預設元素
  isBoss?: boolean;                     // 是否為 Boss
  isMagicalAttacker?: boolean;          // 是否為法系攻擊者 (相容性標記)
  avatarIcon?: string;                  // 怪物專屬 Sprite / Emoji 圖標
  characterKey?: string;                // 唯一角色身分代碼 (跨型態綁定，例如 CHAR_RYAN)
  substituteMonsterId?: string;         // 指定代理副將怪物 ID (當角色已被玩家獲得時替換)
  captureRate?: number;                 // 專屬被俘虜機率 0~100 (選填，未填則依情境預設)
  lootConfig?: {
    goldBase: number;
    expBase: number;
    equipmentDropRate: number;
  };
}

/**
 * 戰鬥用實體魔物資料 (帶有具體數值與質變/元素前綴)
 */
export interface MonsterInstance extends MonsterData {
  hp: number;
  maxHp?: number;
  damage: number;
  defense: number;                       // 基礎/通用防禦 (相容性)
  pdef?: number;                         // 物理防禦
  mdef?: number;                         // 魔法防禦
  speed?: number;                        // 出手速度
  evade: number;
  calculatedPowerScore: number;
  element: ElementType;                 // 戰鬥實體的最終元素
  goldReward?: number;
  expReward?: number;
  equipmentDropRate?: number;
  appliedRaceTag: MonsterRace;          // 實體抽到的最終種族標籤
  skills?: string[];                    // 實體最終掛載的技能
  formationRow?: FormationRow;          // 怪物在戰鬥中的前後排站位
  gridR?: number;                       // 0: 前排 (迎敵第一線), 1: 中排, 2: 後排
  gridC?: number;                       // 0: 上路, 1: 中路, 2: 下路
  slotId?: string;                      // e.g. "0_0", "1_1"
}

/**
 * 攻守戰役戰場模式與陣營席位抽象 (桌遊棋盤標準介面)
 */
export enum SiegeBattleMode {
  NONE = 'NONE',                       // 常規野戰 / 討伐 / 跑商遭遇戰 (無城門)
  DEFENSE_SIEGE = 'DEFENSE_SIEGE',     // 守城戰役 (玩家接入 Defender 右席位，敵軍接入 Attacker 左席位)
  OFFENSIVE_SIEGE = 'OFFENSIVE_SIEGE' // 攻城遠征 (玩家接入 Attacker 左席位，敵軍接入 Defender 右席位)
}

export enum SiegeRole {
  ATTACKER = 'ATTACKER', // 進攻方 (左側席位，面向右側推進，擁有攻城器械，打擊中央城門)
  DEFENDER = 'DEFENDER'  // 防守方 (右側席位，面向左側迎敵，擁有城防設施，防守中央城門)
}

/**
 * 攻城器械種類與配置
 */
export enum SiegeEngineType {
  BATTERING_RAM = 'BATTERING_RAM', // 撞木衝車
  TREBUCHET = 'TREBUCHET'          // 重型投石機
}

export interface SiegeEngineCost {
  materials: Record<string, number>; // 二階加工素材需求 (e.g. { mat_wood_plank: 60, mat_iron_ingot: 30 })
  gold: number;
  description: string;
}

export const SIEGE_ENGINE_CONFIGS: Record<SiegeEngineType, SiegeEngineCost> = {
  [SiegeEngineType.BATTERING_RAM]: {
    materials: {
      mat_wood_plank: 60,
      mat_iron_ingot: 30
    },
    gold: 800,
    description: '重型撞木衝車：需步兵 ≥10 人推動，每次撞擊造成 400+ 破門巨響。'
  },
  [SiegeEngineType.TREBUCHET]: {
    materials: {
      mat_wood_plank: 120,
      mat_stone_brick: 80,
      mat_iron_ingot: 40
    },
    gold: 2000,
    description: '巨型配重投石機：自帶 4 枚巨石彈藥，每發造成 800 傷害並震懾擊暈。'
  }
};

/**
 * 攻城部隊與器械編制
 */
export interface OffensiveSiegeDeployment {
  targetNodeId: string;
  squads: {
    adventurerIds: string[];
    gridMap?: Record<string, string>;
    formationId?: string;
  }[];
  assignedTroops: {
    infantry: number;
    archer: number;
    cavalry: number;
  };
  engines: {
    ramCount: number;       // 衝車數量 (0 或 1)
    trebuchetCount: number;  // 投石機數量 (0 或 1)
  };
  provisions: number;       // 隨行糧草消耗量
  marchDays?: number;       // 單程行軍天數
}

/**
 * 據點工坊 (Encounter / Group Studio) 戰鬥團體陣營角色定位
 */
export enum CombatGroupRole {
  DEFENDER_ONLY = 'DEFENDER_ONLY', // 僅防守方 (據點守軍、要塞衛隊)
  ATTACKER_ONLY = 'ATTACKER_ONLY', // 僅進攻方 (攻城侵略軍、突襲圍城隊)
  VERSATILE = 'VERSATILE'          // 攻守通用 (正規野戰軍、遊擊傭兵團)
}

/**
 * 進攻方接口可控數值配置 (Attacker Interface)
 */
export interface AttackerInterfaceConfig {
  ramCount: number;                 // 撞木衝車數量 (0 ~ 3)
  trebuchetCount: number;           // 重型投石機數量 (0 ~ 3)
  infantrySupport: number;          // 隨軍步兵人數 (提供軍團護盾與推車)
  archerSupport: number;            // 隨軍弓兵人數 (提供漫天箭雨壓制與後排陣地血池)
  cavalrySupport: number;           // 隨軍騎兵人數 (破城後毀滅突入衝鋒)
  tacticalStance?: 'GATE_FOCUS' | 'ENEMY_FOCUS'; // 戰術傾向 (破門優先 vs 殲敵優先)
}

/**
 * 防守方接口可控數值配置 (Defender Interface)
 */
export interface DefenderInterfaceConfig {
  gateMaxHp: number;                // 城門/要塞最大耐久度 (1,000 ~ 10,000)
  watchtowerCount: number;          // 防禦箭塔數量 (0 ~ 3)
  watchtowerDmg: number;            // 箭塔每回合穿透傷害 (0 ~ 150)
  gatePdef?: number;                // 城門物理減傷抗性 (0 ~ 50)
  rampartArrowBonusPct?: number;    // 城垛弓箭手傷害加成百分比 (0 ~ 50%)
}

/**
 * 據點工坊自定義戰鬥團體配置
 */
export interface CustomCombatGroup {
  id: string;
  name: string;
  description: string;
  role: CombatGroupRole;
  attackerConfig?: AttackerInterfaceConfig;
  defenderConfig?: DefenderInterfaceConfig;
  monsterIds: string[];             // 成員怪獸/NPC ID 列表
}

/**
 * 領主攻城戰役行軍任務模型 (Lord Siege Campaign Marching Mission)
 */
export interface LordSiegeCampaignMission {
  id: string;
  targetNodeId: string;
  targetNodeName: string;
  targetTerrain?: TerrainType;
  daysTotal: number;
  daysRemaining: number;
  assignedTroops: { infantry: number; archer: number; cavalry: number };
  engines: { ramCount: number; trebuchetCount: number };
  primarySquadIds: string[];
  reserveSquadConfigs: { defenderIds: string[]; formationId?: string; gridMap?: Record<string, string> }[];
  primaryFormationId?: string;
  primaryGridMap?: Record<string, string>;
  provisionPerDay: number;
  isLordCampaign: boolean;
  state: 'MARCHING' | 'ARRIVED' | 'RESOLVED';
}



