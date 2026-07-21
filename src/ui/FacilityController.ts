import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { UIManager } from './UIManager';
import { returnToMap } from './SceneController';
import { openWarehouse, openTodoModal } from './ModalController';
import { startRoutePlanning } from './MapController';

export function initFacilityController(): void {
  // 點擊建築物效果
  const enterFacility = (viewId: string) => {
    const el = document.getElementById(viewId);
    if (el) el.classList.add('active');
    UIManager.updateUI();
  };

  document.getElementById('btn-enter-base')?.addEventListener('click', () => enterFacility('view-base'));
  document.getElementById('btn-enter-hall')?.addEventListener('click', () => enterFacility('view-hall'));
  document.getElementById('btn-enter-tavern')?.addEventListener('click', () => enterFacility('view-camp'));
  
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

  document.getElementById('btn-enter-forge')?.addEventListener('click', () => enterFacility('view-forge'));

  // 退出建築按鈕
  document.querySelectorAll('.btn-exit-facility').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('view-base')?.classList.remove('active');
      document.getElementById('view-hall')?.classList.remove('active');
      document.getElementById('view-camp')?.classList.remove('active');
      document.getElementById('view-forge')?.classList.remove('active');
      document.getElementById('view-weapon-shop')?.classList.remove('active');
      document.getElementById('view-armor-shop')?.classList.remove('active');
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

  // 倉庫與代辦事件
  document.getElementById('btn-base-warehouse')?.addEventListener('click', async () => {
    const { openWarehouse } = await import('./ShopController');
    openWarehouse(false);
  });
  document.getElementById('btn-todo-list')?.addEventListener('click', () => openTodoModal());
  document.getElementById('btn-forge-warehouse')?.addEventListener('click', async () => {
    const { openWarehouse } = await import('./ShopController');
    openWarehouse(true);
  });

  // 建立商隊：從書房啟動市場跟蹤商圖流程
  document.getElementById('btn-base-trade')?.addEventListener('click', () => {
    // 1. 關閉所有設施視圖
    document.getElementById('view-base')?.classList.remove('active');
    document.getElementById('view-hall')?.classList.remove('active');
    document.getElementById('view-camp')?.classList.remove('active');
    document.getElementById('view-forge')?.classList.remove('active');
    // 2. 返回地圖
    returnToMap();
    // 3. 進入路線規劃模式
    console.log('[系統] 🐪 請在地圖上依序點選最多 3 個城市作為商隊中途站，然後點擊「完成規劃」。');
    startRoutePlanning();
  });
}
