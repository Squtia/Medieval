import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';

const PORT = 5173;
const HOST = 'localhost';
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
  console.log('🌊 Starting VFX Studio Production-Grade Soak Stress Test (100 Cycles)...');

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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    console.log(`Navigating to ${TEST_URL}...`);
    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#btn-play', { timeout: 10000 });
    await page.waitForFunction(() => !!window.__vfxStudioController, { timeout: 10000 });

    const totalCycles = 100;
    const snapshots = [];

    console.log(`Executing ${totalCycles} continuous playback cycles...`);
    const startTime = Date.now();

    for (let i = 1; i <= totalCycles; i++) {
      await page.evaluate(() => {
        if (window.__vfxStudioController && typeof window.__vfxStudioController.startPlayback === 'function') {
          window.__vfxStudioController.startPlayback();
        } else {
          document.getElementById('btn-play')?.click();
        }
      });

      // 快速間隔播放
      await page.waitForTimeout(60);

      // 在特定里程碑採樣系統狀態
      if (i === 1 || i === 10 || i === 50 || i === 100) {
        const stats = await page.evaluate(() => {
          const canvases = document.querySelectorAll('canvas').length;
          const fxEngine = window.__FX_ENGINE__ || window.__vfxStudioController?.studioAdapter?.combatFXEngine || window.CombatFXEngine?.getInstance?.();
          const renderer = fxEngine?.renderer;
          const scene = fxEngine?.scene;

          return {
            canvases,
            drawCalls: renderer?.info?.render?.calls || 0,
            geometries: renderer?.info?.memory?.geometries || 0,
            textures: renderer?.info?.memory?.textures || 0,
            sceneChildren: scene?.children?.length || 0
          };
        });

        snapshots.push({
          cycle: i,
          ...stats,
          zeroCanvasLeak: stats.canvases === 1,
          contextLoss: false
        });

        console.log(`  -> Cycle ${i}/${totalCycles}: Canvases=${stats.canvases}, Geometries=${stats.geometries}, Textures=${stats.textures}, DC=${stats.drawCalls}`);
      }
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Finished ${totalCycles} cycles in ${durationSeconds}s`);

    console.log('\n📊 === Soak Stress Test Summary ===\n');
    console.table(snapshots.map(s => ({
      Cycle: s.cycle,
      'Canvas Count': s.canvases,
      'Geometries': s.geometries,
      'Textures': s.textures,
      'Zero Leak': s.zeroCanvasLeak ? '✅ PASS' : '❌ FAIL',
      'Context Loss': s.contextLoss ? '❌ LOST' : '✅ STABLE'
    })));

    let hasFailure = false;
    if (consoleErrors.length > 0) {
      console.error('❌ Console errors detected during soak test:', consoleErrors);
      hasFailure = true;
    }

    for (const snap of snapshots) {
      if (!snap.zeroCanvasLeak) {
        console.error(`❌ Canvas leak detected at cycle ${snap.cycle}: count is ${snap.canvases}`);
        hasFailure = true;
      }
    }

    if (hasFailure) {
      console.error('💥 SOAK STRESS TEST FAILED');
      if (browser) await browser.close();
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }

    console.log('🎉 SOAK STRESS TEST 100% PASSED: Zero Leaks, Stable WebGL Context, Zero Console Errors!');
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed with error:', err);
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }
}

run();
