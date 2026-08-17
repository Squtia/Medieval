import { BUILTIN_STORIES } from '../data/StoryData';
import type { NarrativeChoice, NarrativeCondition, NarrativeEffect, NarrativeNode, NarrativeStory } from '../models/Narrative';
import { DataStore } from '../systems/DataStore';
import { TRADE_GOODS } from '../systems/MarketSystem';
import '../styles/story-editor.css';

const TEST_STORAGE_KEY = 'MEDIEVAL_STORY_TEST_PAYLOAD';
let stories: NarrativeStory[] = [];
let selectedStoryId = '';
let selectedNodeId = '';

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const value = (id: string): string => byId<HTMLInputElement>(id).value.trim();
const numberValue = (id: string): number => Number(byId<HTMLInputElement>(id).value) || 0;
const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));
const activeStory = (): NarrativeStory | undefined => stories.find(story => story.id === selectedStoryId);
const activeNode = (): NarrativeNode | undefined => activeStory()?.nodes.find(node => node.id === selectedNodeId);
const safeId = (text: string): string => text.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();

function makeNode(id: string): NarrativeNode {
  return { id, title: '新故事節點', description: '', channel: 'TERRITORY_EVENT', conditions: [], choices: [], completionEffects: [] };
}

async function loadTemplate(): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}src/templates/story-editor.html`);
  if (!response.ok) throw new Error('無法載入故事工坊介面');
  byId('story-studio-root').innerHTML = await response.text();
  byId('modal-story-editor').classList.add('active');
  document.querySelector('.story-editor-header h2')!.textContent = '🧭 故事工坊';
  document.querySelector('.story-editor-header p')!.textContent = '開發工具：編排、驗證、寫入專案，或用暫存內容進入遊戲測試。';
  document.querySelectorAll('.story-editor-section-title')[1].textContent = '故事線索索引';
  byId('btn-story-publish').textContent = '寫入專案';
  byId('btn-story-test-node').textContent = '在遊戲中測試';
  byId('btn-story-reset-progress').textContent = '重新讀取磁碟';
  const history = document.createElement('button');
  history.id = 'btn-story-history';
  history.className = 'action-btn';
  history.textContent = '歷史快照';
  byId('btn-story-export').before(history);
}

async function loadFromProject(): Promise<void> {
  const response = await fetch('/api/get-story-definitions');
  if (!response.ok) throw new Error('讀取專案故事失敗');
  const loaded = await response.json();
  stories = clone(Array.isArray(loaded) && loaded.length > 0 ? loaded : BUILTIN_STORIES);
  selectedStoryId = stories[0]?.id ?? '';
  selectedNodeId = stories[0]?.nodes[0]?.id ?? '';
  render();
}

function render(): void {
  const story = activeStory();
  const select = byId<HTMLSelectElement>('story-editor-story-select');
  select.innerHTML = stories.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)} (${escapeHtml(item.id)})</option>`).join('');
  select.value = selectedStoryId;
  byId<HTMLInputElement>('story-editor-story-title').value = story?.title ?? '';
  byId<HTMLTextAreaElement>('story-editor-story-summary').value = story?.summary ?? '';
  byId<HTMLInputElement>('story-editor-story-enabled').checked = story?.enabled ?? false;
  renderFacts();
  renderNodes();
  renderForm();
  renderValidation();
}

function renderFacts(): void {
  const facts = activeStory()?.nodes.flatMap(node => [
    ...node.completionEffects,
    ...node.choices.flatMap(choice => choice.effects)
  ].filter((effect): effect is Extract<NarrativeEffect, { type: 'SET_FACT' }> => effect.type === 'SET_FACT').map(effect => `${effect.fact} ← ${node.title}`)) ?? [];
  byId('story-editor-facts').textContent = facts.length ? [...new Set(facts)].join('\n') : '尚未設定故事線索。';
}

