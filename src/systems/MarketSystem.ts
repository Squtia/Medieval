import { MapNode, NodeLevel, MaterialItem, WeatherType, TerrainType } from '../models/types';
import { Random } from '../core/Random';
import materialsJson from '../data/materials.json';

// 全遊戲唯一真理來源：直接由 materials.json 讀取所有素材與物資
export const TRADE_GOODS: MaterialItem[] = materialsJson as MaterialItem[];

export class MarketSystem {
  /**
   * 初始化節點市場資料
   */
  public static initMarket(node: MapNode, currentDay: number): void {
    // 只有村莊以上有市場
    if (node.nodeLevel < NodeLevel.VILLAGE) return;

    node.marketData = {
      lastUpdateDay: currentDay,
      goods: []
    };
    
    // 預設地形特產對照
    const TERRAIN_SPECIALTY: Partial<Record<string, string[]>> = {
      PLAINS:        ['tg_wheat', 'tg_cotton'],
      FOREST:        ['tg_timber', 'tg_meat', 'tg_hide'],
      SNOW_MOUNTAIN: ['tg_ice_crystal', 'tg_stone'],
      VOLCANO:       ['tg_obsidian', 'tg_iron'],
      DESERT:        ['tg_spice']
    };

    // 優先使用自訂盛產物資，若無則依地形回退
    const specialtyIds = (node.producedGoods && node.producedGoods.length > 0)
      ? node.producedGoods
      : (TERRAIN_SPECIALTY[node.terrain] ?? []);

    const specialtyGoods = specialtyIds
      .map(id => TRADE_GOODS.find(g => g.id === id))
      .filter(Boolean) as typeof TRADE_GOODS;

    const numGoods = Math.max(specialtyGoods.length, Random.int(3, 5));
    const otherGoods = TRADE_GOODS.filter(g => !specialtyIds.includes(g.id));
    const shuffled = [...otherGoods].sort(() => 0.5 - Random.next());
    const extras = shuffled.slice(0, Math.max(0, numGoods - specialtyGoods.length));
    const selected = [...specialtyGoods, ...extras];

    const demandedSet = new Set(node.demandedGoods || []);

    for (const good of selected) {
      let multiplier = 1.0;
      
      // 盛產/自訂特產半價（原產地批發優惠）
      if (specialtyIds.includes(good.id)) {
        multiplier = 0.5;
      }

      const baseValue = good.basePrice * multiplier;
      const fluctuation = 0.8 + Random.next() * 0.4; // 0.8 ~ 1.2
      let finalPrice = Math.max(1, Math.floor(baseValue * fluctuation));

      // 若該物資為該城鎮短缺/高價收購需求品 (Demanded)
      const isDemanded = demandedSet.has(good.id);
      const buyMultiplier = isDemanded ? 1.6 : 1.2;
      const sellMultiplier = isDemanded ? 1.4 : 1.0;

      node.marketData.goods.push({
        goodId: good.id,
        buyPrice: Math.floor(finalPrice * buyMultiplier), // 買入價
        sellPrice: Math.floor(finalPrice * sellMultiplier), // 賣出價
        stock: isDemanded ? Random.int(0, 5) : (Random.int(10, 49) + 10 * node.nodeLevel) // 需求品缺貨，盛產品充裕
      });
    }
  }

  /**
   * 更新市場價格 (受天氣與繁榮度影響)
   */
  public static updateMarkets(nodes: MapNode[], currentDay: number): void {
    for (const node of nodes) {
      if (node.nodeLevel < NodeLevel.VILLAGE) {
        node.marketData = undefined;
        continue;
      }
      
      if (!node.marketData) {
        this.initMarket(node, currentDay);
      } else {
        // 每 7 天更新一次物價
        if (currentDay - node.marketData.lastUpdateDay >= 7) {
          node.marketData.lastUpdateDay = currentDay;
          
          // 隨機觸發動態需求事件 (20% 機率)
          if (Random.next() < 0.20) {
             const randomGood = Random.pick(node.marketData.goods);
             const goodRef = TRADE_GOODS.find(g => g.id === randomGood.goodId);
             if (goodRef) {
                let desc = '';
                let mult = 2.0;
                if (goodRef.type === 'FOOD') desc = '當地遭遇飢荒，急需糧食！';
                else if (goodRef.type === 'MATERIAL') desc = '當地大興土木，急需建材！';
                else if (goodRef.type === 'LUXURY') desc = '當地貴族舉辦盛宴，高價收購奢侈品！';
                else desc = '當地對此特產產生狂熱需求！';
                
                node.marketData.demandEvent = {
                  goodId: goodRef.id,
                  description: desc,
                  priceMultiplier: mult
                };
             }
          } else {
             node.marketData.demandEvent = undefined;
          }
          
          for (const item of node.marketData.goods) {
            const goodRef = TRADE_GOODS.find(g => g.id === item.goodId);
            if (!goodRef) continue;

            let modifier = 1.0;

            // 繁榮度影響: 繁榮度越高，奢侈品需求越高(價格漲)，但基礎物資穩定
            if (node.prosperity > 300 && goodRef.type === 'LUXURY') {
              modifier *= 1.2;
            }

            // 天氣影響
            if (node.currentWeather === WeatherType.RAIN && goodRef.type === 'FOOD') modifier *= 0.9; // 雨天豐收
            if (node.currentWeather === WeatherType.SNOW && goodRef.type === 'FOOD') modifier *= 1.5; // 暴雪缺糧
            if (node.currentWeather === WeatherType.SANDSTORM && goodRef.type === 'MATERIAL') modifier *= 1.3; // 沙暴缺建材
            
            const fluctuation = 0.8 + Random.next() * 0.4;
            let newBase = goodRef.basePrice * modifier * fluctuation;
            
            if (node.marketData.demandEvent && node.marketData.demandEvent.goodId === item.goodId) {
               newBase *= node.marketData.demandEvent.priceMultiplier;
            }
            
            item.buyPrice = Math.max(1, Math.floor(newBase * 1.2));
            item.sellPrice = Math.max(1, Math.floor(newBase));
            
            // 補充庫存
            item.stock += Random.int(0, 19);
          }
        }
      }
    }
  }
}
