import Phaser from 'phaser';
import { MapScene } from './MapScene';

export let phaserGame: Phaser.Game | null = null;

export function initPhaserMap(parentId: string) {
  if (phaserGame) return;
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: '100%',
    height: '100%',
    parent: parentId,
    transparent: true,
    banner: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER
    },
    scene: [MapScene]
  };
  phaserGame = new Phaser.Game(config);
}

export function renderMap() {
  if (phaserGame) {
    const scene = phaserGame.scene.getScene('MapScene') as MapScene;
    if (scene && scene.sys.isActive()) {
      scene.rebuildNodes();
      scene.updateRoutesAndCaravans();
    }
  }
}

export function renderTradeRoutes() {
  if (phaserGame) {
    const scene = phaserGame.scene.getScene('MapScene') as MapScene;
    if (scene && scene.sys.isActive()) {
      scene.updateRoutesAndCaravans();
    }
  }
}
