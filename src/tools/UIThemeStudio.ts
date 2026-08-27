import { ToastManager } from '../ui/ToastManager';
import { UIManager } from '../ui/UIManager';

export interface ThemeConfig {
  // 全域框體與面板
  panelBgOpacity: number; // 0.2 ~ 0.95
  panelBorderWidth: number; // 0 ~ 6 px
  panelBorderColor: string; // hex / rgba
  panelBorderRadius: number; // 0 ~ 24 px
  panelBoxShadow: string; // none / subtle / glow / dark
  panelBackdropBlur: number; // 0 ~ 20 px

  // 按鈕樣式
  buttonTheme: 'gold' | 'bronze' | 'purple' | 'emerald' | 'ruby' | 'custom';
  buttonBgGradient: string;
  buttonBorderColor: string;
  buttonTextColor: string;
  buttonBorderRadius: number; // 0 ~ 20 px
  buttonPaddingY: number; // 4 ~ 18 px

  // 排版比例 (左欄寬度百分比)
  facilityLeftPanelRatio: number; // 25 ~ 50 %

  // 自訂各場景背景圖 (URL / Base64 / 路徑)
  backgrounds: {
    base?: string;
    tavern?: string;
    church?: string;
    forge?: string;
    street?: string;
    combat?: string;
  };
}

const DEFAULT_THEME: ThemeConfig = {
  panelBgOpacity: 0.65,
  panelBorderWidth: 1,
  panelBorderColor: 'rgba(234, 179, 8, 0.35)',
  panelBorderRadius: 8,
  panelBoxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
  panelBackdropBlur: 10,

  buttonTheme: 'gold',
  buttonBgGradient: 'linear-gradient(135deg, #d97706, #b45309)',
  buttonBorderColor: '#f59e0b',
  buttonTextColor: '#ffffff',
  buttonBorderRadius: 6,
  buttonPaddingY: 8,

  facilityLeftPanelRatio: 35,

  backgrounds: {
    base: '',
    tavern: '',
    church: '',
    forge: '',
    street: '',
    combat: ''
  }
};

export class UIThemeStudio {
  private static STORAGE_KEY = 'medieval_custom_ui_theme';
  private static currentConfig: ThemeConfig = { ...DEFAULT_THEME };
  private static activePreviewScene: 'church' | 'tavern' | 'base' | 'forge' = 'church';
  private static isInitialized = false;

