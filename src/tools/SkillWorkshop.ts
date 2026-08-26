import { CompositeSkillDefinition, EffectBlock, SkillTrigger, SkillEffectType, SkillConditionType, TargetType, SkillCategory } from '../models/Skill';
import templateHtml from '../templates/skill-workshop.html?raw';
import { renderUniversalIcon } from '../ui/IconSpriteHelper';
import defaultCustomDatasets from '../data/custom_icon_datasets.json';

export class SkillWorkshop {
  private static instance: SkillWorkshop;
  private skills: CompositeSkillDefinition[] = [];
  private currentSkillId: string | null = null;
  private isDirty: boolean = false;
  private currentIconTab: string = 'skill_emoji';
  private iconPickerCallback: ((icon: string) => void) | null = null;

  public static getInstance(): SkillWorkshop {
    if (!SkillWorkshop.instance) {
      SkillWorkshop.instance = new SkillWorkshop();
    }
    return SkillWorkshop.instance;
  }

  public async init(): Promise<void> {
    const root = document.getElementById('skill-workshop-root');
    if (!root) return;

    this.injectStyles();
    root.innerHTML = templateHtml;
    this.bindEvents();
    this.bindIconPickerEvents();
    await this.loadSkills();
  }

  private injectStyles(): void {
    if (document.getElementById('sw-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'sw-custom-styles';
    style.textContent = `
      :root {
        --sw-bg: #0b0f19;
        --sw-card: #151d2f;
        --sw-card-hover: #1e293b;
        --sw-border: rgba(255, 255, 255, 0.08);
        --sw-primary: #6366f1;
        --sw-primary-hover: #4f46e5;
        --sw-gold: #f59e0b;
        --sw-gold-hover: #d97706;
        --sw-danger: #ef4444;
        --sw-danger-hover: #dc2626;
        --sw-text: #f8fafc;
        --sw-text-muted: #94a3b8;
      }
      .sw-container { display: flex; flex-direction: column; height: 100vh; background: var(--sw-bg); color: var(--sw-text); box-sizing: border-box; }
      .sw-topbar { height: 60px; background: #0f172a; border-bottom: 1px solid var(--sw-border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; }
      .sw-title-group { display: flex; align-items: center; gap: 12px; }
      .sw-logo-icon { font-size: 1.8rem; }
      .sw-main-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #fff; line-height: 1.2; }
      .sw-subtitle { margin: 0; font-size: 0.75rem; color: var(--sw-text-muted); }
      .sw-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 9999px; border: 1px solid var(--sw-gold); color: var(--sw-gold); font-weight: 600; }
      .sw-actions { display: flex; gap: 8px; align-items: center; }
      .sw-btn { background: #1e293b; color: #fff; border: 1px solid var(--sw-border); padding: 7px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
      .sw-btn:hover { background: #334155; }
      .sw-btn-sm { padding: 4px 10px; font-size: 0.78rem; }
      .sw-btn-primary { background: var(--sw-primary); border-color: var(--sw-primary); }
      .sw-btn-primary:hover { background: var(--sw-primary-hover); }
      .sw-btn-gold { background: var(--sw-gold); color: #000; border-color: var(--sw-gold); font-weight: 600; }
      .sw-btn-gold:hover { background: var(--sw-gold-hover); }
      .sw-btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.4); }
      .sw-btn-danger:hover { background: var(--sw-danger); color: #fff; }
      .sw-workspace { display: flex; flex: 1; overflow: hidden; }
      .sw-sidebar { width: 340px; border-right: 1px solid var(--sw-border); background: #0c1220; display: flex; flex-direction: column; flex-shrink: 0; }
      .sw-sidebar-header { padding: 14px 16px; border-bottom: 1px solid var(--sw-border); display: flex; justify-content: space-between; align-items: center; }
      .sw-sidebar-title { font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }
      .sw-counter { background: #1e293b; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; color: var(--sw-text-muted); }
      .sw-filter-bar { padding: 10px 16px; border-bottom: 1px solid var(--sw-border); display: flex; gap: 8px; background: rgba(0,0,0,0.2); }
      .sw-input, .sw-select, .sw-textarea { background: #131d31; border: 1px solid var(--sw-border); border-radius: 6px; color: #fff; padding: 6px 10px; font-size: 0.85rem; outline: none; transition: border-color 0.15s; }
      .sw-input:focus, .sw-select:focus, .sw-textarea:focus { border-color: var(--sw-primary); }
      .sw-skill-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
      .sw-skill-card { background: var(--sw-card); border: 1px solid var(--sw-border); border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: all 0.15s; display: flex; gap: 10px; align-items: center; }
      .sw-skill-card:hover { background: var(--sw-card-hover); border-color: rgba(255,255,255,0.2); }
      .sw-skill-card.active { background: #1e2540; border-color: var(--sw-primary); box-shadow: 0 0 12px rgba(99, 102, 241, 0.25); }
      .sw-card-icon { font-size: 1.5rem; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 6px; flex-shrink: 0; }
      .sw-card-info { flex: 1; min-width: 0; }
      .sw-card-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sw-card-meta { font-size: 0.75rem; color: var(--sw-text-muted); display: flex; gap: 8px; }
      .sw-editor { flex: 1; overflow-y: auto; padding: 20px; background: var(--sw-bg); }
      .sw-empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .sw-card { background: var(--sw-card); border: 1px solid var(--sw-border); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
      .sw-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-weight: 600; font-size: 0.95rem; }
      .sw-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .sw-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .sw-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .sw-form-group { display: flex; flex-direction: column; gap: 6px; }
      .sw-label { font-size: 0.75rem; color: var(--sw-text-muted); font-weight: 500; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .sw-blocks-container { display: flex; flex-direction: column; gap: 12px; }
      .sw-block-item { background: #0e1626; border: 1px solid var(--sw-border); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; position: relative; }
      .sw-block-item:hover { border-color: rgba(255,255,255,0.18); }
      .sw-block-top { display: flex; justify-content: space-between; align-items: center; }
      .sw-block-pill { font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
      .pill-when { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
      .pill-what { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
      .pill-if { background: rgba(16, 185, 129, 0.2); color: #34d399; }
      .sw-icon-tab { background: #1e293b; color: #94a3b8; border: 1px solid var(--sw-border); padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; white-space: nowrap; transition: all 0.15s; }
      .sw-icon-tab:hover { background: #334155; color: #fff; }
      .sw-icon-tab.active { background: var(--sw-primary); color: #fff; border-color: var(--sw-primary); font-weight: 600; }
      .sw-icon-item { background: rgba(0,0,0,0.3); border: 1px solid var(--sw-border); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; transition: all 0.15s; }
      .sw-icon-item:hover { background: rgba(99, 102, 241, 0.2); border-color: var(--sw-primary); transform: translateY(-2px); }
    `;
    document.head.appendChild(style);
  }

  private bindEvents(): void {
    document.getElementById('btn-sw-new-skill')?.addEventListener('click', () => this.createNewSkill());
    document.getElementById('btn-sw-save-disk')?.addEventListener('click', () => this.saveToDisk());
    document.getElementById('btn-sw-delete-skill')?.addEventListener('click', () => this.deleteCurrentSkill());
    document.getElementById('btn-sw-duplicate-skill')?.addEventListener('click', () => this.duplicateCurrentSkill());
    document.getElementById('btn-sw-add-block')?.addEventListener('click', () => this.addBlockToCurrentSkill());

    document.getElementById('sw-search-input')?.addEventListener('input', () => this.renderSkillList());
    document.getElementById('sw-filter-category')?.addEventListener('change', () => this.renderSkillList());

    // 圖標選擇器觸發
    const openPickerHandler = () => {
      this.openIconPicker((selectedIcon) => {
        if (!this.currentSkillId) return;
        const cur = this.getCurrentSkill();
        if (!cur) return;
        cur.icon = selectedIcon;
        (document.getElementById('inp-sw-icon') as HTMLInputElement).value = selectedIcon;
        this.updateIconPreview(selectedIcon);
        this.isDirty = true;
        this.renderSkillList();
      });
    };

    document.getElementById('sw-icon-preview')?.addEventListener('click', openPickerHandler);
    document.getElementById('btn-sw-pick-icon')?.addEventListener('click', openPickerHandler);

    // 導航按鈕
    document.getElementById('btn-sw-nav-combat')?.addEventListener('click', () => {
      window.location.href = './combat-studio.html';
    });
    document.getElementById('btn-sw-nav-story')?.addEventListener('click', () => {
      window.location.href = './story-studio.html';
    });
    document.getElementById('btn-sw-nav-equip')?.addEventListener('click', () => {
      window.location.href = './equipment-studio.html';
    });
    document.getElementById('btn-sw-history')?.addEventListener('click', () => this.showHistoryModal());

    // 表單雙向綁定
    const bindInput = (id: string, prop: keyof CompositeSkillDefinition, isNum = false) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        if (!this.currentSkillId) return;
        const cur = this.getCurrentSkill();
        if (!cur) return;
        const val = (e.target as HTMLInputElement).value;
        (cur as any)[prop] = isNum ? Number(val) : val;
        if (prop === 'icon') {
          this.updateIconPreview(val);
        }
        this.isDirty = true;
        this.renderSkillList();
      });
    };

