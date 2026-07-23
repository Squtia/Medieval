export enum EnemyFeature {
  BALANCED = 'BALANCED',       // 均衡型
  HIGH_DEF = 'HIGH_DEF',       // 高防禦
  HIGH_EVADE = 'HIGH_EVADE'    // 高閃避
}

export enum TaskType {
  COMBAT = 'COMBAT',
  EXPLORE = 'EXPLORE',
  TRADE = 'TRADE'
}

export enum SubjugationMode {
  SINGLE = 'SINGLE',     // 單次討伐
  PROGRESS = 'PROGRESS'  // 進度討伐 (多波次, 未來擴充 100% 首領)
}

export enum TradePhase {
  OUTBOUND = 'OUTBOUND',
  RETURNING = 'RETURNING'
}

export interface TradeInstruction {
  nodeId: string;
  buy: { goodId: string; maxAmount: number }[];
  sell: string[]; // goodIds to sell
}

/**
 * 派遣任務 (DispatchTask) 模型
 * 由領地生成的任務，讓冒險者前去執行以獲取資源
 */
export class DispatchTask {
  public name: string;
  public type: TaskType;
  public requiredDays: number; // 執行任務需要的天數
  public baseDifficulty: number;      // 任務的基礎難度 (0-100)
  public expectedGold: number;        // 成功後的預期金幣收益
  public expectedPrestige: number;    // 成功後的預期聲望收益
  public minPowerRequired: number;    // 承接任務的基礎難度要求
  public enemyFeature: EnemyFeature;  // 敵方特性
  public isWar: boolean = false;      // Phase 5: 是否為攻城戰爭(允許帶兵)
  public troopAssignments?: Record<string, { type: string, count: number }>; // 每個參戰傭兵分配的兵種與數量
  
  // 商隊特有資料 (舊版單點跑商留存相容)
  public tradeTargetNodeId?: string;
  public tradeBuyList?: { goodId: string; amount: number; maxPrice: number }[];
  public tradeSellList?: { goodId: string; amount: number; minPrice: number }[];

  // 新版多節點跑商專用資料
  public tradeRouteNodeIds?: string[];
  /** 完整行程；建立後不可用來表示進度或被清空。 */
  public tradeItineraryNodeIds?: string[];
  public tradeInstructions?: TradeInstruction[];
  public currentRouteIndex?: number;
  public currentLegIndex?: number;
  public tradePhase?: TradePhase;
  public caravanCargo?: Record<string, number>;
  public caravanGold?: number;
  public initialCaravanGold?: number;

  // 探索任務：目標節點 ID
  public targetNodeId?: string;

  // 討伐任務專用
  public subjugationMode?: SubjugationMode;
  public totalWaves?: number; // 進度討伐的波次數量


  constructor(
    name: string,
    type: TaskType,
    requiredDays: number,
    baseDifficulty: number,
    expectedGold: number,
    expectedPrestige: number,
    minPowerRequired: number,
    enemyFeature: EnemyFeature = EnemyFeature.BALANCED
  ) {
    this.name = name;
    this.type = type;
    this.requiredDays = requiredDays;
    this.baseDifficulty = baseDifficulty;
    this.expectedGold = expectedGold;
    this.expectedPrestige = expectedPrestige;
    this.minPowerRequired = minPowerRequired;
    this.enemyFeature = enemyFeature;
  }
}

/** 將舊版以空陣列表示回程的任務正規化為明確狀態。 */
export function normalizeTradeTask(task: DispatchTask): DispatchTask {
  if (task.type !== TaskType.TRADE) return task;

  const legacyRoute = task.tradeRouteNodeIds || [];
  const instructionRoute = (task.tradeInstructions || []).map(instruction => instruction.nodeId);
  const itinerary = task.tradeItineraryNodeIds?.length
    ? task.tradeItineraryNodeIds
    : legacyRoute.length
      ? legacyRoute
      : instructionRoute;

  task.tradeItineraryNodeIds = [...itinerary];
  task.currentLegIndex = task.currentLegIndex ?? task.currentRouteIndex ?? 0;
  task.tradePhase = task.tradePhase
    ?? (legacyRoute.length === 0 && task.currentRouteIndex !== undefined && itinerary.length > 0
      ? TradePhase.RETURNING
      : TradePhase.OUTBOUND);

  if (task.tradePhase === TradePhase.RETURNING) {
    task.currentLegIndex = itinerary.length;
  }

  // 舊欄位保留供既有存檔與外部資料相容，但不再拿來表示回程。
  task.tradeRouteNodeIds = [...itinerary];
  task.currentRouteIndex = task.currentLegIndex;
  return task;
}
