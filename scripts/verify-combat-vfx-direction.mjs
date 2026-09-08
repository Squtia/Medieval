import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/index.html`;

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

async function verifyCombatDirection() {
  console.log('🚀 Starting Combat VFX Direction Verification...');

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
    const consoleErrors = [];
    const notFoundUrls = [];

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    // 🛡️ 依據規格 §11.3 條款：攔截外部字型請求，避免離線或受限網路環境出現 ERR_NETWORK_ACCESS_DENIED 假報錯
    await page.route(/(fonts\.googleapis\.com|fonts\.gstatic\.com)/, route => {
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '/* mock font for offline headless verification */'
      });
    });

    page.on('console', msg => {
      const text = msg.text();
      // 隔離已知外部字型或連線拒絕通知
      if (text.includes('fonts.googleapis.com') || text.includes('fonts.gstatic.com') || text.includes('net::ERR_NETWORK_ACCESS_DENIED')) {
        console.warn(`[EXTERNAL RESOURCE NOTICE] ${text}`);
        return;
      }
      if (msg.type() === 'error') consoleErrors.push(`[BROWSER ERROR] ${text}`);
      else console.log('BROWSER:', text);
    });
    page.on('pageerror', err => {
      if (err.message.includes('fonts.googleapis.com') || err.message.includes('ERR_NETWORK_ACCESS_DENIED')) {
        return;
      }
      consoleErrors.push(`[PAGE ERROR] ${err.message}`);
    });
    page.on('response', res => {
      if (res.status() === 404) notFoundUrls.push(`[404 NOT FOUND] ${res.url()}`);
    });

    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

  // 在頁面上下文注入戰鬥行動並檢驗其目標與起終點
  const result = await page.evaluate(async () => {
    const { CombatStageAdapter } = await import('./src/ui/fx/adapters/CombatStageAdapter.ts');
    const { CombatEventType } = await import('./src/models/Combat.ts');

    const modal = document.getElementById('combat-modal');
    modal.style.display = 'block';
    modal.style.position = 'fixed';
    modal.style.top = '100px';
    modal.style.left = '100px';
    modal.style.width = '1000px';
    modal.style.height = '600px';

    const playerTeam = document.getElementById('combat-player-team');
    const enemyTeam = document.getElementById('combat-enemy-team');

    const playerCard = document.createElement('div');
    playerCard.id = 'combat-p-hero_warrior';
    playerCard.className = 'combat-card player-side';
    playerCard.style.cssText = 'width: 100px; height: 120px; display: inline-block;';
    playerTeam.appendChild(playerCard);

    const enemyCard = document.createElement('div');
    enemyCard.id = 'combat-p-goblin_king';
    enemyCard.className = 'combat-card enemy-side';
    enemyCard.style.cssText = 'width: 100px; height: 120px; display: inline-block;';
    enemyTeam.appendChild(enemyCard);

    const adapter = CombatStageAdapter.getInstance();
    adapter.mount(modal);

    // 模擬玩家施放「重劈技能」(包含 SKILL_CAST 自身扣 MP 與 HIT 敵方)
    const playerAction = {
      actionId: 'act_player_heavy_strike',
      actorId: 'hero_warrior',
      skillId: 'heavy_strike',
      vfxId: 'VFX_HEAVY_STRIKE',
      events: [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_player_heavy_strike',
          actorId: 'hero_warrior',
          targetId: 'hero_warrior', // ⚠️ 扣除自身 MP
          skillTargetId: 'goblin_king',
          targetMp: 90,
          targetMaxMp: 100,
          text: '勇者施展奮力一擊'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_player_heavy_strike',
          actorId: 'hero_warrior',
          targetId: 'goblin_king',
          damage: 120,
          targetHp: 380,
          targetMaxHp: 500,
          text: '命中哥布林王 120 點'
        }
      ]
    };

    let playerActionPlayedPoints = null;
    await adapter.playCombatAction(playerAction, {
      skipVfx: true,
      onImpact: (item) => {
        const fromPt = adapter.getUnitPoint('hero_warrior', 'player');
        const toPt = adapter.getUnitPoint(item.targetId, 'enemy');
        playerActionPlayedPoints = {
          actorId: 'hero_warrior',
          targetId: item.targetId,
          fromPt,
          toPt,
          dx: toPt.x - fromPt.x,
          isSelfHit: item.targetId === 'hero_warrior'
        };
      }
    });

    // 模擬敵方施放「黑暗斬擊」(包含 SKILL_CAST 自身扣 MP 與 HIT 玩家)
    const enemyAction = {
      actionId: 'act_enemy_dark_slash',
      actorId: 'goblin_king',
      skillId: 'dark_slash',
      vfxId: 'VFX_DEFAULT_SLASH',
      events: [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_enemy_dark_slash',
          actorId: 'goblin_king',
          targetId: 'goblin_king', // ⚠️ 敵方扣除自身 MP
          skillTargetId: 'hero_warrior',
          targetMp: 40,
          targetMaxMp: 60,
          text: '哥布林王施放黑暗斬擊'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_enemy_dark_slash',
          actorId: 'goblin_king',
          targetId: 'hero_warrior',
          damage: 85,
          targetHp: 215,
          targetMaxHp: 300,
          text: '命中勇者 85 點'
        }
      ]
    };

    let enemyActionPlayedPoints = null;
    await adapter.playCombatAction(enemyAction, {
      skipVfx: true,
      onImpact: (item) => {
        const fromPt = adapter.getUnitPoint('goblin_king', 'enemy');
        const toPt = adapter.getUnitPoint(item.targetId, 'player');
        enemyActionPlayedPoints = {
          actorId: 'goblin_king',
          targetId: item.targetId,
          fromPt,
          toPt,
          dx: toPt.x - fromPt.x,
          isSelfHit: item.targetId === 'goblin_king'
        };
      }
    });

    adapter.clear();
    adapter.destroy();
    modal.remove();

    return {
      playerAction: playerActionPlayedPoints,
      enemyAction: enemyActionPlayedPoints
    };
  });

    console.log('📊 Combat Direction Audit Result:', JSON.stringify(result, null, 2));

    if (notFoundUrls.length > 0) {
      throw new Error(`❌ 驗收失敗，載入過程出現 404 請求: ${JSON.stringify(notFoundUrls)}`);
    }

    if (consoleErrors.length > 0) {
      throw new Error(`❌ 驗收失敗，瀏覽器出現錯誤日誌: ${JSON.stringify(consoleErrors)}`);
    }

    // 嚴格斷言
    if (result.playerAction.isSelfHit || result.enemyAction.isSelfHit) {
      throw new Error('❌ Self-targeting bug detected! Action hit caster instead of opponent!');
    }

    if (result.playerAction.dx <= 0) {
      throw new Error(`❌ Player attack direction wrong! Expected dx > 0, got ${result.playerAction.dx}`);
    }

    if (result.enemyAction.dx >= 0) {
      throw new Error(`❌ Enemy attack direction wrong! Expected dx < 0, got ${result.enemyAction.dx}`);
    }

    console.log('🎉 COMBAT DIRECTION & TARGET ISOLATION VERIFIED 100% SUCCESS!');
  } finally {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
  }
}

verifyCombatDirection().catch(err => {
  console.error('❌ Direction Verification Failed:', err);
  process.exit(1);
});
