import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

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
  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    console.log('Starting vite dev server...');
    serverProcess = spawn('npx', ['vite', '--host', HOST, '--port', PORT.toString()], {
      stdio: 'pipe',
      shell: true
    });
    const ready = await waitForServer();
    if (!ready) {
      console.error('Failed to start vite server');
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
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

      const bodyText = document.body.innerText;
      const hasUndefined = bodyText.includes('undefined');
      const hasNaN = bodyText.includes('NaN');

      const canvasCount = document.querySelectorAll('canvas').length;

      return {
        clientWidth,
        scrollWidth,
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

    const passScroll = metrics.scrollWidth <= metrics.clientWidth + 1;
    const passVpHeight = metrics.viewportRect && metrics.viewportRect.height > 0;
    const passTimeline = metrics.timelineRect && metrics.timelineRect.height > 0 && metrics.hasRuler && metrics.hasPlayhead && metrics.cueCount > 0;
    const passNoLeak = !metrics.hasUndefined && !metrics.hasNaN;

    results.push({
      viewport: vp.name,
      ...metrics,
      pass: passScroll && passVpHeight && passTimeline && passNoLeak,
      screenshot: screenshotPath
    });
  }

  await browser.close();
  if (serverProcess) {
    serverProcess.kill();
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
  }
}

run().catch(err => {
  console.error('Fatal error running verification:', err);
  process.exit(1);
});
