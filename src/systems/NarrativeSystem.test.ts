import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../core/GameState';
import { createEmptyNarrativeState, NarrativeStory } from '../models/Narrative';
import { NarrativeSystem } from './NarrativeSystem';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';

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

  it('立即前往效果會封鎖後續節點，直到前置事件完成後才觸發', async () => {
    const immediateStory: NarrativeStory = {
      id: 'immediate_story',
      title: '立即接續測試',
      summary: '',
      version: 1,
      enabled: true,
      nodes: [
        {
          id: 'opening', title: '前置事件', description: '', channel: 'TERRITORY_EVENT',
          conditions: [], choices: [],
          completionEffects: [{ type: 'PRESENT_NODE', nodeId: 'followup' }]
        },
        {
          id: 'followup', title: '立即後續', description: '', channel: 'TERRITORY_EVENT',
          conditions: [], choices: [], completionEffects: []
        }
      ]
    };
    NarrativeSystem.setDefinitionsForTesting([immediateStory]);

    expect(NarrativeSystem.getEligibleNodes('TERRITORY_EVENT').map(ref => ref.node.id))
      .toEqual(['opening']);

    let triggeredNodeId = '';
    const unsubscribe = EventBus.getInstance().subscribe(
      GameEventType.NARRATIVE_NODE_TRIGGERED,
      payload => { triggeredNodeId = payload.nodeId; },
      'test-immediate-node'
    );

    NarrativeSystem.completeNode('immediate_story', 'opening');
    expect(triggeredNodeId).toBe('');
    await Promise.resolve();

    expect(triggeredNodeId).toBe('followup');
    expect(GameState.narrativeState.presentedNodeIds).toContain('immediate_story:followup');
    unsubscribe();
  });

  it('解鎖地圖據點可用工坊範本 ID 找到秘密據點實例', () => {
    const secretNode = {
      id: 'secret_frost_dragon_lair',
      isHidden: true,
      isDiscovered: false,
      narrativeSubjugation: { templateId: 'frost_dragon_lair' }
    };
    const nodes = [secretNode];
    GameState.mapSystem = {
      getNodes: () => nodes,
      getNodeById: (id: string) => nodes.find(node => node.id === id)
    } as any;

    let changedNodeId = '';
    const unsubscribe = EventBus.getInstance().subscribe(
      GameEventType.MAP_NODES_CHANGED,
      payload => { changedNodeId = payload.nodeId; },
      'test-unlock-map-node'
    );

    NarrativeSystem.applyEffects('test_story', [
      { type: 'UNLOCK_MAP_NODE', nodeId: 'frost_dragon_lair' }
    ]);

    expect(secretNode.isHidden).toBe(false);
    expect(secretNode.isDiscovered).toBe(true);
    expect(changedNodeId).toBe('secret_frost_dragon_lair');
    unsubscribe();
  });

  it('多節點迴圈會重置指定節點並依冷卻重新開放起點', () => {
    const loopStory = JSON.parse(JSON.stringify(TEST_STORY)) as NarrativeStory;
    loopStory.nodes[1].loop = { mode: 'CHAIN', targetNodeId: 'opening', resetNodeIds: ['opening', 'followup'], cooldownDays: 2 };
    loopStory.nodes[0].conditions = [];
    NarrativeSystem.setDefinitionsForTesting([loopStory]);
    NarrativeSystem.completeNode('test_story', 'opening', false);
    NarrativeSystem.completeNode('test_story', 'followup', false);
    expect(GameState.narrativeState.completedNodeIds).not.toContain('test_story:opening');
    expect(GameState.narrativeState.completedNodeIds).not.toContain('test_story:followup');
    expect(NarrativeSystem.getEligibleNodes('BOUNTY_BOARD')).toHaveLength(0);
    GameState.totalDays = 3;
    expect(NarrativeSystem.getEligibleNodes('BOUNTY_BOARD')).toHaveLength(1);
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

  it('runs full player flow for dragon legacy: rumor -> todo choice -> 3 days schedule -> street event', () => {
    const dragonStory: NarrativeStory = {
      id: 'new_story',
      title: '最後的龍裔',
      summary: '',
      version: 1,
      enabled: true,
      nodes: [
        {
          id: 'dragon_fam',
          title: '隱藏的龍裔',
          description: '酒客傳聞',
          channel: 'TAVERN_RUMOR',
          conditions: [
            { type: 'PRESTIGE_AT_LEAST', value: 1500 },
            { type: 'TAVERN_LEVEL_AT_LEAST', value: 3 }
          ],
          choices: [],
          completionEffects: [
            { type: 'SET_FACT', fact: 'dragom_fam_01A', value: true }
          ]
        },
        {
          id: 'dragon_fam_1',
          title: '領主的好奇心',
          description: '待辦事項',
          channel: 'TODO_LIST',
          conditions: [
            { type: 'FACT_EXISTS', fact: 'dragom_fam_01A' }
          ],
          choices: [
            {
              id: 'choice_1',
              text: '讓人去探聽那位客人是誰。',
              resultText: '',
              effects: [
                { type: 'SCHEDULE_NODE', nodeId: 'dragon_fam_2', delayDays: 3 }
              ]
            }
          ],
          completionEffects: []
        },
        {
          id: 'dragon_fam_2',
          title: '瘋癲的酒客',
          description: '街道訪客',
          channel: 'STREET_EVENT',
          conditions: [],
          choices: [],
          completionEffects: []
        }
      ]
    };
    NarrativeSystem.setDefinitionsForTesting([dragonStory]);

    GameState.myTerritory = {
      prestige: 1500,
      tavernLevel: 3,
      pendingNarrativeNodes: []
    } as any;
    GameState.totalDays = 1;

    // 1. 玩家在酒館點擊打聽傳聞
    const rumor = NarrativeSystem.consumeTavernRumor();
    expect(rumor).not.toBeNull();
    expect(rumor?.node.id).toBe('dragon_fam');
    expect(GameState.narrativeState.facts['dragom_fam_01A']).toBeDefined();

    // 2. 系統結算待辦事項
    NarrativeSystem.ensureStoryTodos();
    expect((GameState.myTerritory as any).pendingNarrativeNodes).toContain('new_story:dragon_fam_1');

    // 3. 玩家在待辦事項中做出決策 (choice_1: SCHEDULE_NODE dragon_fam_2, delayDays: 3)
    const todoRef = NarrativeSystem.findNode('new_story', 'dragon_fam_1');
    expect(todoRef).toBeDefined();
    NarrativeSystem.resolveChoice('new_story', 'dragon_fam_1', todoRef!.node.choices[0]);
    expect(GameState.narrativeState.scheduledNodes['new_story:dragon_fam_2']).toBe(4);

    // 4. 當前第 1 天，酒客不應出現在街道
    let streetEvents = NarrativeSystem.getEligibleStreetEvents();
    expect(streetEvents.map(r => r.node.id)).not.toContain('dragon_fam_2');

    // 5. 推進到第 2 天，酒客不應出現
    GameState.totalDays = 2;
    NarrativeSystem.processDailyTick();
    streetEvents = NarrativeSystem.getEligibleStreetEvents();
    expect(streetEvents.map(r => r.node.id)).not.toContain('dragon_fam_2');

    // 6. 推進到第 3 天，酒客不應出現
    GameState.totalDays = 3;
    NarrativeSystem.processDailyTick();
    streetEvents = NarrativeSystem.getEligibleStreetEvents();
    expect(streetEvents.map(r => r.node.id)).not.toContain('dragon_fam_2');

    // 7. 推進到第 4 天（過完 3 天），酒客必須出現！
    GameState.totalDays = 4;
    NarrativeSystem.processDailyTick();
    streetEvents = NarrativeSystem.getEligibleStreetEvents();
    expect(streetEvents.map(r => r.node.id)).toContain('dragon_fam_2');
  });

  it('automatically seals subjugation victory/defeat/journey target nodes from daily tick and triggers only upon subjugation', () => {
    NarrativeSystem.setDefinitionsForTesting([
      {
        id: 'sub_test_story',
        title: '討伐測試故事',
        summary: '',
        version: 1,
        enabled: true,
        nodes: [
          {
            id: 'node_start',
            title: '酒客委託',
            description: '',
            channel: 'STREET_EVENT',
            conditions: [],
            choices: [],
            completionEffects: [
              {
                type: 'CREATE_SUBJUGATION_NODE',
                definition: {
                  nodeId: 'target_stronghold',
                  name: '神秘洞窟',
                  placement: 'NEAR_PLAYER',
                  victoryNodeId: 'node_victory_target',
                  defeatNodeId: 'node_defeat_target'
                } as any
              }
            ]
          },
          {
            id: 'node_victory_target',
            title: '突然拜訪的神秘人 (戰勝後續)',
            description: '',
            channel: 'TERRITORY_EVENT',
            conditions: [],
            choices: [],
            completionEffects: []
          },
          {
            id: 'node_defeat_target',
            title: '戰敗生還者 (戰敗後續)',
            description: '',
            channel: 'TERRITORY_EVENT',
            conditions: [],
            choices: [],
            completionEffects: []
          }
        ]
      }
    ]);

    NarrativeSystem.resetStory('sub_test_story');
    GameState.totalDays = 1;

    // 1. 在換日結算時，勝利節點與失敗節點因受自動保護，絕對不會出現在領地事件中
    NarrativeSystem.processDailyTick();
    const eligibleTerritory = NarrativeSystem.getEligibleNodes('TERRITORY_EVENT');
    expect(eligibleTerritory.map(r => r.node.id)).not.toContain('node_victory_target');
    expect(eligibleTerritory.map(r => r.node.id)).not.toContain('node_defeat_target');

    // 2. 討伐戰勝時，handleSubjugationCompleted 能精準強制喚起勝利目標節點
    let triggeredNodeId = '';
    const sub = EventBus.getInstance().subscribe(GameEventType.NARRATIVE_NODE_TRIGGERED, (payload: any) => {
      triggeredNodeId = payload.nodeId;
    });

    NarrativeSystem.handleSubjugationCompleted('target_stronghold', true, {
      storyId: 'sub_test_story',
      nodeId: 'target_stronghold',
      victoryNodeId: 'node_victory_target',
      defeatNodeId: 'node_defeat_target',
      journeyNodeIds: []
    } as any);

    expect(triggeredNodeId).toBe('node_victory_target');
    sub();
  });

  it('removes dynamic map node when REMOVE_MAP_NODE effect is applied', () => {
    const mockNodes: any[] = [
      { id: 'node_base', isPlayerBase: true, x: 10, y: 10 },
      { id: 'story_sub_story_temp_cave', isDynamic: true, x: 20, y: 20 }
    ];
    GameState.mapSystem = {
      getNodes: () => mockNodes,
      getNodeById: (id: string) => mockNodes.find(n => n.id === id),
      removeDynamicNode: (id: string) => {
        const idx = mockNodes.findIndex(n => n.id === id);
        if (idx >= 0) mockNodes.splice(idx, 1);
      }
    } as any;

    NarrativeSystem.setDefinitionsForTesting([
      {
        id: 'sub_story',
        title: '移除據點故事',
        summary: '',
        version: 1,
        enabled: true,
        nodes: [
          {
            id: 'node_collapse',
            title: '洞窟崩塌',
            description: '',
            channel: 'TERRITORY_EVENT',
            conditions: [],
            choices: [],
            completionEffects: [
              {
                type: 'REMOVE_MAP_NODE',
                nodeId: 'temp_cave'
              }
            ]
          }
        ]
      }
    ]);

    expect(mockNodes.some(n => n.id === 'story_sub_story_temp_cave')).toBe(true);

    NarrativeSystem.resolveChoice('sub_story', 'node_collapse');

    expect(mockNodes.some(n => n.id === 'story_sub_story_temp_cave')).toBe(false);
  });

  it('支援 GRANT_HERO 效果將傳奇/自訂英雄加入領地冒險者名冊', () => {
    GameState.adventurers = [];
    NarrativeSystem.applyEffects('test_story', [
      { type: 'GRANT_HERO', heroId: 'reyn' }
    ]);

    expect(GameState.adventurers.length).toBe(1);
    expect(GameState.adventurers[0].name).toContain('雷恩');
    expect(GameState.adventurers[0].quality).toBe('UR');
  });

  it('支援 HERO_EXISTS 與 HERO_MISSING 條件判斷（支援多選）', () => {
    GameState.adventurers = [];
    const heroStory: NarrativeStory = {
      id: 'hero_test_story',
      title: '英雄測試故事',
      summary: '',
      version: 1,
      enabled: true,
      nodes: [
        {
          id: 'need_reyn',
          title: '雷恩專屬事件',
          description: '',
          channel: 'TERRITORY_EVENT',
          conditions: [{ type: 'HERO_EXISTS', heroIds: ['reyn'], matchMode: 'ANY' }],
          choices: [],
          completionEffects: []
        },
        {
          id: 'missing_luna',
          title: '尋找露娜事件',
          description: '',
          channel: 'TERRITORY_EVENT',
          conditions: [{ type: 'HERO_MISSING', heroIds: ['luna'], matchMode: 'ANY' }],
          choices: [],
          completionEffects: []
        }
      ]
    };
    NarrativeSystem.setDefinitionsForTesting([heroStory]);

    // 初始狀態無任何英雄：need_reyn 被阻擋，missing_luna 允許出現
    expect(NarrativeSystem.explainBlocked(heroStory, heroStory.nodes[0])).toContain('需要已招募英雄「reyn」');
    expect(NarrativeSystem.explainBlocked(heroStory, heroStory.nodes[1])).toHaveLength(0);

    // 加入雷恩
    NarrativeSystem.applyEffects('hero_test_story', [{ type: 'GRANT_HERO', heroId: 'reyn' }]);
    expect(NarrativeSystem.explainBlocked(heroStory, heroStory.nodes[0])).toHaveLength(0); // need_reyn 解鎖

    // 加入露娜
    NarrativeSystem.applyEffects('hero_test_story', [{ type: 'GRANT_HERO', heroId: 'luna' }]);
    expect(NarrativeSystem.explainBlocked(heroStory, heroStory.nodes[1])).toContain('需要尚未擁有英雄「luna」'); // missing_luna 被阻擋
  });

  it('TRIGGER_RAID 的 successNodeId/failNodeId 後續節點在戰役結算前被嚴格阻擋，不得被每日輪詢無條件觸發', () => {
    const raidStory: NarrativeStory = {
      id: 'raid_story',
      title: '攻城戰故事',
      summary: '',
      version: 1,
      enabled: true,
      nodes: [
        {
          id: 'raid_trigger',
          title: '召喚大軍',
          description: '敵人準備攻城！',
          channel: 'TERRITORY_EVENT',
          conditions: [],
          choices: [],
          completionEffects: [
            {
              type: 'TRIGGER_RAID',
              raidName: '龍族大軍攻城',
              isSiege: true,
              successNodeId: 'raid_win',
              failNodeId: 'raid_lose'
            }
          ]
        },
        {
          id: 'raid_win',
          title: '守城大捷',
          description: '英勇擊退了敵人！',
          channel: 'TERRITORY_EVENT',
          conditions: [],
          choices: [],
          completionEffects: []
        },
        {
          id: 'raid_lose',
          title: '城防失守',
          description: '城牆被攻破了！',
          channel: 'TERRITORY_EVENT',
          conditions: [],
          choices: [],
          completionEffects: []
        }
      ]
    };

    NarrativeSystem.setDefinitionsForTesting([raidStory]);

    // 1. isRaidTargetNode 應正確辨識 successNodeId 與 failNodeId
    expect(NarrativeSystem.isRaidTargetNode('raid_story', 'raid_win')).toBe(true);
    expect(NarrativeSystem.isRaidTargetNode('raid_story', 'raid_lose')).toBe(true);
    // 觸發節點本身不是後續節點
    expect(NarrativeSystem.isRaidTargetNode('raid_story', 'raid_trigger')).toBe(false);

    // 2. explainBlocked 對 raid_win / raid_lose 回傳阻擋原因，即使無任何 conditions
    const winNode = raidStory.nodes.find(n => n.id === 'raid_win')!;
    const loseNode = raidStory.nodes.find(n => n.id === 'raid_lose')!;
    const blockedWin = NarrativeSystem.explainBlocked(raidStory, winNode);
    const blockedLose = NarrativeSystem.explainBlocked(raidStory, loseNode);

    expect(blockedWin.length).toBeGreaterThan(0);
    expect(blockedWin[0]).toContain('戰役結算專屬後續節點');
    expect(blockedLose.length).toBeGreaterThan(0);
    expect(blockedLose[0]).toContain('戰役結算專屬後續節點');

    // 3. getEligibleNodes 每日輪詢時，raid_win / raid_lose 不應出現在可用節點清單中
    const eligible = NarrativeSystem.getEligibleNodes('TERRITORY_EVENT');
    const eligibleIds = eligible.map(ref => ref.node.id);
    expect(eligibleIds).not.toContain('raid_win');
    expect(eligibleIds).not.toContain('raid_lose');

    // 4. 觸發節點 raid_trigger 本身應正常出現在可用節點清單中
    expect(eligibleIds).toContain('raid_trigger');

    // 5. 以 force=true 主動觸發（模擬 TerritoryDefenseSystem.onClose 回調）應成功
    const success = NarrativeSystem.presentInteractiveNode('raid_story', 'raid_win', true);
    expect(success).toBe(true);
  });

  it('支援 BUILDING_LEVEL_AT_LEAST、SECURITY 條件判斷與 REDUCE_RANDOM_BUILDING_LEVEL 隨機降級效果', () => {
    const territory = GameState.myTerritory;
    territory.security = 45;
    territory.tavernLevel = 2;
    territory.forgeLevel = 1;
    territory.churchLevel = 1;
    territory.defenseLevel = 2;

    const testStory: NarrativeStory = {
      id: 'upgrade_test_story',
      title: '條件與效果測試故事',
      summary: '',
      version: 1,
      enabled: true,
      nodes: [
        {
          id: 'cond_node',
          title: '條件測試',
          description: '',
          channel: 'TERRITORY_EVENT',
          conditions: [
            { type: 'BUILDING_LEVEL_AT_LEAST', buildingId: 'tavern', value: 2 },
            { type: 'BUILDING_LEVEL_AT_LEAST', buildingId: 'church', value: 1 },
            { type: 'SECURITY_AT_LEAST', value: 40 },
            { type: 'SECURITY_AT_MOST', value: 50 }
          ],
          choices: [],
          completionEffects: [
            { type: 'REDUCE_RANDOM_BUILDING_LEVEL', count: 2, levels: 1 }
          ]
        }
      ]
    };

    NarrativeSystem.setDefinitionsForTesting([testStory]);
    const eligible = NarrativeSystem.getEligibleNodes('TERRITORY_EVENT');
    expect(eligible.some(ref => ref.node.id === 'cond_node')).toBe(true);

    // 治安過高時應不符合 SECURITY_AT_MOST
    territory.security = 80;
    const blocked = NarrativeSystem.getEligibleNodes('TERRITORY_EVENT');
    expect(blocked.some(ref => ref.node.id === 'cond_node')).toBe(false);

    // 觸發效果執行隨機降級
    territory.security = 45;
    const initialSum = territory.tavernLevel + territory.forgeLevel + territory.churchLevel + territory.defenseLevel;
    NarrativeSystem.completeNode('upgrade_test_story', 'cond_node');
    const afterSum = territory.tavernLevel + territory.forgeLevel + territory.churchLevel + territory.defenseLevel;
    expect(afterSum).toBeLessThan(initialSum);
  });
});
