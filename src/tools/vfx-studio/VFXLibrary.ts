import { VFXSequence, getTrajectorySpatialAnchor, getSequenceMainClip } from '../../models/VFX';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { VFXPresetValidator } from '../../ui/fx/VFXPresetValidator';
import { VFXStudioStore } from './VFXStudioStore';
import { SKILL_VFX_MAP, SKILLS } from '../../data/SkillData';
import { SkillVfxBindingRegistry } from '../../systems/combat/SkillVfxBindingRegistry';
import { BasicAttackVfxRepository } from '../../systems/combat/BasicAttackVfxRepository';
import { SkillVfxPickerModal } from './SkillVfxPickerModal';

/**
 * 🛡️ 規範 §9.2、§9.3、§10 與 §11 強制：純淨強型別 VFXSequence 規格比對器
 * 0 any、0 as any，嚴格比對 Canonical Sequence 核心屬性、軌道、片段、Cues
 */
export type SequenceDiffResult = {
  isMatch: boolean;
  reason?: string;
};

export function checkSequenceDeepEqual(a: VFXSequence, b: VFXSequence): SequenceDiffResult {
  if (!a || !b) return { isMatch: false, reason: 'Sequence 物件為空 (Null/Undefined)' };
  if (a.id !== b.id) return { isMatch: false, reason: `ID 不一致 (草稿: ${a.id}, 回讀: ${b.id})` };
  if (a.schemaVersion !== b.schemaVersion) return { isMatch: false, reason: `schemaVersion 不一致` };
  if (a.name !== b.name) return { isMatch: false, reason: `名稱不一致 (草稿: ${a.name}, 回讀: ${b.name})` };
  if (a.category !== b.category) return { isMatch: false, reason: `分類不一致` };
  if (Math.abs(a.duration - b.duration) > 0.001) return { isMatch: false, reason: `時長 duration 不一致 (草稿: ${a.duration}, 回讀: ${b.duration})` };
  if ((a.spatialMode || 'TRAJECTORY') !== (b.spatialMode || 'TRAJECTORY')) {
    return { isMatch: false, reason: `時空模式 spatialMode 不一致 (草稿: ${a.spatialMode}, 回讀: ${b.spatialMode})` };
  }
  if ((a.impactPresentationMode || 'EXACT_IMPACTS') !== (b.impactPresentationMode || 'EXACT_IMPACTS')) {
    return { isMatch: false, reason: `打擊演出模式 impactPresentationMode 不一致` };
  }

  // 比對 impactCues
  const cuesA = a.impactCues || [];
  const cuesB = b.impactCues || [];
  if (cuesA.length !== cuesB.length) {
    return { isMatch: false, reason: `打擊 Cue 數量不一致 (草稿: ${cuesA.length}, 回讀: ${cuesB.length})` };
  }
  for (let i = 0; i < cuesA.length; i++) {
    const ca = cuesA[i];
    const cb = cuesB[i];
    if (ca.cueId !== cb.cueId) return { isMatch: false, reason: `Cue[${i}] ID 不一致 (${ca.cueId} vs ${cb.cueId})` };
    if (Math.abs(ca.time - cb.time) > 0.001) return { isMatch: false, reason: `Cue[${i}] 時間不一致 (${ca.time} vs ${cb.time})` };
    if ((ca.kind || 'IMPACT') !== (cb.kind || 'IMPACT')) return { isMatch: false, reason: `Cue[${i}] 類型不一致` };
    if (Boolean(ca.isPrimary) !== Boolean(cb.isPrimary)) return { isMatch: false, reason: `Cue[${i}] 主打擊點標記不一致` };
  }

  // 比對 tracks
  const tracksA = a.tracks || [];
  const tracksB = b.tracks || [];
  if (tracksA.length !== tracksB.length) {
    return { isMatch: false, reason: `軌道數量不一致 (草稿: ${tracksA.length}, 回讀: ${tracksB.length})` };
  }
  for (let t = 0; t < tracksA.length; t++) {
    const ta = tracksA[t];
    const tb = tracksB[t];
    if (ta.id !== tb.id) return { isMatch: false, reason: `軌道[${t}] ID 不一致 (${ta.id} vs ${tb.id})` };
    if (ta.type !== tb.type) return { isMatch: false, reason: `軌道[${t}] 類型不一致 (${ta.type} vs ${tb.type})` };
    if (Boolean(ta.enabled) !== Boolean(tb.enabled)) return { isMatch: false, reason: `軌道[${t}] 啟用狀態不一致` };

    // 比對 clips
    const clipsA = ta.clips || [];
    const clipsB = tb.clips || [];
    if (clipsA.length !== clipsB.length) {
      return { isMatch: false, reason: `軌道[${ta.id}] 片段數量不一致 (草稿: ${clipsA.length}, 回讀: ${clipsB.length})` };
    }
    for (let c = 0; c < clipsA.length; c++) {
      const cla = clipsA[c];
      const clb = clipsB[c];
      if (cla.id !== clb.id) return { isMatch: false, reason: `片段[${c}] ID 不一致` };
      if (Math.abs(cla.startTime - clb.startTime) > 0.001) return { isMatch: false, reason: `片段[${c}] 起始時間不一致` };
      if (Math.abs(cla.duration - clb.duration) > 0.001) return { isMatch: false, reason: `片段[${c}] 持續時間不一致` };
      if (cla.payload.type !== clb.payload.type) return { isMatch: false, reason: `片段[${c}] Payload 類型不一致` };

      // 比對 payload.data
      const dataA = cla.payload.data as Record<string, unknown> | undefined;
      const dataB = clb.payload.data as Record<string, unknown> | undefined;
      if (!dataA && !dataB) continue;
      if (!dataA || !dataB) return { isMatch: false, reason: `片段[${c}] 缺少 payload.data` };

      const keysA = Object.keys(dataA).filter(k => dataA[k] !== undefined);
      const keysB = Object.keys(dataB).filter(k => dataB[k] !== undefined);
      const diffA = keysA.filter(k => !keysB.includes(k));
      const diffB = keysB.filter(k => !keysA.includes(k));
      if (diffA.length > 0 || diffB.length > 0) {
        return { isMatch: false, reason: `片段[${c}] 屬性鍵差異: 草稿多出[${diffA.join(',')}], 回讀多出[${diffB.join(',')}]` };
      }
      for (const k of keysA) {
        const valA = dataA[k];
        const valB = dataB[k];
        if (typeof valA === 'number' && typeof valB === 'number') {
          if (Math.abs(valA - valB) > 0.001) {
            return { isMatch: false, reason: `片段[${c}].${k} 數值不一致 (${valA} vs ${valB})` };
          }
        } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
          return { isMatch: false, reason: `片段[${c}].${k} 內容不一致 (${JSON.stringify(valA)} vs ${JSON.stringify(valB)})` };
        }
      }
    }
  }

  return { isMatch: true };
}

