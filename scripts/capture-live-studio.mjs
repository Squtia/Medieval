import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity-ide/brain/8d990b1c-80be-4584-9aa2-7cf6090c2726';
const SCREENSHOT_PATH = path.resolve(ARTIFACT_DIR, 'vfx_studio_live.png');
const URL = 'http://localhost:5174/Medieval/tools/vfx-studio.html';

async function capture() {
  console.log('Connecting to VFX Studio at', URL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const uiState = await page.evaluate(() => {
    const topBar = document.querySelector('.top-toolbar');
    const seedDisplay = document.querySelector('#seed-display');
    const rerollBtn = document.querySelector('#btn-reroll-seed');
    const playBtn = document.querySelector('#btn-play');
    const loopBtn = document.querySelector('#btn-loop');
    const presetSelect = document.querySelector('#lib-preset-select');
    const timelineMount = document.querySelector('#timeline-mount-point');
    const tracks = document.querySelectorAll('.tl-track, .timeline-track-row');
    const cues = document.querySelectorAll('.tl-cue-marker');
    const playhead = document.querySelector('.tl-playhead');
    const hud = document.querySelector('#quality-budget-hud');
    const canvas = document.querySelector('#three-combat-fx-canvas');
    const inspector = document.querySelector('#inspector-right');

    return {
      topBarFound: !!topBar,
      seedText: seedDisplay ? seedDisplay.textContent.trim() : null,
      rerollBtnFound: !!rerollBtn,
      playBtnFound: !!playBtn,
      loopBtnText: loopBtn ? loopBtn.textContent.trim() : null,
      libraryPresetCount: presetSelect ? presetSelect.options.length : 0,
      currentPreset: presetSelect ? presetSelect.value : null,
      timelineMounted: !!timelineMount && timelineMount.children.length > 0,
      timelineTrackCount: tracks.length,
      cueMarkerCount: cues.length,
      playheadFound: !!playhead,
      hudText: hud ? hud.textContent.trim().replace(/\s+/g, ' ') : null,
      inspectorFound: !!inspector,
      canvasFound: !!canvas,
      canvasSize: canvas ? { width: canvas.clientWidth, height: canvas.clientHeight } : null
    };
  });

  console.log('UI_STATE_JSON:' + JSON.stringify(uiState));

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log('SCREENSHOT_SAVED:' + SCREENSHOT_PATH);

  await browser.close();
}

capture().catch(err => {
  console.error('Failed to capture:', err);
  process.exit(1);
});
