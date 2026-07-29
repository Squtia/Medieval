import { CombatStats } from '../models/types';

export interface GridPosition {
  row: number; // 0: 前排, 1: 中排, 2: 後排
  col: number; // 0: 左, 1: 中, 2: 右
}

export interface FormationConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiredSlots: GridPosition[]; // 觸發此陣型必須站人的格子
  
  // 陣型加成規則
  buffRules: {
    // 受到加成的對象
    target: 'ALL' | 'REQUIRED_SLOTS' | 'FRONT_ROW' | 'MIDDLE_ROW' | 'BACK_ROW';
    // 加成數值，這邊以倍率表示（例如 { def: 1.2 } 意即防禦 x 1.2）
    stats: Partial<CombatStats>;
  }[];
}

export class FormationDB {
  public static readonly Formations: Record<string, FormationConfig> = {
    'DEFAULT': {
      id: 'DEFAULT',
      name: '自由陣型',
      description: '無要求特定站位。無任何陣型加成。',
      icon: '🏳️',
      requiredSlots: [],
      buffRules: []
    },
    'PHALANX': {
      id: 'PHALANX',
      name: '盾牆陣',
      description: '要求前排(Row 1)佈滿 3 人。巨幅提升前排防禦，後排命中略增。',
      icon: '🛡️',
      requiredSlots: [
        { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }
      ],
      buffRules: [
        { target: 'FRONT_ROW', stats: { def: 1.2 } },
        { target: 'MIDDLE_ROW', stats: { hit: 1.1 } },
        { target: 'BACK_ROW', stats: { hit: 1.1 } }
      ]
    },
    'WEDGE': {
      id: 'WEDGE',
      name: '鋒矢陣',
      description: '突擊陣型。前排中1人，中排左右2人。前排捨棄防禦換取高攻擊。',
      icon: '🗡️',
      requiredSlots: [
        { row: 0, col: 1 }, // 前排中
        { row: 1, col: 0 }, // 中排左
        { row: 1, col: 2 }  // 中排右
      ],
      buffRules: [
        { target: 'FRONT_ROW', stats: { atk: 1.2, def: 0.8 } },
        { target: 'MIDDLE_ROW', stats: { evade: 1.1 } }
      ]
    },
    'SKIRMISH': {
      id: 'SKIRMISH',
      name: '散兵陣',
      description: '化整為零。中排1人，後排2人。全員防禦下降，但閃避大幅提升。',
      icon: '🍃',
      requiredSlots: [
        { row: 1, col: 1 },
        { row: 2, col: 0 },
        { row: 2, col: 2 }
      ],
      buffRules: [
        { target: 'ALL', stats: { evade: 1.2, def: 0.85 } }
      ]
    },
    'VANGUARD': {
      id: 'VANGUARD',
      name: '先鋒陣',
      description: '簡單粗暴的雙人先鋒。前排左右2人。',
      icon: '⚔️',
      requiredSlots: [
        { row: 0, col: 0 }, // 前排左
        { row: 0, col: 2 }  // 前排右
      ],
      buffRules: [
        { target: 'REQUIRED_SLOTS', stats: { atk: 1.1, hit: 1.1 } }
      ]
    },
    'COMMANDER': {
      id: 'COMMANDER',
      name: '鐵壁護衛陣',
      description: '單人指揮。後排中1人，前排2人保護。',
      icon: '👑',
      requiredSlots: [
        { row: 0, col: 0 },
        { row: 0, col: 2 },
        { row: 2, col: 1 } // 後排中
      ],
      buffRules: [
        { target: 'BACK_ROW', stats: { atk: 1.25, def: 1.25 } }, // 主帥全方位加成
        { target: 'FRONT_ROW', stats: { def: 1.15 } }
      ]
    }
  };

  /**
   * 根據 ID 取得陣型配置
   */
  public static getFormation(id: string): FormationConfig {
    return this.Formations[id] || this.Formations['DEFAULT'];
  }

  /**
   * 驗證當前網格配置是否符合該陣型的要求
   * @param gridMap 網格佈局 (key為 'row_col', value 為傭兵 ID)
   * @param formationId 陣型 ID
   * @returns 是否啟動
   */
  public static isFormationActive(gridMap: Record<string, string>, formationId: string): boolean {
    const config = this.getFormation(formationId);
    if (config.id === 'DEFAULT') return true;

    for (const slot of config.requiredSlots) {
      const key = `${slot.row}_${slot.col}`;
      if (!gridMap[key]) {
        return false;
      }
    }
    return true;
  }
}
