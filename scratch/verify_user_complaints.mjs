import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;

async function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(TEST_URL, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function run() {
  console.log('🔍 驗證使用者投訴之 4 大核心問題...');

  let serverProcess = null;
  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    console.log('Starting vite dev server...');
    const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
    serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], {
      stdio: 'pipe',
      shell: false
    });
    const ready = await waitForServer();
    if (!ready) {
      console.error('Failed to start vite server');
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(TEST_URL, { waitUntil: 'networkidle' });
  console.log('✅ Page Loaded:', await page.title());

  // 1. 檢查幽靈卡片是否已徹底清除
  const ghostText = await page.evaluate(() => {
    return document.body.innerText.includes('複合多圖層積木');
  });
  console.log(`1. 幽靈卡片「複合多圖層積木」殘留: ${ghostText}`);

  // 2. 切換為投射物特效 (如 VFX_FIREBALL)，檢查彈幕卡片是否展開
  await page.evaluate(() => {
    const sel = document.getElementById('lib-preset-select');
    if (sel) {
      sel.value = 'VFX_FIREBALL';
      sel.dispatchEvent(new Event('change'));
    }
  });
  await new Promise(r => setTimeout(r, 500));

  const salvoVisible = await page.evaluate(() => {
    const card = document.querySelector('.card-salvo-section');
    return card ? window.getComputedStyle(card).display : 'NOT_FOUND';
  });
  console.log(`2. 投射物特效 (VFX_FIREBALL) 彈幕卡片 display: ${salvoVisible}`);

  // 3. 檢查 Cue 檢查器在初始時是否常駐展開
  const cueCardVisible = await page.evaluate(() => {
    const card = document.getElementById('card-cue-inspector');
    return card ? window.getComputedStyle(card).display : 'NOT_FOUND';
  });
  const cueTabsCount = await page.evaluate(() => {
    const tabs = document.querySelectorAll('#cue-selector-tabs button');
    return tabs.length;
  });
  console.log(`3. Cue 卡片 display: ${cueCardVisible}, 頂部 Cue 標籤按鈕數量: ${cueTabsCount}`);

  // 4. 點擊 Cue 標籤，確認其他所有面板（打擊感、施法動作、幾何）仍然可見！
  const panelsState = await page.evaluate(() => {
    // 點擊第一個 Cue 標籤
    const firstTab = document.querySelector('#cue-selector-tabs button');
    if (firstTab) firstTab.click();

    const salvo = document.querySelector('.card-salvo-section');
    const caster = document.querySelector('.card-caster-motion');
    const impact = document.querySelector('.card-impact-section');
    const cue = document.getElementById('card-cue-inspector');

    return {
      salvoDisplay: salvo ? window.getComputedStyle(salvo).display : 'none',
      casterDisplay: caster ? window.getComputedStyle(caster).display : 'none',
      impactDisplay: impact ? window.getComputedStyle(impact).display : 'none',
      cueDisplay: cue ? window.getComputedStyle(cue).display : 'none'
    };
  });
  console.log('4. 選中 Cue 點後各卡片可見性狀態:', panelsState);

  await browser.close();
  if (serverProcess) serverProcess.kill();

  const success = (
    !ghostText &&
    salvoVisible === 'block' &&
    cueCardVisible === 'block' &&
    panelsState.casterDisplay === 'block' &&
    panelsState.impactDisplay === 'block' &&
    panelsState.salvoDisplay === 'block'
  );

  if (success) {
    console.log('🎉 所有使用者投訴之 UI 瑕疵在真實瀏覽器中完全修復，無任何遮蔽或死鎖！');
  } else {
    console.error('❌ 仍有異常！');
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
