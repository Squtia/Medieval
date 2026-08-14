export type LogType = 'info' | 'warning' | 'milestone' | 'narrative' | 'combat';

/**
 * 帝國日誌與訊息系統（視覺分層）
 */
export class GameLog {
  /**
   * 記錄一條日誌訊息
   * @param message 訊息內容
   * @param type 訊息類型 ('info' | 'warning' | 'milestone' | 'narrative' | 'combat')
   */
  static add(message: string, type: LogType = 'info'): void {
    const prefixes: Record<LogType, string> = {
      info: 'ℹ️ [資訊]',
      warning: '⚠️ [警告]',
      milestone: '⭐ [里程碑]',
      narrative: '🌙 [日誌]',
      combat: '⚔️ [戰鬥]'
    };

    const prefix = prefixes[type] || prefixes.info;
    console.log(`${prefix} ${message}`);

    // 若頁面上有全域或局部 log 容器，同步 append formatted HTML
    if (typeof document !== 'undefined') {
      const logContainer = document.getElementById('game-log-list');
      if (logContainer) {
        const entry = document.createElement('div');
        entry.className = `log-entry log-entry-${type}`;
        entry.innerHTML = `<span class="log-prefix">${prefix}</span> <span class="log-text">${message}</span>`;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
  }
}
