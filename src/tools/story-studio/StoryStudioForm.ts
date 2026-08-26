import { StoryStudioStore } from './StoryStudioStore';
import {
  CONDITION_LABELS,
  defaultCondition,
  defaultEffect,
  EFFECT_LABELS,
  escapeHtml,
  safeId
} from './StoryStudioTypes';
import type { NarrativeCondition, NarrativeEffect, NarrativeNode } from '../../models/Narrative';
import { FactionManager } from '../../systems/FactionManager';
import { DataStore } from '../../systems/DataStore';
import { renderUniversalPortrait, renderUniversalIcon } from '../../ui/IconSpriteHelper';
import defaultCustomDatasets from '../../data/custom_icon_datasets.json';
import { StoryStudioItemPicker } from './StoryStudioItemPicker';
import { StoryStudioSubjugationPicker } from './StoryStudioSubjugationPicker';
import { TRADE_GOODS } from '../../systems/MarketSystem';
import materialsJson from '../../data/materials.json';
import equipmentWeaponsJson from '../../data/equipment_weapons.json';
import equipmentArmorsJson from '../../data/equipment_armors.json';
import equipmentAccessoriesJson from '../../data/equipment_accessories.json';

export class StoryStudioForm {
  private store: StoryStudioStore;
  private isPopulating: boolean = false;

  constructor(store: StoryStudioStore) {
    this.store = store;
  }

  private getFactionOptions(): { value: string; label: string }[] {
    return FactionManager.getAllFactions().map(f => ({
      value: f.id,
      label: `${f.factionName} (${f.id})`
    }));
  }

  public mount(): void {
    this.bindStaticListeners();
    this.store.subscribe('nodeSelected', () => {
      this.populateForm();
    });
    this.store.subscribe('storySelected', () => {
      this.populateStoryMeta();
      this.populateForm();
    });
    this.store.subscribe('storiesLoaded', () => {
      this.populateStoryMeta();
      this.populateForm();
    });
  }

