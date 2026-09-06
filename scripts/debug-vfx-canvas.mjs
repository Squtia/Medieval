import { chromium } from 'playwright';
import http from 'http';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(TEST_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. 點擊暫停與拖曳時間軸
  const btnPlayPause = page.locator('#tl-btn-play-pause');
  await btnPlayPause.click();
  await page.waitForTimeout(300);

  const rulerEl = page.locator('#tl-ruler-bar');
  const box = await rulerEl.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(300);
  }

  // 2. 深入檢查瀏覽器內的狀態
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('#viewport canvas');
    
    // 取得 window.controller 或 CombatFXEngine
    // 檢查全域
    const win = window;
    const vp = document.getElementById('viewport');
    const caster = document.getElementById('ref-caster');
    const target = document.querySelector('#target-stage-wrapper .target, #ref-target');

    return {
      canvas: canvas ? { width: canvas.width, height: canvas.height, styleW: canvas.style.width, styleH: canvas.style.height } : null,
      winKeys: Object.keys(win).filter(k => k.includes('VFX') || k.includes('fx') || k.includes('controller') || k.includes('Combat')),
      vpRect: vp ? vp.getBoundingClientRect() : null,
      targetRect: target ? target.getBoundingClientRect() : null,
      casterRect: caster ? caster.getBoundingClientRect() : null
    };
  });

  console.log('=== BROWSER THREE.JS DIAGNOSTIC ===');
  console.log(JSON.stringify(state, null, 2));

  await browser.close();
}

run();
