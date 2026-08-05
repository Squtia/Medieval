import { UIManager } from '../UIManager';

export class EventModalController {
  private static instance: EventModalController;

  private constructor() {}

  public static getInstance(): EventModalController {
    if (!EventModalController.instance) {
      EventModalController.instance = new EventModalController();
    }
    return EventModalController.instance;
  }

  public openEventModal(event: any) {
    const modal = document.getElementById('modal-event')!;
    document.getElementById('event-title')!.textContent = event.title;
    document.getElementById('event-desc')!.textContent = event.description;
    
    const optionsContainer = document.getElementById('event-options')!;
    optionsContainer.innerHTML = '';
    
    event.options.forEach((opt: any) => {
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.textContent = opt.text;
      btn.addEventListener('click', () => {
        // 攔截 console.log 來獲取事件執行的結果文字
        const oldLog = console.log;
        let resultMsg = '';
        console.log = (...args) => {
          resultMsg += args.join(' ') + '\n';
          oldLog(...args); // 依然輸出給底層 logger
        };
        
        opt.onSelect();
        console.log = oldLog; // 恢復
        
        UIManager.updateUI();
        modal.classList.remove('active');
        
        // 將事件結果用 Toast 彈出，讓玩家看見得失 (傳入 0 表示不自動消失該訊息，玩家可點擊關閉)
        if (resultMsg.trim()) {
          import('../ToastManager').then(({ ToastManager }) => {
            const cleanMsg = resultMsg.replace(/\[.*?\]/g, '').trim(); // 移除標籤
            ToastManager.show(cleanMsg, 'info', 0);
          });
        }
      });
      optionsContainer.appendChild(btn);
    });
    
    modal.classList.add('active');
  }
}
