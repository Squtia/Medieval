import uiChromeHtml from '../templates/ui-chrome.html?raw';
import viewsMainHtml from '../templates/views-main.html?raw';
import viewsFacilityHtml from '../templates/views-facility.html?raw';
import viewsRightPanelHtml from '../templates/views-right-panel.html?raw';
import modalsCombatTradeHtml from '../templates/modals-combat-trade.html?raw';
import modalsGameHtml from '../templates/modals-game.html?raw';
import panelsHudHtml from '../templates/panels-hud.html?raw';

/**
 * TemplateLoader.ts
 * 在遊戲初始化時，注入所有 HTML template 片段至對應掛載點，
 * 然後才啟動遊戲邏輯。
 * 
 * 使用 Vite 的 `?raw` 導入，打包時會將 HTML 模板直接嵌入 JS bundle，
 * 兼顧「模板獨立拆分維護」與「生產環境 (GitHub Pages) 零網路延遲 / 零 404 請求」。
 */

interface TemplateMount {
  html: string;
  mountId: string;
  method: 'append' | 'prepend';
}

const TEMPLATES: TemplateMount[] = [
  // UI 通用元素 (overlay, tooltip, background)
  { html: uiChromeHtml,          mountId: 'template-root', method: 'append' },
  // 主要視圖 (主選單、地圖、野外、街道) ➔ 注入 #view-container
  { html: viewsMainHtml,         mountId: 'view-container', method: 'append' },
  // 設施視圖 (書房、謁見廳、酒館、商店、鍛造屋) ➔ 注入 #view-container
  { html: viewsFacilityHtml,     mountId: 'view-container', method: 'append' },
  // 右側共用面板 ➔ 注入 #main-layout (使 Flex 佈局正常起效)
  { html: viewsRightPanelHtml,   mountId: 'main-layout',    method: 'append' },
  // 戰鬥 Modal + 貿易 Modal
  { html: modalsCombatTradeHtml, mountId: 'template-root', method: 'append' },
  // 其他遊戲 Modal (倉庫、新遊戲、載入、派遣、俘虜、系統、事件、待辦)
  { html: modalsGameHtml,        mountId: 'template-root', method: 'append' },
  // 左側面板 + HUD + 每日結算
  { html: panelsHudHtml,         mountId: 'template-root', method: 'append' },
];


export async function loadAllTemplates(): Promise<void> {
  // 依序注入至指定的 mountId
  for (const { html, mountId } of TEMPLATES) {
    const target = document.getElementById(mountId);
    if (!target) {
      throw new Error(`[TemplateLoader] 掛載點 #${mountId} 不存在！`);
    }
    target.insertAdjacentHTML('beforeend', html);
  }

  // 執行 template 中的 inline script（例如 selectDispatchMode）
  document.querySelectorAll('script').forEach((oldScript) => {
    // 僅處理非模組 inline script（避免重複執行 main.ts）
    if (!oldScript.src && oldScript.textContent?.includes('selectDispatchMode')) {
      const newScript = document.createElement('script');
      newScript.textContent = oldScript.textContent;
      document.head.appendChild(newScript);
      oldScript.remove();
    }
  });

  console.log('[TemplateLoader] 所有 HTML template 載入完成 ✓');
}

