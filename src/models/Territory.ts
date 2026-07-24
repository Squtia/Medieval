import { Equipment, NobleTitle, WorkerJob, getMaxFacilityLevel } from './types';
import { Adventurer } from './Adventurer';
import { CombatHistoryRecord } from './Combat';

/**
 * 領地 (Territory) 模型
 * 代表玩家自身的資源、發展與貴族權力核心
 */
export class Territory {
  public name: string;
  public title: NobleTitle; // 當前爵位
  
  // === 經濟與生存資源 ===
  public gold: number;      // 金幣 (透過稅收或任務獲得)
  public food: number;      // 糧食 (維持人口生存必須)
  public wood: number;      // 木材 (基礎建材)
  public stone: number;     // 石材 (進階建材)
  public iron: number;      // 鐵礦 (高級資源)
  
  // === 勞動力與人口 ===
  public population: number; // 總人口數
  public workers: Record<string, number>; // 分配的勞動力狀態
  
  public prestige: number;  // 聲望，用於解鎖進階玩法或晉升爵位
  public royalFavor: number; // 皇家好感度，與政治經營要素相關
  public unlockedBuildings: string[]; // 已解鎖的建築列表 (如：酒館、訓練所等)
  public warehouse: Equipment[]; // 領地的裝備倉庫
  public retiredStaff: Adventurer[]; // 退休的冒險者名單
  public tradeInventory: Record<string, number>; // 交易品庫存 (物品ID -> 數量)

  // 內政與外交屬性
  public taxRate: number;         // 稅率 (預設 1.0)
  public adventurerBudget: number; // 冒險者預算 (每回合扣除)
  public diplomaticGift: number;   // 外交獻禮金 (每回合扣除)

  // 據點與國家屬性
  public currentCountryId: string | null; // 當前選擇建立據點的國家/節點 ID，初期可能為空
  
  // 事件與狀態屬性
  public pendingEvents: string[]; // 待處理的普通事件 ID
  public eventPressure: number;   // 事件壓力值 (累積到一定程度觸發事件)

  // 探索屬性
  public exploredToday: number;
  public maxExplorationsPerDay: number;
  
  // 建築等級與建造狀態 (0 級代表未建造)
  public tavernLevel: number;
  public weaponShopLevel: number;
  public armorShopLevel: number;
  public forgeLevel: number;

  // 自宅探索招募進度與保底狀態
  public exploreCount: number;
  public hasRecruitedFromFirstExplorations: boolean;
  
  // 戰鬥歷史紀錄
  public combatHistory: CombatHistoryRecord[];

  // 治安
  public security: number = 100;

  constructor(name: string, startingCountryId: string | null = null) {
    this.name = name;
    this.title = NobleTitle.COMMONER; // 玩家預設從平民起步
    this.currentCountryId = startingCountryId;
    
    // 初始化資源與人口
    this.gold = 50;                 
    this.food = 200; // 初始給予一些存糧避免馬上餓死
    this.wood = 0;
    this.stone = 0;
    this.iron = 0;
    this.population = 10; // 初始 10 個人口
    this.workers = {
      'UNASSIGNED': 10,
      'FARMER': 0,
      'WOODCUTTER': 0,
      'MINER': 0
    };

    this.prestige = 0;
    this.royalFavor = 0;
    this.unlockedBuildings = [];   // 尚未擁有任何建築
    this.warehouse = [];           // 初始化空倉庫
    this.retiredStaff = [];        // 初始化退休名單
    this.tradeInventory = {};      // 初始化交易品庫存
    
    // 初始化建築等級與探索保底
    this.tavernLevel = 0;
    this.weaponShopLevel = 0;
    this.armorShopLevel = 0;
    this.forgeLevel = 0;
    this.exploreCount = 0;
    this.hasRecruitedFromFirstExplorations = false;
    
    // 初始化內政預設值
    this.taxRate = 1.0;
    this.adventurerBudget = 0;
    this.diplomaticGift = 0;
    this.pendingEvents = [];
    this.eventPressure = 0;
    this.exploredToday = 0;
    this.maxExplorationsPerDay = 1; // 預設一回合只能探索一次
    this.combatHistory = []; // 初始化歷史紀錄
  }

  // ==========================================
  // 建築升級與建造系統
  // ==========================================
  
  public getBuildingLevel(bldType: 'tavern' | 'weapon' | 'armor' | 'forge'): number {
    if (bldType === 'tavern') return this.tavernLevel || 0;
    if (bldType === 'weapon') return this.weaponShopLevel || 0;
    if (bldType === 'armor') return this.armorShopLevel || 0;
    return this.forgeLevel || 0;
  }

  public getUpgradeCost(bldType: 'tavern' | 'weapon' | 'armor' | 'forge', nextLevel: number) {
    if (bldType === 'tavern') {
      if (nextLevel === 1) return { gold: 300, wood: 80, stone: 40, iron: 0 };
      if (nextLevel === 2) return { gold: 1000, wood: 200, stone: 120, iron: 10 };
      return { gold: 3000, wood: 500, stone: 350, iron: 40 };
    } else if (bldType === 'weapon' || bldType === 'armor') {
      if (nextLevel === 1) return { gold: 200, wood: 60, stone: 30, iron: 0 };
      if (nextLevel === 2) return { gold: 800, wood: 150, stone: 90, iron: 10 };
      return { gold: 2500, wood: 400, stone: 250, iron: 30 };
    } else { // forge 鐵匠鋪
      if (nextLevel === 1) return { gold: 300, wood: 50, stone: 50, iron: 0 };
      if (nextLevel === 2) return { gold: 1200, wood: 250, stone: 200, iron: 15 };
      return { gold: 3500, wood: 600, stone: 500, iron: 50 };
    }
  }

