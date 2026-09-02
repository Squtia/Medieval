import { StoryStudioStore } from './story-studio/StoryStudioStore';
import { StoryStudioGraph } from './story-studio/StoryStudioGraph';
import { StoryStudioForm } from './story-studio/StoryStudioForm';
import { StoryStudioPreview } from './story-studio/StoryStudioPreview';
import { StoryStudioFactionManager } from './story-studio/StoryStudioFactionManager';
import { FactionManager } from '../systems/FactionManager';
import {
  channelName,
  DRAFT_STORAGE_KEY,
  escapeHtml,
  FactRegistryEntry,
  TEST_STORAGE_KEY
} from './story-studio/StoryStudioTypes';
import '../styles/story-editor.css';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;

let store: StoryStudioStore;
let graph: StoryStudioGraph;
let form: StoryStudioForm;
let preview: StoryStudioPreview;
let storySearchQuery = '';

async function loadTemplate(): Promise<void> {
  const response = await fetch(`${import.meta.env.BASE_URL}src/templates/story-editor.html?t=${Date.now()}`);
  if (!response.ok) throw new Error('無法載入故事工坊介面');
  byId('story-studio-root').innerHTML = await response.text();
  byId('modal-story-editor').classList.add('active');
}

function renderStoryList(): void {
  const container = byId('story-editor-story-list');
  if (!container) return;
  container.innerHTML = '';
  const query = storySearchQuery.toLowerCase();

  const filtered = store.stories.filter(s => {
    if (!query) return true;
    return s.title.toLowerCase().includes(query) || s.id.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:15px; color:#6b6050; font-size:.8rem;">查無符合的故事</div>`;
    return;
  }

  for (const story of filtered) {
    const item = document.createElement('div');
    item.className = `story-list-item${story.id === store.selectedStoryId ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="story-item-main">
        <span class="story-item-status ${story.enabled ? 'enabled' : 'draft'}" title="${story.enabled ? '已啟用' : '草稿'}"></span>
        <span class="story-item-title">${escapeHtml(story.title || story.id)}</span>
      </div>
      <span class="story-item-badge">${story.nodes.length} 節點</span>
    `;
    item.addEventListener('click', () => {
      store.selectStory(story.id);
    });
    container.appendChild(item);
  }
}

function renderNodePills(): void {
  const container = byId('story-editor-node-pills');
  if (!container) return;
  container.innerHTML = '';
  const story = store.getActiveStory();
  if (!story) return;

  for (const node of story.nodes) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `sn-pill${node.id === store.selectedNodeId ? ' selected' : ''}`;
    const repeatBadge = node.repeatable ? '<span style="color:#60a5fa; font-size:0.7rem; margin-right:3px;">🔄</span>' : '';
    pill.innerHTML = `<span class="sn-pill-channel">${channelName(node.channel)}</span><span>${repeatBadge}${escapeHtml(node.title)}</span>`;
    pill.addEventListener('click', () => {
      store.selectNode(node.id);
      graph.centerNode(node.id);
    });
    container.appendChild(pill);
  }
}

function renderFacts(): void {
  const factsEl = byId('story-editor-facts');
  if (!factsEl) return;
  const facts = store.getActiveStory()?.nodes.flatMap(node => [
    ...node.completionEffects,
    ...node.choices.flatMap(choice => choice.effects)
  ].filter((effect): effect is any => effect.type === 'SET_FACT').map(effect => `${effect.fact} ← ${node.title}`)) ?? [];
  factsEl.textContent = facts.length ? [...new Set(facts)].join('\n') : '尚未設定故事線索。';
}

function renderValidation(): void {
  const box = byId('story-editor-validation');
  if (!box) return;
  const errors = store.getValidationErrors();
  box.className = `story-editor-validation ${errors.length ? 'error' : 'ok'}`;
  box.textContent = errors.length
    ? `需要修正：\n• ${errors.join('\n• ')}`
    : `✓ 結構檢查通過，共 ${store.stories.length} 條故事、${store.stories.reduce((sum, s) => sum + s.nodes.length, 0)} 個節點。`;
}

