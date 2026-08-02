import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { UIManager } from './UIManager';
import { returnToMap } from './SceneController';
import { openWarehouse, openTodoModal } from './ModalController';

export function initFacilityController(): void {
  // 點擊建築物效果
  const enterFacility = (viewId: string) => {
    const el = document.getElementById(viewId);
    if (el) {
      // CSS .facility-view.active { display:flex } 已定義顯示，只需操作 class
      el.classList.add('active');
    }
    UIManager.updateUI();
  };

  document.getElementById('btn-enter-base')?.addEventListener('click', () => enterFacility('view-base'));
  document.getElementById('btn-enter-hall')?.addEventListener('click', async () => {
    enterFacility('view-hall');
    const { renderOfficeBoard } = await import('./OfficeController');
    renderOfficeBoard();
  });
  document.getElementById('btn-enter-tavern')?.addEventListener('click', () => {
    enterFacility('view-camp');
    const lvl = GameState.myTerritory.getBuildingLevel('tavern');
    const viewCamp = document.getElementById('view-camp');
    if (viewCamp) {
      const titleEl = viewCamp.querySelector('h2');
      const descEl = viewCamp.querySelector('p');
      if (titleEl && descEl) {
        if (lvl <= 2) {
          titleEl.innerHTML = '🔥 露天營火 (Campfire)';
          descEl.innerHTML = '這是冒險者們在荒野中短暫歇息的營火。微弱的火光或許能吸引一些流浪的傭兵前來。';
        } else if (lvl <= 4) {
          titleEl.innerHTML = '🍻 簡易酒館 (Small Tavern)';
          descEl.innerHTML = '用木板搭建的簡易酒館，提供了遮風避雨的場所，開始有更多傭兵聚集於此。';
        } else {
          titleEl.innerHTML = '🍻 傭兵酒館 (Tavern)';
          descEl.innerHTML = '這裡是傭兵齊聚的酒館。隨著酒館等級的提升，將有機會吸引更具名氣與實力的英雄加入您的傭兵團！';
        }
      }
    }
  });
  
  document.getElementById('btn-enter-weapon-shop')?.addEventListener('click', async () => {
    enterFacility('view-weapon-shop');
    const { renderWeaponShop } = await import('./ShopController');
    renderWeaponShop();
  });

  document.getElementById('btn-enter-armor-shop')?.addEventListener('click', async () => {
    enterFacility('view-armor-shop');
    const { renderArmorShop } = await import('./ShopController');
    renderArmorShop();
  });

  document.getElementById('btn-enter-forge')?.addEventListener('click', async () => {
    enterFacility('view-forge');
    const { renderForgeView } = await import('./ShopController');
    renderForgeView();
  });

  // 退出建築按鈕
  document.querySelectorAll('.btn-exit-facility').forEach(btn => {
    btn.addEventListener('click', () => {
      // CSS .facility-view { display:none } 確保隱藏，只需移除 active class
      document.querySelectorAll('.facility-view').forEach(view => {
        view.classList.remove('active');
      });
      UIManager.updateUI();
    });
  });

  // 工作分配按鈕
  document.querySelectorAll('.btn-assign').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const job = target.getAttribute('data-job')!;
      const amount = parseInt(target.getAttribute('data-amount')!);
      
      if (GameState.myTerritory.assignWorker(job, amount)) {
        EventBus.getInstance().publish({
          type: GameEventType.WORKER_ASSIGNED,
          payload: { job, currentCount: GameState.myTerritory.workers[job], unassignedCount: GameState.myTerritory.workers['UNASSIGNED'] }
        });
        UIManager.updateUI();
      }
    });
  });

  // 工作分配滑桿事件
  document.querySelectorAll<HTMLInputElement>('.worker-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const job = target.getAttribute('data-job')!;
      const newTargetValue = parseInt(target.value);
      const currentVal = GameState.myTerritory.workers[job] || 0;
      const delta = newTargetValue - currentVal;

      if (delta !== 0) {
        if (GameState.myTerritory.assignWorker(job, delta)) {
          EventBus.getInstance().publish({
            type: GameEventType.WORKER_ASSIGNED,
            payload: { job, currentCount: GameState.myTerritory.workers[job], unassignedCount: GameState.myTerritory.workers['UNASSIGNED'] }
          });
          UIManager.updateUI();
        }
      }
    });
  });

  // 倉庫與代辦事件
  document.getElementById('btn-base-warehouse')?.addEventListener('click', async () => {
    const { openHomeWarehouse } = await import('./ShopController');
    openHomeWarehouse();
  });
  document.getElementById('btn-todo-list')?.addEventListener('click', () => openTodoModal());
  document.getElementById('btn-forge-warehouse')?.addEventListener('click', async () => {
    const { openWarehouse } = await import('./ShopController');
    openWarehouse(true);
  });


}
