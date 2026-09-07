import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5174/Medieval/tools/vfx-studio.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const res = await page.evaluate(() => {
    const timeDisplay = document.querySelector('#tl-time-display')?.textContent;
    const ticks = Array.from(document.querySelectorAll('.tl-ruler-bar span')).map(s => s.textContent);
    const durInput = document.querySelector('#param-duration')?.value;
    const salvoInput = document.querySelector('#param-salvo-dur')?.value;
    const layerClips = Array.from(document.querySelectorAll('.tl-layer-clip')).map(el => ({
      left: el.style.left,
      width: el.style.width,
      text: el.textContent?.trim()
    }));
    return { timeDisplay, ticks, durInput, salvoInput, layerClips };
  });

  console.log('TIMELINE_DOM:', JSON.stringify(res, null, 2));
  await browser.close();
}

run();