function buildSharedDatalists(): void {
  const factList = byId<HTMLDataListElement>('story-fact-datalist');
  const nodeTargetList = byId<HTMLDataListElement>('story-node-target-datalist');
  if (!factList || !nodeTargetList) return;

  const facts = new Set<string>();
  const nodes = new Set<string>();

  for (const story of store.stories) {
    for (const node of story.nodes) {
      nodes.add(node.id);
      for (const fx of [...node.completionEffects, ...node.choices.flatMap(c => c.effects)]) {
        if (fx.type === 'SET_FACT' && fx.fact) facts.add(fx.fact);
      }
      for (const cond of node.conditions) {
        if ((cond.type === 'FACT_EXISTS' || cond.type === 'FACT_MISSING' || cond.type === 'DAYS_SINCE_FACT') && cond.fact) {
          facts.add(cond.fact);
        }
      }
    }
  }

  factList.innerHTML = [...facts].map(f => `<option value="${escapeHtml(f)}"></option>`).join('');
  nodeTargetList.innerHTML = [...nodes].map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
}

// ── Fact Registry ──

function buildFactRegistry(): Map<string, FactRegistryEntry> {
  const registry = new Map<string, FactRegistryEntry>();
  const ensure = (fact: string): FactRegistryEntry => {
    if (!registry.has(fact)) registry.set(fact, { fact, writers: [], readers: [], warnings: [] });
    return registry.get(fact)!;
  };

  for (const story of store.stories) {
    for (const node of story.nodes) {
      for (const fx of [...node.completionEffects, ...node.choices.flatMap(c => c.effects)]) {
        if (fx.type === 'SET_FACT' && fx.fact) {
          ensure(fx.fact).writers.push({
            storyId: story.id, storyTitle: story.title, nodeId: node.id, nodeTitle: node.title
          });
        }
      }
      for (const cond of node.conditions) {
        if ((cond.type === 'FACT_EXISTS' || cond.type === 'FACT_MISSING' || cond.type === 'DAYS_SINCE_FACT') && cond.fact) {
          ensure(cond.fact).readers.push({
            storyId: story.id, storyTitle: story.title, nodeId: node.id, nodeTitle: node.title, conditionType: cond.type
          });
        }
      }
    }
  }

  for (const entry of registry.values()) {
    if (entry.writers.length === 0 && entry.readers.length > 0) entry.warnings.push('MISSING_WRITER');
    if (entry.writers.length > 0 && entry.readers.length === 0) entry.warnings.push('UNUSED_WRITE');
    if (entry.writers.length > 1) entry.warnings.push('DUPLICATE_WRITER');
    const storiesInvolved = new Set([
      ...entry.writers.map(w => w.storyId),
      ...entry.readers.map(r => r.storyId)
    ]);
    if (storiesInvolved.size > 1) entry.warnings.push('CROSS_STORY');
  }

  return registry;
}

