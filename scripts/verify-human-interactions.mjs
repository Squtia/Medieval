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
  console.log('🧪 開始進行真實人類視角交互驗證 (Human-Centric Interaction Verification)...');

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
    const consoleErrors = [];
    const notFoundUrls = [];

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[BROWSER ERROR] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      consoleErrors.push(`[PAGE ERROR] ${err.message}`);
    });
    page.on('response', res => {
      if (res.status() === 404) notFoundUrls.push(`[404 NOT FOUND] ${res.url()}`);
    });

    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

  // 1. 測試主圖層 🔒 鎖頭按鈕點擊交互
  console.log('\n👉 1. 測試主圖層 🔒 鎖頭按鈕點擊...');
  const lockBtn = await page.$('.tl-lock-btn[data-track="main"]');
  if (!lockBtn) throw new Error('找不到主圖層鎖頭按鈕 .tl-lock-btn[data-track="main"]');

  const initialLockText = (await lockBtn.textContent())?.trim();
  console.log('  初始鎖定狀態:', initialLockText);

  // 點擊切換
  await lockBtn.click();
  await page.waitForTimeout(300);
  const afterClick1Text = (await (await page.$('.tl-lock-btn[data-track="main"]'))?.textContent())?.trim();
  console.log('  點擊一次後狀態:', afterClick1Text);

  if (afterClick1Text === initialLockText) {
    throw new Error(`❌ 鎖頭按鈕點擊無效！狀態未改變 (仍為 ${initialLockText})`);
  }
  console.log('  ✅ 鎖頭按鈕成功切換！');

  // 確保在解鎖狀態 (🔓) 進行後續測試
  if (afterClick1Text === '🔒') {
    await (await page.$('.tl-lock-btn[data-track="main"]'))?.click();
    await page.waitForTimeout(300);
  }

  // 2. 測試頂部總時長輸入框直接修改時長
  console.log('\n👉 2. 測試頂部總時長輸入框修改時長...');
  const durInput = await page.$('#tl-input-duration');
  if (!durInput) throw new Error('找不到頂部總時長輸入框 #tl-input-duration');

  await durInput.fill('0.65');
  await durInput.dispatchEvent('change');
  await page.waitForTimeout(500);

  const timeDisplayText = await page.$eval('#tl-time-display', el => el.textContent?.trim());
  console.log('  修改為 0.65s 後時間軸顯示:', timeDisplayText);
  if (!timeDisplayText?.includes('0.65s')) {
    throw new Error(`❌ 時間軸總時長未更新為 0.65s！目前顯示: ${timeDisplayText}`);
  }
  console.log('  ✅ 總時長直覺輸入更新成功！');

  // 3. 測試 Cue Marker 真正滑鼠拖曳
  console.log('\n👉 3. 測試 Cue Marker 真實滑鼠拖曳...');
  const cueMarker = await page.$('.tl-cue-marker');
  if (!cueMarker) throw new Error('找不到 Cue Marker .tl-cue-marker');

  const cueBox = await cueMarker.boundingBox();
  if (!cueBox) throw new Error('無法取得 Cue Marker 座標');

  const initialCueTimeTag = await cueMarker.$eval('.tl-cue-time-tag', el => el.textContent?.trim());
  console.log('  Cue 初始時間標籤:', initialCueTimeTag);

  // 執行滑鼠按住拖曳: 向左拖動 60px
  await page.mouse.move(cueBox.x + cueBox.width / 2, cueBox.y + cueBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cueBox.x + cueBox.width / 2 - 60, cueBox.y + cueBox.height / 2, { steps: 5 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(500);

  const newCueMarker = await page.$('.tl-cue-marker');
  const afterDragTimeTag = await newCueMarker?.$eval('.tl-cue-time-tag', el => el.textContent?.trim());
  console.log('  Cue 拖曳放開後時間標籤:', afterDragTimeTag);

  if (afterDragTimeTag === initialCueTimeTag) {
    throw new Error(`❌ Cue Marker 拖曳失敗！時間標籤仍為 ${initialCueTimeTag}`);
  }
  console.log('  ✅ Cue Marker 成功平滑拖曳至新時間點！');

  // 4. 測試主圖層 Clip 拉伸縮小時長 (mainDuration) 與拖曳移動前搖 (mainDelay)
  console.log('\n👉 4. 測試主圖層 Clip 右緣 Handle 拉伸縮小時長 (mainDuration)...');
  const mainHandle = await page.$('.tl-main-resize-handle');
  if (!mainHandle) throw new Error('找不到主圖層右緣拉伸把手 .tl-main-resize-handle');

  const handleBox = await mainHandle.boundingBox();
  if (!handleBox) throw new Error('無法取得主圖層把手座標');

  // 向左拖動 200px 縮小時長
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 - 200, handleBox.y + handleBox.height / 2, { steps: 5 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(500);

  const resizedClipWidth = await page.$eval('.tl-main-clip', el => el.style.width);
  console.log('  拉伸縮小後 Clip style.width:', resizedClipWidth);
  if (resizedClipWidth === '100%') {
    throw new Error('❌ 主圖層 Handle 拉伸縮小時長失敗！');
  }
  console.log('  ✅ 主圖層 Handle 成功拉伸縮小時長！');

  console.log('\n👉 5. 測試主圖層 Clip 本體平移前搖 (mainDelay)...');
  const afterResizeClipBox = await (await page.$('.tl-main-clip'))?.boundingBox();
  if (!afterResizeClipBox) throw new Error('無法取得主圖層縮小後座標');

  await page.mouse.move(afterResizeClipBox.x + 20, afterResizeClipBox.y + afterResizeClipBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(afterResizeClipBox.x + 20 + 80, afterResizeClipBox.y + afterResizeClipBox.height / 2, { steps: 5 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(500);

  const finalClipLeft = await page.$eval('.tl-main-clip', el => el.style.left);
  console.log('  平移後 Clip style.left:', finalClipLeft);
  if (finalClipLeft === '0%' || finalClipLeft === '0px') {
    throw new Error('❌ 主圖層本體平移前搖失敗！');
  }
  console.log('  ✅ 主圖層 Clip 成功平移前搖時間 (mainDelay)！');

  if (notFoundUrls.length > 0) {
    throw new Error(`❌ 驗收失敗，載入過程出現 404 請求: ${JSON.stringify(notFoundUrls)}`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(`❌ 驗收失敗，瀏覽器出現錯誤日誌: ${JSON.stringify(consoleErrors)}`);
  }

  console.log('\n🎉 所有真實人類視角交互驗收項目全數通過！');
  } finally {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

run().catch(err => {
  console.error('\n❌ 驗收失敗:', err);
  process.exit(1);
});
