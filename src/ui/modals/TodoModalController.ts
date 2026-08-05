import { UIManager } from '../UIManager';
import { GameState } from '../../core/GameState';
import { GAME_EVENTS } from '../../data/EventData';

export class TodoModalController {
  private static instance: TodoModalController;
  private constructor() {}
  public static getInstance(): TodoModalController {
    if (!TodoModalController.instance) {
      TodoModalController.instance = new TodoModalController();
    }
    return TodoModalController.instance;
  }

  public openTodoModal() {
const modal = document.getElementById('modal-todo')!;
  const container = document.getElementById('todo-list-container')!;
  const territory = GameState.myTerritory;
  
  container.innerHTML = '';

  if (!territory || !territory.pendingEvents || territory.pendingEvents.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8;">目前沒有待辦事項。</p>';
  } else {
    territory.pendingEvents.forEach((eventId, index) => {
      const evt = GAME_EVENTS.find(e => e.id === eventId);
      if (!evt) return;

      const card = document.createElement('div');
      card.className = 'glass-panel';
      card.style.padding = '15px';
      card.style.borderLeft = '4px solid #eab308';
      
      const title = document.createElement('h3');
      title.style.margin = '0 0 10px 0';
      title.style.color = '#eab308';
      title.textContent = evt.title;
      card.appendChild(title);

      const desc = document.createElement('p');
      desc.style.color = '#e2e8f0';
      desc.style.fontSize = '0.9em';
      desc.style.lineHeight = '1.5';
      desc.style.marginBottom = '15px';
      desc.textContent = evt.description;
      card.appendChild(desc);

      const optionsDiv = document.createElement('div');
      optionsDiv.style.display = 'flex';
      optionsDiv.style.gap = '10px';

      evt.options.forEach((opt: any) => {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.flex = '1';
        btn.style.fontSize = '0.85em';
        btn.style.padding = '8px';
        btn.textContent = opt.text;
        
        btn.addEventListener('click', () => {
          // 執行效果
          opt.onSelect();
          // 從 pendingEvents 移除
          territory.pendingEvents.splice(territory.pendingEvents.indexOf(eventId), 1);
          // 更新 UI
          UIManager.updateUI();
          // 重新渲染 Modal 或關閉
          if (territory.pendingEvents.length > 0) {
            this.openTodoModal();
          } else {
            modal.classList.remove('active');
          }
        });
        optionsDiv.appendChild(btn);
      });

      card.appendChild(optionsDiv);
      container.appendChild(card);
    });
  }

  const btnClose = document.getElementById('btn-close-todo')!;
  btnClose.onclick = () => modal.classList.remove('active');

  modal.classList.add('active');
  }
}
