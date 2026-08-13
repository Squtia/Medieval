import { GameState } from '../core/GameState';
import { GameLog } from './GameLog';
import { UIManager } from './UIManager';
import { processInvasionCombat } from '../core/GameLoop';
import { startGameLoop } from '../core/GameLoop';

export class ExtortionModalController {
  private static instance: ExtortionModalController;
  
  private overlay: HTMLElement | null = null;
  private btnPay: HTMLButtonElement | null = null;
  private btnFight: HTMLButtonElement | null = null;

  private constructor() {
    this.overlay = document.getElementById('extortion-modal');
    this.btnPay = document.getElementById('btn-extortion-pay') as HTMLButtonElement | null;
    this.btnFight = document.getElementById('btn-extortion-fight') as HTMLButtonElement | null;
    this.bindEvents();
  }

  public static getInstance(): ExtortionModalController {
    if (!ExtortionModalController.instance) {
      ExtortionModalController.instance = new ExtortionModalController();
    }
    return ExtortionModalController.instance;
  }

  private bindEvents() {
    if (this.btnPay) {
      this.btnPay.addEventListener('click', () => this.handlePay());
    }
    if (this.btnFight) {
      this.btnFight.addEventListener('click', () => this.handleFight());
    }
  }

  public show() {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
  }

  public hide() {
    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }
    startGameLoop((window as any).updateUICallback);
  }

  private handlePay() {
    const territory = GameState.myTerritory;
    if (!territory) return;

    // 扣除 20% 所有資源
    const lostGold = Math.floor(territory.gold * 0.2);
    const lostFood = Math.floor(territory.food * 0.2);
    const lostWood = Math.floor(territory.wood * 0.2);
    const lostStone = Math.floor(territory.stone * 0.2);
    const lostIron = Math.floor(territory.iron * 0.2);

    territory.gold -= lostGold;
    territory.food -= lostFood;
    territory.wood -= lostWood;
    territory.stone -= lostStone;
    territory.iron -= lostIron;
    
    // 進入 7 天保護期
    territory.extortionCooldown = 7;

    GameLog.add(`💰 支付了保護費：失去了 ${lostGold} 金幣, ${lostFood} 糧食, ${lostWood} 木材, ${lostStone} 石材, ${lostIron} 鐵礦。盜匪承諾未來 7 天內不會再來找麻煩。`, 'warning');
    
    UIManager.updateUI();
    this.hide();
    startGameLoop((window as any).updateUICallback);
  }

  private handleFight() {
    this.hide();
    // 呼叫防禦戰鬥邏輯 (沿用原有的自動結算)
    processInvasionCombat();
    UIManager.updateUI();
    startGameLoop((window as any).updateUICallback);
  }
}
