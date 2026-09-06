import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function verifyTrackControlsAndContextualInspector() {
  console.log('🚀 開始 Phase 3 & Phase 4 軌道專業控制項 (Solo/Lock) 與情境式 Inspector 瀏覽器真實驗收...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  const url = 'http://localhost:5173/Medieval/tools/vfx-studio.html';
  console.log(`導覽至 ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });

  await page.waitForSelector('#timeline-mount-point', { timeout: 15000 });
  console.log('時間軸模板載入完成！');

  // 1. 檢查主軌道 Solo / Mute / Lock 按鈕
  const mainSoloBtn = await page.waitForSelector('.tl-solo-btn[data-track="main"]', { timeout: 5000 });
  const mainLockBtn = await page.waitForSelector('.tl-lock-btn[data-track="main"]', { timeout: 5000 });
  console.log('主軌道 Solo & Lock 按鈕驗證存在！');

  // 2. 測試主軌 Lock 切換
  console.log('點擊主軌道 Lock 按鈕...');
  await mainLockBtn.click();
  await page.waitForTimeout(200);

  const isMainLocked = await page.$eval('.tl-main-clip', el => el.classList.contains('locked'));
  console.log('主圖層 Clip 是否進入鎖定狀態 (locked class):', isMainLocked);
  if (!isMainLocked) {
    throw new Error('主軌鎖定後 .tl-main-clip 未具備 locked 樣式！');
  }

  // 3. 測試次生圖層新增與圖層 Solo / Lock 按鈕
  console.log('點擊新增一層次生圖層...');
  await page.click('#tl-btn-add-layer');
  await page.waitForTimeout(300);

  const layerSoloBtn = await page.waitForSelector('.tl-layer-solo-btn[data-layer-idx="0"]', { timeout: 5000 });
  const layerLockBtn = await page.waitForSelector('.tl-layer-lock-btn[data-layer-idx="0"]', { timeout: 5000 });
  console.log('次生圖層 Solo & Lock 按鈕驗證存在！');

  // 點擊次生圖層 Solo 按鈕
  console.log('點擊次生圖層 Solo 按鈕...');
  await layerSoloBtn.click();
  await page.waitForTimeout(200);
  const isSoloActive = await page.$eval('.tl-layer-solo-btn[data-layer-idx="0"]', el => el.classList.contains('active'));
  console.log('次生圖層 Solo 是否高亮激活 (active):', isSoloActive);
  if (!isSoloActive) {
    throw new Error('次生圖層點選 Solo 後未高亮激活！');
  }

  // 4. 測試情境式 Inspector：選中 Cue 時動態收合
  console.log('點選 Cue Marker 驗證情境式收合...');
  const cueMarker = await page.waitForSelector('.tl-cue-marker', { timeout: 5000 });
  await cueMarker.click();
  await page.waitForTimeout(300);

  const cueCardVisible = await page.$eval('#card-cue-inspector', el => el.style.display !== 'none');
  const casterMotionHidden = await page.$eval('.card-caster-motion', el => el.style.display === 'none');
  const impactCardHidden = await page.$eval('.card-impact-section', el => el.style.display === 'none');

  console.log('Cue Inspector 是否展開:', cueCardVisible);
  console.log('非關卡片 (施法發力) 是否情境收合:', casterMotionHidden);
  console.log('非關卡片 (受擊衝擊) 是否情境收合:', impactCardHidden);

  if (!cueCardVisible || !casterMotionHidden || !impactCardHidden) {
    throw new Error('情境式 Inspector 未能依選取項目動態過濾收合！');
  }

  // 截圖存檔
  const screenshotDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const shotPath = path.join(screenshotDir, 'track_controls_contextual_verified.png');
  await page.screenshot({ path: shotPath });
  console.log('📸 已儲存驗收截圖至:', shotPath);

  console.log('主控台錯誤數量:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.warn('主控台錯誤列表:', consoleErrors);
  }

  await browser.close();
  console.log('🎉 Phase 3 & Phase 4 軌道控制項 (Solo/Lock) 與情境式 Inspector 真實驗收 100% 通過！');
}

verifyTrackControlsAndContextualInspector().catch(err => {
  console.error('❌ 驗收失敗:', err);
  process.exit(1);
});
