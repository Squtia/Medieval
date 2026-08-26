import { DataStore } from '../../systems/DataStore';
import { SubjugationTemplate } from '../../models/Narrative';
import { escapeHtml } from './StoryStudioTypes';
import { renderUniversalIcon } from '../../ui/IconSpriteHelper';

export class StoryStudioSubjugationPicker {
  private static instance: StoryStudioSubjugationPicker;
  private modalEl: HTMLElement | null = null;
  private onSelectCallback: ((tpl: SubjugationTemplate) => void) | null = null;
  private searchQuery: string = '';
  private terrainFilter: string = 'ALL';
  private difficultyFilter: string = 'ALL';

  public static getInstance(): StoryStudioSubjugationPicker {
    if (!this.instance) {
      this.instance = new StoryStudioSubjugationPicker();
    }
    return this.instance;
  }

  constructor() {
    this.ensureModalHtml();
  }

  private ensureModalHtml(): void {
    let el = document.getElementById('story-studio-subjugation-picker-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story-studio-subjugation-picker-modal';
      el.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); z-index: 999999; display: none; align-items: center; justify-content: center; box-sizing: border-box;';
      el.innerHTML = `
        <div class="story-studio-modal-content" style="max-width: 880px; width: 94%; max-height: 88vh; display: flex; flex-direction: column; background: #18181b; border: 2px solid #a855f7; border-radius: 10px; color: #f4f4f5; box-shadow: 0 20px 50px rgba(0,0,0,0.9); overflow: hidden; z-index: 1000000;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #3f3f46; background: #27272a;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem; font-weight: bold; color: #c084fc;">🏰 挑選進攻敵軍據點／魔物巢穴模板</span>
            </div>
            <button type="button" id="subjugation-picker-close" class="action-btn story-danger" style="padding: 5px 12px; font-size: 0.85rem; cursor: pointer; background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #fca5a5; border-radius: 4px;">✕ 關閉</button>
          </div>

          <div style="padding: 10px 18px; display: flex; gap: 10px; align-items: center; background: #18181b; border-bottom: 1px solid #27272a; flex-wrap: wrap;">
            <input type="text" id="subjugation-picker-search" placeholder="🔍 搜尋據點名稱、ID或描述..." style="flex: 1; min-width: 240px; padding: 8px 12px; background: #09090b; border: 1px solid #52525b; border-radius: 6px; color: #f4f4f5; font-size: 0.88rem;">
            <select id="subjugation-picker-terrain-filter" style="padding: 7px 10px; background: #09090b; border: 1px solid #52525b; border-radius: 6px; color: #f4f4f5; font-size: 0.82rem;">
              <option value="ALL">全部地形</option>
              <option value="RUINS">遺跡 (RUINS)</option>
              <option value="CAVE">洞窟 (CAVE)</option>
              <option value="FOREST">森林 (FOREST)</option>
              <option value="SNOW_MOUNTAIN">雪山 (SNOW)</option>
              <option value="VOLCANO">火山 (VOLCANO)</option>
              <option value="DESERT">沙漠 (DESERT)</option>
            </select>
            <select id="subjugation-picker-difficulty-filter" style="padding: 7px 10px; background: #09090b; border: 1px solid #52525b; border-radius: 6px; color: #f4f4f5; font-size: 0.82rem;">
              <option value="ALL">全部難度</option>
              <option value="1">★☆☆☆☆ (初級)</option>
              <option value="2">★★☆☆☆ (中級)</option>
              <option value="3">★★★☆☆ (危險)</option>
              <option value="4">★★★★☆ (史詩)</option>
              <option value="5">★★★★★ (滅絕)</option>
            </select>
          </div>

          <div id="subjugation-picker-list" style="flex: 1; overflow-y: auto; padding: 16px 18px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; align-content: flex-start;">
            <!-- 據點卡片動態渲染 -->
          </div>

          <div style="padding: 10px 18px; border-top: 1px solid #27272a; background: #141417; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; color: #a1a1aa;">
            <span id="subjugation-picker-count">載入中...</span>
            <span style="color: #c084fc;">💡 點擊卡片即可將該據點的敵軍陣容套用至選定梯隊</span>
          </div>
        </div>
      `;
      document.body.appendChild(el);
      this.modalEl = el;
      this.bindEvents();
    } else {
      this.modalEl = el;
    }
  }

  private bindEvents(): void {
    if (!this.modalEl) return;

    this.modalEl.querySelector('#subjugation-picker-close')?.addEventListener('click', () => {
      this.close();
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const searchInput = this.modalEl.querySelector('#subjugation-picker-search') as HTMLInputElement | null;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
      this.renderList();
    });

    const terrainSelect = this.modalEl.querySelector('#subjugation-picker-terrain-filter') as HTMLSelectElement | null;
    terrainSelect?.addEventListener('change', (e) => {
      this.terrainFilter = (e.target as HTMLSelectElement).value;
      this.renderList();
    });

    const diffSelect = this.modalEl.querySelector('#subjugation-picker-difficulty-filter') as HTMLSelectElement | null;
    diffSelect?.addEventListener('change', (e) => {
      this.difficultyFilter = (e.target as HTMLSelectElement).value;
      this.renderList();
    });
  }

  public open(onSelect: (tpl: SubjugationTemplate) => void): void {
    this.ensureModalHtml();
    this.onSelectCallback = onSelect;
    this.searchQuery = '';
    this.terrainFilter = 'ALL';
    this.difficultyFilter = 'ALL';

    const searchInput = this.modalEl?.querySelector('#subjugation-picker-search') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    const terrainSelect = this.modalEl?.querySelector('#subjugation-picker-terrain-filter') as HTMLSelectElement | null;
    if (terrainSelect) terrainSelect.value = 'ALL';
    const diffSelect = this.modalEl?.querySelector('#subjugation-picker-difficulty-filter') as HTMLSelectElement | null;
    if (diffSelect) diffSelect.value = 'ALL';

    if (this.modalEl) this.modalEl.style.display = 'flex';
    this.renderList();
  }

  public close(): void {
    if (this.modalEl) this.modalEl.style.display = 'none';
    this.onSelectCallback = null;
  }

  private renderList(): void {
    if (!this.modalEl) return;
    const container = this.modalEl.querySelector('#subjugation-picker-list');
    const countEl = this.modalEl.querySelector('#subjugation-picker-count');
    if (!container) return;

    const templates = DataStore.getSubjugationTemplates();

    const filtered = templates.filter(t => {
      if (this.searchQuery) {
        const q = this.searchQuery;
        const matchName = t.name.toLowerCase().includes(q);
        const matchId = t.id.toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDesc) return false;
      }
      if (this.terrainFilter !== 'ALL' && t.terrain !== this.terrainFilter) {
        return false;
      }
      if (this.difficultyFilter !== 'ALL' && String(t.difficulty) !== this.difficultyFilter) {
        return false;
      }
      return true;
    });

    if (countEl) {
      countEl.textContent = `共 ${filtered.length} 個據點模板`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #71717a; font-size: 0.9rem;">
          🔍 查無符合條件的據點模板
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(t => {
      const icon = t.icon || 'icons_buildings:icons_buildings_3';
      const iconHtml = renderUniversalIcon(icon, 38);
      const diffStars = '⭐'.repeat(Math.min(5, Math.max(1, t.difficulty || 1)));
      const monsterCount = t.waves?.reduce((acc, w) => acc + (w.monsters?.length || 0), 0) || 0;
      const firstWaveMonsters = (t.waves?.[0]?.monsters || []).map(m => m.monsterId).slice(0, 3).join(', ');

      return `
        <div class="subjugation-picker-card" data-tid="${escapeHtml(t.id)}" style="
          background: #27272a;
          border: 1px solid #3f3f46;
          border-radius: 8px;
          padding: 10px 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all 0.2s ease;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="flex-shrink: 0; border-radius: 6px; background: rgba(0,0,0,0.3); padding: 2px;">
              ${iconHtml}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: bold; color: #fde047; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(t.name)}
              </div>
              <div style="font-size: 0.72rem; color: #a1a1aa; font-family: monospace;">
                ${escapeHtml(t.id)}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; border-top: 1px dashed #3f3f46; padding-top: 4px; margin-top: 2px;">
            <span style="color: #fb923c;">難度: ${diffStars}</span>
            <span style="background: rgba(168,85,247,0.18); color: #d8b4fe; padding: 1px 5px; border-radius: 3px; font-size: 0.7rem; border: 1px solid rgba(168,85,247,0.4);">
              ${escapeHtml(t.terrain)}
            </span>
          </div>

          <div style="font-size: 0.74rem; color: #cbd5e1; line-height: 1.3; max-height: 34px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${escapeHtml(t.description || '無描述')}
          </div>

          <div style="font-size: 0.7rem; color: #93c5fd; background: rgba(0,0,0,0.35); padding: 3px 6px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            👾 敵軍(${monsterCount}體): ${escapeHtml(firstWaveMonsters || '預設怪物組')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.subjugation-picker-card').forEach(card => {
      const el = card as HTMLElement;
      el.addEventListener('mouseenter', () => {
        el.style.borderColor = '#c084fc';
        el.style.background = '#3f3f46';
        el.style.transform = 'translateY(-2px)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.borderColor = '#3f3f46';
        el.style.background = '#27272a';
        el.style.transform = 'none';
      });
      el.addEventListener('click', () => {
        const tid = el.dataset.tid;
        if (tid) {
          const tpl = templates.find(t => t.id === tid);
          if (tpl && this.onSelectCallback) {
            this.onSelectCallback(tpl);
            this.close();
          }
        }
      });
    });
  }
}