function renderNodes(): void {
  const list = byId('story-editor-node-list');
  list.innerHTML = '';
  for (const node of activeStory()?.nodes ?? []) {
    const card = document.createElement('button');
    card.className = `story-node-card${node.id === selectedNodeId ? ' selected' : ''}`;
    card.innerHTML = `<span class="story-node-channel">${channelName(node.channel)}</span><h4>${escapeHtml(node.title)}</h4><p>${escapeHtml(node.id)}</p>`;
    card.addEventListener('click', () => { selectedNodeId = node.id; render(); });
    list.appendChild(card);
  }
}

function renderForm(): void {
  const node = activeNode();
  byId('story-editor-empty').hidden = !!node;
  byId('story-editor-node-form').hidden = !node;
  if (!node) return;
  setValue('story-node-id', node.id);
  setValue('story-node-channel', node.channel);
  setValue('story-node-title', node.title);
  setValue('story-node-description', node.description);
  setValue('story-node-target-map', node.targetNodeId ?? '');
  setValue('story-node-bounty-duration', node.bounty?.duration ?? 2);
  setValue('story-node-bounty-expire', node.bounty?.expireDays ?? 30);
  setValue('story-node-bounty-gold', node.bounty?.gold ?? 50);
  setValue('story-node-bounty-exp', node.bounty?.exp ?? 30);
  for (const index of [0, 1]) {
    const choice = node.choices[index];
    setValue(`story-node-choice-${index + 1}`, choice?.text ?? '');
    setValue(`story-node-choice-result-${index + 1}`, choice?.resultText ?? '');
  }
  renderConditionList(node);
  renderEffectList('story-node-effects-list', node.completionEffects, effects => { node.completionEffects = effects; refreshEffectSummary(); });
  renderEffectList('story-node-choice-effects-1', node.choices[0]?.effects ?? [], effects => updateChoiceEffects(0, effects));
  renderEffectList('story-node-choice-effects-2', node.choices[1]?.effects ?? [], effects => updateChoiceEffects(1, effects));
  byId('story-editor-bounty-fields').hidden = node.channel !== 'BOUNTY_BOARD';
  byId('story-editor-map-target-fields').hidden = node.channel !== 'STORY_NODE';
  byId('story-editor-blocked-reasons').textContent = describeConditions(node.conditions);
}

function syncStory(): void {
  const story = activeStory();
  if (!story) return;
  story.title = value('story-editor-story-title') || story.id;
  story.summary = value('story-editor-story-summary');
  story.enabled = byId<HTMLInputElement>('story-editor-story-enabled').checked;
  renderNodes();
  renderValidation();
}

function syncNode(): void {
  const node = activeNode();
  if (!node) return;
  const oldId = node.id;
  node.id = safeId(value('story-node-id')) || oldId;
  selectedNodeId = node.id;
  node.channel = byId<HTMLSelectElement>('story-node-channel').value as NarrativeNode['channel'];
  node.title = value('story-node-title') || node.id;
  node.description = value('story-node-description');
  node.targetNodeId = node.channel === 'STORY_NODE' ? value('story-node-target-map') || undefined : undefined;
  node.bounty = node.channel === 'BOUNTY_BOARD' ? {
    duration: Math.max(1, numberValue('story-node-bounty-duration')),
    expireDays: Math.max(1, numberValue('story-node-bounty-expire')),
    gold: Math.max(0, numberValue('story-node-bounty-gold')),
    exp: Math.max(0, numberValue('story-node-bounty-exp'))
  } : undefined;
  node.choices = [0, 1].flatMap(index => {
    const text = value(`story-node-choice-${index + 1}`);
    if (!text) return [];
    const existingChoice = node.choices[index];
    const choice: NarrativeChoice = {
      id: `choice_${index + 1}`,
      text,
      resultText: value(`story-node-choice-result-${index + 1}`),
      effects: existingChoice?.effects ?? []
    };
    return [choice];
  });
  renderFacts();
  renderNodes();
  renderValidation();
  byId('story-editor-bounty-fields').hidden = node.channel !== 'BOUNTY_BOARD';
  byId('story-editor-map-target-fields').hidden = node.channel !== 'STORY_NODE';
}

