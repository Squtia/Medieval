/**
 * TemplateLoader.ts
 * 在遊戲初始化時，並行 fetch 所有 HTML template 片段，
 * 注入到對應的掛載點，然後才啟動遊戲邏輯。
 * 
 * 拆分目的：防止 AI Agent 誤改/誤覆蓋龐大的 index.html
 * 每個 template 檔案 < 400 行，操作精準度大幅提升。
 */

interface TemplateMount {
  url: string;
  mountId: string;
  method: 'append' | 'prepend';
}

const TEMPLATES: TemplateMount[] = [
  // UI 通用元素 (overlay, tooltip, background)
  { url: './src/templates/ui-chrome.html',          mountId: 'template-root', method: 'append' },
  // 主要視圖 (主選單、地圖、野外、街道) ➔ 注入 #view-container
  { url: './src/templates/views-main.html',         mountId: 'view-container', method: 'append' },
  // 設施視圖 (書房、謁見廳、酒館、商店、鍛造屋) ➔ 注入 #view-container
  { url: './src/templates/views-facility.html',     mountId: 'view-container', method: 'append' },
  // 右側共用面板 ➔ 注入 #main-layout (使 Flex 佈局正常起效)
  { url: './src/templates/views-right-panel.html',  mountId: 'main-layout',    method: 'append' },
  // 戰鬥 Modal + 貿易 Modal
  { url: './src/templates/modals-combat-trade.html',mountId: 'template-root', method: 'append' },
  // 其他遊戲 Modal (倉庫、新遊戲、載入、派遣、俘虜、系統、事件、待辦)
  { url: './src/templates/modals-game.html',        mountId: 'template-root', method: 'append' },
  // 左側面板 + HUD + 每日結算
  { url: './src/templates/panels-hud.html',         mountId: 'template-root', method: 'append' },
];


export async function loadAllTemplates(): Promise<void> {
  // 並行 fetch 所有 template
  const results = await Promise.all(
    TEMPLATES.map(async (t) => {
      const res = await fetch(t.url);
      if (!res.ok) {
        throw new Error(`[TemplateLoader] 無法載入 ${t.url} (HTTP ${res.status})`);
      }
      const html = await res.text();
      return { html, mountId: t.mountId, method: t.method };
    })
  );

  // 依序注入至指定的 mountId
  for (const { html, mountId } of results) {
    const target = document.getElementById(mountId);
    if (!target) {
      throw new Error(`[TemplateLoader] 掛載點 #${mountId} 不存在！`);
    }
    target.insertAdjacentHTML('beforeend', html);
  }

  // 執行 template 中的 inline script（例如 selectDispatchMode）
  const templateRoot = document.getElementById('template-root') || document.body;
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
