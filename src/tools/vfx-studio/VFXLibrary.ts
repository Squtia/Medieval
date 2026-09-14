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
export interface SequenceDiffResult {
  isMatch: boolean;
  reason?: string;
}

/**
 * 🛡️ 規範 §9.2、§9.3、§10 與 §11 強制：純淨強型別 VFXSequence 規格比對器
 * 0 any、0 as any，嚴格比對 Canonical Sequence 核心屬性、軌道、片段、Cues
 */
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
      const isComposite = (p.tracks && p.tracks.some(t => t.type === 'COMPOSITE_LAYER')) || Boolean(p.layers && p.layers.length > 0);
      if (this.currentTab === 'COMPOSITE') return isComposite;
      const mainClip = getSequenceMainClip(p);
      const mainData = (mainClip?.payload?.data as Record<string, unknown> | undefined) || {};
      const anchor = getTrajectorySpatialAnchor(p.spatialMode || (mainData.spatialMode as string) || (mainData.trajectoryPath as string) || (mainData.trajectory as string));
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
            const mainClip = getSequenceMainClip(p);
            const mainData = (mainClip?.payload?.data as any) || {};
            const anchor = getTrajectorySpatialAnchor(p.spatialMode || mainData.spatialMode || mainData.trajectoryPath || mainData.trajectory);
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
            <button id="lib-btn-open-picker-quick" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #0284c7; color: #38bdf8; border-radius: 3px; padding: 1px 6px; font-size: 0.65rem; cursor: pointer; display: flex; align-items: center; gap: 3px;" title="開啟全領域技能卡片選取中心">
              🎴 卡片指派
            </button>
          </div>
          ${boundSkills.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${boundSkills.map(b => `
                <span class="lib-skill-badge" data-skill-id="${b.skillId}" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #0284c7; color: #38bdf8; padding: 1px 5px; border-radius: 3px; font-size: 0.66rem; cursor: pointer;" title="點擊檢視/更換技能綁定">
                  ${b.skillId}
                </span>
              `).join('')}
            </div>
          ` : '<span style="color: #64748b; font-size: 0.68rem;">(尚未被任何技能直接引用，點擊上方指派)</span>'}
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
        <details open style="background: #111827; border: 1px solid #1f2937; border-radius: 4px; padding: 6px; margin-top: 6px;">
          <summary style="font-size: 0.75rem; color: #fbbf24; cursor: pointer; font-weight: bold;">
            ⚔️ 技能與普攻綁定管理
          </summary>
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px; font-size: 0.72rem;">
            <!-- 🎴 技能卡片綁定核心按鈕 -->
            <button id="lib-btn-open-skill-picker" style="background: linear-gradient(135deg, #d97706, #f59e0b); color: #000; font-weight: 700; border: 1px solid #fbbf24; border-radius: 4px; padding: 6px 8px; font-size: 0.76rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);">
              🎴 開啟技能卡片綁定中心
            </button>

            <div style="height: 1px; background: #1f2937; margin: 2px 0;"></div>

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

    // 1. 預設選單切換 (防呆攔截未保存草稿)
    const select = this.container.querySelector('#lib-preset-select') as HTMLSelectElement;
    if (select) {
      select.addEventListener('change', (e) => {
        const id = (e.target as HTMLSelectElement).value;
        if (this.store.getIsDirty()) {
          const ok = confirm('⚠️ 您有尚未發布的修改，切換預設將捨棄當前變更，確定要切換嗎？');
          if (!ok) {
            select.value = this.store.getPreset().id;
            return;
          }
        }
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

      const current = this.store.getSequence();
      const curLayers = current.layers || [];
      const targetMainClip = getSequenceMainClip(targetPreset);
      const targetData = (targetMainClip?.payload?.data as Record<string, unknown> | undefined) || {};
      const newLayer = {
        id: `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        presetId: targetPreset.id,
        name: targetPreset.name || targetPreset.id,
        spatialMode: targetPreset.spatialMode || targetData.spatialMode || 'A_TO_B',
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

    // 2. 新增預設：建立乾淨標準的通用空白骨架，徹底解耦斬擊舊屬性
    this.container.querySelector('#lib-btn-new')?.addEventListener('click', () => {
      const name = prompt('請輸入新特效名稱：', '新自訂特效');
      if (!name) return;
      const id = 'VFX_CUSTOM_' + Date.now();
      const newSeq: VFXSequence = {
        schemaVersion: 2,
        id,
        name,
        category: 'SPECIAL',
        description: '全新自訂特效',
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
        impactCues: [
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
      const id = 'VFX_CLONE_' + Date.now();
      const cloneSeq: VFXSequence = {
        ...current,
        id,
        name,
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
      } catch (err: any) {
        alert(`❌ 快照還原失敗：${err.message}`);
      } finally {
        if (btn) btn.textContent = '⚠️ 從此快照還原 SSOT';
      }
    });
  }
}
