import { BUILTIN_STORIES } from '../data/StoryData';
import type { NarrativeChoice, NarrativeCondition, NarrativeEffect, NarrativeEquipmentSlot, NarrativeEquipmentTier, NarrativeNode, NarrativeStory } from '../models/Narrative';
import { DataStore } from '../systems/DataStore';
import { TRADE_GOODS } from '../systems/MarketSystem';
import { renderUniversalPortrait } from '../ui/IconSpriteHelper';
import defaultCustomDatasets from '../data/custom_icon_datasets.json';
import '../styles/story-editor.css';

const TEST_STORAGE_KEY = 'MEDIEVAL_STORY_TEST_PAYLOAD';
let stories: NarrativeStory[] = [];
let selectedStoryId = '';
let selectedNodeId = '';
let storySearchQuery = '';

// 流程圖畫布視角與狀態
let graphZoom = 1.0;
let graphPanX = 0;
let graphPanY = 0;
let graphPositions: Record<string, { x: number; y: number }> = {};
let graphWireSource: string | null = null;

const GRAPH_NODE_W = 210;
const GRAPH_NODE_H = 96;
const GRAPH_H_GAP = 264;
const GRAPH_V_GAP = 128;
const GRAPH_COLS = 4;
const GRAPH_POS_KEY = 'MEDIEVAL_STORY_GRAPH_POS';
const SVG_NS = 'http://www.w3.org/2000/svg';

type GraphEdgeType = 'fact' | 'schedule' | 'victory' | 'defeat' | 'journey';
interface GraphEdge { from: string; to: string; type: GraphEdgeType; label?: string; }

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;
const bySvgId = <T extends SVGElement = SVGElement>(id: string): T => document.getElementById(id) as unknown as T;
const value = (id: string): string => byId<HTMLInputElement>(id).value.trim();
const numberValue = (id: string): number => Number(byId<HTMLInputElement>(id).value) || 0;
const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));
const activeStory = (): NarrativeStory | undefined => stories.find(story => story.id === selectedStoryId);
const activeNode = (): NarrativeNode | undefined => activeStory()?.nodes.find(node => node.id === selectedNodeId);
const safeId = (text: string): string => text.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
const svgEl = <T extends SVGElement>(tag: string): T => document.createElementNS(SVG_NS, tag) as T;

function makeNode(id: string): NarrativeNode {
  return { id, title: '新故事節點', description: '', channel: 'TERRITORY_EVENT', conditions: [], choices: [], completionEffects: [] };
}

async function loadTemplate(): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}src/templates/story-editor.html?t=${Date.now()}`);
  if (!response.ok) throw new Error('無法載入故事工坊介面');
  byId('story-studio-root').innerHTML = await response.text();
  byId('modal-story-editor').classList.add('active');
}

async function loadFromProject(): Promise<void> {
  const response = await fetch('/api/get-story-definitions');
  if (!response.ok) throw new Error('讀取專案故事失敗');
  const loaded = await response.json();
  const loadedList: NarrativeStory[] = Array.isArray(loaded) ? loaded : [];
  const loadedIds = new Set(loadedList.map(s => s.id));
  const merged: NarrativeStory[] = [...loadedList];
  for (const builtin of BUILTIN_STORIES) {
    if (!loadedIds.has(builtin.id)) {
      merged.push(clone(builtin));
    }
  }
  stories = clone(merged.length > 0 ? merged : BUILTIN_STORIES);
  if (!stories.some(s => s.id === selectedStoryId)) {
    selectedStoryId = stories[0]?.id ?? '';
    selectedNodeId = stories[0]?.nodes[0]?.id ?? '';
  }
  render();
}

function render(): void {
  const story = activeStory();
  buildSharedDatalists();
  renderStoryList();
  
  byId<HTMLInputElement>('story-editor-story-title').value = story?.title ?? '';
  byId<HTMLTextAreaElement>('story-editor-story-summary').value = story?.summary ?? '';
  byId<HTMLInputElement>('story-editor-story-enabled').checked = story?.enabled ?? false;

  renderFacts();
  renderNodePills();
  renderGraphCanvas();
  renderForm();
  renderValidation();
}

// ── 左欄：故事庫清單 ──

function renderStoryList(): void {
  const container = byId('story-editor-story-list');
  container.innerHTML = '';
  const query = storySearchQuery.toLowerCase();
  
  const filtered = stories.filter(s => {
    if (!query) return true;
    return s.title.toLowerCase().includes(query) || s.id.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:15px; color:#6b6050; font-size:.8rem;">查無符合的故事</div>`;
    return;
  }

  for (const story of filtered) {
    const item = document.createElement('div');
    item.className = `story-list-item${story.id === selectedStoryId ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="story-item-main">
        <span class="story-item-status ${story.enabled ? 'enabled' : 'draft'}" title="${story.enabled ? '已啟用' : '草稿'}"></span>
        <span class="story-item-title">${escapeHtml(story.title || story.id)}</span>
      </div>
      <span class="story-item-badge">${story.nodes.length} 節點</span>
    `;
    item.addEventListener('click', () => {
      if (selectedStoryId !== story.id) {
        selectedStoryId = story.id;
        selectedNodeId = story.nodes[0]?.id ?? '';
        loadGraphPos(story.id);
        render();
      }
    });
    container.appendChild(item);
  }
}

function renderFacts(): void {
  const facts = activeStory()?.nodes.flatMap(node => [
    ...node.completionEffects,
    ...node.choices.flatMap(choice => choice.effects)
  ].filter((effect): effect is Extract<NarrativeEffect, { type: 'SET_FACT' }> => effect.type === 'SET_FACT').map(effect => `${effect.fact} ← ${node.title}`)) ?? [];
  byId('story-editor-facts').textContent = facts.length ? [...new Set(facts)].join('\n') : '尚未設定故事線索。';
}

function renderNodePills(): void {
  const container = byId('story-editor-node-pills');
  container.innerHTML = '';
  const story = activeStory();
  if (!story) return;

  for (const node of story.nodes) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `sn-pill${node.id === selectedNodeId ? ' selected' : ''}`;
    const repeatBadge = node.repeatable ? '<span style="color:#60a5fa; font-size:0.7rem; margin-right:3px;">🔄</span>' : '';
    pill.innerHTML = `<span class="sn-pill-channel">${channelName(node.channel)}</span><span>${repeatBadge}${escapeHtml(node.title)}</span>`;
    pill.addEventListener('click', () => {
      selectNode(node.id, true);
    });
    container.appendChild(pill);
  }
}

// ── 節點選中與高亮 ──

function selectNode(nodeId: string, centerGraph = false): void {
  selectedNodeId = nodeId;
  
  // 更新 pills
  byId('story-editor-node-pills').querySelectorAll('.sn-pill').forEach((pill, idx) => {
    const n = activeStory()?.nodes[idx];
    pill.classList.toggle('selected', n?.id === nodeId);
  });

  // 更新 SVG 節點樣式
  const svg = bySvgId<SVGSVGElement>('story-graph-svg');
  svg.querySelectorAll('.graph-node').forEach(g => {
    const isCur = (g as SVGElement).dataset.nodeId === nodeId;
    g.classList.toggle('graph-node-selected', isCur);
  });

  // 平移居中（若要求）
  if (centerGraph && graphPositions[nodeId]) {
    const wrapper = byId('story-graph-wrapper');
    const pos = graphPositions[nodeId];
    const targetX = wrapper.clientWidth / 2 - (pos.x + GRAPH_NODE_W / 2) * graphZoom;
    const targetY = wrapper.clientHeight / 2 - (pos.y + GRAPH_NODE_H / 2) * graphZoom;
    graphPanX = targetX;
    graphPanY = targetY;
    applyGraphTransform();
  }

  renderForm();
}

function renderForm(): void {
  const node = activeNode();
  byId('story-editor-empty').hidden = !!node;
  byId('story-editor-node-form').hidden = !node;
  if (!node) return;
  if (!node.choices) node.choices = [];

  setValue('story-node-id', node.id);
  setValue('story-node-channel', node.channel);
  setValue('story-node-title', node.title);
  setValue('story-node-description', node.description);
  setValue('story-node-target-map', node.targetNodeId ?? '');
  setValue('story-node-npc-name', node.npcName ?? '');
  setValue('story-node-npc-avatar', node.npcAvatar ?? 'npc:npc_0');
  
  const nodeAvatarPreview = byId('story-node-npc-avatar-preview');
  if (nodeAvatarPreview) {
    nodeAvatarPreview.innerHTML = renderUniversalPortrait(node.npcAvatar || 'npc:npc_0', 32);
  }

  byId<HTMLInputElement>('story-node-bounty-repeatable').checked = !!node.repeatable;
  setValue('story-node-bounty-cooldown', node.cooldownDays ?? 3);
  setValue('story-node-bounty-duration', node.bounty?.duration ?? 2);
  setValue('story-node-bounty-expire', node.bounty?.expireDays ?? 4);
  setValue('story-node-bounty-gold', node.bounty?.gold ?? 50);
  setValue('story-node-bounty-exp', node.bounty?.exp ?? 30);
  setValue('story-node-bounty-type', node.bounty?.type ?? 'NORMAL');

  renderDialoguePagesList(node);
  renderConditionList(node);
  renderEffectList('story-node-effects-list', node.completionEffects, effects => { node.completionEffects = effects; refreshEffectSummary(); });
  renderChoicesList(node);

  byId('story-editor-bounty-fields').hidden = node.channel !== 'BOUNTY_BOARD';
  byId('story-editor-map-target-fields').hidden = node.channel !== 'STORY_NODE';
  byId('story-editor-blocked-reasons').textContent = describeConditions(node.conditions);
}