    bindInput('inp-sw-id', 'id');
    bindInput('inp-sw-name', 'name');
    bindInput('inp-sw-icon', 'icon');
    bindInput('inp-sw-category', 'category');
    bindInput('inp-sw-mp', 'totalMpCost', true);
    bindInput('inp-sw-cd', 'cooldown', true);
    bindInput('inp-sw-desc', 'description');
  }

  private updateIconPreview(icon?: string): void {
    const preview = document.getElementById('sw-icon-preview');
    if (!preview) return;
    preview.innerHTML = renderUniversalIcon(icon || '🔮', 28);
  }

  // ── 全圖集通用圖標選擇器 ──
  private openIconPicker(callback: (icon: string) => void): void {
    this.iconPickerCallback = callback;
    const modal = document.getElementById('modal-sw-icon-picker');
    const tabsContainer = document.getElementById('sw-icon-picker-tabs');
    const customInput = document.getElementById('inp-sw-icon-picker-custom') as HTMLInputElement;
    const searchInput = document.getElementById('inp-sw-icon-picker-search') as HTMLInputElement;
    if (!modal || !tabsContainer) return;

    if (customInput) customInput.value = '';
    if (searchInput) searchInput.value = '';

    const datasets = (defaultCustomDatasets || {}) as Record<string, any>;
    const catKeys = Object.keys(datasets);

    const allTabs = [
      { key: 'skill_emoji', title: '🔮 技能/戰鬥 Emoji' },
      { key: 'monster_emoji', title: '👾 魔物/野獸 Emoji' },
      ...catKeys.map(k => ({ key: k, title: datasets[k]?.title || k }))
    ];

    if (!allTabs.some(t => t.key === this.currentIconTab)) {
      this.currentIconTab = 'skill_emoji';
    }

    tabsContainer.innerHTML = allTabs.map(t => `
      <button type="button" class="sw-icon-tab ${t.key === this.currentIconTab ? 'active' : ''}" data-tab="${t.key}">${t.title}</button>
    `).join('');

    tabsContainer.querySelectorAll('.sw-icon-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentIconTab = btn.getAttribute('data-tab') || 'skill_emoji';
        tabsContainer.querySelectorAll('.sw-icon-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderIconPickerGrid();
      });
    });

    this.renderIconPickerGrid();
    modal.style.display = 'flex';
  }

  private bindIconPickerEvents(): void {
    const modal = document.getElementById('modal-sw-icon-picker');
    document.getElementById('btn-sw-icon-picker-close')?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    document.getElementById('inp-sw-icon-picker-search')?.addEventListener('input', () => {
      this.renderIconPickerGrid();
    });

    document.getElementById('btn-sw-icon-picker-apply-custom')?.addEventListener('click', () => {
      const customInput = document.getElementById('inp-sw-icon-picker-custom') as HTMLInputElement;
      const val = customInput?.value.trim();
      if (val && this.iconPickerCallback) {
        this.iconPickerCallback(val);
        if (modal) modal.style.display = 'none';
      }
    });
  }

  private renderIconPickerGrid(): void {
    const grid = document.getElementById('sw-icon-picker-grid');
    const countEl = document.getElementById('sw-icon-picker-count');
    const modal = document.getElementById('modal-sw-icon-picker');
    const searchVal = ((document.getElementById('inp-sw-icon-picker-search') as HTMLInputElement)?.value || '').toLowerCase().trim();
    if (!grid) return;
    grid.innerHTML = '';

    let items: { icon: string; label: string }[] = [];

    if (this.currentIconTab === 'skill_emoji') {
      const emojis = [
        '🔥', '❄️', '⚡', '💧', '🌪️', '☄️', '🌋', '🌊', '💨', '☀️', '🌑', '✨', '🌟', '💫', '💥', '🧨', '💣',
        '⚔️', '🗡️', '🏹', '🪄', '🛡️', '🪓', '🔨', '🩸', '💀', '☠️', '☣️', '🧪', '🩸', '🎯', '👁️', '🔮',
        '⛓️', '🪨', '🪵', '🌿', '🍃', '👑', '💍', '📜', '📖', '🦇', '🐉', '🐺', '🦁', '🐾', '🦅', '🕸️', '🕷️'
      ];
      items = emojis.map(e => ({ icon: e, label: e }));
    } else if (this.currentIconTab === 'monster_emoji') {
      const monsterEmojis = [
        '🐉', '🐲', '🦇', '🐺', '🦁', '🐯', '🐻', '🦅', '🐍', '🕷️', '🦂', '🐗', '👹', '👺', '👻', '💀', '🧟', '🧛',
        '🐾', '🦑', '🐙', '🦕', '🦖', '🦏', '🦍', '🦹', '🧙', '🧝', '🧌', '🧚', '🧞', '🧜'
      ];
      items = monsterEmojis.map(e => ({ icon: e, label: e }));
    } else {
      const datasets = (defaultCustomDatasets || {}) as Record<string, any>;
      const currentDs = datasets[this.currentIconTab];
      if (currentDs && currentDs.items) {
        if (Array.isArray(currentDs.items)) {
          currentDs.items.forEach((item: any) => {
            const itemId = item.id;
            const fullId = `${this.currentIconTab}:${itemId}`;
            items.push({ icon: fullId, label: item.name || itemId });
          });
        } else {
          Object.entries(currentDs.items).forEach(([k, item]: [string, any]) => {
            const realId = (item && item.id) ? item.id : k;
            const fullId = `${this.currentIconTab}:${realId}`;
            items.push({ icon: fullId, label: item?.name || realId });
          });
        }
      }
    }

    const filtered = items.filter(it => {
      if (!searchVal) return true;
      return it.label.toLowerCase().includes(searchVal) || it.icon.toLowerCase().includes(searchVal);
    });

    if (countEl) countEl.textContent = `共 ${filtered.length} 個圖標`;

    filtered.forEach(it => {
      const div = document.createElement('div');
      div.className = 'sw-icon-item';
      div.title = it.label;
      div.innerHTML = `
        <div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
          ${renderUniversalIcon(it.icon, 34)}
        </div>
        <div style="font-size: 0.68rem; color: var(--sw-text-muted); max-width: 58px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;">${it.label}</div>
      `;
      div.addEventListener('click', () => {
        if (this.iconPickerCallback) {
          this.iconPickerCallback(it.icon);
        }
        if (modal) modal.style.display = 'none';
      });
      grid.appendChild(div);
    });
  }

  private async loadSkills(): Promise<void> {
    try {
      const res = await fetch('/api/get-custom-skills');
      if (res.ok) {
        this.skills = await res.json();
      } else {
        this.skills = [];
      }
    } catch (e) {
      console.warn('載入技能失敗，使用預設值', e);
      this.skills = [];
    }

    this.renderSkillList();
    if (this.skills.length > 0) {
      this.selectSkill(this.skills[0].id);
    }
  }

  private renderSkillList(): void {
    const listEl = document.getElementById('sw-skill-list-container');
    const counterEl = document.getElementById('sw-skill-count');
    if (!listEl) return;

    const query = ((document.getElementById('sw-search-input') as HTMLInputElement)?.value || '').toLowerCase().trim();
    const filterCat = (document.getElementById('sw-filter-category') as HTMLSelectElement)?.value || 'ALL';

    const filtered = this.skills.filter(s => {
      if (filterCat !== 'ALL' && s.category !== filterCat) return false;
      if (query && !s.name.toLowerCase().includes(query) && !s.id.toLowerCase().includes(query)) return false;
      return true;
    });

    if (counterEl) counterEl.textContent = this.skills.length.toString();

    listEl.innerHTML = filtered.map(skill => `
      <div class="sw-skill-card ${skill.id === this.currentSkillId ? 'active' : ''}" data-id="${skill.id}">
        <div class="sw-card-icon">${renderUniversalIcon(skill.icon || '🔮', 28)}</div>
        <div class="sw-card-info">
          <div class="sw-card-name">${skill.name}</div>
          <div class="sw-card-meta">
            <span>💧 ${skill.totalMpCost} MP</span>
            <span>⏱️ ${skill.cooldown || 0} CD</span>
            <span>🧩 ${skill.blocks?.length || 0} 積木</span>
          </div>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.sw-skill-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        if (id) this.selectSkill(id);
      });
    });
  }

  private selectSkill(id: string): void {
    this.currentSkillId = id;
    const skill = this.getCurrentSkill();
    const placeholder = document.getElementById('sw-empty-placeholder');
    const form = document.getElementById('sw-editor-form');

    if (!skill) {
      if (placeholder) placeholder.style.display = 'flex';
      if (form) form.style.display = 'none';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (form) form.style.display = 'block';

    (document.getElementById('inp-sw-id') as HTMLInputElement).value = skill.id;
    (document.getElementById('inp-sw-name') as HTMLInputElement).value = skill.name;
    (document.getElementById('inp-sw-icon') as HTMLInputElement).value = skill.icon || '🔮';
    this.updateIconPreview(skill.icon || '🔮');
    (document.getElementById('inp-sw-category') as HTMLSelectElement).value = skill.category || 'MONSTER';
    (document.getElementById('inp-sw-mp') as HTMLInputElement).value = (skill.totalMpCost ?? 20).toString();
    (document.getElementById('inp-sw-cd') as HTMLInputElement).value = (skill.cooldown ?? 0).toString();
    (document.getElementById('inp-sw-desc') as HTMLTextAreaElement).value = skill.description || '';

    this.renderBlocksList();
    this.renderSkillList();
  }

  private getCurrentSkill(): CompositeSkillDefinition | undefined {
    return this.skills.find(s => s.id === this.currentSkillId);
  }

  private renderBlocksList(): void {
    const container = document.getElementById('sw-blocks-list');
    const skill = this.getCurrentSkill();
    if (!container || !skill) return;

    if (!skill.blocks || skill.blocks.length === 0) {
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--sw-text-muted); border: 1px dashed var(--sw-border); border-radius: 8px;">
          尚未配置任何效果積木。請點擊上方「➕ 新增積木」開始編排！
        </div>
      `;
      return;
    }

    container.innerHTML = skill.blocks.map((block, index) => `
      <div class="sw-block-item" data-index="${index}">
        <div class="sw-block-top">
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-weight: 700; color: #fff;">#${index + 1}</span>
            <span class="sw-block-pill pill-when">WHEN: ${block.trigger || 'ACTIVE'}</span>
            <span class="sw-block-pill pill-what">WHAT: ${block.effectType}</span>
            <span class="sw-block-pill pill-if">IF: ${block.condition?.type || 'NONE'}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            ${index > 0 ? `<button class="sw-btn sw-btn-sm btn-block-up" data-index="${index}">⬆️</button>` : ''}
            ${index < skill.blocks.length - 1 ? `<button class="sw-btn sw-btn-sm btn-block-down" data-index="${index}">⬇️</button>` : ''}
            <button class="sw-btn sw-btn-sm sw-btn-danger btn-block-del" data-index="${index}">🗑️</button>
          </div>
        </div>

        <div class="sw-grid-4" style="margin-top: 4px;">
          <div class="sw-form-group">
            <label class="sw-label">觸發時機 (WHEN)</label>
            <select class="sw-select sel-trigger font-mono" data-index="${index}">
              <option value="ACTIVE" ${block.trigger === 'ACTIVE' ? 'selected' : ''}>ACTIVE (主動施放)</option>
              <option value="ON_HIT_TAKEN" ${block.trigger === 'ON_HIT_TAKEN' ? 'selected' : ''}>ON_HIT_TAKEN (受擊觸發)</option>
              <option value="ON_KILL" ${block.trigger === 'ON_KILL' ? 'selected' : ''}>ON_KILL (擊殺觸發)</option>
              <option value="ON_CRIT" ${block.trigger === 'ON_CRIT' ? 'selected' : ''}>ON_CRIT (暴擊觸發)</option>
              <option value="ON_HP_THRESHOLD" ${block.trigger === 'ON_HP_THRESHOLD' ? 'selected' : ''}>ON_HP_THRESHOLD (殘血門檻)</option>
              <option value="ON_TURN_START" ${block.trigger === 'ON_TURN_START' ? 'selected' : ''}>ON_TURN_START (回合開始)</option>
            </select>
          </div>
          <div class="sw-form-group">
            <label class="sw-label">效果類型 (WHAT)</label>
            <select class="sw-select sel-effect font-mono" data-index="${index}">
              <option value="DAMAGE_PHYSICAL" ${block.effectType === 'DAMAGE_PHYSICAL' ? 'selected' : ''}>DAMAGE_PHYSICAL (物理傷害)</option>
              <option value="DAMAGE_MAGICAL" ${block.effectType === 'DAMAGE_MAGICAL' ? 'selected' : ''}>DAMAGE_MAGICAL (魔法傷害)</option>
              <option value="DAMAGE_MIXED" ${block.effectType === 'DAMAGE_MIXED' ? 'selected' : ''}>DAMAGE_MIXED (雙修傷害)</option>
              <option value="DAMAGE_TRUE" ${block.effectType === 'DAMAGE_TRUE' ? 'selected' : ''}>DAMAGE_TRUE (真實傷害)</option>
              <option value="LIFESTEAL" ${block.effectType === 'LIFESTEAL' ? 'selected' : ''}>LIFESTEAL (吸血傷害)</option>
              <option value="MULTI_HIT" ${block.effectType === 'MULTI_HIT' ? 'selected' : ''}>MULTI_HIT (多段連擊)</option>
              <option value="APPLY_STATUS" ${block.effectType === 'APPLY_STATUS' ? 'selected' : ''}>APPLY_STATUS (附加狀態)</option>
              <option value="SET_MARK" ${block.effectType === 'SET_MARK' ? 'selected' : ''}>SET_MARK (附加烙印)</option>
              <option value="DETONATE_MARKS" ${block.effectType === 'DETONATE_MARKS' ? 'selected' : ''}>DETONATE_MARKS (引爆烙印)</option>
              <option value="APPLY_BARRIER" ${block.effectType === 'APPLY_BARRIER' ? 'selected' : ''}>APPLY_BARRIER (護盾)</option>
              <option value="CHAIN_DAMAGE" ${block.effectType === 'CHAIN_DAMAGE' ? 'selected' : ''}>CHAIN_DAMAGE (連鎖彈跳)</option>
              <option value="EXECUTE" ${block.effectType === 'EXECUTE' ? 'selected' : ''}>EXECUTE (斬殺處決)</option>
              <option value="DISPEL" ${block.effectType === 'DISPEL' ? 'selected' : ''}>DISPEL (驅散增益)</option>
              <option value="STEAL_BUFF" ${block.effectType === 'STEAL_BUFF' ? 'selected' : ''}>STEAL_BUFF (竊取增益)</option>
              <option value="DELAYED_BOMB" ${block.effectType === 'DELAYED_BOMB' ? 'selected' : ''}>DELAYED_BOMB (定時炸彈)</option>
              <option value="MP_DRAIN" ${block.effectType === 'MP_DRAIN' ? 'selected' : ''}>MP_DRAIN (抽取魔力)</option>
              <option value="FORCE_ROW_CHANGE" ${block.effectType === 'FORCE_ROW_CHANGE' ? 'selected' : ''}>FORCE_ROW_CHANGE (擊退/拉近)</option>
              <option value="FIELD_EFFECT" ${block.effectType === 'FIELD_EFFECT' ? 'selected' : ''}>FIELD_EFFECT (環境戰場)</option>
              <option value="BUFF_SELF" ${block.effectType === 'BUFF_SELF' ? 'selected' : ''}>BUFF_SELF (自身增益)</option>
              <option value="BUFF_ALLIES" ${block.effectType === 'BUFF_ALLIES' ? 'selected' : ''}>BUFF_ALLIES (全體增益)</option>
              <option value="HEAL" ${block.effectType === 'HEAL' ? 'selected' : ''}>HEAL (治療)</option>
            </select>
          </div>
          <div class="sw-form-group">
            <label class="sw-label">目標範圍 (TARGET)</label>
            <select class="sw-select sel-target font-mono" data-index="${index}">
              <option value="SINGLE_ENEMY" ${block.targetType === TargetType.SINGLE_ENEMY ? 'selected' : ''}>SINGLE_ENEMY (敵方單體)</option>
              <option value="ALL_ENEMIES" ${block.targetType === TargetType.ALL_ENEMIES ? 'selected' : ''}>ALL_ENEMIES (敵方全體)</option>
              <option value="FRONT_ENEMIES" ${block.targetType === TargetType.FRONT_ENEMIES ? 'selected' : ''}>FRONT_ENEMIES (敵方前排)</option>
              <option value="BACK_ENEMY" ${block.targetType === TargetType.BACK_ENEMY ? 'selected' : ''}>BACK_ENEMY (敵方後排)</option>
              <option value="COLUMN" ${block.targetType === TargetType.COLUMN ? 'selected' : ''}>COLUMN (同縱列)</option>
              <option value="SELF" ${block.targetType === TargetType.SELF ? 'selected' : ''}>SELF (自身)</option>
              <option value="ALL_ALLIES" ${block.targetType === TargetType.ALL_ALLIES ? 'selected' : ''}>ALL_ALLIES (我方全體)</option>
              <option value="ALLY_LOWEST_HP" ${block.targetType === TargetType.ALLY_LOWEST_HP ? 'selected' : ''}>ALLY_LOWEST_HP (我方最殘血)</option>
            </select>
          </div>
          <div class="sw-form-group">
            <label class="sw-label">觸發條件 (IF)</label>
            <select class="sw-select sel-cond font-mono" data-index="${index}">
              <option value="NONE" ${(!block.condition || block.condition.type === 'NONE') ? 'selected' : ''}>NONE (無條件必定觸發)</option>
              <option value="TARGET_HP_GTE" ${block.condition?.type === 'TARGET_HP_GTE' ? 'selected' : ''}>TARGET_HP_GTE (目標HP高於)</option>
              <option value="TARGET_HP_LT" ${block.condition?.type === 'TARGET_HP_LT' ? 'selected' : ''}>TARGET_HP_LT (目標HP低於)</option>
              <option value="SELF_HP_LT" ${block.condition?.type === 'SELF_HP_LT' ? 'selected' : ''}>SELF_HP_LT (自身HP低於)</option>
              <option value="TARGET_HAS_STATUS" ${block.condition?.type === 'TARGET_HAS_STATUS' ? 'selected' : ''}>TARGET_HAS_STATUS (目標具有狀態)</option>
              <option value="ALLY_EXISTS" ${block.condition?.type === 'ALLY_EXISTS' ? 'selected' : ''}>ALLY_EXISTS (有隊友存活)</option>
              <option value="NO_ALLY" ${block.condition?.type === 'NO_ALLY' ? 'selected' : ''}>NO_ALLY (無隊友孤軍奮戰)</option>
            </select>
          </div>
        </div>

        <!-- 動態參數配置列 -->
        <div class="sw-grid-4" style="background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px; margin-top: 4px;">
          <div class="sw-form-group">
            <label class="sw-label">倍率 / 係數 (Multiplier)</label>
            <input type="number" step="0.1" class="sw-input inp-mult" data-index="${index}" value="${block.multiplier ?? 1.0}">
          </div>
          <div class="sw-form-group">
            <label class="sw-label">狀態類型 (StatusType / BUFF)</label>
            <input type="text" class="sw-input font-mono inp-status" data-index="${index}" value="${block.statusType || block.buffType || ''}" placeholder="如: BURN / STUN">
          </div>
          <div class="sw-form-group">
            <label class="sw-label">持續回合 (Duration)</label>
            <input type="number" class="sw-input inp-duration" data-index="${index}" value="${block.statusDuration || block.buffDuration || 2}">
          </div>
          <div class="sw-form-group">
            <label class="sw-label">附加機率 / 特殊數值 (Chance/Val)</label>
            <input type="number" step="0.1" class="sw-input inp-chance" data-index="${index}" value="${block.statusChance ?? 1.0}">
          </div>
        </div>
      </div>
    `).join('');

    // 綁定積木內部事件
    container.querySelectorAll('.btn-block-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        if (idx > 0 && skill.blocks) {
          const temp = skill.blocks[idx];
          skill.blocks[idx] = skill.blocks[idx - 1];
          skill.blocks[idx - 1] = temp;
          this.renderBlocksList();
        }
      });
    });

    container.querySelectorAll('.btn-block-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        if (skill.blocks && idx < skill.blocks.length - 1) {
          const temp = skill.blocks[idx];
          skill.blocks[idx] = skill.blocks[idx + 1];
          skill.blocks[idx + 1] = temp;
          this.renderBlocksList();
        }
      });
    });

    container.querySelectorAll('.btn-block-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        if (skill.blocks) {
          skill.blocks.splice(idx, 1);
          this.renderBlocksList();
        }
      });
    });

    const bindBlockProp = (selector: string, prop: keyof EffectBlock, isNum = false) => {
      container.querySelectorAll(selector).forEach(el => {
        el.addEventListener('change', (e) => {
          const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
          if (skill.blocks && skill.blocks[idx]) {
            const val = (e.target as HTMLInputElement).value;
            (skill.blocks[idx] as any)[prop] = isNum ? Number(val) : val;
            this.isDirty = true;
          }
        });
      });
    };

    bindBlockProp('.sel-trigger', 'trigger');
    bindBlockProp('.sel-effect', 'effectType');
    bindBlockProp('.sel-target', 'targetType');
    bindBlockProp('.inp-mult', 'multiplier', true);
    bindBlockProp('.inp-status', 'statusType');
    bindBlockProp('.inp-duration', 'statusDuration', true);
    bindBlockProp('.inp-chance', 'statusChance', true);

    container.querySelectorAll('.sel-cond').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        if (skill.blocks && skill.blocks[idx]) {
          const type = (e.target as HTMLSelectElement).value as SkillConditionType;
          skill.blocks[idx].condition = { type };
          this.isDirty = true;
        }
      });
    });
  }

  private createNewSkill(): void {
    const id = `SKILL_CUSTOM_${Date.now().toString().slice(-4)}`;
    const newSkill: CompositeSkillDefinition = {
      id,
      name: '新自訂技能',
      icon: '✨',
      description: '自訂積木技能描述',
      category: 'MONSTER',
      totalMpCost: 20,
      cooldown: 0,
      blocks: [
        {
          trigger: 'ACTIVE',
          effectType: 'DAMAGE_MAGICAL',
          targetType: TargetType.SINGLE_ENEMY,
          multiplier: 1.2
        }
      ]
    };
    this.skills.push(newSkill);
    this.isDirty = true;
    this.selectSkill(id);
  }

  private duplicateCurrentSkill(): void {
    const cur = this.getCurrentSkill();
    if (!cur) return;
    const copy: CompositeSkillDefinition = JSON.parse(JSON.stringify(cur));
    copy.id = `${cur.id}_COPY`;
    copy.name = `${cur.name} (複製)`;
    this.skills.push(copy);
    this.isDirty = true;
    this.selectSkill(copy.id);
  }

  private deleteCurrentSkill(): void {
    const cur = this.getCurrentSkill();
    if (!cur) return;
    if (!confirm(`確定要刪除技能【${cur.name}】(${cur.id}) 嗎？`)) return;
    this.skills = this.skills.filter(s => s.id !== cur.id);
    this.currentSkillId = this.skills.length > 0 ? this.skills[0].id : null;
    this.isDirty = true;
    this.selectSkill(this.currentSkillId || '');
  }

  private addBlockToCurrentSkill(): void {
    const cur = this.getCurrentSkill();
    if (!cur) return;
    if (!cur.blocks) cur.blocks = [];
    cur.blocks.push({
      trigger: 'ACTIVE',
      effectType: 'DAMAGE_PHYSICAL',
      targetType: TargetType.SINGLE_ENEMY,
      multiplier: 1.0
    });
    this.isDirty = true;
    this.renderBlocksList();
  }

  private async saveToDisk(): Promise<void> {
    try {
      const res = await fetch('/api/save-custom-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: this.skills, note: '使用者在技能工坊儲存' })
      });
      const data = await res.json();
      if (data.success) {
        this.isDirty = false;
        alert(`💾 儲存成功！已永久寫入專案磁碟 (共 ${this.skills.length} 個技能)，快照: ${data.snapshot}`);
      } else {
        alert(`❌ 儲存失敗: ${data.error}`);
      }
    } catch (e: any) {
      alert(`❌ 寫入錯誤: ${e.message}`);
    }
  }

  private async showHistoryModal(): Promise<void> {
    try {
      const res = await fetch('/api/list-skill-backups');
      const data = await res.json();
      const backups = data.backups || [];
      if (backups.length === 0) {
        alert('目前無歷史快照記錄。');
        return;
      }
      const listStr = backups.slice(0, 10).map((b: any, i: number) => `${i + 1}. [${b.timestamp}] ${b.filename} (${b.note || ''})`).join('\n');
      const choice = prompt(`請輸入要還原的快照序號 (1~${Math.min(10, backups.length)}):\n\n${listStr}`);
      if (!choice) return;
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= backups.length) {
        alert('輸入無效！');
        return;
      }
      const targetBackup = backups[idx];
      const restoreRes = await fetch('/api/restore-skill-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: targetBackup.filename })
      });
      const restoreData = await restoreRes.json();
      if (restoreData.success) {
        alert(`✅ 已成功還原至快照 ${targetBackup.filename}！`);
        await this.loadSkills();
      } else {
        alert(`❌ 還原失敗: ${restoreData.error}`);
      }
    } catch (e: any) {
      alert(`❌ 快照查詢失敗: ${e.message}`);
    }
  }
}

// 瀏覽器載入時自動初始化
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    SkillWorkshop.getInstance().init();
  });
}
