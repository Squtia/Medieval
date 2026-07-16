import { GameState } from '../core/GameState';
import { FactionType } from '../models/types';
import { UIManager } from '../ui/UIManager';

export interface EventOption {
  text: string;
  onSelect: () => void;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  condition: () => boolean; // 判斷是否符合觸發條件
  options: EventOption[];
  isImportant?: boolean; // 標記是否為重要事件 (跳窗)，若為 false/undefined 則進入待辦清單
}

export const GAME_EVENTS: GameEvent[] = [
  // --- 家族政治事件 ---
  {
    id: 'evt_valerius_demand',
    title: '鐵血徵收',
    description: '瓦萊里烏斯家族的軍隊路過你的領地。帶隊的長官傲慢地要求你「捐獻」一批物資以支持他們對北方的軍事行動。拒絕他們可能會被視為叛亂的徵兆。',
    isImportant: true,
    condition: () => {
      // 玩家領地繁榮度 > 300 且 瓦萊里烏斯家族還存在
      const val = GameState.mapSystem.getFactions().find(f => f.id === 'f_valerius');
      return !!val && val.controlledNodes.length > 0 && GameState.myTerritory.gold >= 500;
    },
    options: [
      {
        text: '屈服並繳納物資 (金幣 -500，好感度 +10)',
        onSelect: () => {
          GameState.myTerritory.gold = Math.max(0, GameState.myTerritory.gold - 500);
          const val = GameState.mapSystem.getFactions().find(f => f.id === 'f_valerius');
          if (val) val.playerFavor += 10;
          console.log('📉 你無奈地交出了物資，瓦萊里烏斯軍隊滿意地離去。');
        }
      },
      {
        text: '嚴詞拒絕 (好感度 -20)',
        onSelect: () => {
          const val = GameState.mapSystem.getFactions().find(f => f.id === 'f_valerius');
          if (val) val.playerFavor -= 20;
          console.log('⚔️ 你拒絕了徵收。對方指揮官冷笑著記下了這筆帳。');
        }
      }
    ]
  },
  {
    id: 'evt_morvayn_assassin',
    title: '雪夜的訪客',
    description: '一個身受重傷的黑衣人倒在你的據點門外。從他的裝備來看，似乎是莫凡恩家族的刺客。他的口袋裡有一封沾血的密信。',
    condition: () => {
      // 隨機事件，無特別條件限制
      const mor = GameState.mapSystem.getFactions().find(f => f.id === 'f_morvayn');
      return !!mor && Math.random() < 0.2; 
    },
    options: [
      {
        text: '救治他並歸還密信 (莫凡恩好感度 +15，金幣 -100)',
        onSelect: () => {
          GameState.myTerritory.gold -= 100;
          const mor = GameState.mapSystem.getFactions().find(f => f.id === 'f_morvayn');
          if (mor) mor.playerFavor += 15;
          console.log('🩹 刺客醒來後一言不發地離開了，但莫凡恩家族會記住你的恩情。');
        }
      },
      {
        text: '將信件賣給情報販子 (金幣 +800，莫凡恩好感度 -30)',
        onSelect: () => {
          GameState.myTerritory.gold += 800;
          const mor = GameState.mapSystem.getFactions().find(f => f.id === 'f_morvayn');
          if (mor) mor.playerFavor -= 30;
          console.log('💰 你獲得了一筆不義之財，但也惹上了危險的敵人。');
        }
      }
    ]
  },

  // --- 王室與謀臣事件 ---
  {
    id: 'evt_royal_tax',
    title: '王室特使',
    description: '一位身穿紫袍的埃瑟加德王室特使帶著國王的詔書來到你的據點。他宣稱為了重建「永恆之城」，所有領主都必須繳納特別稅。',
    isImportant: true,
    condition: () => {
      // 領地金幣較多時觸發
      return GameState.myTerritory.gold > 2000;
    },
    options: [
      {
        text: '支付王室稅 (金幣 -1000，王室好感度 +20，聲望 +50)',
        onSelect: () => {
          GameState.myTerritory.gold -= 1000;
          GameState.myTerritory.prestige += 50;
          const royal = GameState.mapSystem.getFactions().find(f => f.id === 'f_royal');
          if (royal) royal.playerFavor += 20;
          console.log('👑 特使讚賞了你的忠誠，你的聲望在貴族圈中傳開了。');
        }
      },
      {
        text: '以領地貧困為由拖延 (王室好感度 -15)',
        onSelect: () => {
          const royal = GameState.mapSystem.getFactions().find(f => f.id === 'f_royal');
          if (royal) royal.playerFavor -= 15;
          console.log('📜 特使帶著不滿離開了，你在王都的評價下降。');
        }
      }
    ]
  },

  // --- 村莊日常事件 ---
  {
    id: 'evt_village_festival',
    title: '豐收祭典',
    description: '領地內的農作物獲得了罕見的大豐收，村民們提議舉辦一場祭典來慶祝。這會消耗一些資金，但能大幅提升士氣與人口增長。',
    condition: () => {
      return GameState.myTerritory.gold >= 300;
    },
    options: [
      {
        text: '資助祭典 (金幣 -300，繁榮度 +50)',
        onSelect: () => {
          GameState.myTerritory.gold -= 300;
          const baseNode = GameState.mapSystem.getNodes().find(n => n.id === GameState.myTerritory.currentCountryId);
          if (baseNode) baseNode.prosperity += 50;
          console.log('🎉 祭典非常成功，領地充滿了歡聲笑語！');
        }
      },
      {
        text: '拒絕並囤積糧食 (無事發生)',
        onSelect: () => {
          console.log('🌾 村民們雖然失望，但也默默接受了你的決定。');
        }
      }
    ]
  },

  // --- 謀臣與小家族專屬事件 ---
  {
    id: 'evt_advisor_spy',
    title: '暗流湧動',
    description: '一名自稱來自「培提爾樞密院」的情報商人來到你的據點。他提議以金幣交換關於周圍敵對勢力的致命弱點，但這也可能是一個陷阱。',
    isImportant: true,
    condition: () => {
      const adv = GameState.mapSystem.getFactions().find(f => f.id === 'f_advisor');
      return !!adv && GameState.myTerritory.gold >= 400;
    },
    options: [
      {
        text: '購買情報 (金幣 -400，獲得戰略優勢)',
        onSelect: () => {
          GameState.myTerritory.gold -= 400;
          // 隨機增加我方好感度或聲望
          GameState.myTerritory.prestige += 30;
          console.log('📜 情報商人笑著遞給了一份密卷，你的聲望與影響力因此提升了。');
        }
      },
      {
        text: '驅逐他 (樞密院好感度 -10)',
        onSelect: () => {
          const adv = GameState.mapSystem.getFactions().find(f => f.id === 'f_advisor');
          if (adv) adv.playerFavor -= 10;
          console.log('🚪 情報商人冷哼一聲離開了。你可能錯失了一個機會。');
        }
      }
    ]
  },
  {
    id: 'evt_oakhaven_refugees',
    title: '橡木谷的求援',
    description: '一群難民從「橡木谷家族」的領地逃難而來，宣稱他們的村莊遭到了野獸的襲擊。他們懇求你收留他們並提供一些糧食。',
    condition: () => {
      const oak = GameState.mapSystem.getFactions().find(f => f.id === 'f_oakhaven');
      return !!oak;
    },
    options: [
      {
        text: '收容難民 (金幣 -200，人口 +50，橡木谷好感度 +20)',
        onSelect: () => {
          GameState.myTerritory.gold = Math.max(0, GameState.myTerritory.gold - 200);
          const baseNode = GameState.mapSystem.getNodes().find(n => n.id === GameState.myTerritory.currentCountryId);
          if (baseNode) baseNode.population += 50;
          const oak = GameState.mapSystem.getFactions().find(f => f.id === 'f_oakhaven');
          if (oak) oak.playerFavor += 20;
          console.log('🤝 你慷慨地收留了難民，橡木谷家族對你表示深深的感激。');
        }
      },
      {
        text: '拒絕收容 (橡木谷好感度 -20)',
        onSelect: () => {
          const oak = GameState.mapSystem.getFactions().find(f => f.id === 'f_oakhaven');
          if (oak) oak.playerFavor -= 20;
          console.log('🚫 難民們在絕望中離開了你的領地。');
        }
      }
    ]
  }
];
