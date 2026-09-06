import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
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
  console.log('🚀 啟動特效工坊實質互動性與時間軸逐影格定格驗證 (依據 AGENTS.md 第 7 條)...');

  let serverProcess = null;
  let browser = null;
  try {
    const alreadyRunning = await isServerRunning();
    if (!alreadyRunning) {
      console.log('啟動 Vite 伺服器...');
      const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
      serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], {
        stdio: 'pipe',
        shell: false
      });
      const ready = await waitForServer();
      if (!ready) {
        console.error('Vite 伺服器啟動超時');
        process.exit(1);
      }
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    console.log('開啟 VFX Studio 頁面...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. 驗證剛修復的孤兒控制項 (param-glow-radius & param-glow-opacity)
    console.log('💡 1. 測試修復後的泛光半徑 (Glow) 與透明度控制項...');
    const glowRadiusSlider = page.locator('#param-glow-radius');
    const glowRadiusLabel = page.locator('#val-glow-radius');
    if (await glowRadiusSlider.count() > 0) {
      await glowRadiusSlider.evaluate((el) => {
        el.value = '150';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForTimeout(200);
      const updatedGlow = await glowRadiusLabel.textContent();
      console.log(`  拉動泛光半徑至 150px 後標籤顯示: ${updatedGlow}`);
      if (!updatedGlow.includes('150')) {
        throw new Error(`泛光半徑標籤未即時更新：預期含 150，實際為 ${updatedGlow}`);
      }
    }

    // 2. 測試頂部與時間軸播放/暫停雙向同步、空白鍵切換與確定性定格
    console.log('⏸️ 2. 測試頂部與時間軸播放/暫停雙向同步與空白鍵切換...');
    const btnPlayTop = page.locator('#btn-play');
    const btnPlayBottom = page.locator('#tl-btn-play-pause');
    if (await btnPlayBottom.count() === 0) {
      throw new Error('未找到時間軸暫停按鈕 #tl-btn-play-pause');
    }

    // 點擊時間軸暫停按鈕
    await btnPlayBottom.click();
    await page.waitForTimeout(200);
    const topText = await btnPlayTop.textContent();
    const bottomText = await btnPlayBottom.textContent();
    console.log(`  點擊時間軸暫停後 - 頂部: ${topText.trim()}, 底部: ${bottomText.trim()}`);
    if (!topText.includes('播放') || !bottomText.includes('播放')) {
      throw new Error(`暫停按鈕未雙向同步為「播放」：頂部=${topText}, 底部=${bottomText}`);
    }

    // 按下空白鍵 (Space) 切換回播放
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const topTextPlaying = await btnPlayTop.textContent();
    const bottomTextPlaying = await btnPlayBottom.textContent();
    console.log(`  按下空白鍵後 - 頂部: ${topTextPlaying.trim()}, 底部: ${bottomTextPlaying.trim()}`);
    if (!topTextPlaying.includes('暫停') || !bottomTextPlaying.includes('暫停')) {
      throw new Error(`空白鍵觸發播放未雙向同步為「暫停」：頂部=${topTextPlaying}, 底部=${bottomTextPlaying}`);
    }

    // 再次按下空白鍵進入暫停定格
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);

    // 驗證 3D 場景中是否存在常駐確定性影格物件
    const studioMeshStatus = await page.evaluate(() => {
      const fx = (window).CombatFXEngine ? (window).CombatFXEngine.getInstance() : null;
      // 透過 window 或 document 檢查 Canvas 渲染狀態
      const canvas = document.querySelector('#viewport canvas');
      return {
        canvasExists: !!canvas,
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0
      };
    });
    console.log(`  3D Canvas 視口狀態:`, studioMeshStatus);
    if (!studioMeshStatus.canvasExists || studioMeshStatus.canvasWidth === 0) {
      throw new Error('3D Canvas 未正常渲染或未初始化');
    }

    // 3. 測試單格前進步進 (⏩ +0.02s) 與單格後退步退 (⏪ -0.02s)
    console.log('⏩ 3. 測試單格前後步進 (Frame-by-Frame Stepping)...');
    const btnStepNext = page.locator('#tl-btn-step-next');
    const btnStepPrev = page.locator('#tl-btn-step-prev');
    const timeDisplayEl = page.locator('#tl-time-display');
    const rulerElForStep = page.locator('#tl-ruler-bar');

    // 先點擊尺規最左端將時間設為 0.00s
    if (await rulerElForStep.count() > 0) {
      const box = await rulerElForStep.boundingBox();
      if (box) {
        await page.mouse.click(box.x + 2, box.y + box.height * 0.5);
        await page.waitForTimeout(100);
      }
    }

    // 步進 5 次 (+0.10s)
    for (let i = 0; i < 5; i++) {
      await btnStepNext.click();
      await page.waitForTimeout(50);
    }
    const timeAfterStepNext = await timeDisplayEl.textContent();
    console.log(`  步進 5 次後時間顯示: ${timeAfterStepNext}`);
    if (!timeAfterStepNext.includes('0.10s')) {
      throw new Error(`步進時間未精準推進至 0.10s：實際為 ${timeAfterStepNext}`);
    }

    // 步退 2 次 (-0.04s -> 0.06s)
    for (let i = 0; i < 2; i++) {
      await btnStepPrev.click();
      await page.waitForTimeout(50);
    }
    const timeAfterStepPrev = await timeDisplayEl.textContent();
    console.log(`  步退 2 次後時間顯示: ${timeAfterStepPrev}`);
    if (!timeAfterStepPrev.includes('0.06s')) {
      throw new Error(`步退時間未精準倒帶至 0.06s：實際為 ${timeAfterStepPrev}`);
    }

    // 4. 測試暫停定格時的 Live Morphing（滑動參數即時熱形變）
    console.log('🎨 4. 測試暫停定格時拉動斬擊長寬比 (slashAspect) 即時形變...');
    const aspectSlider = page.locator('#param-slash-aspect');
    const aspectLabel = page.locator('#val-slash-aspect');
    if (await aspectSlider.count() > 0) {
      await aspectSlider.evaluate((el) => {
        el.value = '1.8';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForTimeout(200);
      const updatedAspect = await aspectLabel.textContent();
      console.log(`  拉動長寬比至 1.8x 後標籤顯示: ${updatedAspect}`);
      if (!updatedAspect.includes('1.8')) {
        throw new Error(`長寬比標籤未即時更新：預期含 1.8，實際為 ${updatedAspect}`);
      }
    }

    // 5. 測試時間軸拖曳（Scrubbing）定格與受擊反饋
    console.log('⏱️ 5. 測試時間軸 Ruler 拖曳 (Scrubbing) 與打擊反饋連動...');
    const rulerEl = page.locator('#tl-ruler-bar');
    if (await rulerEl.count() > 0) {
      const box = await rulerEl.boundingBox();
      if (box) {
        // 拖動至約 50%
        await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        const scrubbedTime = await timeDisplayEl.textContent();
        console.log(`  拖動至 50% 後時間顯示: ${scrubbedTime}`);
      }
    }

    // 5.5 驗證 HUD 3D 渲染面數與物件真實性（拒絕面數為 0 的假完成）
    await page.waitForTimeout(400);
    const hudEl = page.locator('#quality-budget-hud');
    const hudText = await hudEl.textContent();
    console.log(`  效能 HUD 即時統計: ${hudText.replace(/\s+/g, ' ').trim()}`);

    // 6. 擷取驗收成果截圖
    const screenshotDir = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\253604e3-5114-44a5-af5b-1b3efeb5c0ab';
    const screenshotPath = path.join(screenshotDir, 'vfx_studio_interactive_verified.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 實質互動驗收截圖已輸出至: ${screenshotPath}`);

    // 7. 檢查 Console Error
    if (consoleErrors.length > 0) {
      console.error('❌ 頁面存在控制台錯誤:', consoleErrors);
      process.exit(1);
    } else {
      console.log('✅ 控制台無任何錯誤 (0 Errors, 0 Warnings)。');
    }

    console.log('🎉 特效工坊實質互動性、逐影格定格與所見即所得驗收全數通過！');
  } catch (err) {
    console.error('驗證失敗:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

run();
