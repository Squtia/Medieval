import { TargetType } from '../../../models/Skill';
import { ScreenPoint } from '../CombatFXEngine';

/**
 * 🎯 CombatAnchorResolver
 * 戰鬥目標範圍物理幾何錨定解析器 (Pure Geometry Pipeline)
 * 遵循 Rule 12.3 唯一真理來源規範：
 * 主遊戲舞台 (CombatStageAdapter) 與戰鬥平衡沙盒 (CombatStudioStageAdapter) 100% 共享此純幾何求解器。
 * 
 * 幾何錨定規則：
 * 1. 全體 (ALL_ENEMIES / ALL_ALLIES) ➔ 該陣營九宮格正中心 (中排中 Row 2, Col 2)。
 * 2. 前排 (FRONT_ENEMIES) ➔ 該陣營前排欄位物理幾何中心 (左側陣型靠右 X=5/6，右側陣型靠左 X=1/6)。
 * 3. 後排 (BACK_ENEMY) ➔ 該陣營後排欄位物理幾何中心 (左側陣型靠左 X=1/6，右側陣型靠右 X=5/6)。
 * 4. 自身 (SELF) ➔ 施術者自身卡牌幾何中心。
 * 5. 單體或預設 ➔ 特定受擊者卡牌幾何中心；若找不到卡牌則安全退回九宮格正中心。
 */
export class CombatAnchorResolver {
  public static resolveAnchor(
    targetType: TargetType | string | undefined,
    isAttackerPlayer: boolean,
    container: HTMLElement | null,
    teamEl: HTMLElement | null,
    getUnitPoint: (unitId: string | undefined, side: 'player' | 'enemy') => ScreenPoint,
    mainTargetId?: string,
    actorId?: string
  ): ScreenPoint {
    const defaultWidth = container?.clientWidth || 900;
    const defaultHeight = container?.clientHeight || 550;

    // 1. 自身施法直接回傳施術者卡片位置
    if (targetType === TargetType.SELF && actorId) {
      return getUnitPoint(actorId, isAttackerPlayer ? 'player' : 'enemy');
    }

    // 2. 判斷作用對象陣營（友方隊伍 vs 敵方隊伍）
    const isTargetingAllies =
      targetType === TargetType.ALL_ALLIES ||
      targetType === TargetType.ALLY_LOWEST_HP ||
      targetType === TargetType.ALLY_DEAD;

    const targetSide: 'player' | 'enemy' = isTargetingAllies
      ? (isAttackerPlayer ? 'player' : 'enemy')
      : (isAttackerPlayer ? 'enemy' : 'player');

    // 若無容器，安全退回單體或預設中心
    if (!teamEl || !container) {
      return getUnitPoint(mainTargetId, targetSide);
    }

    const cRect = container.getBoundingClientRect();
    const tRect = teamEl.getBoundingClientRect();

    const teamLeft = tRect.left - cRect.left;
    const teamTop = tRect.top - cRect.top;
    const teamWidth = tRect.width;
    const teamHeight = tRect.height;
    const teamCenterX = teamLeft + teamWidth / 2;
    const teamCenterY = teamTop + teamHeight / 2;

    // 判斷該陣營九宮格在視口上位於左半場還是右半場
    const isLeftTeam = teamCenterX < defaultWidth / 2;

    switch (targetType) {
      case TargetType.ALL_ENEMIES:
      case TargetType.ALL_ALLIES:
        // 🌟 全體：九宮格正中心 (中排中)
        return { x: teamCenterX, y: teamCenterY };

      case TargetType.FRONT_ENEMIES:
        // 🛡️ 前排：前排欄位物理中心 (左陣靠右 5/6，右陣靠左 1/6)
        return {
          x: isLeftTeam ? teamLeft + teamWidth * (5 / 6) : teamLeft + teamWidth * (1 / 6),
          y: teamCenterY
        };

      case TargetType.BACK_ENEMY:
        // 🏹 後排：後排欄位物理中心 (左陣靠左 1/6，右陣靠右 5/6)
        return {
          x: isLeftTeam ? teamLeft + teamWidth * (1 / 6) : teamLeft + teamWidth * (5 / 6),
          y: teamCenterY
        };

      case TargetType.SINGLE_ENEMY:
      case TargetType.ALLY_LOWEST_HP:
      case TargetType.ALLY_DEAD:
      default:
        // 🎯 單體或未指定：取該特定單位卡片中心；若無卡片則退回九宮格中心
        if (mainTargetId) {
          return getUnitPoint(mainTargetId, targetSide);
        }
        return { x: teamCenterX, y: teamCenterY };
    }
  }
}
