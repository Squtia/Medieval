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
  
  // 商隊特有資料
  public tradeTargetNodeId?: string;
  public tradeBuyList?: { goodId: string; amount: number; maxPrice: number }[];
  public tradeSellList?: { goodId: string; amount: number; minPrice: number }[];

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