function renderDialoguePagesList(node: NarrativeNode): void {
  const container = document.getElementById('story-node-dialogue-pages-list');
  if (!container) return;
  container.innerHTML = '';
  if (!node.dialoguePages) node.dialoguePages = [];

  if (node.dialoguePages.length === 0) {
    container.innerHTML = '<div style="color:#857560; font-size:.78rem; padding:4px 0;">目前無多段對話（將預設播放上方「故事敘述」）。點擊下方按鈕可新增分段對話與切換說話者。</div>';
    return;
  }

  node.dialoguePages.forEach((page, index) => {
    const card = document.createElement('div');
    card.className = 'story-choice-card';
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
            <option value="PLAYER_GUARDIAN"${page.speakerType === 'PLAYER_GUARDIAN' ? ' selected' : ''}>👑 玩家誓約守衛/領主</option>
          </select>
        </label>
        <label>說話者稱號/身份<input data-speaker-title type="text" value="${escapeHtml(page.speakerTitle ?? '')}" placeholder="例：【街角遇見的旅人】"></label>
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
      if (npcFields) npcFields.style.display = page.speakerType === 'PLAYER_GUARDIAN' ? 'none' : 'grid';
    });
    card.querySelector<HTMLInputElement>('[data-speaker-name]')!.addEventListener('input', e => {
      page.speakerName = (e.target as HTMLInputElement).value;
    });
    card.querySelector<HTMLInputElement>('[data-speaker-title]')!.addEventListener('input', e => {
      page.speakerTitle = (e.target as HTMLInputElement).value;
    });
    card.querySelector('[data-btn-pick-page-avatar]')!.addEventListener('click', () => {
      openAvatarPicker(avatarId => {
        page.speakerAvatar = avatarId;
        const prev = card.querySelector<HTMLElement>('[data-page-avatar-preview]');
        if (prev) prev.innerHTML = renderUniversalPortrait(avatarId, 28);
      });
    });
    card.querySelector<HTMLTextAreaElement>('[data-page-text]')!.addEventListener('input', e => {
      page.text = (e.target as HTMLTextAreaElement).value;
    });
    card.querySelector('[data-remove-page]')!.addEventListener('click', () => {
      node.dialoguePages!.splice(index, 1);
      renderDialoguePagesList(node);
    });

    container.appendChild(card);
  });
}

function renderChoicesList(node: NarrativeNode): void {
  const container = document.getElementById('story-node-choices-list');
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
    });
    card.querySelector<HTMLTextAreaElement>('[data-choice-result]')!.addEventListener('input', e => {
      choice.resultText = (e.target as HTMLTextAreaElement).value;
    });
    card.querySelector('[data-remove-choice]')!.addEventListener('click', () => {
      node.choices.splice(index, 1);
      renderChoicesList(node);
      refreshEffectSummary();
    });
    renderEffectList(`story-choice-fx-${index}`, choice.effects, effects => {
      choice.effects = effects;
      refreshEffectSummary();
    });
    card.querySelector('[data-add-choice-fx]')!.addEventListener('click', () => {
      choice.effects.push(defaultEffect());
      renderChoicesList(node);
      refreshEffectSummary();
    });
  });
}

function syncStory(): void {
  const story = activeStory();
  if (!story) return;
  story.title = value('story-editor-story-title') || story.id;
  story.summary = value('story-editor-story-summary');
  story.enabled = byId<HTMLInputElement>('story-editor-story-enabled').checked;
  renderStoryList();
  renderValidation();
}

function syncNode(): void {
  const node = activeNode();
  if (!node) return;
  const oldId = node.id;
  const newId = safeId(value('story-node-id')) || oldId;

  if (newId !== oldId) {
    if (graphPositions[oldId]) {
      graphPositions[newId] = graphPositions[oldId];
      delete graphPositions[oldId];
      saveGraphPos(activeStory()!.id);
    }
  }

  node.id = newId;
  selectedNodeId = node.id;
  node.channel = byId<HTMLSelectElement>('story-node-channel').value as NarrativeNode['channel'];
  node.title = value('story-node-title') || node.id;
  node.description = value('story-node-description');
  node.npcName = value('story-node-npc-name') || undefined;
  node.npcAvatar = value('story-node-npc-avatar') || undefined;
  node.targetNodeId = node.channel === 'STORY_NODE' ? value('story-node-target-map') || undefined : undefined;
  node.repeatable = node.channel === 'BOUNTY_BOARD' ? byId<HTMLInputElement>('story-node-bounty-repeatable')?.checked : undefined;
  node.cooldownDays = node.channel === 'BOUNTY_BOARD' && node.repeatable ? Math.max(0, numberValue('story-node-bounty-cooldown')) : undefined;
  node.bounty = node.channel === 'BOUNTY_BOARD' ? {
    duration: Math.max(1, numberValue('story-node-bounty-duration')),
    expireDays: Math.max(1, numberValue('story-node-bounty-expire')),
    gold: Math.max(0, numberValue('story-node-bounty-gold')),
    exp: Math.max(0, numberValue('story-node-bounty-exp')),
    type: (byId<HTMLSelectElement>('story-node-bounty-type')?.value || 'NORMAL') as 'NORMAL' | 'BANDIT'
  } : undefined;

  renderFacts();
  renderNodePills();
  renderValidation();
  byId('story-editor-bounty-fields').hidden = node.channel !== 'BOUNTY_BOARD';
  byId('story-editor-map-target-fields').hidden = node.channel !== 'STORY_NODE';
}

import { INITIAL_FACTIONS } from '../data/FactionData';

const FACTION_OPTIONS = INITIAL_FACTIONS.map(f => ({
  value: f.id,
  label: `${f.factionName} (${f.id})`
}));

const CONDITION_LABELS: Record<NarrativeCondition['type'], string> = {
  DAY_AT_LEAST: '最早遊戲日', TAVERN_LEVEL_AT_LEAST: '最低酒館等級', PRESTIGE_AT_LEAST: '最低聲望',
  GOLD_AT_LEAST: '最低金幣', FACTION_FAVOR_AT_LEAST: '派系好感度 ≥', FACTION_FAVOR_AT_MOST: '派系好感度 ≤',
  FACT_EXISTS: '需要線索', FACT_MISSING: '必須尚無線索', DAYS_SINCE_FACT: '取得線索後等待', NODE_EXPLORED: '需要已發現據點',
  SUBJUGATION_COUNT_AT_LEAST: '動態討伐累積數'
};

function defaultCondition(type: NarrativeCondition['type'] = 'FACT_EXISTS'): NarrativeCondition {
  switch (type) {
    case 'DAY_AT_LEAST': case 'TAVERN_LEVEL_AT_LEAST': case 'PRESTIGE_AT_LEAST': return { type, value: 1 };
    case 'GOLD_AT_LEAST': return { type, value: 100 };
    case 'FACTION_FAVOR_AT_LEAST': case 'FACTION_FAVOR_AT_MOST': return { type, factionId: 'f_vormund', value: 30 };
    case 'FACT_EXISTS': case 'FACT_MISSING': return { type, fact: 'new_fact' };
    case 'DAYS_SINCE_FACT': return { type, fact: 'new_fact', value: 1 };
    case 'NODE_EXPLORED': return { type, nodeId: '' };
    case 'SUBJUGATION_COUNT_AT_LEAST': return { type, value: 1 };
  }
}

function renderConditionList(node: NarrativeNode): void {
  const container = byId('story-node-conditions-list');
  container.innerHTML = '';
  node.conditions.forEach((condition, index) => {
    const row = document.createElement('div');
    row.className = 'story-effect-row';
    row.innerHTML = `<div class="story-effect-head"><select data-condition-type>${Object.entries(CONDITION_LABELS).map(([type, label]) => `<option value="${type}"${type === condition.type ? ' selected' : ''}>${label}</option>`).join('')}</select><button type="button" class="action-btn story-danger" data-remove>刪除</button></div><div class="story-effect-fields">${conditionFields(condition)}</div>`;
    row.querySelector<HTMLSelectElement>('[data-condition-type]')!.addEventListener('change', event => {
      node.conditions[index] = defaultCondition((event.target as HTMLSelectElement).value as NarrativeCondition['type']);
      renderConditionList(node); refreshEffectSummary();
    });
    row.querySelector('[data-remove]')!.addEventListener('click', () => {
      node.conditions.splice(index, 1); renderConditionList(node); refreshEffectSummary();
    });
    row.querySelectorAll<HTMLInputElement>('[data-field]').forEach(field => field.addEventListener('input', () => {
      const target = condition as any;
      target[field.dataset.field!] = field.type === 'number' ? Number(field.value) || 0 : field.value;
      byId('story-editor-blocked-reasons').textContent = describeConditions(node.conditions);
      renderValidation();
    }));
    container.appendChild(row);
  });
}