function renderFactRegistry(query = ''): void {
  const listEl = byId('fact-registry-list');
  const countEl = byId('fact-registry-count');
  const warnCountEl = byId('fact-registry-warn-count');
  if (!listEl) return;

  const registry = buildFactRegistry();
  const entries = Array.from(registry.values()).sort((a, b) => a.fact.localeCompare(b.fact));
  const filtered = query ? entries.filter(e => e.fact.toLowerCase().includes(query.toLowerCase())) : entries;
  const totalWarns = entries.filter(e => e.warnings.length > 0).length;

  if (countEl) countEl.textContent = `共 ${entries.length} 條線索（顯示 ${filtered.length} 條）`;
  if (warnCountEl) {
    warnCountEl.textContent = totalWarns > 0 ? `⚠ ${totalWarns} 條有警告` : '✓ 無異常';
    warnCountEl.style.color = totalWarns > 0 ? '#fca5a5' : '#86efac';
  }

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="color:#6b6050; padding:20px; text-align:center;">查無線索</div>';
    return;
  }

  for (const entry of filtered) {
    const hasMissingWriter = entry.warnings.includes('MISSING_WRITER');
    const hasUnused = entry.warnings.includes('UNUSED_WRITE');
    const hasDuplicate = entry.warnings.includes('DUPLICATE_WRITER');
    const isCross = entry.warnings.includes('CROSS_STORY');

    const cardClasses = [
      'fact-card',
      hasMissingWriter ? 'warn-missing-writer' : '',
      hasUnused ? 'warn-unused' : '',
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
        store.selectedStoryId = item.dataset.jumpStory!;
        store.selectedNodeId = item.dataset.jumpNode!;
        store.loadGraphPos(store.selectedStoryId);
        switchTab('node-editor');
        store.emit('storySelected');
      });
    });

    listEl.appendChild(card);
  }
}

function switchTab(tabName: string): void {
  byId('tab-node-editor').hidden = tabName !== 'node-editor';
  byId('tab-fact-registry').hidden = tabName !== 'fact-registry';
  document.querySelectorAll('.story-tab').forEach(btn => {
    (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).dataset.tab === tabName);
  });
  if (tabName === 'fact-registry') renderFactRegistry(byId<HTMLInputElement>('fact-registry-search').value);
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
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    FactionManager.discardDraft();
    dialog.close();
    dialog.remove();
    await store.loadFromProject(false);
  });
  dialog.querySelector('[data-close]')!.addEventListener('click', () => { dialog.close(); dialog.remove(); });
  dialog.showModal();
}

function testNode(): void {
  const story = store.getActiveStory();
  const node = store.getActiveNode();
  if (!story || !node) {
    alert('請先選取要測試的故事與節點！');
    return;
  }
  localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify({
    storyId: story.id,
    nodeId: node.id,
    stories: store.stories,
    timestamp: Date.now()
  }));
  const baseUrl = import.meta.env.BASE_URL || './';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  window.open(`${cleanBase}index.html?storyTest=1&story=${encodeURIComponent(story.id)}&node=${encodeURIComponent(node.id)}`, '_blank');
}

