import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;
const ARTIFACT_IMG = `C:/Users/User/.gemini/antigravity-ide/brain/253604e3-5114-44a5-af5b-1b3efeb5c0ab/main_track_clip_verified.png`;

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
  console.log('🚀 開始執行主特效軌實體 Clip 化與三大時空錨點端到端驗收測試...');

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
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[PageUncaught] ${err.message}\n${err.stack}`);
    });

    await page.goto(TEST_URL);
    console.log(`✅ 成功載入頁面: ${TEST_URL}`);

    await page.waitForSelector('#timeline-mount-point', { timeout: 10000 });
    await page.waitForSelector('.tl-main-clip', { timeout: 10000 });
    await page.waitForSelector('.tl-main-resize-handle', { timeout: 10000 });
    await page.waitForSelector('#benchmark-marker', { timeout: 10000 });

    // 1. 檢驗主軌實體 Clip 初始渲染
    const mainClipText = await page.$eval('.tl-main-clip', (el) => el.textContent.trim());
    console.log(`1. 主軌 Clip 初始標籤: "${mainClipText}"`);
    if (!mainClipText.includes('MELEE_SWEEP') && !mainClipText.includes('目標') && !mainClipText.includes('彈道')) {
      throw new Error(`主軌 Clip 內容不正確: '${mainClipText}'`);
    }

    // 2. 測試拉伸主軌時長 (拖動右緣把手調整 mainDuration)
    console.log('2. 測試拉伸主軌右緣調整有效時長 (mainDuration)...');
    const resizeHandleEl = await page.$('.tl-main-resize-handle');
    const handleBox = await resizeHandleEl.boundingBox();

    // 拖動把手向左縮短 60px
    await page.mouse.move(handleBox.x + handleBox.width * 0.5, handleBox.y + handleBox.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 60, handleBox.y + handleBox.height * 0.5, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const resizedClipText = await page.$eval('.tl-main-clip', (el) => el.getAttribute('title') || '');
    console.log(`   縮短後主軌資訊: "${resizedClipText}"`);

    // 3. 測試平移主軌起點 (拖動 Clip 本體調整 mainDelay)
    console.log('3. 測試拖曳主軌 Clip 本體平移起點前搖 (mainDelay)...');
    const mainClipEl = await page.$('.tl-main-clip');
    const mainBox = await mainClipEl.boundingBox();

    // 在 Clip 中央按下並向右拖動 30px
    await page.mouse.move(mainBox.x + mainBox.width * 0.4, mainBox.y + mainBox.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(mainBox.x + mainBox.width * 0.4 + 30, mainBox.y + mainBox.height * 0.5, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const movedClipText = await page.$eval('.tl-main-clip', (el) => el.getAttribute('title') || '');
    console.log(`   平移後主軌資訊: "${movedClipText}"`);
    if (!movedClipText.includes('起點:') || movedClipText.includes('起點: 0.00s')) {
      throw new Error(`主軌平移失敗，起點未增加: '${movedClipText}'`);
    }

    // 4. 測試三大時空錨點動態切換
    console.log('4. 測試三大時空錨點切換與基準標記空間鎖定...');
    const trajectorySelect = await page.$('#param-trajectory');
    if (!trajectorySelect) throw new Error('找不到 #param-trajectory 彈道選單');

    // 4.1 切換至自身光環 BODY_AURA (AT_CASTER / A點自身)
    console.log('   4.1 切換為「自身光環 (BODY_AURA)」...');
    await trajectorySelect.selectOption('BODY_AURA');
    await page.waitForTimeout(150);

    const auraClipText = await page.$eval('.tl-main-clip', (el) => el.textContent.trim());
    console.log(`       自身光環主軌標籤: "${auraClipText}"`);
    if (!auraClipText.includes('自身(A)')) {
      throw new Error(`自身光環未顯示 [自身(A)] 標籤: '${auraClipText}'`);
    }

    // 取得 Caster 與 Marker 位置
    const casterBox = await page.$eval('#ref-caster', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const markerAuraPos = await page.$eval('#benchmark-marker', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: el.querySelector('#benchmark-marker-label')?.textContent || '' };
    });
    console.log(`       施術者中心 X=${casterBox.x.toFixed(1)}, 基準標記 X=${markerAuraPos.x.toFixed(1)}, 標籤: ${markerAuraPos.label}`);
    if (Math.abs(markerAuraPos.x - casterBox.x) > 2) {
      throw new Error(`自身光環標記未鎖定在施術者 A 點: Caster=${casterBox.x}, Marker=${markerAuraPos.x}`);
    }

    // 4.2 切換至天降神雷 VERTICAL_DROP (AT_TARGET / B點目標)
    console.log('   4.2 切換為「垂直天降 (VERTICAL_DROP)」...');
    await trajectorySelect.selectOption('VERTICAL_DROP');
    await page.waitForTimeout(150);

    const dropClipText = await page.$eval('.tl-main-clip', (el) => el.textContent.trim());
    console.log(`       天降主軌標籤: "${dropClipText}"`);
    if (!dropClipText.includes('目標(B)')) {
      throw new Error(`天降神雷未顯示 [目標(B)] 標籤: '${dropClipText}'`);
    }

    const targetBox = await page.$eval('#ref-target', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const markerDropPos = await page.$eval('#benchmark-marker', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: el.querySelector('#benchmark-marker-label')?.textContent || '' };
    });
    console.log(`       受擊目標中心 X=${targetBox.x.toFixed(1)}, 基準標記 X=${markerDropPos.x.toFixed(1)}, 標籤: ${markerDropPos.label}`);
    if (Math.abs(markerDropPos.x - targetBox.x) > 2) {
      throw new Error(`天降標記未鎖定在受擊目標 B 點: Target=${targetBox.x}, Marker=${markerDropPos.x}`);
    }

    // 4.3 切換至水平飛行 HORIZONTAL (TRAJECTORY / A➔B 彈道)
    console.log('   4.3 切換為「水平飛行 (HORIZONTAL)」...');
    await trajectorySelect.selectOption('HORIZONTAL');
    await page.waitForTimeout(150);

    const horizClipText = await page.$eval('.tl-main-clip', (el) => el.textContent.trim());
    console.log(`       水平飛行主軌標籤: "${horizClipText}"`);
    if (!horizClipText.includes('彈道(A➔B)')) {
      throw new Error(`水平飛行未顯示 [彈道(A➔B)] 標籤: '${horizClipText}'`);
    }

    // 5. 截圖存檔
    await page.screenshot({ path: ARTIFACT_IMG });
    console.log(`📸 驗證截圖已存至: ${ARTIFACT_IMG}`);

    console.log('🎉 主特效軌 Clip 化與三大時空錨點所有端到端驗收項目 100% 通過！');
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