function conditionFields(condition: NarrativeCondition): string {
  const input = (label: string, field: string, current: string | number, type = 'text', list = '') =>
    `<label>${label}<input data-field="${field}" type="${type}" value="${escapeHtml(String(current))}"${list ? ` list="${list}"` : ''}></label>`;

  const select = (label: string, field: string, current: string, options: { value: string; label: string }[]) =>
    `<label>${label}<select data-field="${field}">${options.map(o => `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`;

  switch (condition.type) {
    case 'DAY_AT_LEAST': case 'TAVERN_LEVEL_AT_LEAST': case 'PRESTIGE_AT_LEAST': return input('門檻數值', 'value', condition.value, 'number');
    case 'GOLD_AT_LEAST': return input('金幣門檻', 'value', condition.value, 'number');
    case 'FACTION_FAVOR_AT_LEAST': case 'FACTION_FAVOR_AT_MOST':
      return `${select('目標派系', 'factionId', condition.factionId, FACTION_OPTIONS)}${input('好感度門檻 (-100~100)', 'value', condition.value, 'number')}`;
    case 'FACT_EXISTS': case 'FACT_MISSING': return input('線索代號', 'fact', condition.fact, 'text', 'story-fact-datalist');
    case 'DAYS_SINCE_FACT': return `${input('線索代號', 'fact', condition.fact, 'text', 'story-fact-datalist')}${input('等待天數', 'value', condition.value, 'number')}`;
    case 'NODE_EXPLORED': return input('地圖節點 ID', 'nodeId', condition.nodeId);
    case 'SUBJUGATION_COUNT_AT_LEAST': return input('最少討伐數（動態據點）', 'value', condition.value, 'number');
  }
}

function refreshEffectSummary(): void {
  renderFacts();
  renderValidation();
}

function defaultEffect(type: NarrativeEffect['type'] = 'SET_FACT'): NarrativeEffect {
  switch (type) {
    case 'SET_FACT': return { type, fact: 'new_fact', value: true };
    case 'ADD_GOLD': return { type, value: 100 };
    case 'ADD_PRESTIGE': return { type, value: 10 };
    case 'ADD_RESTED_EXP': return { type, value: 50 };
    case 'CHANGE_FACTION_FAVOR': return { type, factionId: 'f_vormund', value: 10 };
    case 'GRANT_MATERIAL': return { type, itemId: 'mat_iron_ingot', quantity: 1, mode: 'FIXED' };
    case 'GRANT_TRADE_GOOD': return { type, itemId: 'tg_spice', quantity: 1, mode: 'FIXED' };
    case 'GRANT_EQUIPMENT': return { type, templateId: 'wpn_iron_greatsword', mode: 'FIXED', slot: 'ANY', tier: 'ANY', quantity: 1 };
    case 'SCHEDULE_NODE': return { type, nodeId: '', delayDays: 1 };
    case 'UNLOCK_MAP_NODE': return { type, nodeId: '' };
    case 'CREATE_SUBJUGATION_NODE': return {
      type,
      definition: {
        nodeId: 'story_encounter', name: '新的討伐據點', description: '故事所揭露的危險據點。',
        placement: 'NEAR_PLAYER', radius: 8, terrain: 'RUINS', difficulty: 2,
        enemyFeature: 'BALANCED', requiresScouting: true, removeOnVictory: true,
        journeyNodeIds: []
      }
    };
  }
}

const EFFECT_LABELS: Record<NarrativeEffect['type'], string> = {
  SET_FACT: '線索：新增線索 (SET_FACT)',
  ADD_GOLD: '資源：金幣變化 (ADD_GOLD)',
  ADD_PRESTIGE: '資源：聲望變化 (ADD_PRESTIGE)',
  ADD_RESTED_EXP: '資源：經驗池獎勵 (ADD_RESTED_EXP)',
  CHANGE_FACTION_FAVOR: '外交：派系好感度 (CHANGE_FACTION_FAVOR)',
  GRANT_EQUIPMENT: '物品：裝備獎勵 (GRANT_EQUIPMENT)',
  GRANT_MATERIAL: '物品：素材獎勵 (GRANT_MATERIAL)',
  GRANT_TRADE_GOOD: '物品：貿易特產 (GRANT_TRADE_GOOD)',
  SCHEDULE_NODE: '流程：延遲排程節點 (SCHEDULE_NODE)',
  UNLOCK_MAP_NODE: '地圖：解鎖預設地圖據點 (UNLOCK_MAP_NODE)',
  CREATE_SUBJUGATION_NODE: '討伐：創造故事討伐據點 (CREATE_SUBJUGATION_NODE)'
};

function renderEffectList(id: string, effects: NarrativeEffect[], setter: (effects: NarrativeEffect[]) => void): void {
  const container = byId(id);
  container.innerHTML = '';
  effects.forEach((effect, index) => {
    const row = document.createElement('div');
    row.className = 'story-effect-row';
    row.innerHTML = `<div class="story-effect-head"><select data-effect-type>${Object.entries(EFFECT_LABELS).map(([type, label]) => `<option value="${type}"${type === effect.type ? ' selected' : ''}>${label}</option>`).join('')}</select><button type="button" class="action-btn story-danger" data-remove>刪除</button></div><div class="story-effect-fields">${effectFields(effect)}</div>`;
    row.querySelector<HTMLSelectElement>('[data-effect-type]')!.addEventListener('change', event => {
      const next = [...effects];
      next[index] = defaultEffect((event.target as HTMLSelectElement).value as NarrativeEffect['type']);
      setter(next); renderEffectList(id, next, setter);
    });
    row.querySelector('[data-remove]')!.addEventListener('click', () => {
      const next = effects.filter((_, effectIndex) => effectIndex !== index);
      setter(next); renderEffectList(id, next, setter);
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

        if (property === 'templateId') {
          const tpl = DataStore.SubjugationNodeDB.find(s => s.id === field.value);
          if (tpl) {
            target.name = tpl.name;
            target.description = tpl.description;
            target.terrain = tpl.terrain;
            target.difficulty = tpl.difficulty;
            target.requiresScouting = !!tpl.requiresScouting;
            target.removeOnVictory = tpl.removeOnVictory !== false;
          }
          renderEffectList(id, effects, setter);
        }

        setter([...effects]);
        if (property === 'mode') renderEffectList(id, effects, setter);
        refreshEffectSummary();
      });
    });
    container.appendChild(row);
  });
}

function effectFields(effect: NarrativeEffect): string {
  const input = (label: string, field: string, current: string | number, type = 'text', list = '') =>
    `<label>${label}<input data-field="${field}" type="${type}" value="${escapeHtml(String(current))}"${list ? ` list="${list}"` : ''}></label>`;

  const select = (label: string, field: string, current: string, options: { value: string; label: string }[]) =>
    `<label>${label}<select data-field="${field}">${options.map(o => `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select></label>`;

  const storyNodes = activeStory()?.nodes ?? [];
  const nodeSelect = (label: string, field: string, currentVal: string) => {
    const opts = [{ value: '', label: '(不設定)' }, ...storyNodes.map(n => ({ value: n.id, label: n.id }))];
    return select(label, field, currentVal, opts);
  };

  switch (effect.type) {
    case 'SET_FACT': return input('線索代號', 'fact', effect.fact, 'text', 'story-fact-datalist');
    case 'ADD_GOLD': case 'ADD_PRESTIGE': case 'ADD_RESTED_EXP': return input('數量', 'value', effect.value, 'number');
    case 'CHANGE_FACTION_FAVOR': return `${select('目標派系', 'factionId', effect.factionId, FACTION_OPTIONS)}${input('好感度增減 (-100~+100)', 'value', effect.value, 'number')}`;
    
    // 統整型裝備獎勵（支援隨機/固定）
    case 'GRANT_EQUIPMENT': {
      const mode = effect.mode ?? 'FIXED';
      const modeSelect = select('生成模式', 'mode', mode, [
        { value: 'FIXED', label: '固定裝備模板 (Fixed)' },
        { value: 'RANDOM', label: '隨機生成裝備 (Random)' }
      ]);
      if (mode === 'RANDOM') {
        const slotSelect = select('部位篩選', 'slot', effect.slot ?? 'ANY', [
          { value: 'ANY', label: '任意部位 (Any)' },
          { value: 'WEAPON', label: '武器 (Weapon)' },
          { value: 'ARMOR', label: '防具 (Armor)' },
          { value: 'ACCESSORY', label: '飾品 (Accessory)' }
        ]);
        const tierSelect = select('品質階級', 'tier', String(effect.tier ?? 'ANY'), [
          { value: 'ANY', label: '任意階級 (Any)' },
          { value: '1', label: 'T1 基礎裝備' },
          { value: '2', label: 'T2 高級裝備' },
          { value: '3', label: 'T3 專家裝備' },
          { value: '4', label: 'T4 史詩神兵' }
        ]);
        return `${modeSelect}${slotSelect}${tierSelect}${input('數量', 'quantity', effect.quantity, 'number')}`;
      }
      const eqOptions = Object.values(DataStore.EquipmentDB).map(t => ({
        value: t.id,
        label: `${t.name} (${t.id})`
      }));
      const templateSelect = select('裝備模板', 'templateId', effect.templateId ?? 'wpn_iron_greatsword', eqOptions.length > 0 ? eqOptions : [{ value: 'wpn_iron_greatsword', label: '鐵大劍 (wpn_iron_greatsword)' }]);
      return `${modeSelect}${templateSelect}${input('數量', 'quantity', effect.quantity, 'number')}`;
    }

    // 統整型素材獎勵
    case 'GRANT_MATERIAL': {
      const mode = effect.mode ?? 'FIXED';
      const modeSelect = select('模式', 'mode', mode, [
        { value: 'FIXED', label: '固定素材 (Fixed)' },
        { value: 'RANDOM', label: '隨機素材 (Random)' }
      ]);
      if (mode === 'RANDOM') {
        return `${modeSelect}${input('隨機數量', 'quantity', effect.quantity, 'number')}`;
      }
      const matOptions = Object.values(DataStore.MaterialDB).map(m => ({
        value: m.id,
        label: `${m.name} (${m.id})`
      }));
      const matSelect = select('素材種類', 'itemId', effect.itemId ?? 'mat_iron_ingot', matOptions.length > 0 ? matOptions : [{ value: 'mat_iron_ingot', label: '鐵錠 (mat_iron_ingot)' }]);
      return `${modeSelect}${matSelect}${input('數量', 'quantity', effect.quantity, 'number')}`;
    }

    // 統整型貿易特產
    case 'GRANT_TRADE_GOOD': {
      const mode = effect.mode ?? 'FIXED';
      const modeSelect = select('模式', 'mode', mode, [
        { value: 'FIXED', label: '固定特產 (Fixed)' },
        { value: 'RANDOM', label: '隨機特產 (Random)' }
      ]);
      if (mode === 'RANDOM') {
        return `${modeSelect}${input('隨機數量', 'quantity', effect.quantity, 'number')}`;
      }
      const tgOptions = TRADE_GOODS.map(g => ({
        value: g.id,
        label: `${g.name} (${g.id})`
      }));
      const tgSelect = select('特產種類', 'itemId', effect.itemId ?? 'tg_spice', tgOptions);
      return `${modeSelect}${tgSelect}${input('數量', 'quantity', effect.quantity, 'number')}`;
    }

    case 'SCHEDULE_NODE': return `${nodeSelect('延遲發佈節點', 'nodeId', effect.nodeId)}${input('幾天後', 'delayDays', effect.delayDays, 'number')}`;
    case 'UNLOCK_MAP_NODE': return input('既有地圖節點 ID', 'nodeId', effect.nodeId);
    case 'CREATE_SUBJUGATION_NODE': {
      const definition = effect.definition;
      const tplOptions = [
        { value: '', label: '🛠️ [自訂據點參數 (Custom)]' },
        ...DataStore.SubjugationNodeDB.map(s => ({
          value: s.id,
          label: `🏰 ${s.name} (Lv.${s.difficulty} · ${s.terrain})`
        }))
      ];
      const tplSelect = select('選擇討伐據點模板', 'definition.templateId', definition.templateId ?? '', tplOptions);
      const enumSelect = (label: string, field: string, current: string, choices: string[]) =>
        `<label>${label}<select data-field="definition.${field}">${choices.map(c => `<option value="${c}"${c === current ? ' selected' : ''}>${c}</option>`).join('')}</select></label>`;
      
      const curTpl = DataStore.SubjugationNodeDB.find(s => s.id === definition.templateId);
      const tplInfo = curTpl ? `
        <div style="grid-column: span 2; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 4px; padding: 6px 10px; font-size: 0.75rem; color: #93c5fd; margin-bottom: 4px;">
          ✨ 已綁定據點模板：<b>${escapeHtml(curTpl.name)}</b>（${curTpl.waves?.length || 0} 波守軍，通關報酬: ${curTpl.rewards?.gold || 0} G, ${curTpl.rewards?.exp || 0} EXP）
        </div>` : '';

      return `<div class="story-subjugation-grid">
        <div style="grid-column: span 2;">${tplSelect}</div>
        ${tplInfo}
        ${input('據點代號', 'definition.nodeId', definition.nodeId)}${input('據點名稱', 'definition.name', definition.name)}
        <label class="wide">據點描述<textarea data-field="definition.description" rows="2">${escapeHtml(definition.description)}</textarea></label>
        ${enumSelect('生成位置', 'placement', definition.placement, ['NEAR_PLAYER', 'NEAR_NODE', 'FIXED'])}${input('錨點地圖 ID', 'definition.anchorNodeId', definition.anchorNodeId ?? '')}
        ${input('距離', 'definition.radius', definition.radius ?? 8, 'number')}${input('固定 X', 'definition.x', definition.x ?? 50, 'number')}${input('固定 Y', 'definition.y', definition.y ?? 50, 'number')}
        ${enumSelect('地形', 'terrain', definition.terrain, ['PLAINS','FOREST','SNOW_MOUNTAIN','VOLCANO','DESERT','CAVE','RUINS','WILDERNESS'])}${input('難度 1～10', 'definition.difficulty', definition.difficulty, 'number')}
        ${enumSelect('敵軍特性', 'enemyFeature', definition.enemyFeature ?? 'BALANCED', ['BALANCED','HIGH_DEF','HIGH_EVADE'])}${input('主題怪物 ID（可留空）', 'definition.monsterId', definition.monsterId ?? '')}
        ${input('途中事件節點（逗號分隔）', 'definition.journeyNodeIds', definition.journeyNodeIds.join(','))}
        ${nodeSelect('勝利後節點', 'definition.victoryNodeId', definition.victoryNodeId ?? '')}
        ${nodeSelect('失敗後節點', 'definition.defeatNodeId', definition.defeatNodeId ?? '')}
        <label class="story-editor-check"><input data-field="definition.requiresScouting" type="checkbox"${definition.requiresScouting ? ' checked' : ''}> 需要先偵查</label>
        <label class="story-editor-check"><input data-field="definition.removeOnVictory" type="checkbox"${definition.removeOnVictory ? ' checked' : ''}> 勝利後移除據點</label>
      </div>`;
    }
  }
}

function buildSharedDatalists(): void {
  const ensureDL = (id: string, options: { value: string; label: string }[]): void => {
    let dl = document.getElementById(id) as HTMLDataListElement | null;
    if (!dl) { dl = document.createElement('datalist'); dl.id = id; document.body.appendChild(dl); }
    dl.innerHTML = options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
  };

  const factKeys = [...buildFactRegistry(stories).keys()];
  ensureDL('story-fact-datalist', factKeys.map(f => ({ value: f, label: f })));

  const materialIds = Object.keys(DataStore.MaterialDB);
  ensureDL('story-material-datalist', materialIds.map(id => ({ value: id, label: id })));

  ensureDL('story-tradegood-datalist', TRADE_GOODS.map(g => ({ value: g.id, label: g.name ?? g.id })));

  const eqTemplates = Object.values(DataStore.EquipmentDB);
  ensureDL('story-equipment-datalist', eqTemplates.map(t => ({ value: t.id, label: `${t.name} (${t.id})` })));
}

function validationErrors(): string[] {
  const errors: string[] = [];
  const storyIds = new Set<string>();
  for (const story of stories) {
    if (!story.id) errors.push('故事缺少代號。');
    if (storyIds.has(story.id)) errors.push(`故事代號重複：${story.id}`);
    storyIds.add(story.id);
    const nodeIds = new Set(story.nodes.map(node => node.id));
    if (nodeIds.size !== story.nodes.length) errors.push(`${story.title} 有重複節點代號。`);
    for (const node of story.nodes) {
      if (!node.id || !node.title || !node.description) errors.push(`${story.title} 有節點缺少代號、標題或敘述。`);
      const allEffects = [...node.completionEffects, ...node.choices.flatMap(choice => choice.effects)];
      for (const effect of allEffects) {
        if (effect.type === 'SCHEDULE_NODE' && !nodeIds.has(effect.nodeId)) errors.push(`${node.id} 排程了不存在的節點：${effect.nodeId}`);
        if (effect.type === 'GRANT_MATERIAL' && effect.mode !== 'RANDOM' && !DataStore.MaterialDB[effect.itemId]) errors.push(`${node.id} 使用不存在的素材 ID：${effect.itemId}`);
        if (effect.type === 'GRANT_TRADE_GOOD' && effect.mode !== 'RANDOM' && !TRADE_GOODS.some(item => item.id === effect.itemId)) errors.push(`${node.id} 使用不存在的貿易品 ID：${effect.itemId}`);
        if (effect.type === 'GRANT_EQUIPMENT' && effect.mode !== 'RANDOM' && effect.templateId && !DataStore.getEquipmentTemplate(effect.templateId)) errors.push(`${node.id} 使用不存在的裝備模板：${effect.templateId}`);
        if (effect.type === 'CREATE_SUBJUGATION_NODE') {
          const definition = effect.definition;
          if (!definition.nodeId || !definition.name) errors.push(`${node.id} 的故事討伐據點缺少代號或名稱。`);
          if (definition.difficulty < 1 || definition.difficulty > 10) errors.push(`${node.id} 的討伐難度需介於 1～10。`);
          for (const target of [...definition.journeyNodeIds, definition.victoryNodeId, definition.defeatNodeId].filter(Boolean) as string[]) {
            if (!nodeIds.has(target)) errors.push(`${node.id} 的討伐流程引用不存在的節點：${target}`);
          }
        }
      }
      if (node.channel === 'STORY_NODE' && !node.targetNodeId) errors.push(`${node.id} 要解鎖預設故事據點，但未指定地圖節點。`);
    }
  }
  return errors;
}

function renderValidation(): void {
  const errors = validationErrors();
  const box = byId('story-editor-validation');
  if (!box) return;
  box.className = `story-editor-validation ${errors.length ? 'error' : 'ok'}`;
  box.textContent = errors.length ? `需要修正：\n• ${errors.join('\n• ')}` : `✓ 結構檢查通過，共 ${stories.length} 條故事、${stories.reduce((sum, story) => sum + story.nodes.length, 0)} 個節點。`;
}

async function saveProject(): Promise<void> {
  syncStory(); syncNode();
  const errors = validationErrors();
  if (errors.length) return alert('請先修正結構檢查錯誤。');
  const note = prompt('這份快照的備註：', '故事內容調整') ?? '故事內容調整';
  const response = await fetch('/api/save-story-definitions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stories, note }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '儲存失敗');
  alert(`已寫入專案，並建立快照 ${result.snapshot}。`);
}

function testNode(): void {
  syncStory(); syncNode();
  const errors = validationErrors();
  if (errors.length) return alert('請先修正結構檢查錯誤。');
  if (!activeStory() || !activeNode()) return;
  const token = crypto.randomUUID();
  localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify({ token, stories, createdAt: new Date().toISOString() }));
  const gameUrl = new URL('../', location.href);
  gameUrl.searchParams.set('storyTest', token);
  gameUrl.searchParams.set('story', selectedStoryId);
  gameUrl.searchParams.set('node', selectedNodeId);
  location.href = gameUrl.href;
}

async function showHistory(): Promise<void> {
  const response = await fetch('/api/list-story-backups');
  const { backups } = await response.json();
  const dialog = document.createElement('dialog');
  dialog.className = 'story-history-dialog';
  dialog.innerHTML = `<h3>歷史快照</h3><div>${backups.length ? backups.map((item: any) => `<button class="story-history-item" data-file="${escapeHtml(item.filename)}"><strong>${escapeHtml(item.note || '自動快照')}</strong><span>${new Date(item.timestamp).toLocaleString('zh-TW')} · ${Math.ceil(item.size / 1024)} KB</span></button>`).join('') : '尚無快照。'}</div><button class="action-btn" data-close>關閉</button>`;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', async event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-file]');
    if (!target) return;
    if (!confirm(`確定還原 ${target.dataset.file}？目前磁碟內容會被取代。`)) return;
    const restored = await fetch('/api/restore-story-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: target.dataset.file }) });
    if (!restored.ok) return alert('還原失敗。');
    dialog.close(); dialog.remove(); await loadFromProject();
  });
  dialog.querySelector('[data-close]')!.addEventListener('click', () => { dialog.close(); dialog.remove(); });
  dialog.showModal();
}

