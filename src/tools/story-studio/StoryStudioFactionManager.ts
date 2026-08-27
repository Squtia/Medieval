import { Faction, FactionType, FactionPersonality } from '../../models/types';
import { FactionManager } from '../../systems/FactionManager';
import { escapeHtml } from './StoryStudioTypes';

export class StoryStudioFactionManager {
  private static instance: StoryStudioFactionManager;
  private modalEl: HTMLElement | null = null;
  private onUpdatedCallback: (() => void) | null = null;

  public static getInstance(): StoryStudioFactionManager {
    if (!this.instance) {
      this.instance = new StoryStudioFactionManager();
    }
    return this.instance;
  }

  constructor() {
    this.ensureModalHtml();
  }

  private ensureModalHtml(): void {
    let el = document.getElementById('story-studio-faction-manager-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story-studio-faction-manager-modal';
      el.className = 'story-studio-modal-overlay';
      el.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); z-index: 999999; display: none; align-items: center; justify-content: center; box-sizing: border-box;';
      el.innerHTML = `
        <div class="story-studio-modal-content" style="max-width: 680px; width: 90%; max-height: 85vh; display: flex; flex-direction: column; background: #1c1917; border: 2px solid #f59e0b; border-radius: 10px; color: #e7e5e4; box-shadow: 0 20px 50px rgba(0,0,0,0.9); overflow: hidden; z-index: 1000000;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #44403c; background: #292524;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.1rem; font-weight: bold; color: #fbbf24;">🏷️ 自訂陣營與聲望管理</span>
            </div>
            <button type="button" id="faction-manager-close" class="action-btn story-danger" style="padding: 3px 10px; font-size: 0.8rem;">✕ 關閉</button>
          </div>

          <div style="padding: 12px 16px; border-bottom: 1px solid #332f2c; background: #141210; font-size: 0.78rem; color: #a8a29e; line-height: 1.4;">
            在此新增的陣營將自動註冊為全域聲望項目（如遠古龍裔），可在故事條件、任務結算與遊戲內外交面板中直接使用。
          </div>

          <div id="faction-list-container" style="flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; max-height: 380px;">
          </div>

          <div style="padding: 12px 16px; border-top: 1px solid #292524; background: #292524; display: flex; flex-direction: column; gap: 8px;">
            <div style="font-weight: bold; font-size: 0.85rem; color: #fde68a;">➕ 新增自訂陣營</div>
            <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 8px;">
              <input type="text" id="new-faction-id" placeholder="陣營代號 (如 f_dragonkin)" style="padding: 5px 8px; background: #0c0a09; border: 1px solid #57534e; border-radius: 4px; color: #fff; font-size: 0.8rem;">
              <input type="text" id="new-faction-name" placeholder="陣營名稱 (如 遠古龍裔)" style="padding: 5px 8px; background: #0c0a09; border: 1px solid #57534e; border-radius: 4px; color: #fff; font-size: 0.8rem;">
            </div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="new-faction-desc" placeholder="陣營背景描述與特徵..." style="flex: 1; padding: 5px 8px; background: #0c0a09; border: 1px solid #57534e; border-radius: 4px; color: #fff; font-size: 0.8rem;">
              <button type="button" id="btn-add-faction" class="action-btn" style="padding: 5px 16px; font-size: 0.8rem; background: #d97706; color: #fff; border-color: #f59e0b;">＋ 加入陣營</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(el);
    }
    this.modalEl = el;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.modalEl) return;
    this.modalEl.querySelector('#faction-manager-close')?.addEventListener('click', () => this.close());
    
    this.modalEl.querySelector('#btn-add-faction')?.addEventListener('click', () => {
      const idInput = this.modalEl?.querySelector<HTMLInputElement>('#new-faction-id');
      const nameInput = this.modalEl?.querySelector<HTMLInputElement>('#new-faction-name');
      const descInput = this.modalEl?.querySelector<HTMLInputElement>('#new-faction-desc');

      const id = idInput?.value.trim().toLowerCase();
      const name = nameInput?.value.trim();
      const description = descInput?.value.trim() || '';

      if (!id || !name) {
        alert('請輸入完整的陣營代號與名稱');
        return;
      }

      const all = FactionManager.getAllFactions();
      if (all.some(f => f.id === id)) {
        alert(`陣營代號 ${id} 已存在！`);
        return;
      }

      const newFaction: Faction = {
        id,
        factionName: name,
        description,
        factionType: FactionType.MINOR_HOUSE,
        color: '#ea580c',
        resources: 1000,
        controlledNodes: [],
        capitalNodeId: '',
        playerFavor: 0,
        relations: {},
        atWarWith: [],
        personality: FactionPersonality.WARMONGER
      };

      FactionManager.upsertCustomFaction(newFaction);
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';

      this.renderList();
      if (this.onUpdatedCallback) this.onUpdatedCallback();
    });
  }

  public open(onUpdated?: () => void): void {
    this.ensureModalHtml();
    this.onUpdatedCallback = onUpdated || null;
    if (this.modalEl) this.modalEl.style.display = 'flex';
    this.renderList();
  }

  public close(): void {
    if (this.modalEl) this.modalEl.style.display = 'none';
  }

  private renderList(): void {
    if (!this.modalEl) return;
    const container = this.modalEl.querySelector<HTMLElement>('#faction-list-container');
    if (!container) return;
    container.innerHTML = '';

    const all = FactionManager.getAllFactions();
    const customList = FactionManager.getCustomFactions();
    const customIds = new Set(customList.map(f => f.id));

    all.forEach(faction => {
      const isCustom = customIds.has(faction.id);
      const row = document.createElement('div');
      row.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid #44403c; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;';
      
      const badge = isCustom
        ? `<span style="font-size: 0.68rem; padding: 1px 6px; border-radius: 3px; background: rgba(217,119,6,0.2); color: #fbbf24; border: 1px solid #d97706;">自訂陣營</span>`
        : `<span style="font-size: 0.68rem; padding: 1px 6px; border-radius: 3px; background: #292524; color: #a8a29e; border: 1px solid #44403c;">內建家族</span>`;

      row.innerHTML = `
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: bold; font-size: 0.88rem; color: #fde68a;">${escapeHtml(faction.factionName)}</span>
            <span style="font-size: 0.72rem; color: #a8a29e; font-family: monospace;">(${escapeHtml(faction.id)})</span>
            ${badge}
          </div>
          <div style="font-size: 0.72rem; color: #78716c; margin-top: 2px;">${escapeHtml(faction.description || '')}</div>
        </div>
        ${isCustom ? `<button type="button" class="action-btn story-danger" data-delete-faction="${faction.id}" style="padding: 2px 8px; font-size: 0.72rem; margin-left: 10px;">刪除</button>` : ''}
      `;

      if (isCustom) {
        row.querySelector(`[data-delete-faction="${faction.id}"]`)?.addEventListener('click', () => {
          if (confirm(`確定要刪除自訂陣營「${faction.factionName}」嗎？`)) {
            FactionManager.deleteCustomFaction(faction.id);
            this.renderList();
            if (this.onUpdatedCallback) this.onUpdatedCallback();
          }
        });
      }

      container.appendChild(row);
    });
  }
}
