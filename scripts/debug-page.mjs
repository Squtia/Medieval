import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  await page.goto('http://localhost:5173/tools/combat-studio.html');
  await page.waitForTimeout(3000);
  const rootText = await page.$eval('#combat-studio-root', el => el.innerHTML.slice(0, 300));
  console.log('ROOT HTML:', rootText);
  await browser.close();
}

main().catch(console.error);
