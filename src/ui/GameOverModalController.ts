import { UIManager } from './UIManager';
import { SaveManager } from '../core/SaveManager';
import { GameState } from '../core/GameState';

export class GameOverModalController {
  private static instance: GameOverModalController | null = null;
  
  private view: HTMLElement;
  private btnLoad: HTMLButtonElement;
  private btnMenu: HTMLButtonElement;
  
  private constructor() {
    this.view = document.getElementById('game-over-view')!;
    this.btnLoad = document.getElementById('btn-gameover-load') as HTMLButtonElement;
    this.btnMenu = document.getElementById('btn-gameover-menu') as HTMLButtonElement;
    
    if (!this.view || !this.btnMenu) {
      console.error('GameOverModalController: HTML elements not found');
      return;
    }
    
    this.btnMenu.addEventListener('click', () => this.handleReturnToMenu());
  }
  
  public static getInstance(): GameOverModalController {
    if (!GameOverModalController.instance) {
      GameOverModalController.instance = new GameOverModalController();
    }
    return GameOverModalController.instance;
  }
  
  public show(reason: 'starvation' | 'bankruptcy' = 'starvation') {
    const descEl = document.getElementById('game-over-desc');
    if (descEl) {
      if (reason === 'bankruptcy') {
        descEl.innerHTML = `長期的負債讓您的信用完全破產，債主查封了領主大廳，您麾下的傭兵也因欠薪而解散離去。<br><br>您的名字最終被歷史遺忘...`;
      } else {
        descEl.innerHTML = `由於長時間的飢荒與貧瘠，您麾下最後一批傭兵也對您失去了信心，在一個無月的夜晚解散離去。<br><br>您獨自留在空無一人的領主大廳，您的名字最終被歷史遺忘...`;
      }
    }

    UIManager.playTransition(() => {
      this.view.classList.add('active');
    });
  }
  
  private handleReturnToMenu() {
    UIManager.playTransition(() => {
      this.view.classList.remove('active');
      UIManager.clearAllUIOverlays();
      
      const mainMenu = document.getElementById('main-menu-view');
      const mapView = document.getElementById('map-view');
      const sceneView = document.getElementById('scene-view');
      
      if (mainMenu) mainMenu.classList.add('active');
      if (mapView) mapView.classList.remove('active');
    });
  }
}