  /**
   * 🌟 遊戲開局載入自訂主題並注入全域樣式
   */
  public static loadAndApply(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.currentConfig = { ...DEFAULT_THEME, ...JSON.parse(saved) };
      } catch (e) {
        console.warn('載入自訂主題失敗，使用預設配置', e);
        this.currentConfig = { ...DEFAULT_THEME };
      }
    } else {
      this.currentConfig = { ...DEFAULT_THEME };
    }
    this.injectGlobalStyles(this.currentConfig);
  }

  /**
   * 🎨 開啟視覺排版工坊視圖
   */
  public static open(): void {
    this.init();
    const views = document.querySelectorAll('.facility-view, #view-city, .view');
    views.forEach(v => v.classList.remove('active'));

    const studioView = document.getElementById('view-theme-studio');
    if (studioView) {
      studioView.classList.add('active');
    }

    this.render();
  }

  public static init(): void {
    if (this.isInitialized) return;

    // 關閉/退出工坊
    document.getElementById('btn-exit-theme-studio')?.addEventListener('click', () => {
      const studioView = document.getElementById('view-theme-studio');
      if (studioView) studioView.classList.remove('active');
      UIManager.updateUI();
    });

    // 場景切換按鈕
    document.querySelectorAll('.btn-studio-scene').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const scene = (e.currentTarget as HTMLElement).getAttribute('data-scene') as any;
        if (scene) {
          this.activePreviewScene = scene;
          this.render();
        }
      });
    });

    // 儲存並套用
    document.getElementById('btn-studio-save-apply')?.addEventListener('click', () => {
      this.saveToStorage();
      this.injectGlobalStyles(this.currentConfig);
      ToastManager.show('💾 自訂視覺主題已儲存並套用至全遊戲！', 'success');
    });

    // 重置為預設
    document.getElementById('btn-studio-reset')?.addEventListener('click', () => {
      this.currentConfig = JSON.parse(JSON.stringify(DEFAULT_THEME));
      this.saveToStorage();
      this.injectGlobalStyles(this.currentConfig);
      this.render();
      ToastManager.show('↩️ 已重置為預設視覺風格！', 'info');
    });

    // 本地背景圖片上傳
    const bgFileInput = document.getElementById('studio-bg-file-input') as HTMLInputElement | null;
    bgFileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const base64 = loadEvt.target?.result as string;
        if (base64) {
          this.currentConfig.backgrounds[this.activePreviewScene] = base64;
          this.updateLivePreview();
          ToastManager.show(`🖼️ 已載入 ${file.name} 為 ${this.getSceneName(this.activePreviewScene)} 背景！`, 'success');
        }
      };
      reader.readAsDataURL(file);
    });

    // 監聽各個滑桿與控制項即時連動
    this.bindControlListeners();

    this.isInitialized = true;
  }

  private static bindControlListeners(): void {
    // 面板透明度
    document.getElementById('studio-panel-opacity')?.addEventListener('input', (e) => {
      this.currentConfig.panelBgOpacity = parseFloat((e.target as HTMLInputElement).value);
      this.updateLivePreview();
    });

    // 邊框粗細
    document.getElementById('studio-border-width')?.addEventListener('input', (e) => {
      this.currentConfig.panelBorderWidth = parseInt((e.target as HTMLInputElement).value, 10);
      this.updateLivePreview();
    });

    // 邊框圓角
    document.getElementById('studio-border-radius')?.addEventListener('input', (e) => {
      this.currentConfig.panelBorderRadius = parseInt((e.target as HTMLInputElement).value, 10);
      this.updateLivePreview();
    });

    // 邊框顏色
    document.getElementById('studio-border-color')?.addEventListener('input', (e) => {
      this.currentConfig.panelBorderColor = (e.target as HTMLInputElement).value;
      this.updateLivePreview();
    });

    // 左欄比例
    document.getElementById('studio-left-ratio')?.addEventListener('input', (e) => {
      this.currentConfig.facilityLeftPanelRatio = parseInt((e.target as HTMLInputElement).value, 10);
      this.updateLivePreview();
    });

    // 按鈕風格預設
    document.getElementById('studio-button-theme-select')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as any;
      this.applyButtonThemePreset(val);
      this.updateLivePreview();
    });

    // 按鈕圓角
    document.getElementById('studio-btn-radius')?.addEventListener('input', (e) => {
      this.currentConfig.buttonBorderRadius = parseInt((e.target as HTMLInputElement).value, 10);
      this.updateLivePreview();
    });
  }

  private static applyButtonThemePreset(theme: string): void {
    this.currentConfig.buttonTheme = theme as any;
    switch (theme) {
      case 'gold':
        this.currentConfig.buttonBgGradient = 'linear-gradient(135deg, #d97706, #b45309)';
        this.currentConfig.buttonBorderColor = '#f59e0b';
        this.currentConfig.buttonTextColor = '#ffffff';
        break;
      case 'bronze':
        this.currentConfig.buttonBgGradient = 'linear-gradient(135deg, #78350f, #451a03)';
        this.currentConfig.buttonBorderColor = '#92400e';
        this.currentConfig.buttonTextColor = '#fde68a';
        break;
      case 'emerald':
        this.currentConfig.buttonBgGradient = 'linear-gradient(135deg, #059669, #047857)';
        this.currentConfig.buttonBorderColor = '#10b981';
        this.currentConfig.buttonTextColor = '#ffffff';
        break;
      case 'ruby':
        this.currentConfig.buttonBgGradient = 'linear-gradient(135deg, #dc2626, #991b1b)';
        this.currentConfig.buttonBorderColor = '#ef4444';
        this.currentConfig.buttonTextColor = '#ffffff';
        break;
      case 'purple':
        this.currentConfig.buttonBgGradient = 'linear-gradient(135deg, #7c3aed, #4f46e5)';
        this.currentConfig.buttonBorderColor = '#8b5cf6';
        this.currentConfig.buttonTextColor = '#ffffff';
        break;
    }
  }

  public static render(): void {
    // 1. 同步左側控制項數值
    const opSlider = document.getElementById('studio-panel-opacity') as HTMLInputElement | null;
    if (opSlider) opSlider.value = this.currentConfig.panelBgOpacity.toString();
    const opText = document.getElementById('studio-panel-opacity-val');
    if (opText) opText.textContent = `${Math.round(this.currentConfig.panelBgOpacity * 100)}%`;

    const bwSlider = document.getElementById('studio-border-width') as HTMLInputElement | null;
    if (bwSlider) bwSlider.value = this.currentConfig.panelBorderWidth.toString();
    const bwText = document.getElementById('studio-border-width-val');
    if (bwText) bwText.textContent = `${this.currentConfig.panelBorderWidth}px`;

    const brSlider = document.getElementById('studio-border-radius') as HTMLInputElement | null;
    if (brSlider) brSlider.value = this.currentConfig.panelBorderRadius.toString();
    const brText = document.getElementById('studio-border-radius-val');
    if (brText) brText.textContent = `${this.currentConfig.panelBorderRadius}px`;

    const ratioSlider = document.getElementById('studio-left-ratio') as HTMLInputElement | null;
    if (ratioSlider) ratioSlider.value = this.currentConfig.facilityLeftPanelRatio.toString();
    const ratioText = document.getElementById('studio-left-ratio-val');
    if (ratioText) ratioText.textContent = `${this.currentConfig.facilityLeftPanelRatio}%`;

    const btnThemeSelect = document.getElementById('studio-button-theme-select') as HTMLSelectElement | null;
    if (btnThemeSelect) btnThemeSelect.value = this.currentConfig.buttonTheme;

    // 2. 渲染場景按鈕高亮
    document.querySelectorAll('.btn-studio-scene').forEach(btn => {
      const scene = btn.getAttribute('data-scene');
      if (scene === this.activePreviewScene) {
        btn.classList.add('active');
        (btn as HTMLElement).style.background = 'rgba(234, 179, 8, 0.3)';
        (btn as HTMLElement).style.borderColor = '#eab308';
        (btn as HTMLElement).style.color = '#fbbf24';
      } else {
        btn.classList.remove('active');
        (btn as HTMLElement).style.background = 'rgba(0,0,0,0.4)';
        (btn as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
        (btn as HTMLElement).style.color = '#94a3b8';
      }
    });

    // 3. 渲染右側真機預覽畫面
    this.renderPreviewWorkspace();
    this.updateLivePreview();
  }

  private static renderPreviewWorkspace(): void {
    const previewContainer = document.getElementById('studio-preview-workspace');
    if (!previewContainer) return;

    if (this.activePreviewScene === 'church') {
      previewContainer.innerHTML = `
        <div class="preview-scene-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(217,119,6,0.3); padding-bottom: 8px;">
          <button class="action-btn" style="width: auto; padding: 6px 14px; font-size: 0.85em;">🔙 返回街道</button>
          <h2 style="margin: 0; font-size: 1.8em; color: #eab308; font-family: Georgia, serif;">⛪ 領地修道院 (預覽中)</h2>
          <div style="width: 80px;"></div>
        </div>
        <div class="preview-two-columns" style="display: flex; gap: 16px; flex: 1; min-height: 0;">
          <div class="glass-panel preview-left-col" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            <h3 style="color: #eab308; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; font-size: 1em;">📜 領地醫療運作</h3>
            <div style="background: rgba(0,0,0,0.4); padding: 8px; border-radius: 6px; font-size: 0.82em; line-height: 1.5;">
              <div>✨ 全領地過夜自然恢復：<span style="color: #4ade80; font-weight: bold;">+25%</span></div>
              <div style="color: #60a5fa; margin-top: 4px;">📜 聖光庇護：2位退休神職 (+1%)</div>
            </div>
            <div style="background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; display: flex; flex-direction: column; gap: 6px;">
              <div style="font-weight: bold; color: #fbbf24; font-size: 0.9em;">🧪 聖光藥坊</div>
              <div style="display: flex; gap: 6px;">
                <button class="action-btn" style="flex: 1; padding: 6px; font-size: 0.8em;">🔥 熬製 1 瓶</button>
                <button class="action-btn" style="flex: 1; padding: 6px; font-size: 0.8em;">🔥 全部熬製</button>
              </div>
            </div>
            <div style="background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; margin-top: auto;">
              <div style="font-size: 0.85em; color: #cbd5e1; margin-bottom: 4px;">🛏️ 病房容量：1 / 4 床</div>
              <button class="action-btn" style="width: 100%; padding: 6px; font-size: 0.85em;">🔨 打造新病床</button>
            </div>
          </div>
          <div class="glass-panel preview-right-col" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; flex: 1;">
            <h3 style="color: #eab308; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; font-size: 1em;">🛏️ 傷病病房</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <div style="width: 120px; height: 140px; background: rgba(234,179,8,0.15); border: 2px solid #eab308; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.8em;">
                <div style="font-size: 1.8em;">🛡️</div>
                <div style="color: #fff; font-weight: bold; margin-top: 4px;">艾蓮娜 Lv.5</div>
                <div style="color: #f87171; font-size: 0.8em;">🩸 重傷瀕死</div>
              </div>
              <div style="width: 120px; height: 140px; background: rgba(0,0,0,0.4); border: 1px dashed rgba(255,255,255,0.2); border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 0.8em; color: #94a3b8;">
                <div style="font-size: 1.8em;">🛏️</div>
                <div style="color: #4ade80;">➕ 空病床</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (this.activePreviewScene === 'tavern') {
      previewContainer.innerHTML = `
        <div class="preview-scene-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(217,119,6,0.3); padding-bottom: 8px;">
          <button class="action-btn" style="width: auto; padding: 6px 14px; font-size: 0.85em;">🔙 返回街道</button>
          <h2 style="margin: 0; font-size: 1.8em; color: #eab308; font-family: Georgia, serif;">🍺 冒險者酒館 (預覽中)</h2>
          <div style="width: 80px;"></div>
        </div>
        <div class="preview-two-columns" style="display: flex; gap: 16px; flex: 1; min-height: 0;">
          <div class="glass-panel preview-left-col" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            <h3 style="color: #eab308; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; font-size: 1em;">🍺 酒館招待</h3>
            <button class="action-btn" style="padding: 8px; font-size: 0.9em; width: 100%;">📜 懸賞委託欄</button>
            <button class="action-btn" style="padding: 8px; font-size: 0.9em; width: 100%; margin-top: auto;">🗣️ 打聽情報 (50G)</button>
          </div>
          <div class="glass-panel preview-right-col" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; flex: 1;">
            <h3 style="color: #eab308; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; font-size: 1em;">👥 待招募傭兵</h3>
            <div style="display: flex; gap: 10px;">
              <div style="width: 110px; height: 130px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="font-size: 1.8em;">⚔️</div>
                <div style="color: #fff; font-size: 0.85em;">亞瑟 (戰士)</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      previewContainer.innerHTML = `
        <div class="preview-scene-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(217,119,6,0.3); padding-bottom: 8px;">
          <button class="action-btn" style="width: auto; padding: 6px 14px; font-size: 0.85em;">🔙 返回街道</button>
          <h2 style="margin: 0; font-size: 1.8em; color: #eab308; font-family: Georgia, serif;">🏰 領主書房 (預覽中)</h2>
          <div style="width: 80px;"></div>
        </div>
        <div class="preview-two-columns" style="display: flex; gap: 16px; flex: 1; min-height: 0;">
          <div class="glass-panel preview-left-col" style="padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            <h3 style="color: #eab308; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; font-size: 1em;">📜 領地內政</h3>
            <button class="action-btn" style="padding: 8px; font-size: 0.9em; width: 100%;">🌾 分配農田人力</button>
          </div>
          <div class="glass-panel preview-right-col" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; flex: 1;">
            <h3 style="color: #eab308; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; font-size: 1em;">🏛️ 領地建築升級</h3>
            <button class="action-btn" style="padding: 8px; font-size: 0.9em; width: 100%;">⛪ 擴建教會 (Lv.2)</button>
          </div>
        </div>
      `;
    }
  }

  /**
   * ⚡ 即時更新預覽區域的 CSS 樣式
   */
  private static updateLivePreview(): void {
    const previewContainer = document.getElementById('studio-preview-workspace');
    if (!previewContainer) return;

    // 更新背景
    const customBg = this.currentConfig.backgrounds[this.activePreviewScene];
    if (customBg) {
      previewContainer.style.backgroundImage = `url("${customBg}")`;
      previewContainer.style.backgroundSize = 'cover';
      previewContainer.style.backgroundPosition = 'center';
    } else {
      previewContainer.style.backgroundImage = 'none';
      previewContainer.style.backgroundColor = '#111827';
    }

    // 更新左欄寬度比例
    const leftCols = previewContainer.querySelectorAll<HTMLElement>('.preview-left-col');
    const ratio = this.currentConfig.facilityLeftPanelRatio || 35;
    leftCols.forEach(col => {
      col.style.flex = `0 0 ${ratio}%`;
      col.style.maxWidth = `${ratio}%`;
    });

    // 更新 glass-panel 框體
    const panels = previewContainer.querySelectorAll<HTMLElement>('.glass-panel');
    panels.forEach(p => {
      p.style.background = `rgba(0, 0, 0, ${this.currentConfig.panelBgOpacity})`;
      p.style.border = `${this.currentConfig.panelBorderWidth}px solid ${this.currentConfig.panelBorderColor}`;
      p.style.borderRadius = `${this.currentConfig.panelBorderRadius}px`;
      p.style.boxShadow = this.currentConfig.panelBoxShadow;
      p.style.backdropFilter = `blur(${this.currentConfig.panelBackdropBlur}px)`;
    });

    // 更新按鈕樣式
    const btns = previewContainer.querySelectorAll<HTMLElement>('.action-btn');
    btns.forEach(b => {
      b.style.background = this.currentConfig.buttonBgGradient;
      b.style.borderColor = this.currentConfig.buttonBorderColor;
      b.style.color = this.currentConfig.buttonTextColor;
      b.style.borderRadius = `${this.currentConfig.buttonBorderRadius}px`;
    });

    // 同步數值文字
    const opText = document.getElementById('studio-panel-opacity-val');
    if (opText) opText.textContent = `${Math.round(this.currentConfig.panelBgOpacity * 100)}%`;
    const bwText = document.getElementById('studio-border-width-val');
    if (bwText) bwText.textContent = `${this.currentConfig.panelBorderWidth}px`;
    const brText = document.getElementById('studio-border-radius-val');
    if (brText) brText.textContent = `${this.currentConfig.panelBorderRadius}px`;
    const ratioText = document.getElementById('studio-left-ratio-val');
    if (ratioText) ratioText.textContent = `${this.currentConfig.facilityLeftPanelRatio}%`;
  }

  /**
   * 🌐 將主題動態注入至全遊戲 <style id="custom-theme-styles">
   */
  public static injectGlobalStyles(config: ThemeConfig): void {
    let styleEl = document.getElementById('custom-theme-styles') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-theme-styles';
      document.head.appendChild(styleEl);
    }

    const ratio = config.facilityLeftPanelRatio || 35;
    const rightRatio = 100 - ratio;

    let css = `
      /* 🎨 自訂設施內部面板風格 (嚴格排除右側帝國儀表板) */
      .facility-view .glass-panel:not(#shared-right-panel) {
        background: rgba(0, 0, 0, ${config.panelBgOpacity});
        border: ${config.panelBorderWidth}px solid ${config.panelBorderColor};
        border-radius: ${config.panelBorderRadius}px;
        box-shadow: ${config.panelBoxShadow};
        backdrop-filter: blur(${config.panelBackdropBlur}px);
      }

      /* 🎨 自訂通用按鈕風格 */
      .facility-view .action-btn:not(.btn-assign):not(.btn-exit-facility) {
        border-radius: ${config.buttonBorderRadius}px;
      }
    `;

    // 自訂背景注入
    if (config.backgrounds.church) {
      css += `#view-church { background-image: url("${config.backgrounds.church}") !important; background-size: cover !important; background-position: center !important; }`;
    }
    if (config.backgrounds.tavern) {
      css += `#view-camp { background-image: url("${config.backgrounds.tavern}") !important; background-size: cover !important; background-position: center !important; }`;
    }
    if (config.backgrounds.base) {
      css += `#view-base { background-image: url("${config.backgrounds.base}") !important; background-size: cover !important; background-position: center !important; }`;
    }
    if (config.backgrounds.forge) {
      css += `#view-forge { background-image: url("${config.backgrounds.forge}") !important; background-size: cover !important; background-position: center !important; }`;
    }

    styleEl.innerHTML = css;
  }

  private static saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentConfig));
  }

  private static getSceneName(scene: string): string {
    switch (scene) {
      case 'church': return '⛪ 教會/修道院';
      case 'tavern': return '🍺 冒險者酒館';
      case 'base': return '🏛️ 領主書房';
      case 'forge': return '⚒️ 領地鍛造屋';
      default: return scene;
    }
  }
}

// 暴露全域給主程式或控制台使用
(window as any).openThemeStudio = () => UIThemeStudio.open();
