export interface RumorTemplate {
  id: string;
  tags: string[];
  type: 'GENERAL' | 'LOCATION';
  text: string;
}

export const RumorData: RumorTemplate[] = [
  {
    id: 'rumor_general_1',
    tags: ['bandit', 'north'],
    type: 'GENERAL',
    text: '聽說北方的山賊越來越猖狂了，連商隊都不敢走那條路...'
  },
  {
    id: 'rumor_general_2',
    tags: ['magic', 'foreshadowing'],
    type: 'GENERAL',
    text: '最近夜空中的星象不太對勁，那些玩魔法的傢伙都在竊竊私語。'
  },
  {
    id: 'rumor_general_3',
    tags: ['royal', 'politics'],
    type: 'GENERAL',
    text: '王都那邊傳來消息，好像有哪位大貴族失蹤了，這世道真是不太平啊。'
  },
  {
    id: 'rumor_general_4',
    tags: ['monster', 'forest'],
    type: 'GENERAL',
    text: '森林深處經常傳出可怕的咆哮聲，老獵人們都不敢再深入了。'
  },
  {
    id: 'rumor_general_5',
    tags: ['mercenary', 'tavern'],
    type: 'GENERAL',
    text: '前幾天有個穿著黑鎧甲的傢伙來過，點了最烈的酒，一句話都沒說就走了。'
  }
];

export const LOCATION_FOG_RUMORS = [
  '聽幾個剛從那邊逃回來的商人說，那裡的濃霧中藏著某種巨大的遺跡...',
  '有個瘋癲的老頭整天嚷嚷，說那片未知的區域裡有著不可思議的怪物巢穴。',
  '往那邊去的冒險者都沒有回來，但偶爾能看到霧中閃爍著奇異的光芒。',
  '老一輩的人總是警告我們別靠近那邊，說那裡的土地受到了某種詛咒。',
  '風向改變的時候，能從那邊聞到濃濃的血腥味和陳舊的金屬味...'
];

export const LOCATION_REVEAL_RUMORS = [
  '老爹擦了擦酒杯：『有守衛回報，你昨天派人巡視的那片荒地，其實底下有個通往古代寶庫的入口！』',
  '一個喝醉的傭兵大聲炫耀：『我親眼看到的！那邊真的有個隱藏的據點，裡面絕對有好東西！』',
  '商會的密探傳來確切消息，那片區域隱藏著一個重要的據點，現在已經在地圖上標記出來了。',
  '某個被救回來的難民說出了真相，那裡原本是個隱秘的營地，現在總算真相大白了。',
  '一封被截獲的密信上寫著那個隱藏地點的確切座標，看來有人比我們更早盯上那裡。'
];
