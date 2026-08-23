import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../core/GameState';
import { createEmptyNarrativeState, NarrativeStory } from '../models/Narrative';
import { NarrativeSystem } from './NarrativeSystem';

const TEST_STORY: NarrativeStory = {
  id: 'test_story',
  title: '測試故事',
  summary: '',
  version: 1,
  enabled: true,
  nodes: [
    {
      id: 'opening',
      title: '開場',
      description: '測試開場',
      channel: 'BOUNTY_BOARD',
      conditions: [{ type: 'DAY_AT_LEAST', value: 3 }],
      choices: [],
      completionEffects: [
        { type: 'SET_FACT', fact: 'opening_done', value: true },
        { type: 'SCHEDULE_NODE', nodeId: 'followup', delayDays: 2 }
      ],
      bounty: { duration: 1, expireDays: 10, gold: 10, exp: 5 }
    },
    {
      id: 'followup',
      title: '後續',
      description: '測試後續',
      channel: 'TERRITORY_EVENT',
      conditions: [{ type: 'FACT_EXISTS', fact: 'opening_done' }],
      choices: [],
      completionEffects: []
    },
    {
      id: 'journey', title: '途中', description: '途中事件', channel: 'SUBJUGATION_JOURNEY',
      conditions: [], choices: [], completionEffects: []
    },
    {
      id: 'victory', title: '勝利', description: '勝利事件', channel: 'SUBJUGATION',
      conditions: [{ type: 'FACT_EXISTS', fact: 'subjugation:target:victory' }], choices: [], completionEffects: []
    },
    {
      id: 'defeat', title: '失敗', description: '失敗事件', channel: 'SUBJUGATION',
      conditions: [{ type: 'FACT_EXISTS', fact: 'subjugation:target:defeat' }], choices: [], completionEffects: []
    }
  ]
};

