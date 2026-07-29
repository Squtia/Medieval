import { Equipment, NobleTitle, WorkerJob, getNodeMaxFacilityLevel, NodeLevel } from './types';
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
  public get population(): number {
    return Object.values(this.workers).reduce((sum, count) => sum + (count || 0), 0);
  }
  public set population(val: number) {
    // 虛擬 Setter，僅供 SaveManager 反序列化時相容，避免報錯
  }
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
  public defenseLevel: number;

  // 自宅探索招募進度與保底狀態
  public exploreCount: number;
  public hasRecruitedFromFirstExplorations: boolean;
  public refugeeDiscoveryCooldownDays: number;
  
  // 戰鬥歷史紀錄
  public combatHistory: CombatHistoryRecord[];

  // 治安與侵略
  public security: number = 100;
  public invasionCooldown: number = 0;

  constructor(name: string, startingCountryId: string | null = null) {
    this.name = name;
    this.title = NobleTitle.COMMONER; // 玩家預設從平民起步
    this.currentCountryId = startingCountryId;
    
    // 初始化資源與人口
    this.gold = 150;                 
    this.food = 200; // 初始給予一些存糧避免馬上餓死
    this.wood = 0;
    this.stone = 0;
    this.iron = 0;
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
    this.defenseLevel = 0;
    this.exploreCount = 0;
    this.hasRecruitedFromFirstExplorations = false;
    this.refugeeDiscoveryCooldownDays = 0;
    
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
  
  public getBuildingLevel(bldType: 'tavern' | 'weapon' | 'armor' | 'forge' | 'defense'): number {
    if (bldType === 'tavern') return this.tavernLevel || 0;
    if (bldType === 'weapon') return this.weaponShopLevel || 0;
    if (bldType === 'armor') return this.armorShopLevel || 0;
    if (bldType === 'defense') return this.defenseLevel || 0;
    return this.forgeLevel || 0;
  }

  public getBuildingProsperityBonus(): number {
    // 每個等級提供永久繁榮度加成
    const calcBonus = (lvl: number) => {
      let bonus = 0;
      for (let i = 1; i <= lvl; i++) {
        bonus += (i === 1) ? 10 : (i === 2) ? 15 : 20; // Lv1=10, Lv2=10+15=25, Lv3=25+20=45...
      }
      return bonus;
    };
    
    return calcBonus(this.getBuildingLevel('tavern')) +
           calcBonus(this.getBuildingLevel('weapon')) +
           calcBonus(this.getBuildingLevel('armor')) +
           calcBonus(this.getBuildingLevel('forge')) +
           calcBonus(this.getBuildingLevel('defense'));
  }

  public getUpgradeCost(bldType: 'tavern' | 'weapon' | 'armor' | 'forge' | 'defense', nextLevel: number) {
    let baseCost;
    if (bldType === 'tavern') {
      if (nextLevel === 1) return { gold: 300, wood: 80, stone: 40, iron: 0 };
      if (nextLevel === 2) return { gold: 1000, wood: 200, stone: 120, iron: 10 };
      baseCost = { gold: 3000, wood: 500, stone: 350, iron: 40 };
    } else if (bldType === 'weapon' || bldType === 'armor') {
      if (nextLevel === 1) return { gold: 200, wood: 60, stone: 30, iron: 0 };
      if (nextLevel === 2) return { gold: 800, wood: 150, stone: 90, iron: 10 };
      baseCost = { gold: 2500, wood: 400, stone: 250, iron: 30 };
    } else if (bldType === 'forge') { // forge 鐵匠鋪
      if (nextLevel === 1) return { gold: 300, wood: 50, stone: 50, iron: 0 };
      if (nextLevel === 2) return { gold: 1200, wood: 250, stone: 200, iron: 15 };
      baseCost = { gold: 3500, wood: 600, stone: 500, iron: 50 };
    } else { // defense 防禦設施
      if (nextLevel === 1) return { gold: 100, wood: 100, stone: 50, iron: 0 };
      if (nextLevel === 2) return { gold: 500, wood: 300, stone: 200, iron: 0 };
      baseCost = { gold: 2000, wood: 800, stone: 600, iron: 20 };
    }
    
    if (nextLevel <= 3) return baseCost;
    
    // 4級以上：成本指數成長 (每一級約需 2.5 倍)
    const multiplier = Math.pow(2.5, nextLevel - 3);
    return {
      gold: Math.floor(baseCost.gold * multiplier),
      wood: Math.floor(baseCost.wood * multiplier),
      stone: Math.floor(baseCost.stone * multiplier),
      iron: Math.floor(baseCost.iron * multiplier)
    };
  }

  public canUpgradeBuilding(bldType: 'tavern' | 'weapon' | 'armor' | 'forge' | 'defense', nodeLevel: NodeLevel = NodeLevel.WILDERNESS): boolean {
    const nextLevel = this.getBuildingLevel(bldType) + 1;

    
    // 據點規模上限卡控
    const maxAllowed = getNodeMaxFacilityLevel(nodeLevel);
    if (nextLevel > maxAllowed) return false;
    
    const cost = this.getUpgradeCost(bldType, nextLevel);
    return this.gold >= cost.gold &&
           this.wood >= cost.wood &&
           this.stone >= cost.stone &&
           this.iron >= cost.iron;
  }

  public upgradeBuilding(bldType: 'tavern' | 'weapon' | 'armor' | 'forge' | 'defense', nodeLevel: NodeLevel = NodeLevel.WILDERNESS): boolean {
    if (!this.canUpgradeBuilding(bldType, nodeLevel)) return false;
    const nextLevel = this.getBuildingLevel(bldType) + 1;
    const cost = this.getUpgradeCost(bldType, nextLevel);
    
    this.gold -= cost.gold;
    this.wood -= cost.wood;
    this.stone -= cost.stone;
    this.iron -= cost.iron;
    
    if (bldType === 'tavern') this.tavernLevel = nextLevel;
    else if (bldType === 'weapon') this.weaponShopLevel = nextLevel;
    else if (bldType === 'armor') this.armorShopLevel = nextLevel;
    else if (bldType === 'forge') this.forgeLevel = nextLevel;
    else this.defenseLevel = nextLevel;
    
    const bldName = bldType === 'tavern' ? '酒館' : bldType === 'weapon' ? '武器店' : bldType === 'armor' ? '防具店' : bldType === 'forge' ? '鍛造屋' : '防禦設施';
    console.log(`[系統] 🏛️ 建造/升級成功！您的 ${bldName} 已提升至等級 ${nextLevel}。`);
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
   * 安全裁減勞工與人口
   * @param amount 要扣減的數量
   * @param prioritizeUnassigned 是否優先扣除閒置人力
   * @returns 實際扣減的人數
   */
  public removeWorkers(amount: number, prioritizeUnassigned: boolean = true): number {
    if (amount <= 0) return 0;
    
    let leftToRemove = amount;
    
    if (prioritizeUnassigned) {
      if (this.workers['UNASSIGNED'] >= leftToRemove) {
        this.workers['UNASSIGNED'] -= leftToRemove;
        leftToRemove = 0;
      } else {
        leftToRemove -= (this.workers['UNASSIGNED'] || 0);
        this.workers['UNASSIGNED'] = 0;
      }
    }
    
    let safetyCounter = 0;
    while (leftToRemove > 0 && safetyCounter < 1000) {
      safetyCounter++;
      const jobKeys = Object.keys(this.workers);
      // 如果優先扣除 UNASSIGNED，隨機階段就排除它
      const validKeys = prioritizeUnassigned ? jobKeys.filter(k => k !== 'UNASSIGNED') : jobKeys;
      
      const hasWorkers = validKeys.some(k => this.workers[k] > 0);
      if (!hasWorkers) break;

      const randIndex = Math.floor(Math.random() * validKeys.length);
      const randJob = validKeys[randIndex];
      if (this.workers[randJob] > 0) {
        this.workers[randJob]--;
        leftToRemove--;
      }
    }
    
    return amount - leftToRemove;
  }
}
