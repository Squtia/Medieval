import { Territory } from '../models/Territory';
import { Adventurer } from '../models/Adventurer';
import { GameState } from '../core/GameState';

export class ChurchSystem {
  /**
   * 🧮 取得退休祈禱者所提供的全領地醫療被動加成
   * 規則：每 2 位退休神職傭兵 (PRAYER/CLERIC/PRIEST/BISHOP)，提供每日自然恢復 +1%、藥水治療效果 +1%
   */
  public static getRetiredPrayersBonus(): { recoveryBonusPct: number; potionBonusPct: number; prayerCount: number } {
    const retired = (GameState.retiredAdventurers || []) as Adventurer[];
    const prayerJobs = new Set(['prayer', 'cleric', 'priest', 'bishop', 'saint', 'shaman']);
    const prayerCount = retired.filter(a => {
      const jobId = ((a.job as any)?.id || (a.job as any)?.key || '').toLowerCase();
      const jobName = (a.job?.name || '').toLowerCase();
      return prayerJobs.has(jobId) || jobName.includes('祈禱') || jobName.includes('神官') || jobName.includes('牧師') || jobName.includes('主教');
    }).length;

    const pairs = Math.floor(prayerCount / 2);
    return {
      prayerCount,
      recoveryBonusPct: pairs * 0.01, // e.g. 2位 = +1% (0.01)
      potionBonusPct: pairs * 0.01
    };
  }

  /**
   * 🔨 在醫療所打造一張新病床
   * 成本：木板 (mat_wood_plank) 20、皮革 (mat_leather) 10
   */
  public static getBedCost(): { plank: number; leather: number } {
    return { plank: 20, leather: 10 };
  }

  /**
   * 🔨 打造新病床 (消耗木板與皮革)
   */
  public static buildBed(territory: Territory): { success: boolean; message: string } {
    const lvl = territory.churchLevel || 0;
    if (lvl <= 0) {
      return { success: false, message: '⚠️ 領地尚未建造【祈禱處/教會】，無法打造病床！' };
    }

    const maxBeds = territory.getMaxInfirmaryBeds();
    if (!territory.infirmaryBeds) territory.infirmaryBeds = [];

    if (territory.infirmaryBeds.length >= maxBeds) {
      return { success: false, message: `⚠️ 已達當前教會等級的病床上限 (${maxBeds} 床)！請升級教會以擴充床位。` };
    }

    const cost = this.getBedCost();
    if (!territory.materials) territory.materials = {};

    const currentPlank = territory.materials['mat_wood_plank'] || 0;
    const currentLeather = territory.materials['mat_leather'] || 0;

    if (currentPlank < cost.plank) {
      return { success: false, message: `⚠️ 木板不足！需要 ${cost.plank} 木板 (現有 ${currentPlank})` };
    }
    if (currentLeather < cost.leather) {
      return { success: false, message: `⚠️ 皮革不足！需要 ${cost.leather} 皮革 (現有 ${currentLeather})` };
    }

    territory.materials['mat_wood_plank'] -= cost.plank;
    territory.materials['mat_leather'] -= cost.leather;

    const newBedId = `bed_${Date.now()}_${territory.infirmaryBeds.length + 1}`;
    territory.infirmaryBeds.push({
      id: newBedId,
      isOccupied: false
    });

    return {
      success: true,
      message: `🔨 成功打造了第 ${territory.infirmaryBeds.length} 張病床！(當前病床: ${territory.infirmaryBeds.length}/${maxBeds})`
    };
  }

  /**
   * 🛏️ 將受傷傭兵指派躺入病床
   */
  public static assignPatient(bedId: string, advId: string, territory: Territory): { success: boolean; message: string } {
    if (!territory.infirmaryBeds) territory.infirmaryBeds = [];
    const bed = territory.infirmaryBeds.find(b => b.id === bedId);
    if (!bed) return { success: false, message: '⚠️ 找不到該病床！' };

    const adv = GameState.adventurers.find(a => a.id === advId);
    if (!adv) return { success: false, message: '⚠️ 找不到該冒險者！' };

    // 檢查是否已在其他病床
    const otherBed = territory.infirmaryBeds.find(b => b.adventurerId === advId);
    if (otherBed) {
      otherBed.adventurerId = undefined;
      otherBed.isOccupied = false;
    }

    bed.adventurerId = advId;
    bed.isOccupied = true;
    adv.inInfirmaryBed = true;

    return {
      success: true,
      message: `🏥 已安排「${adv.name}」入住病床休養！過夜每日自然恢復將額外提升 +10%。`
    };
  }

  /**
   * 🚪 將傭兵移出病床 (出院)
   */
  public static dischargePatient(bedId: string, territory: Territory): { success: boolean; message: string } {
    if (!territory.infirmaryBeds) territory.infirmaryBeds = [];
    const bed = territory.infirmaryBeds.find(b => b.id === bedId);
    if (!bed) return { success: false, message: '⚠️ 找不到該病床！' };

    if (bed.adventurerId) {
      const adv = GameState.adventurers.find(a => a.id === bed.adventurerId);
      if (adv) adv.inInfirmaryBed = false;
    }

    bed.adventurerId = undefined;
    bed.isOccupied = false;

    return { success: true, message: '✅ 該病床已清空，可指派其他傷員。' };
  }

