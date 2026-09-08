import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import http from 'http';

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

async function run() {
  let serverProcess = null;
  if (!await isServerRunning()) {
    const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
    serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], { stdio: 'pipe' });
    await new Promise(r => setTimeout(r, 2000));
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(TEST_URL, { waitUntil: 'networkidle' });

  const cueDetails = await page.evaluate(() => {
    const el = document.getElementById('card-cue-inspector');
    if (!el) return { found: false };
    return {
      found: true,
      outerHTML: el.outerHTML,
      offsetWidth: el.offsetWidth,
      offsetHeight: el.offsetHeight,
      computedDisplay: window.getComputedStyle(el).display,
      computedVisibility: window.getComputedStyle(el).visibility,
      parentClassName: el.parentElement?.className,
      parentDisplay: el.parentElement ? window.getComputedStyle(el.parentElement).display : null,
      parentScrollHeight: el.parentElement?.scrollHeight,
      parentClientHeight: el.parentElement?.clientHeight
    };
  });
  console.log('Cue card debug details:', cueDetails);

  await browser.close();
  if (serverProcess) serverProcess.kill();
}

run();
