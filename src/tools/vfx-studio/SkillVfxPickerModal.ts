import { SkillVfxBindingRegistry } from '../../systems/combat/SkillVfxBindingRegistry';
import customSkillDataJson from '../../data/CustomSkillData.json';
import { renderUniversalIcon } from '../../ui/IconSpriteHelper';

export type SkillPickerCategory = 'ALL' | 'HERO' | 'MONSTER' | 'SIEGE' | 'CUSTOM';

export interface UnifiedSkillItem {
  id: string;
  name: string;
  category: 'HERO' | 'MONSTER' | 'SIEGE' | 'CUSTOM';
  categoryLabel: string;
  icon: string;
  description?: string;
}

/**
 * 聚合專案中全領域四大類別之所有技能
 */
export function getAllUnifiedSkills(): UnifiedSkillItem[] {
  const list: UnifiedSkillItem[] = [];
  const addedIds = new Set<string>();

  // 1. 英雄職業技能清單 (權威對照)
  const heroSkillDefs: Array<{ id: string; name: string; icon: string; desc: string }> = [
    // 戰士系
    { id: 'FIGHTER_HEAVY_STRIKE', name: '奮力一擊', icon: '⚔️', desc: '戰士基礎單體物理重擊' },
    { id: 'FIGHTER_ARMOR_BREAK', name: '破甲碎擊', icon: '🛡️', desc: '戰士基礎破甲攻擊' },
    { id: 'GREATSWORD_WHIRLWIND', name: '大劍旋風斬', icon: '🌪️', desc: '狂戰士進階群體旋風斬' },
    { id: 'MAGIC_SWORDSMAN_PHANTOM', name: '幻影劍舞', icon: '🗡️', desc: '魔劍士進階多段混合連擊' },

    // 騎士系
    { id: 'KNIGHT_SHIELD_BASH', name: '盾擊', icon: '🛡️', desc: '騎士基礎擊暈盾擊' },
    { id: 'KNIGHT_TAUNT', name: '嘲諷/掩護', icon: '📢', desc: '騎士基礎挑釁嘲諷' },
    { id: 'KNIGHT_PALADIN_AEGIS', name: '聖盾庇護', icon: '✨', desc: '聖騎士進階守護光盾' },
    { id: 'KNIGHT_RUNE_REFLECTION', name: '符文反制', icon: '🔯', desc: '符文騎士進階全體反擊結界' },

    // 弓箭手系
    { id: 'ARCHER_PIERCING_SHOT', name: '穿刺射擊', icon: '🏹', desc: '弓箭手基礎貫穿破甲箭' },
    { id: 'ARCHER_AIMED_SHOT', name: '精準狙擊', icon: '🎯', desc: '弓箭手基礎單體狙擊' },
    { id: 'SNIPER_FATAL_SNIPE', name: '致命一擊', icon: '⚡', desc: '神射手進階後排高傷狙擊' },
    { id: 'SPIRIT_ARCHER_SPIRIT_CHAIN', name: '精靈箭雨', icon: '🍃', desc: '精靈使進階連鎖風精靈之舞' },

    // 盜賊系
    { id: 'THIEF_SURPRISE_ATTACK', name: '突襲', icon: '🗡️', desc: '盜賊基礎背刺奇襲' },
    { id: 'THIEF_POISON_BLADE', name: '毒刃', icon: '🧪', desc: '盜賊基礎劇毒割裂' },
    { id: 'ASSASSIN_SHADOW_ASSASSINATION', name: '暗影暗殺', icon: '👤', desc: '暗殺者進階連續奪命斬' },
    { id: 'TRICKSTER_TRICK_MAGIC', name: '詭術幻象', icon: '🎭', desc: '詭術師進階分身幻惑' },

    // 法師系
    { id: 'MAGE_ARCANE_MISSILES', name: '秘法飛彈', icon: '🔮', desc: '法師基礎隨機追蹤魔彈' },
    { id: 'MAGE_FIRE_BOLT', name: '火球術', icon: '🔥', desc: '法師基礎火焰衝擊彈' },
    { id: 'MAGE_ICE_SPIKE', name: '冰刺術', icon: '❄️', desc: '法師基礎冰晶突刺' },
    { id: 'MAGE_LIGHTNING_BOLT', name: '狂雷術', icon: '⚡', desc: '法師基礎雷電轟擊' },
    { id: 'MAGE_STATIC_FIELD', name: '靜電場', icon: '🌐', desc: '法師全體感電場' },
    { id: 'STAFF_METEOR', name: '天降流星', icon: '☄️', desc: '大魔導士進階全體天降隕石' },
    { id: 'SCYTHE_SOUL_REAP', name: '靈魂收割', icon: '💀', desc: '死靈法師進階連鎖死神斬魂' },

    // 祈禱者系
    { id: 'PRAYER_HEAL', name: '初級治癒', icon: '💚', desc: '祈禱者單體神聖生命恢復' },
    { id: 'PRAYER_HOLY_LIGHT', name: '神聖之光', icon: '🌟', desc: '祈禱者聖光打擊' },
    { id: 'PRAYER_ARCHBISHOP_MASS_HEAL', name: '大主教群體祈禱', icon: '🌧️', desc: '大主教進階全體神聖之雨' },
    { id: 'PRAYER_INQUISITOR_JUDGMENT', name: '異端審判', icon: '⚖️', desc: '異端拷問官進階終焉審判' }
  ];

  for (const s of heroSkillDefs) {
    list.push({
      id: s.id,
      name: s.name,
      category: 'HERO',
      categoryLabel: '👑 英雄職業',
      icon: s.icon,
      description: s.desc
    });
    addedIds.add(s.id);
  }

  // 2. 怪物專屬技能清單
  const monsterSkillDefs: Array<{ id: string; name: string; icon: string; desc: string }> = [
    { id: 'CATACLYSM_FLAME', name: '末日焰炎 / 滅世黑炎', icon: '🔥💀', desc: '高階惡魔與火龍全體烈焰' },
    { id: 'DRAGON_ROAR', name: '巨龍咆哮', icon: '🐉', desc: '古龍全體音波震撼與戰意' },
    { id: 'SKILL_TOXIC_SPRAY', name: '劇毒噴吐', icon: '🧪', desc: '劇毒魔物毒液噴射' },
    { id: 'SKILL_SAVAGE_REND', name: '野蠻撕裂', icon: '🩸', desc: '野獸兇猛爪擊與流血' },
    { id: 'SKILL_CRUSHING_SLAM', name: '巨力重砸', icon: '💥', desc: '巨怪泰山壓頂重錘' },
    { id: 'SKILL_BLOOD_DRAIN', name: '吸血獠牙', icon: '🧛', desc: '不死族單體嗜血撕咬' },
    { id: 'SKILL_TERROR_SCREECH', name: '恐懼尖嘯', icon: '😱', desc: '女妖精神尖嘯混亂' },
    { id: 'SKILL_SHADOW_ASSAULT', name: '暗影突襲', icon: '👤', desc: '陰影魔物瞬移刺擊' },
    { id: 'SKILL_FLAME_BURST', name: '火焰爆燃', icon: '💥🔥', desc: '火焰元素原地爆炸' },
    { id: 'SKILL_FROST_BREATH', name: '冰霜吐息', icon: '❄️', desc: '冰霜飛龍直線吐息' },
    { id: 'SKILL_IRON_DEFENSE', name: '鋼鐵防壁', icon: '🛡️', desc: '岩石巨魔自身大幅硬化' },
    { id: 'SKILL_FRENZY_ROAR', name: '狂亂怒吼', icon: '🦁', desc: '狂暴頭目狂化怒吼' }
  ];

  for (const s of monsterSkillDefs) {
    if (!addedIds.has(s.id)) {
      list.push({
        id: s.id,
        name: s.name,
        category: 'MONSTER',
        categoryLabel: '👾 魔物怪物',
        icon: s.icon,
        description: s.desc
      });
      addedIds.add(s.id);
    }
  }

  // 3. 攻城戰役部隊技能
  const siegeSkillDefs: Array<{ id: string; name: string; icon: string; desc: string }> = [
    { id: 'CAVALRY_CHARGE', name: '騎兵破陣衝鋒', icon: '🐎', desc: '重裝騎兵高速貫穿前排' },
    { id: 'SHIELD_WALL', name: '步兵盾牆', icon: '🛡️🧱', desc: '重步兵嚴陣結陣防禦' },
    { id: 'VOLLEY_FIRE', name: '弓兵齊射', icon: '🏹🌧️', desc: '長弓隊滿弦天降箭雨' },
    { id: 'TREBUCHET_ATTACK', name: '重型投石機', icon: '🪨', desc: '巨型投石機巨石轟擊城牆' },
    { id: 'BATTERING_RAM_ATTACK', name: '撞木衝車', icon: '🪵🚪', desc: '攻城衝車重擊城門' },
    { id: 'WATCHTOWER_ATTACK', name: '哨所箭塔', icon: '🗼🏹', desc: '高聳哨塔自動防衛射擊' }
  ];

  for (const s of siegeSkillDefs) {
    if (!addedIds.has(s.id)) {
      list.push({
        id: s.id,
        name: s.name,
        category: 'SIEGE',
        categoryLabel: '🏰 攻城戰役',
        icon: s.icon,
        description: s.desc
      });
      addedIds.add(s.id);
    }
  }

  // 4. 工坊自訂技能 (從 CustomSkillData 與 LocalStorage 讀取)
  let customSkills: any[] = [];
  if (Array.isArray(customSkillDataJson)) {
    customSkills = customSkills.concat(customSkillDataJson);
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const rawLocal = localStorage.getItem('MEDIEVAL_CUSTOM_SKILLS_V2');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          // 本地自訂技能覆蓋或追加
          for (const item of parsed) {
            const idx = customSkills.findIndex(c => c.id === item.id);
            if (idx >= 0) customSkills[idx] = item;
            else customSkills.push(item);
          }
        }
      }
    } catch {}
  }

  for (const cs of customSkills) {
    if (!cs?.id || addedIds.has(cs.id)) continue;
    list.push({
      id: cs.id,
      name: cs.name || cs.id,
      category: 'CUSTOM',
      categoryLabel: '🔮 工坊自訂',
      icon: cs.icon || '✨',
      description: cs.description || '創作者在技能工坊原創之積木技能'
    });
    addedIds.add(cs.id);
  }

  return list;
}