function bindMainEvents(): void {
  // Tab 切換
  document.querySelectorAll('.story-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab((btn as HTMLElement).dataset.tab!));
  });
  byId('fact-registry-search')?.addEventListener('input', event => {
    renderFactRegistry((event.target as HTMLInputElement).value);
  });

  // 搜尋
  byId('story-editor-story-search')?.addEventListener('input', event => {
    storySearchQuery = (event.target as HTMLInputElement).value;
    renderStoryList();
  });

  // 新增 / 刪除故事
  byId('btn-story-new')?.addEventListener('click', () => {
    store.createStory();
  });

  // 新增 / 刪除節點
  byId('btn-story-add-node')?.addEventListener('click', () => {
    store.createNode();
  });
  byId('btn-story-add-bounty-node')?.addEventListener('click', () => {
    store.createBountyNode();
  });
  byId('btn-story-delete-node')?.addEventListener('click', () => {
    const node = store.getActiveNode();
    if (!node || !confirm(`確定刪除節點「${node.title}」？`)) return;
    store.deleteNode(node.id);
  });

  // 縮放按鈕
  byId('btn-graph-zoom-in')?.addEventListener('click', () => {
    graph.zoom = Math.min(2.0, Math.round((graph.zoom + 0.15) * 100) / 100);
    graph.applyTransform();
  });
  byId('btn-graph-zoom-out')?.addEventListener('click', () => {
    graph.zoom = Math.max(0.3, Math.round((graph.zoom - 0.15) * 100) / 100);
    graph.applyTransform();
  });
  byId('btn-graph-zoom-reset')?.addEventListener('click', () => {
    graph.zoom = 1.0;
    graph.applyTransform();
  });
  byId('btn-graph-fit')?.addEventListener('click', () => graph.fitView());
  byId('btn-graph-relayout')?.addEventListener('click', () => graph.relayout());

  // 頂部功能
  byId('btn-story-nav-skill')?.addEventListener('click', () => {
    window.open('tools/skill-workshop.html', '_blank');
  });

  byId('btn-story-factions')?.addEventListener('click', () => {
    StoryStudioFactionManager.getInstance().open(() => {
      // 自訂陣營更新後，重新建構 datalist 與刷新表單
      store.emit('validationChanged');
      updateDraftBanner();
    });
  });

  byId('btn-story-publish')?.addEventListener('click', async () => {
    try {
      const snapshot = await store.saveProject();
      updateDraftBanner();
      alert(`🎉 故事資料已成功寫入專案！\n快照記錄：${snapshot}`);
    } catch (err: any) {
      alert(`寫入失敗：${err.message}`);
    }
  });

  byId('btn-story-test-node')?.addEventListener('click', testNode);
  byId('btn-story-history')?.addEventListener('click', () => void showHistory().catch(e => alert(e.message)));

  const handleReloadProject = async () => {
    if (confirm('🔄 確定放棄本機暫存草稿，重新從專案檔案載入（Git 最新進度）？\n\n注意：這將清空此瀏覽器中尚未「寫入專案」的暫存，適合在其他電腦 Push 並於此處 Git Pull 後執行。')) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      FactionManager.discardDraft();
      await store.loadFromProject(false);
      updateDraftBanner();
      alert('✅ 已成功從專案檔案重新載入最新故事！');
    }
  };

  byId('btn-story-reload-project')?.addEventListener('click', handleReloadProject);
  byId('btn-banner-reload-project')?.addEventListener('click', handleReloadProject);
  byId('btn-story-reset-progress')?.addEventListener('click', handleReloadProject);

  byId('btn-story-export')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.stories, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'stories.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  byId('btn-close-story-editor')?.addEventListener('click', () => {
    window.close();
    location.href = new URL('../', location.href).href;
  });
}

function updateDraftBanner(): void {
  const banner = byId('story-draft-alert-banner');
  if (!banner) return;
  const hasDraft = typeof localStorage !== 'undefined' && (
    !!localStorage.getItem(DRAFT_STORAGE_KEY) || FactionManager.hasDraft()
  );
  banner.style.display = hasDraft ? 'flex' : 'none';
}

async function bootstrap(): Promise<void> {
  await loadTemplate();

  store = StoryStudioStore.getInstance();
  graph = new StoryStudioGraph(store);
  form = new StoryStudioForm(store);
  preview = new StoryStudioPreview(store);

  graph.mount('story-graph-wrapper', 'story-graph-svg');
  form.mount();
  preview.mount();

  bindMainEvents();
  switchTab('node-editor');

  // 訂閱狀態刷新 UI 元件
  const fullRefresh = () => {
    renderStoryList();
    renderNodePills();
    renderFacts();
    renderValidation();
    buildSharedDatalists();
    updateDraftBanner();
  };

  store.subscribe('storiesLoaded', fullRefresh);
  store.subscribe('storySelected', fullRefresh);
  store.subscribe('storyUpdated', fullRefresh);
  store.subscribe('nodeSelected', () => {
    renderNodePills();
    renderFacts();
  });
  store.subscribe('validationChanged', () => {
    renderValidation();
    renderFacts();
    buildSharedDatalists();
  });

  await store.loadFromProject();
  updateDraftBanner();
}

bootstrap().catch(error => {
  document.body.innerHTML = `<pre class="story-studio-error">故事工坊啟動失敗：${escapeHtml(error.message)}</pre>`;
});