const CONDITION_LABELS: Record<NarrativeCondition['type'], string> = {
  DAY_AT_LEAST: '最早遊戲日', TAVERN_LEVEL_AT_LEAST: '最低酒館等級', PRESTIGE_AT_LEAST: '最低聲望',
  FACT_EXISTS: '需要線索', FACT_MISSING: '必須尚無線索', DAYS_SINCE_FACT: '取得線索後等待', NODE_EXPLORED: '需要已發現據點'
};

function defaultCondition(type: NarrativeCondition['type'] = 'FACT_EXISTS'): NarrativeCondition {
  switch (type) {
    case 'DAY_AT_LEAST': case 'TAVERN_LEVEL_AT_LEAST': case 'PRESTIGE_AT_LEAST': return { type, value: 1 };
    case 'FACT_EXISTS': case 'FACT_MISSING': return { type, fact: 'new_fact' };
    case 'DAYS_SINCE_FACT': return { type, fact: 'new_fact', value: 1 };
    case 'NODE_EXPLORED': return { type, nodeId: '' };
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
  const input = (label: string, field: string, current: string | number, type = 'text') => `<label>${label}<input data-field="${field}" type="${type}" value="${escapeHtml(String(current))}"></label>`;
  switch (condition.type) {
    case 'DAY_AT_LEAST': case 'TAVERN_LEVEL_AT_LEAST': case 'PRESTIGE_AT_LEAST': return input('門檻數值', 'value', condition.value, 'number');
    case 'FACT_EXISTS': case 'FACT_MISSING': return input('線索代號', 'fact', condition.fact);
    case 'DAYS_SINCE_FACT': return `${input('線索代號', 'fact', condition.fact)}${input('等待天數', 'value', condition.value, 'number')}`;
    case 'NODE_EXPLORED': return input('地圖節點 ID', 'nodeId', condition.nodeId);
  }
}

function updateChoiceEffects(index: number, effects: NarrativeEffect[]): void {
  const node = activeNode();
  if (!node) return;
  while (node.choices.length <= index) {
    const next = node.choices.length + 1;
    node.choices.push({ id: `choice_${next}`, text: `新選項 ${next}`, resultText: '', effects: [] });
  }
  node.choices[index].effects = effects;
  setValue(`story-node-choice-${index + 1}`, node.choices[index].text);
  refreshEffectSummary();
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
    case 'GRANT_MATERIAL': return { type, itemId: 'mat_iron_ingot', quantity: 1 };
    case 'GRANT_TRADE_GOOD': return { type, itemId: 'tg_spice', quantity: 1 };
    case 'GRANT_EQUIPMENT': return { type, templateId: 'wpn_iron_greatsword', quantity: 1 };
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
  SET_FACT: '新增線索', ADD_GOLD: '金幣變化', ADD_PRESTIGE: '聲望變化', ADD_RESTED_EXP: '經驗池獎勵',
  GRANT_MATERIAL: '給予素材', GRANT_TRADE_GOOD: '給予貿易品', GRANT_EQUIPMENT: '給予裝備',
  SCHEDULE_NODE: '延遲排程節點', UNLOCK_MAP_NODE: '解鎖預設地圖據點', CREATE_SUBJUGATION_NODE: '創造故事討伐據點'
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
        setter([...effects]); refreshEffectSummary();
      });
    });
    container.appendChild(row);
  });
}

