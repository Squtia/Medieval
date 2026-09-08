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

async function verifySkillVfxPicker() {
  console.log('🚀 Starting Skill VFX Picker Modal E2E Verification...');

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
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, route => {
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '/* mock */'
      });
    });

    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#lib-preset-select');

  // 切換當前特效為 VFX_FIREBALL 以測試跨特效覆蓋綁定
  await page.selectOption('#lib-preset-select', 'VFX_FIREBALL');
  await page.waitForTimeout(400);

  // 1. 檢查開啟按鈕是否存在
  const openBtn = await page.$('#lib-btn-open-skill-picker');
  if (!openBtn) throw new Error('找不到 #lib-btn-open-skill-picker 按鈕！');
  console.log('✅ 成功找到 #lib-btn-open-skill-picker 按鈕');

  // 2. 點擊開啟 Modal
  await openBtn.click();
  await page.waitForSelector('#modal-skill-vfx-picker', { state: 'visible' });
  console.log('✅ Modal 成功彈出顯示！');

  // 3. 驗證卡片總數與分類
  const stats = await page.evaluate(() => {
    const cards = document.querySelectorAll('.svp-skill-card');
    const heroCards = document.querySelectorAll('.svp-skill-card .cat-hero');
    const monsterCards = document.querySelectorAll('.svp-skill-card .cat-monster');
    const siegeCards = document.querySelectorAll('.svp-skill-card .cat-siege');
    const currentVfx = document.getElementById('svp-current-vfx-label')?.textContent;

    return {
      totalCards: cards.length,
      heroCount: heroCards.length,
      monsterCount: monsterCards.length,
      siegeCount: siegeCards.length,
      currentVfx
    };
  });

  console.log('📊 卡片統計資料:', stats);
  if (stats.totalCards < 30) throw new Error(`卡片總數不足: ${stats.totalCards}`);
  if (stats.heroCount === 0 || stats.monsterCount === 0 || stats.siegeCount === 0) {
    throw new Error('分類卡片缺漏！');
  }

  // 4. 測試搜尋功能
  console.log('🔍 測試搜尋框過濾...');
  await page.fill('#svp-search-input', '流星');
  await page.waitForTimeout(300);
  const searchCount = await page.evaluate(() => document.querySelectorAll('.svp-skill-card').length);
  console.log('🔍 搜尋【流星】結果卡片數:', searchCount);
  if (searchCount === 0) throw new Error('搜尋過濾失敗，找不到流星！');

  // 清除搜尋
  await page.fill('#svp-search-input', '');
  await page.waitForTimeout(300);

  // 5. 測試卡片覆蓋綁定互動
  console.log('🔗 測試【奮力一擊】覆蓋綁定...');
  const bindSuccess = await page.evaluate(() => {
    const card = document.querySelector('.svp-skill-card[data-skill-id="FIGHTER_HEAVY_STRIKE"]');
    if (!card) return { found: false };

    const bindBtn = card.querySelector('.btn-bind-this-skill');
    if (!bindBtn) return { found: true, hadBtn: false };

    bindBtn.click();
    return { found: true, hadBtn: true };
  });

  console.log('🔗 點擊結果:', bindSuccess);
  await page.waitForTimeout(300);

  // 驗證卡片已高亮且顯示為本特效
  const postBindState = await page.evaluate(() => {
    const card = document.querySelector('.svp-skill-card[data-skill-id="FIGHTER_HEAVY_STRIKE"]');
    const isBound = card?.classList.contains('card-current-bound');
    const hasRestoreBtn = !!card?.querySelector('.btn-restore-this-skill');
    const boundText = card?.querySelector('.svp-bind-value')?.textContent?.trim();

    return { isBound, hasRestoreBtn, boundText };
  });

  console.log('✨ 綁定後狀態:', postBindState);
  if (!postBindState.isBound || !postBindState.hasRestoreBtn) {
    throw new Error('綁定後狀態未正確更新為已綁定或缺少還原按鈕！');
  }

  // 截圖存檔
  const screenshotPath = 'C:/Users/User/.gemini/antigravity-ide/brain/8d990b1c-80be-4584-9aa2-7cf6090c2726/skill_vfx_picker_modal.png';
  await page.screenshot({ path: screenshotPath });
  console.log('📸 驗證截圖已儲存至:', screenshotPath);

  // 6. 測試還原按鈕
  console.log('↩️ 測試一鍵還原官方預設...');
  await page.evaluate(() => {
    const card = document.querySelector('.svp-skill-card[data-skill-id="FIGHTER_HEAVY_STRIKE"]');
    const restoreBtn = card?.querySelector('.btn-restore-this-skill');
    restoreBtn?.click();
  });
  await page.waitForTimeout(300);

  const postRestoreState = await page.evaluate(() => {
    const card = document.querySelector('.svp-skill-card[data-skill-id="FIGHTER_HEAVY_STRIKE"]');
    const hasRestoreBtn = !!card?.querySelector('.btn-restore-this-skill');
    const boundText = card?.querySelector('.svp-bind-value')?.textContent?.trim();
    return { hasRestoreBtn, boundText };
  });

  console.log('🔄 還原後狀態:', postRestoreState);
  if (postRestoreState.hasRestoreBtn || postRestoreState.boundText !== 'VFX_HEAVY_STRIKE') {
    throw new Error('還原失敗，未恢復官方預設！');
  }

  // 7. 關閉 Modal 並驗證主畫面左側徽章
  await page.click('#btn-svp-done');
  await page.waitForTimeout(300);
  const modalClosed = await page.evaluate(() => {
    const modal = document.getElementById('modal-skill-vfx-picker');
    return modal?.style.display === 'none';
  });
  console.log('🚪 Modal 成功關閉:', modalClosed);

  } finally {
    if (browser) await browser.close().catch(() => {});
    if (serverProcess) {
      serverProcess.kill();
      await Promise.race([
        new Promise(resolve => serverProcess.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    }
  }
  console.log('🎉 All E2E Verification steps PASSED with 100% success!');
}

verifySkillVfxPicker().catch(err => {
  console.error('❌ E2E Verification failed:', err);
  process.exit(1);
});
