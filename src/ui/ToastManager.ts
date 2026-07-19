export type ToastType = 'success' | 'warning' | 'error' | 'info';

export class ToastManager {
  private static container: HTMLDivElement | null = null;

  public static init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.position = 'fixed';
    this.container.style.top = '20px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.zIndex = '9999';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '10px';
    this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
  }

  public static show(msg: string, type: ToastType = 'info', durationMs: number = 3000) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    let bgColor = 'rgba(15, 23, 42, 0.9)';
    let borderColor = '#3b82f6';
    
    if (type === 'success') {
      icon = '✅';
      borderColor = '#10b981';
    } else if (type === 'warning') {
      icon = '⚠️';
      borderColor = '#f59e0b';
    } else if (type === 'error') {
      icon = '❌';
      borderColor = '#ef4444';
    }

    toast.style.background = bgColor;
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.borderLeft = `4px solid ${borderColor}`;
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    toast.style.fontFamily = "'Noto Sans TC', sans-serif";
    toast.style.fontSize = '0.95em';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'all 0.3s ease';

    toast.innerHTML = `<span style="font-size: 1.2em;">${icon}</span><span>${msg}</span>`;
    
    this.container!.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Remove after duration
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      toast.addEventListener('transitionend', () => {
        if (toast.parentElement) {
          toast.remove();
        }
      });
    }, durationMs);
  }
}
