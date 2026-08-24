import { GameState } from '../core/GameState';
import { createEmptyNarrativeState, NarrativeStory } from '../models/Narrative';
import { NarrativeSystem } from '../systems/NarrativeSystem';
import { UIManager } from './UIManager';
import { setStartupMode, renderMap, ensurePhaserLoaded } from './MapController';
import { enterScene, returnToMap, renderStreetNpcEvents } from './SceneController';
import { MapGenerator } from '../systems/MapGenerator';
import { MapDynamicsSystem } from '../systems/MapDynamicsSystem';
import { Territory } from '../models/Territory';
import { Adventurer } from '../models/Adventurer';
import { Gender } from '../models/types';
import { GameDifficulty } from '../models/WorldGeneration';
import { startGameLoop } from '../core/GameLoop';
import { refreshGlobalUI } from '../main';
import { DispatchSystem } from '../systems/DispatchSystem';
import { ExplorationSystem } from '../systems/ExplorationSystem';
import { RoadSystem } from '../systems/RoadSystem';
import { INITIAL_MAP_NODES } from '../data/MapData';
import { INITIAL_FACTIONS } from '../data/FactionData';
import { TownManagementSystem } from '../systems/TownManagementSystem';
import { HeroSystem } from '../systems/HeroSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ThreatSystem } from '../systems/ThreatSystem';
import { DataStore } from '../systems/DataStore';

const TEST_STORAGE_KEY = 'MEDIEVAL_STORY_TEST_PAYLOAD';

