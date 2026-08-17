import { GameState } from '../core/GameState';
import { createEmptyNarrativeState } from '../models/Narrative';
import { NarrativeSystem } from '../systems/NarrativeSystem';
import { UIManager } from './UIManager';

export function initNarrativeTestController(): void {
  const params = new URLSearchParams(location.search);
  const storyId = params.get('story') ?? NarrativeSystem.getStories()[0]?.id ?? '';
  let nodeId = params.get('node') ?? NarrativeSystem.getStories().find(story => story.id === storyId)?.nodes[0]?.id ?? '';

  GameState.currentSaveSlot = null;
  GameState.narrativeState = createEmptyNarrativeState();
  document.getElementById('main-menu-view')?.classList.remove('active');
  document.getElementById('map-view')?.classList.add('active');
  const topBar = document.getElementById('top-bar');
  if (topBar) topBar.style.display = 'flex';

  const panel = document.createElement('aside');
  panel.id = 'narrative-test-panel';
  panel.innerHTML = `
    <style>
      #narrative-test-panel{position:fixed;z-index:9000;right:18px;top:18px;width:330px;max-height:calc(100vh - 36px);overflow:auto;padding:16px;color:#f5ead2;background:#17110ded;border:1px solid #d19a45;border-radius:9px;box-shadow:0 14px 50px #000b;font:14px/1.45 "Microsoft JhengHei",sans-serif}
      #narrative-test-panel h3{margin:0;color:#fbbf24}#narrative-test-panel .notice{margin:6px 0 13px;color:#fdba74;font-size:12px}
      #narrative-test-panel select,#narrative-test-panel button{width:100%;margin-top:7px;padding:8px;color:#f5ead2;background:#281d13;border:1px solid #715333;border-radius:4px}
      #narrative-test-panel button{cursor:pointer}#narrative-test-panel button:hover{border-color:#fbbf24}
      #narrative-test-status{margin-top:12px;padding:9px;white-space:pre-wrap;background:#0b0907;border-radius:4px;font-size:12px;color:#cbbd9f}
    </style>
    <h3>🧪 故事測試模式</h3>
    <div class="notice">暫存內容，不會寫入正式存檔。</div>
    <label>測試節點<select id="narrative-test-node"></select></label>
    <button id="btn-narrative-force">強制顯示此節點</button>
    <button id="btn-narrative-natural">依正常條件檢查</button>
    <button id="btn-narrative-day">推進 1 天並檢查</button>
    <button id="btn-narrative-five-days">推進 5 天並檢查</button>
    <button id="btn-narrative-journey">模擬下一個討伐途中事件</button>
    <button id="btn-narrative-victory">模擬故事討伐勝利</button>
    <button id="btn-narrative-defeat">模擬故事討伐失敗</button>
    <button id="btn-narrative-reset">重置此故事測試進度</button>
    <div id="narrative-test-status"></div>`;
  document.body.appendChild(panel);

  const story = NarrativeSystem.getStories().find(item => item.id === storyId);
  const select = panel.querySelector<HTMLSelectElement>('#narrative-test-node')!;
  select.innerHTML = (story?.nodes ?? []).map(node => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.title)}（${escapeHtml(node.id)}）</option>`).join('');
  select.value = nodeId;
  select.addEventListener('change', () => { nodeId = select.value; refresh(); });
  panel.querySelector('#btn-narrative-force')!.addEventListener('click', () => { NarrativeSystem.presentInteractiveNode(storyId, nodeId, true); refresh(); });
  panel.querySelector('#btn-narrative-natural')!.addEventListener('click', () => { NarrativeSystem.processDailyTick(); refresh(); });
  panel.querySelector('#btn-narrative-day')!.addEventListener('click', () => advance(1));
  panel.querySelector('#btn-narrative-five-days')!.addEventListener('click', () => advance(5));
  panel.querySelector('#btn-narrative-journey')!.addEventListener('click', () => {
    const generated = getGeneratedNode();
    const next = generated?.narrativeSubjugation?.journeyNodeIds.find(id => !NarrativeSystem.ensureState().presentedNodeIds.includes(`${storyId}:${id}`));
    if (next) NarrativeSystem.handleSubjugationJourney(storyId, next);
    refresh();
  });
  panel.querySelector('#btn-narrative-victory')!.addEventListener('click', () => simulateOutcome(true));
  panel.querySelector('#btn-narrative-defeat')!.addEventListener('click', () => simulateOutcome(false));
  panel.querySelector('#btn-narrative-reset')!.addEventListener('click', () => { NarrativeSystem.resetStory(storyId); refresh(); });

  function advance(days: number): void {
    GameState.totalDays += days;
    NarrativeSystem.processDailyTick();
    UIManager.updateUI();
    refresh();
  }

  function getGeneratedNode() {
    return GameState.mapSystem?.getNodes().find(node => node.narrativeSubjugation?.storyId === storyId);
  }

  function simulateOutcome(isVictory: boolean): void {
    const generated = getGeneratedNode();
    if (!generated?.narrativeSubjugation) return;
    NarrativeSystem.handleSubjugationCompleted(generated.id, isVictory, generated.narrativeSubjugation);
    if (isVictory && generated.narrativeSubjugation.removeOnVictory) GameState.mapSystem.removeDynamicNode(generated.id);
    refresh();
  }

  function refresh(): void {
    const ref = NarrativeSystem.findNode(storyId, nodeId);
    const key = NarrativeSystem.getNodeKey(storyId, nodeId);
    const state = NarrativeSystem.ensureState();
    const reasons = ref ? NarrativeSystem.explainBlocked(ref.story, ref.node) : ['找不到節點'];
    const generatedNodes = GameState.mapSystem?.getNodes().filter(node => node.narrativeSubjugation?.storyId === storyId) ?? [];
    panel.querySelector<HTMLElement>('#narrative-test-status')!.textContent = [
      `遊戲日：${GameState.totalDays}`,
      `狀態：${state.completedNodeIds.includes(key) ? '已完成' : state.presentedNodeIds.includes(key) ? '已顯示' : '未觸發'}`,
      `條件：${reasons.length ? reasons.join('；') : '已符合'}`,
      `線索：${Object.keys(state.facts).join('、') || '無'}`,
      `故事討伐據點：${generatedNodes.map(node => node.name).join('、') || '無'}`
    ].join('\n');
  }

  refresh();
  window.setInterval(refresh, 500);
}

function escapeHtml(text: string): string {
  const span = document.createElement('span');
  span.textContent = text;
  return span.innerHTML;
}
