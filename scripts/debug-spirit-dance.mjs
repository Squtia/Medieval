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
  let serverProcess = null;
  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
    serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], {
      stdio: 'pipe',
      shell: false
    });
    await waitForServer();
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, route => {
    route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });

  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  // 選中「精靈矢雨」
  await page.selectOption('#preset-selector', { label: '[彈道] 精靈矢雨 (Spirit Dance)' });
  await page.waitForTimeout(500);

  // 讀取當前狀態與求值時的真實座標
  const debugInfo = await page.evaluate(() => {
    const fx = window.fxEngine || window.CombatFXEngine?.getInstance?.();
    const store = window.vfxStudio?.store;
    const controller = window.vfxStudio?.controller;
    const preset = store ? store.getPreset() : null;

    const casterEl = document.getElementById('ref-caster');
    const targetEl = document.querySelector('#target-stage-wrapper .target, #ref-target');
    const casterRect = casterEl ? casterEl.getBoundingClientRect() : null;
    const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;

    const fxEngine = window.__vfxStudioEngine || (controller ? controller.fxEngine : null);

    return {
      presetId: preset?.id,
      presetName: preset?.name,
      spatialMode: preset?.spatialMode,
      trajectoryPath: preset?.trajectoryPath,
      trajectory: preset?.trajectory,
      arcHeight: preset?.arcHeight,
      salvoSpreadRadius: preset?.salvoSpreadRadius,
      salvoSpreadAngle: preset?.salvoSpreadAngle,
      casterRect,
      targetRect
    };
  });

  try {
    console.log('工坊真實狀態:', JSON.stringify(debugInfo, null, 2));
  } finally {
    await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

run().catch(console.error);
