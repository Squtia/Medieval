import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 5173;
const HOST = '127.0.0.1';
const TEST_URL = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;
const ARTIFACT_IMG = `C:/Users/User/.gemini/antigravity-ide/brain/253604e3-5114-44a5-af5b-1b3efeb5c0ab/compositor_workflow_verified.png`;

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
  console.log('🚀 開始執行素材庫分類、非線性圖層合成與雙向力學工作流驗收測試...');

  let serverProcess = null;
  let browser = null;
  const consoleErrors = [];

  try {
    const alreadyRunning = await isServerRunning();
    if (!alreadyRunning) {
      console.log('正在啟動 vite dev server...');
      const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
      const projectRoot = fileURLToPath(new URL('..', import.meta.url));
      serverProcess = spawn(process.execPath, [viteBin, '--host', HOST, '--port', PORT.toString()], {
        cwd: projectRoot,
        stdio: 'pipe',
        shell: false
      });
      serverProcess.stderr.on('data', (d) => console.error(`[Vite stderr] ${d.toString()}`));
      const ready = await waitForServer();
      if (!ready) {
        console.error('❌ 無法啟動 Vite Server');
        if (serverProcess) serverProcess.kill();
        process.exit(1);
      }
      console.log('✅ Vite Server 啟動就緒');
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      else console.log(`[Browser Console] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[PageUncaught] ${err.message}\n${err.stack}`);
    });

    let targetUrl = TEST_URL;
    let resp = await page.goto(targetUrl).catch(() => null);
    if (!resp || resp.status() >= 400) {
      targetUrl = `http://${HOST}:${PORT}/Medieval/tools/vfx-studio.html`;
      resp = await page.goto(targetUrl);
    }
    console.log(`✅ 成功載入頁面: ${targetUrl}`);

    await page.waitForSelector('#timeline-mount-point', { timeout: 10000 });
    await page.waitForSelector('#library-mount-point', { timeout: 10000 });

    // ─────────────────────────────────────────────────────────────
    // 🧪 1. 驗證素材庫四大分類 Tabs 與即時清單過濾
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 1. 測試素材庫四大分類篩選 ---');
    const tabs = await page.$$('.lib-tab-btn');
    console.log(`找到 ${tabs.length} 個分類 Tabs`);
    if (tabs.length < 4) throw new Error('素材庫分類 Tabs 數量不足 4 個');

    // 點擊 🏠自身 Tab
    await page.click('.lib-tab-btn[data-tab="CASTER"]');
    await page.waitForTimeout(100);
    const casterItems = await page.$$eval('#lib-preset-select option', opts => opts.map(o => o.textContent));
    console.log(`自身分類素材數: ${casterItems.length}`);
    if (casterItems.length === 0) throw new Error('自身分類素材清單為空');

    // 點擊 🚀彈道 Tab
    await page.click('.lib-tab-btn[data-tab="TRAJECTORY"]');
    await page.waitForTimeout(100);
    const trajItems = await page.$$eval('#lib-preset-select option', opts => opts.map(o => o.textContent));
    console.log(`彈道分類素材數: ${trajItems.length}`);
    if (trajItems.length === 0) throw new Error('彈道分類素材清單為空');

    // 點擊 💥目標 Tab
    await page.click('.lib-tab-btn[data-tab="TARGET"]');
    await page.waitForTimeout(100);
    const targetItems = await page.$$eval('#lib-preset-select option', opts => opts.map(o => o.textContent));
    console.log(`目標分類素材數: ${targetItems.length}`);
    if (targetItems.length === 0) throw new Error('目標分類素材清單為空');

    // 切回 🌐全部 Tab
    await page.click('.lib-tab-btn[data-tab="ALL"]');
    await page.waitForTimeout(100);
    const allItems = await page.$$eval('#lib-preset-select option', opts => opts.map(o => o.textContent));
    console.log(`全量素材數: ${allItems.length}`);
    if (allItems.length < casterItems.length + trajItems.length + targetItems.length - 5) {
      throw new Error('全部素材數量不匹配');
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 2. 驗證雙向力學貫通：施術者踏步/後坐力/傾角 (Caster Motion)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. 測試施術者動作力學反饋 (Caster Motion) ---');
    const stepSlider = await page.$('#param-caster-step');
    const tiltSlider = await page.$('#param-caster-tilt');
    const durSlider = await page.$('#param-caster-motion-dur');
    if (!stepSlider || !tiltSlider || !durSlider) throw new Error('找不到 Caster Motion 控制項');

    // 填入踏步 30px, 傾角 -12°, 時長 0.4s
    await stepSlider.evaluate((el) => { (el).value = '30'; el.dispatchEvent(new Event('input')); });
    await tiltSlider.evaluate((el) => { (el).value = '-12'; el.dispatchEvent(new Event('input')); });
    await durSlider.evaluate((el) => { (el).value = '0.4'; el.dispatchEvent(new Event('input')); });
    await page.waitForTimeout(100);

    // 步進至約 0.2s (中點達到頂峰)
    for (let i = 0; i < 12; i++) {
      await page.click('#tl-btn-step-next');
    }
    await page.waitForTimeout(100);

    const casterTransform = await page.$eval('#ref-caster', el => el.style.transform);
    console.log(`第 12 幀施術者卡牌 Transform: "${casterTransform}"`);
    if (!casterTransform.includes('translateX') || !casterTransform.includes('rotate')) {
      throw new Error(`施術者動作 Transform 未正確套用: "${casterTransform}"`);
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 3. 驗證非線性合成架構與無損暫存跳轉編輯 (Safe Jump to Edit & Return)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. 測試素材引用、跳轉編輯與無損返回 ---');
    // 新增一個次生圖層
    await page.click('#tl-btn-add-layer');
    await page.waitForTimeout(150);

    const layerClips = await page.$$('.tl-layer-clip');
    console.log(`當前時間軸圖層數: ${layerClips.length}`);
    if (layerClips.length < 1) throw new Error('未能新增圖層 Clip');

    // 檢查返回按鈕初始為隱藏
    const returnBtnVisibleBefore = await page.$eval('#btn-return-stash', el => el.style.display !== 'none');
    if (returnBtnVisibleBefore) throw new Error('初始未暫存時不應顯示返回草稿按鈕');

    // 模擬使用者正在編輯複合技能「烈焰流星雨」並暫存跳轉
    const compositeDraftName = '烈焰流星雨複合技能';
    await page.evaluate((dName) => {
      const store = window.__VFX_STORE__;
      if (store) {
        store.updateConfig({ name: dName }, false);
        // 觸發暫存並跳轉至素材
        store.stashCurrentDraft(dName);
        store.updateConfig({ name: '重斬單軌素材' }, false);
      }
    }, compositeDraftName);
    await page.waitForTimeout(100);

    // 驗證返回按鈕是否動態浮現，且包含技能草稿名稱
    const returnBtnDisplay = await page.$eval('#btn-return-stash', el => ({
      display: el.style.display,
      text: el.textContent
    }));
    console.log(`暫存後返回按鈕狀態: display=${returnBtnDisplay.display}, text="${returnBtnDisplay.text}"`);
    if (returnBtnDisplay.display === 'none' || !returnBtnDisplay.text.includes(compositeDraftName)) {
      throw new Error(`返回草稿按鈕未正確顯示暫存名稱: "${returnBtnDisplay.text}"`);
    }

    // 點擊返回草稿按鈕
    await page.click('#btn-return-stash');
    await page.waitForTimeout(150);

    // 驗證草稿 100% 無損還原，按鈕再次隱藏
    const restoredName = await page.evaluate(() => {
      const store = window.__VFX_STORE__;
      return store ? store.getPreset().name : '';
    });
    const returnBtnVisibleAfter = await page.$eval('#btn-return-stash', el => el.style.display !== 'none');
    console.log(`返回草稿後技能名稱: "${restoredName}", 按鈕是否顯示: ${returnBtnVisibleAfter}`);
    if (restoredName !== compositeDraftName) {
      throw new Error(`未能正確無損還原草稿！預期 "${compositeDraftName}"，實際為 "${restoredName}"`);
    }
    if (returnBtnVisibleAfter) {
      throw new Error('還原草稿後返回按鈕應自動隱藏');
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 4. 驗證 Clip 邊緣淡入淡出標記、點擊選取與工具列微調
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 4. 測試圖層 Clip 點擊選中與淡入淡出工具列微調 ---');
    const firstClip = await page.$('.tl-layer-clip');
    if (firstClip) {
      await firstClip.click();
      await page.waitForTimeout(100);
      const toolbarExists = await page.$('#tl-selected-clip-toolbar');
      console.log(`點擊 Clip 後是否浮現編輯工具列: ${!!toolbarExists}`);
      if (!toolbarExists) throw new Error('點擊圖層 Clip 未展開淡入淡出編輯工具列');

      // 調整 fadeIn 滑桿
      const fadeInInput = await page.$('.tl-clip-fade-input[data-param="fadeIn"]');
      if (fadeInInput) {
        await fadeInInput.evaluate((el) => { (el).value = '0.25'; el.dispatchEvent(new Event('input')); });
        const valText = await page.$eval('.tl-clip-fade-val[data-param="fadeIn"]', el => el.textContent);
        console.log(`調整後 fadeIn 顯示文字: "${valText}"`);
        if (!valText.includes('0.25')) throw new Error('淡入數值未能正確反饋至介面');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 5. 驗證 0 秒基準線精準對齊 (消滅 28px 左偏)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 5. 測試 0.00s 播放頭與刻度尺物理對齊 ---');
    await page.click('#tl-btn-stop');
    await page.waitForTimeout(100);

    const alignmentCheck = await page.evaluate(() => {
      const playhead = document.getElementById('tl-playhead');
      const ruler = document.getElementById('tl-ruler-bar');
      if (!playhead || !ruler) return null;
      return {
        playheadLeft: playhead.offsetLeft,
        rulerLeft: ruler.offsetLeft,
        diff: Math.abs(playhead.offsetLeft - ruler.offsetLeft)
      };
    });
    console.log(`播放頭 offsetLeft: ${alignmentCheck?.playheadLeft}px, 刻度尺 offsetLeft: ${alignmentCheck?.rulerLeft}px, 差值: ${alignmentCheck?.diff}px`);
    if (!alignmentCheck || alignmentCheck.diff > 2) {
      throw new Error(`播放頭未與 0s 刻度線精準對齊！差值為 ${alignmentCheck?.diff}px`);
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 6. 驗證素材挑選：圖層 Header 下拉選單 與 素材庫「➕ 加入時間軸圖層」按鈕
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 6. 測試圖層素材自由挑選與素材庫追加圖層 ---');
    const layerSelect = await page.$('.tl-layer-preset-select');
    if (layerSelect) {
      const optCount = await page.$$eval('.tl-layer-preset-select:first-child option', opts => opts.length);
      console.log(`圖層素材下拉選單可選素材數: ${optCount}`);
      if (optCount < 3) throw new Error('圖層素材選單選項過少');
    }

    const prevLayerCount = (await page.$$('.tl-layer-clip')).length;
    await page.click('#lib-btn-add-to-timeline');
    await page.waitForTimeout(150);
    const newLayerCount = (await page.$$('.tl-layer-clip')).length;
    console.log(`加入前圖層數: ${prevLayerCount}, 加入後圖層數: ${newLayerCount}`);
    if (newLayerCount !== prevLayerCount + 1) {
      throw new Error('點擊素材庫「➕ 加入時間軸圖層」按鈕未成功追加新圖層');
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 7. 驗證 CUE 點擊選取與刪除按鈕 (✕ 刪除)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 7. 測試 CUE 標記選取與 ✕ 刪除按鈕 ---');
    const firstCue = await page.$('.tl-cue-marker');
    if (firstCue) {
      const prevCues = (await page.$$('.tl-cue-marker')).length;
      await firstCue.click();
      await page.waitForTimeout(100);

      const delBtn = await page.$('.tl-cue-delete-btn');
      console.log(`選取 Cue 後是否顯示刪除按鈕 ✕: ${!!delBtn}`);
      if (!delBtn) throw new Error('選取 Cue 後未顯示微型 ✕ 刪除按鈕');

      // 點擊刪除按鈕
      await delBtn.click();
      await page.waitForTimeout(150);
      const afterCues = (await page.$$('.tl-cue-marker')).length;
      console.log(`刪除前 Cue 數: ${prevCues}, 刪除後 Cue 數: ${afterCues}`);
      if (afterCues !== prevCues - 1) {
        throw new Error('點擊 ✕ 按鈕未能成功刪除 Cue');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 8. 驗證除錯藍球已隱藏 (display: none)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 8. 測試除錯發光藍球標記已隱藏 ---');
    const markerDisplay = await page.$eval('#benchmark-marker', el => window.getComputedStyle(el).display);
    console.log(`benchmark-marker display: "${markerDisplay}"`);
    if (markerDisplay !== 'none') {
      throw new Error(`除錯藍球未隱藏，當前 display: "${markerDisplay}"`);
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 9. 驗證多段打擊傷害飄字反饋 (Damage Popup)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 9. 測試多段跳傷害飄字特效 (💥 / 🔥 CRITICAL) ---');
    // 新增 2 個 Cue 點 (多段打擊)
    await page.evaluate(() => {
      const store = window.__VFX_STORE__;
      if (store) {
        store.updateConfig({
          impactCues: [
            { cueId: 'CUE_1', time: 0.15, weight: 1.0, isPrimary: false },
            { cueId: 'CUE_2', time: 0.35, weight: 1.5, isPrimary: true }
          ]
        }, true);
      }
    });
    await page.waitForTimeout(100);

    // 重置時間到 0s 並播放
    await page.click('#tl-btn-stop');
    await page.waitForTimeout(50);
    await page.click('#tl-btn-play-pause');

    // 監聽是否有 .cue-damage-popup 出現
    let foundPopup = false;
    for (let check = 0; check < 10; check++) {
      await page.waitForTimeout(60);
      const hasPopup = await page.evaluate(() => !!document.querySelector('.cue-damage-popup'));
      if (hasPopup) {
        foundPopup = true;
        break;
      }
    }
    await page.click('#tl-btn-play-pause'); // 暫停

    console.log(`是否動態捕捉到傷害跳字特效: ${foundPopup}`);
    if (!foundPopup) {
      throw new Error('未能在 Cue 打擊點捕捉到動態傷害跳字反饋！');
    }

    // ─────────────────────────────────────────────────────────────
    // 🧪 10. 驗證時間軸真實 3D 著色器幾何體求值與多圖層並行（拒絕一顆球敷衍）
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 10. 測試時間軸 3D 著色器真實幾何體求值 (刀芒/雷電/地刺) ---');
    // 在時間軸步進至有效時間 (例如 0.15s)
    await page.evaluate(() => {
      const store = window.__VFX_STORE__;
      if (store) {
        // 設定為多圖層複合技能 (L0 刀芒 + L1 天降雷電 + L2 地裂突刺)
        store.updateConfig({
          shaderMode: 'SLASH_BLADE',
          layers: [
            {
              id: 'layer_sky_lightning',
              name: '天降狂雷',
              shaderMode: 'DIELECTRIC_LIGHTNING',
              spatialMode: 'VERTICAL_SKY_TO_B',
              delay: 0.05,
              duration: 0.35,
              enabled: true
            },
            {
              id: 'layer_earth_shatter',
              name: '裂地岩刺',
              shaderMode: 'EARTH_SHATTER',
              spatialMode: 'AT_TARGET',
              delay: 0.1,
              duration: 0.3,
              enabled: true
            }
          ]
        }, true);
      }
    });
    await page.waitForTimeout(100);

    // 步進至 0.20s 定格求值
    await page.click('#tl-btn-stop');
    await page.waitForTimeout(50);
    for (let step = 0; step < 6; step++) {
      await page.click('#tl-btn-step-next');
    }
    await page.waitForTimeout(100);

    // 檢查 Three.js 場景中渲染出的真實 3D 網格結構
    const scene3DStats = await page.evaluate(() => {
      const fxEngine = window.__FX_ENGINE__ || window.CombatFXEngine?.getInstance?.();
      if (!fxEngine) return { error: '未找到 CombatFXEngine 實例' };

      const scene = fxEngine.scene;
      const previewGroup = fxEngine.studioPreviewGroup;
      if (!previewGroup) return { error: '未找到 studioPreviewGroup' };

      let totalMeshes = 0;
      let nonSphereMeshes = 0;
      let visibleTrackGroups = 0;
      const meshDetails = [];

      previewGroup.traverse((child) => {
        if (child.isGroup && child !== previewGroup && child.visible) {
          visibleTrackGroups++;
        }
        if (child.isMesh && child.visible) {
          totalMeshes++;
          const geoType = child.geometry?.type || 'Unknown';
          if (geoType !== 'SphereGeometry') {
            nonSphereMeshes++;
          }
          meshDetails.push(`${geoType}(verts: ${child.geometry?.attributes?.position?.count || 0})`);
        }
      });

      return {
        visibleTrackGroups,
        totalMeshes,
        nonSphereMeshes,
        meshDetails
      };
    });

    console.log('3D 幾何求值統計:', scene3DStats);
    if (scene3DStats.error) {
      throw new Error(`3D 檢驗失敗: ${scene3DStats.error}`);
    }
    if (scene3DStats.totalMeshes === 0) {
      throw new Error('時間軸定格時 3D 特效網格數量為 0！');
    }
    if (scene3DStats.nonSphereMeshes === 0) {
      throw new Error('時間軸特效仍為敷衍的小球！未能生成真實 3D 著色器幾何體');
    }
    console.log(`✅ 成功驗證 3D 特效真實生成：共 ${scene3DStats.totalMeshes} 個 3D 實體網格，包含: ${scene3DStats.meshDetails.slice(0, 5).join(', ')}`);

    // ─────────────────────────────────────────────────────────────
    // 📸 11. 輸出端到端驗收截圖
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 11. 輸出高解析驗收截圖 ---');
    await page.screenshot({ path: ARTIFACT_IMG, fullPage: false });
    console.log(`📸 截圖已儲存至: ${ARTIFACT_IMG}`);

    if (consoleErrors.length > 0) {
      console.warn(`⚠️ 瀏覽器回報 ${consoleErrors.length} 個 Console 錯誤:`, consoleErrors);
    } else {
      console.log('🎉 瀏覽器主控台 0 錯誤，各項指標與人機交互 100% 驗收通過！');
    }

  } finally {
    if (browser) await browser.close();
    if (serverProcess) {
      console.log('關閉 vite server...');
      serverProcess.kill();
    }
  }
}

run().catch((err) => {
  console.error('❌ 驗收測試失敗:', err);
  process.exit(1);
});
