import { Faction, FactionType } from '../models/types';

export const INITIAL_FACTIONS: Faction[] = [
  // --- 王室與謀臣 ---
  {
    id: 'f_royal',
    factionName: '埃瑟加德王室',
    description: '統治著裂境大陸的最高皇權，然而歷經數代昏君與天災，王權已然旁落，目前僅能勉強維持表面的和平。',
    factionType: FactionType.ROYAL,
    color: '#4c1d95',
    resources: 5000,
    controlledNodes: ['n_royal_1'],
    capitalNodeId: 'n_royal_1',
    playerFavor: 10
  },
  {
    id: 'f_advisor',
    factionName: '培提爾樞密院',
    description: '國王底下的智囊與謀臣家族，表面上忠心耿耿，背地裡卻掌握著王都的情報網與黑市交易，是真正的無冕之王。',
    factionType: FactionType.MINOR_HOUSE,
    color: '#334155',
    resources: 800,
    controlledNodes: ['n_adv_1'],
    capitalNodeId: 'n_adv_1',
    playerFavor: 0
  },

  // --- 四大統治家族 (Great Houses) ---
  {
    id: 'f_valerius',
    factionName: '瓦萊里烏斯家族',
    description: '統治「灰燼之地」的鐵血軍閥，掌握大陸最頂尖的冶煉技術。他們信奉武力與絕對的服從，叛亂在萌芽前就會被無情撲滅。',
    factionType: FactionType.GREAT_HOUSE,
    color: '#7f1d1d',
    resources: 1200,
    controlledNodes: ['n_val_1'],
    capitalNodeId: 'n_val_1',
    playerFavor: -5
  },
  {
    id: 'f_morvayn',
    factionName: '莫凡恩家族',
    description: '盤踞「霜落邊疆」的古老貴族，精通間諜網絡與血脈祕術。他們的領地終年積雪，就如同他們對待外人的態度一般冰冷。',
    factionType: FactionType.GREAT_HOUSE,
    color: '#1e3a8a',
    resources: 1000,
    controlledNodes: ['n_mor_1'],
    capitalNodeId: 'n_mor_1',
    playerFavor: 0
  },
  {
    id: 'f_lysander',
    factionName: '萊桑德家族',
    description: '統治「泣血林地」的優雅家族，精於有毒植物與暗殺。他們看似愛好藝術與和平，實則致命無比，敵人往往在睡夢中死去。',
    factionType: FactionType.GREAT_HOUSE,
    color: '#064e3b',
    resources: 1100,
    controlledNodes: ['n_lys_1'],
    capitalNodeId: 'n_lys_1',
    playerFavor: 0
  },
  {
    id: 'f_cassian',
    factionName: '卡西恩聯盟',
    description: '位於「焦枯荒原」的鬆散商會，由數個掌控水源與貿易路線的富商組成。這裡沒有絕對的忠誠，只有永恆的利益。',
    factionType: FactionType.SYNDICATE,
    color: '#b45309',
    resources: 1500,
    controlledNodes: ['n_cas_1'],
    capitalNodeId: 'n_cas_1',
    playerFavor: 5
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
    playerFavor: 20
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
    playerFavor: -10
  }
];
