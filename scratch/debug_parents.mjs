import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;

async function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(TEST_URL, (res) => resolve(res.statusCode === 200 || res.statusCode === 304));
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
    const ready = await waitForServer();
    if (!ready) {
      console.error('Failed to start vite server');
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(TEST_URL, { waitUntil: 'networkidle' });

  const path = await page.evaluate(() => {
    const el = document.getElementById('card-cue-inspector');
    if (!el) return 'NOT_FOUND';
    let curr = el;
    const chain = [];
    while (curr) {
      chain.push({
        tag: curr.tagName,
        id: curr.id,
        className: curr.className,
        display: window.getComputedStyle(curr).display,
        visibility: window.getComputedStyle(curr).visibility
      });
      curr = curr.parentElement;
    }
    return chain;
  });

  console.log('Parent Chain:', JSON.stringify(path, null, 2));

  // 截全頁長圖
  await page.screenshot({ path: 'docs/screenshots/full_page_debug.png', fullPage: true });

  await browser.close();
  if (serverProcess) serverProcess.kill();
}

run();