export function isSequenceDeepEqual(a: VFXSequence, b: VFXSequence): boolean {
  return checkSequenceDeepEqual(a, b).isMatch;
}

export type VFXLibraryTab = 'ALL' | 'CASTER' | 'TRAJECTORY' | 'TARGET' | 'COMPOSITE';
export type VFXScopeTab = 'ALL' | 'BUILTIN' | 'CUSTOM_SKILL' | 'MATERIAL';
export type VFXCategoryFilter = 'ALL' | 'PHYSICAL' | 'ELEMENTAL' | 'HOLY_DARK' | 'SPECIAL';

/**
 * 📚 VFXLibrary
 * 特效預設庫管理、發布與技能整合面板
 * 負責預設切換、CRUD、三大分欄篩選 (官方 30 款 / 技能專用 / 素材圖層)、卡片畫廊、SSOT 原子發布與快照
 */
export class VFXLibrary {
  private container: HTMLElement;
  private store: VFXStudioStore;
  private repo: VFXPresetRepository;
  private currentTab: VFXLibraryTab = 'ALL';
  private currentScope: VFXScopeTab = 'ALL';
  private currentCategory: VFXCategoryFilter = 'ALL';
  private searchQuery: string = '';

  constructor(container: HTMLElement) {
    this.container = container;
    this.store = VFXStudioStore.getInstance();
    this.repo = VFXPresetRepository.getInstance();
    this.repo.addChangeListener(() => {
      this.render();
    });
    this.store.subscribe((preset) => {
      this.updateMetaCard(preset);
    });
    this.render();
  }

  public updateMetaCard(preset: VFXSequence): void {
    const idLabel = this.container.querySelector('#lib-display-seq-id') as HTMLElement | null;
    const inputName = this.container.querySelector('#lib-input-seq-name') as HTMLInputElement | null;
    const inputDesc = this.container.querySelector('#lib-input-seq-desc') as HTMLInputElement | null;
    const select = this.container.querySelector('#lib-preset-select') as HTMLSelectElement | null;
    const selectCategory = this.container.querySelector('#lib-select-category') as HTMLSelectElement | null;
    const btnSkill = this.container.querySelector('#lib-btn-set-skill') as HTMLButtonElement | null;
    const btnMat = this.container.querySelector('#lib-btn-set-material') as HTMLButtonElement | null;

    const isInputActive = typeof document !== 'undefined' && inputName === document.activeElement;
    const isDescActive = typeof document !== 'undefined' && inputDesc === document.activeElement;

    const isBuiltin = Boolean(preset.isBuiltin);
    if (idLabel) {
      idLabel.textContent = preset.id;
      if (idLabel.style) {
        idLabel.style.color = isBuiltin ? '#fbbf24' : '#64748b';
      }
      idLabel.title = `系統唯一識別碼 (ID)${isBuiltin ? ' [🔒 官方唯讀基準]' : ''}`;
    }
    if (inputName && !isInputActive) {
      inputName.value = preset.name || '';
      inputName.disabled = isBuiltin;
    }
    if (inputDesc && !isDescActive) {
      inputDesc.value = preset.description || '';
      inputDesc.disabled = isBuiltin;
    }
    if (select && select.value !== preset.id) {
      select.value = preset.id;
    }
    if (selectCategory && selectCategory.value !== preset.category) {
      selectCategory.value = preset.category || 'SPECIAL';
      selectCategory.disabled = isBuiltin;
    }

    // 狀態切換更新
    const isMat = preset.usageType === 'MATERIAL';
    if (btnSkill) {
      btnSkill.style.background = !isMat ? '#0284c7' : '#1e293b';
      btnSkill.style.color = !isMat ? '#fff' : '#94a3b8';
      btnSkill.disabled = isBuiltin;
    }
    if (btnMat) {
      btnMat.style.background = isMat ? '#d97706' : '#1e293b';
      btnMat.style.color = isMat ? '#fff' : '#94a3b8';
      btnMat.disabled = isBuiltin;
    }

    // 高亮卡片網格
    this.container.querySelectorAll('.vfx-card').forEach(card => {
      if ((card as HTMLElement).dataset.id === preset.id) {
        card.classList.add('active');
        (card as HTMLElement).style.borderColor = '#38bdf8';
        (card as HTMLElement).style.boxShadow = '0 0 8px rgba(56, 189, 248, 0.4)';
      } else {
        card.classList.remove('active');
        (card as HTMLElement).style.borderColor = '#334155';
        (card as HTMLElement).style.boxShadow = 'none';
      }
    });
  }

