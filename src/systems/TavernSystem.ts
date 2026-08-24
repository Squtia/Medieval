import { GameState } from '../core/GameState';
import { Random } from '../core/Random';
import { Adventurer } from '../models/Adventurer';
import { Territory } from '../models/Territory';
import { NameGenerator } from './NameGenerator';
import { DataStore } from './DataStore';
import { Gender } from '../models/types';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { RumorData, LOCATION_FOG_RUMORS, LOCATION_REVEAL_RUMORS } from '../data/RumorData';
import { NarrativeSystem } from './NarrativeSystem';

export class TavernSystem {
  /**
   * 每日更新酒館旅客流動
   */
  public static updateTavernGuests(territory: Territory): void {
    if (territory.tavernLevel <= 0) return; // 沒有酒館

    // 1. 決定容量上限 (最高 10 人)
    let maxCapacity = 2;
    if (territory.tavernLevel === 2) maxCapacity = 3;
    else if (territory.tavernLevel === 3) maxCapacity = 5;
    else if (territory.tavernLevel === 4) maxCapacity = 7;
    else if (territory.tavernLevel >= 5) maxCapacity = 10;

    // 2. 對每個已有客人進行獨立離店判定 (stayDaysLeft 歸零或 50% 獨立離店機率)
    territory.tavernGuests = territory.tavernGuests.filter(guest => {
      guest.stayDaysLeft -= 1;
      if (guest.stayDaysLeft <= 0) return false; // 逗留時間到，離店
      // 每位客人每日有 50% 個別獨立結帳離店機率
      if (Random.next() < 0.5) return false;
      return true;
    });

    // 3. 對每個空座位進行獨立入住判定 (每個空位 70% 機率吸引新傭兵)
    const emptySlots = maxCapacity - territory.tavernGuests.length;
    for (let i = 0; i < emptySlots; i++) {
      // 保底機制：若酒館客人小於 2 人則 100% 補滿，否則每個空位 70% 機率入住
      const fillChance = territory.tavernGuests.length < 2 ? 1.0 : 0.7;
      if (Random.next() < fillChance) {
        const quality = this.rollQuality(territory.tavernLevel);
        const gender = Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE;
        const adv = new Adventurer(
          `adv_${Date.now()}_${Random.int(1, 10000)}`,
          NameGenerator.generateFullName(gender),
          DataStore.getRandomJob(),
          DataStore.getRandomRecruitTrait(),
          quality,
          gender
        );
        
        // 短期流動天數：1 ~ 3 天
        const stayDays = (Random.next() < 0.05) ? 5 : Random.int(1, 3);
        
        territory.tavernGuests.push({
          adventurer: adv,
          stayDaysLeft: stayDays
        });
      }
    }
  }

  /**
   * 根據酒館等級決定傭兵品質
   */
  private static rollQuality(lvl: number): 'N' | 'R' | 'SR' | 'SSR' {
    const r = Random.next();
    if (lvl <= 2) {
      // 營火階段：幾乎只有 N，極低 R
      return r < 0.05 ? 'R' : 'N';
    } else if (lvl <= 4) {
      // 簡易酒館：開始出現 SR
      if (r < 0.05) return 'SR';
      if (r < 0.25) return 'R';
      return 'N';
    } else {
      // 高級酒館：解鎖 SSR
      if (r < 0.05) return 'SSR';
      if (r < 0.20) return 'SR';
      if (r < 0.60) return 'R';
      return 'N';
    }
  }

  /**
   * 玩家打聽情報 (消耗金幣)
   * 回傳: 該情報的文本
   */
  public static askRumor(territory: Territory): string {
    if (territory.gold < 50) return '金幣不足...';
    if (territory.tavernLevel < 3) return '老爹沒空理你...';

    // 扣款
    territory.gold -= 50;
    EventBus.getInstance().publish({
      type: GameEventType.RESOURCE_CHANGED,
      payload: { resourceType: 'gold', amount: -50, currentTotal: territory.gold }
    });

    const storyRumor = NarrativeSystem.consumeTavernRumor();
    if (storyRumor) {
      NarrativeSystem.ensureStoryTodos();
      import('../ui/UIManager').then(({ UIManager }) => UIManager.updateUI());
      return `老爹確認四下無人後壓低聲音：「${storyRumor.node.description}」`;
    }

    const mapNodes = GameState.mapSystem?.getNodes() || [];
    const hiddenNodes = mapNodes.filter(n => n.isHidden === true);

    const r = Random.next();
    
    // 30% 機率解鎖地圖 (前提是還有隱藏地圖)
    if (r < 0.3 && hiddenNodes.length > 0) {
      const targetNode = Random.pick(hiddenNodes);
      
      // 判斷迷霧
      if (!targetNode.isScouted) {
        // 未驅散迷霧：只給模糊提示
        const fogRumor = Random.pick(LOCATION_FOG_RUMORS);
        return `老爹低聲說道：「${fogRumor}」\n(提示：您打聽到了某個未知區域的線索。)`;
      } else {
        // 已驅散迷霧：直接揭露
        targetNode.isHidden = false;
        const revealRumor = Random.pick(LOCATION_REVEAL_RUMORS);
        return `老爹擦了擦酒杯：「${revealRumor}」\n(提示：地圖上的「${targetNode.name}」已解鎖！)`;
      }
    }

    // 10% 機率給予臨時增益 (未來可實作戰鬥 Buff)
    if (r >= 0.3 && r < 0.4) {
      return '老爹笑著說：「今天我心情好，這杯算我的！」\n(提示：老爹請客，下一次戰鬥全隊士氣微幅提升。)';
    }

    // 60% 閒聊傳聞
    const rumor = Random.pick(RumorData);
    return rumor.text;
  }
}
