import { GameState } from '../core/GameState';
import { EventOption, GameEvent } from './EventData';
import { Random } from '../core/Random';

// 原本的荒野文本池保留
export const WILDERNESS_NARRATIVES: string[] = [
  '🌙 夜裡聽到遠方傳來隱約的狼嚎聲，哨兵握緊了手中的長矛。',
  '🌤️ 春雨過後土地變得鬆軟，採集物資的隨從發現了一些野生漿果。',
  '🔥 營火旁，傭兵們圍坐在一起談論著遠方繁榮城鎮的傳說。',
  '🌿 斥候回報附近的樹林裡發現了廢棄的木棚，似乎曾有人在此避難。',
  '🌕 月圓之夜，夜空的星光格外明亮，營地的守夜人員警戒無虞。',
  '🦅 一隻巨鷹在據點上空盤旋許久，似乎在觀察這個新出現的聚落。',
  '💨 陣陣涼風吹過荒野，帶起了些許塵土，工人们努力加快工作進度。',
  '🪵 伐木工在林間發現了一株沉香木，空氣中瀰漫著淡淡的香氣。',
  '🌧️ 連綿的大雨讓營地地面有些泥濘，但水井的水質變得非常清澈。',
  '⚒️ 採礦時偶爾能聽見地底微小的迴響，礦工們充滿了對未知礦脈的期待。',
  '🏕️ 營地邊緣開墾出了幾塊小菜園，嫩芽正破土而出。',
  '📜 流浪的行腳商人路過據點外圍，向哨兵打聽了附近的道路狀況。',
  '🌅 清晨的薄霧籠罩著據點，第一縷陽光穿透樹梢帶來了溫暖。',
  '🛡️ 傭兵們在空地上進行日常演練，金屬碰撞聲讓據點顯得充滿生機。',
  '🌾 哨兵回報周遭未發現威脅，今天是極為平靜的一天。'
];

export function getRandomNarrative(totalDays: number): string | null {
  const pseudoRandom = Math.sin(totalDays * 12.9898) * 43758.5453;
  const chance = pseudoRandom - Math.floor(pseudoRandom);
  if (chance < 0.35) {
    const index = Math.floor((chance / 0.35) * WILDERNESS_NARRATIVES.length);
    return WILDERNESS_NARRATIVES[index];
  }
  return null;
}

// ==========================================
// Phase 1: 探險隨機事件池 (文字抉擇事件)
// ==========================================

export const EXPLORATION_EVENTS: GameEvent[] = [
  {
    id: 'exp_evt_ancient_stele',
    title: '古老的石碑',
    description: '在荒野探索時，你的部隊在廢墟中發現了一座刻滿古代符文的石碑。它散發著微弱的魔法波動。',
    isImportant: true,
    condition: () => true,
    options: [
      {
        text: '仔細解讀 (獲得世界觀文本與 50 聲望)',
        onSelect: () => {
          GameState.myTerritory.prestige += 50;
          // 這裡未來可整合到圖鑑系統，目前先以 Toast 或日誌顯示
          console.log('📜 你獲得了古陸歷史敘事文本：「在第一次大崩解前，天空曾是永恆的金色...」');
          import('../ui/ToastManager').then(m => m.ToastManager.show('獲得古陸歷史碎片，聲望 +50'));
        }
      },
      {
        text: '破壞石碑尋找寶物 (獲得金幣，但部隊有機率受傷)',
        onSelect: () => {
          if (Random.next() < 0.5) {
            GameState.myTerritory.gold += 300;
            import('../ui/ToastManager').then(m => m.ToastManager.show('成功找到隱藏的古代金幣！金幣 +300'));
          } else {
            // 這裡簡化為減少金幣或部隊受損的文字
            GameState.myTerritory.gold = Math.max(0, GameState.myTerritory.gold - 100);
            import('../ui/ToastManager').then(m => m.ToastManager.show('⚠️ 石碑爆發出詛咒！你損失了 100 金幣用於治療部隊。'));
          }
        }
      },
      {
        text: '不理會，繼續前進',
        onSelect: () => {
          import('../ui/ToastManager').then(m => m.ToastManager.show('你選擇了謹慎行事，沒有理會石碑。'));
        }
      }
    ]
  },
  {
    id: 'exp_evt_wounded_merchant',
    title: '受傷的商人',
    description: '部隊在行軍路上遇到了一名被強盜洗劫的受傷商人。他的貨車殘骸散落一地，他正痛苦地呻吟著。',
    isImportant: true,
    condition: () => true,
    options: [
      {
        text: '提供救援與物資 (消耗 50 金幣，獲得 20 聲望與潛在人脈)',
        onSelect: () => {
          if (GameState.myTerritory.gold >= 50) {
            GameState.myTerritory.gold -= 50;
            GameState.myTerritory.prestige += 20;
            import('../ui/ToastManager').then(m => m.ToastManager.show('商人對你千恩萬謝，承諾未來一定會回報你。聲望 +20'));
          } else {
            import('../ui/ToastManager').then(m => m.ToastManager.show('金幣不足，無法提供足夠的救援。'));
          }
        }
      },
      {
        text: '趁火打劫 (獲得 100 金幣，聲望 -30)',
        onSelect: () => {
          GameState.myTerritory.gold += 100;
          GameState.myTerritory.prestige = Math.max(0, GameState.myTerritory.prestige - 30);
          import('../ui/ToastManager').then(m => m.ToastManager.show('你冷酷地奪走了他僅存的財物。金幣 +100，聲望 -30'));
        }
      }
    ]
  }
];