  public setScope(scope: VFXScopeTab): void {
    this.currentScope = scope;
    this.render();
  }

  public setCategoryFilter(cat: VFXCategoryFilter): void {
    this.currentCategory = cat;
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

    // 統計各欄位數量
    const builtinCount = allPresets.filter(p => p.isBuiltin).length;
    const skillCount = allPresets.filter(p => !p.isBuiltin && p.usageType !== 'MATERIAL').length;
    const materialCount = allPresets.filter(p => p.usageType === 'MATERIAL').length;

    // 依據三大分欄 (Scope)、屬性過濾與關鍵字搜尋動態篩選
    const filteredPresets = allPresets.filter(p => {
      const isBuiltin = Boolean(p.isBuiltin);
      const isMaterial = p.usageType === 'MATERIAL';

      // 1. 範疇分欄篩選
      if (this.currentScope === 'BUILTIN' && !isBuiltin) return false;
      if (this.currentScope === 'CUSTOM_SKILL' && (isBuiltin || isMaterial)) return false;
      if (this.currentScope === 'MATERIAL' && !isMaterial) return false;

      // 2. 屬性篩選
      if (this.currentCategory !== 'ALL' && p.category !== this.currentCategory) return false;

      // 3. 關鍵字搜尋
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const idMatch = p.id.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch && !descMatch) return false;
      }

      return true;
    });

    const isCurrentMaterial = current.usageType === 'MATERIAL';
    const isCurrentBuiltin = Boolean(current.isBuiltin);

    this.container.innerHTML = `
      <div class="vfx-library-panel" style="display: flex; flex-direction: column; gap: 8px;">
        <!-- 頂部標題與操作按鈕 -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <label style="font-weight: bold; color: #38bdf8; font-size: 0.85rem;">📚 素材庫與預設 (${filteredPresets.length}/${allPresets.length})</label>
          <div style="display: flex; gap: 4px;">
            <button id="lib-btn-new" class="btn-tool" style="padding: 2px 6px; font-size: 0.72rem; background: #0284c7; color: #fff; border: 1px solid #38bdf8; border-radius: 3px; cursor: pointer;">➕ 新增</button>
            <button id="lib-btn-clone" class="btn-tool" style="padding: 2px 6px; font-size: 0.72rem; background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 3px; cursor: pointer;">📋 複製</button>
          </div>
        </div>

        <!-- 🏷️ 三大欄位切換 Tabs (分開欄位) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; background: #0f172a; padding: 3px; border-radius: 4px; border: 1px solid #1e293b;">
          <button class="lib-scope-btn ${this.currentScope === 'BUILTIN' ? 'active' : ''}" data-scope="BUILTIN" style="background: ${this.currentScope === 'BUILTIN' ? '#0369a1' : '#1e293b'}; color: #fff; border: none; padding: 4px 2px; border-radius: 3px; font-size: 0.65rem; cursor: pointer; font-weight: bold;" title="官方出廠 30 款基準招式 (唯讀保護)">👑 官方 (${builtinCount})</button>
          <button class="lib-scope-btn ${this.currentScope === 'CUSTOM_SKILL' ? 'active' : ''}" data-scope="CUSTOM_SKILL" style="background: ${this.currentScope === 'CUSTOM_SKILL' ? '#059669' : '#1e293b'}; color: #fff; border: none; padding: 4px 2px; border-radius: 3px; font-size: 0.65rem; cursor: pointer; font-weight: bold;" title="自訂創作技能特效 (可綁定技能)">⚔️ 技能 (${skillCount})</button>
          <button class="lib-scope-btn ${this.currentScope === 'MATERIAL' ? 'active' : ''}" data-scope="MATERIAL" style="background: ${this.currentScope === 'MATERIAL' ? '#d97706' : '#1e293b'}; color: #fff; border: none; padding: 4px 2px; border-radius: 3px; font-size: 0.65rem; cursor: pointer; font-weight: bold;" title="獨立素材/組件/圖層 (禁綁技能)">🧩 素材 (${materialCount})</button>
          <button class="lib-scope-btn ${this.currentScope === 'ALL' ? 'active' : ''}" data-scope="ALL" style="background: ${this.currentScope === 'ALL' ? '#334155' : '#1e293b'}; color: #cbd5e1; border: none; padding: 4px 2px; border-radius: 3px; font-size: 0.65rem; cursor: pointer;" title="查看全部特效">🌐 全部 (${allPresets.length})</button>
        </div>

        <!-- 🔍 關鍵字搜尋框與屬性快篩列 -->
        <div style="display: flex; gap: 4px; align-items: center;">
          <input id="lib-search-input" type="text" placeholder="🔍 搜尋名稱或 ID..." value="${this.searchQuery}" style="flex: 1; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 3px 6px; border-radius: 3px; font-size: 0.72rem;">
          <select id="lib-filter-category" style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 3px 4px; border-radius: 3px; font-size: 0.68rem; cursor: pointer;">
            <option value="ALL" ${this.currentCategory === 'ALL' ? 'selected' : ''}>全部屬性</option>
            <option value="PHYSICAL" ${this.currentCategory === 'PHYSICAL' ? 'selected' : ''}>🛡️ 物理</option>
            <option value="ELEMENTAL" ${this.currentCategory === 'ELEMENTAL' ? 'selected' : ''}>🔥 元素</option>
            <option value="HOLY_DARK" ${this.currentCategory === 'HOLY_DARK' ? 'selected' : ''}>✨ 神聖暗影</option>
            <option value="SPECIAL" ${this.currentCategory === 'SPECIAL' ? 'selected' : ''}>⚙️ 特殊</option>
          </select>
        </div>

        <!-- 🎴 卡片式畫廊列表 (取代死板下拉選單) -->
        <div id="lib-cards-grid" style="display: flex; flex-direction: column; gap: 4px; max-height: 230px; overflow-y: auto; padding: 2px; border: 1px solid #1e293b; border-radius: 4px; background: #0b0f19;">
          ${filteredPresets.length === 0 ? `
            <div style="text-align: center; color: #64748b; padding: 20px 0; font-size: 0.72rem;">無符合條件的特效或素材</div>
          ` : filteredPresets.map(p => {
            const isSelected = p.id === current.id;
            const isMat = p.usageType === 'MATERIAL';
            const isBuilt = Boolean(p.isBuiltin);
            const cueCount = p.impactCues?.length || 0;
            const categoryLabel = p.category === 'PHYSICAL' ? '🛡️物理' : p.category === 'ELEMENTAL' ? '🔥元素' : p.category === 'HOLY_DARK' ? '✨神聖暗影' : '⚙️特殊';
            return `
              <div class="vfx-card ${isSelected ? 'active' : ''}" data-id="${p.id}" style="display: flex; flex-direction: column; gap: 2px; padding: 5px 8px; border-radius: 4px; background: ${isSelected ? '#172554' : '#1e293b'}; border: 1px solid ${isSelected ? '#38bdf8' : '#334155'}; cursor: pointer; transition: all 0.15s ease; ${isSelected ? 'box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);' : ''}">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 0.62rem; padding: 1px 4px; border-radius: 2px; font-weight: bold; ${isBuilt ? 'background: #334155; color: #f8fafc;' : isMat ? 'background: #b45309; color: #fef3c7;' : 'background: #047857; color: #d1fae5;'}">
                      ${isBuilt ? '👑官方' : isMat ? '🧩素材' : '⚔️技能'}
                    </span>
                    <span style="font-size: 0.62rem; color: #94a3b8;">${categoryLabel}</span>
                  </div>
                  <span style="font-size: 0.62rem; color: #64748b; font-family: monospace;">⏱️ ${p.duration.toFixed(2)}s · 🎯 ${cueCount > 0 ? cueCount + '連擊' : '純視覺'}</span>
                </div>
                <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 1px;">
                  <span style="font-size: 0.78rem; font-weight: bold; color: ${isSelected ? '#38bdf8' : '#f1f5f9'};">${p.name || p.id}</span>
                  <span style="font-size: 0.64rem; color: #64748b; font-family: monospace;">${p.id}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- 🛡️ 底層同步維護的 select (保留供相容與測試，隱藏呈現) -->
        <select id="lib-preset-select" class="preset-select" style="display: none;">
          ${allPresets.map(p => `
            <option value="${p.id}" ${p.id === current.id ? 'selected' : ''}>
              ${p.name || p.id}
            </option>
          `).join('')}
        </select>

        <!-- 🏷️ 特效基本資訊編輯卡片 (用途切換、屬性切換、名稱與描述) -->
        <div class="lib-seq-meta-card" style="background: #1e293b; border: 1px solid #334155; border-radius: 4px; padding: 6px; display: flex; flex-direction: column; gap: 4px; font-size: 0.72rem;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="color: #94a3b8; font-weight: bold;">🏷️ 特效規格與屬性</span>
            <span id="lib-display-seq-id" style="font-family: monospace; color: ${isCurrentBuiltin ? '#fbbf24' : '#64748b'}; font-size: 0.65rem;" title="系統唯一識別碼 (ID)${isCurrentBuiltin ? ' [🔒 官方唯讀基準]' : ''}">${current.id}</span>
          </div>

          <!-- 用途標籤選擇 (技能專用 vs 素材圖層) -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: #94a3b8; width: 38px; flex-shrink: 0;">用途:</label>
            <div style="display: flex; gap: 4px; flex: 1;">
              <button id="lib-btn-set-skill" style="flex: 1; background: ${!isCurrentMaterial ? '#0284c7' : '#0f172a'}; color: ${!isCurrentMaterial ? '#fff' : '#94a3b8'}; border: 1px solid ${!isCurrentMaterial ? '#38bdf8' : '#334155'}; border-radius: 3px; padding: 2px 4px; font-size: 0.68rem; cursor: pointer; font-weight: bold;" ${isCurrentBuiltin ? 'disabled title="官方預設不可變更用途"' : ''}>
                ⚔️ 技能專用
              </button>
              <button id="lib-btn-set-material" style="flex: 1; background: ${isCurrentMaterial ? '#d97706' : '#0f172a'}; color: ${isCurrentMaterial ? '#fff' : '#94a3b8'}; border: 1px solid ${isCurrentMaterial ? '#fbbf24' : '#334155'}; border-radius: 3px; padding: 2px 4px; font-size: 0.68rem; cursor: pointer; font-weight: bold;" ${isCurrentBuiltin ? 'disabled title="官方預設不可變更用途"' : ''}>
                🧩 素材圖層 (禁綁技能)
              </button>
            </div>
          </div>

          <!-- 屬性類別選擇 -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: #94a3b8; width: 38px; flex-shrink: 0;">屬性:</label>
            <select id="lib-select-category" style="flex: 1; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 3px 6px; border-radius: 3px; font-size: 0.72rem; cursor: pointer;" ${isCurrentBuiltin ? 'disabled title="官方預設不可變更屬性"' : ''}>
              <option value="PHYSICAL" ${current.category === 'PHYSICAL' ? 'selected' : ''}>🛡️ 物理系 (PHYSICAL)</option>
              <option value="ELEMENTAL" ${current.category === 'ELEMENTAL' ? 'selected' : ''}>🔥 元素魔法 (ELEMENTAL)</option>
              <option value="HOLY_DARK" ${current.category === 'HOLY_DARK' ? 'selected' : ''}>✨ 神聖 / 暗影 (HOLY_DARK)</option>
              <option value="SPECIAL" ${current.category === 'SPECIAL' ? 'selected' : ''}>⚙️ 特殊 / 混合 (SPECIAL)</option>
            </select>
          </div>

          <!-- 名稱編輯 -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: #94a3b8; width: 38px; flex-shrink: 0;">名稱:</label>
            <input id="lib-input-seq-name" type="text" value="${current.name || ''}" placeholder="請輸入特效名稱" style="flex: 1; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 3px 6px; border-radius: 3px; font-size: 0.75rem;" ${isCurrentBuiltin ? 'disabled title="官方出廠預設為唯讀保護，請點擊「📋 複製」進行客製化創作"' : ''}>
          </div>

          <!-- 描述編輯 -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: #94a3b8; width: 38px; flex-shrink: 0;">描述:</label>
            <input id="lib-input-seq-desc" type="text" value="${current.description || ''}" placeholder="請輸入特效用途或備註" style="flex: 1; background: #0f172a; border: 1px solid #334155; color: #cbd5e1; padding: 2px 6px; border-radius: 3px; font-size: 0.70rem;" ${isCurrentBuiltin ? 'disabled' : ''}>
          </div>
        </div>

        <!-- ➕ 將當前選中特效/素材加入時間軸作為新圖層 -->
        <div style="display: flex; gap: 4px; margin-top: 2px;">
          <button id="lib-btn-add-to-timeline" style="flex: 1; background: #065f46; border: 1px solid #10b981; color: #6ee7b7; border-radius: 4px; padding: 5px 8px; font-size: 0.74rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;" title="將目前素材庫選中的預製件/素材，作為新圖層追加到目前特效時間軸">
            ➕ 加入時間軸圖層 (次生圖層/素材)
          </button>
        </div>

        <!-- 🔗 技能綁定表關聯資訊 (防護防線：素材嚴格禁止綁定技能) -->
        <div class="lib-bound-skills-card" style="background: #1e293b; border: 1px solid ${isCurrentMaterial ? '#b45309' : '#334155'}; border-radius: 4px; padding: 6px; font-size: 0.72rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #94a3b8; font-weight: bold;">🔗 綁定技能 (${boundSkills.length})</span>
            <button id="lib-btn-open-picker-quick" style="background: ${isCurrentMaterial ? '#334155' : 'rgba(56, 189, 248, 0.15)'}; border: 1px solid ${isCurrentMaterial ? '#475569' : '#0284c7'}; color: ${isCurrentMaterial ? '#64748b' : '#38bdf8'}; border-radius: 3px; padding: 1px 6px; font-size: 0.65rem; cursor: ${isCurrentMaterial ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; gap: 3px;" ${isCurrentMaterial ? 'disabled title="素材不可綁定技能"' : 'title="開啟全領域技能卡片選取中心"'}>
              🎴 卡片指派
            </button>
          </div>
          ${isCurrentMaterial ? `
            <div style="background: rgba(217, 119, 6, 0.15); border: 1px dashed #d97706; padding: 4px 6px; border-radius: 3px; color: #fde68a; font-size: 0.66rem; display: flex; align-items: center; gap: 4px;">
              <span>⚠️ <strong>[素材圖層]</strong> 專供時間軸「➕ 加一層」引用，不可直接綁定給技能！</span>
            </div>
          ` : boundSkills.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${boundSkills.map(b => `
                <span class="lib-skill-badge" data-skill-id="${b.skillId}" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #0284c7; color: #38bdf8; padding: 1px 5px; border-radius: 3px; font-size: 0.66rem; cursor: pointer;" title="點擊檢視/更換技能綁定">
                  ${b.skillId}
                </span>
              `).join('')}
            </div>
          ` : '<span style="color: #64748b; font-size: 0.68rem;">(尚未被任何技能直接引用，點擊上方指派)</span>'}
        </div>

        <!-- 🚀 發布至專案核心 SSOT (官方 30 款安全唯讀，自訂特效寫入獨立檔案) -->
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <button id="lib-btn-publish" style="flex: 2; background: linear-gradient(135deg, #7c3aed, #9333ea); color: #fff; border: 1px solid #a855f7; border-radius: 4px; padding: 6px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
            🚀 發布至專案 SSOT
          </button>
          <button id="lib-btn-export" style="flex: 1; background: #374151; color: #cbd5e1; border: 1px solid #4b5563; border-radius: 4px; padding: 6px; font-size: 0.75rem; cursor: pointer;">
            💾 複製庫
          </button>
        </div>

        <!-- 🔗 技能與普攻整合獨立折疊區 (解耦創作面板) -->
        <details open style="background: #111827; border: 1px solid #1f2937; border-radius: 4px; padding: 6px; margin-top: 6px;">
          <summary style="font-size: 0.75rem; color: #fbbf24; cursor: pointer; font-weight: bold;">
            ⚔️ 技能與普攻綁定管理
          </summary>
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px; font-size: 0.72rem;">
            <!-- 🎴 技能卡片綁定核心按鈕 -->
            <button id="lib-btn-open-skill-picker" style="background: ${isCurrentMaterial ? '#334155' : 'linear-gradient(135deg, #d97706, #f59e0b)'}; color: ${isCurrentMaterial ? '#64748b' : '#000'}; font-weight: 700; border: 1px solid ${isCurrentMaterial ? '#475569' : '#fbbf24'}; border-radius: 4px; padding: 6px 8px; font-size: 0.76rem; cursor: ${isCurrentMaterial ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: ${isCurrentMaterial ? 'none' : '0 2px 8px rgba(245, 158, 11, 0.25)'};" ${isCurrentMaterial ? 'disabled' : ''}>
              🎴 開啟技能卡片綁定中心 ${isCurrentMaterial ? '(素材禁用)' : ''}
            </button>

            <div style="height: 1px; background: #1f2937; margin: 2px 0;"></div>

            <label style="color: #9ca3af;">綁定當前特效至武器普攻：</label>
            <select id="lib-attack-target-select" style="background: #1f2937; border: 1px solid #374151; color: #e5e7eb; padding: 3px 6px; border-radius: 4px; font-size: 0.72rem;" ${isCurrentMaterial ? 'disabled' : ''}>
              <option value="GREATSWORD">⚔️ 巨劍 (GREATSWORD / 戰士)</option>
              <option value="BOW">🏹 戰弓 (BOW / 弓箭手)</option>
              <option value="STAFF">🔮 法杖 (STAFF / 法師)</option>
              <option value="DAGGERS">🗡️ 雙匕首 (DAGGERS / 盜賊)</option>
              <option value="SWORD_AND_SHIELD">🛡️ 劍盾 (SWORD_AND_SHIELD / 騎士)</option>
              <option value="HOLY_BOOK">📖 聖典 (HOLY_BOOK / 祈禱者)</option>
            </select>
            <div style="display: flex; gap: 4px;">
              <button id="lib-btn-bind-attack" style="flex: 1; background: ${isCurrentMaterial ? '#1e293b' : '#0284c7'}; color: ${isCurrentMaterial ? '#64748b' : '#fff'}; border: 1px solid ${isCurrentMaterial ? '#334155' : '#38bdf8'}; border-radius: 3px; padding: 3px; cursor: ${isCurrentMaterial ? 'not-allowed' : 'pointer'};" ${isCurrentMaterial ? 'disabled' : ''}>
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

  private selectPreset(id: string): void {
    if (this.store.getIsDirty()) {
      const ok = typeof confirm === 'function' ? confirm('⚠️ 您有尚未發布的修改，切換預設將捨棄當前變更，確定要切換嗎？') : true;
      if (!ok) {
        return;
      }
    }
    const seq = this.repo.getSequence(id) || this.repo.getPreset(id);
    if (seq) {
      this.store.setSequence(seq, false);
      this.store.setDirty(false);
      this.render();
    }
  }

  private bindEvents(): void {
    // 0. 範疇分欄 Tabs 點擊切換
    this.container.querySelectorAll('.lib-scope-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const scope = (e.currentTarget as HTMLElement).dataset.scope as VFXScopeTab;
        if (scope) this.setScope(scope);
      });
    });

    // 0.1 關鍵字搜尋過濾
    const searchInput = this.container.querySelector('#lib-search-input') as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim();
      this.render();
      // 保持搜尋框聚焦
      const newInput = this.container.querySelector('#lib-search-input') as HTMLInputElement | null;
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });

    // 0.2 屬性類別篩選
    const filterCat = this.container.querySelector('#lib-filter-category') as HTMLSelectElement | null;
    filterCat?.addEventListener('change', () => {
      if (filterCat) this.setCategoryFilter(filterCat.value as VFXCategoryFilter);
    });

    // 0.3 點擊特效卡片切換預設
    this.container.querySelectorAll('.vfx-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) this.selectPreset(id);
      });
    });

    // 1. 底層預設選單切換 (支援測試與相容性事件)
    const select = this.container.querySelector('#lib-preset-select') as HTMLSelectElement;
    if (select) {
      select.addEventListener('change', (e) => {
        const id = (e.target as HTMLSelectElement).value;
        if (this.store.getIsDirty()) {
          const ok = typeof confirm === 'function' ? confirm('⚠️ 您有尚未發布的修改，切換預設將捨棄當前變更，確定要切換嗎？') : true;
          if (!ok) {
            select.value = this.store.getSequence().id;
            return;
          }
        }
        const seq = this.repo.getSequence(id) || this.repo.getPreset(id);
        if (seq) {
          this.store.setSequence(seq, false);
          this.store.setDirty(false);
          this.render();
        }
      });
    }

    // 1.05 用途切換按鈕事件 (⚔️ 技能專用 vs 🧩 素材圖層)
    this.container.querySelector('#lib-btn-set-skill')?.addEventListener('click', () => {
      const current = this.store.getSequence();
      if (current.isBuiltin) return;
      this.store.updateConfig({ usageType: 'SKILL' }, true);
      this.render();
    });

    this.container.querySelector('#lib-btn-set-material')?.addEventListener('click', () => {
      const current = this.store.getSequence();
      if (current.isBuiltin) return;
      this.store.updateConfig({ usageType: 'MATERIAL' }, true);
      this.render();
    });

    // 1.06 屬性分類切換事件
    const selectCategory = this.container.querySelector('#lib-select-category') as HTMLSelectElement | null;
    selectCategory?.addEventListener('change', () => {
      const current = this.store.getSequence();
      if (current.isBuiltin) return;
      const category = selectCategory.value as 'PHYSICAL' | 'ELEMENTAL' | 'HOLY_DARK' | 'SPECIAL';
      this.store.updateConfig({ category }, true);
      this.render();
    });

    // 1.1 特效名稱與描述即時編輯
    const inputName = this.container.querySelector('#lib-input-seq-name') as HTMLInputElement | null;
    inputName?.addEventListener('input', () => {
      const name = inputName.value;
      this.store.updateConfig({ name }, false);
    });

    const inputDesc = this.container.querySelector('#lib-input-seq-desc') as HTMLInputElement | null;
    inputDesc?.addEventListener('input', () => {
      const description = inputDesc.value;
      this.store.updateConfig({ description }, false);
    });

    // 1.2 ➕ 加入時間軸圖層按鈕 (可將目前選中的技能或素材加入為次生圖層)
    this.container.querySelector('#lib-btn-add-to-timeline')?.addEventListener('click', () => {
      const current = this.store.getSequence();
      const curLayers = current.layers || [];
      const mainClip = getSequenceMainClip(current);
      const targetData = (mainClip?.payload?.data as Record<string, unknown> | undefined) || {};
      const newLayer = {
        id: `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        presetId: current.id,
        name: current.name || current.id,
        spatialMode: current.spatialMode || targetData.spatialMode || 'A_TO_B',
        reverse: !!targetData.reverse,
        shaderMode: targetData.shaderMode || 'ENERGY_BEAM',
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

    // 2. 新增預設：可自選用途 (技能專用 or 素材) 與初始屬性
    this.container.querySelector('#lib-btn-new')?.addEventListener('click', () => {
      const name = prompt('請輸入新特效名稱：', '新自訂特效');
      if (!name) return;
      const isMaterial = confirm('點擊【確定】建立為 [🧩 素材圖層] (僅供時間軸引用，不可綁定技能)\n點擊【取消】建立為 [⚔️ 技能專用] (完整戰鬥招式，可綁定技能)');
      const id = (isMaterial ? 'VFX_MAT_' : 'VFX_CUSTOM_') + Date.now();
      const newSeq: VFXSequence = {
        schemaVersion: 2,
        id,
        name,
        category: 'SPECIAL',
        usageType: isMaterial ? 'MATERIAL' : 'SKILL',
        isBuiltin: false,
        description: isMaterial ? '獨立素材圖層組件' : '全新技能特效',
        duration: 0.5,
        spatialMode: 'TRAJECTORY',
        impactPresentationMode: 'EXACT_IMPACTS',
        tracks: [
          {
            id: 'trk_main',
            name: '主特效軌 (Main Track)',
            type: 'MESH',
            enabled: true,
            clips: [
              {
                id: 'clip_main_0',
                name: '主特效片段',
                startTime: 0.0,
                duration: 0.45,
                payload: {
                  type: 'MESH',
                  data: {
                    shaderMode: 'VOLUMETRIC_FIRE',
                    spatialMode: 'TRAJECTORY',
                    colorCore: '#ffffff',
                    colorRim: '#f97316',
                    scale: 1.0,
                    glowRadius: 75,
                    glowOpacity: 0.85,
                    coreBrightness: 1.5,
                    salvoCount: 1,
                    salvoDuration: 0.35
                  }
                }
              }
            ]
          }
        ],
        impactCues: isMaterial ? [] : [
          {
            cueId: 'cue_impact',
            time: 0.42,
            kind: 'IMPACT',
            isPrimary: true
          }
        ]
      };
      const res = this.repo.saveCustomPreset(newSeq);
      if (res.success) {
        this.store.setPreset(newSeq, false);
        this.render();
      }
    });

    // 3. 複製預設
    this.container.querySelector('#lib-btn-clone')?.addEventListener('click', () => {
      const current = this.store.getSequence();
      const name = prompt('請輸入複製之新特效名稱：', (current.name || current.id) + ' (副本)');
      if (!name) return;
      const isMat = current.usageType === 'MATERIAL';
      const id = (isMat ? 'VFX_MAT_' : 'VFX_CUSTOM_') + Date.now();
      const cloneSeq: VFXSequence = {
        ...current,
        id,
        name,
        usageType: current.usageType || 'SKILL',
        isBuiltin: false,
        description: `複製自 ${current.name || current.id}`
      };
      const res = this.repo.saveCustomPreset(cloneSeq);
      if (res.success) {
        this.store.setPreset(cloneSeq, false);
        this.render();
      }
    });

    // 4. 發布至專案 SSOT (完整交易閉環：草稿寫回 ➔ 發布 ➔ 回讀驗證 ➔ 解除 Dirty)
    this.container.querySelector('#lib-btn-publish')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#lib-btn-publish') as HTMLButtonElement;
      if (btn) btn.textContent = '⏳ 發布中...';

      const current = this.store.getSequence();

      // 1. 客戶端預先校驗
      const validation = VFXPresetValidator.validatePreset(current);
      if (!validation.isValid) {
        alert(`❌ 目前特效草稿驗證失敗，無法發布：\n${validation.errors.join('\n')}`);
        if (btn) btn.textContent = '🚀 發布至專案 SSOT';
        return;
      }

      // 2. 將草稿寫回 Repository
      this.repo.upsertDraft(current);
      const all = this.repo.getAllSequences();

      try {
        const resp = await fetch('/__vfx_api/save_ssot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presets: all })
        });
        const data = await resp.json();
        if (!data.success) {
          const detailStr = Array.isArray(data.details) && data.details.length > 0 ? '\n' + data.details.slice(0, 8).join('\n') : '';
          throw new Error((data.error || '伺服器錯誤') + detailStr);
        }

        // 3. 重新讀回驗證資料閉環 (Readback Verification & Deep Equality Check)
        const getResp = await fetch(`/api/get-vfx-presets?t=${Date.now()}`, { cache: 'no-store' });
        if (!getResp.ok) {
          throw new Error(`伺服器回讀失敗 (HTTP ${getResp.status})`);
        }
        const serverSequences: VFXSequence[] = await getResp.json();
        if (!Array.isArray(serverSequences)) {
          throw new Error('伺服器回讀資料格式錯誤 (非陣列)');
        }
        const matching = serverSequences.find(p => p.id === current.id);
        if (!matching) {
          throw new Error(`伺服器回讀資料中找不到目前預設 [${current.id}]`);
        }

        const compResult = checkSequenceDeepEqual(current, matching);
        if (!compResult.isMatch) {
          console.warn('[VFXLibrary] Publish verification mismatch:', compResult.reason, { current, matching });
          throw new Error(`伺服器回讀與草稿不一致 [${compResult.reason}]`);
        }

        this.repo.reloadPresets(serverSequences);
        alert(`✅ 已成功發布 ${data.count} 款特效至專案 SSOT (src/data/vfx_sequences.json)！\n歷史快照：${data.snapshot}`);
        if (btn) btn.textContent = '✅ 已發布！';
        this.store.setDirty(false);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(JSON.stringify(all, null, 2));
        }
        alert(`⚠️ 發布失敗 (${errMsg})，草稿已保留在畫面上並將 JSON 複製至剪貼簿！`);
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

    // 6.5 開啟全領域技能卡片選取中心 Modal
    const openSkillPickerHandler = () => {
      const current = this.store.getPreset();
      SkillVfxPickerModal.getInstance().open(current.id, current.name, () => {
        this.render();
      });
    };

    this.container.querySelector('#lib-btn-open-skill-picker')?.addEventListener('click', openSkillPickerHandler);
    this.container.querySelector('#lib-btn-open-picker-quick')?.addEventListener('click', openSkillPickerHandler);
    this.container.querySelectorAll('.lib-skill-badge').forEach(badge => {
      badge.addEventListener('click', openSkillPickerHandler);
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        alert(`❌ 快照還原失敗：${msg}`);
      } finally {
        if (btn) btn.textContent = '⚠️ 從此快照還原 SSOT';
      }
    });
  }
}