/**
 * 🎴 技能特效卡片選取綁定器彈窗控制項 (SkillVfxPickerModal)
 */
export class SkillVfxPickerModal {
  private static instance: SkillVfxPickerModal;
  private modalEl: HTMLElement | null = null;
  private currentVfxId: string = '';
  private currentVfxName: string = '';
  private currentCategory: SkillPickerCategory = 'ALL';
  private searchQuery: string = '';
  private onBindingChangedCallback: (() => void) | null = null;

  private constructor() {
    this.ensureModalDom();
  }

  public static getInstance(): SkillVfxPickerModal {
    if (!SkillVfxPickerModal.instance) {
      SkillVfxPickerModal.instance = new SkillVfxPickerModal();
    }
    return SkillVfxPickerModal.instance;
  }

  /**
   * 確保 Modal DOM 元素存在
   */
  private ensureModalDom(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById('modal-skill-vfx-picker')) {
      this.modalEl = document.getElementById('modal-skill-vfx-picker');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'modal-skill-vfx-picker';
    modal.className = 'skill-vfx-picker-modal-overlay';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="skill-vfx-picker-dialog">
        <!-- 頂部 Header -->
        <div class="svp-header">
          <div class="svp-title-group">
            <span class="svp-icon">🎴</span>
            <div>
              <h3 class="svp-title">技能特效卡片綁定中心</h3>
              <p class="svp-subtitle">直接點選技能卡片，將當前工坊特效綁定至遊戲技能</p>
            </div>
          </div>
          <div class="svp-target-badge">
            <span class="svp-badge-label">當前工坊特效:</span>
            <span id="svp-current-vfx-label" class="svp-badge-value">載入中...</span>
          </div>
          <button id="btn-svp-close" class="svp-close-btn" title="關閉 (ESC)">✕</button>
        </div>

        <!-- 篩選列與搜尋框 -->
        <div class="svp-toolbar">
          <div class="svp-search-box">
            <span class="svp-search-icon">🔍</span>
            <input type="text" id="svp-search-input" class="svp-search-input" placeholder="搜尋技能名稱、ID 或關鍵字..." />
          </div>
          <div class="svp-tabs" id="svp-tabs-container">
            <button class="svp-tab-btn active" data-cat="ALL">🌐 全部</button>
            <button class="svp-tab-btn" data-cat="HERO">👑 英雄職業</button>
            <button class="svp-tab-btn" data-cat="MONSTER">👾 魔物怪物</button>
            <button class="svp-tab-btn" data-cat="SIEGE">🏰 攻城戰役</button>
            <button class="svp-tab-btn" data-cat="CUSTOM">🔮 工坊自訂</button>
          </div>
        </div>

        <!-- 卡片網格展示區 -->
        <div class="svp-body">
          <div id="svp-cards-grid" class="svp-cards-grid">
            <!-- 動態注入技能卡片 -->
          </div>
          <div id="svp-empty-state" class="svp-empty-state" style="display: none;">
            <span style="font-size: 2.5rem;">🔍</span>
            <p style="color: #94a3b8; margin-top: 8px;">查無符合條件的技能卡片</p>
          </div>
        </div>

        <!-- 底部說明列 -->
        <div class="svp-footer">
          <div class="svp-footer-tip">
            💡 提示：覆蓋綁定為 1 對 1 指向，原特效預設完全保留無損。修改過的技能隨時可點擊【↩️ 還原】恢復官方初始特效。
          </div>
          <button id="btn-svp-done" class="svp-done-btn">完成並返回工坊</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalEl = modal;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.modalEl) return;

