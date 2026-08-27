import { ToastManager } from '../ui/ToastManager';

export interface ElementOverride {
  selector: string;
  name: string;
  left?: string;
  top?: string;
  right?: string;
  bottom?: string;
  width?: string;
  height?: string;
  borderRadius?: string;
  border?: string;
  opacity?: string;
  boxShadow?: string;
  backgroundImage?: string;
  backgroundColor?: string;
}

export class LiveLayoutEditor {
  private static STORAGE_KEY = 'medieval_live_layout_overrides';
  private static isOpen = false;
  private static isInspectMode = false;
  private static isDragMode = false;
  private static selectedElement: HTMLElement | null = null;
  private static selectedSelector: string = '';
  private static overrides: Record<string, ElementOverride> = {};

  private static inspectorOverlay: HTMLElement | null = null;
  private static panelContainer: HTMLElement | null = null;

  /**
   * 🌟 遊戲開局載入已儲存的所有排版位置與樣式
   */
  public static loadAndApply(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.overrides = JSON.parse(saved);
        this.applyAllOverrides();
      } catch (e) {
        console.warn('載入排版設定失敗', e);
      }
    }
  }

  /**
   * 🎨 開啟/切換即時編輯面板
   */
  public static toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public static open(): void {
    this.isOpen = true;
    this.createEditorDOM();
    this.enableInspector();
    ToastManager.show('🎨 已開啟「即時排版與美術編輯器」！請點擊畫面上任意元素進行調整。', 'success');
  }

  public static close(): void {
    this.isOpen = false;
    this.disableInspector();
    this.disableDrag();
    if (this.panelContainer) {
      this.panelContainer.remove();
      this.panelContainer = null;
    }
    if (this.inspectorOverlay) {
      this.inspectorOverlay.remove();
      this.inspectorOverlay = null;
    }
    ToastManager.show('✖ 已關閉即時排版編輯器。', 'info');
  }

  private static createEditorDOM(): void {
    if (this.panelContainer) this.panelContainer.remove();

    this.panelContainer = document.createElement('div');
    this.panelContainer.id = 'live-layout-editor-panel';
    this.panelContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 380px;
      max-height: calc(100vh - 40px);
      background: rgba(17, 24, 39, 0.95);
      border: 2px solid #eab308;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(234, 179, 8, 0.3);
      backdrop-filter: blur(12px);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden;
    `;

    this.panelContainer.innerHTML = `
      <!-- 頂部標題列 -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(234,179,8,0.4);">
        <div style="font-weight: bold; color: #fbbf24; font-size: 1.1em; display: flex; align-items: center; gap: 8px;">
          <span>🎨 畫面排版與美術編輯器</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="btn-live-save" style="padding: 4px 10px; font-size: 0.82em; font-weight: bold; background: linear-gradient(135deg, #059669, #047857); color: #fff; border: 1px solid #10b981; border-radius: 4px; cursor: pointer;">💾 儲存</button>
          <button id="btn-live-close" style="padding: 4px 8px; font-size: 0.85em; background: rgba(239,68,68,0.3); color: #f87171; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer;">✖</button>
        </div>
      </div>

      <!-- 快捷操作列 -->
      <div style="display: flex; gap: 8px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.08);">
        <button id="btn-live-inspect-toggle" style="flex: 1; padding: 6px; font-size: 0.85em; background: #eab308; color: #000; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">🔍 點選元素模式 (開啟)</button>
        <button id="btn-live-drag-toggle" style="flex: 1; padding: 6px; font-size: 0.85em; background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; cursor: pointer;">🖱️ 自由拖曳移動</button>
      </div>

      <!-- 核心屬性編輯區 (可捲動) -->
      <div id="live-editor-props" style="flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; font-size: 0.88em;">
        <div style="color: #94a3b8; text-align: center; padding: 30px 10px;">
          👈 請點擊遊戲畫面上的任意元素（例如：建築圖標、進度條、NPC頭像、背景、輪盤），即可在此即時調整！
        </div>
      </div>
    `;

    document.body.appendChild(this.panelContainer);

    // 綁定頂部事件
    document.getElementById('btn-live-close')?.addEventListener('click', () => this.close());
    document.getElementById('btn-live-save')?.addEventListener('click', () => {
      this.saveToStorage();
      ToastManager.show('💾 畫面排版與美術設定已成功儲存！', 'success');
    });

    // 點選模式切換
    document.getElementById('btn-live-inspect-toggle')?.addEventListener('click', () => {
      this.isInspectMode = !this.isInspectMode;
      const btn = document.getElementById('btn-live-inspect-toggle');
      if (btn) {
        btn.textContent = this.isInspectMode ? '🔍 點選元素模式 (開啟)' : '🔍 點選元素模式 (暫停)';
        btn.style.background = this.isInspectMode ? '#eab308' : 'rgba(255,255,255,0.1)';
        btn.style.color = this.isInspectMode ? '#000' : '#cbd5e1';
      }
    });

    // 拖曳模式切換
    document.getElementById('btn-live-drag-toggle')?.addEventListener('click', () => {
      this.isDragMode = !this.isDragMode;
      const btn = document.getElementById('btn-live-drag-toggle');
      if (btn) {
        btn.textContent = this.isDragMode ? '🖱️ 拖曳中 (點畫面拖動)' : '🖱️ 自由拖曳移動';
        btn.style.background = this.isDragMode ? '#3b82f6' : 'rgba(255,255,255,0.1)';
        btn.style.color = this.isDragMode ? '#fff' : '#cbd5e1';
      }
      if (this.isDragMode) {
        this.enableDrag();
      } else {
        this.disableDrag();
      }
    });
  }

  /**
   * 🔍 啟用元素游標探測高亮
   */
  private static enableInspector(): void {
    this.isInspectMode = true;

    if (!this.inspectorOverlay) {
      this.inspectorOverlay = document.createElement('div');
      this.inspectorOverlay.id = 'live-inspector-highlight';
      this.inspectorOverlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        border: 2px dashed #fbbf24;
        background: rgba(234, 179, 8, 0.15);
        box-shadow: 0 0 10px rgba(234, 179, 8, 0.5);
        z-index: 999998;
        display: none;
        transition: all 0.05s ease;
      `;
      document.body.appendChild(this.inspectorOverlay);
    }

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('click', this.onElementClick, true);
  }

  private static disableInspector(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('click', this.onElementClick, true);
    if (this.inspectorOverlay) this.inspectorOverlay.style.display = 'none';
  }

  private static onMouseMove = (e: MouseEvent) => {
    if (!LiveLayoutEditor.isInspectMode) return;
    const target = e.target as HTMLElement;
    if (!target || target.closest('#live-layout-editor-panel') || target.id === 'live-inspector-highlight') {
      if (LiveLayoutEditor.inspectorOverlay) LiveLayoutEditor.inspectorOverlay.style.display = 'none';
      return;
    }

    const meaningfulTarget = LiveLayoutEditor.getMeaningfulTarget(target);
    if (meaningfulTarget && LiveLayoutEditor.inspectorOverlay) {
      const rect = meaningfulTarget.getBoundingClientRect();
      LiveLayoutEditor.inspectorOverlay.style.display = 'block';
      LiveLayoutEditor.inspectorOverlay.style.top = `${rect.top}px`;
      LiveLayoutEditor.inspectorOverlay.style.left = `${rect.left}px`;
      LiveLayoutEditor.inspectorOverlay.style.width = `${rect.width}px`;
      LiveLayoutEditor.inspectorOverlay.style.height = `${rect.height}px`;
    }
  };

  private static onElementClick = (e: MouseEvent) => {
    if (!LiveLayoutEditor.isInspectMode) return;
    const target = e.target as HTMLElement;
    if (!target || target.closest('#live-layout-editor-panel')) return;

    e.preventDefault();
    e.stopPropagation();

    const meaningfulTarget = LiveLayoutEditor.getMeaningfulTarget(target);
    if (meaningfulTarget) {
      LiveLayoutEditor.selectElement(meaningfulTarget);
    }
  };

  /**
   * 識別有意義的 UI 元件（如建築圖標、進度條、頭像、輪盤等）
   */
  private static getMeaningfulTarget(el: HTMLElement): HTMLElement {
    const candidate = el.closest(
      '#street-container, .street-building, #street-prosperity-bar-container, #street-events-rail, .street-npc-token, #command-crest-container, #dock-shortcuts, #btn-bounty-board, #top-bar, .glass-panel, #app-background'
    ) as HTMLElement;
    return candidate || el;
  }

  /**
   * 🎯 選中某個元素並在右側面板展示編輯控制項
   */
  public static selectElement(el: HTMLElement): void {
    this.selectedElement = el;
    this.selectedSelector = this.getElementSelector(el);

    const propsContainer = document.getElementById('live-editor-props');
    if (!propsContainer) return;

    const friendlyName = this.getElementFriendlyName(el);
    const computed = window.getComputedStyle(el);
    const currentOverride = this.overrides[this.selectedSelector] || {
      selector: this.selectedSelector,
      name: friendlyName
    };

    propsContainer.innerHTML = `
      <div style="background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; border: 1px solid rgba(234,179,8,0.3);">
        <div style="font-weight: bold; color: #fbbf24; font-size: 1.05em; margin-bottom: 2px;">
          🎯 ${friendlyName}
        </div>
        <div style="font-size: 0.75em; color: #94a3b8; font-family: monospace;">${this.selectedSelector}</div>
      </div>

      <!-- 1. 🖼️ 更換圖片/背景 -->
      <div style="background: rgba(0,0,0,0.35); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 6px;">
        <div style="font-weight: bold; color: #60a5fa;">🖼️ 素材與背景圖片替換</div>
        <label style="padding: 6px 10px; font-size: 0.85em; text-align: center; cursor: pointer; background: linear-gradient(135deg, #0284c7, #0369a1); border: 1px solid #38bdf8; border-radius: 4px; color: #fff;">
          📁 從電腦選擇新圖片 (PNG/JPG)...
          <input type="file" id="prop-file-bg" accept="image/*" style="display: none;">
        </label>
      </div>

      <!-- 2. 📐 位置與座標 (Position) -->
      <div style="background: rgba(0,0,0,0.35); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
        <div style="font-weight: bold; color: #4ade80;">📐 位置與尺寸 (可直接勾選自由拖曳)</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <span style="font-size: 0.78em; color: #94a3b8;">X 水平座標 (Left)</span>
            <input type="text" id="prop-left" value="${el.style.left || computed.left}" style="width: 100%; background: #000; color: #fff; border: 1px solid #475569; padding: 4px; border-radius: 4px; font-size: 0.85em;">
          </div>
          <div>
            <span style="font-size: 0.78em; color: #94a3b8;">Y 垂直座標 (Top)</span>
            <input type="text" id="prop-top" value="${el.style.top || computed.top}" style="width: 100%; background: #000; color: #fff; border: 1px solid #475569; padding: 4px; border-radius: 4px; font-size: 0.85em;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <span style="font-size: 0.78em; color: #94a3b8;">寬度 (Width)</span>
            <input type="text" id="prop-width" value="${el.style.width || computed.width}" style="width: 100%; background: #000; color: #fff; border: 1px solid #475569; padding: 4px; border-radius: 4px; font-size: 0.85em;">
          </div>
          <div>
            <span style="font-size: 0.78em; color: #94a3b8;">高度 (Height)</span>
            <input type="text" id="prop-height" value="${el.style.height || computed.height}" style="width: 100%; background: #000; color: #fff; border: 1px solid #475569; padding: 4px; border-radius: 4px; font-size: 0.85em;">
          </div>
        </div>
      </div>

      <!-- 3. 🖼️ 邊框與圓角 (Border & Frame) -->
      <div style="background: rgba(0,0,0,0.35); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
        <div style="font-weight: bold; color: #facc15;">🖼️ 邊框與外觀風格</div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #cbd5e1;">
            <span>圓角 (Border Radius)</span>
            <span id="prop-radius-val">${parseInt(computed.borderRadius, 10) || 0}px</span>
          </div>
          <input type="range" id="prop-radius" min="0" max="40" step="2" value="${parseInt(computed.borderRadius, 10) || 0}" style="width: 100%; accent-color: #eab308;">
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: #cbd5e1;">
            <span>透明度 (Opacity)</span>
            <span id="prop-opacity-val">${Math.round(parseFloat(computed.opacity || '1') * 100)}%</span>
          </div>
          <input type="range" id="prop-opacity" min="0.1" max="1" step="0.05" value="${parseFloat(computed.opacity || '1')}" style="width: 100%; accent-color: #eab308;">
        </div>
      </div>

      <button id="btn-prop-reset-element" style="padding: 8px; font-size: 0.85em; background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; margin-top: 4px;">
        ↩️ 還原此元素預設樣式
      </button>
    `;

    this.bindPropertyListeners(el);
  }

  private static bindPropertyListeners(el: HTMLElement): void {
    const sel = this.selectedSelector;
    if (!this.overrides[sel]) {
      this.overrides[sel] = { selector: sel, name: this.getElementFriendlyName(el) };
    }

    // 換圖片 (FileReader)
    document.getElementById('prop-file-bg')?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        if (base64) {
          el.style.backgroundImage = `url("${base64}")`;
          el.style.backgroundSize = 'cover';
          this.overrides[sel].backgroundImage = base64;
          ToastManager.show(`🖼️ 已替換 ${this.getElementFriendlyName(el)} 的圖片！`, 'success');
        }
      };
      reader.readAsDataURL(file);
    });

    // 座標與尺寸
    document.getElementById('prop-left')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      el.style.left = val;
      this.overrides[sel].left = val;
    });
    document.getElementById('prop-top')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      el.style.top = val;
      this.overrides[sel].top = val;
    });
    document.getElementById('prop-width')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      el.style.width = val;
      this.overrides[sel].width = val;
    });
    document.getElementById('prop-height')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      el.style.height = val;
      this.overrides[sel].height = val;
    });

    // 圓角與透明度
    document.getElementById('prop-radius')?.addEventListener('input', (e) => {
      const val = `${(e.target as HTMLInputElement).value}px`;
      el.style.borderRadius = val;
      this.overrides[sel].borderRadius = val;
      const t = document.getElementById('prop-radius-val');
      if (t) t.textContent = val;
    });
    document.getElementById('prop-opacity')?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      el.style.opacity = val;
      this.overrides[sel].opacity = val;
      const t = document.getElementById('prop-opacity-val');
      if (t) t.textContent = `${Math.round(parseFloat(val) * 100)}%`;
    });

    // 還原元素
    document.getElementById('btn-prop-reset-element')?.addEventListener('click', () => {
      delete this.overrides[sel];
      el.removeAttribute('style');
      this.selectElement(el);
      ToastManager.show(`↩️ 已還原 ${this.getElementFriendlyName(el)} 的預設外觀！`, 'info');
    });
  }

  /**
   * 🖱️ 啟用滑鼠直接拖曳元素
   */
  private static dragTarget: HTMLElement | null = null;
  private static dragStartX = 0;
  private static dragStartY = 0;
  private static initialElemX = 0;
  private static initialElemY = 0;

  private static enableDrag(): void {
    document.addEventListener('mousedown', this.onMouseDownDrag);
    document.addEventListener('mousemove', this.onMouseMoveDrag);
    document.addEventListener('mouseup', this.onMouseUpDrag);
  }

  private static disableDrag(): void {
    document.removeEventListener('mousedown', this.onMouseDownDrag);
    document.removeEventListener('mousemove', this.onMouseMoveDrag);
    document.removeEventListener('mouseup', this.onMouseUpDrag);
    this.dragTarget = null;
  }

  private static onMouseDownDrag = (e: MouseEvent) => {
    if (!LiveLayoutEditor.isDragMode) return;
    const target = e.target as HTMLElement;
    if (!target || target.closest('#live-layout-editor-panel')) return;

    const el = LiveLayoutEditor.getMeaningfulTarget(target);
    if (!el) return;

    LiveLayoutEditor.dragTarget = el;
    LiveLayoutEditor.dragStartX = e.clientX;
    LiveLayoutEditor.dragStartY = e.clientY;

    const rect = el.getBoundingClientRect();
    LiveLayoutEditor.initialElemX = rect.left;
    LiveLayoutEditor.initialElemY = rect.top;

    if (window.getComputedStyle(el).position === 'static') {
      el.style.position = 'absolute';
    }

    LiveLayoutEditor.selectElement(el);
  };

  private static onMouseMoveDrag = (e: MouseEvent) => {
    if (!LiveLayoutEditor.isDragMode || !LiveLayoutEditor.dragTarget) return;
    const dx = e.clientX - LiveLayoutEditor.dragStartX;
    const dy = e.clientY - LiveLayoutEditor.dragStartY;

    const newX = LiveLayoutEditor.initialElemX + dx;
    const newY = LiveLayoutEditor.initialElemY + dy;

    LiveLayoutEditor.dragTarget.style.left = `${newX}px`;
    LiveLayoutEditor.dragTarget.style.top = `${newY}px`;

    // 同步到輸入框
    const inputX = document.getElementById('prop-left') as HTMLInputElement | null;
    const inputY = document.getElementById('prop-top') as HTMLInputElement | null;
    if (inputX) inputX.value = `${newX}px`;
    if (inputY) inputY.value = `${newY}px`;

    const sel = LiveLayoutEditor.selectedSelector;
    if (sel && LiveLayoutEditor.overrides[sel]) {
      LiveLayoutEditor.overrides[sel].left = `${newX}px`;
      LiveLayoutEditor.overrides[sel].top = `${newY}px`;
    }
  };

  private static onMouseUpDrag = () => {
    LiveLayoutEditor.dragTarget = null;
  };

  private static saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.overrides));
  }

  private static applyAllOverrides(): void {
    Object.values(this.overrides).forEach(ov => {
      try {
        const el = document.querySelector<HTMLElement>(ov.selector);
        if (el) {
          if (ov.left) el.style.left = ov.left;
          if (ov.top) el.style.top = ov.top;
          if (ov.right) el.style.right = ov.right;
          if (ov.bottom) el.style.bottom = ov.bottom;
          if (ov.width) el.style.width = ov.width;
          if (ov.height) el.style.height = ov.height;
          if (ov.borderRadius) el.style.borderRadius = ov.borderRadius;
          if (ov.opacity) el.style.opacity = ov.opacity;
          if (ov.backgroundImage) {
            el.style.backgroundImage = `url("${ov.backgroundImage}")`;
            el.style.backgroundSize = 'cover';
          }
        }
      } catch (e) {
        console.warn(`套用自訂樣式失敗: ${ov.selector}`, e);
      }
    });
  }

  private static getElementSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    if (el.className) {
      const cls = el.className.split(' ').filter(c => c && !c.includes('active')).join('.');
      if (cls) return `.${cls}`;
    }
    return el.tagName.toLowerCase();
  }

  private static getElementFriendlyName(el: HTMLElement): string {
    if (el.id === 'btn-enter-base') return '🏰 街道建築 (領主自宅)';
    if (el.id === 'btn-enter-forge') return '⚒️ 街道建築 (進階鍛造屋)';
    if (el.id === 'btn-enter-church') return '⛪ 街道建築 (教會醫療所)';
    if (el.id === 'btn-enter-tavern') return '🍺 街道建築 (冒險者酒館)';
    if (el.id === 'street-prosperity-bar-container') return '📊 街道繁榮度進度條';
    if (el.closest('#street-events-rail') || el.classList.contains('street-npc-token')) return '👤 街道訪客 NPC 頭像';
    if (el.id === 'command-crest-container') return '🎡 右下角指令與推進輪盤';
    if (el.id === 'dock-shortcuts') return '🔘 底部功能按鈕組';
    if (el.id === 'btn-bounty-board') return '📜 懸賞委託欄';
    if (el.id === 'top-bar') return '👑 頂部資源列';
    if (el.id === 'app-background' || el.id === 'street-container') return '🖼️ 街道全景背景圖';
    return el.id || el.className || el.tagName;
  }
}

// 暴露全域
(window as any).openLiveLayoutEditor = () => LiveLayoutEditor.open();
(window as any).toggleLiveLayoutEditor = () => LiveLayoutEditor.toggle();