function effectFields(effect: NarrativeEffect): string {
  const input = (label: string, field: string, current: string | number, type = 'text') => `<label>${label}<input data-field="${field}" type="${type}" value="${escapeHtml(String(current))}"></label>`;
  switch (effect.type) {
    case 'SET_FACT': return input('線索代號', 'fact', effect.fact);
    case 'ADD_GOLD': case 'ADD_PRESTIGE': case 'ADD_RESTED_EXP': return input('數量', 'value', effect.value, 'number');
    case 'GRANT_MATERIAL': case 'GRANT_TRADE_GOOD': return `${input('物品 ID', 'itemId', effect.itemId)}${input('數量', 'quantity', effect.quantity, 'number')}`;
    case 'GRANT_EQUIPMENT': return `${input('裝備模板 ID', 'templateId', effect.templateId)}${input('數量', 'quantity', effect.quantity, 'number')}`;
    case 'SCHEDULE_NODE': return `${input('節點代號', 'nodeId', effect.nodeId)}${input('幾天後', 'delayDays', effect.delayDays, 'number')}`;
    case 'UNLOCK_MAP_NODE': return input('既有地圖節點 ID', 'nodeId', effect.nodeId);
    case 'CREATE_SUBJUGATION_NODE': {
      const definition = effect.definition;
      const select = (label: string, field: string, current: string, choices: string[]) => `<label>${label}<select data-field="definition.${field}">${choices.map(choice => `<option value="${choice}"${choice === current ? ' selected' : ''}>${choice}</option>`).join('')}</select></label>`;
      return `<div class="story-subjugation-grid">
        ${input('據點代號', 'definition.nodeId', definition.nodeId)}${input('據點名稱', 'definition.name', definition.name)}
        <label class="wide">據點描述<textarea data-field="definition.description" rows="2">${escapeHtml(definition.description)}</textarea></label>
        ${select('生成位置', 'placement', definition.placement, ['NEAR_PLAYER', 'NEAR_NODE', 'FIXED'])}${input('錨點地圖 ID', 'definition.anchorNodeId', definition.anchorNodeId ?? '')}
        ${input('距離', 'definition.radius', definition.radius ?? 8, 'number')}${input('固定 X', 'definition.x', definition.x ?? 50, 'number')}${input('固定 Y', 'definition.y', definition.y ?? 50, 'number')}
        ${select('地形', 'terrain', definition.terrain, ['PLAINS','FOREST','SNOW_MOUNTAIN','VOLCANO','DESERT','CAVE','RUINS','WILDERNESS'])}${input('難度 1～10', 'definition.difficulty', definition.difficulty, 'number')}
        ${select('敵軍特性', 'enemyFeature', definition.enemyFeature ?? 'BALANCED', ['BALANCED','HIGH_DEF','HIGH_EVADE'])}${input('主題怪物 ID（可留空）', 'definition.monsterId', definition.monsterId ?? '')}
        ${input('途中事件節點（逗號分隔）', 'definition.journeyNodeIds', definition.journeyNodeIds.join(','))}${input('勝利後節點', 'definition.victoryNodeId', definition.victoryNodeId ?? '')}${input('失敗後節點', 'definition.defeatNodeId', definition.defeatNodeId ?? '')}
        <label class="story-editor-check"><input data-field="definition.requiresScouting" type="checkbox"${definition.requiresScouting ? ' checked' : ''}> 需要先偵查</label>
        <label class="story-editor-check"><input data-field="definition.removeOnVictory" type="checkbox"${definition.removeOnVictory ? ' checked' : ''}> 勝利後移除據點</label>
      </div>`;
    }
  }
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
        if (effect.type === 'GRANT_MATERIAL' && !DataStore.MaterialDB[effect.itemId]) errors.push(`${node.id} 使用不存在的素材 ID：${effect.itemId}`);
        if (effect.type === 'GRANT_TRADE_GOOD' && !TRADE_GOODS.some(item => item.id === effect.itemId)) errors.push(`${node.id} 使用不存在的貿易品 ID：${effect.itemId}`);
        if (effect.type === 'GRANT_EQUIPMENT' && !DataStore.getEquipmentTemplate(effect.templateId)) errors.push(`${node.id} 使用不存在的裝備模板：${effect.templateId}`);
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

function bindEvents(): void {
  byId('story-editor-story-select').addEventListener('change', event => { selectedStoryId = (event.target as HTMLSelectElement).value; selectedNodeId = activeStory()?.nodes[0]?.id ?? ''; render(); });
  ['story-editor-story-title', 'story-editor-story-summary', 'story-editor-story-enabled'].forEach(id => byId(id).addEventListener('input', syncStory));
  byId('story-editor-node-form').addEventListener('input', syncNode);
  byId('btn-story-add-condition').addEventListener('click', () => {
    const node = activeNode(); if (!node) return;
    node.conditions.push(defaultCondition());
    renderConditionList(node); refreshEffectSummary();
  });
  byId('btn-story-add-effect').addEventListener('click', () => {
    const node = activeNode(); if (!node) return;
    node.completionEffects.push(defaultEffect());
    renderForm(); refreshEffectSummary();
  });
  for (const choiceNumber of [1, 2]) {
    byId(`btn-story-add-choice-effect-${choiceNumber}`).addEventListener('click', () => {
      const node = activeNode(); if (!node) return;
      const index = choiceNumber - 1;
      const effects = [...(node.choices[index]?.effects ?? []), defaultEffect()];
      updateChoiceEffects(index, effects);
      renderForm();
    });
  }
  byId('btn-story-new').addEventListener('click', () => {
    const id = uniqueId('new_story', stories.map(story => story.id));
    stories.push({ id, title: '新故事', summary: '', version: 1, enabled: false, nodes: [makeNode('opening')] });
    selectedStoryId = id; selectedNodeId = 'opening'; render();
  });
  byId('btn-story-add-node').addEventListener('click', () => {
    const story = activeStory(); if (!story) return;
    const id = uniqueId('new_node', story.nodes.map(node => node.id));
    story.nodes.push(makeNode(id)); selectedNodeId = id; render();
  });
  byId('btn-story-delete-node').addEventListener('click', () => {
    const story = activeStory(); if (!story || !activeNode() || !confirm(`刪除節點「${activeNode()!.title}」？`)) return;
    story.nodes = story.nodes.filter(node => node.id !== selectedNodeId); selectedNodeId = story.nodes[0]?.id ?? ''; render();
  });
  byId('btn-story-publish').addEventListener('click', () => void saveProject().catch(error => alert(error.message)));
  byId('btn-story-test-node').addEventListener('click', testNode);
  byId('btn-story-history').addEventListener('click', () => void showHistory().catch(error => alert(error.message)));
  byId('btn-story-reset-progress').addEventListener('click', () => { if (confirm('放棄尚未寫入專案的修改，重新讀取磁碟？')) void loadFromProject(); });
  byId('btn-story-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(stories, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'stories.json'; link.click(); URL.revokeObjectURL(link.href);
  });
  byId('btn-close-story-editor').addEventListener('click', () => { window.close(); location.href = new URL('../', location.href).href; });
}

function setValue(id: string, next: string | number): void { byId<HTMLInputElement>(id).value = String(next); }
function uniqueId(prefix: string, used: string[]): string { let id = prefix; let index = 2; while (used.includes(id)) id = `${prefix}_${index++}`; return id; }
function describeConditions(conditions: NarrativeCondition[]): string { return conditions.length ? `觸發條件：${conditions.map(item => item.type).join('、')}` : '此節點沒有額外觸發條件。'; }
function channelName(channel: NarrativeNode['channel']): string { return ({ BOUNTY_BOARD: '懸賞板', TAVERN_RUMOR: '酒館傳聞', TERRITORY_EVENT: '領地事件', EXPLORATION: '發現據點時', SUBJUGATION: '討伐後', SUBJUGATION_JOURNEY: '討伐途中', STORY_NODE: '解鎖預設據點' } as const)[channel]; }
function escapeHtml(text: string): string { const span = document.createElement('span'); span.textContent = text; return span.innerHTML; }

async function bootstrap(): Promise<void> { await loadTemplate(); bindEvents(); await loadFromProject(); }
bootstrap().catch(error => { document.body.innerHTML = `<pre class="story-studio-error">故事工坊啟動失敗：${escapeHtml(error.message)}</pre>`; });
