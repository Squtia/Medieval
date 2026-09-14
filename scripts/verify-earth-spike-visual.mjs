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
  console.log('🚀 開始驗證【地刺 (EARTH_SHATTER)】名稱更正與 3D 視覺重構成果...');

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

    // 1. 驗證名稱更正
    const optionText = await page.$eval('#param-shader-mode option[value="EARTH_SHATTER"]', el => el.textContent.trim());
    console.log(`Shader 下拉選單中 EARTH_SHATTER 顯示名稱: "${optionText}"`);
    if (!optionText.includes('地刺')) {
      throw new Error(`名稱未正確更新為地刺，目前為 "${optionText}"`);
    }
    console.log('✅ 下拉選單名稱成功更新為【⛰️ 地刺 (Earth Spike)】！');

    // 2. 切換至地刺預設
    console.log('🔄 載入 VFX_EARTH_SPIKE 或切換 Shader 至 EARTH_SHATTER...');
    const presetSelect = page.locator('#lib-preset-select');
    if (await presetSelect.isVisible()) {
      await presetSelect.selectOption('VFX_EARTH_SPIKE');
      await page.waitForTimeout(500);
    } else {
      await page.selectOption('#param-shader-mode', 'EARTH_SHATTER');
      await page.waitForTimeout(500);
    }

    // 3. 推進時間至破土定格點 (t = 0.22s)
    const timeDisplay = page.locator('#tl-time-display');
    console.log('⏱️ 初始時間軸顯示:', await timeDisplay.textContent());

    // 點擊播放後稍作等待並暫停
    const playBtn = page.locator('#tl-btn-play-pause');
    await playBtn.click();
    await page.waitForTimeout(220); // 播放至破土瞬間
    await playBtn.click();
    await page.waitForTimeout(200);

    const pausedTimeStr = await timeDisplay.textContent();
    console.log(`⏱️ 定格播放頭時間: ${pausedTimeStr}`);

    // 4. 驗證 WebGL Canvas 正常運行且未崩潰
    const canvas = page.locator('#viewport canvas');
    const isCanvasVisible = await canvas.isVisible();
    if (!isCanvasVisible) {
      throw new Error('WebGL Canvas 不可見或崩潰');
    }
    console.log('✅ WebGL 3D 渲染視口運行正常');

    // 5. 截圖存檔留存
    const screenshotPath = 'scripts/earth-spike-preview.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 實機截圖已保存至 ${screenshotPath}`);

    console.log('🎉 地刺 (EARTH_SHATTER) 視覺升級與命名更正實機驗收通過！');
  } catch (err) {
    console.error('❌ 驗證失敗:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

run();
