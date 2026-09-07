import { chromium } from 'playwright';

async function verifyExtremeResize() {
  console.log('🚀 Starting Extreme Resize Verification...');
  const browser = await chromium.launch({ headless: true });
  // 使用更矮的視窗：1024 x 600
  const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });

  await page.goto('http://localhost:5174/Medieval/tools/vfx-studio.html');
  await page.waitForSelector('#timeline-mount-point');

  // 新增 9 個圖層
  for (let i = 0; i < 9; i++) {
    await page.click('#btn-add-layer');
  }
  await page.waitForTimeout(400);

  const res = await page.evaluate(() => {
    const vp = document.getElementById('viewport');
    const tl = document.getElementById('timeline-mount-point');
    const canvas = document.getElementById('three-combat-fx-canvas');
    const caster = document.getElementById('ref-caster');
    const target = document.getElementById('ref-target');
    const fxEngine = window.__FX_ENGINE__;

    const vpRect = vp.getBoundingClientRect();
    const cRect = caster.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();

    const cPt = { x: cRect.left - vpRect.left + cRect.width / 2, y: cRect.top - vpRect.top + cRect.height / 2 };
    const tPt = { x: tRect.left - vpRect.left + tRect.width / 2, y: tRect.top - vpRect.top + tRect.height / 2 };

    const cWorld = fxEngine.screenToWorld(cPt);
    const tWorld = fxEngine.screenToWorld(tPt);

    return {
      windowH: window.innerHeight,
      vpHeight: vpRect.height,
      tlHeight: tl.clientHeight,
      canvasClientH: canvas.clientHeight,
      canvasBufferH: canvas.height,
      cWorldY: cWorld.y,
      tWorldY: tWorld.y,
      cameraZ: fxEngine.camera.position.z,
      expectedZ: vpRect.height / (2 * Math.tan((fxEngine.camera.fov * Math.PI / 180) / 2))
    };
  });

  console.log('📊 Extreme Resize Result:', res);

  const screenshotPath = 'C:/Users/User/.gemini/antigravity-ide/brain/8d990b1c-80be-4584-9aa2-7cf6090c2726/vfx_extreme_resize.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();

  if (Math.abs(res.canvasClientH - res.vpHeight) > 1 || Math.abs(res.canvasBufferH - res.vpHeight) > 1) {
    throw new Error(`Mismatch between canvas (${res.canvasClientH}) and viewport (${res.vpHeight})`);
  }
  if (Math.abs(res.cWorldY) > 1 || Math.abs(res.tWorldY) > 1) {
    throw new Error(`Card center drifted from world origin: caster ${res.cWorldY}, target ${res.tWorldY}`);
  }
  if (Math.abs(res.cameraZ - res.expectedZ) > 1) {
    throw new Error(`Camera Z drifted: actual ${res.cameraZ}, expected ${res.expectedZ}`);
  }

  console.log('🎉 EXTREME RESIZE VERIFICATION PASSED 100%!');
}

verifyExtremeResize().catch((err) => {
  console.error(err);
  process.exit(1);
});
