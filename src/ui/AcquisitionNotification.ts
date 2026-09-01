import { renderUniversalIcon } from './IconSpriteHelper';

export interface AcquisitionItem {
  name: string;
  icon?: string;
  quantity?: number;
}

export class AcquisitionNotification {
  private static queue: AcquisitionItem[][] = [];
  private static visible = false;

  public static enqueue(items: AcquisitionItem[]): void {
    const valid = items.filter(item => item.name && (item.quantity ?? 1) > 0);
    if (valid.length === 0 || typeof document === 'undefined') return;
    this.queue.push(valid);
    if (!this.visible) this.showNext();
  }

  private static showNext(): void {
    const items = this.queue.shift();
    if (!items) {
      this.visible = false;
      return;
    }
    this.visible = true;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1000001;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-label="取得物品" style="width:min(460px,92vw);max-height:80vh;overflow:auto;background:#1c1917;border:2px solid #f59e0b;border-radius:12px;padding:20px;color:#f5f5f4;box-shadow:0 24px 70px #000;">
        <h2 style="margin:0 0 14px;color:#fbbf24;text-align:center;">🎁 獲得獎勵</h2>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${items.map(item => `<div style="display:flex;align-items:center;gap:12px;padding:9px 12px;background:#0c0a09;border:1px solid #44403c;border-radius:7px;">${renderUniversalIcon(item.icon || '📦', 34)}<strong style="flex:1;color:#fde68a;">${this.escape(item.name)}</strong><span style="font-weight:bold;">× ${item.quantity ?? 1}</span></div>`).join('')}
        </div>
        <button type="button" data-acquisition-confirm style="display:block;width:100%;margin-top:16px;padding:9px;border:1px solid #fbbf24;border-radius:7px;background:#d97706;color:white;font-weight:bold;cursor:pointer;">確定</button>
      </div>`;
    const close = () => {
      overlay.remove();
      this.visible = false;
      this.showNext();
    };
    overlay.querySelector('[data-acquisition-confirm]')?.addEventListener('click', close);
    document.body.appendChild(overlay);
    (overlay.querySelector('[data-acquisition-confirm]') as HTMLButtonElement | null)?.focus();
  }

  private static escape(value: string): string {
    return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
  }
}