export async function initNarrativeTestController(): Promise<void> {
  const params = new URLSearchParams(location.search);

  // 1. 嘗試從 localStorage 讀取工坊傳過來的即時故事草稿
  let payload: { storyId?: string; nodeId?: string; stories?: NarrativeStory[] } | null = null;
  try {
    const raw = localStorage.getItem(TEST_STORAGE_KEY);
    if (raw) payload = JSON.parse(raw);
  } catch (e) {
    console.warn('無法解析故事測試 payload', e);
  }

  // 2. 注入最新故事資料（無論是否有寫入磁碟，均以當前工坊草稿為準）
  if (payload?.stories && Array.isArray(payload.stories) && payload.stories.length > 0) {
    NarrativeSystem.setDefinitionsForTesting(payload.stories);
  } else {
    NarrativeSystem.reloadDefinitions();
  }

  const stories = NarrativeSystem.getStories();
  const paramStoryId = params.get('story') ?? params.get('testStory') ?? payload?.storyId ?? '';
  const paramNodeId = params.get('node') ?? params.get('testNode') ?? payload?.nodeId ?? '';

  // 智慧比對：若傳入 nodeId，先依據 nodeId 反查出所屬故事；否則依據 storyId 比對；最後 fallback 到 stories[0]
  let story = stories.find(s => s.nodes.some(n => n.id === paramNodeId))
    || stories.find(s => s.id === paramStoryId)
    || stories[0];
  const actualStoryId = story?.id ?? paramStoryId;
  let nodeId = paramNodeId && story?.nodes.some(n => n.id === paramNodeId)
    ? paramNodeId
    : (story?.nodes[0]?.id ?? '');

  // 3. 建立 100% 獨立且視野全開的專用測試沙盒世界（不被正式存檔覆蓋或干擾）
  const seed = 'narrative_test_sandbox';
  const world = MapGenerator.generateWorld(INITIAL_MAP_NODES, seed, GameDifficulty.NORMAL);
  const nodes = world.nodes;
  
  // 開闢所有節點與地圖視野
  nodes.forEach(n => {
    n.isDiscovered = true;
    n.isScouted = true;
  });

  const playerBase = nodes.find(n => n.isPlayerBase) || nodes[0];
  GameState.mapSystem = new MapDynamicsSystem(nodes, INITIAL_FACTIONS);
  GameState.myTerritory = new Territory('測試領地', playerBase.id);
  GameState.myTerritory.gold = 5000;
  GameState.myTerritory.food = 1000;
  GameState.myTerritory.wood = 500;
  GameState.myTerritory.stone = 300;
  GameState.myTerritory.iron = 200;
  GameState.myTerritory.prestige = 1500;
  GameState.myTerritory.tavernLevel = 3;
  GameState.myTerritory.unlockedBuildings = ['bld_tavern', 'bld_forge', 'bld_weapon_shop', 'bld_armor_shop'];
  GameState.currentViewNode = null; // 設為 null 以直接展示世界大地圖
  GameState.totalDays = 1;
  GameState.currentDay = 1;
  GameState.currentMonth = 1;
  GameState.currentYear = 1000;

  const guardian = new Adventurer(
    'adv_guardian_test',
    '艾蓮娜',
    DataStore.getRandomJob(),
    DataStore.getRandomRecruitTrait(),
    'SR',
    Gender.FEMALE,
    true
  );
  guardian.level = 5;
  GameState.adventurers = [guardian];

  GameState.system = new DispatchSystem(GameState.myTerritory);
  GameState.explorationSystem = new ExplorationSystem();
  // 100% 驅散全地圖迷霧，點亮整座大陸
  GameState.explorationSystem.revealAllCells();
  GameState.roadSystem = new RoadSystem();
  
  new TownManagementSystem();
  new HeroSystem();
  new CombatSystem();
  new ThreatSystem();

  GameState.currentSaveSlot = null;
  GameState.narrativeState = createEmptyNarrativeState();

  // 4. 確保地圖容器為 active 並關閉遮罩
  document.getElementById('main-menu-view')?.classList.remove('active');
  document.getElementById('modal-load-game')?.classList.remove('active');
  document.getElementById('modal-new-game')?.classList.remove('active');
  const prologueOverlay = document.getElementById('prologue-overlay');
  if (prologueOverlay) prologueOverlay.style.display = 'none';

  const mapView = document.getElementById('map-view');
  if (mapView) {
    mapView.classList.add('active');
    mapView.style.display = '';
  }

  const topBar = document.getElementById('top-bar');
  if (topBar) topBar.style.display = 'flex';

  // 5. 載入並強制刷新 Phaser 地圖
  await ensurePhaserLoaded();
  setStartupMode(false);
  
  window.dispatchEvent(new Event('resize'));
  refreshGlobalUI();
  renderMap();
  UIManager.updateUI();
  startGameLoop(() => UIManager.updateUI());

  // 確保在下一個動畫幀再次重繪，保證 WebGL 紋理已正確上傳
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    renderMap();
  });

  // 6. 掛載測試控制器面板
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
    <div class="notice">暫存沙盒世界，不會覆蓋正式存檔。</div>
    <label>測試節點<select id="narrative-test-node"></select></label>
    <button id="btn-narrative-toggle-view" style="background: linear-gradient(135deg, #1e3a8a, #1e40af); border-color: #3b82f6; color: #93c5fd; font-weight: bold;">🏰 切換至領地街道 / 🗺️ 返回地圖</button>
    <button id="btn-narrative-fulfill" style="background: linear-gradient(135deg, #b45309, #78350f); border-color: #f59e0b; color: #fde68a; font-weight: bold;">🪄 一鍵滿足此節點前置條件</button>
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

  panel.querySelector('#btn-narrative-toggle-view')?.addEventListener('click', () => {
    const isSceneActive = document.getElementById('scene-view')?.classList.contains('active');
    const playerBase = GameState.mapSystem?.getNodes().find(n => n.isPlayerBase) || GameState.mapSystem?.getNodes()[0];
    if (isSceneActive) {
      returnToMap();
    } else if (playerBase) {
      enterScene(playerBase);
    }
  });

  const select = panel.querySelector<HTMLSelectElement>('#narrative-test-node');
  if (select) {
    select.innerHTML = (story?.nodes ?? []).map(node => {
      const isDialogue = (node.dialoguePages && node.dialoguePages.length > 0) || node.channel === 'STREET_EVENT';
      const prefix = isDialogue ? '💬 ' : '';
      return `<option value="${escapeHtml(node.id)}">${prefix}${escapeHtml(node.title)}（${escapeHtml(node.id)}）</option>`;
    }).join('');
    select.value = nodeId;
    select.addEventListener('change', () => {
      nodeId = select.value;
      refresh();
    });
  }

  panel.querySelector('#btn-narrative-fulfill')?.addEventListener('click', () => {
    const ref = NarrativeSystem.findNode(actualStoryId, nodeId);
    if (!ref) return;
    const node = ref.node;
    const state = NarrativeSystem.ensureState();
    const key = NarrativeSystem.getNodeKey(actualStoryId, nodeId);

    // 一鍵滿足時，自動排程此節點使其滿足開放日條件
    state.scheduledNodes[key] = GameState.totalDays;

    for (const cond of node.conditions) {
      switch (cond.type) {
        case 'TAVERN_LEVEL_AT_LEAST':
          GameState.myTerritory.tavernLevel = Math.max(GameState.myTerritory.tavernLevel || 0, cond.value);
          if (!GameState.myTerritory.unlockedBuildings.includes('bld_tavern')) {
            GameState.myTerritory.unlockedBuildings.push('bld_tavern');
          }
          break;
        case 'PRESTIGE_AT_LEAST':
          GameState.myTerritory.prestige = Math.max(GameState.myTerritory.prestige || 0, cond.value);
          break;
        case 'GOLD_AT_LEAST':
          GameState.myTerritory.gold = Math.max(GameState.myTerritory.gold || 0, cond.value);
          break;
        case 'DAY_AT_LEAST':
          GameState.totalDays = Math.max(GameState.totalDays, cond.value);
          break;
        case 'FACT_EXISTS':
          state.facts[cond.fact] = { value: true, day: GameState.totalDays };
          break;
        case 'FACT_MISSING':
          delete state.facts[cond.fact];
          break;
        case 'DAYS_SINCE_FACT':
          state.facts[cond.fact] = { value: true, day: GameState.totalDays - cond.value };
          break;
        case 'NODE_EXPLORED':
          if (!state.exploredNodeIds.includes(cond.nodeId)) {
            state.exploredNodeIds.push(cond.nodeId);
          }
          break;
        case 'FACTION_FAVOR_AT_LEAST':
        case 'FACTION_FAVOR_AT_MOST': {
          const f = GameState.mapSystem?.getFactions().find(item => item.id === cond.factionId);
          if (f) f.playerFavor = cond.value;
          break;
        }
        case 'SUBJUGATION_COUNT_AT_LEAST':
          break;
      }
    }

    NarrativeSystem.processDailyTick();
    renderMap();
    UIManager.updateUI();
    refresh();
  });

  panel.querySelector('#btn-narrative-force')?.addEventListener('click', () => {
    NarrativeSystem.presentInteractiveNode(actualStoryId, nodeId, true);
    renderMap();
    refresh();
  });

  panel.querySelector('#btn-narrative-natural')?.addEventListener('click', () => {
    NarrativeSystem.processDailyTick();
    renderMap();
    refresh();
  });

  panel.querySelector('#btn-narrative-day')?.addEventListener('click', () => advance(1));
  panel.querySelector('#btn-narrative-five-days')?.addEventListener('click', () => advance(5));
  panel.querySelector('#btn-narrative-journey')?.addEventListener('click', () => {
    const generated = getGeneratedNode();
    if (!generated?.narrativeSubjugation) return;
    const jId = generated.narrativeSubjugation.journeyNodeIds?.[0];
    if (jId) {
      NarrativeSystem.handleSubjugationJourney(actualStoryId, jId);
      renderMap();
      refresh();
    }
  });

  panel.querySelector('#btn-narrative-victory')?.addEventListener('click', () => simulateOutcome(true));
  panel.querySelector('#btn-narrative-defeat')?.addEventListener('click', () => simulateOutcome(false));
  panel.querySelector('#btn-narrative-reset')?.addEventListener('click', () => {
    NarrativeSystem.resetStory(actualStoryId);
    GameState.totalDays = 1;
    GameState.currentDay = 1;
    GameState.currentMonth = 1;
    GameState.currentYear = 1000;
    renderMap();
    renderStreetNpcEvents();
    UIManager.updateUI();
    refresh();
  });

  function advance(days: number): void {
    GameState.totalDays += days;
    NarrativeSystem.processDailyTick();
    renderMap();
    renderStreetNpcEvents();
    UIManager.updateUI();
    refresh();
  }

  function getGeneratedNode() {
    return GameState.mapSystem?.getNodes().find(node => node.narrativeSubjugation?.storyId === actualStoryId);
  }

  function simulateOutcome(isVictory: boolean): void {
    const generated = getGeneratedNode();
    if (!generated?.narrativeSubjugation) return;
    NarrativeSystem.handleSubjugationCompleted(generated.id, isVictory, generated.narrativeSubjugation);
    if (isVictory && generated.narrativeSubjugation.removeOnVictory) GameState.mapSystem.removeDynamicNode(generated.id);
    renderMap();
    refresh();
  }

  function refresh(): void {
    const ref = NarrativeSystem.findNode(actualStoryId, nodeId);
    const key = NarrativeSystem.getNodeKey(actualStoryId, nodeId);
    const state = NarrativeSystem.ensureState();
    const reasons = ref ? NarrativeSystem.explainBlocked(ref.story, ref.node) : ['找不到節點'];
    const generatedNodes = GameState.mapSystem?.getNodes().filter(node => node.narrativeSubjugation?.storyId === actualStoryId) ?? [];
    const streetVisitors = NarrativeSystem.getEligibleStreetEvents().map(r => r.node.title);
    const scheduledList = Object.entries(state.scheduledNodes).map(([k, v]) => `${k.split(':')[1]} (第 ${v} 天)`);
    const storyNodesStatus = (story?.nodes ?? []).map(n => {
      const k = NarrativeSystem.getNodeKey(actualStoryId, n.id);
      const isDone = state.completedNodeIds.includes(k);
      const isBlocked = NarrativeSystem.explainBlocked(story!, n);
      const sDay = state.scheduledNodes[k];
      let tag = isDone ? '✅ 已完成' : (isBlocked.length === 0 ? '✨ 條件已滿足 (可觸發)' : `🔒 阻擋: ${isBlocked.join('；')}`);
      if (sDay !== undefined && !isDone) tag += ` [排程第 ${sDay} 天]`;
      return `  • ${n.title} (${n.id}): ${tag}`;
    });

    const statusEl = panel.querySelector<HTMLElement>('#narrative-test-status');
    if (statusEl) {
      statusEl.textContent = [
        `📅 遊戲日：第 ${GameState.totalDays} 天`,
        `🏰 街道訪客：${streetVisitors.join('、') || '無'}`,
        `🔑 已獲線索：${Object.keys(state.facts).join('、') || '無'}`,
        `\n📖 劇本節點即時追蹤：`,
        ...storyNodesStatus
      ].join('\n');
    }
  }

  refresh();
  window.setInterval(refresh, 500);
}

function escapeHtml(text: string): string {
  const span = document.createElement('span');
  span.textContent = text;
  return span.innerHTML;
}
