import { chromium } from 'playwright';

async function verifyAlignment() {
  console.log('🚀 Starting VFX Alignment Verification with Playwright...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });

  await page.goto('http://localhost:5174/Medieval/tools/vfx-studio.html');
  await page.waitForSelector('#timeline-mount-point');

  // 1. 測量初始單圖層狀態
  const initial = await page.evaluate(() => {
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
      vpHeight: vpRect.height,
      tlHeight: tl.clientHeight,
      canvasW: canvas.width,
      canvasH: canvas.height,
      canvasClientH: canvas.clientHeight,
      cWorldY: cWorld.y,
      tWorldY: tWorld.y
    };
  });

  console.log('📊 Initial State (1 Layer):', initial);

  // 2. 新增 7 個圖層 (總共 8 圖層)
  for (let i = 0; i < 7; i++) {
    await page.click('#btn-add-layer');
  }
  await page.waitForTimeout(400);

  // 3. 點擊第 2 個圖層的 Clip 展開次級抽屜
  const layerClips = await page.$$('.tl-layer-clip');
  if (layerClips.length > 1) {
    await layerClips[1].click();
    await page.waitForTimeout(300);
  }

  // 4. 測量多圖層後的狀態
  const expanded = await page.evaluate(() => {
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

    // 驗證相機視野範圍與中心
    const fovInRad = (fxEngine.camera.fov * Math.PI) / 180;
    const expectedZ = vpRect.height / (2 * Math.tan(fovInRad / 2));
    const actualZ = fxEngine.camera.position.z;

    return {
      vpHeight: vpRect.height,
      tlHeight: tl.clientHeight,
      canvasW: canvas.width,
      canvasH: canvas.height,
      canvasClientH: canvas.clientHeight,
      cWorldY: cWorld.y,
      tWorldY: tWorld.y,
      expectedCameraZ: expectedZ,
      actualCameraZ: actualZ,
      zDiff: Math.abs(expectedZ - actualZ)
    };
  });

  console.log('📊 Expanded State (8 Layers + Drawer):', expanded);

  // 5. 截圖存證
  const screenshotPath = 'C:/Users/User/.gemini/antigravity-ide/brain/8d990b1c-80be-4584-9aa2-7cf6090c2726/vfx_aligned_8layers.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved to ${screenshotPath}`);

  await browser.close();

  // 斷言檢驗
  let passed = true;
  if (expanded.tlHeight > 335) {
    console.error(`❌ Timeline height (${expanded.tlHeight}px) exceeds max-height 330px limit!`);
    passed = false;
  } else {
    console.log(`✅ Timeline height protected: ${expanded.tlHeight}px <= 330px`);
  }

  if (Math.abs(expanded.canvasClientH - expanded.vpHeight) > 2) {
    console.error(`❌ Canvas client height (${expanded.canvasClientH}) does not match viewport height (${expanded.vpHeight})!`);
    passed = false;
  } else {
    console.log(`✅ Canvas client height matched: ${expanded.canvasClientH}px === ${expanded.vpHeight}px`);
  }

  if (Math.abs(expanded.canvasH - expanded.vpHeight) > 2) {
    console.error(`❌ Canvas buffer resolution (${expanded.canvasH}) does not match viewport height (${expanded.vpHeight})!`);
    passed = false;
  } else {
    console.log(`✅ Canvas buffer resolution matched: ${expanded.canvasH}px === ${expanded.vpHeight}px`);
  }

  if (expanded.zDiff > 1.0) {
    console.error(`❌ Camera Z position (${expanded.actualCameraZ}) out of sync with viewport (${expanded.expectedCameraZ})!`);
    passed = false;
  } else {
    console.log(`✅ Camera projection matrix perfectly aligned (diff: ${expanded.zDiff.toFixed(3)})`);
  }

  if (Math.abs(expanded.cWorldY) > 2 || Math.abs(expanded.tWorldY) > 2) {
    console.error(`❌ Card world Y coordinate drifted! caster: ${expanded.cWorldY}, target: ${expanded.tWorldY}`);
    passed = false;
  } else {
    console.log(`✅ Card center perfectly aligns with 3D world origin Y=0 (caster: ${expanded.cWorldY}, target: ${expanded.tWorldY})`);
  }

  if (!passed) {
    process.exit(1);
  }
  console.log('🎉 ALL ALIGNMENT AUDITS PASSED 100%!');
}

verifyAlignment().catch((err) => {
  console.error('Fatal error in verifyAlignment:', err);
  process.exit(1);
});