describe('NarrativeSystem', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key)
    };
    GameState.totalDays = 1;
    GameState.narrativeState = createEmptyNarrativeState();
    GameState.bounties = [];
    GameState.restedExpPool = 0;
    GameState.myTerritory.materials = {};
    GameState.myTerritory.tradeInventory = {};
    GameState.myTerritory.warehouse = [];
    NarrativeSystem.setDefinitionsForTesting([TEST_STORY]);
  });

  it('條件成立後才把故事懸賞放進懸賞板', () => {
    NarrativeSystem.processDailyTick();
    expect(GameState.bounties).toHaveLength(0);

    GameState.totalDays = 3;
    NarrativeSystem.processDailyTick();
    expect(GameState.bounties).toHaveLength(1);
    expect(GameState.bounties[0].narrativeNodeKey).toBe('test_story:opening');
  });

  it('完成節點會記錄線索並遵守延遲排程', () => {
    GameState.totalDays = 3;
    NarrativeSystem.completeNode('test_story', 'opening');

    expect(GameState.narrativeState.facts.opening_done.day).toBe(3);
    expect(NarrativeSystem.getEligibleNodes('TERRITORY_EVENT')).toHaveLength(0);

    GameState.totalDays = 5;
    expect(NarrativeSystem.getEligibleNodes('TERRITORY_EVENT')).toHaveLength(1);
  });

  it('重置故事會清除該故事產生的線索與節點狀態', () => {
    GameState.totalDays = 3;
    NarrativeSystem.completeNode('test_story', 'opening');
    NarrativeSystem.resetStory('test_story');

    expect(GameState.narrativeState.facts.opening_done).toBeUndefined();
    expect(GameState.narrativeState.completedNodeIds).toHaveLength(0);
    expect(GameState.narrativeState.scheduledNodes).toEqual({});
  });

  it('可一次給予素材、貿易品、裝備與經驗池獎勵', () => {
    NarrativeSystem.applyEffects('test_story', [
      { type: 'GRANT_MATERIAL', itemId: 'mat_iron_ingot', quantity: 3 },
      { type: 'GRANT_TRADE_GOOD', itemId: 'tg_spice', quantity: 2 },
      { type: 'GRANT_EQUIPMENT', templateId: 'wpn_iron_greatsword', quantity: 1 },
      { type: 'ADD_RESTED_EXP', value: 50 }
    ]);

    expect(GameState.myTerritory.materials.mat_iron_ingot).toBe(3);
    expect(GameState.myTerritory.tradeInventory.tg_spice).toBe(2);
    expect(GameState.myTerritory.warehouse[0].id).toBe('wpn_iron_greatsword');
    expect(GameState.restedExpPool).toBe(50);
  });

  it('建立故事討伐據點時使用穩定 ID，重複執行不會重複生成', () => {
    const nodes: any[] = [{ id: 'home', name: '領地', x: 50, y: 50, isPlayerBase: true }];
    GameState.mapSystem = {
      getNodes: () => nodes,
      getNodeById: (id: string) => nodes.find(node => node.id === id),
      addStoryNode: (node: any) => { nodes.push(node); return node; },
      removeDynamicNode: (id: string) => { const index = nodes.findIndex(node => node.id === id); if (index >= 0) nodes.splice(index, 1); }
    } as any;
    const createEffect = {
      type: 'CREATE_SUBJUGATION_NODE' as const,
      definition: {
        nodeId: 'smuggler_camp', name: '走私者營地', description: '測試據點',
        placement: 'NEAR_PLAYER' as const, radius: 8, terrain: 'RUINS' as const, difficulty: 2,
        enemyFeature: 'BALANCED' as const, requiresScouting: true, removeOnVictory: true,
        journeyNodeIds: ['journey'], victoryNodeId: 'victory', defeatNodeId: 'defeat'
      }
    };

    NarrativeSystem.applyEffects('test_story', [createEffect]);
    NarrativeSystem.applyEffects('test_story', [createEffect]);

    expect(nodes).toHaveLength(2);
    expect(nodes[1].id).toBe('story_test_story_smuggler_camp');
    expect(nodes[1].narrativeSubjugation.victoryNodeId).toBe('victory');

    NarrativeSystem.resetStory('test_story');
    expect(nodes).toHaveLength(1);
  });

  it('討伐途中與勝敗結果會觸發指定故事節點', () => {
    expect(NarrativeSystem.handleSubjugationJourney('test_story', 'journey')).toBe(true);
    expect(GameState.narrativeState.presentedNodeIds).toContain('test_story:journey');

    NarrativeSystem.handleSubjugationCompleted('target', true, {
      storyId: 'test_story', sourceNodeId: 'source', journeyNodeIds: ['journey'],
      victoryNodeId: 'victory', defeatNodeId: 'defeat', removeOnVictory: true
    });

    expect(GameState.narrativeState.facts['subjugation:target:victory']).toBeDefined();
    expect(GameState.narrativeState.presentedNodeIds).toContain('test_story:victory');
    expect(GameState.narrativeState.presentedNodeIds).not.toContain('test_story:defeat');
  });

  it('canAffordChoice 正確判定金幣、特產與素材是否足夠支付選項消耗', () => {
    GameState.myTerritory.gold = 100;
    GameState.myTerritory.tradeInventory = { tg_spice: 1 };
    GameState.myTerritory.materials = { mat_stone_brick: 2 };

    const choiceAffordable = {
      id: 'c1', text: '選項1', resultText: '',
      effects: [
        { type: 'ADD_GOLD' as const, value: -50 },
        { type: 'GRANT_TRADE_GOOD' as const, itemId: 'tg_spice', quantity: -1, mode: 'FIXED' as const }
      ]
    };
    expect(NarrativeSystem.canAffordChoice(choiceAffordable).affordable).toBe(true);

    const choiceGoldShort = {
      id: 'c2', text: '選項2', resultText: '',
      effects: [{ type: 'ADD_GOLD' as const, value: -200 }]
    };
    const goldRes = NarrativeSystem.canAffordChoice(choiceGoldShort);
    expect(goldRes.affordable).toBe(false);
    expect(goldRes.missingReason).toContain('金幣不足');

    const choiceSpiceShort = {
      id: 'c3', text: '選項3', resultText: '',
      effects: [{ type: 'GRANT_TRADE_GOOD' as const, itemId: 'tg_spice', quantity: -2, mode: 'FIXED' as const }]
    };
    const spiceRes = NarrativeSystem.canAffordChoice(choiceSpiceShort);
    expect(spiceRes.affordable).toBe(false);
    expect(spiceRes.missingReason).toContain('缺少特產');
  });

  it('支援 repeatable 日常懸賞：條件符合可多次輪替，冷卻中或條件不符會被排除', () => {
    const routineStory: NarrativeStory = {
      id: 'story_daily',
      title: '日常故事',
      summary: '',
      version: 1,
      enabled: true,
      nodes: [
        {
          id: 'routine_cat',
          title: '找貓',
          description: '找貓',
          channel: 'BOUNTY_BOARD',
          repeatable: true,
          cooldownDays: 3,
          conditions: [{ type: 'FACT_MISSING', fact: 'cat_extinct' }],
          choices: [],
          completionEffects: [{ type: 'ADD_GOLD', value: 20 }],
          bounty: { duration: 1, expireDays: 4, gold: 20, exp: 10, type: 'NORMAL' }
        }
      ]
    };
    NarrativeSystem.setDefinitionsForTesting([routineStory]);

    // 1. 初始第 1 天，合資格
    let routines = NarrativeSystem.getEligibleRoutineBounties();
    expect(routines).toHaveLength(1);
    expect(routines[0].node.id).toBe('routine_cat');

    // 2. 完成該任務，第 1 天完成
    NarrativeSystem.completeNode('story_daily', 'routine_cat');
    expect(GameState.narrativeState.nodeLastCompletedDay?.['story_daily:routine_cat']).toBe(1);

    // 3. 第 2 天在 3 天冷卻中，應被排除
    GameState.totalDays = 2;
    routines = NarrativeSystem.getEligibleRoutineBounties();
    expect(routines).toHaveLength(0);

    // 4. 第 4 天冷卻結束 (4 - 1 >= 3)，再次合資格
    GameState.totalDays = 4;
    routines = NarrativeSystem.getEligibleRoutineBounties();
    expect(routines).toHaveLength(1);

    // 5. 若條件不滿足 (出現 cat_extinct Fact)，則立即被過濾排除
    GameState.narrativeState.facts['cat_extinct'] = { value: true, day: 4 };
    routines = NarrativeSystem.getEligibleRoutineBounties();
    expect(routines).toHaveLength(0);
  });
});
