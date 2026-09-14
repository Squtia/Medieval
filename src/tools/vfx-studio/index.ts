import { VFXStudioController } from './VFXStudioController';
import { VFXStudioStore } from './VFXStudioStore';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';

/**
 * 🎬 VFX Studio 工房入口中樞
 */
(window as any).__VFX_STORE__ = VFXStudioStore.getInstance();
(window as any).CombatFXEngine = CombatFXEngine;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    (window as any).__vfxStudioController = new VFXStudioController();
  });
} else {
  (window as any).__vfxStudioController = new VFXStudioController();
}

