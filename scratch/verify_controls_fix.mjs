import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import http from 'http';
import { spawn } from 'child_process';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;

async function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(TEST_URL, (res) => resolve(res.statusCode === 200 || res.statusCode === 304));
    req.on('error', () => resolve(false));
    req.end();
  });
}

console.log('🚀 啟動無頭瀏覽器驗收特效工房控制項貫通情況...');

let serverProcess = null;
if (!await isServerRunning()) {
  const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
  serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], { stdio: 'pipe' });
  let ready = false;
  for (let i = 0; i < 30; i++) {
    if (await isServerRunning()) { ready = true; break; }
    await new Promise(r => setTimeout(r, 400));
  }
  if (!ready) { console.error('Failed to start server'); process.exit(1); }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 攔截字型請求以防離線逾時
await page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());

await page.goto(TEST_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

let passed = true;

// 1. 驗證斬擊走向連動 (Slash Trajectory Linkage)
console.log('\n--- 1. 驗收斬擊走向選單與角度連動 ---');
const trajSelect = await page.$('#param-slash-traj');
if (!trajSelect) {
  console.error('❌ 找不到 #param-slash-traj');
  passed = false;
} else {
  // 切換為 UPPER_CUT (反手挑斬 / 升龍)
  await trajSelect.selectOption('UPPER_CUT');
  await page.waitForTimeout(200);

  const angleVal = await page.$eval('#val-slash-angle', el => el.textContent);
  const angleSlider = await page.$eval('#param-slash-angle', el => el.value);
  const arcSpanVal = await page.$eval('#val-slash-arc-span', el => el.textContent);
  const reverseSelect = await page.$eval('#param-slash-reverse', el => el.value);

  console.log(`UPPER_CUT 連動結果: angleLabel=${angleVal}, slider=${angleSlider}, arcSpan=${arcSpanVal}, reverse=${reverseSelect}`);

  if (angleSlider === '135' && reverseSelect === 'true') {
    console.log('✅ [PASS] 斬擊走向成功連動起始角 135° 與逆向反挑方向！');
  } else {
    console.error('❌ [FAIL] 斬擊走向未正確連動角度！');
    passed = false;
  }

  // 切換為 VERTICAL_DOWN (天頂垂直力劈)
  await trajSelect.selectOption('VERTICAL_DOWN');
  await page.waitForTimeout(200);
  const vertAngleSlider = await page.$eval('#param-slash-angle', el => el.value);
  const vertArcSpan = await page.$eval('#param-slash-arc-span', el => el.value);
  console.log(`VERTICAL_DOWN 連動結果: slider=${vertAngleSlider}, arcSpan=${vertArcSpan}`);
  if (vertAngleSlider === '90' && vertArcSpan === '130') {
    console.log('✅ [PASS] 斬擊走向成功連動天頂垂直力劈 90°！');
  } else {
    console.error('❌ [FAIL] 垂直力劈未連動！');
    passed = false;
  }
}

// 2. 驗收舞台中央浮動 HUD 即時數據連動
console.log('\n--- 2. 驗收舞台中央浮動 HUD 即時數據連動 ---');
// 在右側修改受擊震動與擊退
await page.evaluate(() => {
  const store = window.__VFX_STORE__;
  const current = store.getPreset();
  store.updateConfig({
    salvoCount: 5,
    impact: {
      ...current.impact,
      hitStopTime: 90,
      targetPunchScale: 0.75,
      shakeIntensity: 25,
      knockbackDistance: 45
    }
  }, false);
});
await page.waitForTimeout(200);

const hudAfter = await page.evaluate(() => {
  return {
    salvo: document.getElementById('hud-salvo')?.textContent,
    hitStop: document.getElementById('hud-hit-stop')?.textContent,
    punch: document.getElementById('hud-punch')?.textContent,
    shake: document.getElementById('hud-shake')?.textContent,
    knockback: document.getElementById('hud-knockback')?.textContent,
  };
});
console.log('修改後 HUD 數據:', hudAfter);

if (
  hudAfter.salvo === '5發' &&
  hudAfter.hitStop === '90ms' &&
  hudAfter.punch === '0.75x' &&
  hudAfter.shake === '25px' &&
  hudAfter.knockback === '45px'
) {
  console.log('✅ [PASS] 舞台浮動 HUD 100% 即時反映真實打擊感數據，徹底消除死資料！');
} else {
  console.error('❌ [FAIL] HUD 數據未正確連動！');
  passed = false;
}

// 3. 驗收未發布黃色指示燈 (#vfx-dirty-indicator)
console.log('\n--- 3. 驗收頂部工具列未發布指示燈 ---');
// 先重置為乾淨狀態 (無修改)
await page.evaluate(() => {
  const store = window.__VFX_STORE__;
  store.setDirty(false);
});
await page.waitForTimeout(100);

const cleanDisplay = await page.$eval('#vfx-dirty-indicator', el => window.getComputedStyle(el).display);
console.log('乾淨未修改時指示燈 display:', cleanDisplay);

// 觸發 dirty 狀態 (有修改)
await page.evaluate(() => {
  const store = window.__VFX_STORE__;
  store.setDirty(true);
});
await page.waitForTimeout(100);

const dirtyDisplay = await page.$eval('#vfx-dirty-indicator', el => window.getComputedStyle(el).display);
console.log('有修改時指示燈 display:', dirtyDisplay);

if (cleanDisplay === 'none' && dirtyDisplay !== 'none') {
  console.log('✅ [PASS] #vfx-dirty-indicator 成功與 isDirty 狀態雙向連動 (修改亮燈/發布隱藏)！');
} else {
  console.error('❌ [FAIL] 未發布指示燈未正確連動！');
  passed = false;
}

// 4. 驗收 3D 渲染端彈幕散射偏角與受擊散佈半徑之幾何計算
console.log('\n--- 4. 驗收 3D 渲染端彈幕散射偏角與受擊散佈半徑 ---');
const multiArcTest = await page.evaluate(() => {
  const fxEngine = window.__FX_ENGINE__;
  const store = window.__VFX_STORE__;
  
  // 設置彈道為 ARC_MULTI，配置散射偏角 30° 與受擊散佈 60px
  store.updateConfig({
    trajectory: 'ARC_MULTI',
    spatialMode: 'ARC_MULTI',
    shaderMode: 'ENERGY_BEAM',
    salvoCount: 3,
    salvoSpreadAngle: 30,
    salvoSpreadRadius: 60
  }, false);

  const currentPreset = store.getPreset();
  fxEngine.renderFrameAt(currentPreset, 0.2);

  const trackGroup = fxEngine.studioTrackGroups[0];
  const cache = trackGroup ? trackGroup.__cache : null;
  const arcs = cache ? cache.multiArcs : null;
  
  if (!arcs || arcs.length < 3) return null;
  return {
    arc0SpreadY: arcs[0].spreadY,
    arc1SpreadY: arcs[1].spreadY,
    arc2SpreadY: arcs[2].spreadY,
    arc0TargetOffsetX: arcs[0].targetOffsetX,
    arc0TargetOffsetY: arcs[0].targetOffsetY,
  };
});
console.log('多彈道幾何物理參數:', multiArcTest);

if (multiArcTest && Math.abs(multiArcTest.arc0SpreadY) > 55 && multiArcTest.arc0TargetOffsetX !== 0) {
  console.log('✅ [PASS] 彈幕散射偏角 (salvoSpreadAngle) 與受擊散佈 (salvoSpreadRadius) 成功作用於 3D 幾何頂點！');
} else {
  console.error('❌ [FAIL] 彈幕幾何未套用散射偏角或散佈半徑！');
  passed = false;
}

await browser.close();
if (serverProcess) {
  serverProcess.kill();
}

if (passed) {
  console.log('\n🎉 所有排查項目 (1 ~ 3) 實機瀏覽器與 3D 幾何驗收 100% 全部通過！');
  process.exit(0);
} else {
  console.error('\n❌ 驗收存在失敗項！');
  process.exit(1);
}
