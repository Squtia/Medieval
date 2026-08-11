import { Faction, FactionType, FactionPersonality } from '../models/types';

export const INITIAL_FACTIONS: Faction[] = [
  // --- 1. 洛斯加王室 (中央) ---
  {
    id: 'f_lothgar',
    factionName: '洛斯加王室與舊貴族',
    description: '老王猝死，新君年幼。攝政太后為了維持搖搖欲墜的中央皇權，以高壓統治與秘密情報網控制各方舊貴族。',
    factionType: FactionType.ROYAL,
    color: '#4c1d95',
    resources: 5000,
    controlledNodes: ['n_royal_1', 'n_adv_1'],
    capitalNodeId: 'n_royal_1',
    playerFavor: 10,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.SCHEMER,
    champions: [
      {
        id: 'champ_lothgar_01', name: '奧古斯都三世', title: '皇家禁衛騎士', factionId: 'f_lothgar', powerTier: 7, isBoss: true,
        jobId: 'WARRIOR', traitId: 'GUARDIAN', portraitEmoji: '👑', description: '忠心耿耿的禁衛指揮官，發誓以生命守護皇家最後的尊嚴。', rarity: 'LEGENDARY'
      },
      {
        id: 'champ_lothgar_02', name: '培提爾爵士', title: '樞密院密探傭兵', factionId: 'f_lothgar', powerTier: 5, isBoss: true,
        jobId: 'MAGE', traitId: 'CALCULATING', portraitEmoji: '👁️', description: '深諳權謀之道的情報頭子，操縱著半個王都的秘密。', rarity: 'CHAMPION'
      }
    ]
  },
  
  // --- 2. 鐵血大公國 (北境) ---
  {
    id: 'f_vormund',
    factionName: '鐵血大公國',
    description: '以防禦北方蠻族為由成立的軍事獨裁聯盟，拒絕交出兵權，並試圖維持全大陸最大的常備軍。',
    factionType: FactionType.GREAT_HOUSE,
    color: '#7f1d1d',
    resources: 1200,
    controlledNodes: ['n_val_1', 'n_val_2', 'n_val_4', 'n_val_6'],
    capitalNodeId: 'n_val_1',
    playerFavor: -5,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.WARMONGER,
    champions: [
      {
        id: 'champ_vormund_01', name: '沃爾蒙德公爵', title: '極地暴君騎士', factionId: 'f_vormund', powerTier: 8, isBoss: true,
        jobId: 'WARRIOR', traitId: 'BLOODTHIRSTY', portraitEmoji: '🐺', description: '擁兵自重的北境大公，藉由恐懼與高壓統治著整片荒原。', rarity: 'LEGENDARY'
      },
      {
        id: 'champ_vormund_02', name: '格里姆·瓦萊里烏斯', title: '黑鐵傭兵團長', factionId: 'f_vormund', powerTier: 6, isBoss: true,
        jobId: 'WARRIOR', traitId: 'GUARDIAN', portraitEmoji: '⚔️', description: '附庸家族瓦萊里烏斯的家主，名義上效忠大公，私下卻圖謀反叛。', rarity: 'CHAMPION'
      }
    ]
  },

  // --- 3. 神聖教廷 (東境) ---
  {
    id: 'f_hurst',
    factionName: '神聖教廷與異端審判庭',
    description: '政教合一的狂熱宗教國度，企圖透過宗教狂熱來合法吞併政敵的富庶領地。',
    factionType: FactionType.GREAT_HOUSE,
    color: '#1e3a8a',
    resources: 1000,
    controlledNodes: ['n_mor_1', 'n_mor_2', 'n_mor_3', 'n_mor_4'],
    capitalNodeId: 'n_mor_1',
    playerFavor: 0,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.SCHEMER,
    champions: [
      {
        id: 'champ_hurst_01', name: '赫斯特侯爵', title: '異端審判長騎士', factionId: 'f_hurst', powerTier: 7, isBoss: true,
        jobId: 'CLERIC', traitId: 'HOLY_AURA', portraitEmoji: '✝️', description: '掌控大主教席位，利用信仰洗腦平民，假借神意發動清洗。', rarity: 'LEGENDARY'
      },
      {
        id: 'champ_hurst_02', name: '艾莉西亞·莫凡恩', title: '霜寒處刑傭兵', factionId: 'f_hurst', powerTier: 6, isBoss: true,
        jobId: 'MAGE', traitId: 'CALCULATING', portraitEmoji: '❄️', description: '被侯爵打成異端的古老冰雪魔法貴族，如今被迫成為教廷的秘密處刑人。', rarity: 'CHAMPION'
      }
    ]
  },

  // --- 4. 金流商會聯盟 (南境) ---
  {
    id: 'f_bellavia',
    factionName: '金流商會聯盟',
    description: '看似鬆散，實則壟斷大陸經濟的聯合壟斷企業。',
    factionType: FactionType.GREAT_HOUSE,
    color: '#064e3b',
    resources: 1100,
    controlledNodes: ['n_lys_1', 'n_lys_2', 'n_lys_3'],
    capitalNodeId: 'n_lys_1',
    playerFavor: 0,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.MERCHANT,
    champions: [
      {
        id: 'champ_bellavia_01', name: '貝拉維亞伯爵', title: '金流幕後騎士', factionId: 'f_bellavia', powerTier: 7, isBoss: true,
        jobId: 'RANGER', traitId: 'EAGLE_EYE', portraitEmoji: '💰', description: '表面熱衷藝術，私下卻用金幣雇傭流寇與刺客截殺競爭對手。', rarity: 'LEGENDARY'
      },
      {
        id: 'champ_bellavia_02', name: '羅蘭·萊桑德', title: '毒刃刺客傭兵', factionId: 'f_bellavia', powerTier: 5, isBoss: true,
        jobId: 'RANGER', traitId: 'EAGLE_EYE', portraitEmoji: '🗡️', description: '伯爵手下的黑手套，精於調配劇毒與暗殺，正在策劃毒死伯爵取而代之。', rarity: 'CHAMPION'
      }
    ]
  },

  // --- 5. 深淵礦業財閥 (西境) ---
  {
    id: 'f_dusk',
    factionName: '深淵礦業財閥',
    description: '為了供應全國鐵礦而形成的極端血汗工業區。面對上層剝削，選擇將壓力極限向下轉嫁。',
    factionType: FactionType.GREAT_HOUSE,
    color: '#b45309',
    resources: 1500,
    controlledNodes: ['n_cas_1', 'n_cas_2', 'n_cas_4'],
    capitalNodeId: 'n_cas_1',
    playerFavor: 5,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.WARMONGER,
    champions: [
      {
        id: 'champ_dusk_01', name: '達斯克子爵', title: '血汗礦主騎士', factionId: 'f_dusk', powerTier: 7, isBoss: true,
        jobId: 'WARRIOR', traitId: 'RUTHLESS', portraitEmoji: '⛏️', description: '冷酷的礦場主，推行連坐法，強制平民在無防護狀態下進入瘴氣深淵挖礦。', rarity: 'LEGENDARY'
      },
      {
        id: 'champ_dusk_02', name: '巴爾多夫·卡西恩', title: '重裝護衛傭兵', factionId: 'f_dusk', powerTier: 5, isBoss: true,
        jobId: 'WARRIOR', traitId: 'GUARDIAN', portraitEmoji: '🛡️', description: '被子爵巨金聘用的老牌護衛首領，專門鎮壓暴動的礦工與奴隸。', rarity: 'ELITE'
      }
    ]
  },

  // --- 隱世小家族 ---
  {
    id: 'f_oakhaven',
    factionName: '橡木谷家族',
    description: '坐落於偏遠村莊的和平家族，與世無爭。他們保存了災變前的一些農業技術，生活雖然不富裕卻安居樂業。',
    factionType: FactionType.MINOR_HOUSE,
    color: '#4d7c0f',
    resources: 300,
    controlledNodes: ['n_oak_1'],
    capitalNodeId: 'n_oak_1',
    playerFavor: 10,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.PEACEFUL,
    champions: [
      {
        id: 'champ_oak_01', name: '奧克利長老', title: '谷地守護傭兵', factionId: 'f_oakhaven', powerTier: 3, isBoss: true,
        jobId: 'CLERIC', traitId: 'GUARDIAN', portraitEmoji: '🌿', description: '橡木谷的慈祥長老，精通草藥學與基礎神聖法術。', rarity: 'ELITE'
      }
    ]
  },
  {
    id: 'f_blackwood',
    factionName: '黑木守衛',
    description: '一群誓言守護邊界古老封印的沒落騎士家族，極端排外但戰鬥力驚人。',
    factionType: FactionType.MINOR_HOUSE,
    color: '#171717',
    resources: 500,
    controlledNodes: ['n_blk_1'],
    capitalNodeId: 'n_blk_1',
    playerFavor: -10,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.WARMONGER
  }
];
