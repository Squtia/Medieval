import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';

const PORT = 5173;
const BASE_PATH = '/Medieval/';
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}${BASE_PATH}`;

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

async function main() {
  console.log('🚀 Starting P0 Automated Smoke Test...');

  let serverProcess = null;
  const running = await isServerRunning();

  if (!running) {
    console.log(`📦 Starting Vite server on ${TEST_URL}...`);
    const isWin = process.platform === 'win32';
    const npxCmd = isWin ? 'npx.cmd' : 'npx';

    serverProcess = spawn(npxCmd, ['vite', '--port', String(PORT), '--host', HOST], {
      stdio: 'pipe',
      shell: isWin,
    });

    serverProcess.stdout?.on('data', (d) => console.log(`[Vite Server] ${d.toString().trim()}`));
    serverProcess.stderr?.on('data', (d) => console.error(`[Vite Server Err] ${d.toString().trim()}`));

    const ready = await waitForServer(20000);
    if (!ready) {
      throw new Error('❌ Failed to start Vite server for smoke test.');
    }
  }

  console.log('🌐 Server ready. Launching Headless Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Auto-accept all window.confirm / window.alert dialogs
  page.on('dialog', async (dialog) => {
    console.log(`  💬 [Dialog Accepted] "${dialog.message()}"`);
    await dialog.accept();
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`[Browser Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
    console.error(`[Browser PageError] ${err.toString()}`);
  });

  try {
    // Stage 1: Main Menu & Save Slot Selection
    console.log('📍 Stage 1: Loading Main Menu and starting journey...');
    await page.goto(TEST_URL);
    await page.waitForSelector('#btn-enter-journey', { state: 'visible', timeout: 10000 });
    console.log('  ✅ Main menu loaded.');

    await page.click('#btn-enter-journey');
    await page.waitForSelector('#modal-load-game.active', { state: 'visible', timeout: 5000 });
    console.log('  ✅ Save slot modal opened.');

    // Click the first save slot button (triggers window.confirm)
    await page.waitForSelector('#save-slots-container button', { state: 'visible', timeout: 5000 });
    const slotButtons = await page.$$('#save-slots-container button');
    if (slotButtons.length === 0) {
      throw new Error('No save slot buttons found.');
    }
    await slotButtons[0].click();
    await page.waitForTimeout(1000);

    // Trigger base node selection via phaser event
    console.log('  ✅ Map view reached. Dispatching base node selection event...');
    const dispatched = await page.evaluate(() => {
      const gs = window.GameState;
      if (!gs || !gs.mapSystem) {
        return { success: false, reason: 'GameState or mapSystem is missing on window' };
      }
      const nodes = gs.mapSystem.getNodes();
      const target = nodes.find((n) => n.feature === 'OCCUPIABLE') || nodes[0];
      if (!target) {
        return { success: false, reason: 'No map nodes found' };
      }
      document.dispatchEvent(new CustomEvent('phaser-node-clicked', { detail: { node: target } }));
      return { success: true, nodeName: target.name };
    });

    if (!dispatched.success) {
      throw new Error(`Failed to dispatch node selection: ${dispatched.reason}`);
    }
    console.log(`  ✅ Base node event dispatched for target: [${dispatched.nodeName}].`);
    await page.waitForTimeout(500);

    // Confirm starting base node modal
    await page.waitForSelector('#modal-node-select.active', { state: 'visible', timeout: 5000 });
    console.log('  ✅ Node selection modal visible. Confirming starting base...');
    await page.click('#btn-confirm-node');
    await page.waitForTimeout(1000);

    // Stage 2: Base Street & Top Bar Verification
    console.log('📍 Stage 2: Verifying Base Street and Top Bar UI...');
    await page.waitForSelector('#scene-view.active', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#top-bar', { state: 'visible', timeout: 10000 });

    const dateText = await page.textContent('#ui-date');
    console.log(`  📅 Current Date: ${dateText?.trim()}`);
    if (!dateText || !dateText.includes('第 1 年 1 月 1 日')) {
      throw new Error(`Unexpected starting date: ${dateText}`);
    }
    console.log('  ✅ Initial date correctly initialized to 第 1 年 1 月 1 日.');

    // Enter Lord's Base Study
    console.log('  🏰 Entering Lord Base facility...');
    await page.waitForSelector('#btn-enter-base', { state: 'visible', timeout: 5000 });
    await page.click('#btn-enter-base');
    await page.waitForSelector('#view-base.active', { state: 'visible', timeout: 5000 });
    console.log('  ✅ Base facility entered.');

    // Exit facility back to street
    await page.click('.btn-exit-facility');
    await page.waitForTimeout(500);
    console.log('  ✅ Returned to town street.');

    // Stage 3: End Day (Date Increment)
    console.log('📍 Stage 3: Testing End Day (結束本日)...');
    await page.waitForSelector('#btn-end-day', { state: 'visible', timeout: 5000 });
    await page.click('#btn-end-day');
    await page.waitForTimeout(1200);

    const nextDateText = await page.textContent('#ui-date');
    console.log(`  📅 Date after End Day: ${nextDateText?.trim()}`);
    if (!nextDateText || !nextDateText.includes('第 1 年 1 月 2 日')) {
      throw new Error(`Unexpected date after End Day: ${nextDateText}`);
    }
    console.log('  ✅ Date successfully incremented to 第 1 年 1 月 2 日.');

    // Stage 4: System Settings Menu & Save Game
    console.log('📍 Stage 4: Testing System Settings & Save Game...');
    await page.waitForSelector('#btn-system-menu', { state: 'visible', timeout: 5000 });
    await page.click('#btn-system-menu');

    await page.waitForSelector('#modal-system-menu.active', { state: 'visible', timeout: 5000 });
    console.log('  ✅ System settings menu modal displayed.');

    await page.waitForSelector('#btn-manual-save', { state: 'visible', timeout: 5000 });
    await page.click('#btn-manual-save');
    await page.waitForTimeout(500);

    // Verify localStorage contains save data
    const saveData = await page.evaluate(() => localStorage.getItem('idle_rpg_save_1') || localStorage.getItem('medieval_rpg_save_v2'));
    if (!saveData || saveData.length < 10) {
      throw new Error('Save data not found or invalid in localStorage after manual save.');
    }
    console.log(`  💾 Save data successfully written to localStorage (${saveData.length} bytes).`);

    // Stage 5: Reload Page & Persistence Check
    console.log('📍 Stage 5: Reloading page & verifying state persistence...');
    await page.reload();
    await page.waitForSelector('#btn-enter-journey', { state: 'visible', timeout: 10000 });

    const reloadedSaveData = await page.evaluate(() => localStorage.getItem('idle_rpg_save_1') || localStorage.getItem('medieval_rpg_save_v2'));
    if (!reloadedSaveData) {
      throw new Error('Save data disappeared after page reload.');
    }
    console.log('  ✅ Save data persisted cleanly across page reload.');

    if (consoleErrors.length > 0) {
      throw new Error(`Uncaught console errors detected during smoke test:\n${consoleErrors.join('\n')}`);
    }

    console.log('\n🎉 ALL P0 SMOKE TEST STAGES PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
    if (serverProcess) {
      console.log('🧹 Cleaning up server process...');
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']);
      } else {
        serverProcess.kill();
      }
    }
  }
}

main().catch((err) => {
  console.error('\n💥 SMOKE TEST FAILED:');
  console.error(err);
  process.exit(1);
});
