import { UIManager } from '../UIManager';
import { GameState } from '../../core/GameState';
import { GAME_EVENTS } from '../../data/EventData';
import { NarrativeSystem } from '../../systems/NarrativeSystem';
import { ToastManager } from '../ToastManager';

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
    const territory = GameState.myTerritory as any;
    
    container.innerHTML = '';

    const pendingLegacyEvents = territory?.pendingEvents || [];
    const pendingNarrativeNodes: string[] = territory?.pendingNarrativeNodes || [];

    const totalCount = pendingLegacyEvents.length + pendingNarrativeNodes.length;

    if (totalCount === 0) {
      container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding: 20px 0;">目前沒有待辦事項。</p>';
    } else {
      // 1. 渲染故事工坊 TODO_LIST 節點
      pendingNarrativeNodes.forEach((key: string) => {
        const [storyId, nodeId] = key.split(':');
        const ref = NarrativeSystem.findNode(storyId, nodeId);
        if (!ref) return;

        const card = document.createElement('div');
        card.className = 'glass-panel';
        card.style.padding = '15px';
        card.style.borderLeft = '4px solid #f59e0b';
        card.style.marginBottom = '12px';
        
        const title = document.createElement('h3');
        title.style.margin = '0 0 10px 0';
        title.style.color = '#fde68a';
        title.style.fontSize = '1.05rem';
        title.textContent = `📋 ${ref.node.title}`;
        card.appendChild(title);

        const desc = document.createElement('p');
        desc.style.color = '#e2e8f0';
        desc.style.fontSize = '0.9em';
        desc.style.lineHeight = '1.5';
        desc.style.marginBottom = '15px';
        desc.textContent = ref.node.description;
        card.appendChild(desc);

        const optionsDiv = document.createElement('div');
        optionsDiv.style.display = 'flex';
        optionsDiv.style.flexWrap = 'wrap';
        optionsDiv.style.gap = '8px';

        const choices = ref.node.choices.length > 0
          ? ref.node.choices
          : [{ id: 'confirm', text: '知悉並確認', effects: [], resultText: '' }];

        choices.forEach(choice => {
          const btn = document.createElement('button');
          btn.className = 'action-btn';
          btn.style.flex = '1 1 min(200px, 100%)';
          btn.style.fontSize = '0.85em';
          btn.style.padding = '8px 12px';
          
          const check = NarrativeSystem.canAffordChoice(choice);
          if (!check.affordable) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            btn.style.color = '#94a3b8';
            btn.textContent = `${choice.text} ⚠️ (${check.missingReason})`;
          } else {
            btn.textContent = choice.text;
          }
          
          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            NarrativeSystem.resolveChoice(storyId, nodeId, choice);
            
            // 從待辦清單移除
            const idx = territory.pendingNarrativeNodes.indexOf(key);
            if (idx !== -1) territory.pendingNarrativeNodes.splice(idx, 1);

            if (choice.resultText) {
              ToastManager.show(choice.resultText, 'info', 0);
            }

            UIManager.updateUI();

            const remaining = (territory.pendingEvents?.length || 0) + (territory.pendingNarrativeNodes?.length || 0);
            if (remaining > 0) {
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

      // 2. 渲染既有傳統事件
      pendingLegacyEvents.forEach((eventId: string) => {
        const evt = GAME_EVENTS.find(e => e.id === eventId);
        if (!evt) return;

        const card = document.createElement('div');
        card.className = 'glass-panel';
        card.style.padding = '15px';
        card.style.borderLeft = '4px solid #eab308';
        card.style.marginBottom = '12px';
        
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
        optionsDiv.style.flexWrap = 'wrap';
        optionsDiv.style.gap = '8px';

        evt.options.forEach((opt: any) => {
          const btn = document.createElement('button');
          btn.className = 'action-btn';
          btn.style.flex = '1 1 min(200px, 100%)';
          btn.style.fontSize = '0.85em';
          btn.style.padding = '8px 12px';
          btn.textContent = opt.text;
          
          btn.addEventListener('click', () => {
            opt.onSelect();
            const idx = territory.pendingEvents.indexOf(eventId);
            if (idx !== -1) territory.pendingEvents.splice(idx, 1);
            UIManager.updateUI();
            
            const remaining = (territory.pendingEvents?.length || 0) + (territory.pendingNarrativeNodes?.length || 0);
            if (remaining > 0) {
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
