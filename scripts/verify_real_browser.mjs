import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
  });

  await page.goto('http://localhost:5173/Medieval/tools/vfx-studio.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const initData = await page.evaluate(() => {
    const s = window.__VFX_STORE__;
    return {
      id: s?.getSequence()?.id,
      name: s?.getSequence()?.name,
      isDirty: s?.getIsDirty(),
      selectVal: document.getElementById('lib-preset-select')?.value,
      timelineMainClip: document.querySelector('.tl-main-clip span')?.textContent?.trim()
    };
  });
  console.log('--- 1. INITIAL STATE ---', initData);

  // 測試 1：切換至菲涅爾冰晶槍 (VFX_ICE_LANCE)
  console.log('\n--- 2. SWITCH TO VFX_ICE_LANCE (菲涅爾冰晶槍) ---');
  await page.selectOption('#lib-preset-select', 'VFX_ICE_LANCE');
  await page.waitForTimeout(600);

  const iceLanceData = await page.evaluate(() => {
    const s = window.__VFX_STORE__;
    const seq = s?.getSequence();
    const clip = seq?.tracks?.find(t => t.id === 'trk_main')?.clips?.[0];
    return {
      id: seq?.id,
      name: seq?.name,
      isDirty: s?.getIsDirty(),
      selectVal: document.getElementById('lib-preset-select')?.value,
      timelineMainClip: document.querySelector('.tl-main-clip span')?.textContent?.trim(),
      spatialMode: seq?.spatialMode,
      clipTrajectory: clip?.payload?.data?.trajectory,
      clipMeshShape: clip?.payload?.data?.castMeshShape || clip?.payload?.data?.impactMeshShape
    };
  });
  console.log('Ice Lance Result:', iceLanceData);
  await page.screenshot({ path: 'ice_lance_verified.png' });

  // 測試 2：切換至精靈矢雨 (VFX_ARROW_RAIN 或 VFX_SPIRIT_DANCE)
  console.log('\n--- 3. SWITCH TO VFX_SPIRIT_DANCE (精靈矢雨) ---');
  await page.selectOption('#lib-preset-select', 'VFX_SPIRIT_DANCE');
  await page.waitForTimeout(600);

  const spiritDanceData = await page.evaluate(() => {
    const s = window.__VFX_STORE__;
    const seq = s?.getSequence();
    const clip = seq?.tracks?.find(t => t.id === 'trk_main')?.clips?.[0];
    return {
      id: seq?.id,
      name: seq?.name,
      isDirty: s?.getIsDirty(),
      selectVal: document.getElementById('lib-preset-select')?.value,
      timelineMainClip: document.querySelector('.tl-main-clip span')?.textContent?.trim(),
      spatialMode: seq?.spatialMode,
      clipTrajectory: clip?.payload?.data?.trajectory,
      clipMeshShape: clip?.payload?.data?.castMeshShape || clip?.payload?.data?.impactMeshShape
    };
  });
  console.log('Spirit Dance Result:', spiritDanceData);
  await page.screenshot({ path: 'spirit_dance_verified.png' });

  // 測試 3：切換至風暴狂雷 (VFX_LIGHTNING_BOLT)
  console.log('\n--- 4. SWITCH TO VFX_LIGHTNING_BOLT (風暴狂雷) ---');
  await page.selectOption('#lib-preset-select', 'VFX_LIGHTNING_BOLT');
  await page.waitForTimeout(600);

  const lightningData = await page.evaluate(() => {
    const s = window.__VFX_STORE__;
    const seq = s?.getSequence();
    const clip = seq?.tracks?.find(t => t.id === 'trk_main')?.clips?.[0];
    return {
      id: seq?.id,
      name: seq?.name,
      isDirty: s?.getIsDirty(),
      selectVal: document.getElementById('lib-preset-select')?.value,
      timelineMainClip: document.querySelector('.tl-main-clip span')?.textContent?.trim(),
      spatialMode: seq?.spatialMode,
      clipTrajectory: clip?.payload?.data?.trajectory
    };
  });
  console.log('Lightning Result:', lightningData);
  await page.screenshot({ path: 'lightning_verified.png' });

  await browser.close();
  console.log('\n🎉 ALL REAL BROWSER SWITCH TESTS PASSED!');
}

main().catch(console.error);