  private byId<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as unknown as T;
  }

  private setValue(id: string, val: string | number): void {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el) el.value = String(val ?? '');
  }

  private value(id: string): string {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    return el ? el.value.trim() : '';
  }

  private numberValue(id: string): number {
    return Number(this.value(id)) || 0;
  }

  public populateStoryMeta(): void {
    const story = this.store.getActiveStory();
    this.setValue('story-editor-story-title', story?.title ?? '');
    this.setValue('story-editor-story-summary', story?.summary ?? '');
    const enabledInput = this.byId<HTMLInputElement>('story-editor-story-enabled');
    if (enabledInput) enabledInput.checked = !!story?.enabled;
  }

  public populateForm(): void {
    const node = this.store.getActiveNode();
    const emptyEl = this.byId('story-editor-empty');
    const formEl = this.byId('story-editor-node-form');

    if (emptyEl) emptyEl.hidden = !!node;
    if (formEl) formEl.hidden = !node;
    if (!node) return;

    this.isPopulating = true;
    try {
      if (!node.choices) node.choices = [];
      if (!node.dialoguePages) node.dialoguePages = [];

      this.setValue('story-node-id', node.id);
      this.setValue('story-node-channel', node.channel);
      this.setValue('story-node-title', node.title);
      this.setValue('story-node-description', node.description);
      this.setValue('story-node-target-map', node.targetNodeId ?? '');
      this.setValue('story-node-npc-name', node.npcName ?? '');
      this.setValue('story-node-npc-avatar', node.npcAvatar ?? 'npc:npc_0');

      const avatarPreview = this.byId('story-node-npc-avatar-preview');
      if (avatarPreview) {
        avatarPreview.innerHTML = renderUniversalPortrait(node.npcAvatar || 'npc:npc_0', 32);
      }

      const repeatBox = this.byId<HTMLInputElement>('story-node-bounty-repeatable');
      if (repeatBox) repeatBox.checked = !!node.repeatable;
      this.setValue('story-node-bounty-cooldown', node.cooldownDays ?? 3);
      this.setValue('story-node-bounty-duration', node.bounty?.duration ?? 2);
      this.setValue('story-node-bounty-expire', node.bounty?.expireDays ?? 4);
      this.setValue('story-node-bounty-gold', node.bounty?.gold ?? 50);
      this.setValue('story-node-bounty-exp', node.bounty?.exp ?? 30);
      this.setValue('story-node-bounty-type', node.bounty?.type ?? 'NORMAL');

      const bountyFields = this.byId('story-editor-bounty-fields');
      if (bountyFields) bountyFields.hidden = node.channel !== 'BOUNTY_BOARD';
      const mapFields = this.byId('story-editor-map-target-fields');
      if (mapFields) mapFields.hidden = node.channel !== 'STORY_NODE';

      this.renderDialoguePagesList(node);
      this.renderConditionList(node);
      this.renderEffectList('story-node-effects-list', node.completionEffects, fx => {
        node.completionEffects = fx;
        this.store.autoSaveDraft();
        this.store.emit('validationChanged');
      });
      this.renderChoicesList(node);
    } finally {
      this.isPopulating = false;
    }
  }

  private handleNodeIdChange(): void {
    if (this.isPopulating) return;
    const story = this.store.getActiveStory();
    const node = this.store.getActiveNode();
    if (!story || !node) return;

    const oldId = node.id;
    const rawVal = this.value('story-node-id');
    const newId = safeId(rawVal);

    if (!newId || newId === oldId) {
      this.setValue('story-node-id', oldId);
      return;
    }

    // 唯一性防撞檢查：禁止撞名
    const isDuplicate = story.nodes.some(n => n !== node && n.id === newId);
    if (isDuplicate) {
      alert(`⚠️ 節點代號「${newId}」已存在於故事【${story.title}】中！\n請使用其他唯一的節點代號以避免節點混淆與同化。`);
      this.setValue('story-node-id', oldId);
      return;
    }

    // 遷移座標
    if (this.store.graphPositions[oldId]) {
      this.store.graphPositions[newId] = this.store.graphPositions[oldId];
      delete this.store.graphPositions[oldId];
      this.store.saveGraphPos(story.id);
    }

    // 自動遷移故事內其他節點對此 ID 的引用（如排程與討伐）
    for (const other of story.nodes) {
      for (const fx of [...other.completionEffects, ...other.choices.flatMap(c => c.effects)]) {
        if (fx.type === 'SCHEDULE_NODE' && fx.nodeId === oldId) fx.nodeId = newId;
        if (fx.type === 'CREATE_SUBJUGATION_NODE') {
          if (fx.definition.victoryNodeId === oldId) fx.definition.victoryNodeId = newId;
          if (fx.definition.defeatNodeId === oldId) fx.definition.defeatNodeId = newId;
          if (fx.definition.journeyNodeIds) {
            fx.definition.journeyNodeIds = fx.definition.journeyNodeIds.map(jId => jId === oldId ? newId : jId);
          }
        }
      }
    }

    node.id = newId;
    this.store.selectedNodeId = newId;
    this.store.autoSaveDraft();
    this.store.emit('storyUpdated');
    this.store.emit('nodeSelected');
    this.store.emit('validationChanged');
  }

  private syncActiveNodeField(): void {
    if (this.isPopulating) return;
    const node = this.store.getActiveNode();
    if (!node) return;

    node.channel = this.byId<HTMLSelectElement>('story-node-channel').value as NarrativeNode['channel'];
    node.title = this.value('story-node-title') || node.id;
    node.description = this.value('story-node-description');
    node.npcName = this.value('story-node-npc-name') || undefined;
    node.npcAvatar = this.value('story-node-npc-avatar') || undefined;
    node.targetNodeId = node.channel === 'STORY_NODE' ? this.value('story-node-target-map') || undefined : undefined;
    node.repeatable = node.channel === 'BOUNTY_BOARD' ? this.byId<HTMLInputElement>('story-node-bounty-repeatable')?.checked : undefined;
    node.cooldownDays = node.channel === 'BOUNTY_BOARD' && node.repeatable ? Math.max(0, this.numberValue('story-node-bounty-cooldown')) : undefined;
    node.bounty = node.channel === 'BOUNTY_BOARD' ? {
      duration: Math.max(1, this.numberValue('story-node-bounty-duration')),
      expireDays: Math.max(1, this.numberValue('story-node-bounty-expire')),
      gold: Math.max(0, this.numberValue('story-node-bounty-gold')),
      exp: Math.max(0, this.numberValue('story-node-bounty-exp')),
      type: (this.byId<HTMLSelectElement>('story-node-bounty-type')?.value || 'NORMAL') as 'NORMAL' | 'BANDIT'
    } : undefined;

    const bountyFields = this.byId('story-editor-bounty-fields');
    if (bountyFields) bountyFields.hidden = node.channel !== 'BOUNTY_BOARD';
    const mapFields = this.byId('story-editor-map-target-fields');
    if (mapFields) mapFields.hidden = node.channel !== 'STORY_NODE';

    this.store.autoSaveDraft();
    this.store.emit('storyUpdated');
    this.store.emit('validationChanged');
  }

  private renderDialoguePagesList(node: NarrativeNode): void {
    const container = this.byId('story-node-dialogue-pages-list') || this.byId('story-node-dialogue-pages');
    if (!container) return;
    container.innerHTML = '';
    if (!node.dialoguePages || node.dialoguePages.length === 0) {
      container.innerHTML = '<div style="color:#6b6050; font-size:.78rem; padding:4px 0;">目前無多段對話分頁（遊戲中將以純文字事件框呈現）。</div>';
      return;
    }

    node.dialoguePages.forEach((page, index) => {
      const card = document.createElement('div');
      card.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 10px; margin-bottom: 6px;';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-weight: bold; font-size: 0.82rem; color: #fde68a;">第 ${index + 1} 段對話</span>
          <button type="button" class="action-btn story-danger" data-remove-page style="padding: 2px 8px; font-size: 0.72rem;">刪除</button>
        </div>
        <div class="story-editor-pair">
          <label>說話者類型
            <select data-speaker-type>
              <option value="NPC"${page.speakerType === 'NPC' ? ' selected' : ''}>💬 NPC 訪客</option>
              <option value="PLAYER_GUARDIAN"${page.speakerType === 'PLAYER_GUARDIAN' ? ' selected' : ''}>👑 玩家誓約守衛</option>
            </select>
          </label>
          <div data-guardian-tip style="${page.speakerType === 'PLAYER_GUARDIAN' ? 'display:flex;' : 'display:none;'} align-items:center; color:#fde68a; font-size:0.78rem; background:rgba(217,119,6,0.15); border:1px dashed #d97706; border-radius:4px; padding:6px 10px;">
            👑 說話者名稱與立繪將自動連結玩家命名的誓約守衛
          </div>
          <label data-npc-title-field style="${page.speakerType === 'PLAYER_GUARDIAN' ? 'display:none;' : ''}">說話者稱號/身份<input data-speaker-title type="text" value="${escapeHtml(page.speakerTitle ?? '')}" placeholder="例：【街角遇見的旅人】"></label>
        </div>
        <div class="story-editor-pair" data-npc-fields style="${page.speakerType === 'PLAYER_GUARDIAN' ? 'display:none;' : ''}">
          <label>說話者名稱<input data-speaker-name type="text" value="${escapeHtml(page.speakerName ?? '')}" placeholder="例：神秘學者"></label>
          <label>肖像圖標
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <div data-page-avatar-preview style="width: 28px; height: 52px; border-radius: 4px; border: 1px solid #d97706; overflow: hidden; background: #0c0a09; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${renderUniversalPortrait(page.speakerAvatar || 'npc:npc_0', 28)}
              </div>
              <button type="button" class="action-btn" data-btn-pick-page-avatar style="flex: 1; padding: 5px 8px; font-size: 0.75rem; background: rgba(217, 119, 6, 0.2); border-color: rgba(217, 119, 6, 0.4); color: #fbbf24;">🔍 挑選肖像</button>
            </div>
          </label>
        </div>
        <label style="margin-top: 6px;">對話內容<textarea data-page-text rows="2">${escapeHtml(page.text)}</textarea></label>
      `;

      card.querySelector<HTMLSelectElement>('[data-speaker-type]')!.addEventListener('change', e => {
        page.speakerType = (e.target as HTMLSelectElement).value as any;
        const npcFields = card.querySelector<HTMLElement>('[data-npc-fields]');
        const npcTitleField = card.querySelector<HTMLElement>('[data-npc-title-field]');
        const guardianTip = card.querySelector<HTMLElement>('[data-guardian-tip]');
        if (npcFields) npcFields.style.display = page.speakerType === 'PLAYER_GUARDIAN' ? 'none' : 'grid';
        if (npcTitleField) npcTitleField.style.display = page.speakerType === 'PLAYER_GUARDIAN' ? 'none' : 'block';
        if (guardianTip) guardianTip.style.display = page.speakerType === 'PLAYER_GUARDIAN' ? 'flex' : 'none';
        this.store.autoSaveDraft();
      });
      card.querySelector<HTMLInputElement>('[data-speaker-name]')!.addEventListener('input', e => {
        page.speakerName = (e.target as HTMLInputElement).value;
        this.store.autoSaveDraft();
      });
      card.querySelector<HTMLInputElement>('[data-speaker-title]')!.addEventListener('input', e => {
        page.speakerTitle = (e.target as HTMLInputElement).value;
        this.store.autoSaveDraft();
      });
      card.querySelector('[data-btn-pick-page-avatar]')!.addEventListener('click', () => {
        this.openAvatarPicker(avatarId => {
          page.speakerAvatar = avatarId;
          const prev = card.querySelector<HTMLElement>('[data-page-avatar-preview]');
          if (prev) prev.innerHTML = renderUniversalPortrait(avatarId, 28);
          this.store.autoSaveDraft();
        });
      });
      card.querySelector<HTMLTextAreaElement>('[data-page-text]')!.addEventListener('input', e => {
        page.text = (e.target as HTMLTextAreaElement).value;
        this.store.autoSaveDraft();
      });
      card.querySelector('[data-remove-page]')!.addEventListener('click', () => {
        node.dialoguePages!.splice(index, 1);
        this.renderDialoguePagesList(node);
        this.store.autoSaveDraft();
      });

      container.appendChild(card);
    });
  }

  private renderConditionList(node: NarrativeNode): void {
    const container = this.byId('story-node-conditions-list');
    if (!container) return;
    container.innerHTML = '';
    node.conditions.forEach((condition, index) => {
      const row = document.createElement('div');
      row.className = 'story-condition-row';
      row.innerHTML = `
        <div class="story-condition-head">
          <select data-condition-type>
            ${Object.entries(CONDITION_LABELS).map(([type, label]) => `<option value="${type}"${type === condition.type ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
          <button type="button" class="action-btn story-danger" data-remove>刪除</button>
        </div>
        <div class="story-condition-fields">${this.conditionFields(condition)}</div>
      `;

      row.querySelector<HTMLSelectElement>('[data-condition-type]')!.addEventListener('change', event => {
        node.conditions[index] = defaultCondition((event.target as HTMLSelectElement).value as NarrativeCondition['type']);
        this.renderConditionList(node);
        this.store.autoSaveDraft();
        this.store.emit('validationChanged');
      });
      row.querySelector('[data-remove]')!.addEventListener('click', () => {
        node.conditions.splice(index, 1);
        this.renderConditionList(node);
        this.store.autoSaveDraft();
        this.store.emit('validationChanged');
      });
      row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach(field => {
        field.addEventListener('input', () => {
          (condition as any)[field.dataset.field!] = field instanceof HTMLInputElement && field.type === 'number'
            ? Number(field.value) || 0
            : field.value;
          this.store.autoSaveDraft();
          this.store.emit('validationChanged');
        });
      });
      container.appendChild(row);
    });
  }

  private conditionFields(condition: NarrativeCondition): string {
    const input = (label: string, field: string, val: any, type: string = 'text', list: string = '') =>
      `<label>${label}<input data-field="${field}" type="${type}" value="${escapeHtml(String(val ?? ''))}"${list ? ` list="${list}"` : ''}></label>`;
    const select = (label: string, field: string, current: string, options: { value: string; label: string }[]) =>
      `<label>${label}<select data-field="${field}">${options.map(o => `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${o.label}</option>`).join('')}</select></label>`;

    switch (condition.type) {
      case 'DAY_AT_LEAST': case 'TAVERN_LEVEL_AT_LEAST': case 'PRESTIGE_AT_LEAST': return input('門檻數值', 'value', condition.value, 'number');
      case 'GOLD_AT_LEAST': return input('金幣門檻', 'value', condition.value, 'number');
      case 'FACTION_FAVOR_AT_LEAST': case 'FACTION_FAVOR_AT_MOST':
        return `${select('目標派系', 'factionId', condition.factionId, this.getFactionOptions())}${input('好感度門檻 (-100~100)', 'value', condition.value, 'number')}`;
      case 'FACT_EXISTS': case 'FACT_MISSING': return input('線索代號', 'fact', condition.fact, 'text', 'story-fact-datalist');
      case 'DAYS_SINCE_FACT': return `${input('線索代號', 'fact', condition.fact, 'text', 'story-fact-datalist')}${input('等待天數', 'value', condition.value, 'number')}`;
      case 'NODE_EXPLORED': return input('地圖節點 ID', 'nodeId', condition.nodeId);
      case 'SUBJUGATION_COUNT_AT_LEAST': return input('最少討伐數（動態據點）', 'value', condition.value, 'number');
    }
  }

  private renderEffectList(id: string, effects: NarrativeEffect[], setter: (effects: NarrativeEffect[]) => void): void {
    const container = this.byId(id);
    if (!container) return;
    container.innerHTML = '';
    effects.forEach((effect, index) => {
      const row = document.createElement('div');
      row.className = 'story-effect-row';
      row.innerHTML = `<div class="story-effect-head"><select data-effect-type>${Object.entries(EFFECT_LABELS).map(([type, label]) => `<option value="${type}"${type === effect.type ? ' selected' : ''}>${label}</option>`).join('')}</select><button type="button" class="action-btn story-danger" data-remove>刪除</button></div><div class="story-effect-fields">${this.effectFields(effect)}</div>`;
      row.querySelector<HTMLSelectElement>('[data-effect-type]')!.addEventListener('change', event => {
        const next = [...effects];
        next[index] = defaultEffect((event.target as HTMLSelectElement).value as NarrativeEffect['type']);
        setter(next);
        this.renderEffectList(id, next, setter);
      });
      row.querySelector('[data-remove]')!.addEventListener('click', () => {
        const next = effects.filter((_, effectIndex) => effectIndex !== index);
        setter(next);
        this.renderEffectList(id, next, setter);
      });

      // 綁定物品挑選器按鈕
      row.querySelectorAll<HTMLButtonElement>('[data-btn-pick-item]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.btnPickItem as any;
          StoryStudioItemPicker.getInstance().open(cat, (picked) => {
            if (cat === 'MATERIAL') {
              (effect as any).itemId = picked.id;
            } else if (cat === 'TRADE_GOOD') {
              (effect as any).itemId = picked.id;
            } else if (cat === 'EQUIPMENT') {
              (effect as any).templateId = picked.id;
            }
            setter([...effects]);
            this.renderEffectList(id, effects, setter);
          });
        });
      });

      // 綁定攻城梯隊新增按鈕
      row.querySelectorAll<HTMLButtonElement>('[data-btn-add-siege-wave]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (effect.type === 'TRIGGER_RAID') {
            const waves = effect.waves || [];
            waves.push({ waveIndex: waves.length + 1, templateId: 'bandit_camp', customName: `進攻梯隊 #${waves.length + 1}` });
            effect.waves = waves;
            setter([...effects]);
            this.renderEffectList(id, effects, setter);
          }
        });
      });

      // 綁定攻城梯隊據點挑選器按鈕
      row.querySelectorAll<HTMLButtonElement>('[data-btn-pick-siege-subjugation]').forEach(btn => {
        btn.addEventListener('click', () => {
          const wIdx = Number(btn.dataset.btnPickSiegeSubjugation);
          StoryStudioSubjugationPicker.getInstance().open((pickedTpl) => {
            if (effect.type === 'TRIGGER_RAID' && effect.waves && effect.waves[wIdx]) {
              effect.waves[wIdx].templateId = pickedTpl.id;
              effect.waves[wIdx].customName = pickedTpl.name;
              setter([...effects]);
              this.renderEffectList(id, effects, setter);
            }
          });
        });
      });

      // 綁定攻城梯隊移除按鈕
      row.querySelectorAll<HTMLButtonElement>('[data-btn-remove-siege-wave]').forEach(btn => {
        btn.addEventListener('click', () => {
          const wIdx = Number(btn.dataset.btnRemoveSiegeWave);
          if (effect.type === 'TRIGGER_RAID' && effect.waves) {
            effect.waves.splice(wIdx, 1);
            effect.waves.forEach((w, idx) => { w.waveIndex = idx + 1; });
            setter([...effects]);
            this.renderEffectList(id, effects, setter);
          }
        });
      });

      row.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field]').forEach(field => {
        field.addEventListener('input', () => {
          const key = field.dataset.field!;
          const target = key.startsWith('definition.') ? (effect as any).definition : effect as any;
          const property = key.replace('definition.', '');
          target[property] = field instanceof HTMLInputElement && field.type === 'checkbox'
            ? field.checked
            : field instanceof HTMLInputElement && field.type === 'number'
              ? Number(field.value) || 0
              : property === 'journeyNodeIds'
                ? field.value.split(',').map(item => item.trim()).filter(Boolean)
                : field.value;

          if (property === 'templateId' || property === 'definition.templateId') {
            const templateId = field.value;
            const tpl = DataStore.getSubjugationTemplates().find(s => s.id === templateId);
            if (tpl) {
              const def = ((target as any).definition || target);
              def.templateId = tpl.id;
              def.nodeId = tpl.id;
              def.name = tpl.name;
              def.description = tpl.description;
              def.terrain = tpl.terrain;
              def.difficulty = tpl.difficulty;
              def.requiresScouting = !!tpl.requiresScouting;
              def.removeOnVictory = tpl.removeOnVictory !== false;
            }
            this.renderEffectList(id, effects, setter);
          }

          setter([...effects]);
          if (property === 'mode') this.renderEffectList(id, effects, setter);
        });
      });
      container.appendChild(row);
    });
  }

  private effectFields(effect: NarrativeEffect): string {
    const input = (label: string, field: string, val: any, type: string = 'text', list: string = '') =>
      `<label>${label}<input data-field="${field}" type="${type}" value="${escapeHtml(String(val ?? ''))}"${list ? ` list="${list}"` : ''}></label>`;
    const select = (label: string, field: string, current: string, options: { value: string; label: string }[]) =>
      `<label>${label}<select data-field="${field}">${options.map(o => `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${o.label}</option>`).join('')}</select></label>`;

    switch (effect.type) {
      case 'SET_FACT': return `${input('線索代號', 'fact', effect.fact, 'text', 'story-fact-datalist')}${input('值 (true/false/文字/數字)', 'value', effect.value)}`;
      case 'ADD_GOLD': return input('金幣變化量（負數為扣除）', 'value', effect.value, 'number');
      case 'ADD_PRESTIGE': return input('聲望變化量（負數為扣除）', 'value', effect.value, 'number');
      case 'ADD_RESTED_EXP': return input('經驗池獎勵量', 'value', effect.value, 'number');
      case 'CHANGE_FACTION_FAVOR': return `${select('目標派系', 'factionId', effect.factionId, this.getFactionOptions())}${input('好感度增減量', 'value', effect.value, 'number')}`;
      case 'GRANT_MATERIAL': {
        const mat = (materialsJson as any[]).find(m => m.id === effect.itemId) || DataStore.MaterialDB[effect.itemId];
        const display = mat ? `${mat.name} (${mat.id})` : (effect.itemId || '尚未選擇素材');
        const iconHtml = mat ? renderUniversalIcon(mat.icon || '💎', 26) : '💎';
        return `
          <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:4px;">
            <div style="font-size:0.78rem; color:#a8a29e; display:flex; align-items:center; gap:6px;">
              <span>素材項目：</span>
              <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                ${iconHtml}
                <strong style="color:#fde68a;">${escapeHtml(display)}</strong>
              </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="action-btn" data-btn-pick-item="MATERIAL" style="padding:5px 12px; font-size:0.78rem; background:#d97706; color:#fff; border-color:#f59e0b; font-weight:bold; cursor:pointer;">🔍 挑選素材</button>
              <input data-field="itemId" type="hidden" value="${escapeHtml(effect.itemId || '')}">
              <div style="flex:1;">${input('數量', 'quantity', effect.quantity, 'number')}</div>
            </div>
          </div>
        `;
      }
      case 'GRANT_TRADE_GOOD': {
        const tg = TRADE_GOODS.find(g => g.id === effect.itemId);
        const display = tg ? `${tg.name} (${tg.id})` : (effect.itemId || '尚未選擇特產');
        const iconHtml = tg ? renderUniversalIcon(tg.icon || '🍷', 26) : '🍷';
        return `
          <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:4px;">
            <div style="font-size:0.78rem; color:#a8a29e; display:flex; align-items:center; gap:6px;">
              <span>特產項目：</span>
              <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                ${iconHtml}
                <strong style="color:#fde68a;">${escapeHtml(display)}</strong>
              </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="action-btn" data-btn-pick-item="TRADE_GOOD" style="padding:5px 12px; font-size:0.78rem; background:#d97706; color:#fff; border-color:#f59e0b; font-weight:bold; cursor:pointer;">🔍 挑選特產</button>
              <input data-field="itemId" type="hidden" value="${escapeHtml(effect.itemId || '')}">
              <div style="flex:1;">${input('數量', 'quantity', effect.quantity, 'number')}</div>
            </div>
          </div>
        `;
      }
      case 'GRANT_EQUIPMENT': {
        const allEq = [...(equipmentWeaponsJson as any[]), ...(equipmentArmorsJson as any[]), ...(equipmentAccessoriesJson as any[])];
        const eq = allEq.find(e => e.id === effect.templateId);
        const display = eq ? `${eq.name} (${eq.id})` : (effect.templateId || '尚未指定裝備');
        const iconHtml = eq ? renderUniversalIcon(eq.icon || '⚔️', 26) : '⚔️';
        return `
          <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:4px;">
            <div style="font-size:0.78rem; color:#a8a29e; display:flex; align-items:center; gap:6px;">
              <span>指定裝備：</span>
              <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.08);">
                ${iconHtml}
                <strong style="color:#fde68a;">${escapeHtml(display)}</strong>
              </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="action-btn" data-btn-pick-item="EQUIPMENT" style="padding:5px 12px; font-size:0.78rem; background:#d97706; color:#fff; border-color:#f59e0b; font-weight:bold; cursor:pointer;">🔍 挑選裝備庫</button>
              <input data-field="templateId" type="text" value="${escapeHtml(effect.templateId || '')}" placeholder="或手動填入裝備 ID" style="flex:1; font-size:0.78rem;">
              <div style="width:75px;">${input('數量', 'quantity', effect.quantity, 'number')}</div>
            </div>
          </div>
        `;
      }
      case 'SCHEDULE_NODE': return `${input('目標故事節點 ID', 'nodeId', effect.nodeId)}${input('等待天數', 'delayDays', effect.delayDays, 'number')}`;
      case 'UNLOCK_MAP_NODE': return input('解鎖地圖節點 ID', 'nodeId', effect.nodeId);
      case 'REMOVE_MAP_NODE': {
        const allTemplates = DataStore.getSubjugationTemplates();
        const templateOptions = [
          { value: '', label: '-- 或選擇討伐據點範本 ID --' },
          ...allTemplates.map(tpl => ({
            value: tpl.id,
            label: `🏰 ${tpl.name}（${tpl.id}）`
          }))
        ];
        return `
          ${input('欲移除的地圖據點代號 (Node ID)', 'nodeId', effect.nodeId)}
          ${select('快速選取據點範本 ID', 'nodeId', effect.nodeId, templateOptions)}
        `;
      }
      case 'REDUCE_POPULATION_PERCENT': {
        return `
          <div style="display:flex; gap:8px;">
            <label style="flex:1;">最小扣除百分比 (%)<input data-field="minPercent" type="number" value="${effect.minPercent ?? 10}"></label>
            <label style="flex:1;">最大扣除百分比 (%)<input data-field="maxPercent" type="number" value="${effect.maxPercent ?? 20}"></label>
          </div>
          <div style="font-size:0.72rem; color:#fde68a;">⚠️ 觸發時將在 ${effect.minPercent ?? 10}% ~ ${effect.maxPercent ?? 20}% 範圍內隨機抽籤扣除領民</div>
        `;
      }
      case 'REDUCE_RESOURCE_PERCENT': {
        const resOptions = [
          { value: 'GOLD', label: '💰 金幣庫存' },
          { value: 'FOOD', label: '🌾 糧食庫存' },
          { value: 'WOOD', label: '🌲 木材庫存' },
          { value: 'STONE', label: '🧱 石材庫存' },
          { value: 'IRON', label: '🔗 鐵礦庫存' },
          { value: 'ALL', label: '📦 全資源庫存' }
        ];
        return `
          ${select('扣除資源種類', 'resource', effect.resource || 'GOLD', resOptions)}
          <div style="display:flex; gap:8px;">
            <label style="flex:1;">最小扣除 (%)<input data-field="minPercent" type="number" value="${effect.minPercent ?? 15}"></label>
            <label style="flex:1;">最大扣除 (%)<input data-field="maxPercent" type="number" value="${effect.maxPercent ?? 30}"></label>
          </div>
        `;
      }
      case 'REDUCE_PRESTIGE_PERCENT': {
        return `
          <div style="display:flex; gap:8px;">
            <label style="flex:1;">最小聲望扣除 (%)<input data-field="minPercent" type="number" value="${effect.minPercent ?? 10}"></label>
            <label style="flex:1;">最大聲望扣除 (%)<input data-field="maxPercent" type="number" value="${effect.maxPercent ?? 20}"></label>
          </div>
        `;
      }
      case 'REDUCE_BUILDING_LEVEL': {
        const bOptions = [
          { value: 'defense', label: '🏰 哨所/防衛 (defense)' },
          { value: 'tavern', label: '🍺 酒館 (tavern)' },
          { value: 'forge', label: '🔨 鐵匠鋪 (forge)' },
          { value: 'weapon', label: '⚔️ 武器店 (weapon)' },
          { value: 'armor', label: '🛡️ 防具店 (armor)' },
          { value: 'farmland', label: '🌾 農田 (farmland)' },
          { value: 'lumberMill', label: '🪓 伐木場 (lumberMill)' },
          { value: 'quarry', label: '⛏️ 採石場 (quarry)' },
          { value: 'huntingGround', label: '🏹 獵場 (huntingGround)' }
        ];
        return `
          ${select('受損目標建築', 'buildingId', effect.buildingId || 'defense', bOptions)}
          ${input('降低等級數', 'levels', effect.levels ?? 1, 'number')}
        `;
      }
      case 'TRIGGER_RAID': {
        const waves = (effect.waves && effect.waves.length > 0)
          ? effect.waves
          : [{ waveIndex: 1, templateId: 'bandit_camp', customName: '敵方先鋒部隊' }];
        effect.waves = waves;
        const isSiege = effect.isSiege !== false; // 預設為 true

        const allTemplates = DataStore.getSubjugationTemplates();

        const wavesHtml = waves.map((w, wIdx) => {
          const tpl = allTemplates.find(t => t.id === w.templateId);
          const icon = tpl?.icon || 'icons_buildings:icons_buildings_3';
          const iconHtml = renderUniversalIcon(icon, 28);
          const tplName = tpl ? `${tpl.name} (${tpl.id})` : w.templateId;
          const monsterCount = tpl?.waves?.reduce((acc, mw) => acc + (mw.monsters?.length || 0), 0) || 0;
          const diffStars = '⭐'.repeat(Math.min(5, Math.max(1, tpl?.difficulty || 1)));

          return `
            <div style="background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 8px; margin-top: 6px; box-sizing: border-box;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a; padding-bottom: 5px; margin-bottom: 6px;">
                <span style="font-weight: bold; color: #c084fc; font-size: 0.82rem;">🚩 第 ${wIdx + 1} 梯隊</span>
                <div style="display: flex; gap: 4px; align-items: center;">
                  <button type="button" class="action-btn" data-btn-pick-siege-subjugation="${wIdx}" style="padding: 2px 8px; font-size: 0.75rem; background: #8b5cf6; color: #fff; border-radius: 4px; border: none; cursor: pointer; white-space: nowrap;">🔍 挑選據點</button>
                  <button type="button" class="action-btn story-danger" data-btn-remove-siege-wave="${wIdx}" style="padding: 2px 6px; font-size: 0.75rem; background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; line-height: 1;" title="移除梯隊"${waves.length <= 1 ? ' disabled' : ''}>✕</button>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="background: rgba(0,0,0,0.4); padding: 2px; border-radius: 4px; flex-shrink: 0;">${iconHtml}</div>
                <div style="min-width: 0; flex: 1;">
                  <div style="font-weight: bold; color: #fde047; font-size: 0.85rem; word-break: break-all; line-height: 1.2;">${escapeHtml(tplName)}</div>
                  <div style="font-size: 0.72rem; color: #a1a1aa; margin-top: 2px;">難度 ${diffStars} · 敵軍 ${monsterCount} 體</div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="wide" style="grid-column: 1 / -1; width: 100%; background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.3); border-radius: 8px; padding: 10px; margin-top: 4px; box-sizing: border-box;">
            <div style="font-weight: bold; color: #c084fc; font-size: 0.88rem; margin-bottom: 6px;">⚔️ 領地戰役與梯隊配置</div>
            ${input('戰役名稱', 'raidName', effect.raidName || '黑狼軍團圍城戰')}
            
            <label style="display: flex; align-items: flex-start; gap: 8px; margin: 8px 0; background: rgba(0,0,0,0.35); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(234,179,8,0.25); cursor: pointer;">
              <input data-field="isSiege" type="checkbox" ${isSiege ? 'checked' : ''} style="margin-top: 3px; accent-color: #eab308;">
              <div>
                <span style="font-weight: bold; color: #fbbf24; font-size: 0.85rem;">🏰 啟用正規攻城戰屬性 (Siege Defense)</span>
                <div style="font-size: 0.73rem; color: #94a3b8; margin-top: 2px;">
                  勾選 = 具備城牆掩體、箭塔砲擊支援與兵種軍團調派。<br>
                  未勾選 = 街巷／室內突襲遭遇戰（無城防與兵種支援，由傭兵守軍直接迎敵）。
                </div>
              </div>
            </label>

            ${input('預警行軍天數 (0=立即圍城開打, 1~7=野外可迎擊天數)', 'warningDays', effect.warningDays ?? 3, 'number')}
            
            <div style="margin-top: 10px;">
              <div style="font-size: 0.8rem; font-weight: bold; color: #e2e8f0; margin-bottom: 4px;">進攻梯隊清單 (Wave 1~N):</div>
              <div class="siege-waves-container">
                ${wavesHtml}
              </div>
              <button type="button" class="action-btn" data-btn-add-siege-wave style="width: 100%; margin-top: 8px; padding: 6px 0; font-size: 0.8rem; background: #6d28d9; color: #fff; border-radius: 6px; border: 1px solid #8b5cf6; cursor: pointer; font-weight: bold;">➕ 新增進攻梯隊</button>
            </div>

            <div style="margin-top: 10px;">
              ${input('守城大捷跳轉節點 ID', 'successNodeId', effect.successNodeId || '')}
              ${input('城防失守跳轉節點 ID', 'failNodeId', effect.failNodeId || '')}
            </div>
          </div>
        `;
      }
      case 'CREATE_SUBJUGATION_NODE': {
        const d = effect.definition;
        const allTemplates = DataStore.getSubjugationTemplates();
        const templateOptions = [
          { value: '', label: '-- 請選擇已創作的討伐據點 --' },
          ...allTemplates.map(tpl => ({
            value: tpl.id,
            label: `🏰 ${tpl.name}（${tpl.id} / 難度 ${tpl.difficulty}）`
          }))
        ];
        return `
          ${select('選擇已創作的討伐據點範本', 'definition.templateId', d.templateId || '', templateOptions)}
          ${input('據點名稱 (自訂或沿用範本)', 'definition.name', d.name)}
          <div style="display:flex; gap:8px;">
            <div style="flex:1.5;">${input('勝利觸發節點 ID', 'definition.victoryNodeId', d.victoryNodeId || '')}</div>
            <div style="flex:1;">${input('戰勝延遲天數 (0=立即)', 'definition.victoryDelayDays', d.victoryDelayDays ?? 0, 'number')}</div>
          </div>
          <div style="display:flex; gap:8px;">
            <div style="flex:1.5;">${input('失敗觸發節點 ID', 'definition.defeatNodeId', d.defeatNodeId || '')}</div>
            <div style="flex:1;">${input('戰敗延遲天數 (0=立即)', 'definition.defeatDelayDays', d.defeatDelayDays ?? 0, 'number')}</div>
          </div>
          ${input('途中事件節點 IDs (逗號隔開)', 'definition.journeyNodeIds', (d.journeyNodeIds || []).join(', '))}
        `;
      }
    }
  }

  private renderChoicesList(node: NarrativeNode): void {
    const container = this.byId('story-node-choices-list');
    if (!container) return;
    container.innerHTML = '';
    if (!node.choices || node.choices.length === 0) {
      container.innerHTML = '<div style="color:#6b6050; font-size:.78rem; padding:4px 0;">目前無決策選項（遊戲中將預設為純閱讀「繼續」）。</div>';
      return;
    }

    node.choices.forEach((choice, index) => {
      const card = document.createElement('div');
      card.className = 'story-choice-card';
      card.innerHTML = `
        <div class="story-choice-head">
          <span class="story-choice-title">決策選項 ${index + 1}</span>
          <button type="button" class="action-btn story-danger" data-remove-choice>刪除選項</button>
        </div>
        <label>選項按鈕文字<input data-choice-text type="text" value="${escapeHtml(choice.text)}"></label>
        <label>結果敘述文字<textarea data-choice-result rows="2">${escapeHtml(choice.resultText ?? '')}</textarea></label>
        <div class="story-choice-effects-wrap">
          <div style="font-size:.75rem; color:#fde68a; margin:6px 0 4px; font-weight:700;">選擇後專屬效果／獎勵：</div>
          <div class="story-effect-list compact" id="story-choice-fx-${index}"></div>
          <button type="button" class="action-btn" data-add-choice-fx style="margin-top:4px;">＋ 新增選項效果</button>
        </div>
      `;
      container.appendChild(card);

      card.querySelector<HTMLInputElement>('[data-choice-text]')!.addEventListener('input', e => {
        choice.text = (e.target as HTMLInputElement).value;
        this.store.autoSaveDraft();
      });
      card.querySelector<HTMLTextAreaElement>('[data-choice-result]')!.addEventListener('input', e => {
        choice.resultText = (e.target as HTMLTextAreaElement).value;
        this.store.autoSaveDraft();
      });
      card.querySelector('[data-remove-choice]')!.addEventListener('click', () => {
        node.choices.splice(index, 1);
        this.renderChoicesList(node);
        this.store.autoSaveDraft();
      });
      this.renderEffectList(`story-choice-fx-${index}`, choice.effects, effects => {
        choice.effects = effects;
        this.store.autoSaveDraft();
        this.store.emit('validationChanged');
      });
      card.querySelector('[data-add-choice-fx]')!.addEventListener('click', () => {
        choice.effects.push(defaultEffect());
        this.renderChoicesList(node);
        this.store.autoSaveDraft();
        this.store.emit('validationChanged');
      });
    });
  }

  public openAvatarPicker(onSelect: (avatarId: string) => void): void {
    const modal = this.byId('modal-story-avatar-picker');
    const catSelect = this.byId<HTMLSelectElement>('story-avatar-category-filter');
    const searchInput = this.byId<HTMLInputElement>('story-avatar-search-input');
    const grid = this.byId('story-avatar-picker-grid');
    const btnClose = this.byId('btn-close-story-avatar-picker');
    if (!modal || !catSelect || !searchInput || !grid) return;

    const allDatasets = (defaultCustomDatasets || {}) as Record<string, any>;
    const catKeys = Object.keys(allDatasets);

    catSelect.innerHTML = `<option value="ALL">🌟 全部肖像圖庫 (${catKeys.length} 大分類)</option>`;
    catKeys.forEach(k => {
      const cat = allDatasets[k];
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = `${cat.title || k} (${cat.items?.length || 0} 張)`;
      catSelect.appendChild(opt);
    });

    const renderGrid = () => {
      grid.innerHTML = '';
      const selectedCat = catSelect.value;
      const query = searchInput.value.trim().toLowerCase();
      let itemsToShow: { catKey: string; item: any }[] = [];

      catKeys.forEach(k => {
        if (selectedCat !== 'ALL' && selectedCat !== k) return;
        const cat = allDatasets[k];
        if (!cat || !cat.items) return;
        cat.items.forEach((item: any) => {
          const fullName = `${item.name || ''} ${item.id} ${k}`.toLowerCase();
          if (query && !fullName.includes(query)) return;
          itemsToShow.push({ catKey: k, item });
        });
      });

      if (itemsToShow.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #857560; padding: 30px 0;">沒有找到相符的肖像圖標。</div>';
        return;
      }

      itemsToShow.forEach(({ catKey, item }) => {
        const fullId = `${catKey}:${item.id}`;
        const card = document.createElement('div');
        card.style.cssText = `
          background: rgba(0,0,0,0.5);
          border: 1.5px solid rgba(217, 119, 6, 0.3);
          border-radius: 6px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
        `;
        card.innerHTML = `
          <div style="width: 44px; height: 82px; border-radius: 4px; overflow: hidden; border: 1px solid #d97706; background: #0c0a09; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.6);">
            ${renderUniversalPortrait(fullId, 44)}
          </div>
          <div style="font-size: 0.72rem; color: #fbbf24; font-weight: bold; margin-top: 6px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">
            ${escapeHtml(item.name || item.id)}
          </div>
          <div style="font-size: 0.65rem; color: #94a3b8; text-align: center;">
            ${escapeHtml(item.id)}
          </div>
        `;

        card.onmouseenter = () => {
          card.style.borderColor = '#fbbf24';
          card.style.transform = 'translateY(-2px) scale(1.03)';
          card.style.background = 'rgba(70, 52, 34, 0.7)';
        };
        card.onmouseleave = () => {
          card.style.borderColor = 'rgba(217, 119, 6, 0.3)';
          card.style.transform = 'translateY(0) scale(1)';
          card.style.background = 'rgba(0,0,0,0.5)';
        };
        card.onclick = () => {
          onSelect(fullId);
          modal.style.display = 'none';
        };
        grid.appendChild(card);
      });
    };

    catSelect.onchange = renderGrid;
    searchInput.oninput = renderGrid;

    const closeModal = () => { modal.style.display = 'none'; };
    if (btnClose) btnClose.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    renderGrid();
    modal.style.display = 'flex';
  }

  private bindStaticListeners(): void {
    // 故事設定
    const syncStoryMeta = () => {
      const story = this.store.getActiveStory();
      if (!story) return;
      story.title = this.value('story-editor-story-title') || story.id;
      story.summary = this.value('story-editor-story-summary');
      story.enabled = this.byId<HTMLInputElement>('story-editor-story-enabled').checked;
      this.store.autoSaveDraft();
      this.store.emit('storyUpdated');
    };

    ['story-editor-story-title', 'story-editor-story-summary', 'story-editor-story-enabled'].forEach(id => {
      this.byId(id)?.addEventListener('input', syncStoryMeta);
    });

    // 節點 ID 獨立監聽失焦變更（嚴格防撞校驗）
    this.byId('story-node-id')?.addEventListener('change', () => this.handleNodeIdChange());

    // 專屬一般欄位即時監聽
    const nodeFieldIds = [
      'story-node-channel', 'story-node-title', 'story-node-description',
      'story-node-target-map', 'story-node-npc-name', 'story-node-npc-avatar',
      'story-node-bounty-repeatable', 'story-node-bounty-cooldown', 'story-node-bounty-duration',
      'story-node-bounty-expire', 'story-node-bounty-gold', 'story-node-bounty-exp', 'story-node-bounty-type'
    ];

    nodeFieldIds.forEach(id => {
      this.byId(id)?.addEventListener('input', () => this.syncActiveNodeField());
      this.byId(id)?.addEventListener('change', () => this.syncActiveNodeField());
    });

    this.byId('btn-pick-node-npc-avatar')?.addEventListener('click', () => {
      const node = this.store.getActiveNode();
      if (!node) return;
      this.openAvatarPicker(avatarId => {
        node.npcAvatar = avatarId;
        this.setValue('story-node-npc-avatar', avatarId);
        const prev = this.byId('story-node-npc-avatar-preview');
        if (prev) prev.innerHTML = renderUniversalPortrait(avatarId, 32);
        this.syncActiveNodeField();
      });
    });

    this.byId('btn-story-add-dialogue-page')?.addEventListener('click', () => {
      const node = this.store.getActiveNode();
      if (!node) return;
      if (!node.dialoguePages) node.dialoguePages = [];
      const nextIdx = node.dialoguePages.length + 1;
      node.dialoguePages.push({
        speakerType: 'NPC',
        speakerName: node.npcName || '神秘訪客',
        speakerTitle: '【街角遇見的旅人】',
        speakerAvatar: node.npcAvatar || 'npc:npc_0',
        text: `第 ${nextIdx} 段對話內容...`
      });
      this.renderDialoguePagesList(node);
      this.store.autoSaveDraft();
    });

    this.byId('btn-story-add-condition')?.addEventListener('click', () => {
      const node = this.store.getActiveNode();
      if (!node) return;
      node.conditions.push(defaultCondition());
      this.renderConditionList(node);
      this.store.autoSaveDraft();
      this.store.emit('validationChanged');
    });

    this.byId('btn-story-add-effect')?.addEventListener('click', () => {
      const node = this.store.getActiveNode();
      if (!node) return;
      node.completionEffects.push(defaultEffect());
      this.renderEffectList('story-node-effects-list', node.completionEffects, fx => {
        node.completionEffects = fx;
        this.store.autoSaveDraft();
        this.store.emit('validationChanged');
      });
      this.store.autoSaveDraft();
      this.store.emit('validationChanged');
    });

    this.byId('btn-story-add-choice')?.addEventListener('click', () => {
      const node = this.store.getActiveNode();
      if (!node) return;
      if (!node.choices) node.choices = [];
      const nextIndex = node.choices.length + 1;
      node.choices.push({ id: `choice_${nextIndex}`, text: `新選項 ${nextIndex}`, resultText: '', effects: [] });
      this.renderChoicesList(node);
      this.store.autoSaveDraft();
    });
  }
}
