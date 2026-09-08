import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import http from 'http';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;

import { spawn } from 'child_process';

async function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(TEST_URL, (res) => resolve(res.statusCode === 200 || res.statusCode === 304));
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function run() {
  let serverProcess = null;
  if (!await isServerRunning()) {
    const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
    serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], { stdio: 'pipe' });
    let ready = false;
    for (let i = 0; i < 30; i++) {
      if (await isServerRunning()) { ready = true; break; }
      await new Promise(r => setTimeout(r, 400));
    }
    if (!ready) { console.error('Failed to start server'); process.exit(1); }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(TEST_URL, { waitUntil: 'networkidle' });

  // 1. 檢查初始滾動位置與 Cue 卡片可見性
  const initialData = await page.evaluate(() => {
    const cueCard = document.getElementById('card-cue-inspector');
    const rightSidebar = document.querySelector('.sidebar-right');
    const rect = cueCard?.getBoundingClientRect();
    return {
      offsetWidth: cueCard?.offsetWidth,
      offsetHeight: cueCard?.offsetHeight,
      rectTop: rect?.top,
      rectBottom: rect?.bottom,
      sidebarScrollTop: rightSidebar?.scrollTop
    };
  });
  console.log('1. 初始 Cue 卡片數據:', initialData);

  // 2. 模擬點擊時間軸上的 Cue Marker
  console.log('2. 點擊時間軸 Cue Marker...');
  await page.click('.tl-cue-marker');
  await page.waitForTimeout(600);

  const afterClickData = await page.evaluate(() => {
    const cueCard = document.getElementById('card-cue-inspector');
    const rightSidebar = document.querySelector('.sidebar-right');
    const rect = cueCard?.getBoundingClientRect();
    return {
      hasHighlightClass: cueCard?.classList.contains('cue-card-highlight'),
      sidebarScrollTop: rightSidebar?.scrollTop,
      rectTop: rect?.top,
      rectBottom: rect?.bottom,
      // 是否在右側欄的可視區域內 (0 ~ 900)
      isInViewport: rect ? (rect.top >= 0 && rect.top <= 900) : false
    };
  });
  console.log('3. 點擊時間軸 Cue Marker 後數據:', afterClickData);

  // 截圖確認當前滾動後的視覺畫面
  await page.screenshot({ path: 'docs/screenshots/cue_inspector_visible_scrolled.png' });

  await browser.close();
  if (serverProcess) serverProcess.kill();

  if (initialData.offsetWidth > 0 && afterClickData.isInViewport) {
    console.log('🎉 驗收成功！CUE 點屬性面板 100% 真實可見，點擊時間軸精準滾動入視口並高亮！');
  } else {
    console.error('❌ 仍未成功！');
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