  public canUpgradeBuilding(bldType: 'tavern' | 'weapon' | 'armor' | 'forge'): boolean {
    const nextLevel = this.getBuildingLevel(bldType) + 1;
    if (nextLevel > 3) return false; // 遊戲絕對上限 3 等
    
    // 爵位等級上限卡控
    const maxAllowed = getMaxFacilityLevel(this.title);
    if (nextLevel > maxAllowed) return false;
    
    const cost = this.getUpgradeCost(bldType, nextLevel);
    return this.gold >= cost.gold &&
           this.wood >= cost.wood &&
           this.stone >= cost.stone &&
           this.iron >= cost.iron;
  }

  public upgradeBuilding(bldType: 'tavern' | 'weapon' | 'armor' | 'forge'): boolean {
    if (!this.canUpgradeBuilding(bldType)) return false;
    const nextLevel = this.getBuildingLevel(bldType) + 1;
    const cost = this.getUpgradeCost(bldType, nextLevel);
    
    this.gold -= cost.gold;
    this.wood -= cost.wood;
    this.stone -= cost.stone;
    this.iron -= cost.iron;
    
    if (bldType === 'tavern') this.tavernLevel = nextLevel;
    else if (bldType === 'weapon') this.weaponShopLevel = nextLevel;
    else if (bldType === 'armor') this.armorShopLevel = nextLevel;
    else this.forgeLevel = nextLevel;
    
    console.log(`[系統] 🏛️ 建造/升級成功！您的 ${bldType === 'tavern' ? '酒館' : bldType === 'weapon' ? '武器店' : bldType === 'armor' ? '防具店' : '鍛造屋'} 已提升至等級 ${nextLevel}。`);
    return true;
  }

  /**
   * 遷移據點至新國家
   */
  public migrateTo(countryId: string, cost: number = 0): boolean {
    if (this.gold >= cost) {
      this.gold -= cost;
      this.currentCountryId = countryId;
      return true;
    }
    return false;
  }

  /**
   * 增加金幣收益（允許負值，讓赤字結算真正扣錢）
   */
  public addGold(amount: number): void {
    this.gold += amount;
  }

  /**
   * 解鎖新建築
   */
  public unlockBuilding(buildingId: string): void {
    if (!this.unlockedBuildings.includes(buildingId)) {
      this.unlockedBuildings.push(buildingId);
    }
  }

  /**
   * 增加裝備到倉庫
   */
  public addEquipmentToWarehouse(eq: Equipment): void {
    this.warehouse.push(eq);
  }

  /**
   * 從倉庫移除裝備 (透過 UUID)
   */
  public removeEquipmentFromWarehouse(uuid: string): Equipment | null {
    const idx = this.warehouse.findIndex(e => e.uuid === uuid);
    if (idx !== -1) {
      const eq = this.warehouse[idx];
      this.warehouse.splice(idx, 1);
      return eq;
    }
    return null;
  }

  /**
   * 冒險者退休，加入退休名單並給予全域加成
   */
  public retireAdventurer(adv: Adventurer): void {
    this.retiredStaff.push(adv);
    // 依據魅力給予每日額外稅收的微幅加成 (舉例)
    const charmBonus = adv.getEffectiveAttributes().charm;
    this.taxRate += (charmBonus * 0.01);
  }

  /**
   * 分配勞動力
   * @param job 目標職業
   * @param amount 正數為增加，負數為減少
   * @returns 是否分配成功
   */
  public assignWorker(job: string, amount: number): boolean {
    if (job === 'UNASSIGNED') return false; // 不能直接加減 UNASSIGNED，它是算出來的

    const currentAssigned = this.workers[job] || 0;
    
    if (amount > 0) {
      // 增加分配，檢查是否有足夠的閒置人口
      if (this.workers['UNASSIGNED'] >= amount) {
        this.workers[job] = currentAssigned + amount;
        this.workers['UNASSIGNED'] -= amount;
        return true;
      }
    } else {
      // 減少分配，檢查該職業是否有人可減
      const reduceAmount = Math.abs(amount);
      if (currentAssigned >= reduceAmount) {
        this.workers[job] = currentAssigned - reduceAmount;
        this.workers['UNASSIGNED'] += reduceAmount;
        return true;
      }
    }
    return false;
  }

  /**
   * 新增一筆戰鬥紀錄
   */
  public addCombatRecord(record: CombatHistoryRecord): void {
    this.combatHistory.unshift(record); // 將最新紀錄放在最前面
  }

  /**
   * 清理超過天數的戰鬥紀錄
   */
  public cleanupCombatHistory(currentDay: number, keepDays: number = 3): void {
    this.combatHistory = this.combatHistory.filter(record => {
      return (currentDay - record.day) <= keepDays;
    });
  }

  /**
   * 同步總人口與各項工作人口的總和
   * 以修復讀檔或數據異常時造成的總人口與閒置人力落差
   */
  public syncPopulation(): void {
    const totalWorkers = Object.values(this.workers).reduce((sum, count) => sum + (count || 0), 0);
    this.population = totalWorkers;
  }
}
