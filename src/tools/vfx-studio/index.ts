import { VFXStudioController } from './VFXStudioController';
import { VFXStudioStore } from './VFXStudioStore';

/**
 * 🎬 VFX Studio 工房入口中樞
 */
(window as any).__VFX_STORE__ = VFXStudioStore.getInstance();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    (window as any).__vfxStudioController = new VFXStudioController();
  });
} else {
  (window as any).__vfxStudioController = new VFXStudioController();
}
