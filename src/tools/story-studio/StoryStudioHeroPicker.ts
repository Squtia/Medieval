import { getSelectableHeroes, UniqueHeroDef } from '../../data/UniqueAdventurers';
import { renderUniversalIcon } from '../../ui/IconSpriteHelper';
import { escapeHtml } from './StoryStudioTypes';

export interface HeroPickerOptions {
  mode: 'SINGLE' | 'MULTI';
  selectedHeroIds: string[];
  title?: string;
  onConfirm: (heroIds: string[]) => void;
}

export class StoryStudioHeroPicker {
  private static instance: StoryStudioHeroPicker;
  private modalEl: HTMLElement | null = null;
  private currentMode: 'SINGLE' | 'MULTI' = 'SINGLE';
  private selectedIds: Set<string> = new Set();
  private searchQuery: string = '';
  private qualityFilter: string = 'ALL';
  private onConfirmCallback: ((heroIds: string[]) => void) | null = null;

  public static getInstance(): StoryStudioHeroPicker {
    if (!this.instance) {
      this.instance = new StoryStudioHeroPicker();
    }
    return this.instance;
  }

  constructor() {
    this.ensureModalHtml();
  }

  private ensureModalHtml(): void {
    let el = document.getElementById('story-studio-hero-picker-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story-studio-hero-picker-modal';
      el.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); z-index: 999999; display: none; align-items: center; justify-content: center; box-sizing: border-box;';
      el.innerHTML = `
        <div class="story-studio-modal-content" style="max-width: 860px; width: 92%; max-height: 88vh; display: flex; flex-direction: column; background: #1c1917; border: 2px solid #f59e0b; border-radius: 10px; color: #e7e5e4; box-shadow: 0 20px 50px rgba(0,0,0,0.9); overflow: hidden; z-index: 1000000;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #44403c; background: #292524;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="hero-picker-modal-title" style="font-size: 1.2rem; font-weight: bold; color: #fbbf24;">👑 挑選英雄單位</span>
            </div>
            <button type="button" id="hero-picker-close" class="action-btn story-danger" style="padding: 5px 12px; font-size: 0.85rem; cursor: pointer;">✕ 關閉</button>
          </div>

          <div style="display: flex; gap: 10px; padding: 12px 18px; border-bottom: 1px solid #332f2c; background: #1f1c19; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 220px; position: relative;">
              <input type="text" id="hero-picker-search" placeholder="🔍 搜尋英雄名稱、稱號或職業..." style="width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 6px; background: #141210; border: 1px solid #57534e; color: #f5f5f4; font-size: 0.85rem;" />
            </div>
            <div style="display: flex; gap: 6px;" id="hero-picker-quality-tabs">
              <button type="button" class="action-btn hero-q-tab active" data-q="ALL" style="padding: 6px 12px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; background: #f59e0b; color: #000;">全部</button>
              <button type="button" class="action-btn hero-q-tab" data-q="UR" style="padding: 6px 10px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; background: #292524; color: #ef4444;">UR</button>
              <button type="button" class="action-btn hero-q-tab" data-q="SSR" style="padding: 6px 10px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; background: #292524; color: #f59e0b;">SSR</button>
              <button type="button" class="action-btn hero-q-tab" data-q="SR" style="padding: 6px 10px; font-size: 0.8rem; font-weight: bold; border-radius: 4px; background: #292524; color: #a855f7;">SR</button>
            </div>
          </div>

          <div id="hero-picker-grid" style="flex: 1; overflow-y: auto; padding: 18px; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; background: #171513;">
          </div>

          <div id="hero-picker-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-top: 1px solid #44403c; background: #292524;">
            <div id="hero-picker-selected-summary" style="font-size: 0.85rem; color: #d6d3d1;">
              已選擇 <span id="hero-picker-count" style="color: #fbbf24; font-weight: bold;">0</span> 位英雄
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" id="hero-picker-clear-btn" class="action-btn" style="padding: 7px 14px; font-size: 0.85rem; background: #3c3836; color: #d6d3d1; border-radius: 6px; cursor: pointer;">清除全部</button>
              <button type="button" id="hero-picker-confirm-btn" class="action-btn story-success" style="padding: 7px 18px; font-size: 0.85rem; font-weight: bold; background: #16a34a; color: #fff; border-radius: 6px; cursor: pointer;">✅ 確認選擇</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(el);
      this.bindEvents(el);
    }
    this.modalEl = el;
  }

  private bindEvents(modal: HTMLElement): void {
    const closeBtn = modal.querySelector('#hero-picker-close') as HTMLElement;
    if (closeBtn) closeBtn.onclick = () => this.close();

    const searchInput = modal.querySelector('#hero-picker-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.oninput = () => {
        this.searchQuery = searchInput.value.trim().toLowerCase();
        this.renderGrid();
      };
    }

    const qTabs = modal.querySelectorAll('.hero-q-tab');
    qTabs.forEach(tab => {
      (tab as HTMLElement).onclick = () => {
        const q = (tab as HTMLElement).dataset.q || 'ALL';
        this.qualityFilter = q;
        qTabs.forEach(t => {
          (t as HTMLElement).style.background = t === tab ? '#f59e0b' : '#292524';
          (t as HTMLElement).style.color = t === tab ? '#000' : '#d6d3d1';
        });
        this.renderGrid();
      };
    });

    const confirmBtn = modal.querySelector('#hero-picker-confirm-btn') as HTMLElement;
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        if (this.onConfirmCallback) {
          this.onConfirmCallback(Array.from(this.selectedIds));
        }
        this.close();
      };
    }

    const clearBtn = modal.querySelector('#hero-picker-clear-btn') as HTMLElement;
    if (clearBtn) {
      clearBtn.onclick = () => {
        this.selectedIds.clear();
        this.updateSummary();
        this.renderGrid();
      };
    }
  }

  public open(options: HeroPickerOptions): void {
    this.ensureModalHtml();
    this.currentMode = options.mode;
    this.selectedIds = new Set(options.selectedHeroIds || []);
    this.onConfirmCallback = options.onConfirm;
    this.searchQuery = '';
    this.qualityFilter = 'ALL';

    const titleEl = document.getElementById('hero-picker-modal-title');
    if (titleEl) {
      titleEl.textContent = options.title || (this.currentMode === 'MULTI' ? '👥 挑選英雄單位 (可多選)' : '👑 挑選指定英雄 (單選)');
    }

    const searchInput = document.getElementById('hero-picker-search') as HTMLInputElement;
    if (searchInput) searchInput.value = '';

    const footer = document.getElementById('hero-picker-footer');
    if (footer) {
      footer.style.display = this.currentMode === 'MULTI' ? 'flex' : 'none';
    }

    this.updateSummary();
    this.renderGrid();

    if (this.modalEl) this.modalEl.style.display = 'flex';
  }

  public close(): void {
    if (this.modalEl) this.modalEl.style.display = 'none';
  }

  private updateSummary(): void {
    const countEl = document.getElementById('hero-picker-count');
    if (countEl) countEl.textContent = String(this.selectedIds.size);
  }

  private getJobLabel(jobKey: string): string {
    const map: Record<string, string> = {
      WARRIOR: '⚔️ 戰士',
      KNIGHT: '🛡️ 騎士',
      MAGE: '🔮 法師',
      ARCHER: '🏹 弓手',
      THIEF: '🗡️ 盜賊',
      PRAYER: '📖 祈禱者'
    };
    return map[jobKey] || jobKey;
  }

  private renderGrid(): void {
    const grid = document.getElementById('hero-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const allHeroes = getSelectableHeroes();
    const q = this.searchQuery;

    const filtered = allHeroes.filter(h => {
      if (this.qualityFilter !== 'ALL' && h.quality !== this.qualityFilter) return false;
      if (!q) return true;
      return h.name.toLowerCase().includes(q) ||
             h.title.toLowerCase().includes(q) ||
             h.id.toLowerCase().includes(q) ||
             h.jobKey.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #a8a29e; padding: 40px;">無符合條件的英雄單位</div>';
      return;
    }

    filtered.forEach(hero => {
      const isSelected = this.selectedIds.has(hero.id) || this.selectedIds.has(hero.name);
      const qColor = hero.quality === 'UR' ? '#ef4444' : hero.quality === 'SSR' ? '#f59e0b' : hero.quality === 'SR' ? '#a855f7' : '#3b82f6';
      const heroAvatar = hero.avatarIcon || (hero.id.includes('reyn') ? 'heroes:reyn' : (hero.id.includes('luna') ? 'heroes:luna' : 'heroes:reyn'));

      const card = document.createElement('div');
      card.style.cssText = `
        background: ${isSelected ? '#2d2417' : '#211e1b'};
        border: 2px solid ${isSelected ? '#f59e0b' : '#3c3836'};
        border-radius: 8px;
        padding: 12px;
        cursor: pointer;
        transition: all 0.15s ease-in-out;
        display: flex;
        align-items: center;
        gap: 12px;
        position: relative;
        box-shadow: ${isSelected ? '0 0 12px rgba(245, 158, 11, 0.3)' : 'none'};
      `;

      card.innerHTML = `
        <div style="width: 48px; height: 48px; border-radius: 6px; background: #141210; border: 1.5px solid ${qColor}; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
          ${renderUniversalIcon(heroAvatar, 40)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: bold; color: ${qColor}; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(hero.title)} ${escapeHtml(hero.name)}</span>
            <span style="background: ${qColor}22; color: ${qColor}; border: 1px solid ${qColor}; padding: 0 4px; border-radius: 3px; font-size: 0.65rem; font-weight: bold;">${hero.quality}</span>
          </div>
          <div style="font-size: 0.74rem; color: #a8a29e;">
            ${this.getJobLabel(hero.jobKey)} · Lv.${hero.level}
          </div>
          <div style="font-size: 0.68rem; color: #78716c; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(hero.biography || '傳奇英雄')}
          </div>
        </div>
        ${this.currentMode === 'MULTI' ? `
          <div style="width: 20px; height: 20px; border-radius: 4px; border: 1.5px solid ${isSelected ? '#f59e0b' : '#57534e'}; background: ${isSelected ? '#f59e0b' : 'transparent'}; display: flex; align-items: center; justify-content: center; color: #000; font-weight: bold; font-size: 0.75rem; flex-shrink: 0;">
            ${isSelected ? '✓' : ''}
          </div>
        ` : ''}
      `;

      card.onmouseenter = () => {
        if (!isSelected) card.style.borderColor = '#d97706';
      };
      card.onmouseleave = () => {
        if (!isSelected) card.style.borderColor = '#3c3836';
      };

      card.onclick = () => {
        if (this.currentMode === 'SINGLE') {
          if (this.onConfirmCallback) {
            this.onConfirmCallback([hero.id]);
          }
          this.close();
        } else {
          if (this.selectedIds.has(hero.id)) {
            this.selectedIds.delete(hero.id);
          } else {
            this.selectedIds.add(hero.id);
          }
          this.updateSummary();
          this.renderGrid();
        }
      };

      grid.appendChild(card);
    });
  }
}
