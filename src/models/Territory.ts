import { Equipment, NobleTitle } from './types';
import { Adventurer } from './Adventurer';

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
    
    // 初始化內政預設值
    this.taxRate = 1.0;
    this.adventurerBudget = 0;
    this.diplomaticGift = 0;
    this.pendingEvents = [];
    this.eventPressure = 0;
    this.exploredToday = 0;
    this.maxExplorationsPerDay = 1; // 預設一回合只能探索一次
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
   * 增加金幣收益 (示範基本邏輯)
   */
  public addGold(amount: number): void {
    if (amount > 0) {
      this.gold += amount;
    }
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
}