// ── SVG 流程圖畫布（Zoom, Pan, Wiring, Drag） ──

function loadGraphPos(storyId: string): void {
  try { graphPositions = JSON.parse(localStorage.getItem(`${GRAPH_POS_KEY}_${storyId}`) ?? '{}'); }
  catch { graphPositions = {}; }
}

function saveGraphPos(storyId: string): void {
  localStorage.setItem(`${GRAPH_POS_KEY}_${storyId}`, JSON.stringify(graphPositions));
}

function autoLayoutMissing(nodes: NarrativeNode[]): void {
  nodes.forEach((node, i) => {
    if (!graphPositions[node.id]) {
      graphPositions[node.id] = {
        x: 40 + (i % GRAPH_COLS) * GRAPH_H_GAP,
        y: 40 + Math.floor(i / GRAPH_COLS) * GRAPH_V_GAP
      };
    }
  });
}

function buildGraphEdges(story: NarrativeStory): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const factSetters = new Map<string, string>();
  const nodeSet = new Set(story.nodes.map(n => n.id));

  for (const node of story.nodes) {
    const allFx = [...node.completionEffects, ...node.choices.flatMap(c => c.effects)];
    for (const fx of allFx) {
      if (fx.type === 'SET_FACT') factSetters.set(fx.fact, node.id);
      if (fx.type === 'SCHEDULE_NODE' && nodeSet.has(fx.nodeId))
        edges.push({ from: node.id, to: fx.nodeId, type: 'schedule' });
      if (fx.type === 'CREATE_SUBJUGATION_NODE') {
        const d = fx.definition;
        if (d.victoryNodeId && nodeSet.has(d.victoryNodeId)) edges.push({ from: node.id, to: d.victoryNodeId, type: 'victory' });
        if (d.defeatNodeId && nodeSet.has(d.defeatNodeId)) edges.push({ from: node.id, to: d.defeatNodeId, type: 'defeat' });
        for (const jId of d.journeyNodeIds) if (nodeSet.has(jId)) edges.push({ from: node.id, to: jId, type: 'journey' });
      }
    }
  }
  for (const node of story.nodes) {
    for (const cond of node.conditions) {
      if (cond.type === 'FACT_EXISTS' || cond.type === 'FACT_MISSING' || cond.type === 'DAYS_SINCE_FACT') {
        const setter = factSetters.get(cond.fact);
        if (setter && setter !== node.id) edges.push({ from: setter, to: node.id, type: 'fact', label: cond.fact });
      }
    }
  }
  return edges;
}

