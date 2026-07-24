import { TerrainType, MonsterData, MonsterRace } from '../models/types';
import { Random } from '../core/Random';
import monstersJson from '../data/monsters.json';

export class MonsterSystem {
  private monsters: MonsterData[] = [];

  constructor() {
    this.monsters = monstersJson as MonsterData[];
  }

  /**
   * 根據地形與難度生成一批敵方怪物
   */
  public generateEncounter(terrain: TerrainType, baseDifficulty: number): import('../models/types').MonsterInstance[] {
    // 1. 過濾出符合地形的魔物
    const validMonsters = this.monsters.filter(m => m.terrains.includes(terrain));
    let selectedBaseMonster: MonsterData;
    
    if (validMonsters.length === 0) {
      // 若該地形沒有設定魔物，退回隨機取一隻非Boss魔物
      const defaultMonsters = this.monsters.filter(m => !m.isBoss);
      if (defaultMonsters.length > 0) {
        selectedBaseMonster = Random.pick(defaultMonsters);
      } else {
        return [];
      }
    } else {
      selectedBaseMonster = Random.pick(validMonsters);
    }
    
    // 2. 實例化魔物並動態分配數值
    // 單一魔物戰力 = 節點難度 * 強度係數 * 10
    const powerScore = Math.max(10, baseDifficulty * selectedBaseMonster.powerTier * 10);
    
    // 根據種族分配數值 (HP 佔比較大，攻擊防禦閃避則按比例)
    let hpRatio = 0.5;
    let atkRatio = 0.3;
    let defRatio = 0.15;
    let evaRatio = 0.05;
    
    switch (selectedBaseMonster.race) {
       case MonsterRace.UNDEAD:
          hpRatio = 0.6; atkRatio = 0.2; defRatio = 0.2; evaRatio = 0.0; break;
       case MonsterRace.MONSTER:
          hpRatio = 0.55; atkRatio = 0.35; defRatio = 0.05; evaRatio = 0.05; break;
       case MonsterRace.HUMAN:
          hpRatio = 0.45; atkRatio = 0.35; defRatio = 0.1; evaRatio = 0.1; break;
       case MonsterRace.DRAGON:
          hpRatio = 0.4; atkRatio = 0.4; defRatio = 0.15; evaRatio = 0.05; break;
    }
    
    const hp = Math.floor(powerScore * hpRatio);
    const damage = Math.floor((powerScore * atkRatio) / 2); // 傷害數值壓縮
    const defense = Math.floor((powerScore * defRatio) / 2);
    const evade = Math.min(0.5, powerScore * evaRatio * 0.001); // 閃避率轉換
    
    const instance: import('../models/types').MonsterInstance = {
       ...selectedBaseMonster,
       hp,
       damage,
       defense,
       evade,
       calculatedPowerScore: powerScore
    };
    
    // 3. 根據 baseDifficulty 決定怪物數量 (總戰力不要超過難度的 3~5 倍)
    // 這裡我們簡化為 1~5 隻，強怪少，弱怪多
    let count = Math.max(1, Math.floor(baseDifficulty / (selectedBaseMonster.powerTier * 5))); 
    if (count > 5) count = 5;
    if (selectedBaseMonster.isBoss) count = 1; // Boss 通常只有一隻
    
    const encounter: import('../models/types').MonsterInstance[] = [];
    for (let i = 0; i < count; i++) {
      encounter.push({...instance}); // 複製實體
    }
    
    return encounter;
  }

  public getMonsterById(id: string): MonsterData | undefined {
    return this.monsters.find(m => m.id === id);
  }
}

// 單例模式導出
export const monsterSystem = new MonsterSystem();
