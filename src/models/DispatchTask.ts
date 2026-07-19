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
  
  // 商隊特有資料 (舊版單點跑商留存相容)
  public tradeTargetNodeId?: string;
  public tradeBuyList?: { goodId: string; amount: number; maxPrice: number }[];
  public tradeSellList?: { goodId: string; amount: number; minPrice: number }[];

  // 新版多節點跑商專用資料
  public tradeRouteNodeIds?: string[];
  public tradeInstructions?: TradeInstruction[];
  public currentRouteIndex?: number;
  public caravanCargo?: Record<string, number>;
  public caravanGold?: number;

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
