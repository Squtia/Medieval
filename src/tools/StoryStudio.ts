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
  buildSharedDatalists();
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
  const story = activeStory();
  if (!story) return;

  // 預建引用索引：哪些 nodeId 被其他節點引用（SCHEDULE_NODE / 討伐流程）
  const refCount: Record<string, number> = {};
  for (const node of story.nodes) {
    const allEffects = [...node.completionEffects, ...node.choices.flatMap(c => c.effects)];
    for (const effect of allEffects) {
      if (effect.type === 'SCHEDULE_NODE') refCount[effect.nodeId] = (refCount[effect.nodeId] ?? 0) + 1;
      if (effect.type === 'CREATE_SUBJUGATION_NODE') {
        for (const tid of [...effect.definition.journeyNodeIds, effect.definition.victoryNodeId, effect.definition.defeatNodeId].filter(Boolean) as string[]) {
          refCount[tid] = (refCount[tid] ?? 0) + 1;
        }
      }
    }
  }

  for (const node of story.nodes) {
    const factCount = [...node.completionEffects, ...node.choices.flatMap(c => c.effects)].filter(e => e.type === 'SET_FACT').length;
    const refs = refCount[node.id] ?? 0;
    const metaBadges = [
      factCount > 0 ? `<span class="sn-badge sn-badge-fact">✏ ${factCount} 線索</span>` : '',
      refs > 0 ? `<span class="sn-badge sn-badge-ref">← 被引用 ${refs}</span>` : '',
    ].filter(Boolean).join('');

    const card = document.createElement('button');
    card.className = `story-node-card${node.id === selectedNodeId ? ' selected' : ''}`;
    card.innerHTML = `<span class="story-node-channel">${channelName(node.channel)}</span><h4>${escapeHtml(node.title)}</h4><p>${escapeHtml(node.id)}</p>${metaBadges ? `<div class="sn-meta">${metaBadges}</div>` : ''}`;
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
  FACT_EXISTS: '需要線索', FACT_MISSING: '必須尚無線索', DAYS_SINCE_FACT: '取得線索後等待', NODE_EXPLORED: '需要已發現據點',
  SUBJUGATION_COUNT_AT_LEAST: '動態討伐累積數'
};

