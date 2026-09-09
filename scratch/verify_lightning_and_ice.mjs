import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());

await page.goto('http://localhost:5173/tools/vfx-studio.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// 1. 切換到 風暴狂雷 (Storm Bolt)
console.log('=== 1. 切換至 風暴狂雷 (Storm Bolt) ===');
await page.selectOption('#lib-preset-select', 'VFX_LIGHTNING_BOLT');
await page.waitForTimeout(400);

// 檢查受擊目標在 DOM 中的位置
const targetRect = await page.$eval('#ref-target', el => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
});
const casterRect = await page.$eval('#ref-caster', el => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
const vpRect = await page.$eval('#viewport', el => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});

console.log('DOM Rects:');
console.log('  Viewport:', vpRect);
console.log('  Caster center in VP:', { x: casterRect.x - vpRect.left, y: casterRect.y - vpRect.top });
console.log('  Target center in VP:', { x: targetRect.x - vpRect.left, y: targetRect.y - vpRect.top });

// 在瀏覽器 console 中檢查 Three.js 內部座標
const lightning3DInfo = await page.evaluate(() => {
  const controller = window.__vfxStudioController;
  const store = window.__VFX_STORE__;
  const preset = store.getPreset();
  const engine = controller.studioAdapter.getFxEngine();
  const trackGroup = engine.studioTrackGroups?.[0];
  const cache = trackGroup?.__cache;
  const ligGroup = cache?.lightningGroup;

  return {
    presetId: preset.id,
    spatialMode: preset.spatialMode,
    trajectory: preset.trajectory,
    trajectoryPath: preset.trajectoryPath,
    trackGroupPos: trackGroup ? { x: trackGroup.position.x, y: trackGroup.position.y } : null,
    lightningGroupVisible: ligGroup?.visible,
    childCount: ligGroup?.children?.length,
    children: ligGroup?.children?.map(c => {
      const wp = new window.THREE.Vector3();
      c.getWorldPosition(wp);
      return { type: c.type, worldPos: { x: wp.x, y: wp.y, z: wp.z } };
    })
  };
});

console.log('\nLightning 3D Info in Page:', JSON.stringify(lightning3DInfo, null, 2));

// 截圖保存
await page.screenshot({ path: 'scratch/lightning_view.png' });
console.log('Saved screenshot to scratch/lightning_view.png');

await browser.close();
