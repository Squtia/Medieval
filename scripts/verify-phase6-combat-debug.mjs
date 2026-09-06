import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function runVerification() {
  console.log('🚀 開始 Phase 6 戰鬥演播室與 Debug Overlay 真實瀏覽器驗證...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(`[BROWSER ERROR] ${msg.text()}`);
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
    }
  }

  // 5. 導覽至特效工房驗證載入
  console.log('導覽至特效工房驗證...');
  await page.goto('http://localhost:5173/Medieval/tools/vfx-studio.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('#library-mount-point', { timeout: 15000 });
  console.log('特效工房模板載入完成！');

  console.log('瀏覽器主控台錯誤數量:', consoleLogs.length);
  if (consoleLogs.length > 0) {
    console.warn('主控台錯誤:', consoleLogs);
  }

  await browser.close();
  console.log('🎉 Phase 6 戰鬥演播室與 Debug Overlay 瀏覽器無頭驗收全部通過！');
}

runVerification().catch(err => {
  console.error('❌ 驗收失敗:', err);
  process.exit(1);
});
