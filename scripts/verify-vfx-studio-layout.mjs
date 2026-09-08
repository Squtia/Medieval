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
  console.log('🚀 Starting VFX Studio Layout & DOM Contract Verification...');

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
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, route => {
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '/* mock font */'
      });
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('fonts.googleapis.com') || text.includes('fonts.gstatic.com') || text.includes('net::ERR_NETWORK_ACCESS_DENIED')) {
        return;
      }
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else if (msg.type() === 'warn') {
        console.log('PAGE WARN:', text);
      }
    });
    page.on('pageerror', err => {
      if (err.message.includes('fonts.googleapis.com') || err.message.includes('ERR_NETWORK_ACCESS_DENIED')) {
        return;
      }
      consoleErrors.push(err.message);
    });

    const viewports = [
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1280, height: 720, name: '1280x720' },
      { width: 1024, height: 768, name: '1024x768' },
      { width: 768, height: 900, name: '768x900' }
    ];

    const results = [];

    const screenshotDir = path.resolve(process.cwd(), 'docs/screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(TEST_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      const metrics = await page.evaluate(() => {
        const clientWidth = document.documentElement.clientWidth;
        const scrollWidth = document.body.scrollWidth;

        const vpEl = document.getElementById('viewport');
        const vpRect = vpEl ? vpEl.getBoundingClientRect() : null;

        const timelineEl = document.getElementById('timeline-mount-point');
        const timelineRect = timelineEl ? timelineEl.getBoundingClientRect() : null;

        const hasRuler = !!document.getElementById('tl-ruler-bar');
        const hasPlayhead = !!document.getElementById('tl-playhead');
        const cueCount = document.querySelectorAll('.tl-cue-marker').length;

        const inspectorEl = document.getElementById('inspector-right');
        const inspectorRect = inspectorEl ? inspectorEl.getBoundingClientRect() : null;

        const overflowing = [];
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > clientWidth + 0.5 || rect.left < -0.5 || el.scrollWidth > clientWidth) {
            overflowing.push({ tag: el.tagName, id: el.id, cls: el.className, left: Math.round(rect.left), right: Math.round(rect.right), w: el.offsetWidth, sw: el.scrollWidth });
          }
        });
        const bodyText = document.body.innerText;
        const hasUndefined = bodyText.includes('undefined');
        const hasNaN = bodyText.includes('NaN');
        const canvasCount = document.querySelectorAll('canvas').length;

        return {
          clientWidth,
          scrollWidth,
          overflowing,
          viewportRect: vpRect ? { x: Math.round(vpRect.x), y: Math.round(vpRect.y), width: Math.round(vpRect.width), height: Math.round(vpRect.height) } : null,
          timelineRect: timelineRect ? { x: Math.round(timelineRect.x), y: Math.round(timelineRect.y), width: Math.round(timelineRect.width), height: Math.round(timelineRect.height) } : null,
          hasRuler,
          hasPlayhead,
          cueCount,
          inspectorRect: inspectorRect ? { x: Math.round(inspectorRect.x), y: Math.round(inspectorRect.y), width: Math.round(inspectorRect.width), height: Math.round(inspectorRect.height) } : null,
          hasUndefined,
          hasNaN,
          canvasCount
        };
      });

      const screenshotPath = path.join(screenshotDir, `vfx_studio_${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      // 📱 規格 §10.4 條款：針對 768px 執行專屬工作區 Tab 與可見性斷言
      let passWorkspaceWorkflow = true;
      if (vp.width === 768) {
        console.log('📱 執行 768px 工作區 Tab 切換與首屏可見性驗證 (規格 §10)...');

        const tabWorkflowMetrics = await page.evaluate(async () => {
          const tabsBar = document.getElementById('vfx-workspace-tabs');
          const isTabsVisible = tabsBar && getComputedStyle(tabsBar).display !== 'none';

          // 預設 (stage 視圖)：左側面板與 Inspector 側面板應隱藏
          const leftSidebar = document.querySelector('.sidebar-left');
          const rightSidebar = document.getElementById('inspector-right');
          const leftHidden = leftSidebar && getComputedStyle(leftSidebar).display === 'none';
          const rightHidden = rightSidebar && getComputedStyle(rightSidebar).display === 'none';

          // 切換至 Timeline (時間軸)
          const timelineBtn = document.getElementById('tab-btn-timeline');
          if (timelineBtn) timelineBtn.click();
          await new Promise(r => setTimeout(r, 150));

          const tlEl = document.getElementById('timeline-mount-point');
          const tlRect = tlEl ? tlEl.getBoundingClientRect() : null;
          const timelineOperable = tlRect && tlRect.height > 0;

          // 切換至 Inspector (屬性面板)
          const inspectorBtn = document.getElementById('tab-btn-inspector');
          if (inspectorBtn) inspectorBtn.click();
          await new Promise(r => setTimeout(r, 150));

          const inspectorVisible = rightSidebar && getComputedStyle(rightSidebar).display !== 'none';
          const inspRect = rightSidebar ? rightSidebar.getBoundingClientRect() : null;
          const inspectorInViewport = inspRect && inspRect.top >= 0 && inspRect.top < window.innerHeight;

          // 切回 Stage (舞台)
          const stageBtn = document.getElementById('tab-btn-stage');
          if (stageBtn) stageBtn.click();
          await new Promise(r => setTimeout(r, 150));

          const canvasEl = document.querySelector('#viewport canvas');
          const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : null;
          const canvasOperable = canvasRect && canvasRect.width > 0 && canvasRect.height > 0;

          const playBtn = document.getElementById('btn-play');
          const playBtnOperable = playBtn && getComputedStyle(playBtn).display !== 'none';

          return {
            isTabsVisible,
            leftHidden,
            rightHidden,
            timelineOperable,
            inspectorVisible,
            inspectorInViewport,
            canvasOperable,
            playBtnOperable,
            timelineRect768: tlRect ? { width: Math.round(tlRect.width), height: Math.round(tlRect.height) } : null,
            inspectorRect768: inspRect ? { width: Math.round(inspRect.width), height: Math.round(inspRect.height) } : null
          };
        });

        console.log('  768px Tab 指標結果:', JSON.stringify(tabWorkflowMetrics, null, 2));

        if (!tabWorkflowMetrics.isTabsVisible) {
          console.error('❌ 768px 下缺少可見的工作區 Tab 切換器 (#vfx-workspace-tabs)');
          passWorkspaceWorkflow = false;
        }
        if (!tabWorkflowMetrics.leftHidden || !tabWorkflowMetrics.rightHidden) {
          console.error('❌ 768px 預設舞台視圖下未隱藏主要側面板');
          passWorkspaceWorkflow = false;
        }
        if (!tabWorkflowMetrics.timelineOperable) {
          console.error('❌ 768px 切換至時間軸後 Timeline 高度未大於 0');
          passWorkspaceWorkflow = false;
        }
        if (!tabWorkflowMetrics.inspectorVisible || !tabWorkflowMetrics.inspectorInViewport) {
          console.error('❌ 768px 切換至 Inspector 後屬性面板未進入首屏 Viewport');
          passWorkspaceWorkflow = false;
        }
        if (!tabWorkflowMetrics.canvasOperable || !tabWorkflowMetrics.playBtnOperable) {
          console.error('❌ 768px 切回舞台後 Canvas 或播放按鈕不可操作');
          passWorkspaceWorkflow = false;
        }

        // 截一張 Inspector 視圖截圖保存驗收
        await page.evaluate(() => {
          document.getElementById('tab-btn-inspector')?.click();
        });
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(screenshotDir, 'vfx_studio_768x900_inspector.png'), fullPage: false });

        // 切回舞台視圖
        await page.evaluate(() => {
          document.getElementById('tab-btn-stage')?.click();
        });
        await page.waitForTimeout(200);

        if (tabWorkflowMetrics.timelineRect768) {
          metrics.timelineRect = tabWorkflowMetrics.timelineRect768;
        }
        if (tabWorkflowMetrics.inspectorRect768) {
          metrics.inspectorRect = tabWorkflowMetrics.inspectorRect768;
        }
      }

      const passScroll = metrics.scrollWidth <= metrics.clientWidth + 1;
      const passVpHeight = metrics.viewportRect && metrics.viewportRect.height > 0;
      const passTimeline = metrics.timelineRect && metrics.timelineRect.height > 0 && metrics.hasRuler && metrics.hasPlayhead && metrics.cueCount > 0;
      const passNoLeak = !metrics.hasUndefined && !metrics.hasNaN;

      if (!passScroll) {
        console.warn(`[${vp.name}] Overflowing elements:`, JSON.stringify(metrics.overflowing, null, 2));
      }

      results.push({
        viewport: vp.name,
        ...metrics,
        pass: passScroll && passVpHeight && passTimeline && passNoLeak && passWorkspaceWorkflow,
        screenshot: screenshotPath
      });
    }

    console.log('\n📊 === Viewport Layout Verification Results ===\n');
    console.table(results.map(r => ({
      Viewport: r.viewport,
      'Client/Scroll W': `${r.clientWidth} / ${r.scrollWidth}`,
      'Viewport (WxH)': r.viewportRect ? `${r.viewportRect.width}x${r.viewportRect.height}` : 'N/A',
      'Timeline (WxH)': r.timelineRect ? `${r.timelineRect.width}x${r.timelineRect.height}` : 'N/A',
      'Inspector (WxH)': r.inspectorRect ? `${r.inspectorRect.width}x${r.inspectorRect.height}` : 'N/A',
      'Zero Leak': !r.hasUndefined && !r.hasNaN,
      'Canvas Count': r.canvasCount,
      Status: r.pass ? '✅ PASS' : '❌ FAIL'
    })));

    if (consoleErrors.length > 0) {
      console.warn('⚠️ Console Errors detected:', consoleErrors);
    } else {
      console.log('✅ Console is completely clean (0 errors).');
    }

    const allPassed = results.every(r => r.pass) && consoleErrors.length === 0;
    if (!allPassed) {
      console.error('❌ Verification failed for one or more viewports.');
      process.exit(1);
    } else {
      console.log('🎉 ALL 4 VIEWPORTS AND DOM CONTRACTS VERIFIED SUCCESSFULLY!');
      process.exit(0);
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (serverProcess) {
      console.log('🧹 Cleaning up vite dev server...');
      serverProcess.kill();
      await Promise.race([
        new Promise(resolve => serverProcess.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
      serverProcess.stdout?.destroy();
      serverProcess.stderr?.destroy();
    }
  }
}

run().catch(err => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});
