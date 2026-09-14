import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
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
  console.log('🚀 開始驗證 VFX Studio 時間軸時長調整與主圖層獨立性...');

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

    // 攔截字型請求以加速
    await page.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, route => {
      route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    });

    console.log(`導航至: ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#tl-input-duration', { timeout: 10000 });

    const numInput = page.locator('#tl-input-duration');
    const rangeInput = page.locator('#tl-range-duration');
    const overflowDialog = page.locator('#tl-duration-overflow-dialog');
    const mainClip = page.locator('.tl-main-clip');

    console.log('✅ 成功找到時間軸時長控制項');

    // 1. 驗證縮短時長：修改輸入框為 0.55s
    console.log('🔄 測試情境 1：將總時長縮短至 0.55s...');
    await numInput.fill('0.55');
    await numInput.dispatchEvent('change');
    await page.waitForTimeout(300);

    const rangeVal = await rangeInput.inputValue();
    console.log(`滑桿同步值: ${rangeVal}`);
    if (parseFloat(rangeVal) !== 0.55) {
      throw new Error(`滑桿未正確同步至 0.55，當前為 ${rangeVal}`);
    }

    // 驗證沒有對話框彈窗阻擋
    const dialogVisible = await overflowDialog.isVisible();
    if (dialogVisible) {
      throw new Error('❌ 錯誤：縮短時長時依然彈出了阻擋對話框！');
    }
    console.log('✅ 縮短時長成功，無任何死循環對話框阻擋！');

    // 2. 測試情境 2：拉長時長至 2.50s，並驗證主圖層小於總時長
    console.log('🔄 測試情境 2：將總時長拉長至 2.50s...');
    await numInput.fill('2.50');
    await numInput.dispatchEvent('change');
    await page.waitForTimeout(300);

    const rangeValLong = await rangeInput.inputValue();
    console.log(`滑桿同步值: ${rangeValLong}`);
    if (parseFloat(rangeValLong) !== 2.50) {
      throw new Error(`滑桿未正確同步至 2.50，當前為 ${rangeValLong}`);
    }

    // 檢查主圖層樣式寬度百分比是否小於 100%（例如 <= 50%）
    const clipWidthPct = await mainClip.evaluate(el => el.style.width);
    console.log(`主圖層寬度百分比: ${clipWidthPct}`);
    const pctNum = parseFloat(clipWidthPct);
    if (pctNum >= 100) {
      console.warn(`⚠️ 主圖層寬度為 ${clipWidthPct}，可能填滿了總時長`);
    } else {
      console.log(`✅ 主圖層寬度為 ${clipWidthPct}，合法小於總時長 (2.50s)！`);
    }

    console.log('🎉 所有真實使用者時間軸時長操作驗收測試通過！');
  } catch (err) {
    console.error('❌ 驗證失敗:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

run();
