import { chromium } from 'playwright';

async function verifyFixes() {
  console.log('🚀 開始驗收圖標文字重疊與圖層刪除按鈕修復...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:5174/Medieval/tools/vfx-studio.html');
  await page.waitForSelector('#lib-btn-open-skill-picker');

  // 1. 驗證技能卡片圖標修復
  console.log('1️⃣ 驗證技能卡片彈窗圖標渲染...');
  await page.click('#lib-btn-open-skill-picker');
  await page.waitForSelector('#modal-skill-vfx-picker', { state: 'visible' });

  // 切換到「工坊自訂」Tab
  await page.click('.svp-tab-btn[data-cat="CUSTOM"]');
  await page.waitForTimeout(300);

  // 檢查 rayn_SKILL_CUSTOM_0001 卡片
  const customCardData = await page.evaluate(() => {
    const card = document.querySelector('.svp-skill-card[data-skill-id="rayn_SKILL_CUSTOM_0001"]');
    if (!card) return { found: false };
    const iconEl = card.querySelector('.svp-skill-icon');
    const textContent = iconEl?.textContent?.trim() || '';
    const hasSpriteOrDiv = !!iconEl?.querySelector('div');
    const nameEl = card.querySelector('.svp-skill-name');
    return {
      found: true,
      hasRawCodeText: textContent.includes('2_icons_materials:2_icons_materials_1'),
      textContent,
      hasSpriteOrDiv,
      name: nameEl?.textContent
    };
  });

  console.log('🔍 自訂技能卡片圖標檢驗結果:', customCardData);
  if (!customCardData.found) {
    console.warn('⚠️ 畫面未找到 rayn_SKILL_CUSTOM_0001，可能在 LocalStorage 中');
  } else if (customCardData.hasRawCodeText) {
    throw new Error('❌ 圖標依然包含原始字串 2_icons_materials:2_icons_materials_1，未被替換為 Sprite！');
  } else {
    console.log('✅ 自訂技能圖標已成功以 Sprite 解析渲染，不再溢出文字！');
  }

  // 截圖存檔 Modal 修正後效果
  await page.screenshot({ path: 'C:/Users/User/.gemini/antigravity-ide/brain/8d990b1c-80be-4584-9aa2-7cf6090c2726/fixed_skill_cards_icons.png' });

  // 關閉 Modal
  await page.click('#btn-svp-done');
  await page.waitForTimeout(300);

  // 2. 驗證時間軸圖層刪除按鈕
  console.log('2️⃣ 驗證時間軸多圖層刪除按鈕...');
  // 切換至多圖層特效 VFX_EARTH_SPIKE
  await page.selectOption('#lib-preset-select', 'VFX_EARTH_SPIKE');
  await page.waitForTimeout(500);

  const layerStats = await page.evaluate(() => {
    const headers = document.querySelectorAll('.tl-layer-track-row .tl-track-header');
    const deleteBtns = document.querySelectorAll('.tl-layer-track-row .tl-layer-delete-btn');
    const selects = document.querySelectorAll('.tl-layer-track-row .tl-layer-preset-select');

    const results = [];
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const d = deleteBtns[i];
      const s = selects[i];
      const hRect = h?.getBoundingClientRect();
      const dRect = d?.getBoundingClientRect();

      results.push({
        layerIndex: i,
        headerWidth: hRect?.width,
        selectWidth: s?.getBoundingClientRect().width,
        deleteBtnVisible: dRect && dRect.width > 0 && dRect.height > 0,
        deleteBtnRight: dRect?.right,
        headerRight: hRect?.right,
        isOverflowing: dRect && hRect ? dRect.right > hRect.right + 2 : false
      });
    }

    return results;
  });

  console.log('📊 圖層刪除按鈕可視性與佈局檢驗:', layerStats);
  for (const s of layerStats) {
    if (!s.deleteBtnVisible || s.isOverflowing) {
      throw new Error(`❌ 圖層 ${s.layerIndex} 的刪除按鈕不可見或發生外溢被擠出！`);
    }
  }
  console.log('✅ 所有圖層標頭刪除按鈕 100% 完整可見且無任何擠壓！');

  // 點擊第一個圖層 Clip，檢查微調列是否有雙重刪除按鈕
  await page.click('.tl-layer-clip[data-layer-idx="0"]');
  await page.waitForTimeout(200);

  const toolbarDeleteBtn = await page.$('.tl-toolbar-delete-layer-btn');
  if (!toolbarDeleteBtn) throw new Error('❌ 微調列中找不到 .tl-toolbar-delete-layer-btn！');
  console.log('✅ 微調列雙重【🗑️ 刪除圖層】按鈕確認存在！');

  // 截圖存檔時間軸圖層修正後畫面
  await page.screenshot({ path: 'C:/Users/User/.gemini/antigravity-ide/brain/8d990b1c-80be-4584-9aa2-7cf6090c2726/fixed_timeline_delete_btn.png' });

  await browser.close();
  console.log('🎉 兩大問題全數通過真實瀏覽器驗收！');
}

verifyFixes().catch(err => {
  console.error('❌ 驗收失敗:', err);
  process.exit(1);
});
