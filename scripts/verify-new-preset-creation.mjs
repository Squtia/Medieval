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
  console.log('🚀 開始驗證【新建技能不再鎖死斬擊參數 & Shader Mode 智慧切換】真實使用者全流程...');

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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, route => {
      route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    });

    console.log(`導航至: ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);

    // 1. 點擊「➕ 新增」按鈕，並監聽 dialog
    page.on('dialog', async dialog => {
      console.log(`彈出對話框 [${dialog.type()}]: ${dialog.message()}`);
      await dialog.accept('自動驗證_新技能測試');
    });

    const newBtn = await page.$('#lib-btn-new');
    if (!newBtn) {
      throw new Error('未找到 #lib-btn-new 新增按鈕');
    }
    console.log('點擊「➕ 新增」建立新技能...');
    await newBtn.click();
    await page.waitForTimeout(1000);

    // 2. 檢驗新建後 Inspector 狀態
    const slashCardDisplay1 = await page.$eval('.card-slash-section', el => getComputedStyle(el).display);
    const salvoCardDisplay1 = await page.$eval('.card-salvo-section', el => getComputedStyle(el).display);
    const currentShader1 = await page.$eval('#param-shader-mode', el => el.value);

    console.log(`✅ 新建完成：當前 ShaderMode = ${currentShader1}`);
    console.log(`✅ 斬擊卡片 display = ${slashCardDisplay1} (預期 none)`);
    console.log(`✅ 彈幕卡片 display = ${salvoCardDisplay1} (預期 block)`);

    if (slashCardDisplay1 !== 'none') {
      throw new Error(`新建技能後斬擊卡片未隱藏，仍被鎖死！得到: ${slashCardDisplay1}`);
    }
    if (salvoCardDisplay1 !== 'block') {
      throw new Error(`新建技能後彈幕卡片未展開！得到: ${salvoCardDisplay1}`);
    }

    // 3. 切換 Shader 為 FRESNEL_ICE (菲涅爾冰晶)
    console.log('切換 Shader 為 FRESNEL_ICE...');
    await page.selectOption('#param-shader-mode', 'FRESNEL_ICE');
    await page.waitForTimeout(500);

    const slashCardDisplay2 = await page.$eval('.card-slash-section', el => getComputedStyle(el).display);
    const salvoCardDisplay2 = await page.$eval('.card-salvo-section', el => getComputedStyle(el).display);
    const fresnelDisplay = await page.$eval('#col-fresnel', el => getComputedStyle(el).display);
    console.log(`✅ 切換至冰晶：斬擊卡片 = ${slashCardDisplay2} (預期 none)`);
    console.log(`✅ 彈幕卡片 = ${salvoCardDisplay2} (預期 block)`);
    console.log(`✅ 菲涅爾欄位 = ${fresnelDisplay} (預期 block)`);

    if (slashCardDisplay2 !== 'none' || fresnelDisplay !== 'block') {
      throw new Error('切換至冰晶時卡片顯隱不正確！');
    }

    // 4. 切換 Shader 為 EARTH_SHATTER (地刺重擊)
    console.log('切換 Shader 為 EARTH_SHATTER...');
    await page.selectOption('#param-shader-mode', 'EARTH_SHATTER');
    await page.waitForTimeout(500);

    const slashCardDisplay3 = await page.$eval('.card-slash-section', el => getComputedStyle(el).display);
    const spikeCardDisplay3 = await page.$eval('.card-spike-section', el => getComputedStyle(el).display);
    console.log(`✅ 切換至地刺：斬擊卡片 = ${slashCardDisplay3} (預期 none)`);
    console.log(`✅ 地刺卡片 = ${spikeCardDisplay3} (預期 block)`);

    if (slashCardDisplay3 !== 'none' || spikeCardDisplay3 !== 'block') {
      throw new Error('切換至地刺時卡片顯隱不正確！');
    }

    // 5. 切換 Shader 為 SLASH_BLADE (刀刃斬光)
    console.log('切換 Shader 為 SLASH_BLADE...');
    await page.selectOption('#param-shader-mode', 'SLASH_BLADE');
    await page.waitForTimeout(500);

    const slashCardDisplay4 = await page.$eval('.card-slash-section', el => getComputedStyle(el).display);
    const spikeCardDisplay4 = await page.$eval('.card-spike-section', el => getComputedStyle(el).display);
    console.log(`✅ 切換至斬擊：斬擊卡片 = ${slashCardDisplay4} (預期 block)`);
    console.log(`✅ 地刺卡片 = ${spikeCardDisplay4} (預期 none)`);

    if (slashCardDisplay4 !== 'block' || spikeCardDisplay4 !== 'none') {
      throw new Error('切換回斬擊時卡片顯隱不正確！');
    }

    // 截圖存檔
    const screenshotPath = 'C:/Users/Allen.Ko/.gemini/antigravity-ide/brain/da3b1d2d-e25e-45e0-9007-984f050a9feb/shader-switch-verification.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 實機驗收截圖已儲存至: ${screenshotPath}`);

    console.log('🎉 所有全流程驗收 100% 通過！使用者新建技能不再被鎖死在斬擊參數！');
  } finally {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

run().catch(err => {
  console.error('❌ 驗證失敗:', err);
  process.exit(1);
});
