import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/combat-studio.html`;

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

async function runVerification() {
  console.log('🚀 開始 Phase 6 戰鬥演播室與 Debug Overlay 真實瀏覽器驗證...');

  let serverProcess = null;
  let browser = null;

  try {
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

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

  const consoleLogs = [];
  const notFoundUrls = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(`[BROWSER ERROR] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });
  page.on('response', res => {
    if (res.status() === 404) {
      notFoundUrls.push(`[404 NOT FOUND] ${res.url()}`);
    }
  });

  // 1. 導覽至戰鬥工房
  await page.goto('http://localhost:5173/Medieval/tools/combat-studio.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('#btn-vfx-toggle', { timeout: 15000 });
  console.log('戰鬥演播室模板載入完成！');

  // 2. 檢查除錯覆蓋層按鈕
  const debugBtn = await page.waitForSelector('#btn-vfx-debug-toggle', { timeout: 5000 });
  const initialText = await debugBtn.innerText();
  console.log('初始覆蓋層按鈕文字:', initialText);

  // 點擊開啟覆蓋層
  await debugBtn.click();
  const toggledText = await debugBtn.innerText();
  console.log('點擊後覆蓋層按鈕文字:', toggledText);
  if (!toggledText.includes('開')) {
    throw new Error('覆蓋層按鈕切換文字不如預期！');
  }

  // 3. 點擊「開始單場戰鬥」 (btn-run-combat)
  const startMatchBtn = await page.waitForSelector('#btn-run-combat', { timeout: 5000 });
  await startMatchBtn.click();
  console.log('已點擊「開始單場戰鬥」，等待戰鬥行動與特效播放...');

  // 等待戰鬥行動觸發，檢查 #vfx-debug-overlay 是否產生
  let overlayFound = false;
  let sampleOverlayText = '';
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(300);
    const overlay = await page.$('#vfx-debug-overlay');
    if (overlay) {
      const isVisible = await overlay.isVisible();
      const text = await overlay.innerText();
      if (isVisible && (text.includes('ACTION') || text.includes('Actor'))) {
        overlayFound = true;
        sampleOverlayText = text;
        console.log(`[驗證成功] 捕捉到 Debug Overlay 即時動態 (第 ${i * 300}ms):\n`, text.replace(/\n+/g, ' | '));
        break;
      }
    }
  }

  if (!overlayFound) {
    throw new Error('戰鬥期間未能偵測到 #vfx-debug-overlay 動態呈現！');
  }

  // 截圖存檔
  const screenshotDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const shotPath = path.join(screenshotDir, 'combat_studio_debug_overlay.png');
  await page.screenshot({ path: shotPath });
  console.log('📸 已儲存戰鬥演播室動態截圖至:', shotPath);

  // 4. 點擊快速結束 (btn-skip-all) 驗證無殘留
  const skipBtn = await page.$('#btn-skip-all');
  if (skipBtn) {
    await skipBtn.click();
    console.log('已點擊快速結束 (btn-skip-all)');
    await page.waitForTimeout(600);
    const overlay = await page.$('#vfx-debug-overlay');
    if (overlay) {
      const text = await overlay.innerText();
      console.log('快速結束後 Debug Overlay 狀態:', text.trim());
      if (text.includes('FALLBACK')) {
        throw new Error(`[UNEXPECTED FALLBACK] 快速結束後 Debug Overlay 殘留非預期 FALLBACK 狀態: "${text.trim()}"`);
      }
    }
  }

  // 5. 導覽至特效工房驗證載入
  console.log('導覽至特效工房驗證...');
  await page.goto('http://localhost:5173/Medieval/tools/vfx-studio.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('#library-mount-point', { timeout: 15000 });
  console.log('特效工房模板載入完成！');

  if (notFoundUrls.length > 0) {
    console.error('❌ 頁面載入出現 404 資源:', notFoundUrls);
    throw new Error(`瀏覽器驗收失敗，發現 ${notFoundUrls.length} 個 404 資源請求！`);
  }

  console.log('瀏覽器主控台錯誤數量:', consoleLogs.length);
  if (consoleLogs.length > 0) {
    console.error('❌ 瀏覽器偵測到錯誤日誌:', consoleLogs);
    throw new Error(`瀏覽器驗收失敗，發現 ${consoleLogs.length} 個主控台或頁面錯誤！`);
  }

  } finally {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

runVerification().catch(err => {
  console.error('❌ 驗收失敗:', err);
  process.exit(1);
});
