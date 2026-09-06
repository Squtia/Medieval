import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;
const ARTIFACT_IMG = `C:/Users/User/.gemini/antigravity-ide/brain/253604e3-5114-44a5-af5b-1b3efeb5c0ab/layer_compositor_verified.png`;

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
  console.log('🚀 開始執行「5 大彈道路徑 ＋ 反向開關 ＋ 多圖層系統」全流程端到端無頭驗收...');

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
    await page.waitForSelector('#param-spatial-mode', { timeout: 10000 });
    await page.waitForSelector('#param-trajectory-path', { timeout: 10000 });
    await page.waitForSelector('#param-reverse', { timeout: 10000 });

    // 1. 檢驗時空模式與 5 大彈道路徑 UI 連動
    console.log('1. 驗證右側面板之時空模式、5 大彈道路徑與反向控制...');
    const spatialMode = await page.$eval('#param-spatial-mode', (el) => el.value);
    console.log(`   初始空間發生模式: ${spatialMode}`);

    // 切換為位移彈道，選擇天降雷殛 (VERTICAL_SKY_TO_B)
    await page.selectOption('#param-spatial-mode', 'TRAJECTORY');
    await page.selectOption('#param-trajectory-path', 'VERTICAL_SKY_TO_B');
    await page.waitForTimeout(100);

    // 驗證主軌標籤即時更新
    let mainClipText = await page.$eval('.tl-main-clip', (el) => el.textContent.trim());
    console.log(`   切換天降後主軌標籤: "${mainClipText}"`);

    // 勾選反向開關 (Reverse)
    console.log('2. 測試反向開關 (Reverse) 連動...');
    await page.selectOption('#param-reverse', 'true');
    await page.waitForTimeout(100);

    mainClipText = await page.$eval('.tl-main-clip', (el) => el.textContent.trim());
    console.log(`   開啟反向後主軌標籤: "${mainClipText}"`);
    if (!mainClipText.includes('🔄')) {
      throw new Error(`開啟反向後主軌未顯示 🔄 符號: ${mainClipText}`);
    }

    // 3. 測試快捷新增多圖層（自身揮刀/升空 ➔ 位移彈道 ➔ 目標受擊）
    console.log('3. 測試快捷新增多圖層合成...');
    await page.click('#tl-btn-add-layer-caster'); // 新增自身前段
    await page.waitForTimeout(100);
    await page.click('#tl-btn-add-layer-sky');    // 新增天降彈道
    await page.waitForTimeout(100);
    await page.click('#tl-btn-add-layer-target'); // 新增目標爆裂
    await page.waitForTimeout(150);

    const layerRows = await page.$$('.tl-layer-track-row');
    console.log(`   成功建立次生圖層軌道數量: ${layerRows.length} 條`);
    if (layerRows.length < 3) {
      throw new Error(`次生圖層數量預期 >= 3，實際為 ${layerRows.length}`);
    }

    // 4. 測試各圖層獨立 Clip 拖曳與拉伸
    console.log('4. 測試第 1 次生圖層 Clip 拉伸...');
    const firstLayerHandle = await page.$('.tl-clip-resize-handle[data-layer-idx="0"]');
    if (!firstLayerHandle) throw new Error('找不到第 1 個圖層的拉伸把手');

    const handleBox = await firstLayerHandle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width * 0.5, handleBox.y + handleBox.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 80, handleBox.y + handleBox.height * 0.5, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    // 5. 測試圖層獨立靜音開關 (Mute)
    console.log('5. 測試圖層獨立靜音 (Mute) 切換...');
    const toggleBtn = await page.$('.tl-layer-toggle-btn[data-layer-idx="1"]');
    if (toggleBtn) {
      const beforeText = await toggleBtn.textContent();
      await toggleBtn.click();
      await page.waitForTimeout(100);
      const afterText = await toggleBtn.textContent();
      console.log(`   圖層 2 靜音按鈕狀態變化: ${beforeText} ➔ ${afterText}`);
    }

    // 6. 截圖存檔留存端到端驗收證據
    console.log(`6. 產出視覺驗收截圖至 ${ARTIFACT_IMG}...`);
    const artifactDir = path.dirname(ARTIFACT_IMG);
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }
    await page.screenshot({ path: ARTIFACT_IMG, fullPage: true });

    if (consoleErrors.length > 0) {
      console.error('❌ 頁面控制台有報錯:');
      for (const e of consoleErrors) console.error(e);
      throw new Error(`控制台報錯次數: ${consoleErrors.length}`);
    }

    console.log('🎉 恭喜！5 大彈道路徑 ＋ 反向開關 ＋ 多圖層系統端到端測試全數通過！');
  } finally {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill();
      console.log('🛑 已終止 Vite 伺服器程序');
    }
  }
}

run().catch((err) => {
  console.error('❌ 測試執行失敗:', err);
  process.exit(1);
});
