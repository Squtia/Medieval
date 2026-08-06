import { Random } from '../core/Random';
import { GameState } from '../core/GameState';

export const NARRATIVE_POOLS = {
  environments: [
    "四周的樹木高聳入雲，幾乎遮蔽了天光。",
    "空氣中瀰漫著濃霧，視線範圍十分有限。",
    "腳下的泥土鬆軟，不時傳來踩碎枯枝的聲響。",
    "陰冷的微風吹過，帶來一絲不安的氣息。",
    "荒野的陽光十分刺眼，讓探索變得有些艱辛。"
  ],
  encounters: [
    "突然一陣腥風撲鼻而來，怪物從暗處發起了伏擊！",
    "前方傳來不尋常的騷動，沒多久他們就遭遇了敵人。",
    "小隊在轉角處迎頭撞上了正在徘徊的怪物。",
    "一聲尖嘯劃破天際，敵人氣勢洶洶地殺了出來。",
    "正當眾人稍有鬆懈時，怪物突兀地出現在眼前。"
  ],
  rests: [
    "結束戰鬥後，傭兵們靠著樹幹簡短休息了一下，便繼續出發探索。",
    "小隊迅速清理了戰場，包紮傷口後再次踏上旅途。",
    "在確認周圍安全後，隊長下令喝口水喘息，隨即帶隊前進。",
    "戰鬥的硝煙散去，傭兵們稍作調整，繼續深入未知區域。",
    "眾人席地而坐，吃了點乾糧恢復體力後，再次啟程。"
  ],
  returns: [
    "帶著滿滿的收穫，小隊踏上了歸途。",
    "看著天色漸暗，隊長決定見好就收，率隊返回據點。",
    "經歷了一連串的遭遇，小隊帶著戰利品平安折返。",
    "雖然疲憊，但眾人的臉上掛著勝利的微笑，緩步踏上歸途。",
    "結束了這趟驚險的旅程，小隊順著原路返回營地。"
  ]
};

export interface TraitNarrativeBranch {
  targetTraits: string[]; // 匹配的特質 (例如 ['SCHOLAR'], ['BRAVE'])
  narrativeText: string;  // 不帶有系統標籤的故事敘述
  onResolve: () => void;  // 給予獎勵或副作用
  triggerCombat?: boolean; // 抉擇後是否觸發特殊戰鬥
}

export interface ExplorationNarrativeEvent {
  id: string;
  introText: string; // 遭遇事件的開場敘述
  branches: TraitNarrativeBranch[];
  defaultBranch: TraitNarrativeBranch; // 沒有任何特質匹配時的預設行為
}

export const EXPLORATION_EVENTS: ExplorationNarrativeEvent[] = [
  {
    id: 'exp_evt_ancient_stele',
    introText: '沒多久，他們在廢墟中發現了一座刻滿古文字的石碑。',
    branches: [
      {
        targetTraits: ['SCHOLAR'],
        narrativeText: '隊長走上前，仔細端詳並解讀了碑文，成功帶回了古陸歷史碎片。',
        onResolve: () => {
          GameState.myTerritory.prestige += 50;
        }
      },
      {
        targetTraits: ['GREEDY'],
        narrativeText: '隊長無視了碑文的警告，強行撬下碑石上鑲嵌的古老寶石。',
        onResolve: () => {
          GameState.myTerritory.gold += 300;
        }
      },
      {
        targetTraits: ['CAUTIOUS'],
        narrativeText: '隊長察覺到石碑周圍隱約的魔法波動，為了安全起見，下令繞開了這座廢墟。',
        onResolve: () => {}
      }
    ],
    defaultBranch: {
      targetTraits: [],
      narrativeText: '小隊在石碑旁轉了幾圈，由於看不懂上面的文字，最終只能無功而返。',
      onResolve: () => {}
    }
  },
  {
    id: 'exp_evt_wounded_merchant',
    introText: '路途中，小隊發現一輛傾倒的貨車，一名滿身是血的商人正發出微弱的求救聲。',
    branches: [
      {
        targetTraits: ['GREEDY', 'LAZY'],
        narrativeText: '隊長冷笑一聲，無視了商人的求救，直接下令洗劫貨車上殘存的貨物！商人突然撕下偽裝，原來這是盜賊的陷阱！',
        triggerCombat: true,
        onResolve: () => {
          GameState.myTerritory.gold += 100;
        }
      },
      {
        targetTraits: ['LOYAL', 'GUARDIAN'],
        narrativeText: '隊長毫不猶豫地拿出物資為商人包紮傷口。商人獲救後千恩萬謝，贈予了一些稀有物資作為回報。',
        onResolve: () => {
          if (GameState.myTerritory.gold >= 50) GameState.myTerritory.gold -= 50;
          GameState.myTerritory.prestige += 30;
        }
      }
    ],
    defaultBranch: {
      targetTraits: [],
      narrativeText: '小隊猶豫了片刻，最終還是分出了一點繃帶給商人，隨後便匆匆離開。',
      onResolve: () => {
        GameState.myTerritory.prestige += 5;
      }
    }
  }
];

export function getRandomNarrativePool(poolName: keyof typeof NARRATIVE_POOLS): string {
  const pool = NARRATIVE_POOLS[poolName];
  return pool[Random.int(0, pool.length - 1)];
}

export function getRandomNarrative(totalDays: number): string | null { return null; }
