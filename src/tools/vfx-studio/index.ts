import { VFXStudioController } from './VFXStudioController';

/**
 * 🎬 VFX Studio 工房入口中樞
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new VFXStudioController();
  });
} else {
  new VFXStudioController();
}
