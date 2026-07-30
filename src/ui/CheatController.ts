import { GameState } from '../core/GameState';
import { UIManager } from './UIManager';
import { ToastManager } from './ToastManager';
import { renderBaseBuildings } from './SceneController';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';

export function initCheatController(): void {
  if (!(import.meta as any).env?.DEV) return;

  // 全域控制台後門資源修改器
  (window as any).cheatGold = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的金幣數量！');
    GameState.myTerritory.gold = amount;
    UIManager.updateUI();
    console.log(`🧙‍♂️ [密技] 金幣已修改為 ${amount}`);
  };

  (window as any).cheatWood = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的木材數量！');
    GameState.myTerritory.wood = amount;
    UIManager.updateUI();
    console.log(`🧙‍♂️ [密技] 木材已修改為 ${amount}`);
  };

  (window as any).cheatStone = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的石材數量！');
    GameState.myTerritory.stone = amount;
    UIManager.updateUI();
    console.log(`🧙‍♂️ [密技] 石材已修改為 ${amount}`);
  };

  (window as any).cheatIron = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的鐵礦數量！');
    GameState.myTerritory.iron = amount;
    UIManager.updateUI();
    console.log(`🧙‍♂️ [密技] 鐵礦已修改為 ${amount}`);
  };

  // 鍵盤輸入彩蛋密技 (輸入 gold, wood, rock, iron 觸發)
  let cheatSequence: string[] = [];
  const CHEAT_MAP: { [key: string]: { name: string, noPrompt?: boolean, setter: (val: number) => void } } = {
    'gold': { name: '金幣', setter: (v) => GameState.myTerritory.gold = v },
    'wood': { name: '木材', setter: (v) => GameState.myTerritory.wood = v },
    'rock': { name: '石材', setter: (v) => GameState.myTerritory.stone = v },
    'iron': { name: '鐵礦', setter: (v) => GameState.myTerritory.iron = v },
    'fame': { name: '聲望', setter: (v) => GameState.myTerritory.prestige += v },
    'army': { name: '軍隊', setter: (v) => { 
        GameState.myTerritory.workers['INFANTRY'] = (GameState.myTerritory.workers['INFANTRY'] || 0) + v;
        GameState.myTerritory.workers['CAVALRY'] = (GameState.myTerritory.workers['CAVALRY'] || 0) + v;
        GameState.myTerritory.workers['ARCHER'] = (GameState.myTerritory.workers['ARCHER'] || 0) + v;
        EventBus.getInstance().publish({
          type: GameEventType.POPULATION_CHANGED,
          payload: { delta: v * 3, currentPopulation: GameState.myTerritory.population, reason: 'CHEAT' }
        });
    }}
  };

  Object.assign(CHEAT_MAP, {
    'lvlmax': { name: '全傭兵滿等', noPrompt: true, setter: () => {
        GameState.adventurers.forEach(adv => {
           if (adv.level < 10) {
               adv.level = 10;
               adv.unspentStatPoints = (adv.unspentStatPoints || 0) + 45;
           }
        });
        ToastManager.show(`✨ 旗下所有傭兵已提升至 10 等滿等！`);
    }},
    'testwpn': { name: '測試轉職武器', noPrompt: true, setter: () => {
        const testWeapons = [
          { uuid: 'test_wpn_gs_' + Date.now(), id: 'test_greatsword', name: '[測試] 滿等巨劍', slot: 'WEAPON', icon: '⚔️', enhancementLevel: 0, weaponType: 'GREATSWORD', requirements: { str: 5 }, effects: {}, combatEffects: { atk: 15 } },
          { uuid: 'test_wpn_ds_' + Date.now(), id: 'test_dualswords', name: '[測試] 滿等雙劍', slot: 'WEAPON', icon: '⚔️', enhancementLevel: 0, weaponType: 'DUAL_SWORDS', requirements: { int: 5 }, effects: {}, combatEffects: { atk: 12, evade: 5 } },
          { uuid: 'test_wpn_st_' + Date.now(), id: 'test_staff', name: '[測試] 滿等法杖', slot: 'WEAPON', icon: '🪄', enhancementLevel: 0, weaponType: 'STAFF', requirements: { int: 5 }, effects: {}, combatEffects: { atk: 5, hit: 10 } },
          { uuid: 'test_wpn_sc_' + Date.now(), id: 'test_scythe', name: '[測試] 滿等戰鐮', slot: 'WEAPON', icon: '🪓', enhancementLevel: 0, weaponType: 'SCYTHE', requirements: { str: 3, int: 3 }, effects: {}, combatEffects: { atk: 18 } }
        ];
        testWeapons.forEach(w => GameState.myTerritory.addEquipmentToWarehouse(w as any));
        ToastManager.show(`✨ 已將全套測試轉職武器放入倉庫！`);
    }},
    'advanc': { name: '解鎖滿等轉職', noPrompt: true, setter: () => {
        let count = 0;
        GameState.adventurers.forEach(adv => {
           if (adv.level >= 10 && !adv.isAdvanced) {
               adv.isAdvanced = true;
               count++;
           }
        });
        ToastManager.show(`✨ 已為 ${count} 名滿等傭兵解鎖轉職狀態！`);
    }}
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    const key = e.key.toLowerCase();
    // 僅快取 26 個英文字母，最大長度限制為 10
    if (/^[a-z]$/.test(key)) {
      cheatSequence.push(key);
      if (cheatSequence.length > 10) {
        cheatSequence.shift();
      }
      
      const currentStr = cheatSequence.join('');
      for (const code in CHEAT_MAP) {
        if (currentStr.endsWith(code)) {
          cheatSequence = []; // 觸發後清空
          const target = CHEAT_MAP[code];
          
          if (target.noPrompt) {
            target.setter(0);
            UIManager.updateUI();
            console.log(`🧙‍♂️ [密技] 領主觸發了無參數密技【${target.name}】。`);
            break;
          }

          const input = prompt(`🧙‍♂️ 偵測到領主祕密指令【${code}】。\n請輸入想要修改或設定的【${target.name}】數值：`);
          if (input !== null) {
            const val = parseInt(input.trim(), 10);
            if (!isNaN(val)) {
              target.setter(val);
              UIManager.updateUI();
              
              // 如果此時玩家在自宅內部升級面板，則重新渲染升級按鈕狀態
              const basePanel = document.getElementById('panel-enter-base');
              if (basePanel && basePanel.style.display !== 'none') {
                renderBaseBuildings();
              }
              
              ToastManager.show(`✨ 領地【${target.name}】已變更為 ${val}！`);
              console.log(`🧙‍♂️ [密技] 領主手動將【${target.name}】修改為 ${val}。`);
            } else {
              ToastManager.show('⚠️ 請輸入正確的整數！');
            }
          }
          break;
        }
      }
    }
  });
}