function defaultCondition(type: NarrativeCondition['type'] = 'FACT_EXISTS'): NarrativeCondition {
  switch (type) {
    case 'DAY_AT_LEAST': case 'TAVERN_LEVEL_AT_LEAST': case 'PRESTIGE_AT_LEAST': return { type, value: 1 };
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
  switch (condition.type) {
    case 'DAY_AT_LEAST': case 'TAVERN_LEVEL_AT_LEAST': case 'PRESTIGE_AT_LEAST': return input('門檻數值', 'value', condition.value, 'number');
    case 'FACT_EXISTS': case 'FACT_MISSING': return input('線索代號', 'fact', condition.fact, 'text', 'story-fact-datalist');
    case 'DAYS_SINCE_FACT': return `${input('線索代號', 'fact', condition.fact, 'text', 'story-fact-datalist')}${input('等待天數', 'value', condition.value, 'number')}`;
    case 'NODE_EXPLORED': return input('地圖節點 ID', 'nodeId', condition.nodeId);
    case 'SUBJUGATION_COUNT_AT_LEAST': return input('最少討伐數（動態據點）', 'value', condition.value, 'number');
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
  const input = (label: string, field: string, current: string | number, type = 'text', list = '') =>
    `<label>${label}<input data-field="${field}" type="${type}" value="${escapeHtml(String(current))}"${list ? ` list="${list}"` : ''}></label>`;

  // 建立同故事節點下拉（用於 SCHEDULE_NODE 與討伐流程）
  const storyNodes = activeStory()?.nodes ?? [];
  const nodeSelect = (label: string, field: string, currentVal: string) => {
    const opts = ['', ...storyNodes.map(n => n.id)]
      .map(id => `<option value="${escapeHtml(id)}"${id === currentVal ? ' selected' : ''}>${id ? escapeHtml(id) : '(不設定)'}</option>`).join('');
    return `<label>${label}<select data-field="${field}">${opts}</select></label>`;
  };

  switch (effect.type) {
    case 'SET_FACT': return input('線索代號', 'fact', effect.fact, 'text', 'story-fact-datalist');
    case 'ADD_GOLD': case 'ADD_PRESTIGE': case 'ADD_RESTED_EXP': return input('數量', 'value', effect.value, 'number');
    case 'GRANT_MATERIAL': return `${input('素材 ID', 'itemId', effect.itemId, 'text', 'story-material-datalist')}${input('數量', 'quantity', effect.quantity, 'number')}`;
    case 'GRANT_TRADE_GOOD': return `${input('貿易品 ID', 'itemId', effect.itemId, 'text', 'story-tradegood-datalist')}${input('數量', 'quantity', effect.quantity, 'number')}`;
    case 'GRANT_EQUIPMENT': return `${input('裝備模板 ID', 'templateId', effect.templateId)}${input('數量', 'quantity', effect.quantity, 'number')}`;
    case 'SCHEDULE_NODE': return `${nodeSelect('延遲發佈節點', 'nodeId', effect.nodeId)}${input('幾天後', 'delayDays', effect.delayDays, 'number')}`;
    case 'UNLOCK_MAP_NODE': return input('既有地圖節點 ID（非故事節點）', 'nodeId', effect.nodeId);
    case 'CREATE_SUBJUGATION_NODE': {
      const definition = effect.definition;
      const enumSelect = (label: string, field: string, current: string, choices: string[]) =>
        `<label>${label}<select data-field="definition.${field}">${choices.map(c => `<option value="${c}"${c === current ? ' selected' : ''}>${c}</option>`).join('')}</select></label>`;
      return `<div class="story-subjugation-grid">
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

// 建立並更新共享 datalist（Fact / 素材 / 貿易品），掛在 body 上供各 input 引用
function buildSharedDatalists(): void {
  const ensureDL = (id: string, options: { value: string; label: string }[]): void => {
    let dl = document.getElementById(id) as HTMLDataListElement | null;
    if (!dl) { dl = document.createElement('datalist'); dl.id = id; document.body.appendChild(dl); }
    dl.innerHTML = options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
  };

  // Fact 候選：從全部故事掃描
  const factKeys = [...buildFactRegistry(stories).keys()];
  ensureDL('story-fact-datalist', factKeys.map(f => ({ value: f, label: f })));

  // 素材候選
  const materialIds = Object.keys(DataStore.MaterialDB);
  ensureDL('story-material-datalist', materialIds.map(id => ({ value: id, label: id })));

  // 貿易品候選
  ensureDL('story-tradegood-datalist', TRADE_GOODS.map(g => ({ value: g.id, label: g.name ?? g.id })));
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

  // 分析警告
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
    // 警告項排前面
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
      hasMissingWriter ? `<div class="fact-warn-box missing-writer">⚠ 此線索在條件中被使用，但從未有任何節點透過「新增線索」效果來設定它。可能是拼寫錯誤，或對應的節點尚未建立。</div>` : '',
      hasUnused ? `<div class="fact-warn-box unused-write">⚠ 此線索已被設定，但目前沒有任何節點的條件用到它。可能是未使用的旗標，或條件名稱拼寫錯誤。</div>` : '',
      hasDuplicate ? `<div class="fact-warn-box unused-write">⚠ 多個節點都會設定此線索，若觸發順序不同可能影響故事流程。請確認是否為預期行為。</div>` : '',
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

    // 展開/收合
    card.querySelector('.fact-card-header')!.addEventListener('click', () => card.classList.toggle('expanded'));

    // 跳轉到節點編輯
    card.querySelectorAll<HTMLElement>('[data-jump-story]').forEach(item => {
      item.addEventListener('click', event => {
        event.stopPropagation();
        const sId = item.dataset.jumpStory!;
        const nId = item.dataset.jumpNode!;
        selectedStoryId = sId;
        selectedNodeId = nId;
        switchTab('node-editor');
        render();
      });
    });

    listEl.appendChild(card);
  }
}

// ── Phase 3: SVG 流程圖畫布 ───────────────────────────────────────────────────

const GRAPH_NODE_W = 210;
const GRAPH_NODE_H = 96;
const GRAPH_H_GAP = 264;
const GRAPH_V_GAP = 128;
const GRAPH_COLS = 4;
const GRAPH_POS_KEY = 'MEDIEVAL_STORY_GRAPH_POS';

type GraphEdgeType = 'fact' | 'schedule' | 'victory' | 'defeat' | 'journey';
interface GraphEdge { from: string; to: string; type: GraphEdgeType; label?: string; }

let graphPositions: Record<string, { x: number; y: number }> = {};
let graphWireSource: string | null = null;

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = <T extends SVGElement>(tag: string): T => document.createElementNS(SVG_NS, tag) as T;

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

function renderGraphCanvas(): void {
  const story = activeStory();
  const container = byId('tab-graph-canvas');
  container.innerHTML = '';

  if (!story || story.nodes.length === 0) {
    container.innerHTML = '<div class="graph-canvas-placeholder"><span>📭</span><p>目前故事沒有節點。</p></div>';
    return;
  }

  loadGraphPos(story.id);
  autoLayoutMissing(story.nodes);

  const maxX = Math.max(...story.nodes.map(n => (graphPositions[n.id]?.x ?? 0) + GRAPH_NODE_W + 60));
  const maxY = Math.max(...story.nodes.map(n => (graphPositions[n.id]?.y ?? 0) + GRAPH_NODE_H + 60));

  // 工具列
  const toolbar = document.createElement('div');
  toolbar.className = 'graph-toolbar';
  toolbar.innerHTML = `
    <span class="graph-toolbar-legend">
      <span class="graph-legend-item legend-fact">── Fact 依賴</span>
      <span class="graph-legend-item legend-schedule">── 排程</span>
      <span class="graph-legend-item legend-victory">── 討伐勝利</span>
      <span class="graph-legend-item legend-defeat">── 討伐失敗</span>
      <span class="graph-legend-item legend-journey">╌╌ 討伐途中</span>
    </span>
    <span id="graph-wire-hint" class="graph-wire-hint" hidden>🔌 點擊另一個節點建立「排程」連線，或再次點擊輸出埠取消</span>
    <button id="btn-graph-relayout" class="action-btn">🔀 重新排版</button>
  `;
  container.appendChild(toolbar);

  const wrapper = document.createElement('div');
  wrapper.className = 'graph-scroll-wrapper';
  container.appendChild(wrapper);

  const svg = svgEl<SVGSVGElement>('svg');
  svg.id = 'story-graph-svg';
  svg.setAttribute('width', String(Math.max(900, maxX)));
  svg.setAttribute('height', String(Math.max(560, maxY)));
  wrapper.appendChild(svg);

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

  // 邊層 + 節點層
  const edgeLayer = svgEl<SVGGElement>('g'); edgeLayer.id = 'graph-edge-layer';
  const nodeLayer = svgEl<SVGGElement>('g'); nodeLayer.id = 'graph-node-layer';
  svg.appendChild(edgeLayer); svg.appendChild(nodeLayer);

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
    titleTxt.textContent = node.title.length > 22 ? node.title.slice(0, 22) + '…' : node.title;
    g.appendChild(titleTxt);

    // ID
    const idTxt = svgEl<SVGTextElement>('text');
    idTxt.setAttribute('x', '10'); idTxt.setAttribute('y', '63');
    idTxt.setAttribute('class', 'graph-node-id-txt');
    idTxt.textContent = node.id.length > 28 ? node.id.slice(0, 28) + '…' : node.id;
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

  // ── 事件綁定 ───────────────────────────────────────────

  // 輸出埠：點擊啟動牽線模式
  nodeLayer.querySelectorAll<SVGCircleElement>('[data-port-node]').forEach(port => {
    port.addEventListener('click', event => {
      event.stopPropagation();
      graphWireSource = graphWireSource === port.dataset.portNode! ? null : port.dataset.portNode!;
      const hint = document.getElementById('graph-wire-hint') as HTMLElement | null;
      if (hint) hint.hidden = !graphWireSource;
      renderGraphCanvas();
    });
  });

  // 節點 rect：點擊 → 跳轉或完成牽線
  nodeLayer.querySelectorAll<SVGRectElement>('.graph-node-rect').forEach(rect => {
    const g = rect.closest<SVGGElement>('.graph-node')!;
    const nodeId = g.dataset.nodeId!;
    rect.addEventListener('click', () => {
      if (graphWireSource && graphWireSource !== nodeId) {
        // 牽線完成：新增 SCHEDULE_NODE 效果到來源節點
        const srcId = graphWireSource;
        const srcNode = activeStory()?.nodes.find(n => n.id === srcId);
        if (srcNode && !srcNode.completionEffects.some(e => e.type === 'SCHEDULE_NODE' && e.nodeId === nodeId)) {
          srcNode.completionEffects.push({ type: 'SCHEDULE_NODE', nodeId, delayDays: 1 });
        }
        graphWireSource = null;
        selectedNodeId = srcId;
        switchTab('node-editor');
        render();
        return;
      }
      selectedNodeId = nodeId;
      switchTab('node-editor');
      render();
    });
  });

  // 拖曳節點
  initGraphDrag(svg, story, edgeLayer);

  // 重新排版
  document.getElementById('btn-graph-relayout')?.addEventListener('click', () => {
    graphPositions = {};
    autoLayoutMissing(story.nodes);
    saveGraphPos(story.id);
    renderGraphCanvas();
  });
}

function initGraphDrag(svg: SVGSVGElement, story: NarrativeStory, edgeLayer: SVGGElement): void {
  let dragging: string | null = null;
  let startX = 0, startY = 0, startNX = 0, startNY = 0;

  const nodeLayer = svg.querySelector<SVGGElement>('#graph-node-layer')!;

  svg.addEventListener('mousedown', event => {
    const target = event.target as SVGElement;
    if (target.closest('[data-port-node]')) return; // 不拖曳輸出埠
    const g = target.closest<SVGGElement>('.graph-node');
    if (!g) return;
    const nId = g.dataset.nodeId!;
    const svgRect = svg.getBoundingClientRect();
    dragging = nId;
    startX = event.clientX - svgRect.left;
    startY = event.clientY - svgRect.top;
    startNX = graphPositions[nId]?.x ?? 0;
    startNY = graphPositions[nId]?.y ?? 0;
    svg.style.cursor = 'grabbing';
    event.preventDefault();
  });

  svg.addEventListener('mousemove', event => {
    if (!dragging) return;
    const svgRect = svg.getBoundingClientRect();
    const newX = Math.max(0, startNX + event.clientX - svgRect.left - startX);
    const newY = Math.max(0, startNY + event.clientY - svgRect.top - startY);
    graphPositions[dragging] = { x: newX, y: newY };
    const g = nodeLayer.querySelector<SVGGElement>(`.graph-node[data-node-id="${dragging}"]`);
    if (g) g.setAttribute('transform', `translate(${newX},${newY})`);
    renderEdgeLayer(edgeLayer, story);
  });

  const stopDrag = () => {
    if (!dragging) return;
    saveGraphPos(story.id);
    svg.style.cursor = '';
    dragging = null;
  };
  svg.addEventListener('mouseup', stopDrag);
  svg.addEventListener('mouseleave', stopDrag);
}

// ── Tab 切換 ──────────────────────────────────────────────────────────────────

function switchTab(tabName: string): void {
  byId('tab-node-editor').hidden = tabName !== 'node-editor';
  byId('tab-fact-registry').hidden = tabName !== 'fact-registry';
  byId('tab-graph-canvas').hidden = tabName !== 'graph-canvas';
  document.querySelectorAll('.story-tab').forEach(btn => {
    (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.tab === tabName);
  });
  if (tabName === 'fact-registry') renderFactRegistry((byId<HTMLInputElement>('fact-registry-search')).value);
  if (tabName === 'graph-canvas') renderGraphCanvas();
}

function bindTabEvents(): void {
  document.querySelectorAll('.story-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab((btn as HTMLElement).dataset.tab!));
  });
  byId('fact-registry-search').addEventListener('input', event => {
    renderFactRegistry((event.target as HTMLInputElement).value);
  });
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

async function bootstrap(): Promise<void> { await loadTemplate(); bindTabEvents(); bindEvents(); await loadFromProject(); }
bootstrap().catch(error => { document.body.innerHTML = `<pre class="story-studio-error">故事工坊啟動失敗：${escapeHtml(error.message)}</pre>`; });
