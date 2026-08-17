import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';

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
    const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
    serverProcess = spawn(process.execPath, [viteBin, '--port', String(PORT), '--host', HOST], {
      stdio: 'pipe',
      shell: false,
    });

    serverProcess.stdout?.on('data', (d) => console.log(`[Vite Server] ${d.toString().trim()}`));
    serverProcess.stderr?.on('data', (d) => console.error(`[Vite Server Err] ${d.toString().trim()}`));

    const ready = await waitForServer(20000);
    if (!ready) {
      throw new Error('❌ Failed to start Vite server for smoke test.');
    }
  }

  console.log('🌐 Server ready. Launching Headless Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-logging', '--log-level=3'],
    env: {
      ...process.env,
      CHROME_LOG_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null'
    }
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Auto-accept all window.confirm / window.alert dialogs
  page.on('dialog', async (dialog) => {
    console.log(`  💬 [Dialog Accepted] "${dialog.message()}"`);
    await dialog.accept();
  });

  const consoleErrors = [];
  const failedRequests = [];
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || 'unknown request failure'
    });
  });
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

    // Click the first save slot button and configure the seeded Roguelike world.
    await page.waitForSelector('#save-slots-container button', { state: 'visible', timeout: 5000 });
    const slotButtons = await page.$$('#save-slots-container button');
    if (slotButtons.length === 0) {
      throw new Error('No save slot buttons found.');
    }
    await slotButtons[0].click();
    await page.waitForSelector('#modal-new-game.active', { state: 'visible', timeout: 5000 });
    console.log('  ✅ New journey setup modal opened.');
    await page.fill('#new-game-seed', 'smoke-test-seed');
    await page.click('#btn-confirm-new-game');

    // New journeys now pass through oath creation and the prologue before gameplay.
    await page.waitForSelector('#modal-oath-creation', { state: 'visible', timeout: 5000 });
    await page.fill('#ipt-oath-name', 'Smoke守衛');
    await page.click('#btn-confirm-oath');
    await page.waitForSelector('#btn-skip-prologue', { state: 'visible', timeout: 15000 });
    await page.click('#btn-skip-prologue');
    await page.waitForSelector('#overlay-prologue', { state: 'hidden', timeout: 5000 });
    console.log('  ✅ Oath creation and prologue completed.');

    // Stage 2: Base Street & Top Bar Verification
    console.log('📍 Stage 2: Verifying Base Street and Top Bar UI...');
    await page.waitForSelector('#scene-view.active', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#top-bar', { state: 'visible', timeout: 10000 });

    const generatedWorld = await page.evaluate(() => {
      const gs = window.GameState;
      const playerBases = gs?.mapSystem?.getNodes().filter((node) => node.isPlayerBase) || [];
      return {
        seed: gs?.worldGeneration?.seed,
        difficulty: gs?.worldGeneration?.difficulty,
        baseCount: playerBases.length,
        baseId: playerBases[0]?.id,
        baseName: playerBases[0]?.name,
        baseLevel: playerBases[0]?.nodeLevel,
        discoveredCount: gs?.mapSystem?.getNodes().filter((node) => node.isDiscovered).length,
        revealedCells: gs?.explorationSystem?.getData().cells.filter(Boolean).length,
        totalCells: gs?.explorationSystem?.getData().cells.length
      };
    });
    if (
      generatedWorld.seed !== 'smoke-test-seed' ||
      generatedWorld.difficulty !== 'NORMAL' ||
      generatedWorld.baseCount !== 1 ||
      generatedWorld.baseId === 'player_base' ||
      generatedWorld.baseName === '流浪傭兵團' ||
      generatedWorld.baseLevel !== 0 ||
      generatedWorld.discoveredCount !== 1 ||
      !(generatedWorld.revealedCells > 0) ||
      !(generatedWorld.revealedCells < generatedWorld.totalCells)
    ) {
      throw new Error(`Unexpected generated world: ${JSON.stringify(generatedWorld)}`);
    }
    console.log('  ✅ Seeded world promoted an original named settlement to player base correctly.');

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

    // Stage 2.5: Dispatch a scout from the map.
    await page.click('#btn-return-base');
    await page.waitForSelector('#map-view.active', { state: 'visible', timeout: 5000 });
    await page.waitForSelector('#btn-toggle-exploration', { state: 'visible', timeout: 5000 });
    await page.click('#btn-toggle-exploration');
    const explorationBefore = await page.evaluate(() => {
      const gs = window.GameState;
      const origin = gs.mapSystem.getNodes().find((node) => node.isPlayerBase);
      const system = gs.explorationSystem;
      const beforeCells = system.getData().cells.filter(Boolean).length;
      for (const distance of [110, 120, 130, 140, 150]) {
        for (let degree = 0; degree < 360; degree += 5) {
          const angle = degree * Math.PI / 180;
          const x = origin.x + (Math.cos(angle) * distance / 1600) * 100;
          const y = origin.y + (Math.sin(angle) * distance / 900) * 100;
          if (system.checkTarget(origin, x, y).valid) {
            document.dispatchEvent(new CustomEvent('phaser-map-clicked', { detail: { x, y } }));
            const firstCard = document.querySelector('#exp-cards-grid .adventurer-card');
            if (firstCard) firstCard.click();
            const btnConfirm = document.getElementById('exp-btn-confirm');
            if (btnConfirm) btnConfirm.click();
            return { beforeCells, x, y };
          }
        }
      }
      throw new Error('No legal exploration target found around the starting base.');
    });
    await page.waitForFunction(() => Boolean(window.GameState.explorationSystem.getActiveExpedition()));
    const dispatchedScout = await page.evaluate(() => ({
      expedition: window.GameState.explorationSystem.getActiveExpedition(),
      explorerState: window.GameState.adventurers[0]?.currentState
    }));
    if (!dispatchedScout.expedition || dispatchedScout.explorerState !== 'DISPATCHED') {
      throw new Error(`Scout dispatch failed: ${JSON.stringify(dispatchedScout)}`);
    }
    console.log('  Scout expedition dispatched from a legal fog frontier target.');

    const roadTarget = await page.evaluate(() => {
      const gs = window.GameState;
      const origin = gs.mapSystem.getNodes().find((node) => node.isPlayerBase);
      const candidates = gs.mapSystem.getNodes()
        .filter((node) => !node.isPlayerBase && node.ownerFactionId !== 'player')
        .sort((first, second) => {
          const firstCheck = gs.roadSystem.checkTarget(origin, first, gs.explorationSystem, gs.mapSystem.getNodes());
          const secondCheck = gs.roadSystem.checkTarget(origin, second, gs.explorationSystem, gs.mapSystem.getNodes());
          const firstDays = firstCheck.valid ? (firstCheck.requiredDays ?? 999) : 999;
          const secondDays = secondCheck.valid ? (secondCheck.requiredDays ?? 999) : 999;
          return firstDays - secondDays;
        });
      for (const node of candidates) {
        gs.explorationSystem.revealAllCells();
        node.isDiscovered = true;
        const check = gs.roadSystem.checkTarget(origin, node, gs.explorationSystem, gs.mapSystem.getNodes());
        if (check.valid) {
          document.dispatchEvent(new CustomEvent('phaser-node-clicked', { detail: { node } }));
          return { id: node.id, name: node.name };
        }
      }
      throw new Error('No legal road target found among generated nodes.');
    });
    await page.waitForSelector('#btn-build-road', { state: 'visible', timeout: 5000 });
    const roadButtonDisabled = await page.$eval('#btn-build-road', (button) => button.disabled);
    if (roadButtonDisabled) throw new Error('Legal road target produced a disabled build button.');
    await page.click('#btn-build-road');
    await page.waitForFunction(() => Boolean(window.GameState.roadSystem.getActiveProject()));
    console.log(`  Road construction started toward ${roadTarget.name}.`);

    // Stage 3: End Day (Date Increment)
    console.log('📍 Stage 3: Testing End Day (結束本日)...');
    await page.waitForSelector('#btn-end-day', { state: 'visible', timeout: 5000 });
    await page.click('#btn-end-day', { force: true });
    await page.waitForTimeout(1500);

    try {
      const confirmSummaryBtn = await page.waitForSelector('#btn-daily-summary-confirm', { state: 'visible', timeout: 3000 });
      if (confirmSummaryBtn) {
        await confirmSummaryBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('  ℹ️ Daily summary modal confirm button not needed or timed out.');
    }

    const nextDateText = await page.textContent('#ui-date');
    console.log(`  📅 Date after End Day: ${nextDateText?.trim()}`);
    if (!nextDateText || !nextDateText.includes('第 1 年 1 月 2 日')) {
      throw new Error(`Unexpected date after End Day: ${nextDateText}`);
    }
    console.log('  ✅ Date successfully incremented to 第 1 年 1 月 2 日.');

    const explorationAfter = await page.evaluate(() => {
      const data = window.GameState.explorationSystem.getData();
      return {
        revealedCells: data.cells.filter(Boolean).length,
        expedition: data.expeditions.at(-1),
        explorerState: window.GameState.adventurers[0]?.currentState
      };
    });
    if (
      explorationAfter.revealedCells <= explorationBefore.beforeCells ||
      explorationAfter.expedition?.elapsedDays !== 1 ||
      (explorationAfter.expedition?.status === 'COMPLETED' && explorationAfter.explorerState !== 'IDLE')
    ) {
      throw new Error(`Scout did not progress correctly: ${JSON.stringify(explorationAfter)}`);
    }
    console.log('  Scout advanced one day and revealed additional map cells.');

    const roadAfter = await page.evaluate(() => {
      const gs = window.GameState;
      const data = gs.roadSystem.getData();
      const road = data.roads[0];
      let benefits = null;
      if (road) {
        const origin = gs.mapSystem.getNodeById(road.originNodeId);
        const target = gs.mapSystem.getNodeById(road.targetNodeId);
        benefits = {
          travel: gs.roadSystem.getTravelDays(origin, target),
          ambushChance: gs.roadSystem.getAmbushChance(origin, target),
          trade: gs.roadSystem.getTradeModifiers(origin, target)
        };
      }
      return {
        project: data.projects.at(-1),
        roads: data.roads,
        benefits
      };
    });
    if (
      roadAfter.project?.elapsedDays !== 1 ||
      (roadAfter.project?.status === 'COMPLETED' && roadAfter.roads.length !== 1)
    ) {
      throw new Error(`Road construction did not progress correctly: ${JSON.stringify(roadAfter)}`);
    }
    if (
      roadAfter.project?.status === 'COMPLETED' &&
      (
        !roadAfter.benefits?.travel?.hasRoad ||
        roadAfter.benefits.ambushChance !== 0.05 ||
        roadAfter.benefits.trade.buyPriceMultiplier !== 0.95 ||
        roadAfter.benefits.trade.sellPriceMultiplier !== 1.1
      )
    ) {
      throw new Error(`Completed road benefits are incorrect: ${JSON.stringify(roadAfter.benefits)}`);
    }
    console.log('  Road construction advanced one day.');

    // Stage 4: System Settings Menu & Save Game
    console.log('📍 Stage 4: Testing System Settings & Save Game...');
    await page.waitForSelector('#btn-system-menu', { state: 'visible', timeout: 5000 });
    await page.click('#btn-system-menu', { force: true });

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
    const parsedSaveData = JSON.parse(saveData);
    if (!parsedSaveData.roads?.projects?.length) {
      throw new Error('Road construction data was not persisted.');
    }
    console.log(`  💾 Save data successfully written to localStorage (${saveData.length} bytes).`);

    const isMenuOpen = await page.evaluate(() => document.getElementById('modal-system-menu')?.classList.contains('active'));
    if (!isMenuOpen) {
      await page.click('#btn-system-menu', { force: true });
      await page.waitForSelector('#modal-system-menu.active', { state: 'visible', timeout: 5000 });
    }

    await page.click('#btn-exit-game');
    await page.waitForFunction(() =>
      document.getElementById('transition-overlay')?.classList.contains('active')
    , null, { timeout: 2000 });
    await page.waitForFunction(() =>
      document.getElementById('main-menu-view')?.classList.contains('active')
    , null, { timeout: 3000 });
    await page.waitForFunction(() =>
      !document.getElementById('transition-overlay')?.classList.contains('active')
    , null, { timeout: 3000 });
    console.log('  ✅ Save-and-exit transition returned cleanly to the main menu.');

    // Stage 5: Reload Page & Persistence Check
    console.log('📍 Stage 5: Reloading page & verifying state persistence...');
    await page.reload();
    await page.waitForSelector('#btn-enter-journey', { state: 'visible', timeout: 10000 });

    const reloadedSaveData = await page.evaluate(() => localStorage.getItem('idle_rpg_save_1') || localStorage.getItem('medieval_rpg_save_v2'));
    if (!reloadedSaveData) {
      throw new Error('Save data disappeared after page reload.');
    }
    console.log('  ✅ Save data persisted cleanly across page reload.');

    await page.click('#btn-enter-journey');
    await page.waitForSelector('#modal-load-game.active', { state: 'visible', timeout: 5000 });
    const reloadedSlotButtons = await page.$$('#save-slots-container > div > button:first-child');
    if (reloadedSlotButtons.length === 0) throw new Error('Saved slot was not listed after reload.');
    await reloadedSlotButtons[0].click();
    await page.waitForFunction(() =>
      document.getElementById('map-view')?.classList.contains('active') ||
      document.getElementById('scene-view')?.classList.contains('active')
    , null, { timeout: 10000 });

    const loadedState = await page.evaluate(() => {
      const gs = window.GameState;
      const exploration = gs.explorationSystem.getData();
      const roads = gs.roadSystem.getData();
      return {
        seed: gs.worldGeneration?.seed,
        totalDays: gs.totalDays,
        revealedCells: exploration.cells.filter(Boolean).length,
        expeditionCount: exploration.expeditions.length,
        roadCount: roads.roads.length,
        roadProjectCount: roads.projects.length,
        progressText: document.getElementById('world-progress-status')?.textContent
      };
    });
    if (
      loadedState.seed !== parsedSaveData.worldGeneration.seed ||
      loadedState.totalDays !== parsedSaveData.totalDays ||
      loadedState.revealedCells !== parsedSaveData.exploration.cells.filter(Boolean).length ||
      loadedState.expeditionCount !== parsedSaveData.exploration.expeditions.length ||
      loadedState.roadCount !== parsedSaveData.roads.roads.length ||
      loadedState.roadProjectCount !== parsedSaveData.roads.projects.length ||
      !loadedState.progressText?.includes(`完成道路 ${loadedState.roadCount}`)
    ) {
      throw new Error(`Loaded world state differs from save: ${JSON.stringify(loadedState)}`);
    }
    console.log('  Saved world, fog, expedition, road, and HUD state loaded correctly.');

    const allowedExternalFailures = failedRequests.filter(({ url }) =>
      url.startsWith('https://fonts.googleapis.com/') || url.startsWith('https://fonts.gstatic.com/')
    );
    const unexpectedRequestFailures = failedRequests.filter(failure => !allowedExternalFailures.includes(failure));
    const substantiveConsoleErrors = consoleErrors.filter(
      message => message !== 'Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED'
    );

    if (unexpectedRequestFailures.length > 0) {
      throw new Error(`Unexpected request failures:\n${JSON.stringify(unexpectedRequestFailures, null, 2)}`);
    }
    if (substantiveConsoleErrors.length > 0) {
      throw new Error(`Uncaught console errors detected during smoke test:\n${substantiveConsoleErrors.join('\n')}`);
    }
    if (allowedExternalFailures.length > 0) {
      console.log(`  ℹ️ Ignored ${allowedExternalFailures.length} blocked external font request(s).`);
    }

    console.log('\n🎉 ALL P0 SMOKE TEST STAGES PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
    if (serverProcess) {
      console.log('🧹 Cleaning up server process...');
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

main().catch((err) => {
  console.error('\n💥 SMOKE TEST FAILED:');
  console.error(err);
  process.exit(1);
});