  /**
   * 🧪 熬製生命藥水 (消耗 50 株野生藥草 tg_Medicinal_herbs ➔ 1 瓶小型生命藥水 item_healing_potion_s)
   */
  public static brewHealingPotion(count: number, territory: Territory): { success: boolean; message: string } {
    if (count <= 0) return { success: false, message: '⚠️ 製作數量必須大於 0！' };

    const herbReqPerPotion = 50;
    const totalHerbsNeeded = herbReqPerPotion * count;
    if (!territory.materials) territory.materials = {};
    const curHerbs = territory.materials['tg_Medicinal_herbs'] || 0;

    if (curHerbs < totalHerbsNeeded) {
      return {
        success: false,
        message: `⚠️ 野生藥草不足！需要 ${totalHerbsNeeded} 株藥草 (現有 ${curHerbs} 株，可由伐木場副產採集或商店購買)`
      };
    }

    // 扣除藥草
    territory.materials['tg_Medicinal_herbs'] -= totalHerbsNeeded;

    // 增加藥水至素材庫存
    if (!territory.materials['item_healing_potion_s']) territory.materials['item_healing_potion_s'] = 0;
    territory.materials['item_healing_potion_s'] += count;

    return {
      success: true,
      message: `🧪 成功熬製了 ${count} 瓶【小型生命藥水】！已存入領地倉庫。(剩餘藥草: ${territory.materials['tg_Medicinal_herbs']} 株)`
    };
  }

  /**
   * 💉 使用小型生命藥水進行床位即時急救
   * 效果：立即恢復 25% MaxHP + 退休祈禱者被動加成 (冷卻 4 回合/天)
   */
  public static treatWithPotion(advId: string, territory: Territory, bedId?: string): { success: boolean; message: string; healAmount: number } {
    const adv = GameState.adventurers.find(a => a.id === advId);
    if (!adv) return { success: false, message: '⚠️ 找不到該冒險者！', healAmount: 0 };

    const potionCount = territory.materials?.['item_healing_potion_s'] || 0;
    if (potionCount <= 0) {
      return { success: false, message: '⚠️ 領地內沒有【小型生命藥水】！請先於教會熬製或至商店購買。', healAmount: 0 };
    }

    const currentTurn = GameState.totalDays;
    let bed = undefined;
    if (bedId && territory.infirmaryBeds) {
      bed = territory.infirmaryBeds.find(b => b.id === bedId);
      if (bed && bed.lastPotionUseTurn !== undefined && (currentTurn - bed.lastPotionUseTurn) < 1) {
        return { success: false, message: '⚠️ 該病床今日已進行過密集藥劑治療，需待明日藥效吸收！', healAmount: 0 };
      }
    }

    // 消耗 1 瓶藥水
    territory.materials['item_healing_potion_s'] -= 1;
    if (bed) bed.lastPotionUseTurn = currentTurn;

    const stats = adv.getCombatStats();
    const bonus = this.getRetiredPrayersBonus();
    const healPct = 0.25 + bonus.potionBonusPct; // 25% + 祈禱者加成
    const healAmount = Math.max(25, Math.floor(stats.hp * healPct));
    const mpHealAmount = Math.max(5, Math.floor(stats.mp * 0.15));

    adv.heal(healAmount, mpHealAmount);

    return {
      success: true,
      message: `✨ 為「${adv.name}」施用了【小型生命藥水】！立即恢復 ${healAmount} 點 HP、${mpHealAmount} 點 MP！(當前血量: ${adv.getCurrentHp()}/${stats.hp})${!adv.isWounded ? ' 🎉 重傷已痊癒！' : ''}`,
      healAmount
    };
  }

  /**
   * 🏛️ 建造或升級教會/醫療所設施
   */
  public static upgradeChurch(territory: Territory): { success: boolean; message: string } {
    const currentLvl = territory.churchLevel || 0;
    const nextLvl = currentLvl + 1;
    if (nextLvl > 4) {
      return { success: false, message: '⚠️ 教會已達最高等級 (Lv.4 大教堂)！' };
    }

    // 各級升級消耗與名稱
    let cost = { gold: 150, wood: 40, stone: 20 };
    let churchName = 'Lv.1 祈禱處';
    if (nextLvl === 2) {
      cost = { gold: 400, wood: 100, stone: 60 };
      churchName = 'Lv.2 禮拜堂';
    } else if (nextLvl === 3) {
      cost = { gold: 1000, wood: 250, stone: 150 };
      churchName = 'Lv.3 修道院';
    } else if (nextLvl === 4) {
      cost = { gold: 2500, wood: 600, stone: 400 };
      churchName = 'Lv.4 大教堂';
    }

    if ((territory.gold || 0) < cost.gold || (territory.wood || 0) < cost.wood || (territory.stone || 0) < cost.stone) {
      return {
        success: false,
        message: `⚠️ 資源不足！升級至 ${churchName} 需要 金幣 ${cost.gold}、木材 ${cost.wood}、石材 ${cost.stone}`
      };
    }

    territory.gold -= cost.gold;
    territory.wood -= cost.wood;
    territory.stone -= cost.stone;
    territory.churchLevel = nextLvl;

    // Lv.1 建造完成時，免費贈送第 1 張初始病床！
    if (nextLvl === 1) {
      if (!territory.infirmaryBeds) territory.infirmaryBeds = [];
      if (territory.infirmaryBeds.length === 0) {
        territory.infirmaryBeds.push({
          id: `bed_init_1`,
          isOccupied: false
        });
      }
    }

    return {
      success: true,
      message: `🏛️ 恭喜！領地教會已成功擴建為【${churchName}】！每日全領地自然恢復率提升至 ${Math.round(territory.getChurchNaturalRecoveryRate() * 100)}%，病床上限擴充至 ${territory.getMaxInfirmaryBeds()} 床。`
    };
  }
}
