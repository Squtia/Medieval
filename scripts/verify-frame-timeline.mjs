import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;
const ARTIFACT_IMG = `C:/Users/User/.gemini/antigravity-ide/brain/253604e3-5114-44a5-af5b-1b3efeb5c0ab/frame_timeline_verified.png`;

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
  console.log('🚀 開始執行 FrameTimelineEngine 與 VFX Studio 逐幀互動驗收測試...');

  let serverProcess = null;
  let browser = null;
  const consoleErrors = [];

  try {
    const alreadyRunning = await isServerRunning();
    if (!alreadyRunning) {
      console.log('正在啟動 vite dev server...');
      const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
      const projectRoot = fileURLToPath(new URL('..', import.meta.url));
      serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], {
        cwd: projectRoot,
        stdio: 'pipe',
        shell: false
      });
      serverProcess.stderr.on('data', (d) => console.error(`[Vite stderr] ${d.toString()}`));
      const ready = await waitForServer();
      if (!ready) {
        console.error('❌ 無法啟動 Vite Server');
        if (serverProcess) serverProcess.kill();
        process.exit(1);
      }
      console.log('✅ Vite Server 啟動就緒');
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      else console.log(`[Browser Console] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[PageUncaught] ${err.message}\n${err.stack}`);
    });

    let targetUrl = TEST_URL;
    let resp = await page.goto(targetUrl).catch(() => null);
    if (!resp || resp.status() >= 400) {
      targetUrl = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;
      resp = await page.goto(targetUrl);
    }
    console.log(`✅ 成功載入頁面: ${targetUrl}`);

    await page.waitForSelector('#timeline-mount-point', { timeout: 10000 });
    await page.waitForSelector('#benchmark-marker', { timeout: 10000 });

    // 選取水平飛行彈道以驗證 A➔B 逐格位移
    const trajectorySelect = await page.$('#param-trajectory');
    if (trajectorySelect) {
      await trajectorySelect.selectOption('HORIZONTAL');
      await page.waitForTimeout(100);
    }

    // 1. 檢驗初始狀態
    const initialText = await page.$eval('#tl-time-display', (el) => el.textContent.trim());
    console.log(`1. 初始時間軸顯示: "${initialText}"`);
    if (!initialText.includes('Frame: 00')) {
      throw new Error(`初始時間軸顯示不正確: 預期包含 'Frame: 00'，實際為 '${initialText}'`);
    }

    const markerStartPos = await page.$eval('#benchmark-marker', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left, y: rect.top, label: el.querySelector('#benchmark-marker-label')?.textContent || '' };
    });
    console.log(`   基準測試標記起始位置: X=${markerStartPos.x.toFixed(1)}, Y=${markerStartPos.y.toFixed(1)}, 標籤: ${markerStartPos.label}`);

    // 2. 逐影格前進 (+1 Frame) 測試：連續點擊 5 次
    const btnStepNext = await page.$('#tl-btn-step-next');
    if (!btnStepNext) throw new Error('找不到 #tl-btn-step-next 按鈕');

    console.log('2. 連續點擊 5 次「⏩ +1 幀」...');
    for (let i = 0; i < 5; i++) {
      await btnStepNext.click();
    }
    await page.waitForTimeout(100);

    const step5Text = await page.$eval('#tl-time-display', (el) => el.textContent.trim());
    const markerStep5 = await page.$eval('#benchmark-marker', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left, y: rect.top, label: el.querySelector('#benchmark-marker-label')?.textContent || '' };
    });
    console.log(`   +5 幀後時間軸顯示: "${step5Text}"`);
    console.log(`   基準測試標記位置: X=${markerStep5.x.toFixed(1)}, 標籤: ${markerStep5.label}`);

    if (!step5Text.includes('Frame: 05')) {
      throw new Error(`前進 5 幀後顯示不正確: 預期包含 'Frame: 05'，實際為 '${step5Text}'`);
    }
    if (markerStep5.x <= markerStartPos.x) {
      throw new Error(`基準測試標記未向右前進: 起始 X=${markerStartPos.x}, +5 幀 X=${markerStep5.x}`);
    }

    // 3. 逐影格後退 (-1 Frame) 測試：連續點擊 2 次
    const btnStepPrev = await page.$('#tl-btn-step-prev');
    if (!btnStepPrev) throw new Error('找不到 #tl-btn-step-prev 按鈕');

    console.log('3. 連續點擊 2 次「⏪ -1 幀」...');
    for (let i = 0; i < 2; i++) {
      await btnStepPrev.click();
    }
    await page.waitForTimeout(100);

    const step3Text = await page.$eval('#tl-time-display', (el) => el.textContent.trim());
    const markerStep3 = await page.$eval('#benchmark-marker', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left, y: rect.top, label: el.querySelector('#benchmark-marker-label')?.textContent || '' };
    });
    console.log(`   -2 幀後時間軸顯示: "${step3Text}"`);
    console.log(`   基準測試標記位置: X=${markerStep3.x.toFixed(1)}, 標籤: ${markerStep3.label}`);

    if (!step3Text.includes('Frame: 03')) {
      throw new Error(`後退 2 幀後顯示不正確: 預期包含 'Frame: 03'，實際為 '${step3Text}'`);
    }
    if (markerStep3.x >= markerStep5.x) {
      throw new Error(`基準測試標記未回退: +5 幀 X=${markerStep5.x}, 回退後 X=${markerStep3.x}`);
    }

    // 4. 重置測試
    const btnStop = await page.$('#tl-btn-stop');
    if (!btnStop) throw new Error('找不到 #tl-btn-stop 按鈕');
    console.log('4. 點擊「⏹ 重置」...');
    await btnStop.click();
    await page.waitForTimeout(100);

    const resetText = await page.$eval('#tl-time-display', (el) => el.textContent.trim());
    const markerReset = await page.$eval('#benchmark-marker', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    });
    console.log(`   重置後時間軸顯示: "${resetText}"`);
    if (!resetText.includes('Frame: 00')) {
      throw new Error(`重置後顯示不正確: '${resetText}'`);
    }
    if (Math.abs(markerReset.x - markerStartPos.x) > 1) {
      throw new Error(`重置後標記位置未歸零: 起始 X=${markerStartPos.x}, 重置 X=${markerReset.x}`);
    }

    // 5. 尺規 Scrubbing 點擊定格測試 (點擊 50% 處)
    const rulerBar = await page.$('#tl-ruler-bar');
    if (!rulerBar) throw new Error('找不到 #tl-ruler-bar');
    console.log('5. 點擊刻度尺中間 50% 位置進行 Seek / Scrubbing 定格...');
    const rulerBox = await rulerBar.boundingBox();
    await page.mouse.click(rulerBox.x + rulerBox.width * 0.5, rulerBox.y + rulerBox.height * 0.5);
    await page.waitForTimeout(100);

    const scrubText = await page.$eval('#tl-time-display', (el) => el.textContent.trim());
    const markerScrub = await page.$eval('#benchmark-marker', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left, y: rect.top, label: el.querySelector('#benchmark-marker-label')?.textContent || '' };
    });
    console.log(`   50% Scrubbing 後時間軸顯示: "${scrubText}"`);
    console.log(`   基準標記 50% 位置: X=${markerScrub.x.toFixed(1)}, 標籤: ${markerScrub.label}`);

    const totalFramesMatch = scrubText.match(/Frame:\s*(\d+)\s*\/\s*(\d+)/);
    if (!totalFramesMatch) throw new Error(`時間軸文字格式不正確: ${scrubText}`);
    const currentF = parseInt(totalFramesMatch[1], 10);
    const totalF = parseInt(totalFramesMatch[2], 10);
    const expectedF = Math.round(totalF * 0.5);
    console.log(`   預期 50% 影格: ${expectedF}，實際影格: ${currentF}`);
    if (Math.abs(currentF - expectedF) > 1) {
      throw new Error(`50% 定格不精確: 預期約 ${expectedF} 幀，實際為 ${currentF} 幀 (${scrubText})`);
    }

    // 6. 播放/暫停連動測試
    console.log('6. 測試空白鍵切換播放與暫停...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);

    const topBtnPlaying = await page.$eval('#btn-play', (el) => el.textContent.trim());
    console.log(`   播放中頂部按鈕狀態: "${topBtnPlaying}"`);
    if (!topBtnPlaying.includes('暫停')) {
      throw new Error(`播放中頂部按鈕未顯示暫停: '${topBtnPlaying}'`);
    }

    // 再次按空白鍵暫停
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    const topBtnPaused = await page.$eval('#btn-play', (el) => el.textContent.trim());
    console.log(`   暫停後頂部按鈕狀態: "${topBtnPaused}"`);
    if (!topBtnPaused.includes('播放')) {
      throw new Error(`暫停後頂部按鈕未切回播放: '${topBtnPaused}'`);
    }

    // 7. 截圖存檔
    await page.screenshot({ path: ARTIFACT_IMG });
    console.log(`📸 驗證截圖已存至: ${ARTIFACT_IMG}`);

    console.log('🎉 所有真實使用者互動端到端驗收項目 100% 通過！');
  } catch (err) {
    console.error('❌ 驗收失敗:', err);
    if (consoleErrors.length > 0) {
      console.error('瀏覽器 Console Errors:', consoleErrors);
    }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

run();