function renderEdgeLayer(layer: SVGGElement, story: NarrativeStory): void {
  layer.innerHTML = '';
  for (const edge of buildGraphEdges(story)) {
    const fp = graphPositions[edge.from], tp = graphPositions[edge.to];
    if (!fp || !tp) continue;
    const x1 = fp.x + GRAPH_NODE_W, y1 = fp.y + GRAPH_NODE_H / 2;
    const x2 = tp.x, y2 = tp.y + GRAPH_NODE_H / 2;
    const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
    const path = svgEl<SVGPathElement>('path');
    path.setAttribute('d', `M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('class', `graph-edge graph-edge-${edge.type}`);
    path.setAttribute('marker-end', `url(#arrow-${edge.type})`);
    layer.appendChild(path);
    if (edge.label) {
      const t = svgEl<SVGTextElement>('text');
      t.setAttribute('x', String((x1 + x2) / 2));
      t.setAttribute('y', String((y1 + y2) / 2 - 6));
      t.setAttribute('class', 'graph-edge-label');
      t.textContent = edge.label;
      layer.appendChild(t);
    }
  }
}

function applyGraphTransform(): void {
  const rootG = bySvgId<SVGGElement>('graph-root-g');
  if (rootG) {
    rootG.setAttribute('transform', `translate(${graphPanX}, ${graphPanY}) scale(${graphZoom})`);
  }
  const zoomVal = byId('graph-zoom-val');
  if (zoomVal) zoomVal.textContent = `${Math.round(graphZoom * 100)}%`;
}

function renderGraphCanvas(): void {
  const story = activeStory();
  const svg = bySvgId<SVGSVGElement>('story-graph-svg');
  if (!svg) return;
  svg.innerHTML = '';

  if (!story || story.nodes.length === 0) {
    return;
  }

  loadGraphPos(story.id);
  autoLayoutMissing(story.nodes);

  // 箭頭 marker defs
  const defs = svgEl('defs');
  const MARKERS: [string, string][] = [
    ['arrow-fact', '#d4a017'], ['arrow-schedule', '#60a5fa'],
    ['arrow-victory', '#86efac'], ['arrow-defeat', '#fca5a5'], ['arrow-journey', '#c084fc']
  ];
  for (const [id, color] of MARKERS) {
    const m = svgEl('marker');
    m.setAttribute('id', id); m.setAttribute('markerWidth', '8'); m.setAttribute('markerHeight', '6');
    m.setAttribute('refX', '7'); m.setAttribute('refY', '3'); m.setAttribute('orient', 'auto');
    const poly = svgEl('polygon');
    poly.setAttribute('points', '0 0, 8 3, 0 6'); poly.setAttribute('fill', color);
    m.appendChild(poly); defs.appendChild(m);
  }
  svg.appendChild(defs);

  // 主群組（受 Zoom & Pan Transform 控制）
  const rootG = svgEl<SVGGElement>('g');
  rootG.id = 'graph-root-g';
  svg.appendChild(rootG);

  const edgeLayer = svgEl<SVGGElement>('g'); edgeLayer.id = 'graph-edge-layer';
  const nodeLayer = svgEl<SVGGElement>('g'); nodeLayer.id = 'graph-node-layer';
  rootG.appendChild(edgeLayer);
  rootG.appendChild(nodeLayer);

  renderEdgeLayer(edgeLayer, story);

  // 繪製節點
  for (const node of story.nodes) {
    const pos = graphPositions[node.id] ?? { x: 40, y: 40 };
    const g = svgEl<SVGGElement>('g');
    g.setAttribute('class', `graph-node${node.id === selectedNodeId ? ' graph-node-selected' : ''}${graphWireSource === node.id ? ' graph-node-wire-src' : ''}`);
    g.dataset.nodeId = node.id;
    g.setAttribute('transform', `translate(${pos.x},${pos.y})`);

    const rect = svgEl<SVGRectElement>('rect');
    rect.setAttribute('width', String(GRAPH_NODE_W)); rect.setAttribute('height', String(GRAPH_NODE_H));
    rect.setAttribute('rx', '7'); rect.setAttribute('class', 'graph-node-rect');
    g.appendChild(rect);

    // Channel badge
    const bgR = svgEl<SVGRectElement>('rect');
    bgR.setAttribute('x', '10'); bgR.setAttribute('y', '10');
    bgR.setAttribute('width', '64'); bgR.setAttribute('height', '16');
    bgR.setAttribute('rx', '8'); bgR.setAttribute('class', 'graph-node-channel-bg');
    g.appendChild(bgR);

    const chTxt = svgEl<SVGTextElement>('text');
    chTxt.setAttribute('x', '42'); chTxt.setAttribute('y', '22');
    chTxt.setAttribute('text-anchor', 'middle'); chTxt.setAttribute('class', 'graph-node-channel-txt');
    chTxt.textContent = channelName(node.channel);
    g.appendChild(chTxt);

    // 標題
    const titleTxt = svgEl<SVGTextElement>('text');
    titleTxt.setAttribute('x', '10'); titleTxt.setAttribute('y', '48');
    titleTxt.setAttribute('class', 'graph-node-title-txt');
    titleTxt.textContent = node.title.length > 20 ? node.title.slice(0, 20) + '…' : node.title;
    g.appendChild(titleTxt);

    // ID
    const idTxt = svgEl<SVGTextElement>('text');
    idTxt.setAttribute('x', '10'); idTxt.setAttribute('y', '63');
    idTxt.setAttribute('class', 'graph-node-id-txt');
    idTxt.textContent = node.id.length > 26 ? node.id.slice(0, 26) + '…' : node.id;
    g.appendChild(idTxt);

    // 條件數 & 效果數
    const meta = `${node.conditions.length > 0 ? `⚙ ${node.conditions.length} 條件` : ''}${node.completionEffects.length > 0 ? `  ✦ ${node.completionEffects.length} 效果` : ''}`.trim();
    if (meta) {
      const metaTxt = svgEl<SVGTextElement>('text');
      metaTxt.setAttribute('x', '10'); metaTxt.setAttribute('y', '80');
      metaTxt.setAttribute('class', 'graph-node-meta-txt');
      metaTxt.textContent = meta;
      g.appendChild(metaTxt);
    }

    // 輸出埠
    const portOut = svgEl<SVGCircleElement>('circle');
    portOut.setAttribute('cx', String(GRAPH_NODE_W)); portOut.setAttribute('cy', String(GRAPH_NODE_H / 2));
    portOut.setAttribute('r', '7');
    portOut.setAttribute('class', `graph-port-out${graphWireSource === node.id ? ' graph-port-active' : ''}`);
    portOut.dataset.portNode = node.id;
    g.appendChild(portOut);

    nodeLayer.appendChild(g);
  }

  // 輸出埠事件：牽線模式
  nodeLayer.querySelectorAll<SVGCircleElement>('[data-port-node]').forEach(port => {
    port.addEventListener('click', event => {
      event.stopPropagation();
      graphWireSource = graphWireSource === port.dataset.portNode! ? null : port.dataset.portNode!;
      const hint = byId('graph-wire-hint');
      if (hint) hint.hidden = !graphWireSource;
      renderGraphCanvas();
    });
  });

  // 節點事件：單擊選中高亮（留在畫布）或完成牽線
  nodeLayer.querySelectorAll<SVGGElement>('.graph-node').forEach(g => {
    const nodeId = g.dataset.nodeId!;
    g.addEventListener('click', event => {
      event.stopPropagation();
      if (graphWireSource && graphWireSource !== nodeId) {
        const srcId = graphWireSource;
        const srcNode = activeStory()?.nodes.find(n => n.id === srcId);
        if (srcNode && !srcNode.completionEffects.some(e => e.type === 'SCHEDULE_NODE' && e.nodeId === nodeId)) {
          srcNode.completionEffects.push({ type: 'SCHEDULE_NODE', nodeId, delayDays: 1 });
        }
        graphWireSource = null;
        const hint = byId('graph-wire-hint');
        if (hint) hint.hidden = true;
        selectNode(srcId);
        renderEdgeLayer(edgeLayer, story);
        return;
      }
      selectNode(nodeId);
    });
  });

  applyGraphTransform();
}

function fitGraphView(): void {
  const story = activeStory();
  const wrapper = byId('story-graph-wrapper');
  if (!story || story.nodes.length === 0 || !wrapper) return;

  const xs = story.nodes.map(n => graphPositions[n.id]?.x ?? 0);
  const ys = story.nodes.map(n => graphPositions[n.id]?.y ?? 0);
  const minX = Math.min(...xs), maxX = Math.max(...xs) + GRAPH_NODE_W;
  const minY = Math.min(...ys), maxY = Math.max(...ys) + GRAPH_NODE_H;

  const contentW = maxX - minX + 80;
  const contentH = maxY - minY + 80;
  const viewW = wrapper.clientWidth || 800;
  const viewH = wrapper.clientHeight || 500;

  const scale = Math.min(1.4, Math.max(0.4, Math.min(viewW / contentW, viewH / contentH)));
  graphZoom = Math.round(scale * 100) / 100;
  graphPanX = (viewW - contentW * graphZoom) / 2 - minX * graphZoom + 40 * graphZoom;
  graphPanY = (viewH - contentH * graphZoom) / 2 - minY * graphZoom + 40 * graphZoom;
  applyGraphTransform();
}

function initGraphInteractions(): void {
  const wrapper = byId('story-graph-wrapper');
  const svg = bySvgId<SVGSVGElement>('story-graph-svg');
  if (!wrapper || !svg) return;

  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let draggingNodeId: string | null = null;
  let dragNodeStartX = 0, dragNodeStartY = 0;
  let dragNodeInitX = 0, dragNodeInitY = 0;

  // 滑鼠左鍵按下：若是空白畫布 ➔ 拖動畫布平移 (Pan)；若是節點 ➔ 拖動節點 (Node Drag)
  svg.addEventListener('mousedown', event => {
    if (event.button !== 0) return; // 僅限左鍵
    const target = event.target as SVGElement;
    if (target.closest('[data-port-node]')) return; // 點輸出埠不拖動

    const nodeG = target.closest<SVGGElement>('.graph-node');
    if (nodeG) {
      // 拖曳節點
      draggingNodeId = nodeG.dataset.nodeId!;
      dragNodeStartX = event.clientX;
      dragNodeStartY = event.clientY;
      dragNodeInitX = graphPositions[draggingNodeId]?.x ?? 0;
      dragNodeInitY = graphPositions[draggingNodeId]?.y ?? 0;
      svg.style.cursor = 'grabbing';
      event.preventDefault();
    } else {
      // 空白畫布部位拖曳平移 (Pan)
      isPanning = true;
      panStartX = event.clientX - graphPanX;
      panStartY = event.clientY - graphPanY;
      svg.style.cursor = 'grabbing';
      event.preventDefault();
    }
  });

  window.addEventListener('mousemove', event => {
    if (isPanning) {
      graphPanX = event.clientX - panStartX;
      graphPanY = event.clientY - panStartY;
      applyGraphTransform();
    } else if (draggingNodeId) {
      const dx = (event.clientX - dragNodeStartX) / graphZoom;
      const dy = (event.clientY - dragNodeStartY) / graphZoom;
      const newX = Math.max(0, dragNodeInitX + dx);
      const newY = Math.max(0, dragNodeInitY + dy);
      graphPositions[draggingNodeId] = { x: newX, y: newY };
      const g = svg.querySelector<SVGGElement>(`.graph-node[data-node-id="${draggingNodeId}"]`);
      if (g) g.setAttribute('transform', `translate(${newX},${newY})`);
      const edgeLayer = svg.querySelector<SVGGElement>('#graph-edge-layer');
      if (edgeLayer && activeStory()) renderEdgeLayer(edgeLayer, activeStory()!);
    }
  });

  const stopPanOrDrag = () => {
    if (isPanning) {
      isPanning = false;
      svg.style.cursor = 'default';
    }
    if (draggingNodeId) {
      saveGraphPos(activeStory()!.id);
      draggingNodeId = null;
      svg.style.cursor = 'default';
    }
  };

  window.addEventListener('mouseup', stopPanOrDrag);

  // 滾輪縮放（以滑鼠指標為錨點）
  wrapper.addEventListener('wheel', (event: WheelEvent) => {
    event.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldZoom = graphZoom;
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(2.0, Math.max(0.3, Math.round(oldZoom * factor * 100) / 100));
    if (newZoom === oldZoom) return;

    graphPanX = mouseX - (mouseX - graphPanX) * (newZoom / oldZoom);
    graphPanY = mouseY - (mouseY - graphPanY) * (newZoom / oldZoom);
    graphZoom = newZoom;
    applyGraphTransform();
  }, { passive: false });

  // 縮放按鈕
  byId('btn-graph-zoom-in')?.addEventListener('click', () => {
    graphZoom = Math.min(2.0, Math.round((graphZoom + 0.15) * 100) / 100);
    applyGraphTransform();
  });
  byId('btn-graph-zoom-out')?.addEventListener('click', () => {
    graphZoom = Math.max(0.3, Math.round((graphZoom - 0.15) * 100) / 100);
    applyGraphTransform();
  });
  byId('btn-graph-zoom-reset')?.addEventListener('click', () => {
    graphZoom = 1.0;
    applyGraphTransform();
  });
  byId('btn-graph-fit')?.addEventListener('click', fitGraphView);

  // 重新排版
  byId('btn-graph-relayout')?.addEventListener('click', () => {
    const story = activeStory();
    if (!story) return;
    graphPositions = {};
    autoLayoutMissing(story.nodes);
    saveGraphPos(story.id);
    renderGraphCanvas();
    fitGraphView();
  });
}

// ── Fact Registry ──────────────────────────────────────────────────────────────

interface FactRegistryEntry {
  fact: string;
  writers: { storyId: string; storyTitle: string; nodeId: string; nodeTitle: string }[];
  readers: { storyId: string; storyTitle: string; nodeId: string; nodeTitle: string; conditionType: string }[];
  warnings: ('UNUSED_WRITE' | 'MISSING_WRITER' | 'CROSS_STORY' | 'DUPLICATE_WRITER')[];
}

function buildFactRegistry(storyList: typeof stories): Map<string, FactRegistryEntry> {
  const registry = new Map<string, FactRegistryEntry>();
  const ensure = (fact: string): FactRegistryEntry => {
    if (!registry.has(fact)) registry.set(fact, { fact, writers: [], readers: [], warnings: [] });
    return registry.get(fact)!;
  };

  for (const story of storyList) {
    for (const node of story.nodes) {
      const allEffects = [...node.completionEffects, ...node.choices.flatMap(c => c.effects)];
      for (const effect of allEffects) {
        if (effect.type === 'SET_FACT') {
          ensure(effect.fact).writers.push({ storyId: story.id, storyTitle: story.title, nodeId: node.id, nodeTitle: node.title });
        }
      }
      for (const condition of node.conditions) {
        if (condition.type === 'FACT_EXISTS' || condition.type === 'FACT_MISSING' || condition.type === 'DAYS_SINCE_FACT') {
          ensure(condition.fact).readers.push({ storyId: story.id, storyTitle: story.title, nodeId: node.id, nodeTitle: node.title, conditionType: condition.type });
        }
      }
    }
  }

  for (const entry of registry.values()) {
    const writerStories = new Set(entry.writers.map(w => w.storyId));
    const readerStories = new Set(entry.readers.map(r => r.storyId));
    const allStories = new Set([...writerStories, ...readerStories]);
    if (allStories.size > 1) entry.warnings.push('CROSS_STORY');
    if (entry.writers.length > 1) entry.warnings.push('DUPLICATE_WRITER');
    if (entry.writers.length > 0 && entry.readers.length === 0) entry.warnings.push('UNUSED_WRITE');
    if (entry.readers.length > 0 && entry.writers.length === 0) entry.warnings.push('MISSING_WRITER');
  }

  return registry;
}

function renderFactRegistry(query = ''): void {
  const registry = buildFactRegistry(stories);
  const listEl = byId('fact-registry-list');
  const statsEl = byId('fact-registry-stats');
  const lowerQuery = query.toLowerCase();

  const entries = [...registry.values()].filter(entry => {
    if (!lowerQuery) return true;
    if (entry.fact.toLowerCase().includes(lowerQuery)) return true;
    if (entry.writers.some(w => w.nodeTitle.toLowerCase().includes(lowerQuery) || w.storyTitle.toLowerCase().includes(lowerQuery))) return true;
    if (entry.readers.some(r => r.nodeTitle.toLowerCase().includes(lowerQuery) || r.storyTitle.toLowerCase().includes(lowerQuery))) return true;
    return false;
  }).sort((a, b) => {
    const warnA = a.warnings.includes('MISSING_WRITER') ? 0 : a.warnings.length > 0 ? 1 : 2;
    const warnB = b.warnings.includes('MISSING_WRITER') ? 0 : b.warnings.length > 0 ? 1 : 2;
    return warnA - warnB || a.fact.localeCompare(b.fact);
  });

  const totalWarns = [...registry.values()].filter(e => e.warnings.length > 0).length;
  statsEl.textContent = `共 ${registry.size} 個線索・${stories.length} 條故事${totalWarns > 0 ? `・⚠ ${totalWarns} 個警告` : ''}`;

  if (entries.length === 0) {
    listEl.innerHTML = `<div class="fact-empty">${query ? '沒有符合的搜尋結果。' : '目前沒有任何線索，請在節點效果中新增「新增線索」。'}</div>`;
    return;
  }

  listEl.innerHTML = '';
  for (const entry of entries) {
    const isCross = entry.warnings.includes('CROSS_STORY');
    const hasMissingWriter = entry.warnings.includes('MISSING_WRITER');
    const hasUnused = entry.warnings.includes('UNUSED_WRITE');
    const hasDuplicate = entry.warnings.includes('DUPLICATE_WRITER');

    const cardClasses = ['fact-card',
      hasMissingWriter ? 'warn-missing-writer' : '',
      hasUnused && !hasMissingWriter ? 'warn-unused-write' : '',
      isCross ? 'is-cross-story' : ''
    ].filter(Boolean).join(' ');

    const badges = [
      entry.writers.length > 0 ? `<span class="fact-badge write">設定 ${entry.writers.length}</span>` : '',
      entry.readers.length > 0 ? `<span class="fact-badge read">讀取 ${entry.readers.length}</span>` : '',
      isCross ? `<span class="fact-badge cross">跨故事</span>` : '',
      hasDuplicate ? `<span class="fact-badge warn">重複寫入</span>` : '',
      hasMissingWriter ? `<span class="fact-badge warn">⚠ 無來源</span>` : '',
      hasUnused ? `<span class="fact-badge warn">⚠ 未使用</span>` : '',
    ].filter(Boolean).join('');

    const writersHtml = entry.writers.length > 0 ? `
      <div class="fact-ref-group">
        <div class="fact-ref-group-title write-title">✏ 設定此線索的節點</div>
        ${entry.writers.map(w => `
          <div class="fact-ref-item" data-jump-story="${escapeHtml(w.storyId)}" data-jump-node="${escapeHtml(w.nodeId)}">
            <span class="fact-ref-story">${escapeHtml(w.storyTitle)}</span>
            <span class="fact-ref-node">${escapeHtml(w.nodeTitle)}</span>
          </div>`).join('')}
      </div>` : '';

    const conditionLabel: Record<string, string> = {
      FACT_EXISTS: '需要存在', FACT_MISSING: '需要不存在', DAYS_SINCE_FACT: '取得後等待'
    };
    const readersHtml = entry.readers.length > 0 ? `
      <div class="fact-ref-group">
        <div class="fact-ref-group-title read-title">👁 使用此線索的條件</div>
        ${entry.readers.map(r => `
          <div class="fact-ref-item" data-jump-story="${escapeHtml(r.storyId)}" data-jump-node="${escapeHtml(r.nodeId)}">
            <span class="fact-ref-story">${escapeHtml(r.storyTitle)}</span>
            <span class="fact-ref-node">${escapeHtml(r.nodeTitle)}</span>
            <span class="fact-ref-condition">${conditionLabel[r.conditionType] ?? r.conditionType}</span>
          </div>`).join('')}
      </div>` : '';

    const warnHtml = [
      hasMissingWriter ? `<div class="fact-warn-box missing-writer">⚠ 此線索在條件中被使用，但從未有任何節點透過「新增線索」效果來設定它。</div>` : '',
      hasUnused ? `<div class="fact-warn-box unused-write">⚠ 此線索已被設定，但目前沒有任何節點的條件用到它。</div>` : '',
      hasDuplicate ? `<div class="fact-warn-box unused-write">⚠ 多個節點都會設定此線索。</div>` : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = cardClasses;
    card.innerHTML = `
      <div class="fact-card-header">
        <span class="fact-name">${escapeHtml(entry.fact)}</span>
        <div class="fact-badges">${badges}</div>
      </div>
      <div class="fact-card-body">
        ${writersHtml}${readersHtml}${warnHtml}
      </div>`;

    card.querySelector('.fact-card-header')!.addEventListener('click', () => card.classList.toggle('expanded'));

    card.querySelectorAll<HTMLElement>('[data-jump-story]').forEach(item => {
      item.addEventListener('click', event => {
        event.stopPropagation();
        selectedStoryId = item.dataset.jumpStory!;
        selectedNodeId = item.dataset.jumpNode!;
        switchTab('node-editor');
        render();
        selectNode(selectedNodeId, true);
      });
    });

    listEl.appendChild(card);
  }
}

// ── Tab 切換 ──

function switchTab(tabName: string): void {
  byId('tab-node-editor').hidden = tabName !== 'node-editor';
  byId('tab-fact-registry').hidden = tabName !== 'fact-registry';
  document.querySelectorAll('.story-tab').forEach(btn => {
    (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.tab === tabName);
  });
  if (tabName === 'fact-registry') renderFactRegistry(byId<HTMLInputElement>('fact-registry-search').value);
}

function bindTabEvents(): void {
  document.querySelectorAll('.story-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab((btn as HTMLElement).dataset.tab!));
  });
  byId('fact-registry-search')?.addEventListener('input', event => {
    renderFactRegistry((event.target as HTMLInputElement).value);
  });
}

function bindEvents(): void {
  byId('story-editor-story-search')?.addEventListener('input', event => {
    storySearchQuery = (event.target as HTMLInputElement).value;
    renderStoryList();
  });

  ['story-editor-story-title', 'story-editor-story-summary', 'story-editor-story-enabled'].forEach(id => byId(id)?.addEventListener('input', syncStory));
  byId('story-editor-node-form')?.addEventListener('input', syncNode);

  byId('btn-story-add-condition')?.addEventListener('click', () => {
    const node = activeNode(); if (!node) return;
    node.conditions.push(defaultCondition());
    renderConditionList(node); refreshEffectSummary();
  });

  byId('btn-pick-node-npc-avatar')?.addEventListener('click', () => {
    const node = activeNode(); if (!node) return;
    openAvatarPicker(avatarId => {
      node.npcAvatar = avatarId;
      setValue('story-node-npc-avatar', avatarId);
      const prev = byId('story-node-npc-avatar-preview');
      if (prev) prev.innerHTML = renderUniversalPortrait(avatarId, 32);
      syncNode();
    });
  });

  byId('btn-story-add-dialogue-page')?.addEventListener('click', () => {
    const node = activeNode(); if (!node) return;
    if (!node.dialoguePages) node.dialoguePages = [];
    const nextIdx = node.dialoguePages.length + 1;
    node.dialoguePages.push({
      speakerType: 'NPC',
      speakerName: node.npcName || '神秘訪客',
      speakerTitle: '【街角遇見的旅人】',
      speakerAvatar: node.npcAvatar || 'npc:npc_0',
      text: `第 ${nextIdx} 段對話內容...`
    });
    renderDialoguePagesList(node);
  });

  byId('btn-story-add-effect')?.addEventListener('click', () => {
    const node = activeNode(); if (!node) return;
    node.completionEffects.push(defaultEffect());
    renderForm(); refreshEffectSummary();
  });

  byId('btn-story-add-choice')?.addEventListener('click', () => {
    const node = activeNode(); if (!node) return;
    if (!node.choices) node.choices = [];
    const nextIndex = node.choices.length + 1;
    node.choices.push({ id: `choice_${nextIndex}`, text: `新選項 ${nextIndex}`, resultText: '', effects: [] });
    renderChoicesList(node);
    refreshEffectSummary();
  });

  byId('btn-story-new')?.addEventListener('click', () => {
    const id = uniqueId('new_story', stories.map(story => story.id));
    stories.push({ id, title: '新故事', summary: '', version: 1, enabled: false, nodes: [makeNode('opening')] });
    selectedStoryId = id; selectedNodeId = 'opening';
    graphPositions = {};
    render();
    fitGraphView();
  });

  byId('btn-story-add-node')?.addEventListener('click', () => {
    const story = activeStory(); if (!story) return;
    const id = uniqueId('new_node', story.nodes.map(node => node.id));
    story.nodes.push(makeNode(id));
    selectedNodeId = id;
    autoLayoutMissing(story.nodes);
    saveGraphPos(story.id);
    render();
    selectNode(id, true);
  });

  byId('btn-story-delete-node')?.addEventListener('click', () => {
    const story = activeStory(); if (!story || !activeNode() || !confirm(`刪除節點「${activeNode()!.title}」？`)) return;
    story.nodes = story.nodes.filter(node => node.id !== selectedNodeId);
    selectedNodeId = story.nodes[0]?.id ?? '';
    render();
  });

  byId('btn-story-publish')?.addEventListener('click', () => void saveProject().catch(error => alert(error.message)));
  byId('btn-story-test-node')?.addEventListener('click', testNode);
  byId('btn-story-history')?.addEventListener('click', () => void showHistory().catch(error => alert(error.message)));
  byId('btn-story-reset-progress')?.addEventListener('click', () => { if (confirm('放棄尚未寫入專案的修改，重新讀取磁碟？')) void loadFromProject(); });
  
  byId('btn-story-export')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(stories, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'stories.json'; link.click(); URL.revokeObjectURL(link.href);
  });

  byId('btn-close-story-editor')?.addEventListener('click', () => { window.close(); location.href = new URL('../', location.href).href; });
}

function setValue(id: string, next: string | number): void { byId<HTMLInputElement>(id).value = String(next); }
function uniqueId(prefix: string, used: string[]): string { let id = prefix; let index = 2; while (used.includes(id)) id = `${prefix}_${index++}`; return id; }
function describeConditions(conditions: NarrativeCondition[]): string { return conditions.length ? `觸發條件：${conditions.map(item => item.type).join('、')}` : '此節點沒有額外觸發條件。'; }
function channelName(channel: NarrativeNode['channel']): string {
  return ({
    BOUNTY_BOARD: '懸賞板', STREET_EVENT: '街道訪客', TAVERN_RUMOR: '酒館傳聞', TERRITORY_EVENT: '領地事件',
    TODO_LIST: '待辦清單', EXPLORATION: '發現據點時', SUBJUGATION: '討伐後',
    SUBJUGATION_JOURNEY: '討伐途中', STORY_NODE: '解鎖預設據點'
  } as const)[channel] ?? channel;
}
function escapeHtml(text: string): string { const span = document.createElement('span'); span.textContent = text; return span.innerHTML; }

/**
 * 🖼️ 開啟 NPC 肖像視覺化選擇器彈窗 (支援所有現有與未來新增的圖庫分類)
 */
function openAvatarPicker(onSelect: (avatarId: string) => void): void {
  const modal = byId('modal-story-avatar-picker');
  const catSelect = byId<HTMLSelectElement>('story-avatar-category-filter');
  const searchInput = byId<HTMLInputElement>('story-avatar-search-input');
  const grid = byId('story-avatar-picker-grid');
  const btnClose = byId('btn-close-story-avatar-picker');
  if (!modal || !catSelect || !searchInput || !grid) return;

  const allDatasets = (defaultCustomDatasets || {}) as Record<string, any>;
  const catKeys = Object.keys(allDatasets);

  // 初始化分類下拉選單
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
        padding: 8px 6px;
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

  const closeModal = () => {
    modal.style.display = 'none';
  };

  if (btnClose) btnClose.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  renderGrid();
  modal.style.display = 'flex';
}

async function bootstrap(): Promise<void> {
  await loadTemplate();
  bindTabEvents();
  bindEvents();
  initGraphInteractions();
  await loadFromProject();
  fitGraphView();
}

bootstrap().catch(error => {
  document.body.innerHTML = `<pre class="story-studio-error">故事工坊啟動失敗：${escapeHtml(error.message)}</pre>`;
});
