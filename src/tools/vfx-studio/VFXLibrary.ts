import { VFXPreset, getTrajectorySpatialAnchor } from '../../models/VFX';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { VFXStudioStore } from './VFXStudioStore';
import { SKILL_VFX_MAP, SKILLS } from '../../data/SkillData';
import { SkillVfxBindingRegistry } from '../../systems/combat/SkillVfxBindingRegistry';
import { BasicAttackVfxRepository } from '../../systems/combat/BasicAttackVfxRepository';

export type VFXLibraryTab = 'ALL' | 'CASTER' | 'TRAJECTORY' | 'TARGET' | 'COMPOSITE';

/**
 * 📚 VFXLibrary
 * 特效預設庫管理、發布與技能整合面板
 * 負責預設切換、CRUD、三大分類篩選 (A自身 / ATOB位移 / B爆發 / 複合技能)、SSOT 原子發布與快照
 */
export class VFXLibrary {
  private container: HTMLElement;
  private store: VFXStudioStore;
  private repo: VFXPresetRepository;
  private currentTab: VFXLibraryTab = 'ALL';

  constructor(container: HTMLElement) {
    this.container = container;
    this.store = VFXStudioStore.getInstance();
    this.repo = VFXPresetRepository.getInstance();
    this.repo.addChangeListener(() => {
      this.render();
    });
    this.render();
  }

  public setTab(tab: VFXLibraryTab): void {
    this.currentTab = tab;
    this.render();
  }

  public render(): void {
    const allPresets = this.repo.getAllPresets();
    const current = this.store.getPreset();
    const boundSkills = SkillVfxBindingRegistry.getInstance().getSkillsForVfx(current.id);

    // 依據四大分類進行動態歸類
    const filteredPresets = allPresets.filter(p => {
      if (this.currentTab === 'ALL') return true;
      const isComposite = (p.layers && p.layers.length > 0);
      if (this.currentTab === 'COMPOSITE') return isComposite;
      const anchor = getTrajectorySpatialAnchor(p.spatialMode || p.trajectoryPath || p.trajectory);
      if (this.currentTab === 'CASTER') return anchor === 'AT_CASTER';
      if (this.currentTab === 'TRAJECTORY') return anchor === 'TRAJECTORY';
      if (this.currentTab === 'TARGET') return anchor === 'AT_TARGET';
      return true;
    });

    this.container.innerHTML = `
      <div class="vfx-library-panel" style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <label style="font-weight: bold; color: #38bdf8; font-size: 0.85rem;">📚 素材庫與預設 (${filteredPresets.length}/${allPresets.length})</label>
          <div style="display: flex; gap: 4px;">
            <button id="lib-btn-new" class="btn-tool" style="padding: 2px 6px; font-size: 0.72rem;">➕ 新增</button>
            <button id="lib-btn-clone" class="btn-tool" style="padding: 2px 6px; font-size: 0.72rem;">📋 複製</button>
          </div>
        </div>

        <!-- 🏷️ 素材庫四大分類 Tabs -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; background: #0f172a; padding: 3px; border-radius: 4px; border: 1px solid #1e293b;">
          <button class="lib-tab-btn ${this.currentTab === 'CASTER' ? 'active' : ''}" data-tab="CASTER" style="background: ${this.currentTab === 'CASTER' ? '#0284c7' : '#1e293b'}; color: #fff; border: none; padding: 3px 2px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="A 點自身起手/揮刀/蓄力素材">🏠 自身</button>
          <button class="lib-tab-btn ${this.currentTab === 'TRAJECTORY' ? 'active' : ''}" data-tab="TRAJECTORY" style="background: ${this.currentTab === 'TRAJECTORY' ? '#7c3aed' : '#1e293b'}; color: #fff; border: none; padding: 3px 2px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="ATOB 位移/飛行/天降彈道素材">🚀 彈道</button>
          <button class="lib-tab-btn ${this.currentTab === 'TARGET' ? 'active' : ''}" data-tab="TARGET" style="background: ${this.currentTab === 'TARGET' ? '#be123c' : '#1e293b'}; color: #fff; border: none; padding: 3px 2px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="B 點目標受擊/斬裂/爆破素材">💥 目標</button>
          <button class="lib-tab-btn ${this.currentTab === 'ALL' ? 'active' : ''}" data-tab="ALL" style="background: ${this.currentTab === 'ALL' ? '#334155' : '#1e293b'}; color: #cbd5e1; border: none; padding: 3px 2px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="查看全部素材">🌐 全部</button>
        </div>

        <select id="lib-preset-select" class="preset-select" style="width: 100%; background: #1f2937; border: 1px solid #374151; color: #e5e7eb; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem;">
          ${filteredPresets.map(p => {
            const anchor = getTrajectorySpatialAnchor(p.spatialMode || p.trajectoryPath || p.trajectory);
            const tag = anchor === 'AT_CASTER' ? '[自身]' : anchor === 'TRAJECTORY' ? '[彈道]' : '[目標]';
            return `
              <option value="${p.id}" ${p.id === current.id ? 'selected' : ''}>
                ${tag} ${p.name || p.id}
              </option>
            `;
          }).join('')}
        </select>

        <!-- ➕ 將當前選中素材加入時間軸作為新圖層 -->
        <div style="display: flex; gap: 4px; margin-top: 4px;">
          <button id="lib-btn-add-to-timeline" style="flex: 1; background: #065f46; border: 1px solid #10b981; color: #6ee7b7; border-radius: 4px; padding: 4px 8px; font-size: 0.72rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;" title="將目前素材庫選中的預製件，作為新圖層追加到目前特效時間軸">
            ➕ 加入時間軸圖層
          </button>
        </div>

        <!-- 🔗 獨立技能綁定表關聯資訊 (SkillVfxBinding SSOT) -->
        <div class="lib-bound-skills-card" style="background: #1e293b; border: 1px solid #334155; border-radius: 4px; padding: 6px; font-size: 0.72rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #94a3b8; font-weight: bold;">🔗 綁定技能 (${boundSkills.length})</span>
            <span style="color: #38bdf8; font-size: 0.65rem;">模式: ${boundSkills[0]?.impactPresentationMode || 'EXACT_IMPACTS'}</span>
          </div>
          ${boundSkills.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${boundSkills.map(b => `
                <span class="lib-skill-badge" data-skill-id="${b.skillId}" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #0284c7; color: #38bdf8; padding: 1px 5px; border-radius: 3px; font-size: 0.66rem; user-select: none;" title="引用特效: ${b.vfxId}">
                  ${b.skillId}
                </span>
              `).join('')}
            </div>
          ` : '<span style="color: #64748b; font-size: 0.68rem;">(尚未被任何技能直接引用)</span>'}
        </div>

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