    // 關閉事件
    const closeHandler = () => this.close();
    this.modalEl.querySelector('#btn-svp-close')?.addEventListener('click', closeHandler);
    this.modalEl.querySelector('#btn-svp-done')?.addEventListener('click', closeHandler);

    // 點擊背景遮罩關閉
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    // ESC 鍵關閉
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          this.close();
        }
      });
    }

    // 搜尋即時過濾
    const searchInput = this.modalEl.querySelector('#svp-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim().toLowerCase();
      this.renderCards();
    });

    // 分類 Tabs 切換
    this.modalEl.querySelectorAll('.svp-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat') as SkillPickerCategory;
        if (cat) {
          this.currentCategory = cat;
          this.modalEl?.querySelectorAll('.svp-tab-btn').forEach(b => b.classList.remove('active'));
          (e.currentTarget as HTMLElement).classList.add('active');
          this.renderCards();
        }
      });
    });
  }

  /**
   * 開啟彈窗
   */
  public open(currentVfxId: string, currentVfxName: string, onBindingChanged?: () => void): void {
    this.ensureModalDom();
    this.currentVfxId = currentVfxId;
    this.currentVfxName = currentVfxName || currentVfxId;
    this.onBindingChangedCallback = onBindingChanged || null;

    const labelEl = this.modalEl?.querySelector('#svp-current-vfx-label');
    if (labelEl) {
      labelEl.textContent = `${this.currentVfxName} (${this.currentVfxId})`;
    }

    const searchInput = this.modalEl?.querySelector('#svp-search-input') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    this.searchQuery = '';
    this.currentCategory = 'ALL';

    this.modalEl?.querySelectorAll('.svp-tab-btn').forEach(b => {
      if (b.getAttribute('data-cat') === 'ALL') b.classList.add('active');
      else b.classList.remove('active');
    });

    this.renderCards();

    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    }
  }

  /**
   * 關閉彈窗
   */
  public close(): void {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    }
    if (this.onBindingChangedCallback) {
      this.onBindingChangedCallback();
    }
  }

  public isOpen(): boolean {
    return this.modalEl?.style.display === 'flex';
  }

  /**
   * 渲染技能卡片清單
   */
  private renderCards(): void {
    if (!this.modalEl) return;
    const grid = this.modalEl.querySelector('#svp-cards-grid') as HTMLElement;
    const emptyState = this.modalEl.querySelector('#svp-empty-state') as HTMLElement;
    if (!grid) return;

    const registry = SkillVfxBindingRegistry.getInstance();
    const allSkills = getAllUnifiedSkills();

    // 依類別過濾
    const filtered = allSkills.filter(s => {
      if (this.currentCategory !== 'ALL' && s.category !== this.currentCategory) return false;
      if (this.searchQuery) {
        const matchesName = s.name.toLowerCase().includes(this.searchQuery);
        const matchesId = s.id.toLowerCase().includes(this.searchQuery);
        const matchesDesc = s.description?.toLowerCase().includes(this.searchQuery) || false;
        return matchesName || matchesId || matchesDesc;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = filtered.map(skill => {
      const boundVfxId = registry.getVfxForSkill(skill.id, registry.getVfxForSkill(skill.name));
      const isCurrentActive = boundVfxId === this.currentVfxId;
      const isModified = registry.isBindingModified(skill.id) || registry.isBindingModified(skill.name);
      const defaultVfxId = registry.getDefaultVfxId(skill.id) || registry.getDefaultVfxId(skill.name);
      const iconHtml = renderUniversalIcon(skill.icon || '⚔️', 36);

      return `
        <div class="svp-skill-card ${isCurrentActive ? 'card-current-bound' : ''}" data-skill-id="${skill.id}">
          <div class="svp-card-top">
            <div class="svp-skill-icon">${iconHtml}</div>
            <div class="svp-skill-meta">
              <span class="svp-skill-cat-badge cat-${skill.category.toLowerCase()}">${skill.categoryLabel}</span>
              <h4 class="svp-skill-name" title="${skill.name} (${skill.id})">${skill.name}</h4>
              <span class="svp-skill-id">${skill.id}</span>
            </div>
          </div>

          ${skill.description ? `<div class="svp-skill-desc" title="${skill.description}">${skill.description}</div>` : ''}

          <!-- 當前特效綁定狀態 -->
          <div class="svp-card-binding-info">
            <span class="svp-bind-label">目前綁定:</span>
            <span class="svp-bind-value ${isCurrentActive ? 'text-highlight' : ''}" title="${boundVfxId}">
              ${boundVfxId}
            </span>
            ${isCurrentActive ? '<span class="svp-active-tag">✨ 本特效</span>' : ''}
          </div>

          <!-- 卡片動作按鈕 -->
          <div class="svp-card-actions">
            ${isCurrentActive ? `
              <button class="svp-btn svp-btn-bound" disabled>
                ✓ 已綁定本特效
              </button>
            ` : `
              <button class="svp-btn svp-btn-primary btn-bind-this-skill" data-skill-id="${skill.id}">
                🔗 覆蓋綁定為此特效
              </button>
            `}

            ${isModified ? `
              <button class="svp-btn svp-btn-restore btn-restore-this-skill" data-skill-id="${skill.id}" title="還原為官方預設 (${defaultVfxId || '無'})">
                ↩️ 還原
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // 綁定卡片內按鈕點擊事件
    grid.querySelectorAll('.btn-bind-this-skill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const skillId = (e.currentTarget as HTMLElement).getAttribute('data-skill-id');
        if (skillId) {
          this.applyBinding(skillId);
        }
      });
    });

    grid.querySelectorAll('.btn-restore-this-skill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const skillId = (e.currentTarget as HTMLElement).getAttribute('data-skill-id');
        if (skillId) {
          this.restoreBinding(skillId);
        }
      });
    });
  }

  /**
   * 執行覆蓋綁定
   */
  private applyBinding(skillId: string): void {
    const registry = SkillVfxBindingRegistry.getInstance();
    registry.setSkillBinding(skillId, this.currentVfxId);

    // 同步把中文名也綁定（若存在），維持雙向 SSOT
    const skillObj = getAllUnifiedSkills().find(s => s.id === skillId);
    if (skillObj && skillObj.name !== skillId) {
      registry.setSkillBinding(skillObj.name, this.currentVfxId);
    }

    // 重新渲染卡片
    this.renderCards();

    // 觸發外部回呼更新左側 Library 徽章
    if (this.onBindingChangedCallback) {
      this.onBindingChangedCallback();
    }
  }

  /**
   * 執行還原官方預設
   */
  private restoreBinding(skillId: string): void {
    const registry = SkillVfxBindingRegistry.getInstance();
    registry.restoreDefaultBinding(skillId);

    const skillObj = getAllUnifiedSkills().find(s => s.id === skillId);
    if (skillObj && skillObj.name !== skillId) {
      registry.restoreDefaultBinding(skillObj.name);
    }

    this.renderCards();

    if (this.onBindingChangedCallback) {
      this.onBindingChangedCallback();
    }
  }
}
