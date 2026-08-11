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
  
  public show() {
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
