import { VFXPreset } from '../../models/VFX';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { VFXStudioStore } from './VFXStudioStore';
import { SKILL_VFX_MAP, SKILLS } from '../../data/SkillData';

/**
 * 📚 VFXLibrary
 * 特效預設庫管理、發布與技能整合面板
 * 負責預設切換、CRUD、SSOT 原子發布、快照留存與普攻/技能獨立綁定
 */
export class VFXLibrary {
  private container: HTMLElement;
  private store: VFXStudioStore;
  private repo: VFXPresetRepository;

  constructor(container: HTMLElement) {
    this.container = container;
    this.store = VFXStudioStore.getInstance();
    this.repo = VFXPresetRepository.getInstance();
    this.repo.addChangeListener(() => {
      this.render();
    });
    this.render();
  }

  public render(): void {
    const presets = this.repo.getAllPresets();
    const current = this.store.getPreset();

    this.container.innerHTML = `
      <div class="vfx-library-panel" style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <label style="font-weight: bold; color: #38bdf8; font-size: 0.85rem;">📚 預設庫清單 (${presets.length})</label>
          <div style="display: flex; gap: 4px;">
            <button id="lib-btn-new" class="btn-tool" style="padding: 2px 6px; font-size: 0.72rem;">➕ 新增</button>
            <button id="lib-btn-clone" class="btn-tool" style="padding: 2px 6px; font-size: 0.72rem;">📋 複製</button>
          </div>
        </div>

        <select id="lib-preset-select" class="preset-select" style="width: 100%; background: #1f2937; border: 1px solid #374151; color: #e5e7eb; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem;">
          ${presets.map(p => `
            <option value="${p.id}" ${p.id === current.id ? 'selected' : ''}>
              ${p.name || p.id} [${p.category || 'SPECIAL'}]
            </option>
          `).join('')}
        </select>

        <!-- 🚀 發布至專案核心 SSOT -->
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <button id="lib-btn-publish" style="flex: 2; background: linear-gradient(135deg, #7c3aed, #9333ea); color: #fff; border: 1px solid #a855f7; border-radius: 4px; padding: 6px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
            🚀 發布至專案 SSOT
          </button>
          <button id="lib-btn-export" style="flex: 1; background: #374151; color: #cbd5e1; border: 1px solid #4b5563; border-radius: 4px; padding: 6px; font-size: 0.75rem; cursor: pointer;">
            💾 複製庫
          </button>
        </div>

        <!-- 🔗 技能與普攻整合獨立折疊區 (解耦創作面板) -->
        <details style="background: #111827; border: 1px solid #1f2937; border-radius: 4px; padding: 6px; margin-top: 6px;">
          <summary style="font-size: 0.75rem; color: #fbbf24; cursor: pointer; font-weight: bold;">
            ⚔️ 技能與普攻綁定管理
          </summary>
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px; font-size: 0.72rem;">
            <label style="color: #9ca3af;">綁定當前特效至武器普攻：</label>
            <select id="lib-attack-target-select" style="background: #1f2937; border: 1px solid #374151; color: #e5e7eb; padding: 3px 6px; border-radius: 4px; font-size: 0.72rem;">
              <option value="GREATSWORD">⚔️ 巨劍 (GREATSWORD / 戰士)</option>
              <option value="BOW">🏹 戰弓 (BOW / 弓箭手)</option>
              <option value="STAFF">🔮 法杖 (STAFF / 法師)</option>
              <option value="DAGGERS">🗡️ 雙匕首 (DAGGERS / 盜賊)</option>
              <option value="SWORD_AND_SHIELD">🛡️ 劍盾 (SWORD_AND_SHIELD / 騎士)</option>
              <option value="HOLY_BOOK">📖 聖典 (HOLY_BOOK / 祈禱者)</option>
            </select>
            <div style="display: flex; gap: 4px;">
              <button id="lib-btn-bind-attack" style="flex: 1; background: #0284c7; color: #fff; border: 1px solid #38bdf8; border-radius: 3px; padding: 3px; cursor: pointer;">
                🔗 綁定當前特效
              </button>
              <button id="lib-btn-reset-attack" style="flex: 1; background: #374151; color: #9ca3af; border: 1px solid #4b5563; border-radius: 3px; padding: 3px; cursor: pointer;">
                🔄 還原預設
              </button>
            </div>
            <div id="lib-attack-bind-msg" style="color: #38bdf8; display: none;"></div>
          </div>
        </details>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // 1. 預設選單切換
    const select = this.container.querySelector('#lib-preset-select') as HTMLSelectElement;
    if (select) {
      select.addEventListener('change', (e) => {
        const id = (e.target as HTMLSelectElement).value;
        const p = this.repo.getPreset(id);
        if (p) {
          this.store.setPreset(p, false);
          this.store.setDirty(false);
        }
      });
    }

    // 2. 新增預設
    this.container.querySelector('#lib-btn-new')?.addEventListener('click', () => {
      const name = prompt('請輸入新特效名稱：', '新自訂特效');
      if (!name) return;
      const id = 'VFX_CUSTOM_' + Date.now();
      const current = this.store.getPreset();
      const newP: VFXPreset = {
        ...current,
        id,
        name,
        category: 'SPECIAL',
        description: '使用者自訂特效'
      };
      const res = this.repo.saveCustomPreset(newP);
      if (res.success) {
        this.store.setPreset(newP, false);
        this.render();
      }
    });

    // 3. 複製預設
    this.container.querySelector('#lib-btn-clone')?.addEventListener('click', () => {
      const current = this.store.getPreset();
      const name = prompt('請輸入複製之新特效名稱：', (current.name || current.id) + ' (副本)');
      if (!name) return;
      const id = 'VFX_CLONE_' + Date.now();
      const cloneP: VFXPreset = {
        ...current,
        id,
        name,
        description: `複製自 ${current.name || current.id}`
      };
      const res = this.repo.saveCustomPreset(cloneP);
      if (res.success) {
        this.store.setPreset(cloneP, false);
        this.render();
      }
    });

    // 4. 發布至專案 SSOT
    this.container.querySelector('#lib-btn-publish')?.addEventListener('click', async () => {
      const all = this.repo.getAllPresets();
      const btn = this.container.querySelector('#lib-btn-publish') as HTMLButtonElement;
      if (btn) btn.textContent = '⏳ 發布中...';
      try {
        const resp = await fetch('/__vfx_api/save_ssot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presets: all })
        });
        const data = await resp.json();
        if (data.success) {
          alert(`✅ 已成功發布 ${data.count} 款特效至專案 SSOT (src/data/vfx_presets.json)！\n歷史快照：${data.snapshot}`);
          if (btn) btn.textContent = '✅ 已發布！';
          this.store.setDirty(false);
        } else {
          throw new Error(data.error || '伺服器錯誤');
        }
      } catch (err: any) {
        navigator.clipboard.writeText(JSON.stringify(all, null, 2));
        alert(`⚠️ 發布失敗 (${err.message})，已將 JSON 複製至剪貼簿！`);
        if (btn) btn.textContent = '📋 已複製 JSON';
      }
      setTimeout(() => { if (btn) btn.textContent = '🚀 發布至專案 SSOT'; }, 3000);
    });

    // 5. 導出庫
    this.container.querySelector('#lib-btn-export')?.addEventListener('click', () => {
      const all = this.repo.getAllPresets();
      navigator.clipboard.writeText(JSON.stringify(all, null, 2));
      const btn = this.container.querySelector('#lib-btn-export') as HTMLButtonElement;
      if (btn) btn.textContent = '✅ 已複製！';
      setTimeout(() => { if (btn) btn.textContent = '💾 複製庫'; }, 2000);
    });

    // 6. 普攻綁定
    this.container.querySelector('#lib-btn-bind-attack')?.addEventListener('click', () => {
      const weapon = (this.container.querySelector('#lib-attack-target-select') as HTMLSelectElement).value;
      const current = this.store.getPreset();
      const storageKey = 'MEDIEVAL_BASIC_ATTACK_VFX_BINDINGS';
      const bindings = JSON.parse(localStorage.getItem(storageKey) || '{}');
      bindings[weapon] = current.id;
      localStorage.setItem(storageKey, JSON.stringify(bindings));
      const msg = this.container.querySelector('#lib-attack-bind-msg') as HTMLElement;
      if (msg) {
        msg.style.display = 'block';
        msg.textContent = `✅ 已將【${weapon}】普攻綁定為【${current.name || current.id}】！`;
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
      }
    });

    // 7. 還原普攻
    this.container.querySelector('#lib-btn-reset-attack')?.addEventListener('click', () => {
      const weapon = (this.container.querySelector('#lib-attack-target-select') as HTMLSelectElement).value;
      const storageKey = 'MEDIEVAL_BASIC_ATTACK_VFX_BINDINGS';
      const bindings = JSON.parse(localStorage.getItem(storageKey) || '{}');
      delete bindings[weapon];
      localStorage.setItem(storageKey, JSON.stringify(bindings));
      const msg = this.container.querySelector('#lib-attack-bind-msg') as HTMLElement;
      if (msg) {
        msg.style.display = 'block';
        msg.textContent = `🔄 已還原【${weapon}】普攻為出廠預設！`;
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
      }
    });
  }
}
