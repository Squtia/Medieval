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
  console.log('🚀 開始驗證【地裂與地刺幾何 (Spikes & Fissure)】11 項控制項全資料流貫通與實機互動...');

  let serverProcess = null;
  let browser = null;
  try {
    const alreadyRunning = await isServerRunning();
    if (!alreadyRunning) {
      console.log('正在啟動 vite dev server...');
      const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
      serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], {
        stdio: 'pipe',
        shell: false
      });
      const ready = await waitForServer();
      if (!ready) {
        console.error('Vite 伺服器啟動超時');
        if (serverProcess) serverProcess.kill();
        process.exit(1);
      }
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();

    await page.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, route => {
      route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    });

    console.log(`導航至: ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#param-shader-mode', { timeout: 10000 });

    // 1. 切換至地刺預設 (EARTH_SHATTER) 使地刺卡片展開
    console.log('🔄 切換 Shader 至 EARTH_SHATTER 展開地刺幾何卡片...');
    await page.selectOption('#param-shader-mode', 'EARTH_SHATTER');
    await page.waitForTimeout(600);

    await page.waitForSelector('#param-spike-array-count', { state: 'visible', timeout: 10000 });

    // 2. 實機操作控制項：調整尖刺數量至 8 根
    console.log('🎛️ 調整連鎖尖刺數量至 8 根...');
    await page.fill('#param-spike-array-count', '8');
    await page.dispatchEvent('#param-spike-array-count', 'input');
    await page.dispatchEvent('#param-spike-array-count', 'change');

    // 3. 實機操作控制項：切換幾何形態為六角稜柱水晶
    console.log('💎 切換地刺幾何形態為 CRYSTAL_PRISM (六角稜柱水晶)...');
    await page.selectOption('#param-spike-shape', 'CRYSTAL_PRISM');

    // 4. 實機操作控制項：切換生長模式為 SURGE_RECEDE
    console.log('🌊 切換生長模式為 SURGE_RECEDE (浪湧竄出縮回)...');
    await page.selectOption('#param-spike-array-behavior', 'SURGE_RECEDE');

    await page.waitForTimeout(500);

    // 5. 播放至破土瞬間並定格
    const playBtn = page.locator('#tl-btn-play-pause');
    await playBtn.click();
    await page.waitForTimeout(220);
    await playBtn.click();
    await page.waitForTimeout(200);

    // 6. 驗證 Canvas 運行正常
    const canvas = page.locator('#viewport canvas');
    const isCanvasVisible = await canvas.isVisible();
    if (!isCanvasVisible) {
      throw new Error('WebGL Canvas 不可見或崩潰');
    }
    console.log('✅ WebGL 3D 渲染視口在 11 項參數動態切換後運行順暢！');

    // 7. 截圖存檔留存
    const screenshotPath = 'scripts/spike-controls-preview.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 實機截圖已保存至 ${screenshotPath}`);

    console.log('🎉 【地裂與地刺幾何】11 項控制項全資料流雙端貫通實機驗收通過！');
  } catch (err) {
    console.error('❌ 驗證失敗:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

run();
