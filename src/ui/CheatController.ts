import { GameState } from '../core/GameState';
import { UIManager } from './UIManager';
import { ToastManager } from './ToastManager';
import { renderBaseBuildings } from './SceneController';

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
  const CHEAT_MAP: { [key: string]: { name: string, setter: (val: number) => void } } = {
    'gold': { name: '金幣', setter: (v) => GameState.myTerritory.gold = v },
    'wood': { name: '木材', setter: (v) => GameState.myTerritory.wood = v },
    'rock': { name: '石材', setter: (v) => GameState.myTerritory.stone = v },
    'iron': { name: '鐵礦', setter: (v) => GameState.myTerritory.iron = v }
  };

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    const key = e.key.toLowerCase();
    // 僅快取 26 個英文字母，最大長度限制為 6
    if (/^[a-z]$/.test(key)) {
      cheatSequence.push(key);
      if (cheatSequence.length > 6) {
        cheatSequence.shift();
      }
      
      const currentStr = cheatSequence.join('');
      for (const code in CHEAT_MAP) {
        if (currentStr.endsWith(code)) {
          cheatSequence = []; // 觸發後清空
          const target = CHEAT_MAP[code];
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