        <!-- 🕒 歷史快照管理與一鍵還原 (SSOT Snapshots) -->
        <details id="lib-snapshots-details" style="background: #111827; border: 1px solid #1f2937; border-radius: 4px; padding: 6px; margin-top: 6px;">
          <summary style="font-size: 0.75rem; color: #38bdf8; cursor: pointer; font-weight: bold;">
            🕒 歷史快照備份與還原
          </summary>
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px; font-size: 0.72rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="color: #9ca3af;">選擇歷史快照：</label>
              <button id="lib-btn-refresh-snapshots" style="background: transparent; color: #38bdf8; border: none; cursor: pointer; font-size: 0.72rem; padding: 0;">🔄 重新整理</button>
            </div>
            <select id="lib-snapshot-select" style="background: #1f2937; border: 1px solid #374151; color: #e5e7eb; padding: 3px 6px; border-radius: 4px; font-size: 0.72rem;">
              <option value="">載入中或無快照...</option>
            </select>
            <button id="lib-btn-restore-snapshot" style="background: #be185d; color: #fff; border: 1px solid #f43f5e; border-radius: 3px; padding: 5px; cursor: pointer; font-weight: bold;">
              ⚠️ 從此快照還原 SSOT
            </button>
            <div id="lib-snapshot-msg" style="color: #38bdf8; display: none;"></div>
          </div>
        </details>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // 0. 分類 Tabs 點擊切換
    this.container.querySelectorAll('.lib-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as VFXLibraryTab;
        if (tab) this.setTab(tab);
      });
    });

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

    // 1.2 ➕ 加入時間軸圖層按鈕
    this.container.querySelector('#lib-btn-add-to-timeline')?.addEventListener('click', () => {
      const targetId = select?.value;
      if (!targetId) return;
      const targetPreset = this.repo.getPreset(targetId);
      if (!targetPreset) return;

      const current = this.store.getPreset();
      const curLayers = current.layers || [];
      const newLayer = {
        id: `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        presetId: targetPreset.id,
        name: targetPreset.name || targetPreset.id,
        spatialMode: targetPreset.spatialMode || 'A_TO_B',
        reverse: targetPreset.reverse || false,
        shaderMode: targetPreset.shaderMode || 'ENERGY_BEAM',
        delay: Number(Math.min((current.duration || 1.2) * 0.8, (current.duration || 1.2) * 0.15 * curLayers.length).toFixed(2)),
        duration: Number(((current.duration || 1.2) * 0.4).toFixed(2)),
        fadeIn: 0.05,
        fadeOut: 0.08,
        scale: 1.0,
        enabled: true,
        generatesHit: false
      };
      this.store.updateConfig({ layers: [...curLayers, newLayer] }, true);
    });

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
      BasicAttackVfxRepository.getInstance().setBinding(weapon, current.id);
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
      BasicAttackVfxRepository.getInstance().removeBinding(weapon);
      const msg = this.container.querySelector('#lib-attack-bind-msg') as HTMLElement;
      if (msg) {
        msg.style.display = 'block';
        msg.textContent = `🔄 已還原【${weapon}】普攻為出廠預設！`;
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
      }
    });

    // 8. 歷史快照清單載入與一鍵還原
    const snapshotSelect = this.container.querySelector('#lib-snapshot-select') as HTMLSelectElement;
    const loadSnapshots = async () => {
      if (!snapshotSelect) return;
      try {
        const resp = await fetch('/__vfx_api/list_snapshots');
        const data = await resp.json();
        if (data.success && Array.isArray(data.snapshots)) {
          if (data.snapshots.length === 0) {
            snapshotSelect.innerHTML = '<option value="">(目前無歷史快照)</option>';
          } else {
            snapshotSelect.innerHTML = data.snapshots.map((s: string) => `
              <option value="${s}">${s}</option>
            `).join('');
          }
        }
      } catch (err) {
        snapshotSelect.innerHTML = '<option value="">(無法連線至快照伺服器)</option>';
      }
    };

    const snapshotsDetails = this.container.querySelector('#lib-snapshots-details');
    snapshotsDetails?.addEventListener('toggle', () => {
      if ((snapshotsDetails as HTMLDetailsElement).open) {
        loadSnapshots();
      }
    });

    this.container.querySelector('#lib-btn-refresh-snapshots')?.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSnapshots();
    });

    this.container.querySelector('#lib-btn-restore-snapshot')?.addEventListener('click', async () => {
      const filename = snapshotSelect?.value;
      if (!filename) {
        alert('請先選擇欲還原的歷史快照！');
        return;
      }
      if (!confirm(`⚠️ 確定要將專案 SSOT 還原為歷史快照：\n${filename} 嗎？\n（系統將自動建立目前狀態之備份快照）`)) {
        return;
      }

      const btn = this.container.querySelector('#lib-btn-restore-snapshot') as HTMLButtonElement;
      if (btn) btn.textContent = '⏳ 還原中...';
      const msg = this.container.querySelector('#lib-snapshot-msg') as HTMLElement;

      try {
        const resp = await fetch('/__vfx_api/restore_snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const data = await resp.json();
        if (data.success) {
          if (msg) {
            msg.style.display = 'block';
            msg.textContent = `✅ 成功還原 ${data.count} 款預設！`;
            setTimeout(() => { msg.style.display = 'none'; }, 4000);
          }
          alert(`✅ 成功還原快照！\n還原前備份：${data.preRestoreBackup}`);
          this.store.setDirty(false);
          // 重新載入並渲染
          this.repo.reloadPresets();
          this.render();
        } else {
          throw new Error(data.error || '還原失敗');
        }
      } catch (err: any) {
        alert(`❌ 快照還原失敗：${err.message}`);
      } finally {
        if (btn) btn.textContent = '⚠️ 從此快照還原 SSOT';
      }
    });
  }
}
