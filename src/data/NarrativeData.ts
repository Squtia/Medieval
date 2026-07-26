/**
 * 荒野階段的日常環境敘事文本池
 */
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

/**
 * 根據機率（約 35%）隨機抽取一條環境敘事
 */
export function getRandomNarrative(totalDays: number): string | null {
  // 利用天數做一定的隨機判定，約 35% 機率觸發
  const pseudoRandom = Math.sin(totalDays * 12.9898) * 43758.5453;
  const chance = pseudoRandom - Math.floor(pseudoRandom);
  if (chance < 0.35) {
    const index = Math.floor((chance / 0.35) * WILDERNESS_NARRATIVES.length);
    return WILDERNESS_NARRATIVES[index];
  }
  return null;
}
