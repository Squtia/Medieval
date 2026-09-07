import { chromium } from 'playwright';

async function checkOffset() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5174/Medieval/tools/vfx-studio.html');
  await page.waitForSelector('#timeline-mount-point');

  const before = await page.evaluate(() => {
    const vp = document.getElementById('viewport');
    const caster = document.getElementById('ref-caster');
    const target = document.getElementById('ref-target');
    const canvas = document.getElementById('three-combat-fx-canvas');
    const fxEngine = window.__FX_ENGINE__;

    const vpRect = vp.getBoundingClientRect();
    const cRect = caster.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const canRect = canvas.getBoundingClientRect();

    return {
      viewportHeight: vpRect.height,
      canvasClientHeight: canvas.clientHeight,
      canvasBufferHeight: canvas.height,
      casterY: cRect.top - vpRect.top + cRect.height / 2,
      targetY: tRect.top - vpRect.top + tRect.height / 2,
      cameraZ: fxEngine ? fxEngine.camera.position.z : null
    };
  });

  console.log('Before layers added:', before);

  // 點擊新增 6 個圖層
  for (let i = 0; i < 6; i++) {
    await page.click('#btn-add-layer');
  }
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const vp = document.getElementById('viewport');
    const caster = document.getElementById('ref-caster');
    const target = document.getElementById('ref-target');
    const canvas = document.getElementById('three-combat-fx-canvas');
    const fxEngine = window.__FX_ENGINE__;

    const vpRect = vp.getBoundingClientRect();
    const cRect = caster.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const canRect = canvas.getBoundingClientRect();

    // 取得世界座標
    const cPt = { x: cRect.left - vpRect.left + cRect.width / 2, y: cRect.top - vpRect.top + cRect.height / 2 };
    const tPt = { x: tRect.left - vpRect.left + tRect.width / 2, y: tRect.top - vpRect.top + tRect.height / 2 };
    const cWorld = fxEngine.screenToWorld(cPt);
    const tWorld = fxEngine.screenToWorld(tPt);

    return {
      viewportHeight: vpRect.height,
      canvasClientHeight: canvas.clientHeight,
      canvasBufferHeight: canvas.height,
      casterY: cPt.y,
      targetY: tPt.y,
      cameraZ: fxEngine ? fxEngine.camera.position.z : null,
      cWorld,
      tWorld
    };
  });

  console.log('After layers added:', after);
  await browser.close();
}

checkOffset().catch(console.error);
