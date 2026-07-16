export enum EnemyFeature {
  BALANCED = 'BALANCED',       // 均衡型
  HIGH_DEF = 'HIGH_DEF',       // 高防禦
  HIGH_EVADE = 'HIGH_EVADE'    // 高閃避
}

/**
 * 派遣任務 (DispatchTask) 模型
 * 由領地生成的任務，讓冒險者前去執行以獲取資源
 */
export class DispatchTask {
  public name: string;
  public requiredTimeSeconds: number; // 執行任務需要的時間（秒）
  public baseDifficulty: number;      // 任務的基礎難度 (0-100)
  public expectedGold: number;        // 成功後的預期金幣收益
  public expectedPrestige: number;    // 成功後的預期聲望收益
  public minPowerRequired: number;    // 承接任務的基礎難度要求
  public enemyFeature: EnemyFeature;  // 敵方特性

  constructor(
    name: string,
    requiredTimeSeconds: number,
    baseDifficulty: number,
    expectedGold: number,
    expectedPrestige: number,
    minPowerRequired: number,
    enemyFeature: EnemyFeature = EnemyFeature.BALANCED
  ) {
    this.name = name;
    this.requiredTimeSeconds = requiredTimeSeconds;
    this.baseDifficulty = baseDifficulty;
    this.expectedGold = expectedGold;
    this.expectedPrestige = expectedPrestige;
    this.minPowerRequired = minPowerRequired;
    this.enemyFeature = enemyFeature;
  }
}
