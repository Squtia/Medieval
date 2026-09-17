import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173/Medieval/tools/vfx-studio.html', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(async () => {
      const controller = window.__vfxStudioController;
      const engine = window.__FX_ENGINE__ || window.CombatFXEngine?.getInstance();
      const select = document.querySelector('#lib-preset-select');
      const store = window.__VFX_STORE__;

      // 1. 切換至精靈矢雨
      select.value = 'VFX_SPIRIT_DANCE';
      select.dispatchEvent(new Event('change'));

      // 2. 測試預設值渲染 (glowRadius 預設 75, glowOpacity 預設 0.85)
      controller.renderStudioFrameAt(0.16);

      const tg = engine.studioTrackGroups[0];
      const multiArcContainer = tg.children[0];

      // 取樣第一支箭矢的 glow sprite 與 ring material
      const getGlowAndRingInfo = () => {
        const currentContainer = tg.children[0];
        let glowScale = 0;
        let glowOpacity = 0;
        let ringOpacity = 0;
        let trailOpacity = 0;

        if (currentContainer) {
          for (const ch of currentContainer.children) {
            if (ch.type === 'Group' && !glowScale) {
              for (const sub of ch.children) {
                if (sub.type === 'Sprite') {
                  glowScale = Number(sub.scale.x.toFixed(1));
                  glowOpacity = Number(sub.material.opacity.toFixed(2));
                } else if (sub.type === 'Mesh' && (sub.geometry?.type === 'TorusGeometry')) {
                  ringOpacity = Number(sub.material.opacity.toFixed(2));
                }
              }
            } else if (ch.type === 'Points' && !trailOpacity) {
              trailOpacity = Number(ch.material.opacity.toFixed(2));
            }
          }
        }
        return { glowScale, glowOpacity, ringOpacity, trailOpacity };
      };

      const defaultInfo = getGlowAndRingInfo();

      // 3. 動態調整泛光半徑為 150，光暈透明度為 0.35
      store.updateMainClipData({ glowRadius: 150, glowOpacity: 0.35 });
      controller.renderStudioFrameAt(0.16);
      const updatedInfo = getGlowAndRingInfo();

      // 4. 再動態調整泛光半徑為 40，光暈透明度為 0.95
      store.updateMainClipData({ glowRadius: 40, glowOpacity: 0.95 });
      controller.renderStudioFrameAt(0.16);
      const updatedInfo2 = getGlowAndRingInfo();

      return {
        defaultInfo,
        updatedInfo,
        updatedInfo2
      };
    });

    console.log('GLOW_VERIFY_RESULT:', JSON.stringify(result, null, 2));

    await page.screenshot({ path: 'spirit_dance_glow_verified.png' });
  } finally {
    await browser.close();
  }
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
